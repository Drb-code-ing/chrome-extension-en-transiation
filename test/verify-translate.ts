/**
 * T4 翻译链路独立验证脚本（tsx 直接运行，无需真实网络）。
 * 用本地 http mock 一个 OpenAI 兼容 SSE 接口，验证：
 * 1) 流式增量顺序与最终完整文本；
 * 2) 无内容时 EMPTY_RESPONSE；
 * 3) 401 时映射为 AUTH_FAILED。
 * 运行：npm run test:translate
 */
import assert from 'node:assert';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { translateStream } from '../src/background/services/translate-client';
import type { AppSettings, TranslateError } from '../src/shared/types';

interface MockServer {
  baseUrl: string;
  close: () => Promise<void>;
}

/** 启动一个处理 /chat/completions 请求的 mock 服务。 */
function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<MockServer> {
  const server = http.createServer((req, res) => {
    if (req.url?.endsWith('/chat/completions')) {
      handler(req, res);
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function sseChunkStream(chunks: string[], base: string): string {
  return chunks
    .map(
      (content, i) =>
        `data: ${JSON.stringify({
          id: 'chatcmpl-mock',
          object: 'chat.completion.chunk',
          created: 1,
          model: 'qwen-plus',
          choices: [
            { index: 0, delta: { content }, finish_reason: null },
          ],
        })}\n\n`,
    )
    .join('')
    .concat(
      `data: ${JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'qwen-plus',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      })}\n\n`,
    )
    .concat('data: [DONE]\n\n');
}

const settings: AppSettings = {
  baseUrl: '',
  apiKey: 'test-key',
  model: 'qwen-plus',
  temperature: 0.3,
};

async function run(): Promise<void> {
  // 场景 1：流式增量顺序与完整文本。
  const streamServer = await startServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(sseChunkStream(['你', '好', '世', '界'], 'qwen-plus'));
    res.end();
  });
  const deltas: string[] = [];
  const params = {
    settings: { ...settings, baseUrl: streamServer.baseUrl },
    markdown: '# Hello\n\nWorld text',
    title: 'Hello',
    author: 'Jane',
    url: 'https://example.com',
  };
  for await (const delta of translateStream(params)) {
    deltas.push(delta);
  }
  assert.deepStrictEqual(deltas, ['你', '好', '世', '界'], '增量应保持顺序');
  assert.strictEqual(deltas.join(''), '你好世界', '拼接后的完整译文应正确');
  await streamServer.close();
  console.log('[PASS] 场景1 流式增量顺序与完整文本正确');

  // 场景 2：模型返回为空 → EMPTY_RESPONSE。
  const emptyServer = await startServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });
    res.write('data: [DONE]\n\n');
    res.end();
  });
  let emptyCode = '';
  try {
    for await (const _ of translateStream({
      settings: { ...settings, baseUrl: emptyServer.baseUrl },
      markdown: '',
      title: '',
      author: '',
      url: '',
    })) {
      // 不应有任何增量。
    }
  } catch (error) {
    emptyCode = (error as TranslateError).code;
  }
  assert.strictEqual(emptyCode, 'EMPTY_RESPONSE', '空响应应映射为 EMPTY_RESPONSE');
  await emptyServer.close();
  console.log('[PASS] 场景2 空响应映射为 EMPTY_RESPONSE');

  // 场景 3：401 → AUTH_FAILED。
  const authServer = await startServer((_req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'invalid_api_key', type: 'invalid_request_error' } }));
  });
  let authCode = '';
  try {
    for await (const _ of translateStream({
      settings: { ...settings, baseUrl: authServer.baseUrl },
      markdown: '# x',
      title: 'x',
      author: '',
      url: 'https://example.com',
    })) {
      // 不应有增量。
    }
  } catch (error) {
    authCode = (error as TranslateError).code;
  }
  assert.strictEqual(authCode, 'AUTH_FAILED', '401 应映射为 AUTH_FAILED');
  await authServer.close();
  console.log('[PASS] 场景3 401 映射为 AUTH_FAILED');

  console.log('\nT4 翻译链路独立验证全部通过。');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
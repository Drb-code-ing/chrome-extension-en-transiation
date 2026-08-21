/**
 * T4 翻译链路 + T9 提示词/截断验证脚本（tsx 直接运行，无需真实网络）。
 * 用本地 http mock 一个 OpenAI 兼容 SSE 接口，验证：
 * 1) 流式增量顺序与最终完整文本；
 * 2) 无内容时 EMPTY_RESPONSE；
 * 3) 401 时映射为 AUTH_FAILED；
 * 4) 超长 Markdown 按段落边界截断（truncateMarkdown）；
 * 5) 请求体提示词组装：System 提示 + 标题/作者/原文链接 + 截断正文。
 * 运行：npm run test:translate
 */
import assert from 'node:assert';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  translateStream,
  truncateMarkdown,
} from '../src/background/services/translate-client';
import { TRANSLATE_SYSTEM_PROMPT } from '../src/shared/constants';
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
  theme: 'minimal',
  followSystemTheme: true,
  viewMode: 'mobile',
};

/** 读取请求体原始文本。 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
    });
    req.on('end', () => resolve(data));
  });
}

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

  // 场景 4：超长 Markdown 按段落边界截断（T9）。
  const short = '# Hello\n\nWorld text';
  assert.strictEqual(truncateMarkdown(short), short, '未超限时应原样保留');
  console.log('[PASS] 场景4.1 未超长不截断');

  // 构造一个超过长度上限、且尾部带唯一标记的长文本。
  const bigBlock = '第一段正文内容。'.repeat(120); // 单段落且长度 > 300
  const longText = `${bigBlock}\n\n尾部独特标记TAIL_MARK`;
  const truncated = truncateMarkdown(longText, 300);
  assert.ok(!truncated.includes('TAIL_MARK'), '超出边界的尾部内容应被截断');
  assert.ok(truncated.endsWith('> [文章过长，后续内容已截断]'), '末尾应附带截断提示');
  assert.ok(truncated.length <= 300 + '> [文章过长，后续内容已截断]'.length + 2, '截断后长度不应明显超过上限');
  console.log('[PASS] 场景4.2 超长按段落边界截断并附带提示');

  // 场景 5：请求体提示词组装（T9，mock 捕获实际请求 JSON）。
  const captureServer = await startServer(async (req, res) => {
    const body = await readBody(req);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body.trim());
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    const messages = ((parsed.messages ?? []) as Array<{ role: string; content: string }>);
    assert.strictEqual(messages[0]?.role, 'system', '首条应为 system 提示');
    assert.strictEqual(messages[0]?.content, TRANSLATE_SYSTEM_PROMPT, 'system 提示应完整一致');
    const user = messages[1]?.content ?? '';
    assert.ok(user.includes('# Mock 标题'), '用户消息应包含标题');
    assert.ok(user.includes('作者：示例作者'), '用户消息应包含作者');
    assert.ok(user.includes('https://example.com/article'), '用户消息应包含原文链接');
    assert.ok(user.includes('正文首段'), '用户消息应包含正文');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.end('data: [DONE]\n\n');
  });
  for await (const _ of translateStream({
    settings: { ...settings, baseUrl: captureServer.baseUrl },
    markdown: '正文首段\n\n正文第二段',
    title: 'Mock 标题',
    author: '示例作者',
    url: 'https://example.com/article',
  })) {
    // 仅消费，无校验。
  }
  await captureServer.close();
  console.log('[PASS] 场景5 请求体提示词组装正确（system + 标题/作者/链接/正文）');

  console.log('\nT4+T9 翻译链路与提示词/截断验证全部通过。');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
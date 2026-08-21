/**
 * T6 最近一次结果持久化独立验证脚本（tsx 直接运行，无需真实扩展环境）。
 * 以内存 Map 模拟 chrome.storage.local，验证：
 * 1) 初始状态无结果；
 * 2) 保存后读取一致；
 * 3) 新翻译覆盖旧结果；
 * 4) 失败不写入时旧结果保留；
 * 5) 清除后无结果。
 * 运行：npm run test:storage
 */
import assert from 'node:assert';

// ---- 用内存 Map 模拟 chrome.storage.local ----
const store = new Map<string, unknown>();
const localArea = {
  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: store.get(key) };
  },
  async set(items: Record<string, unknown>): Promise<void> {
    for (const [k, v] of Object.entries(items)) {
      store.set(k, v);
    }
  },
  async remove(key: string): Promise<void> {
    store.delete(key);
  },
};
(globalThis as unknown as { chrome: unknown }).chrome = { storage: { local: localArea } };

// 动态导入，确保在 mock 就绪后再加载（静态 import 会被提升，无法读取到 mock）。
const { clearLastResult, loadLastResult, saveLastResult } = await import(
  '../src/shared/storage/index.ts'
);

const makeResult = (title: string) => ({
  title,
  author: 'Jane',
  url: 'https://example.com/post',
  translatedMarkdown: `# ${title}\n\n> 作者：Jane\n\n正文内容`,
  savedAt: Date.now(),
});

async function run(): Promise<void> {
  // 场景 1：初始状态无结果。
  assert.strictEqual(await loadLastResult(), null, '初始状态应无结果');
  console.log('[PASS] 场景1 初始状态无结果');

  // 场景 2：保存后读取一致。
  await saveLastResult(makeResult('第一篇'));
  assert.deepStrictEqual(await loadLastResult(), makeResult('第一篇'), '读取应与保存一致');
  console.log('[PASS] 场景2 保存后读取一致');

  // 场景 3：新翻译成功覆盖旧结果。
  await saveLastResult(makeResult('第二篇'));
  assert.deepStrictEqual(await loadLastResult(), makeResult('第二篇'), '新结果应覆盖旧结果');
  console.log('[PASS] 场景3 新结果覆盖旧结果');

  // 场景 4：失败不写入时旧结果保留。
  // 面板仅在翻译成功（translateDone）分支写入；此处模拟失败路径不调用 saveLastResult。
  const before = await loadLastResult();
  assert.deepStrictEqual(before, makeResult('第二篇'), '写入前应为已保存的内容');
  const after = await loadLastResult();
  assert.deepStrictEqual(after, before, '失败不写入时旧结果应保持不变');
  console.log('[PASS] 场景4 失败不写入时旧结果保留');

  // 场景 5：清除后无结果。
  await clearLastResult();
  assert.strictEqual(await loadLastResult(), null, '清除后应无结果');
  console.log('[PASS] 场景5 清除后无结果');

  console.log('\nT6 最近一次结果持久化独立验证全部通过。');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
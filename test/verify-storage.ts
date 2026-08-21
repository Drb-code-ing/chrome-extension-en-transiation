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

// 记录实际写入调用，用于回归验证"失败路径绝不调用 saveLastResult"。
let writeCount = 0;
const wrappedSaveLastResult = async (value: Parameters<typeof saveLastResult>[0]): Promise<void> => {
  writeCount += 1;
  return saveLastResult(value);
};

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

  // 场景 2：保存后读取一致（复用同一对象，避免 savedAt 毫秒抖动）。
  const first = makeResult('第一篇');
  await saveLastResult(first);
  assert.deepStrictEqual(await loadLastResult(), first, '读取应与保存一致');
  console.log('[PASS] 场景2 保存后读取一致');

  // 场景 3：新翻译成功覆盖旧结果。
  const second = makeResult('第二篇');
  await saveLastResult(second);
  assert.deepStrictEqual(await loadLastResult(), second, '新结果应覆盖旧结果');
  console.log('[PASS] 场景3 新结果覆盖旧结果');

  // 场景 4：失败不写入时旧结果保留（T9 回归，带写入计数）。
  // 面板仅在翻译成功（translateDone）分支写入；失败（translateError）分支绝不调用 saveLastResult。
  writeCount = 0;
  const before = await loadLastResult();
  assert.deepStrictEqual(before, second, '写入前应为已保存的内容');
  assert.strictEqual(writeCount, 0, '失败路径不应触发任何 saveLastResult');
  const after = await loadLastResult();
  assert.deepStrictEqual(after, before, '失败不写入时旧结果应保持不变');
  console.log('[PASS] 场景4 失败路径不写入，旧结果与写入计数保持一致');

  // 场景 4b：成功路径写入才覆盖旧结果。
  const third = makeResult('第三篇');
  await wrappedSaveLastResult(third);
  assert.strictEqual(writeCount, 1, '成功路径应恰好写入一次');
  assert.deepStrictEqual(await loadLastResult(), third, '成功后旧结果应被覆盖');
  console.log('[PASS] 场景4b 成功路径写入并覆盖旧结果');

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
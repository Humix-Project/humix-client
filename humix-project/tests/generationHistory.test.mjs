import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/generationHistory.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { generationRequest, validateModification, revertMessage } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('confirmation lists every later version and never offers to revert the current version', () => {
  const versions = [40, 42, 45, 48].map((id, i) => ({ generation_id: id, version_no: i + 1 }));
  assert.equal(revertMessage(versions, 42), '버전 3, 4가 사라집니다. 계속하시겠어요?');
  assert.equal(revertMessage(versions, 48), null);
  assert.equal(revertMessage(versions, 999), null);
});

test('modification validates whole-song, fractional duration, minimum range and optional prompt', () => {
  assert.equal(validateModification(0, 30, 30, ''), null);
  assert.equal(validateModification(10, 15, 30.1, 'a'.repeat(500)), null);
  for (const [start, end] of [[-1, 10], [0, 4], [20, 10], [1.5, 10], [0, 31], [NaN, 10]]) {
    assert.ok(validateModification(start, end, 30.1, ''));
  }
  assert.ok(validateModification(0, 5, 30, 'a'.repeat(501)));
});

test('authenticated API supports root history, target version revert and HTTP 202 modifications', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ isSuccess: true, result: { task_id: 'task-1' } }), { status: 202 });
  });
  await generationRequest('/40/versions', 'test-token');
  await generationRequest('/42/revert', 'test-token', { method: 'POST' });
  const result = await generationRequest('/42/modifications', 'test-token', { method: 'POST', body: JSON.stringify({ start_time_sec: 10, end_time_sec: 20 }) });
  assert.equal(result.task_id, 'task-1');
  assert.deepEqual(calls.map((c) => c.url), ['/api/v1/generation/songs/40/versions', '/api/v1/generation/songs/42/revert', '/api/v1/generation/songs/42/modifications']);
  assert.equal(calls[2].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(calls[2].options.body), { start_time_sec: 10, end_time_sec: 20 });
});

test('conflict, missing version and business errors reject instead of reporting success', async (t) => {
  for (const status of [409, 404, 400, 200]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ isSuccess: false, message: '오류', result: null }), { status }));
    await assert.rejects(generationRequest('/42/revert', 'test-token', { method: 'POST' }));
    mock.mock.restore();
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/utils/downloadAudio.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
);
const { downloadAudio } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function mockBrowser(t) {
  const state = { clicked: false, appended: false, removed: false, revoked: null };
  const anchor = { click() { state.clicked = true; }, remove() { state.removed = true; } };
  globalThis.document = { createElement: () => anchor, body: { appendChild() { state.appended = true; } } };
  globalThis.window = { setTimeout(callback) { state.release = callback; } };
  t.after(() => { delete globalThis.document; delete globalThis.window; });
  t.mock.method(URL, "createObjectURL", () => "blob:test-audio");
  t.mock.method(URL, "revokeObjectURL", (url) => { state.revoked = url; });
  return { state, anchor };
}

test("external audio downloads through a local Blob with a version filename and deferred cleanup", async (t) => {
  const { state, anchor } = mockBrowser(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(new Blob(["wave data"], { type: "audio/wav" })));
  await downloadAudio("https://example.test/audio.wav", "humix_v3.wav");
  assert.equal(fetchMock.mock.calls[0].arguments[1].mode, "cors");
  assert.equal(anchor.href, "blob:test-audio");
  assert.equal(anchor.download, "humix_v3.wav");
  assert.ok(state.appended && state.clicked && state.removed);
  assert.equal(state.revoked, null);
  state.release();
  assert.equal(state.revoked, "blob:test-audio");
});

test("network/CORS errors, expired URLs, empty files and error documents never trigger downloads", async (t) => {
  const { state } = mockBrowser(t);
  for (const response of [null, new Response("expired", { status: 403 }), new Response(new Blob([])), new Response("<html>Error</html>", { headers: { "Content-Type": "text/html" } })]) {
    const mock = t.mock.method(globalThis, "fetch", async () => {
      if (!response) throw new TypeError("Failed to fetch");
      return response;
    });
    await assert.rejects(downloadAudio("https://example.test/audio.wav", "humix_v3.wav"));
    assert.equal(state.clicked, false);
    mock.mock.restore();
  }
});

test("closing the popup during preparation prevents a late download", async (t) => {
  const { state } = mockBrowser(t);
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async () => {
    controller.abort();
    return new Response(new Blob(["wave data"], { type: "audio/wav" }));
  });
  await assert.rejects(downloadAudio("https://example.test/audio.wav", "humix_v3.wav", controller.signal), { name: "AbortError" });
  assert.equal(state.clicked, false);
});

// Run with Vite and a Chromium debugging instance already running:
// BROWSER=none npm run dev -- --host 127.0.0.1 --port 5173
// chromium --headless --no-sandbox --remote-debugging-port=9222 --user-data-dir=/tmp/humix-browser-tests
// node --test tests/browser/generation-cancellation.mjs
// All backend requests are mocked; no real songs are generated or deleted.
import assert from "node:assert/strict";
import test from "node:test";

const appUrl = process.env.APP_URL || "http://127.0.0.1:5173";
const cdpUrl = process.env.CDP_URL || "http://127.0.0.1:9222";

async function openPage(t, editing) {
  const target = await (await fetch(`${cdpUrl}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  t.after(async () => { await send("Page.close"); socket.close(); });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.nextStatus = 'CANCELED';
    window.calls = [];
    window.streamAborted = false;
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, options = {}) => {
      const url = String(input);
      if (!url.startsWith('/api/')) return realFetch(input, options);
      calls.push({url, body: options.body});
      const json = (result, status = 200) => new Response(JSON.stringify({isSuccess:true, result}), {status, headers:{'Content-Type':'application/json'}});
      if (url.endsWith('/guest-login')) return json({access_token:'test-token'});
      if (url.endsWith('/versions')) return json({root_generation_id:40, versions: Array.from({length:${editing ? 3 : 1}}, (_,i) => ({generation_id:40+i, version_no:i+1, audio_url:'/test.wav', duration_seconds:30, prompt:i?'기존 프롬프트':null, start_time_sec:null, end_time_sec:null}))});
      if (url.endsWith('/stream')) {
        options.signal.addEventListener('abort', () => {window.streamAborted=true}, {once:true});
        const complete = {status:'COMPLETED',result:{song_id:${editing ? 99 : 40},root_generation_id:40,audio_url:'/test.wav',duration_seconds:30}};
        const first = window.nextStatus === 'COMPLETED'
          ? 'event: complete\\ndata: '+JSON.stringify(complete)+'\\n\\n'
          : 'event: progress\\ndata: '+JSON.stringify({task_id:'test-task',status:window.nextStatus,progress:50})+'\\n\\n';
        // A late completion in the same packet must not undo a terminal cancellation.
        const late = 'event: complete\\ndata: '+JSON.stringify(complete)+'\\n\\n';
        return new Response('event: connect\\ndata: connected\\n\\n'+first+late, {headers:{'Content-Type':'text/event-stream'}});
      }
      if (url.endsWith('/modifications') || url.endsWith('/generation/songs')) return json({task_id:'test-task'},202);
      throw new Error('Unexpected API request: '+url);
    };
  ` });
  await send("Page.navigate", { url: `${appUrl}/generation${editing ? "?root_generation_id=40" : ""}` });
  await wait(editing ? "document.body?.innerText.includes('버전 3 생성 완료!')" : "window.calls?.some(c=>c.url.endsWith('/guest-login')) && document.body?.innerText.includes('AI 생성 시작')");
  return { evaluate, wait };
}

await test("initial generation cancellation exits loading, ignores late completion and permits retry", async (t) => {
  const { evaluate, wait } = await openPage(t, false);
  const generate = "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='AI 생성 시작').click()";
  await evaluate(generate);
  await wait("document.body.innerText.includes('곡 생성이 취소되었습니다')");
  assert.ok(await evaluate("window.streamAborted"));
  assert.equal(await evaluate("document.querySelector('[role=alert]')"), null);
  assert.ok(!await evaluate("document.body.innerText.includes('생성 완료!')"));
  await evaluate("window.nextStatus='COMPLETED';" + generate);
  await wait("document.body.innerText.includes('버전 1 (원본) 생성 완료!')");
  assert.equal(await evaluate("calls.filter(c=>c.url.endsWith('/generation/songs')).length"), 2);
  assert.ok(!await evaluate("document.body.innerText.includes('곡 생성이 취소되었습니다')"));
});

await test("modification cancellation preserves current history and prompt; failures remain errors", async (t) => {
  const { evaluate, wait } = await openPage(t, true);
  await evaluate(`(() => {
    const textarea = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(textarea,'드럼을 더 강하게');
    textarea.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  const submit = "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='전송').click()";
  await evaluate(submit);
  await wait("document.body.innerText.includes('곡 수정이 취소되었습니다. 기존 버전은 유지됩니다.')");
  assert.ok(await evaluate("window.streamAborted"));
  assert.equal(await evaluate("document.querySelector('[role=alert]')"), null);
  assert.equal(await evaluate("document.querySelector('textarea').value"), "드럼을 더 강하게");
  assert.ok(await evaluate("document.body.innerText.includes('버전 3 생성 완료!')"));
  assert.ok(!await evaluate("document.body.innerText.includes('버전 4')"));
  assert.ok(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='전송').disabled === false"));
  await evaluate("window.nextStatus='FAILED';" + submit);
  await wait("document.querySelector('[role=alert]')?.textContent.includes('곡 수정에 실패했습니다')");
  assert.ok(!await evaluate("document.body.innerText.includes('곡 수정이 취소되었습니다')"));
  await evaluate("window.nextStatus='COMPLETED';" + submit);
  await wait("document.body.innerText.includes('버전 4 생성 완료!')");
  const requests = await evaluate("calls.filter(c=>c.url.endsWith('/modifications'))");
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => request.url.endsWith('/42/modifications')));
  assert.equal(JSON.parse(requests[2].body).prompt, "드럼을 더 강하게");
});

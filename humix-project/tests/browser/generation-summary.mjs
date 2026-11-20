// Requires a running Vite app and Chromium debugging port, as in generation-cancellation.mjs.
// Uses mocked APIs and recording metadata; no real music is generated or uploaded.
import assert from "node:assert/strict";
import test from "node:test";
const appUrl = process.env.APP_URL || "http://127.0.0.1:5173";
const cdpUrl = process.env.CDP_URL || "http://127.0.0.1:9222";
async function openPage(t) {
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
      if (await evaluate(`(async () => Boolean(await (${expression})))()` )) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out: ${expression}`);
  };
  await send("Page.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.apiCalls = [];
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, options = {}) => {
      const url = String(input);
      if (!url.startsWith('/api/')) return realFetch(input, options);
      apiCalls.push({url, method:options.method || 'GET', body:options.body ? JSON.parse(options.body) : null});
      const json = (result, status=200) => new Response(JSON.stringify({isSuccess:true,result}), {status,headers:{'Content-Type':'application/json'}});
      if (url.endsWith('/guest-login')) return json({access_token:'test-token'});
      if (url.endsWith('/vectors')) return json({notes:[60,62,64].map((pitch,i)=>({pitch,start_time_seconds:i,duration_seconds:0.5}))});
      if (url.endsWith('/generation/songs')) return json({task_id:'test-task'},202);
      if (url.endsWith('/stream')) return new Response('event: progress\\ndata: {"task_id":"test-task","status":"CANCELED","progress":0}\\n\\n', {headers:{'Content-Type':'text/event-stream'}});
      throw new Error('Unexpected backend request: '+url);
    };
  ` });
  await send("Page.navigate", {url:appUrl+'/generation'});
  await wait("document.querySelector('[aria-label=\"생성 설정 요약\"]')");
  return {send,evaluate,wait};
}

await test("summary follows saved recording, melody, concept and reference choices; payload agrees", async (t) => {
  const {send,evaluate,wait} = await openPage(t);
  const summary = () => evaluate(`document.querySelector('[aria-label="생성 설정 요약"]').innerText`);
  const navigate = async (path) => {
    await evaluate(`history.pushState({},'',${JSON.stringify(path)}); dispatchEvent(new PopStateEvent('popstate'))`);
    await wait(`location.pathname === ${JSON.stringify(path)}`);
  };
  const click = async (text) => {
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().includes(${JSON.stringify(text)})).click()`);
  };
  const direction = async (text) => {
    await evaluate(`(() => {const input=document.querySelector('#music-direction'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(text)}); input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  };
  let text = await summary();
  assert.ok(text.includes('녹음 정보 없음') && text.includes('편집 정보 없음'));
  assert.ok(!text.includes('8.0s') && !text.includes('6개 노트'));

  // Arrange a recording already uploaded in step 1, then exercise actual step 2 save.
  await evaluate(`(async () => {
    const {useHummingStore}=await import('/src/store/useHummingStore.ts');
    useHummingStore.getState().setHumming({hummingId:14,fileUrl:'/recording.wav',durationSeconds:12.5});
  })()`);
  await navigate('/MelodyEdit');
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('완료 →') && !b.disabled) && apiCalls.some(c=>c.method==='POST' && c.url.endsWith('/vectors'))");
  await wait("import('/src/store/useHummingStore.ts').then(({useHummingStore})=>useHummingStore.getState().melodyVectors?.length===3)");
  await click('완료 →');
  await wait("location.pathname==='/concept'");
  const saved = await evaluate("apiCalls.find(c=>c.method==='PUT' && c.url.endsWith('/vectors')).body");
  assert.equal(saved.notes.length,3);

  await click('Jazz'); await click('잔잔한'); await direction('  잔잔한 재즈 피아노  ');
  await click('다음 (곡 생성)'); await wait("location.pathname==='/reference'");
  await click('건너뛰기'); await wait("location.pathname==='/generation'");
  text=await summary();
  for (const expected of ['완료 (12.5s)','3개 노트','Jazz','잔잔한','잔잔한 재즈 피아노','선택 없음']) assert.ok(text.includes(expected),expected);
  assert.ok(!text.includes('K-POP') && !text.includes('밝고 신나는'));
  await click('AI 생성 시작'); await wait("document.body.innerText.includes('곡 생성이 취소되었습니다')");
  let payload=await evaluate("apiCalls.filter(c=>c.url.endsWith('/generation/songs')).at(-1).body");
  assert.deepEqual(payload,{humming_id:14,title:'my_song',genre:'jazz',mood:'calm',prompt:'잔잔한 재즈 피아노',reference_track_id:null});

  // Revisiting the selection screen must replace the prior choices, not keep Jazz.
  await navigate('/concept'); await click('Classical'); await click('역동적인'); await direction('오케스트라');
  await click('다음 (곡 생성)'); await wait("location.pathname==='/reference'");
  await evaluate(`(() => {const input=document.querySelector('input[type=file]');const transfer=new DataTransfer();transfer.items.add(new File(['test'],'reference.wav',{type:'audio/wav'})); input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('다음: AI 생성') && !b.disabled)");
  await click('다음: AI 생성'); await wait("location.pathname==='/generation'");
  text=await summary();
  for (const expected of ['Classical','역동적인','오케스트라','reference.wav (미적용)']) assert.ok(text.includes(expected),expected);
  await click('AI 생성 시작'); await wait("document.body.innerText.includes('곡 생성이 취소되었습니다')");
  payload=await evaluate("apiCalls.filter(c=>c.url.endsWith('/generation/songs')).at(-1).body");
  assert.equal(payload.genre,'classical');assert.equal(payload.mood,'dynamic');assert.equal(payload.prompt,'오케스트라');assert.equal(payload.reference_track_id,null);
  assert.equal(await evaluate("apiCalls.some(c=>c.url.includes('/upload/'))"),false);
  await navigate('/reference');await click('건너뛰기');await wait("location.pathname==='/generation'");
  assert.ok((await summary()).includes('선택 없음'));
  assert.ok(!(await summary()).includes('reference.wav'));

  // A different recording cannot retain a previous recording's note count.
  await evaluate(`(async () => {const {useHummingStore}=await import('/src/store/useHummingStore.ts');useHummingStore.getState().setHumming({hummingId:15,fileUrl:'/new.wav',durationSeconds:7.2});})()`);
  await wait("document.querySelector('[aria-label=\"생성 설정 요약\"]').textContent.includes('7.2s')");
  assert.ok((await summary()).includes('편집 정보 없음'));
  assert.ok(!(await summary()).includes('3개 노트'));
  await evaluate(`(async () => {const {useHummingStore}=await import('/src/store/useHummingStore.ts');useHummingStore.getState().setMelodyVectors([]);})()`);
  assert.ok((await summary()).includes('0개 노트'));
});

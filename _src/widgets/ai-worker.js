// SHIFT AI 무료 도구 공용 — AI 모델을 브라우저 안에서 돌리는 작업용 워커(모듈 워커, 화면이 멈추지 않게).
// 라이브러리: /lib/transformers/(transformers.js 4.3.2, Apache-2.0 · onnxruntime-web 1.31 dev, MIT).
// 모델 파일은 Hugging Face 에서 받아 브라우저 캐시에 둔다(두 번째부터는 받지 않음). 계산용 .wasm 은 jsDelivr 의 같은 판에서 받는다.
// 사진·영상·녹음은 이 워커 밖(인터넷)으로 보내지 않는다. 오가는 것은 모델 파일뿐.
const ORT = "1.31.0-dev.20260914-8d85527a0";
let T = null, gpu = null;
const pipes = new Map();
async function lib(){
  if(T) return T;
  T = await import("/lib/transformers/transformers.min.js");
  const {env} = T, ua = self.navigator.userAgent || "";
  env.allowLocalModels = false; env.useBrowserCache = true; env.useWasmCache = false;
  const sv = ua.match(/Version\/(\d+)[.\d]* (Mobile\/\S+ )?Safari/), oldSafari = sv && !/Chrome|Chromium|Edg|CriOS|FxiOS|Android/.test(ua) && +sv[1] < 26;
  const suf = oldSafari && !(self.navigator.gpu) ? "" : ".asyncify";
  const v = (env.backends.onnx.versions && env.backends.onnx.versions.web) || ORT;   // 함께 묶인 onnxruntime-web 과 같은 판이어야 한다
  env.backends.onnx.wasm.wasmPaths = {mjs:`/lib/transformers/ort-wasm-simd-threaded${suf}.mjs`, wasm:`https://cdn.jsdelivr.net/npm/onnxruntime-web@${v}/dist/ort-wasm-simd-threaded${suf}.wasm`};
  env.backends.onnx.wasm.numThreads = 1;   // GitHub Pages 는 교차 출처 격리 머리를 못 보내서 여러 스레드를 쓸 수 없다
  return T;
}
// 그래픽 카드(WebGPU): 진짜 그래픽 카드이고 16비트 계산(shader-f16)을 할 수 있을 때만 쓴다(소프트웨어로 흉내 내는 어댑터는 CPU보다 느림).
//  test: 검수용(소프트웨어 어댑터도 32비트로 써 본다).
async function webgpu(test){
  if(gpu!==null) return gpu;
  try{
    const a = self.navigator.gpu && await self.navigator.gpu.requestAdapter({powerPreference:"high-performance"});
    const info = (a && a.info) || {}, soft = a && (a.isFallbackAdapter || info.isFallbackAdapter || /swiftshader|llvmpipe|software/i.test((info.architecture||"")+" "+(info.description||"")));
    const f16 = !!(a && a.features.has("shader-f16"));
    gpu = a && ((!soft && f16) || test) ? {f16} : false;
  }catch(_){ gpu = false; }
  return gpu;
}
const post = (id, m, tr)=>self.postMessage({id, ...m}, tr||[]);
async function getPipe(id, task, model, opts){   // 같은 모델·설정이면 한 번 만든 것을 다시 쓴다
  const key = task+"|"+model+"|"+JSON.stringify(opts);
  if(pipes.has(key)) return pipes.get(key);
  const L = await lib(), files = new Map();
  const p = L.pipeline(task, model, {...opts, progress_callback: x=>{
    if(x.status==="progress" && x.total){ files.set(x.file, [x.loaded, x.total]); let a = 0, b = 0; files.forEach(([l,t])=>{ a += l; b += t; }); post(id, {type:"load", loaded:a, total:b}); }
    if(x.status==="ready") post(id, {type:"ready"}); }});
  pipes.set(key, p);
  try{ return await p; }catch(e){ pipes.delete(key); throw e; }
}
// run(g): g 가 있으면 그래픽 카드, false 면 CPU. 그래픽 카드로 하다 오류가 나면 'GPU_FAIL' 로 알린다 →
//  화면 쪽이 이 워커를 닫고 새 워커에서 CPU 로만(cpuOnly) 다시 한다(같은 워커에서 다시 하면 그래픽 카드 쪽 상태가 남아 또 실패함).
async function onDevice(id, run, {test, cpuOnly}){
  const g = cpuOnly ? false : await webgpu(test);
  if(!g) return run(false);
  try{ return await run(g); }
  catch(e){ const m = String(e && e.message || e); if(/Failed to fetch|NetworkError|network error|404/i.test(m)) throw e; console.warn("WebGPU 실패 → CPU", m); throw new Error("GPU_FAIL " + m); }
}
const jobs = {
  // 받아쓰기: 조각(30초 안쪽)마다 문장 단위 시각과 글자
  async asr(id, a){ const {model, audio, language, max} = a;
    return onDevice(id, async g=>{
      const opts = g ? {device:"webgpu", dtype:{encoder_model: g.f16 ? "fp16" : "fp32", decoder_model_merged:"q4"}} : {device:"wasm", dtype:{encoder_model:"q8", decoder_model_merged:"q8"}};
      const p = await getPipe(id, "automatic-speech-recognition", model, opts);
      post(id, {type:"device", device: g ? "webgpu" : "wasm"});
      const r = await p(audio, {language, task:"transcribe", return_timestamps:true, chunk_length_s:0, max_new_tokens: max || 440});
      return {text:r.text, chunks:(r.chunks||[]).map(c=>({t:c.timestamp, text:c.text}))};
    }, a);
  },
  // 배경 지우기: 알파(0~255) 한 장. cpu: CPU 용 {model, dtype} · gpuModel: 그래픽 카드용
  async matte(id, a){ const {model, w, h, rgba, cpu, gpuModel} = a;
    const L = await lib();
    return onDevice(id, async g=>{
      const m = g ? (gpuModel || model) : ((cpu && cpu.model) || model);
      const opts = g ? {device:"webgpu", dtype: g.f16 ? "fp16" : "fp32"} : {device:"wasm", dtype:(cpu && cpu.dtype) || "q8"};   // 16비트를 못 하는 그래픽 카드는 검수(test) 때만 32비트로
      const p = await getPipe(id, "background-removal", m, opts);
      post(id, {type:"device", device: g ? "webgpu" : "wasm"});
      const out = await p(new L.RawImage(new Uint8ClampedArray(rgba), w, h, 4));
      const o = Array.isArray(out) ? out[0] : out;    // RawImage(RGBA, 알파에 결과)
      const al = new Uint8ClampedArray(o.width*o.height);
      for(let i=0;i<al.length;i++) al[i] = o.data[i*o.channels + o.channels-1];
      return {w:o.width, h:o.height, alpha:al};
    }, a);
  },
  // 화질 올리기: 조각 하나를 키운다(RGB)
  async upscale(id, a){ const {model, w, h, rgba} = a;
    const L = await lib();
    return onDevice(id, async g=>{
      const p = await getPipe(id, "image-to-image", model, g ? {device:"webgpu", dtype:"fp32"} : {device:"wasm", dtype:"q8"});
      post(id, {type:"device", device: g ? "webgpu" : "wasm"});
      const o = await p(new L.RawImage(new Uint8ClampedArray(rgba), w, h, 4).rgb()), r = Array.isArray(o) ? o[0] : o;
      return {w:r.width, h:r.height, rgb: r.channels===3 ? r.data : r.rgb().data};
    }, a);
  }
};
self.onmessage = async e=>{
  const {id, op, args} = e.data || {};
  if(!jobs[op]) return;
  try{ const r = await jobs[op](id, args); const tr = []; for(const k of ["alpha","rgb"]) if(r[k] && r[k].buffer) tr.push(r[k].buffer); post(id, {type:"done", result:r}, tr); }
  catch(err){ post(id, {type:"error", message: String(err && err.message || err)}); }
};

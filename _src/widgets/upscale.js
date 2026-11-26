// SHIFT AI 무료 도구 — 사진 화질 올리기(2배·4배 키우기, AI 업스케일).
// Swin2SR(Apache-2.0, caidas 공개 모델을 Xenova 가 ONNX 로 옮긴 것)를 /assets/ai-worker.js 안에서 돌린다. 모델 파일만 Hugging Face 에서 받고, 사진은 밖으로 보내지 않는다.
//  2배: Xenova/swin2SR-lightweight-x2-64(가벼움) · 4배: Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr(휴대폰·웹에서 받은 사진의 흐림·압축 자국을 함께 다룸)
// 사진을 겹치는 조각으로 나눠 차례로 키우고, 겹친 곳은 서서히 섞어 이음매가 보이지 않게 붙인다.
// AI 가 없는 무늬·글자를 그럴듯하게 그려 넣을 수 있으므로 상품·문서 사진에는 쓰지 말라는 안내를 늘 보여 준다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("upDrop")) return;
const HEIC = "/lib/heic-to/heic-to.js", TEST = location.hash.startsWith("#bot-gpu");
const MOBILE = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const M = {
  2:{id:"Xenova/swin2SR-lightweight-x2-64", mb:7, gmb:8, s:2, cpu:2.6e-4, lim:{cpu:1200, gpu:2048, mob:600}},
  4:{id:"Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr", mb:21, gmb:53, s:4, cpu:1.2e-3, lim:{cpu:480, gpu:1024, mob:256}}
};   // cpu: 입력 1픽셀당 초(작업용 워커 하나, 그래픽 카드 없이 시험한 값, 대략)
// CPU 로 할 때는 작업용 워커를 여러 개 띄워 조각을 나눠 맡긴다(GitHub Pages 는 한 워커 안에서 여러 스레드를 못 쓰므로). 휴대폰·그래픽 카드는 하나.
const NW = MOBILE ? 1 : Math.min(4, Math.max(1, +((location.hash.match(/[&#]w=(\d)/)||[])[1]) || (navigator.hardwareConcurrency||2) >> 1));
const OV = 16;   // 조각끼리 겹치는 폭(입력 픽셀)
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2400); };
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("load")); document.head.appendChild(s); });
const isHeic = f=>/heic|heif/i.test(f.type||"") || /\.hei[cf]$/i.test(f.name||"");
const mb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const val = n=>document.querySelector(`input[name=${n}]:checked`).value;
const dur = s=>s < 60 ? Math.max(1, Math.round(s))+"초" : s < 3600 ? Math.round(s/60)+"분" : (s/3600).toFixed(1)+"시간";
let src = null, out = null, busy = false, stop = false, wid = 0, GPU = null, CPU_ONLY = false;
(async()=>{ try{ const a = navigator.gpu && await navigator.gpu.requestAdapter({powerPreference:"high-performance"}), info = (a && a.info) || {};
  const soft = a && (a.isFallbackAdapter || info.isFallbackAdapter || /swiftshader|llvmpipe|software/i.test((info.architecture||"")+" "+(info.description||"")));
  GPU = !!(a && ((!soft && a.features.has("shader-f16")) || TEST)); }catch(_){ GPU = false; } draw(); })();

const pool = [];   // {w, busy}
function getW(i){ if(!pool[i]){ const me = document.querySelector("script[data-worker]"); pool[i] = new Worker((me && me.dataset.worker) || "/assets/ai-worker.js", {type:"module"}); } return pool[i]; }
function ask(wi, op, args, onMsg, transfer){
  const worker = getW(wi), id = ++wid;
  return new Promise((ok, no)=>{
    const h = e=>{ const m = e.data; if(m.id!==id) return; if(m.type==="done"){ worker.removeEventListener("message", h); ok(m.result); } else if(m.type==="error"){ worker.removeEventListener("message", h); no(new Error(m.message)); } else onMsg && onMsg(m); };
    worker.addEventListener("message", h);
    worker.onerror = e=>no(new Error("작업용 워커를 열지 못했습니다: "+(e.message||"")));
    worker.postMessage({id, op, args}, transfer||[]); });
}
async function call(wi, op, mk, onMsg){   // 그래픽 카드로 하다 실패하면 워커를 모두 닫고 새 워커에서 CPU 로만 다시 한다
  for(let k=0;;k++){ const [args, tr] = mk(); args.cpuOnly = CPU_ONLY;
    try{ return await ask(wi, op, args, onMsg, tr); }
    catch(e){ if(!/^GPU_FAIL/.test(e.message) || k) throw e; CPU_ONLY = true; GPU = false; pool.forEach(w=>w && w.terminate()); pool.length = 0; onMsg && onMsg({type:"device", device:"wasm", fallback:true}); } }
}
const limit = m=>MOBILE ? m.lim.mob : GPU ? m.lim.gpu : m.lim.cpu;

// ---------- 넣기 ----------
async function load(f){
  if(busy || !f) return;
  if(!/^image\//.test(f.type) && !isHeic(f)){ toast("사진 파일만 넣을 수 있습니다"); return; }
  try{
    if(isHeic(f)){ await script(HEIC, ()=>typeof window.HeicTo==="function"); f = new File([await window.HeicTo({blob:f, type:"image/jpeg", quality:0.95})], f.name.replace(/\.hei[cf]$/i,"")+".jpg", {type:"image/jpeg"}); }
    const bmp = await createImageBitmap(f), c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext("2d"); x.drawImage(bmp, 0, 0);
    src = {name:f.name || "붙여 넣은 사진.png", type:f.type, w:bmp.width, h:bmp.height, bmp, rgba:x.getImageData(0,0,bmp.width,bmp.height).data};
    out = null; $("upSplit").value = 50; say("");
  }catch(e){ console.warn(e); toast("열 수 없는 사진입니다"); return; }
  $("upWork").hidden = false; draw(); paint();
}
// ---------- 키우기 ----------
function tiles(W, H, T){   // 겹치게, 고르게 나눈 조각 [x, y, w, h]
  const cut = n=>{ if(n <= T) return [[0, n]]; const k = Math.ceil((n - OV*2)/(T - OV*2)), w = Math.ceil((n + (k-1)*OV*2)/k), r = [];
    for(let i=0;i<k;i++){ const p = Math.min(n - w, Math.round(i*(n - w)/(k-1))); r.push([p, w]); } return r; };
  const r = []; for(const [y, h] of cut(H)) for(const [x, w] of cut(W)) r.push([x, y, w, h]);
  return r;
}
async function run(){
  if(busy || !src) return;
  const m = M[val("upScale")], s = m.s, W = src.w, H = src.h, lim = limit(m);
  if(Math.max(W, H) > lim){ say(`이 배율로는 긴 쪽이 ${lim}픽셀 이하인 사진만 키울 수 있습니다(지금 ${Math.max(W,H)}픽셀). 이미 충분히 큰 사진이거나, 필요한 부분만 잘라서 넣으세요.`); return; }
  busy = true; stop = false; out = null; draw(); paint();
  const T = GPU ? 384 : 256, list = tiles(W, H, T), OW = W*s, OH = H*s, nw = GPU ? 1 : Math.min(NW, list.length);
  const acc = new Float32Array(OW*OH*3), wt = new Float32Array(OW*OH);
  const t0 = performance.now(); let dev = "", next = 0, done = 0, first = 0;
  const put = ([x0, y0, tw, th], r)=>{   // 겹친 곳은 가장자리로 갈수록 덜 믿고(무게를 낮춰) 섞는다. 사진 테두리 쪽은 그대로.
    const ow = tw*s, oh = th*s, f = OV*s, RW = r.w, rgb = r.rgb;
    for(let y=0;y<oh;y++){
      const wy = Math.min(y0 > 0 ? Math.min(1, (y+0.5)/f) : 1, y0+th < H ? Math.min(1, (oh-y-0.5)/f) : 1);
      for(let x=0;x<ow;x++){
        const w = wy * Math.min(x0 > 0 ? Math.min(1, (x+0.5)/f) : 1, x0+tw < W ? Math.min(1, (ow-x-0.5)/f) : 1);
        if(!w) continue;
        const o = (y0*s + y)*OW + x0*s + x, i = (y*RW + x)*3;
        acc[o*3] += rgb[i]*w; acc[o*3+1] += rgb[i+1]*w; acc[o*3+2] += rgb[i+2]*w; wt[o] += w;
      }
    }
  };
  const lane = async wi=>{
    while(next < list.length){
      if(stop) throw new Error("stop");
      const t = list[next++], [x0, y0, tw, th] = t;
      const r = await call(wi, "upscale", ()=>{ const rgba = new Uint8ClampedArray(tw*th*4);
        for(let y=0;y<th;y++) rgba.set(src.rgba.subarray(((y0+y)*W + x0)*4, ((y0+y)*W + x0 + tw)*4), y*tw*4);
        return [{model:m.id, w:tw, h:th, rgba:rgba.buffer, test:TEST}, [rgba.buffer]]; }, q=>{
        if(q.type==="load" && wi===0) say(`AI 모델을 받는 중… ${mb(q.loaded)} / ${mb(q.total)} (처음 한 번만)`, q.loaded/q.total);
        if(q.type==="device"){ dev = q.device; if(q.fallback) say("그래픽 카드로 계산하지 못해 CPU로 다시 합니다…"); } });
      put(t, r); done++; if(!first) first = performance.now();
      const el = (performance.now()-first)/1000, left = done > nw ? el/(done-nw+1)*(list.length-done) : 0;   // 처음 조각(모델 준비 포함)은 빼고 잰다
      say(`키우는 중… ${done} / ${list.length} 조각 · ${dev==="webgpu" ? "그래픽 카드" : nw > 1 ? `CPU ${nw}곳에서 함께` : "CPU"} 사용${left ? ` · 남은 시간 약 ${dur(left)}` : ""}`, done/list.length);
    }
  };
  try{
    await Promise.all(Array.from({length:nw}, (_, i)=>lane(i)));
    // 원래 사진의 투명한 곳(PNG)은 그대로 투명하게
    const c = document.createElement("canvas"); c.width = OW; c.height = OH; const cx = c.getContext("2d"), d = cx.createImageData(OW, OH);
    let alpha = null; for(let i=3;i<src.rgba.length;i+=4) if(src.rgba[i] < 255){ alpha = true; break; }
    if(alpha){ const a = new OffscreenCanvas(W, H), ax = a.getContext("2d"); ax.drawImage(src.bmp, 0, 0); const b = new OffscreenCanvas(OW, OH), bx = b.getContext("2d"); bx.imageSmoothingQuality = "high"; bx.drawImage(a, 0, 0, OW, OH); alpha = bx.getImageData(0,0,OW,OH).data; }
    for(let i=0, n=OW*OH;i<n;i++){ const w = wt[i] || 1; d.data[i*4] = acc[i*3]/w; d.data[i*4+1] = acc[i*3+1]/w; d.data[i*4+2] = acc[i*3+2]/w; d.data[i*4+3] = alpha ? alpha[i*4+3] : 255; }
    cx.putImageData(d, 0, 0);
    out = {c, w:OW, h:OH, s, alpha:!!alpha};
    say(`${W}×${H} → ${OW}×${OH}(${s}배)로 키웠습니다. ${dur((performance.now()-t0)/1000)} 걸렸습니다. 왼쪽(원래 사진을 그냥 늘린 것)과 비교해 보세요.`, null);
  }catch(e){ if(e.message!=="stop") console.warn(e);
    say(e.message==="stop" ? "멈췄습니다." : /Failed to fetch|NetworkError|network error|404|ERR_/i.test(e.message) ? "AI 모델을 받지 못했습니다. 인터넷 연결을 확인하고 다시 해 보세요." : /memory|alloc|Aborted/i.test(e.message) ? "메모리가 모자랍니다. 다른 탭을 닫거나 더 작은 사진으로 해 보세요." : "키우지 못했습니다: "+e.message, null); }
  finally{ busy = false; draw(); paint(); }
}

// ---------- 화면 ----------
const say = (m, r)=>{ $("upStatus").textContent = m; $("upBar").hidden = r==null; if(r!=null) $("upBar").firstElementChild.style.width = Math.round(r*100)+"%"; };
function draw(){
  const m = M[val("upScale")];
  $("upGo").disabled = busy || !src; $("upGo").textContent = busy ? "키우는 중…" : out ? "다시 키우기" : `${m.s}배로 키우기`;
  $("upStop").hidden = !busy; $("upSaveRow").hidden = !out || busy; $("upSizeW").hidden = !out || out.s!==4;
  if(out && out.s===4){ $("upSize").options[0].text = `키운 크기 그대로(${out.w}×${out.h})`; $("upSize").options[1].text = `절반으로(${Math.round(out.w/2)}×${Math.round(out.h/2)})`; }
  if(!src){ $("upEst").textContent = ""; return; }
  const lim = limit(m), big = Math.max(src.w, src.h) > lim, t = src.w*src.h*m.cpu*1.15/NW + 8;
  $("upInfo").textContent = `${src.name} · ${src.w}×${src.h} → ${src.w*m.s}×${src.h*m.s}`;
  $("upEst").textContent = big ? `이 배율로는 긴 쪽이 ${lim}픽셀 이하인 사진만 키울 수 있습니다(지금 ${Math.max(src.w,src.h)}픽셀).${m.s===4 ? " 2배를 골라 보세요." : ""}`
    : `처음 한 번 AI 모델 약 ${GPU ? m.gmb : m.mb}MB를 받습니다 · ${GPU ? "그래픽 카드로 계산합니다" : `CPU로 약 ${dur(t)} 걸립니다`}`;
}
let view = {k:1};
function paint(){
  const cv = $("upCanvas"); if(!src){ cv.width = cv.height = 0; return; }
  const zoom = $("upZoom").checked, OW = src.w*M[val("upScale")].s, OH = src.h*M[val("upScale")].s;
  const W = out ? out.w : OW, H = out ? out.h : OH, stage = $("upStage"), dpr = Math.min(2, window.devicePixelRatio||1);
  const fit = Math.min((stage.clientWidth||600)/W, Math.min(window.innerHeight*0.62, 720)/H, 1), k = zoom ? 1/dpr : fit;
  view = {k}; stage.classList.toggle("zoom", zoom);
  cv.style.width = Math.round(W*k)+"px"; cv.style.height = Math.round(H*k)+"px"; cv.width = Math.round(W*k*dpr); cv.height = Math.round(H*k*dpr);
  const x = cv.getContext("2d"), CW = cv.width, CH = cv.height, s = out ? +$("upSplit").value/100 : 1;
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  if(out){ x.drawImage(out.c, 0, 0, CW, CH); }
  if(s > 0){ x.save(); x.beginPath(); x.rect(0, 0, CW*s, CH); x.clip(); x.clearRect(0, 0, CW*s, CH); x.drawImage(src.bmp, 0, 0, CW, CH); x.restore(); }
  if(out && s > 0 && s < 1){ x.fillStyle = "#fff"; x.fillRect(CW*s - dpr, 0, 2*dpr, CH); x.font = `700 ${12*dpr}px Pretendard, sans-serif`; x.textBaseline = "top";
    const lab = (t, X, al)=>{ x.textAlign = al; const w = x.measureText(t).width + 12*dpr; x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(al==="left" ? X : X - w, 8*dpr, w, 20*dpr); x.fillStyle = "#fff"; x.fillText(t, al==="left" ? X + 6*dpr : X - 6*dpr, 12*dpr); };
    lab("그냥 늘림", CW*s - 6*dpr, "right"); lab("AI", CW*s + 6*dpr, "left"); }
}
function fmt(){ const v = $("upFmt").value; return v==="png" || (v==="same" && (/png|webp/.test(src.type) || out.alpha)) ? "image/png" : "image/jpeg"; }
$("upSave").addEventListener("click", ()=>{ if(!out) return; const t = fmt(), half = out.s===4 && $("upSize").value==="2";
  let c = out.c; if(half){ c = document.createElement("canvas"); c.width = Math.round(out.w/2); c.height = Math.round(out.h/2); const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(out.c, 0, 0, c.width, c.height); }
  c.toBlob(b=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = src.name.replace(/\.[^.]+$/,"") + `-${half ? 2 : out.s}배.` + (/png/.test(t) ? "png" : "jpg"); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); toast(`저장했습니다(${mb(b.size)})`); }, t, 0.93); });

// ---------- 이벤트 ----------
$("upGo").addEventListener("click", run);
$("upStop").addEventListener("click", ()=>{ stop = true; say("지금 조각까지 끝내고 멈춥니다…"); });
document.querySelectorAll("input[name=upScale]").forEach(r=>r.addEventListener("change", ()=>{ if(!busy){ out = null; draw(); paint(); } }));
$("upSplit").addEventListener("input", ()=>requestAnimationFrame(paint));
$("upZoom").addEventListener("change", paint);
$("upFile").addEventListener("change", e=>{ load(e.target.files[0]); e.target.value = ""; });
const drop = $("upDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>load(e.dataTransfer.files[0]));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("upFile").click(); } });
document.addEventListener("paste", e=>{ const f = [...(e.clipboardData?.items||[])].find(it=>it.kind==="file"); if(f){ e.preventDefault(); load(f.getAsFile()); } });
window.addEventListener("resize", ()=>requestAnimationFrame(paint));
if(location.hash.startsWith("#bot")) window.__up = {busy:()=>busy, out:()=>out && {w:out.w, h:out.h}, tiles, nw:()=>NW};
draw();
})();

// SHIFT AI 무료 도구 — 사진 배경 지우기(누끼). 투명 PNG 또는 흰색·원하는 색 배경으로 저장.
// 배경과 대상을 나누는 일은 BiRefNet(MIT, 공개 모델)을 /assets/ai-worker.js 안에서 돌려서 한다.
//  모델: studioludens/birefnet-lite-512(16비트, 약 99MB) — CPU 와 그래픽 카드가 같은 파일을 쓴다(그래픽 카드로 하다 실패해 CPU 로 다시 할 때 또 받지 않게).
//   1024 판(onnx-community/BiRefNet_lite-ONNX)은 그래픽 카드 한도(셰이더 하나에 저장 버퍼 10개)를 넘는 경우가 있어 쓰지 않는다(11/26 시험).
//  모델 파일만 Hugging Face 에서 받고, 사진은 밖으로 보내지 않는다.
// 결과는 붓으로 더 지우거나 되살릴 수 있다. 저장할 때 사진 정보(EXIF·위치)는 남지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("bgDrop")) return;
const ZIP = "/lib/jszip/jszip.min.js", HEIC = "/lib/heic-to/heic-to.js", MAX = 20, LIMIT = 4096;
const CPU = {model:"studioludens/birefnet-lite-512", dtype:"fp16", mb:99}, GPUM = {model:"studioludens/birefnet-lite-512", mb:99};
const TEST = location.hash==="#bot-gpu";
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2400); };
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("load")); document.head.appendChild(s); });
const isHeic = f=>/heic|heif/i.test(f.type||"") || /\.hei[cf]$/i.test(f.name||"");
const mb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const val = n=>document.querySelector(`input[name=${n}]:checked`).value;
let photos = [], cur = -1, worker = null, wid = 0, running = false, GPU = null, CPU_ONLY = false;
(async()=>{ try{ const a = navigator.gpu && await navigator.gpu.requestAdapter({powerPreference:"high-performance"}), info = (a && a.info) || {};
  const soft = a && (a.isFallbackAdapter || info.isFallbackAdapter || /swiftshader|llvmpipe|software/i.test((info.architecture||"")+" "+(info.description||"")));
  GPU = !!(a && ((!soft && a.features.has("shader-f16")) || TEST)); }catch(_){ GPU = false; } hint(); })();

// ---------- AI 워커 ----------
function ask(op, args, onMsg, transfer){
  if(!worker){ const me = document.querySelector("script[data-worker]"); worker = new Worker((me && me.dataset.worker) || "/assets/ai-worker.js", {type:"module"}); }
  const id = ++wid;
  return new Promise((ok, no)=>{
    const h = e=>{ const m = e.data; if(m.id!==id) return; if(m.type==="done"){ worker.removeEventListener("message", h); ok(m.result); } else if(m.type==="error"){ worker.removeEventListener("message", h); no(new Error(m.message)); } else onMsg && onMsg(m); };
    worker.addEventListener("message", h);
    worker.onerror = e=>no(new Error("작업용 워커를 열지 못했습니다: "+(e.message||"")));
    worker.postMessage({id, op, args}, transfer||[]); });
}

async function call(op, mk, onMsg){   // 그래픽 카드로 하다 실패하면 워커를 새로 띄워 CPU 로만 다시 한다
  for(let k=0;;k++){ const [args, tr] = mk(); args.cpuOnly = CPU_ONLY;
    try{ return await ask(op, args, onMsg, tr); }
    catch(e){ if(!/^GPU_FAIL/.test(e.message) || k) throw e; CPU_ONLY = true; GPU = false; hint(); if(worker){ worker.terminate(); worker = null; } onMsg && onMsg({type:"device", device:"wasm", fallback:true}); } }
}

// ---------- 넣기 ----------
async function add(list){
  list = [...list].filter(f=>/^image\//.test(f.type) || isHeic(f));
  if(!list.length){ toast("사진 파일만 넣을 수 있습니다"); return; }
  if(photos.length + list.length > MAX){ toast(`한 번에 ${MAX}장까지 넣을 수 있습니다`); list = list.slice(0, MAX - photos.length); }
  for(let f of list){
    try{
      if(isHeic(f)){ await script(HEIC, ()=>typeof window.HeicTo==="function"); f = new File([await window.HeicTo({blob:f, type:"image/jpeg", quality:0.95})], f.name.replace(/\.hei[cf]$/i,"")+".jpg", {type:"image/jpeg"}); }
      let bmp = await createImageBitmap(f), w = bmp.width, h = bmp.height, small = false;
      if(Math.max(w, h) > LIMIT){ const k = LIMIT/Math.max(w, h); w = Math.round(w*k); h = Math.round(h*k); bmp = await createImageBitmap(bmp, {resizeWidth:w, resizeHeight:h, resizeQuality:"high"}); small = true; }
      const c = new OffscreenCanvas(w, h), x = c.getContext("2d"); x.drawImage(bmp, 0, 0);
      photos.push({name:f.name || "붙여 넣은 사진.png", w, h, bmp, rgba:x.getImageData(0,0,w,h).data, alpha:null, first:null, undo:[], state:"wait", small});
      if(cur < 0) cur = 0;
    }catch(e){ console.warn(e); toast(isHeic(f) ? "HEIC 사진을 열지 못했습니다. HEIC → JPG 변환 도구로 먼저 바꿔 보세요" : "열 수 없는 사진이 있습니다"); }
  }
  $("bgWork").hidden = !photos.length; thumbs(); paint(); run();
}
async function run(){
  if(running) return; running = true;
  try{
    for(let p; (p = photos.find(q=>q.state==="wait")); ){
      p.state = "run"; thumbs(); if(photos[cur]===p) paint();
      const t0 = performance.now(); let dev = "";
      try{
        const r = await call("matte", ()=>{ const rgba = p.rgba.slice(); return [{model:GPUM.model, gpuModel:GPUM.model, cpu:{model:CPU.model, dtype:CPU.dtype}, w:p.w, h:p.h, rgba:rgba.buffer, test:TEST}, [rgba.buffer]]; }, m=>{
          if(m.type==="load") say(`배경을 나누는 AI 모델을 받는 중… ${mb(m.loaded)} / ${mb(m.total)} (처음 한 번만)`, m.loaded/m.total);
          if(m.type==="device"){ dev = m.device; say(m.fallback ? "그래픽 카드로 계산하지 못해 CPU로 다시 합니다…" : `배경을 나누는 중… (${dev==="webgpu" ? "그래픽 카드" : "CPU"} 사용)`, null); } });
        let a = r.alpha;
        if(r.w!==p.w || r.h!==p.h) a = resizeAlpha(a, r.w, r.h, p.w, p.h);
        p.alpha = a; p.first = a.slice(); p.state = "done";
        { const n = photos.length, d = photos.filter(q=>q.state==="done").length, sec = Math.max(1, Math.round((performance.now()-t0)/1000));
          say(n > 1 ? `${n}장 중 ${d}장의 배경을 지웠습니다(방금 한 장 ${sec}초). 남은 곳이나 잘린 곳은 붓으로 고치세요.` : `배경을 지웠습니다(${sec}초). 남은 곳이나 잘린 곳은 붓으로 고치세요.`, null); }
      }catch(e){ console.warn(e); p.state = "err";
        say(/Failed to fetch|NetworkError|network error|404|ERR_/i.test(e.message) ? "AI 모델을 받지 못했습니다. 인터넷 연결을 확인하고 다시 해 보세요." : /memory|alloc|Aborted/i.test(e.message) ? "메모리가 모자랍니다. 다른 탭을 닫거나 더 작은 사진으로 해 보세요." : "배경을 지우지 못했습니다: "+e.message, null); }
      thumbs(); if(photos[cur]===p) paint();
    }
  } finally { running = false; thumbs(); }
}
function resizeAlpha(a, w, h, W, H){
  const s = new OffscreenCanvas(w, h), sx = s.getContext("2d"), d = sx.createImageData(w, h);
  for(let i=0;i<a.length;i++){ d.data[i*4+3] = a[i]; } sx.putImageData(d, 0, 0);
  const t = new OffscreenCanvas(W, H), tx = t.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(s, 0, 0, W, H);
  const o = tx.getImageData(0, 0, W, H).data, out = new Uint8ClampedArray(W*H); for(let i=0;i<out.length;i++) out[i] = o[i*4+3]; return out;
}

// ---------- 화면 ----------
const say = (m, r)=>{ $("bgStatus").textContent = m; $("bgBar").hidden = r==null; if(r!=null) $("bgBar").firstElementChild.style.width = Math.round(r*100)+"%"; };
function hint(){ $("bgEst").textContent = `처음 한 번 AI 모델 약 ${GPU ? GPUM.mb : CPU.mb}MB를 받습니다(다음부터는 바로 시작) · ${GPU ? "그래픽 카드로 계산합니다" : "CPU로 계산해 사진 한 장에 10초 안팎 걸립니다(첫 장은 더 걸림)"}`; }
function thumbs(){
  $("bgList").innerHTML = photos.map((p,i)=>`<button type="button" data-pick="${i}" class="${i===cur?"on":""}" aria-label="${i+1}번째 사진${p.state==="done"?"":p.state==="err"?" (실패)":" (처리 중)"}"><canvas data-th="${i}" width="64" height="64"></canvas><span>${p.state==="done"?"✓":p.state==="err"?"!":"…"}</span></button>`).join("");
  photos.forEach((p,i)=>{ const c = $("bgList").querySelector(`[data-th="${i}"]`), x = c.getContext("2d"), k = Math.max(64/p.w, 64/p.h); x.drawImage(p.bmp, (64-p.w*k)/2, (64-p.h*k)/2, p.w*k, p.h*k); });
  $("bgZip").hidden = photos.filter(p=>p.state==="done").length < 2;
  $("bgRetry").hidden = running || !photos.some(p=>p.state==="err");
}
let cut = null, cutFor = null;   // 지운 결과(원래 크기, 투명) — 붓질할 때마다 다시 만든다
function cutout(p){
  if(cutFor===p && cut && !p.dirty) return cut;
  const c = new OffscreenCanvas(p.w, p.h), x = c.getContext("2d"), d = new ImageData(new Uint8ClampedArray(p.rgba), p.w, p.h);
  for(let i=0;i<p.alpha.length;i++) d.data[i*4+3] = p.alpha[i];
  x.putImageData(d, 0, 0); cut = c; cutFor = p; p.dirty = false; return c;
}
function bgFill(){ const v = val("bgBg"); return v==="none" ? null : v==="white" ? "#ffffff" : $("bgColor").value; }
let view = {k:1};
function paint(){
  const p = photos[cur], cv = $("bgCanvas"), stage = $("bgStage");
  $("bgTools").hidden = !p || p.state!=="done";
  if(!p){ cv.width = cv.height = 0; return; }
  const maxW = stage.clientWidth || 600, maxH = Math.min(window.innerHeight*0.62, 720), k = Math.min(maxW/p.w, maxH/p.h, 1), dpr = Math.min(2, window.devicePixelRatio||1);
  view = {k};
  cv.style.width = Math.round(p.w*k)+"px"; cv.style.height = Math.round(p.h*k)+"px";
  cv.width = Math.round(p.w*k*dpr); cv.height = Math.round(p.h*k*dpr);
  const x = cv.getContext("2d"), W = cv.width, H = cv.height; x.clearRect(0,0,W,H);
  stage.classList.toggle("chk", p.state==="done" && !bgFill());
  if(p.state!=="done"){ x.drawImage(p.bmp, 0, 0, W, H); x.fillStyle = "rgba(0,0,0,.45)"; x.fillRect(0,0,W,H);
    x.fillStyle = "#fff"; x.font = `700 ${Math.round(16*dpr)}px Pretendard, sans-serif`; x.textAlign = "center"; x.fillText(p.state==="err" ? "배경을 지우지 못했습니다" : p.state==="run" ? "배경을 나누는 중…" : "차례를 기다리는 중…", W/2, H/2); return; }
  const f = bgFill(); if(f){ x.fillStyle = f; x.fillRect(0,0,W,H); }
  x.imageSmoothingQuality = "high"; x.drawImage(cutout(p), 0, 0, W, H);
  const s = +$("bgSplit").value/100;   // 왼쪽은 원래 사진(비교)
  if(s > 0){ x.save(); x.beginPath(); x.rect(0,0,W*s,H); x.clip(); x.drawImage(p.bmp, 0, 0, W, H); x.restore(); x.fillStyle = "#fff"; x.fillRect(W*s-1*dpr, 0, 2*dpr, H); }
  $("bgUndo").disabled = !p.undo.length;
  $("bgInfo").textContent = `${p.name} · ${p.w}×${p.h}${p.small ? ` (긴 쪽 ${LIMIT}픽셀로 줄여서 처리)` : ""}`;
}

// ---------- 붓으로 고치기 ----------
let brush = null;
function stroke(p, cx, cy){   // 원래 사진 좌표, 부드러운 둥근 붓
  const mode = val("bgBrush"), r = +$("bgSize").value / view.k / 2, r2 = r*r, a = p.alpha, add = mode==="keep";
  const x0 = Math.max(0, Math.floor(cx-r)), x1 = Math.min(p.w-1, Math.ceil(cx+r)), y0 = Math.max(0, Math.floor(cy-r)), y1 = Math.min(p.h-1, Math.ceil(cy+r));
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const d2 = (x-cx)*(x-cx)+(y-cy)*(y-cy); if(d2 > r2) continue;
    const t = Math.min(1, (1 - Math.sqrt(d2)/r) * 2.5), i = y*p.w+x; a[i] = add ? Math.max(a[i], 255*t) : Math.min(a[i], 255*(1-t)); }
  p.dirty = true;
}
function at(e){ const r = $("bgCanvas").getBoundingClientRect(); return [(e.clientX-r.left)/view.k, (e.clientY-r.top)/view.k]; }
const cv = $("bgCanvas");
cv.addEventListener("pointerdown", e=>{ const p = photos[cur]; if(!p || p.state!=="done" || val("bgBrush")==="view") return;
  e.preventDefault(); cv.setPointerCapture(e.pointerId); p.undo.push(p.alpha.slice()); if(p.undo.length > 15) p.undo.shift();
  if(+$("bgSplit").value){ $("bgSplit").value = 0; }
  const [x, y] = at(e); brush = {x, y}; stroke(p, x, y); sched(); });
cv.addEventListener("pointermove", e=>{ if(!brush) return; const p = photos[cur], [x, y] = at(e), d = Math.hypot(x-brush.x, y-brush.y), step = Math.max(1, +$("bgSize").value/view.k/6);
  for(let t=step;t<=d;t+=step) stroke(p, brush.x+(x-brush.x)*t/d, brush.y+(y-brush.y)*t/d); stroke(p, x, y); brush = {x, y}; sched(); });
const endB = ()=>{ brush = null; }; cv.addEventListener("pointerup", endB); cv.addEventListener("pointercancel", endB);
let raf = 0; const sched = ()=>{ if(raf) return; raf = requestAnimationFrame(()=>{ raf = 0; paint(); }); };

// ---------- 저장 ----------
function render(p){
  const trim = $("bgTrim").checked, f = bgFill(); let X = 0, Y = 0, W = p.w, H = p.h;
  if(trim){ let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1; for(let y=0;y<p.h;y++) for(let x=0;x<p.w;x++) if(p.alpha[y*p.w+x] > 24){ if(x<x0) x0 = x; if(x>x1) x1 = x; if(y<y0) y0 = y; if(y>y1) y1 = y; }
    if(x1 >= 0){ const m = Math.round(Math.max(x1-x0, y1-y0)*0.03); X = Math.max(0, x0-m); Y = Math.max(0, y0-m); W = Math.min(p.w, x1+m+1) - X; H = Math.min(p.h, y1+m+1) - Y; } }
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  if(f){ x.fillStyle = f; x.fillRect(0,0,W,H); }
  x.drawImage(cutout(p), -X, -Y);
  return {c, type: f ? "image/jpeg" : "image/png"};
}
const blobOf = p=>{ const {c, type} = render(p); return new Promise(ok=>c.toBlob(b=>ok({b, type}), type, 0.93)); };
const nameOf = (p, t)=>p.name.replace(/\.[^.]+$/,"") + "-배경제거." + (/png/.test(t) ? "png" : "jpg");
const save = (b, n)=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = n; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); };

// ---------- 이벤트 ----------
$("bgSave").addEventListener("click", async ()=>{ const p = photos[cur]; if(!p || p.state!=="done") return; const {b, type} = await blobOf(p); save(b, nameOf(p, type)); toast(`${/png/.test(type) ? "투명 PNG" : "JPG"}로 저장했습니다(${mb(b.size)})`); });
$("bgZip").addEventListener("click", async ()=>{ await script(ZIP, ()=>!!window.JSZip); const z = new JSZip(), used = new Set();
  for(const p of photos.filter(q=>q.state==="done")){ const {b, type} = await blobOf(p); let n = nameOf(p, type), k = 2; while(used.has(n)) n = n.replace(/(\.\w+)$/, `-${k++}$1`); used.add(n); z.file(n, b); }
  save(await z.generateAsync({type:"blob"}), "배경제거-사진.zip"); });
$("bgRetry").addEventListener("click", ()=>{ photos.forEach(p=>{ if(p.state==="err") p.state = "wait"; }); run(); });
$("bgUndo").addEventListener("click", ()=>{ const p = photos[cur]; if(p && p.undo.length){ p.alpha = p.undo.pop(); p.dirty = true; paint(); } });
$("bgReset").addEventListener("click", ()=>{ const p = photos[cur]; if(p && p.first){ p.undo.push(p.alpha); p.alpha = p.first.slice(); p.dirty = true; paint(); } });
$("bgRemove").addEventListener("click", ()=>{ if(cur<0 || photos[cur].state==="run") return; photos.splice(cur,1); cur = Math.min(cur, photos.length-1); cutFor = null; $("bgWork").hidden = !photos.length; thumbs(); paint(); });
$("bgList").addEventListener("click", e=>{ const b = e.target.closest("[data-pick]"); if(b){ cur = +b.dataset.pick; thumbs(); paint(); } });
document.querySelectorAll("input[name=bgBg]").forEach(r=>r.addEventListener("change", paint));
$("bgColor").addEventListener("input", ()=>{ document.querySelector("input[name=bgBg][value=color]").checked = true; paint(); });
$("bgSplit").addEventListener("input", sched);
document.querySelectorAll("input[name=bgBrush]").forEach(r=>r.addEventListener("change", ()=>{ cv.classList.toggle("brush", val("bgBrush")!=="view"); }));
$("bgFile").addEventListener("change", e=>{ add(e.target.files); e.target.value = ""; });
const drop = $("bgDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>add(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("bgFile").click(); } });
document.addEventListener("paste", e=>{ const f = [...(e.clipboardData?.items||[])].filter(it=>it.kind==="file").map(it=>it.getAsFile()).filter(Boolean); if(f.length){ e.preventDefault(); add(f); } });
window.addEventListener("resize", sched);
if(location.hash.startsWith("#bot")) window.__bg = {photos:()=>photos.map(p=>({name:p.name, w:p.w, h:p.h, state:p.state})), busy:()=>running || photos.some(p=>p.state==="wait"||p.state==="run"), alpha:i=>{ const a = photos[i].alpha; let s = 0, on = 0; for(const v of a){ s += v; if(v>127) on++; } return {mean:s/a.length/255, on:on/a.length}; }};
hint();
})();

// SHIFT AI 무료 도구 — 영상 자막 자동 만들기 · 회의 녹음 → 글자(받아쓰기). 두 페이지가 이 파일 하나를 같이 쓴다.
// 받아쓰기는 OpenAI Whisper(Apache-2.0, Hugging Face onnx-community 변환본)를 /assets/ai-worker.js 안에서 돌린다(브라우저 안, 그래픽 카드가 있으면 WebGPU).
// 소리는 조용한 곳에서 30초 안쪽으로 잘라 차례로 보내고(진행률·중간 결과를 보여 주려고), 소리가 거의 없는 조각은 보내지 않는다(없는 말을 지어내는 것을 줄임).
// 자막 입힌 MP4 는 '영상 자르기' 도구의 영상 엔진(/assets/video-trim.js 의 SHIFT_VT)으로 다시 압축하면서 글자를 그린다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("asDrop")) return;
const VIDEO = !!$("asList"), SR = 16000;
const MODELS = {fast:{id:"onnx-community/whisper-base", mb:75, gmb:165, cpu:0.35}, best:{id:"onnx-community/whisper-small", mb:250, gmb:410, cpu:1.0}};   // mb: CPU 용 파일 크기, gmb: 그래픽 카드용
const TEST = location.hash==="#bot-gpu";   // 검수용: 소프트웨어 WebGPU 도 그래픽 카드로 쳐 본다
let GPU = null;   // 그래픽 카드로 계산할지(워커와 같은 기준: 진짜 그래픽 카드 + 16비트 계산)
(async()=>{ try{ const a = navigator.gpu && await navigator.gpu.requestAdapter({powerPreference:"high-performance"}), info = (a && a.info) || {};
  const soft = a && (a.isFallbackAdapter || info.isFallbackAdapter || /swiftshader|llvmpipe|software/i.test((info.architecture||"")+" "+(info.description||"")));
  GPU = !!(a && ((!soft && a.features.has("shader-f16")) || TEST)); }catch(_){ GPU = false; } draw(); })();
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2400); };
const mb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const two = n=>String(n).padStart(2,"0");
const clock = s=>{ s = Math.max(0,s); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = Math.floor(s%60); return (h ? h+":"+two(m) : m)+":"+two(x); };
const srtT = s=>{ s = Math.max(0,s); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = Math.floor(s%60), ms = Math.round((s-Math.floor(s))*1000); return `${two(h)}:${two(m)}:${two(x)},${String(Math.min(999,ms)).padStart(3,"0")}`; };
const parseT = v=>{ const p = String(v).trim().replace(",",".").split(":").map(Number); if(p.some(isNaN) || !p.length) return NaN; return p.reduce((a,x)=>a*60+x, 0); };
const val = n=>document.querySelector(`input[name=${n}]:checked`).value;
const workerUrl = ()=>{ const me = document.querySelector("script[data-worker]"); return (me && me.dataset.worker) || "/assets/ai-worker.js"; };
let file = null, audio = null, dur = 0, cues = [], busy = false, stopFlag = false, worker = null, wid = 0, url = null, CPU_ONLY = false;

// ---------- 소리 꺼내기(16kHz 한 채널) ----------
async function decode(f){
  let ab;   // 화면 소리 장치를 켜지 않는 OfflineAudioContext 로 풀고(바로 16kHz 로), 안 되면 보통 AudioContext 로(파일을 다시 읽어서 — 한 번 넘긴 버퍼는 못 씀)
  try{ ab = await new OfflineAudioContext(1, 1, SR).decodeAudioData(await f.arrayBuffer()); }
  catch(_){ const C = window.AudioContext || window.webkitAudioContext, ac = new C(); try{ ab = await ac.decodeAudioData(await f.arrayBuffer()); } finally{ ac.close && ac.close(); } }
  if(ab.sampleRate !== SR || ab.numberOfChannels > 1){
    const oc = new OfflineAudioContext(1, Math.max(1, Math.ceil(ab.duration*SR)), SR), s = oc.createBufferSource(); s.buffer = ab; s.connect(oc.destination); s.start(); ab = await oc.startRendering(); }
  return ab.getChannelData(0);
}
// ---------- 조용한 곳에서 자르기 ----------
function split(a){   // 20ms 마다 소리 크기 → 거의 조용한 곳은 건너뛰고, 12~28초 사이에서 가장 조용한 자리를 골라 자른다
  const F = 320, n = Math.floor(a.length/F), e = new Float32Array(n);
  for(let i=0;i<n;i++){ let s = 0; for(let j=i*F;j<(i+1)*F;j++) s += a[j]*a[j]; e[i] = Math.sqrt(s/F); }
  const sorted = Array.from(e).sort((x,y)=>x-y), floor = sorted[Math.floor(n*0.15)] || 0;
  const skip = Math.max(0.005, floor*1.6), thr = Math.max(0.006, floor*3);   // skip: 이보다 작으면 '아무 소리 없음'(배경 음악이 깔려도 말소리를 버리지 않게 낮게) · thr: 또렷한 말소리
  const segs = []; let i = 0; const maxF = 28*SR/F, minF = 12*SR/F;
  while(i < n){
    while(i < n && e[i] < skip) i++;
    if(i >= n) break;
    let s = Math.max(0, i-10), end = Math.min(n, s+maxF);
    if(end < n){ let best = end, bv = 1e9;
      for(let k=s+minF;k<end;k++){ let v = 0; for(let q=k;q<k+15 && q<n;q++) v += e[q]; if(v < bv){ bv = v; best = k+7; } } end = best; }
    let on = 0; for(let k=s;k<end;k++) if(e[k] >= skip) on++;
    if(on > 8) segs.push({s:s*F, e:Math.min(a.length, end*F)});
    i = end;
  }
  return {segs, e, thr, F};
}
const HALLU = /(^(감사|고맙)합니다[.!]?$|시청해\s?주셔서\s?감사|구독.{0,5}좋아요|좋아요.{0,5}구독|알림\s?설정|MBC\s?뉴스|자막\s?제작|다음\s?영상에서\s?만나요|영상\s?편집|Thank you for watching|Subtitles by|Please subscribe)/i;
// 같은 말(1~8낱말)이 세 번 넘게 잇달아 나오면 한 번으로(소리가 애매한 곳에서 AI가 같은 말을 되풀이하는 버릇)
function derep(t){
  const w = t.split(/\s+/).filter(Boolean); let rep = false;
  for(let n=1;n<=8;n++){ const out = [], key = k=>w.slice(k, k+n).join(" ").replace(/[,.]$/,"");
    for(let i=0;i<w.length;){ const g = key(i); let k = 1;
      while(i+n*(k+1) <= w.length && key(i+n*k)===g) k++;
      if(k >= 3){ out.push(...w.slice(i, i+n)); i += n*k; rep = true; } else { out.push(w[i]); i++; } }
    w.splice(0, w.length, ...out); }
  return {text: w.join(" "), rep};
}
function loud(E, t0, t1){ const {e, thr, F} = E, a = Math.floor(t0*SR/F), b = Math.max(a+1, Math.ceil(t1*SR/F)); let k = 0; for(let i=a;i<b && i<e.length;i++) if(e[i] >= thr) k++; return k/(b-a); }

// ---------- 받아쓰기 ----------
function ask(op, args, onMsg, transfer){
  if(!worker) worker = new Worker(workerUrl(), {type:"module"});
  const id = ++wid;
  return new Promise((ok, no)=>{
    const h = e=>{ const m = e.data; if(m.id!==id) return; if(m.type==="done"){ worker.removeEventListener("message", h); ok(m.result); } else if(m.type==="error"){ worker.removeEventListener("message", h); no(new Error(m.message)); } else onMsg && onMsg(m); };
    worker.addEventListener("message", h);
    worker.onerror = e=>{ no(new Error("작업용 워커를 열지 못했습니다: "+(e.message||""))); };
    worker.postMessage({id, op, args}, transfer||[]); });
}
// 그래픽 카드로 하다 실패하면(GPU_FAIL) 워커를 새로 띄워 CPU 로만 다시 한다
async function call(op, mk, onMsg){
  for(let k=0;;k++){ const [args, tr] = mk(); args.cpuOnly = CPU_ONLY;
    try{ return await ask(op, args, onMsg, tr); }
    catch(e){ if(!/^GPU_FAIL/.test(e.message) || k) throw e; CPU_ONLY = true; GPU = false; if(worker){ worker.terminate(); worker = null; } onMsg && onMsg({type:"device", device:"wasm", fallback:true}); } }
}
async function run(){
  if(busy || !audio) return;
  busy = true; stopFlag = false; cues = []; draw(); show();
  const M = MODELS[val("asModel")], lang = $("asLang").value;
  const E = split(audio), total = E.segs.reduce((a,s)=>a+s.e-s.s, 0) || 1; let doneS = 0, upTo = 0, t0 = performance.now(), dev = "";
  $("asLive").textContent = ""; $("asLiveW").hidden = false;
  if(!E.segs.length){ busy = false; $("asLiveW").hidden = true; say("말소리를 찾지 못했습니다. 소리가 없거나 아주 작은 파일입니다."); draw(); return; }
  try{
    for(const [k, sg] of E.segs.entries()){
      if(stopFlag) break;
      const off = sg.s/SR;
      const r = await call("asr", ()=>{ const piece = audio.slice(sg.s, sg.e); return [{model:M.id, audio:piece, language: lang, test: TEST, max: Math.min(440, Math.round((sg.e-sg.s)/SR*12) + 24)}, [piece.buffer]]; }, m=>{
        if(m.type==="load") { bar(m.loaded/m.total*0.999, true); say(`받아쓰기 모델을 받는 중… ${mb(m.loaded)} / ${mb(m.total)}`); }
        if(m.type==="device"){ dev = m.device; if(m.fallback) say("그래픽 카드로 계산하지 못해 CPU로 다시 합니다…"); } });
      for(const c of r.chunks){
        let a = (c.t[0] ?? 0) + off, b = (c.t[1] ?? (sg.e-sg.s)/SR) + off; if(b <= a) b = a + 0.8;
        const D = derep((c.text||"").trim()), text = D.text; if(!text) continue;
        if((HALLU.test(text) || D.rep) && loud(E, a, b) < 0.35) continue;        // 또렷한 말소리가 없는 곳에 붙은 '시청해 주셔서 감사합니다'·되풀이 같은 지어낸 말
        if(/^[\s♪♫🎵*~.,·-]*$/.test(text) || /^[\[(（【][^\])）】]{0,15}[\])）】]$/.test(text)) continue;   // '♪'·'(음악)'·'[박수]'처럼 말이 아닌 표시
        const last = cues[cues.length-1]; if(last && last.text===text && a - last.e < 2) continue;   // 같은 말 되풀이
        cues.push({s:a, e:Math.min(b, dur), text});
      }
      doneS += sg.e - sg.s; upTo = sg.e/SR;
      const el = (performance.now()-t0)/1000, left = el/doneS*(total-doneS);
      bar(doneS/total); say(`받아쓰는 중… ${k+1} / ${E.segs.length} 조각 · ${dev==="webgpu" ? "그래픽 카드 사용" : "CPU 사용"} · 남은 시간 약 ${left < 60 ? Math.max(1,Math.round(left))+"초" : Math.round(left/60)+"분"}`);
      $("asLive").textContent = cues.map(c=>c.text).join(" "); $("asLiveW").scrollTop = 1e9;
    }
    cues = VIDEO ? fit(cues) : cues;
    if(!cues.length && !stopFlag) say("말소리를 찾지 못했습니다. 음악이나 잡음만 있는 파일일 수 있습니다.");
    else say(stopFlag ? `멈췄습니다. ${clock(upTo)}까지 받아쓴 내용을 쓸 수 있습니다.` : `다 받아썼습니다. ${Math.round((performance.now()-t0)/1000)}초 걸렸습니다. 틀린 글자가 있을 수 있으니 확인하세요.`);
  }catch(e){ console.warn(e); say(/Failed to fetch|NetworkError|network error|404|ERR_/i.test(e.message) ? "받아쓰기 모델을 받지 못했습니다. 인터넷 연결을 확인하고 다시 해 보세요." : /memory|alloc/i.test(e.message) ? "메모리가 모자랍니다. '빠르게'를 고르거나 더 짧은 파일로 해 보세요." : "받아쓰지 못했습니다: "+e.message); }
  finally{ busy = false; bar(null); $("asLiveW").hidden = !!cues.length; draw(); show(); }
}
// 자막 한 장이 너무 길면 글자 수만큼 시간을 나눠 여러 장으로
function fit(list){
  const max = VIDEO && isPortrait() ? 26 : 40, out = [];
  for(const c of list){
    if(c.text.length <= max){ out.push(c); continue; }
    const words = c.text.split(/\s+/), parts = []; let cur = "";
    for(const w of words){ if(cur && (cur+" "+w).length > max){ parts.push(cur); cur = w; } else cur = cur ? cur+" "+w : w; }
    if(cur) parts.push(cur);
    const totalL = parts.reduce((a,p)=>a+p.length, 0); let t = c.s;
    parts.forEach(p=>{ const d = (c.e-c.s)*p.length/totalL; out.push({s:t, e:t+d, text:p}); t += d; });
  }
  return out;
}

// ---------- 화면 공통 ----------
const say = m=>{ $("asStatus").textContent = m; };
const bar = (r, load)=>{ $("asBar").hidden = r==null; if(r!=null){ $("asBar").firstElementChild.style.width = Math.round(Math.min(1,r)*100)+"%"; $("asBar").classList.toggle("load", !!load); } };
function estimate(){
  if(!dur) return "";
  const M = MODELS[val("asModel")], t = dur*M.cpu, cpu = t<60 ? Math.max(5,Math.round(t))+"초" : Math.round(t/60)+"분";
  return `${clock(dur)} 길이 · ${GPU ? "그래픽 카드로 계산합니다" : `CPU로 약 ${cpu} 걸립니다`} · 처음 한 번 모델 약 ${GPU ? M.gmb : M.mb}MB를 받습니다(다음부터는 바로 시작)`;
}
function draw(){
  $("asGo").disabled = busy || !audio;
  $("asGo").textContent = busy ? "받아쓰는 중…" : cues.length ? "다시 받아쓰기" : VIDEO ? "자막 만들기" : "받아쓰기";
  $("asStop").hidden = !busy;
  $("asEst").textContent = estimate();
}
async function load(f){
  if(busy || !f) return;
  if(!/^(audio|video)\//.test(f.type) && !/\.(mp4|mov|m4v|webm|mp3|m4a|wav|aac|ogg|flac|amr|3gp)$/i.test(f.name)){ toast("영상·소리 파일만 넣을 수 있습니다"); return; }
  file = f; audio = null; cues = []; dur = 0; show();
  say("소리를 꺼내는 중…");
  if(url) URL.revokeObjectURL(url); url = URL.createObjectURL(f);
  if(VIDEO){ $("asPlayer").src = url; $("asPrev").hidden = false; }
  try{ audio = await decode(f); dur = audio.length/SR; say(""); }
  catch(e){ console.warn(e); say(/^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name) ? "이 영상에서 소리를 꺼내지 못했습니다. 소리가 없는 영상이거나 이 브라우저가 풀 수 없는 형식입니다." : "이 파일에서 소리를 꺼내지 못했습니다. M4A·MP3·WAV 파일을 넣어 주세요."); file = null; }
  $("asInfo").textContent = file ? `${f.name} · ${mb(f.size)}${dur ? " · "+clock(dur) : ""}` : "";
  if(dur > 3*3600) say("3시간이 넘는 파일은 브라우저 메모리가 모자랄 수 있습니다. 나눠서 넣는 편이 안전합니다.");
  draw();
}
function show(){
  $("asOut").hidden = !cues.length || busy;
  if(!cues.length || busy) return;
  if(VIDEO) renderCues(); else renderText();
}

// ---------- 영상 자막 페이지 ----------
const isPortrait = ()=>{ const v = $("asPlayer"); return v && v.videoHeight > v.videoWidth; };
function renderCues(){
  if(!VIDEO) return;
  $("asList").innerHTML = cues.map((c,i)=>`<li data-i="${i}"><span class="ast"><input aria-label="시작" value="${clock(c.s)}.${Math.floor((c.s%1)*10)}" data-k="s"><input aria-label="끝" value="${clock(c.e)}.${Math.floor((c.e%1)*10)}" data-k="e"></span><textarea rows="1" aria-label="${i+1}번 자막" data-k="text">${esc(c.text)}</textarea><button type="button" class="asplay" data-play="${i}" aria-label="이 자막부터 재생">▶</button><button type="button" class="asdel" data-del="${i}" aria-label="이 자막 지우기">✕</button></li>`).join("");
  $("asCount").textContent = cues.length ? `자막 ${cues.length}개` : "";
}
function style(){ return {pos:val("asPos"), size:val("asSize"), look:val("asLook")}; }
function drawSub(ctx, text, W, H, st){   // 화면 아래·가운데·위에 줄을 맞춰 그린다
  if(!text) return;
  const short = Math.min(W, H), fs = Math.round(short * ({s:0.045, m:0.06, l:0.075}[st.size]) * (H > W ? 1 : 0.9));
  ctx.save(); ctx.font = `800 ${fs}px Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const maxW = W*0.86, lines = []; let cur = "";
  for(const w of text.split(/\s+/)){ const t = cur ? cur+" "+w : w; if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; }
  if(cur) lines.push(cur);
  const lh = fs*1.32, blockH = lines.length*lh, cy = st.pos==="top" ? H*0.12 + blockH/2 : st.pos==="mid" ? H*0.5 : H - H*(H > W ? 0.2 : 0.1) - blockH/2;
  lines.forEach((ln, i)=>{ const y = cy - blockH/2 + lh*(i+0.5);
    if(st.look==="band"){ const w = ctx.measureText(ln).width + fs*0.7; ctx.fillStyle = "rgba(0,0,0,.72)"; ctx.fillRect(W/2-w/2, y-lh/2, w, lh); ctx.fillStyle = "#fff"; ctx.fillText(ln, W/2, y); }
    else { ctx.lineJoin = "round"; ctx.lineWidth = Math.max(3, fs*0.16); ctx.strokeStyle = "rgba(0,0,0,.92)"; ctx.strokeText(ln, W/2, y); ctx.fillStyle = st.look==="yellow" ? "#FFE14D" : "#fff"; ctx.fillText(ln, W/2, y); } });
  ctx.restore();
}
function overlay(){   // 미리 보기: 재생 위치의 자막을 영상 위 캔버스에 그린다
  const v = $("asPlayer"), c = $("asOver"); if(!v || !c) return;
  const r = v.getBoundingClientRect(), W = v.videoWidth, H = v.videoHeight; if(!W) return;
  const k = Math.min(r.width/W, r.height/H), dw = W*k, dh = H*k, dpr = Math.min(2, window.devicePixelRatio||1);
  c.style.width = dw+"px"; c.style.height = dh+"px"; c.style.left = (r.width-dw)/2+"px"; c.style.top = (r.height-dh)/2+"px";
  if(c.width !== Math.round(dw*dpr)){ c.width = Math.round(dw*dpr); c.height = Math.round(dh*dpr); }
  const x = c.getContext("2d"); x.clearRect(0,0,c.width,c.height);
  const t = v.currentTime, cu = cues.find(q=>t>=q.s && t<q.e);
  if(cu) drawSub(x, cu.text, c.width, c.height, style());
}
function loop(){ overlay(); requestAnimationFrame(loop); }
const rot = m=>{ if(!m) return 0; const a = ((m[0]<<24)|(m[1]<<16)|(m[2]<<8)|m[3]), b = ((m[4]<<24)|(m[5]<<16)|(m[6]<<8)|m[7]); return (Math.round(Math.atan2(b, a)*180/Math.PI)+360)%360; };
async function burn(){
  if(busy || !cues.length || !file) return;
  busy = true; stopFlag = false; draw(); $("asBurn").disabled = true; say("자막을 입힌 영상을 만드는 중…"); bar(0);
  try{
    if(!window.SHIFT_VT) await new Promise((ok,no)=>{ const s = document.createElement("script"); s.src = "/assets/video-trim.js"; s.onload = ok; s.onerror = ()=>no(new Error("영상 엔진을 받지 못했습니다")); document.head.appendChild(s); });
    if(typeof VideoEncoder==="undefined") throw new Error("이 브라우저는 영상 다시 만들기(WebCodecs)를 지원하지 않습니다. 크롬·엣지·사파리 최신판에서 해 보세요. 자막 파일(.srt)은 받을 수 있습니다.");
    const D = await SHIFT_VT.demux(file);
    const W0 = D.v.w, H0 = D.v.h, short = Math.min(W0, H0), sc = short > 1080 ? 1080/short : 1, w = Math.round(W0*sc/2)*2, h = Math.round(H0*sc/2)*2;
    const fps = Math.min(60, Math.max(1, Math.round(D.v.samples.length/Math.max(0.1, D.v.duration))));
    const srcBr = D.v.bytes*8/Math.max(0.1, D.v.duration), bitrate = Math.round(Math.min(Math.max(w*h*fps*0.09, 1.5e6), Math.max(srcBr*1.1, 2e6)));
    const R = rot(D.v.matrix), st = style(), list = cues.slice();
    const r = await SHIFT_VT.transcode(D, {start:0, end:D.duration, w, h, fps, bitrate, mute:false,
      draw:(ctx, t, cw, ch)=>{ const cu = list.find(q=>t>=q.s && t<q.e); if(!cu) return;
        ctx.save();   // 휴대폰 세로 영상은 가로로 담고 '돌려 보여 주기' 정보만 있으므로, 그 반대로 돌려 그려야 화면에서 바로 선다
        let dw = cw, dh = ch;
        if(R===90){ ctx.transform(0,-1,1,0,0,ch); dw = ch; dh = cw; } else if(R===270){ ctx.transform(0,1,-1,0,cw,0); dw = ch; dh = cw; } else if(R===180){ ctx.transform(-1,0,0,-1,cw,ch); }
        drawSub(ctx, cu.text, dw, dh, st); ctx.restore(); }}, p=>bar(p), {get stop(){ return stopFlag; }});
    const name = file.name.replace(/\.[^.]+$/,"") + "-자막.mp4", u = URL.createObjectURL(r.blob);
    const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u), 60000);
    say(`자막을 입힌 영상(${mb(r.blob.size)})을 내려받았습니다.`);
  }catch(e){ console.warn(e); say(e.message==="stop" ? "멈췄습니다." : e.message==="hevc" ? "아이폰 고효율(HEVC) 영상은 이 브라우저에서 다시 만들 수 없습니다. 자막 파일(.srt)을 받아 편집 프로그램에서 입히세요." : /^(이 브라우저|영상 엔진)/.test(e.message) ? e.message : "영상을 만들지 못했습니다. MP4·MOV 영상인지 확인하세요. 자막 파일(.srt)은 받을 수 있습니다."); }
  finally{ busy = false; bar(null); draw(); $("asBurn").disabled = false; }
}
function srt(list){ return list.map((c,i)=>`${i+1}\n${srtT(c.s)} --> ${srtT(c.e)}\n${c.text}\n`).join("\n"); }
const save = (blob, name)=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); };
const base = ()=>(file ? file.name.replace(/\.[^.]+$/,"") : "자막");

// ---------- 회의 녹음 페이지 ----------
function textOf(){   // 시각 표시·문단 나누기(2초 넘게 쉰 곳, 또는 문단이 길어지면 문장이 끝난 곳)
  const ts = $("asTs") && $("asTs").checked, para = $("asPara") && $("asPara").checked; let out = "", last = -1e9, plen = 0;
  for(const c of cues){
    const brk = !out || (para && (c.s - last > 2 || (plen > 500 && /[.?!다요죠]$/.test(out)))), line = !para && ts;
    if(out) out += brk && para ? "\n\n" : line ? "\n" : " ";
    if(brk || line) plen = 0;
    if(ts && (brk || line)) out += `[${clock(c.s)}] `;
    out += c.text; plen += c.text.length; last = c.e;
  }
  return out;
}
function renderText(){ if(VIDEO) return; $("asText").value = textOf(); $("asCount").textContent = `${clock(dur)} · ${$("asText").value.replace(/\s/g,"").length.toLocaleString()}자`; }
const PROMPT = t=>`역할: 회의록을 정리하는 비서입니다.
자료: 아래는 회의 녹음을 받아쓴 글입니다. 받아쓰기라 틀린 글자와 말하는 사람 구분이 없습니다.
할 일: 1) 결정된 것 2) 할 일(누가·언제까지 — 글에 없으면 '확인 필요') 3) 다음에 다시 이야기할 것 4) 핵심 내용 5줄 요약을 표로 정리해 주세요.
조건: 글에 없는 내용은 지어내지 말고, 숫자·날짜·이름은 받아쓴 그대로 쓰되 틀려 보이면 '(확인 필요)'를 붙여 주세요.

---
${t}`;

// ---------- 이벤트 ----------
$("asFile").addEventListener("change", e=>{ load(e.target.files[0]); e.target.value = ""; });
const drop = $("asDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>load(e.dataTransfer.files[0]));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("asFile").click(); } });
document.querySelectorAll("input[name=asModel]").forEach(r=>r.addEventListener("change", draw));
$("asGo").addEventListener("click", run);
$("asStop").addEventListener("click", ()=>{ stopFlag = true; say("지금 조각까지 끝내고 멈춥니다…"); });
if(VIDEO){
  $("asList").addEventListener("input", e=>{ const li = e.target.closest("li"), k = e.target.dataset.k; if(!li || !k) return; const c = cues[+li.dataset.i];
    if(k==="text") c.text = e.target.value.replace(/\n/g," "); else { const v = parseT(e.target.value); if(!isNaN(v)){ c[k] = Math.max(0, Math.min(dur, v)); e.target.classList.remove("bad"); } else e.target.classList.add("bad"); } });
  $("asList").addEventListener("click", e=>{ const b = e.target.closest("button"); if(!b) return;
    if(b.dataset.del!=null){ cues.splice(+b.dataset.del, 1); renderCues(); }
    else if(b.dataset.play!=null){ const v = $("asPlayer"); v.currentTime = cues[+b.dataset.play].s; v.play(); } });
  $("asSrt").addEventListener("click", ()=>{ if(cues.length) save(new Blob(["﻿"+srt(cues)], {type:"text/plain"}), base()+".srt"); });
  $("asBurn").addEventListener("click", burn);
  loop();
}else{
  ["asTs","asPara"].forEach(id=>$(id).addEventListener("change", renderText));
  $("asCopy").addEventListener("click", async ()=>{ try{ await navigator.clipboard.writeText($("asText").value); toast("받아쓴 글을 복사했습니다"); }catch(_){ toast("복사하지 못했습니다"); } });
  $("asTxt").addEventListener("click", ()=>{ if(cues.length) save(new Blob(["﻿"+$("asText").value], {type:"text/plain"}), base()+"-받아쓰기.txt"); });
  $("asSrt").addEventListener("click", ()=>{ if(cues.length) save(new Blob(["﻿"+srt(cues)], {type:"text/plain"}), base()+".srt"); });
  $("asPrompt").addEventListener("click", async ()=>{ try{ await navigator.clipboard.writeText(PROMPT($("asText").value)); toast("회의록 정리 프롬프트를 복사했습니다. 챗GPT·클로드에 붙여 넣으세요"); }catch(_){ toast("복사하지 못했습니다"); } });
}
if(!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && !(navigator.deviceMemory && navigator.deviceMemory < 4)) document.querySelector("input[name=asModel][value=best]").checked = true;
if(location.hash.startsWith("#bot")) window.__as = {cues:()=>cues, setCues:c=>{ cues = c; show(); }, split, dur:()=>dur, busy:()=>busy, srt};
draw();
})();

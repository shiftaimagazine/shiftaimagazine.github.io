// SHIFT AI 무료 도구 — PDF 서명·도장 넣기. 쪽 미리 보기는 /lib/pdfjs/(PDF.js, Apache-2.0), 저장은 /lib/pdf-lib/(pdf-lib, MIT).
// 서명·도장·글자는 모두 이 브라우저의 캔버스로 그려 투명 PNG 로 만들고, 원래 PDF 쪽 위에 그림으로 얹는다(원래 글자·화질은 그대로).
// 파일과 서명은 어디에도 보내지 않고, 저장하지도 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("psDrop")) return;
const LIB = "/lib/pdf-lib/pdf-lib.min.js";
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다. 새로 고침해 주세요.")); document.head.appendChild(s); });
const pick = n=>document.querySelector(`input[name=${n}]:checked`).value;
const RED = "#c8102e", MM = 72/25.4;
let pdf = null, pdfBuf = null, pdfName = "", pages = [], stamps = [], active = null, items = [], sel = null, busy = false, uid = 0;
// pages: {n, w, h(표시 크기, pt), rot, el}  stamps: {id, kind, url, w, h(px), mm(기본 너비)}  items: {id, sid, p(쪽 번호), x, y, w, h(쪽 비율 0~1)}

// ---------- 그림 다듬기 ----------
function trim(c, pad){   // 투명한 가장자리를 잘라 낸 새 캔버스
  const x = c.getContext("2d"), {width:W, height:H} = c, d = x.getImageData(0,0,W,H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for(let y=0;y<H;y++) for(let i=0;i<W;i++) if(d[(y*W+i)*4+3]>8){ if(i<x0) x0=i; if(i>x1) x1=i; if(y<y0) y0=y; if(y>y1) y1=y; }
  if(x1<0) return null;
  pad = pad||0; x0 = Math.max(0,x0-pad); y0 = Math.max(0,y0-pad); x1 = Math.min(W-1,x1+pad); y1 = Math.min(H-1,y1+pad);
  const o = document.createElement("canvas"); o.width = x1-x0+1; o.height = y1-y0+1; o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
function addStamp(c, kind, mm){
  const t = trim(c, 4); if(!t){ toast("그린 것이 없습니다"); return; }
  const s = {id:++uid, kind, url:t.toDataURL("image/png"), w:t.width, h:t.height, mm};
  stamps.push(s); active = s.id; tray();
  toast(pdf ? "담았습니다. 아래 PDF 쪽에서 넣을 자리를 누르세요" : "담았습니다. 이제 PDF를 넣고 자리를 고르세요");
}
function tray(){
  $("psTrayW").hidden = !stamps.length;
  $("psTray").innerHTML = stamps.map(s=>`<div class="pstk${s.id===active?" on":""}"><button type="button" data-s="${s.id}" aria-pressed="${s.id===active}" aria-label="${s.kind} 고르기"><img src="${s.url}" alt=""><span>${esc(s.kind)}</span></button><button type="button" class="psdel" data-sd="${s.id}" aria-label="${s.kind} 지우기">✕</button></div>`).join("");
  hint();
}
function hint(){
  $("psHint").textContent = !pdf ? "PDF를 넣고 서명·도장을 담으면 쪽을 눌러 넣을 수 있습니다." : !stamps.length ? "먼저 2번에서 서명이나 도장을 담으세요." : !active ? "2번에서 넣을 것을 고르세요." : items.length ? `${items.length}개를 넣었습니다. 쪽을 누르면 고른 것을 하나 더 넣습니다.` : "넣을 자리를 누르세요.";
  $("psGo").disabled = busy || !pdf || !items.length;
}

// ---------- 서명 그리기 ----------
const pad = $("psPad"), px = pad.getContext("2d"); let strokes = [], cur = null;
function padSize(){
  const r = pad.getBoundingClientRect(), dpr = Math.max(2, window.devicePixelRatio||1);
  if(!r.width) return;
  pad.width = Math.round(r.width*dpr); pad.height = Math.round(r.height*dpr); redraw();
}
function seg(ctx, pts, w, color, sc){
  if(!pts.length) return;
  ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = w*sc; ctx.lineCap = ctx.lineJoin = "round";
  if(pts.length<3){ ctx.beginPath(); ctx.arc(pts[0][0]*sc, pts[0][1]*sc, w*sc/2, 0, Math.PI*2); ctx.fill(); if(pts.length<2) return; }
  ctx.beginPath(); ctx.moveTo(pts[0][0]*sc, pts[0][1]*sc);
  for(let i=1;i<pts.length-1;i++){ const mx = (pts[i][0]+pts[i+1][0])/2, my = (pts[i][1]+pts[i+1][1])/2; ctx.quadraticCurveTo(pts[i][0]*sc, pts[i][1]*sc, mx*sc, my*sc); }
  const l = pts[pts.length-1]; ctx.lineTo(l[0]*sc, l[1]*sc); ctx.stroke();
}
function redraw(){
  const r = pad.getBoundingClientRect(), sc = pad.width / (r.width||1);
  px.clearRect(0,0,pad.width,pad.height); strokes.forEach(s=>seg(px, s.p, s.w, s.c, sc));
  $("psPadPh").hidden = strokes.length>0;
}
const at = e=>{ const r = pad.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
pad.addEventListener("pointerdown", e=>{ e.preventDefault(); pad.setPointerCapture(e.pointerId); cur = {p:[at(e)], w:+pick("psPen"), c:pick("psInk")}; strokes.push(cur); redraw(); });
pad.addEventListener("pointermove", e=>{ if(!cur) return; e.preventDefault(); const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; evs.forEach(v=>cur.p.push(at(v))); redraw(); });
const endStroke = ()=>{ cur = null; };
pad.addEventListener("pointerup", endStroke); pad.addEventListener("pointercancel", endStroke);
$("psPadUndo").addEventListener("click", ()=>{ strokes.pop(); redraw(); });
$("psPadClear").addEventListener("click", ()=>{ strokes = []; redraw(); });
$("psPadUse").addEventListener("click", ()=>{
  if(!strokes.length){ toast("서명 칸에 먼저 그려 주세요"); return; }
  const r = pad.getBoundingClientRect(), sc = 3, c = document.createElement("canvas"); c.width = Math.round(r.width*sc); c.height = Math.round(r.height*sc);
  strokes.forEach(s=>seg(c.getContext("2d"), s.p, s.w, s.c, sc));
  addStamp(c, "서명", 45);
});
new ResizeObserver(padSize).observe(pad);

// ---------- 이름 도장 ----------
let fontReady = null;
const loadFont = ()=> fontReady = fontReady || (document.fonts && document.fonts.load ? document.fonts.load('800 100px "Noto Sans KR"', "가나다").catch(()=>{}) : Promise.resolve());
function rng(seed){ return ()=>{ seed = (seed*16807) % 2147483647; return (seed-1)/2147483646; }; }
function drawSeal(c, name, shape, inju){
  const x = c.getContext("2d"), S = c.width, m = S*0.06, lw = S*0.045;
  x.clearRect(0,0,S,S); x.fillStyle = x.strokeStyle = RED; x.lineWidth = lw;
  if(shape==="circle"){ x.beginPath(); x.arc(S/2, S/2, S/2 - m - lw/2, 0, Math.PI*2); x.stroke(); }
  else { const r = S*0.05, a = m + lw/2, b = S - m - lw/2; x.beginPath(); x.moveTo(a+r,a); x.arcTo(b,a,b,b,r); x.arcTo(b,b,a,b,r); x.arcTo(a,b,a,a,r); x.arcTo(a,a,b,a,r); x.closePath(); x.stroke(); }
  const ch = Array.from(name.replace(/\s+/g,"")).slice(0,6);
  if(ch.length){
    const R0 = S/2 - m - lw, sq = shape==="circle" ? R0*Math.SQRT2*0.92 : S - 2*(m+lw)*1.25;
    const cols = ch.length>=4 ? 2 : 1, rows = Math.ceil(ch.length/cols);
    // 한 줄로 세우는 이름(2~3글자)은 원 안의 세로 길이를 더 쓴다
    const inner = cols===1 && rows>1 ? (shape==="circle" ? R0*2*0.8 : sq*1.05) : sq;
    const cell = Math.min(inner/rows, (cols===1 ? sq*0.9 : inner/cols)), fs = cell*0.94;
    x.font = `800 ${fs}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
    const colW = inner/cols, top = S/2 - rows*cell/2;
    ch.forEach((t,i)=>{
      const col = Math.floor(i/rows), row = i%rows;   // 오른쪽 줄부터 위 → 아래
      const cx = cols===1 ? S/2 : S/2 + inner/2 - colW*(col+0.5), cy = top + cell*(row+0.5);
      x.save(); x.translate(cx, cy); if(cols===1 && rows>1) x.scale(Math.min(1.45, sq*0.62/fs), 1); x.fillText(t, 0, fs*0.04); x.restore();
    });
  }
  if(inju){   // 인주 느낌: 작은 점을 군데군데 지운다(늘 같은 모양이 나오게 이름으로 씨앗을 정함)
    let seed = 7; for(const t of name) seed = (seed*31 + t.charCodeAt(0)) % 2147483647; const R = rng(seed || 7);
    x.save(); x.globalCompositeOperation = "destination-out";
    for(let i=0;i<S*0.9;i++){ const r = R()*S*0.012 + S*0.002; x.globalAlpha = 0.35 + R()*0.6; x.beginPath(); x.arc(R()*S, R()*S, r, 0, Math.PI*2); x.fill(); }
    x.restore();
  }
}
function sealPrev(){ loadFont().then(()=>drawSeal($("psSealC"), $("psName").value.trim() || "이름", pick("psShape"), $("psInju").checked)); }
$("psName").addEventListener("input", sealPrev);
document.querySelectorAll("input[name=psShape]").forEach(r=>r.addEventListener("change", sealPrev));
$("psInju").addEventListener("change", sealPrev);
$("psSealUse").addEventListener("click", async ()=>{
  const n = $("psName").value.trim(); if(!n){ toast("도장에 넣을 이름을 적어 주세요"); $("psName").focus(); return; }
  await loadFont(); const c = document.createElement("canvas"); c.width = c.height = 720; drawSeal(c, n, pick("psShape"), $("psInju").checked);
  addStamp(c, "도장", Array.from(n).length>=4 ? 21 : 18);
});

// ---------- 도장·서명 사진 ----------
let photo = null;
function cutBg(){
  const c = $("psImgC"), x = c.getContext("2d");
  if(!photo){ x.clearRect(0,0,c.width,c.height); return; }
  const k = Math.min(1, 1200/Math.max(photo.width, photo.height)); c.width = Math.max(1,Math.round(photo.width*k)); c.height = Math.max(1,Math.round(photo.height*k));
  x.clearRect(0,0,c.width,c.height); x.drawImage(photo, 0, 0, c.width, c.height);
  const how = pick("psBg"); $("psCut").disabled = how==="none"; if(how==="none") return;
  const id = x.getImageData(0,0,c.width,c.height), d = id.data, t = +$("psCut").value/100;
  for(let i=0;i<d.length;i+=4){
    const r = d[i], g = d[i+1], b = d[i+2], mx = Math.max(r,g,b), mn = Math.min(r,g,b), L = (mx+mn)/510, sat = mx ? (mx-mn)/mx : 0;
    let a;
    if(how==="white"){ a = L<=t ? 1 : L>=t+0.12 ? 0 : 1 - (L-t)/0.12; if(sat>0.35 && L<0.92) a = Math.max(a, 1); }
    else { const red = r>g*1.25 && r>b*1.15 && r>70; a = red ? Math.min(1, (r - Math.max(g,b))/ (255*(1-t)*0.6 + 1)) : 0; }
    d[i+3] = Math.round(d[i+3]*Math.max(0,Math.min(1,a)));
  }
  x.putImageData(id, 0, 0);
}
async function loadPhoto(f){
  if(!f) return;
  if(!/^image\/(png|jpe?g|webp)$/.test(f.type) && !/\.(png|jpe?g|webp)$/i.test(f.name)){ toast("JPG·PNG·WebP 사진만 넣을 수 있습니다"); return; }
  try{ photo = await createImageBitmap(f, {imageOrientation:"from-image"}); }
  catch(e){ photo = await new Promise((ok,no)=>{ const im = new Image(); im.onload = ()=>ok(im); im.onerror = no; im.src = URL.createObjectURL(f); }).catch(()=>null); }
  if(!photo){ toast("사진을 열지 못했습니다"); return; }
  cutBg(); $("psImgUse").disabled = false;
}
$("psImgFile").addEventListener("change", e=>{ loadPhoto(e.target.files[0]); e.target.value = ""; });
dropZone($("psImgDrop"), $("psImgFile"), fs=>loadPhoto(fs[0]));
document.querySelectorAll("input[name=psBg]").forEach(r=>r.addEventListener("change", cutBg));
$("psCut").addEventListener("input", cutBg);
$("psImgUse").addEventListener("click", ()=>{ if(!photo) return; const c = $("psImgC"), red = pick("psBg")==="red"; addStamp(c, red ? "도장" : "사진", red ? 18 : 40); });

// ---------- 날짜·글자 ----------
function today(f){ const d = new Date(), y = d.getFullYear(), m = d.getMonth()+1, dd = d.getDate(), p = n=>String(n).padStart(2,"0");
  return f==="dot" ? `${y}. ${m}. ${dd}.` : f==="dash" ? `${y}-${p(m)}-${p(dd)}` : `${y}년 ${m}월 ${dd}일`; }
document.querySelectorAll("[data-fmt]").forEach(b=>{ b.textContent = `오늘 날짜(${today(b.dataset.fmt)})`; b.addEventListener("click", ()=>{ $("psTxt").value = today(b.dataset.fmt); }); });
$("psTxt").value = today("ko");
$("psTextUse").addEventListener("click", async ()=>{
  const t = $("psTxt").value.trim(); if(!t){ toast("넣을 글자를 적어 주세요"); return; }
  await (document.fonts && document.fonts.load ? document.fonts.load('500 100px "Noto Sans KR"', t).catch(()=>{}) : null);
  const fs = 96, c = document.createElement("canvas"), x = c.getContext("2d"), font = `500 ${fs}px "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  x.font = font; const w = Math.ceil(x.measureText(t).width) + 24; c.width = w; c.height = Math.round(fs*1.5);
  x.font = font; x.fillStyle = pick("psTInk"); x.textBaseline = "middle"; x.fillText(t, 12, c.height/2);
  addStamp(c, "글자", Math.max(12, w/fs * 3.6));   // 글자 높이 약 3.6mm(10~11pt)
});

// ---------- 종류 탭 ----------
function kind(){ const k = pick("psKind"); [["draw","psDraw"],["seal","psSeal"],["img","psImg"],["text","psText"]].forEach(([v,id])=>$(id).hidden = v!==k); if(k==="draw") padSize(); if(k==="seal") sealPrev(); }
document.querySelectorAll("input[name=psKind]").forEach(r=>r.addEventListener("change", kind));
$("psTray").addEventListener("click", e=>{
  const d = e.target.closest("[data-sd]"); if(d){ const id = +d.dataset.sd; stamps = stamps.filter(s=>s.id!==id); const n = items.length; items = items.filter(it=>it.sid!==id); if(active===id) active = stamps.length ? stamps[stamps.length-1].id : null; tray(); if(n!==items.length) drawItems(); return; }
  const b = e.target.closest("[data-s]"); if(b){ active = +b.dataset.s; tray(); }
});

// ---------- PDF 쪽 ----------
let pdfjs = null, obs = null;
async function openPdf(f){
  if(!f) return;
  if(!/\.pdf$/i.test(f.name) && f.type!=="application/pdf"){ toast("PDF 파일만 넣을 수 있습니다"); return; }
  $("psStatus").textContent = "PDF 여는 중…";
  try{
    if(!pdfjs){ pdfjs = await import("/lib/pdfjs/pdf.min.js"); pdfjs.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.js"; }
    const buf = await f.arrayBuffer();
    const doc = await pdfjs.getDocument({data: buf.slice(0), isEvalSupported:false, cMapUrl:"/lib/pdfjs/cmaps/", cMapPacked:true}).promise;
    pdf = doc; pdfBuf = buf; pdfName = f.name.replace(/\.pdf$/i,""); items = []; sel = null; pages = [];
    if(!$("psOutName").dataset.touched) $("psOutName").value = pdfName + "-서명";
    for(let n=1;n<=doc.numPages;n++){ const pg = await doc.getPage(n), vp = pg.getViewport({scale:1}); pages.push({n, w:vp.width, h:vp.height, rot:pg.rotate, pg}); }
    $("psStatus").textContent = `${f.name} · ${doc.numPages}쪽`;
    buildPages();
  }catch(e){ pdf = null; $("psStatus").textContent = /password/i.test(e && (e.name+e.message)) ? "암호가 걸린 PDF는 열 수 없습니다." : "PDF를 열지 못했습니다. 손상된 파일일 수 있습니다."; $("psPages").innerHTML = ""; }
  hint();
}
function buildPages(){
  const box = $("psPages"); box.innerHTML = "";
  if(obs) obs.disconnect();
  obs = new IntersectionObserver(es=>es.forEach(en=>{ if(en.isIntersecting){ obs.unobserve(en.target); render(pages[+en.target.dataset.i]); } }), {rootMargin:"600px"});
  pages.forEach((p,i)=>{
    const el = document.createElement("div"); el.className = "pspage"; el.dataset.i = i; el.style.aspectRatio = `${p.w} / ${p.h}`;
    el.innerHTML = `<canvas aria-hidden="true"></canvas><div class="psitems"></div><span class="psno">${p.n} / ${pages.length}쪽</span>`;
    el.setAttribute("aria-label", `${p.n}쪽: 누르면 고른 서명을 이 자리에 넣습니다`);
    box.appendChild(el); p.el = el; obs.observe(el);
  });
}
async function render(p){
  const cv = p.el.querySelector("canvas"), W = p.el.clientWidth || 700, dpr = Math.min(2.5, Math.max(1.5, window.devicePixelRatio||1));
  const vp = p.pg.getViewport({scale: W/p.w*dpr}); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  try{ await p.pg.render({canvasContext: cv.getContext("2d"), viewport: vp}).promise; p.el.classList.add("done"); }catch(e){}
}
function stampOf(id){ return stamps.find(s=>s.id===id); }
function place(p, fx, fy){
  const s = stampOf(active); if(!s) { toast(stamps.length ? "2번에서 넣을 것을 고르세요" : "먼저 2번에서 서명이나 도장을 담으세요"); return; }
  const w = Math.min(0.9, s.mm*MM / p.w), h = w * (s.h/s.w) * (p.w/p.h);
  const it = {id:++uid, sid:s.id, p:p.n, w, h, x:Math.min(Math.max(0, fx - w/2), 1-w), y:Math.min(Math.max(0, fy - h/2), 1-h)};
  items.push(it); sel = it.id; drawItems(); hint();
  const el = document.querySelector(`.psit[data-id="${it.id}"]`); if(el) el.focus({preventScroll:true});
}
function drawItems(){
  pages.forEach(p=>{
    const box = p.el && p.el.querySelector(".psitems"); if(!box) return;
    box.innerHTML = items.filter(it=>it.p===p.n).map(it=>{ const s = stampOf(it.sid);
      return `<div class="psit${it.id===sel?" on":""}" data-id="${it.id}" tabindex="0" role="button" aria-label="${esc(s.kind)}, 화살표로 옮기고 Delete로 뺍니다" style="left:${it.x*100}%;top:${it.y*100}%;width:${it.w*100}%;height:${it.h*100}%">`
        + `<img src="${s.url}" alt="" draggable="false"><span class="psrz" aria-hidden="true"></span>`
        + (it.id===sel ? `<span class="psbar"><button type="button" data-all="${it.id}">모든 쪽에 같은 자리로</button><button type="button" data-rm="${it.id}">빼기</button></span>` : "") + `</div>`; }).join("");
  });
  hint();
}
// 쪽 누르기 = 넣기, 넣은 것 끌기 = 옮기기, 모서리 끌기 = 크기
let drag = null;
$("psPages").addEventListener("pointerdown", e=>{
  const bt = e.target.closest(".psbar button"); if(bt) return;
  const itEl = e.target.closest(".psit"), pgEl = e.target.closest(".pspage"); if(!pgEl) return;
  const p = pages[+pgEl.dataset.i], r = pgEl.getBoundingClientRect();
  if(itEl){
    e.preventDefault(); const it = items.find(x=>x.id===+itEl.dataset.id); if(!it) return;
    if(sel!==it.id){ sel = it.id; drawItems(); }
    const el = pgEl.querySelector(`.psit[data-id="${it.id}"]`); el.setPointerCapture(e.pointerId);
    drag = {it, p, r, el, sx:e.clientX, sy:e.clientY, ox:it.x, oy:it.y, ow:it.w, oh:it.h, rz: e.target.classList.contains("psrz"), moved:false};
    return;
  }
  drag = {tap:true, p, r, sx:e.clientX, sy:e.clientY};
});
$("psPages").addEventListener("pointermove", e=>{
  if(!drag || drag.tap) return; e.preventDefault();
  const d = drag, dx = (e.clientX-d.sx)/d.r.width, dy = (e.clientY-d.sy)/d.r.height; d.moved = true;
  if(d.rz){ const k = Math.max(0.02, d.ow + dx) / d.ow; let w = d.ow*k, h = d.oh*k; if(d.it.x + w > 1){ w = 1 - d.it.x; h = w*d.oh/d.ow; } if(d.it.y + h > 1){ h = 1 - d.it.y; w = h*d.ow/d.oh; } d.it.w = w; d.it.h = h; }
  else { d.it.x = Math.min(Math.max(0, d.ox+dx), 1-d.it.w); d.it.y = Math.min(Math.max(0, d.oy+dy), 1-d.it.h); }
  Object.assign(d.el.style, {left:d.it.x*100+"%", top:d.it.y*100+"%", width:d.it.w*100+"%", height:d.it.h*100+"%"});
});
const up = e=>{
  if(!drag) return; const d = drag; drag = null;
  if(d.tap){ if(Math.hypot(e.clientX-d.sx, e.clientY-d.sy) > 8) return;   // 쪽을 넘기던(스크롤) 손가락은 무시
    if(sel){ sel = null; drawItems(); }
    place(d.p, (e.clientX-d.r.left)/d.r.width, (e.clientY-d.r.top)/d.r.height); }
};
$("psPages").addEventListener("pointerup", up); $("psPages").addEventListener("pointercancel", ()=>{ drag = null; });
$("psPages").addEventListener("click", e=>{
  const a = e.target.closest("[data-all]"), rm = e.target.closest("[data-rm]");
  if(rm){ items = items.filter(x=>x.id!==+rm.dataset.rm); sel = null; drawItems(); }
  if(a){ const it = items.find(x=>x.id===+a.dataset.all); if(!it) return; let n = 0;
    pages.forEach(p=>{ if(p.n===it.p || items.some(x=>x.p===p.n && x.sid===it.sid && Math.abs(x.x-it.x)<0.01 && Math.abs(x.y-it.y)<0.01)) return;
      const s = stampOf(it.sid), w = Math.min(it.w * (pages[it.p-1].w / p.w), 0.95), h = w * (s.h/s.w) * (p.w/p.h);   // 쪽 크기가 달라도 실제 크기는 같게
      items.push({...it, id:++uid, p:p.n, w, h, x:Math.min(it.x, 1-w), y:Math.min(it.y, Math.max(0, 1-h))}); n++; });
    drawItems(); toast(n ? `${n}쪽에 같은 자리로 넣었습니다` : "이미 모든 쪽에 들어가 있습니다"); }
});
$("psPages").addEventListener("keydown", e=>{
  const el = e.target.closest(".psit"); if(!el) return; const it = items.find(x=>x.id===+el.dataset.id); if(!it) return;
  const st = e.shiftKey ? 0.02 : 0.004, mv = {ArrowLeft:[-st,0], ArrowRight:[st,0], ArrowUp:[0,-st], ArrowDown:[0,st]}[e.key];
  if(mv){ e.preventDefault(); it.x = Math.min(Math.max(0,it.x+mv[0]),1-it.w); it.y = Math.min(Math.max(0,it.y+mv[1]),1-it.h); sel = it.id; drawItems(); document.querySelector(`.psit[data-id="${it.id}"]`).focus(); }
  else if(e.key==="Delete" || e.key==="Backspace"){ e.preventDefault(); items = items.filter(x=>x!==it); sel = null; drawItems(); }
  else if(e.key==="Enter" || e.key===" "){ e.preventDefault(); sel = it.id; drawItems(); document.querySelector(`.psit[data-id="${it.id}"]`).focus(); }
});
window.addEventListener("resize", ()=>{ pages.forEach(p=>{ if(p.el && p.el.classList.contains("done")) render(p); }); });

// ---------- 저장 ----------
// 화면(돌린 쪽 그대로)의 자리 → PDF 좌표. pdf-lib drawImage 는 왼쪽 아래 꼭짓점을 기준으로 반시계 방향으로 돌린다.
function toPdf(it, cb, rot){
  const vw = (rot%180) ? cb.height : cb.width, vh = (rot%180) ? cb.width : cb.height;
  const u0 = it.x*vw, v0 = it.y*vh, W = it.w*vw, H = it.h*vh;
  if(rot===90)  return {x: cb.x + v0 + H, y: cb.y + u0, width:W, height:H, r:90};
  if(rot===180) return {x: cb.x + cb.width - u0, y: cb.y + v0 + H, width:W, height:H, r:180};
  if(rot===270) return {x: cb.x + cb.width - v0 - H, y: cb.y + cb.height - u0, width:W, height:H, r:270};
  return {x: cb.x + u0, y: cb.y + cb.height - v0 - H, width:W, height:H, r:0};
}
$("psGo").addEventListener("click", async ()=>{
  if(!pdf || !items.length || busy) return; busy = true; hint(); const btn = $("psGo"), t = btn.textContent; btn.textContent = "만드는 중…";
  try{
    const L = await script(LIB, ()=>!!window.PDFLib).then(()=>window.PDFLib);
    const doc = await L.PDFDocument.load(pdfBuf.slice(0), {ignoreEncryption:false, updateMetadata:false});
    const emb = {};
    for(const it of items){
      const s = stampOf(it.sid); if(!s) continue;
      emb[s.id] = emb[s.id] || await doc.embedPng(s.url);
      const pg = doc.getPage(it.p-1), cb = pg.getCropBox(), rot = ((pg.getRotation().angle % 360) + 360) % 360;
      const o = toPdf(it, cb, rot);
      pg.drawImage(emb[s.id], {x:o.x, y:o.y, width:o.width, height:o.height, rotate:L.degrees(o.r)});
    }
    const out = await doc.save({useObjectStreams:false});
    const a = document.createElement("a"), name = ($("psOutName").value.trim() || pdfName + "-서명").replace(/[\\/:*?"<>|]/g,"_").replace(/\.pdf$/i,"") + ".pdf";
    a.href = URL.createObjectURL(new Blob([out], {type:"application/pdf"})); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    toast("서명한 PDF를 내려받았습니다");
  }catch(e){ toast(/encrypt/i.test(String(e)) ? "암호가 걸린 PDF라 저장하지 못했습니다" : "PDF를 만들지 못했습니다: " + (e.message||e)); }
  busy = false; btn.textContent = t; hint();
});
$("psOutName").addEventListener("input", ()=>{ $("psOutName").dataset.touched = "1"; });

// ---------- 파일 넣기 ----------
function dropZone(z, inp, cb){
  z.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); inp.click(); } });
  z.addEventListener("dragover", e=>{ e.preventDefault(); z.classList.add("on"); });
  z.addEventListener("dragleave", ()=>z.classList.remove("on"));
  z.addEventListener("drop", e=>{ e.preventDefault(); z.classList.remove("on"); cb([...(e.dataTransfer.files||[])]); });
}
$("psFile").addEventListener("change", e=>{ openPdf(e.target.files[0]); e.target.value = ""; });
dropZone($("psDrop"), $("psFile"), fs=>openPdf(fs[0]));
kind(); hint();
})();

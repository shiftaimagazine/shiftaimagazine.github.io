// SHIFT AI 무료 도구 — 표 사진 → 엑셀.
// 사진 속 표의 선(가로·세로)을 찾아 칸을 나누고, 선이 없으면 글자 위치로 줄·열을 나눈다. 합친 칸은 칸 사이 선이 끊긴 곳으로 찾는다.
// 글자는 /lib/tesseract/(tesseract.js 7, Apache-2.0 · 한국어·영어 데이터)로 브라우저 안에서 읽고, .xlsx 는 /lib/jszip/(MIT)로 직접 쓴다.
// 아이폰 HEIC 는 /lib/heic-to/(LGPL-3.0)로 JPG 로 바꾼 뒤 읽는다. 사진은 서버로 보내지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("toDrop")) return;
const LIB = "/lib/tesseract/", ZIP = "/lib/jszip/jszip.min.js", HEIC = "/lib/heic-to/heic-to.js";
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200); };
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다. 새로 고침해 주세요.")); document.head.appendChild(s); });
const isHeic = f=>/heic|heif/i.test(f.type||"") || /\.hei[cf]$/i.test(f.name||"");
let src = null, busy = false, worker = null, workerLang = "", result = null;

// ---------- 사진 준비: 크기 맞추기·회색·흑백·기울기 바로잡기 ----------
async function toBitmap(file){
  if(isHeic(file)){ await script(HEIC, ()=>typeof window.HeicTo==="function"); const b = await window.HeicTo({blob:file, type:"image/jpeg", quality:0.95}); file = new File([b], "photo.jpg", {type:"image/jpeg"}); }
  return createImageBitmap(file);
}
function grayOf(c){
  const d = c.getContext("2d", {willReadFrequently:true}).getImageData(0,0,c.width,c.height).data, g = new Uint8Array(c.width*c.height);
  for(let i=0,j=0;j<g.length;i+=4,j++) g[j] = (d[i]*77 + d[i+1]*150 + d[i+2]*29)>>8;
  return g;
}
function binarize(g, W, H){   // 주변 밝기보다 확실히 어두운 점 = 1 (조명이 고르지 않은 사진도 버티게)
  const I = new Float64Array((W+1)*(H+1));
  for(let y=0;y<H;y++){ let s = 0; for(let x=0;x<W;x++){ s += g[y*W+x]; I[(y+1)*(W+1)+x+1] = I[y*(W+1)+x+1] + s; } }
  const r = Math.max(8, Math.round(Math.min(W,H)/30)), B = new Uint8Array(W*H);
  for(let y=0;y<H;y++){ const y0 = Math.max(0,y-r), y1 = Math.min(H,y+r+1);
    for(let x=0;x<W;x++){ const x0 = Math.max(0,x-r), x1 = Math.min(W,x+r+1);
      const m = (I[y1*(W+1)+x1] - I[y0*(W+1)+x1] - I[y1*(W+1)+x0] + I[y0*(W+1)+x0]) / ((y1-y0)*(x1-x0));
      const v = g[y*W+x]; B[y*W+x] = v < m*0.82 && v < 215 ? 1 : 0; } }
  return B;
}
function skew(B, W, H){   // 가로 투영이 가장 뾰족해지는 각도(도)
  const pts = []; const step = Math.max(1, Math.round(Math.sqrt(W*H/400000)));
  for(let y=0;y<H;y+=step) for(let x=0;x<W;x+=step) if(B[y*W+x]) pts.push(x, y);
  if(pts.length < 200) return 0;
  // 칸 크기를 표본 간격(step)과 같게 해야 0°에서만 점수가 부풀지 않는다
  const score = a=>{ const t = Math.tan(a*Math.PI/180), bins = new Float64Array(Math.ceil(H*2/step)+10); for(let i=0;i<pts.length;i+=2){ const yy = Math.round((pts[i+1] - pts[i]*t + H)/step); if(yy>=0 && yy<bins.length) bins[yy]++; } let s = 0; for(const v of bins) s += v*v; return s; };
  let best = 0, bs = -1;
  for(let a=-6;a<=6.001;a+=0.25){ const s = score(a); if(s>bs){ bs = s; best = a; } }
  for(let a=best-0.25;a<=best+0.25;a+=0.05){ const s = score(a); if(s>bs){ bs = s; best = a; } }
  return Math.abs(best) < 0.1 ? 0 : best;
}
async function prepare(bmp, onStep){
  let w = bmp.width, h = bmp.height, k = 1; const L = Math.max(w,h);
  if(L < 1400) k = Math.min(2.5, 2400/L); else if(L > 3600) k = 3600/L;
  let c = document.createElement("canvas"); c.width = Math.round(w*k); c.height = Math.round(h*k);
  let x = c.getContext("2d", {willReadFrequently:true}); x.fillStyle = "#fff"; x.fillRect(0,0,c.width,c.height); x.imageSmoothingQuality = "high"; x.drawImage(bmp, 0, 0, c.width, c.height);
  onStep("기울기를 재는 중…");
  let g = grayOf(c), B = binarize(g, c.width, c.height);
  const ang = skew(B, c.width, c.height);
  if(ang){
    const r = -ang*Math.PI/180, W2 = c.width, H2 = c.height, n = document.createElement("canvas"); n.width = W2; n.height = H2;
    const nx = n.getContext("2d", {willReadFrequently:true}); nx.fillStyle = "#fff"; nx.fillRect(0,0,W2,H2); nx.translate(W2/2, H2/2); nx.rotate(r); nx.drawImage(c, -W2/2, -H2/2); c = n;
    g = grayOf(c); B = binarize(g, W2, H2);
  }
  return {c, g, B, W:c.width, H:c.height, ang};
}

// ---------- 표 선 찾기 ----------
function lines(B, W, H){
  const gap = Math.max(3, Math.round(Math.min(W,H)/400));
  const scan = (len, n, at)=>{   // 줄마다 끊긴 곳을 조금 봐주며 가장 긴 검은 줄을 잰다
    const out = new Array(n);
    for(let i=0;i<n;i++){ let best = 0, bs = 0, run = 0, start = -1, miss = 0, cur = 0;
      for(let j=0;j<len;j++){ if(at(i,j)){ if(start<0){ start = j; cur = 0; } run = j; miss = 0; cur++; } else if(start>=0){ if(++miss > gap){ if(run-start > best){ best = run-start; bs = start; } start = -1; } } }
      if(start>=0 && run-start > best){ best = run-start; bs = start; }
      out[i] = [best, bs, bs+best]; }
    return out;
  };
  const group = (rows, minLen)=>{ const g = []; let cur = null;
    rows.forEach(([len,a,b],i)=>{ if(len >= minLen){ if(cur && i-cur.e <= 2){ cur.e = i; cur.a = Math.min(cur.a,a); cur.b = Math.max(cur.b,b); } else { cur = {s:i, e:i, a, b}; g.push(cur); } } });
    return g.map(o=>({p:(o.s+o.e)/2, t:o.e-o.s+1, a:o.a, b:o.b})); };
  const hr = scan(W, H, (i,j)=>B[i*W+j]), vr = scan(H, W, (i,j)=>B[j*W+i]);
  let h = group(hr, Math.max(60, W*0.18)), v = group(vr, Math.max(40, H*0.12));
  h = h.filter(l=>l.t <= Math.max(10, H/60)); v = v.filter(l=>l.t <= Math.max(10, W/60));   // 두꺼운 덩어리(사진·검은 칠)는 선이 아니다
  return {h, v};
}
function cover(B, W, x0, y0, x1, y1, horiz, band){   // 선이 지나야 할 자리에 검은 점이 얼마나 있는지(0~1)
  let hit = 0, n = 0;
  if(horiz){ for(let x=Math.round(x0);x<=x1;x+=2){ n++; for(let d=-band;d<=band;d++){ const y = Math.round(y0)+d; if(B[y*W+x]){ hit++; break; } } } }
  else { for(let y=Math.round(y0);y<=y1;y+=2){ n++; for(let d=-band;d<=band;d++){ const x = Math.round(x0)+d; if(B[y*W+x]){ hit++; break; } } } }
  return n ? hit/n : 0;
}
function gridFromLines(P, L){
  const {B, W} = P; let {h, v} = L;
  if(h.length < 2 || v.length < 2) return null;
  // 표 영역: 가로선과 세로선이 겹치는 범위
  const top = Math.min(...v.map(l=>l.a)), bot = Math.max(...v.map(l=>l.b)), left = Math.min(...h.map(l=>l.a)), right = Math.max(...h.map(l=>l.b));
  h = h.filter(l=>l.p >= top-12 && l.p <= bot+12 && l.b-l.a > (right-left)*0.3);
  v = v.filter(l=>l.p >= left-12 && l.p <= right+12 && l.b-l.a > (bot-top)*0.25);
  if(h.length < 2 || v.length < 2) return null;
  const ys = h.map(l=>l.p).sort((a,b)=>a-b), xs = v.map(l=>l.p).sort((a,b)=>a-b);
  const dedup = a=>a.filter((p,i)=>!i || p-a[i-1] > 8);
  const Y = dedup(ys), X = dedup(xs); if(Y.length<2 || X.length<2) return null;
  const R = Y.length-1, C = X.length-1, band = 3;
  // 합친 칸: 칸 사이 선이 끊긴 곳
  const par = Array.from({length:R*C},(_,i)=>i), find = i=>par[i]===i ? i : (par[i] = find(par[i])), uni = (a,b)=>{ par[find(a)] = find(b); };
  for(let r=0;r<R;r++) for(let c=1;c<C;c++){ if(cover(B, W, X[c], Y[r]+4, X[c], Y[r+1]-4, false, band) < 0.55) uni(r*C+c-1, r*C+c); }
  for(let r=1;r<R;r++) for(let c=0;c<C;c++){ if(cover(B, W, X[c]+4, Y[r], X[c+1]-4, Y[r], true, band) < 0.55) uni((r-1)*C+c, r*C+c); }
  const groups = new Map(); for(let i=0;i<R*C;i++){ const g = find(i); if(!groups.has(g)) groups.set(g, []); groups.get(g).push(i); }
  const merges = [];
  for(const cells of groups.values()) if(cells.length>1){ const rs = cells.map(i=>Math.floor(i/C)), cs = cells.map(i=>i%C); merges.push({r0:Math.min(...rs), c0:Math.min(...cs), r1:Math.max(...rs), c1:Math.max(...cs)}); }
  return {X, Y, merges, mode:"lines", hl:h, vl:v};
}
function clean(P, L){   // 글자 읽기 전에 표 선을 지운다(선을 'l'·'|' 로 읽는 것을 막음)
  const c = document.createElement("canvas"); c.width = P.W; c.height = P.H; const x = c.getContext("2d"); x.drawImage(P.c, 0, 0); x.fillStyle = "#fff";
  for(const l of L.h) x.fillRect(l.a-2, l.p - l.t/2 - 2, l.b-l.a+4, l.t+4);
  for(const l of L.v) x.fillRect(l.p - l.t/2 - 2, l.a-2, l.t+4, l.b-l.a+4);
  return c;
}

// ---------- 글자 읽기 ----------
async function getWorker(lang, log){
  if(worker && workerLang===lang) return worker;
  if(worker){ await worker.terminate(); worker = null; }
  await script(LIB+"tesseract.min.js", ()=>!!window.Tesseract);
  worker = await Tesseract.createWorker(lang.split("+"), 1, {workerPath:LIB+"worker.min.js", corePath:LIB, langPath:LIB+"lang", gzip:true, logger:log});
  workerLang = lang; return worker;
}
function wordsOf(data){
  const out = [];
  for(const b of data.blocks||[]) for(const p of b.paragraphs||[]) for(const l of p.lines||[]) for(const w of l.words||[]){
    const t = (w.text||"").trim(); if(!t || /^[|\\_—–=~`]+$/.test(t)) continue;   // 표 선 찌꺼기
    out.push({t, c:w.confidence, x0:w.bbox.x0, y0:w.bbox.y0, x1:w.bbox.x1, y1:w.bbox.y1, cx:(w.bbox.x0+w.bbox.x1)/2, cy:(w.bbox.y0+w.bbox.y1)/2, h:w.bbox.y1-w.bbox.y0}); }
  return out;
}
const median = a=>{ if(!a.length) return 0; const s = [...a].sort((x,y)=>x-y); return s[s.length>>1]; };
function gridFromText(words, rowsFromLines){   // 선이 없거나 모자라면 글자 자리로 줄·열을 나눈다
  words = words.filter(w=>w.c>=40 && /[\p{L}\p{N}]/u.test(w.t));   // 잡티·기호만 있는 낱말은 줄·열을 나누는 데 쓰지 않는다
  if(!words.length) return null;
  const mh = median(words.map(w=>w.h)) || 20;
  let Y;
  if(rowsFromLines) Y = rowsFromLines;
  else { const ws = [...words].sort((a,b)=>a.cy-b.cy), rows = [];
    for(const w of ws){ const r = rows[rows.length-1]; if(r && Math.abs(w.cy - r.cy) < mh*0.6){ r.ws.push(w); r.cy = r.ws.reduce((s,x)=>s+x.cy,0)/r.ws.length; r.y0 = Math.min(r.y0,w.y0); r.y1 = Math.max(r.y1,w.y1); } else rows.push({cy:w.cy, ws:[w], y0:w.y0, y1:w.y1}); }
    Y = [rows[0].y0 - 2]; for(let i=1;i<rows.length;i++) Y.push((rows[i-1].y1 + rows[i].y0)/2); Y.push(rows[rows.length-1].y1 + 2); }
  // 열: 줄마다 글자가 덮는 자리를 세고, 거의 모든 줄이 비어 있는 세로 띠를 열 경계로 삼는다(제목처럼 한두 줄만 걸쳐도 나눔)
  const R = Y.length-1, x0 = Math.min(...words.map(w=>w.x0)), x1 = Math.max(...words.map(w=>w.x1)), n = Math.ceil(x1-x0)+2, cnt = new Uint16Array(n);
  for(let r=0;r<R;r++){ const mark = new Uint8Array(n); for(const w of words) if(w.cy>=Y[r] && w.cy<Y[r+1]) for(let x=Math.floor(w.x0-x0);x<=Math.ceil(w.x1-x0) && x<n;x++) mark[Math.max(0,x)] = 1; for(let x=0;x<n;x++) cnt[x] += mark[x]; }
  const thr = Math.floor(R*0.15), gapMin = mh*0.6, X = [x0-2];
  let g0 = -1;
  for(let x=0;x<=n;x++){ const empty = x<n && cnt[x] <= thr;
    if(empty && g0<0) g0 = x;
    if(!empty && g0>=0){ if(x-g0 >= gapMin && g0>0) X.push(x0 + (g0+x)/2); g0 = -1; } }
  X.push(x1+2);
  return {X, Y, merges:[], mode: rowsFromLines ? "rows" : "text"};
}
function place(words, G){
  const R = G.Y.length-1, C = G.X.length-1, cells = Array.from({length:R},()=>Array.from({length:C},()=>({ws:[]})));
  const find = (a, v)=>{ for(let i=0;i<a.length-1;i++) if(v>=a[i] && v<a[i+1]) return i; return -1; };
  const owner = new Map(); G.merges.forEach(m=>{ for(let r=m.r0;r<=m.r1;r++) for(let c=m.c0;c<=m.c1;c++) owner.set(r*C+c, m); });
  for(const w of words){ let r = find(G.Y, w.cy), c = find(G.X, w.cx); if(r<0 || c<0) continue;
    const m = owner.get(r*C+c); if(m){ r = m.r0; c = m.c0; } cells[r][c].ws.push(w); }
  const mh = median(words.map(w=>w.h)) || 20;
  return cells.map(row=>row.map(cell=>join(cell.ws, mh)));
}
function join(ws, mh){   // 같은 줄은 가까우면 붙이고(한글 낱자) 멀면 띄우고, 다른 줄은 줄바꿈
  ws = [...ws].sort((a,b)=>Math.abs(a.cy-b.cy) < mh*0.5 ? a.x0-b.x0 : a.cy-b.cy);
  let t = "", prev = null;
  for(const w of ws){ if(prev){ if(Math.abs(w.cy-prev.cy) >= mh*0.5) t += "\n"; else if(w.x0 - prev.x1 > Math.min(w.h, prev.h)*0.22) t += " "; } t += w.t; prev = w; }
  return {t: fixText(t), c: ws.length ? Math.min(...ws.map(w=>w.c)) : 100, n: ws.length};
}
function ink(B, W, x0, y0, x1, y1){ let n = 0, k = 0; for(let y=Math.round(y0);y<y1;y+=2) for(let x=Math.round(x0);x<x1;x+=2){ k++; if(B[y*W+x]) n++; } return k ? n/k : 0; }
function fixText(t){
  t = t.replace(/ㆍ/g,"·").replace(/\s+([,.%)])/g,"$1").trim();
  // 숫자 칸에서 자주 틀리는 글자: O→0, l·I·|→1 (나머지가 모두 숫자일 때만)
  if(/^[\d,.\-+%₩원OoIl|\s]+$/.test(t) && /\d/.test(t) && /[OoIl|]/.test(t)) t = t.replace(/[Oo]/g,"0").replace(/[Il|]/g,"1");
  if(/^[\d\s,.]+$/.test(t) && /\d\s+,?\s*\d{3}/.test(t)) t = t.replace(/(\d)\s*,\s*(\d{3})/g,"$1,$2");
  return t;
}
function toNum(s){   // '1,234' '−5.6' '₩1,000' '1,000원' '12%' → 숫자(엑셀이 계산할 수 있게). '0012' 같은 것은 글자로 둔다
  const t = s.replace(/\s/g,"").replace(/[−–]/g,"-");
  let m = t.match(/^(-?)(?:₩|\$)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(원|%)?$/);
  if(!m) return null;
  if(/^0\d/.test(m[2]) && !m[3]) return null;
  let v = parseFloat(m[1] + m[2].replace(/,/g,"") + (m[3]||""));
  if(!isFinite(v)) return null;
  return m[4]==="%" ? {v:v/100, pct:true} : {v};
}

// ---------- 전체 흐름 ----------
async function run(){
  if(busy || !src) return; busy = true; draw();
  const say = m=>{ $("toStatus").textContent = m; };
  const bar = p=>{ $("toBar").hidden = p==null; if(p!=null) $("toBar").firstElementChild.style.width = Math.round(p*100)+"%"; };
  try{
    bar(0.02); say("사진을 다듬는 중…");
    const P = await prepare(src.bmp, say); bar(0.1);
    const shape = document.querySelector("input[name=toShape]:checked").value;
    say("표 선을 찾는 중…");
    const L = shape==="text" ? {h:[], v:[]} : lines(P.B, P.W, P.H);
    let G = shape==="text" ? null : gridFromLines(P, L);
    const cv = clean(P, L);
    const lang = document.querySelector("input[name=toLang]:checked").value;
    say("글자 인식 엔진을 여는 중… (처음 한 번은 오래 걸립니다)");
    const W = await getWorker(lang, m=>{ if(m.status==="recognizing text") bar(0.2 + 0.7*(m.progress||0)); });
    await W.setParameters({tessedit_pageseg_mode: G ? "11" : "6", preserve_interword_spaces:"1"});
    say("글자를 읽는 중…"); bar(0.2);
    let rect;
    if(G){ const pad = 6; rect = {left:Math.max(0,Math.floor(G.X[0]-pad)), top:Math.max(0,Math.floor(G.Y[0]-pad))}; rect.width = Math.min(P.W, Math.ceil(G.X[G.X.length-1]+pad)) - rect.left; rect.height = Math.min(P.H, Math.ceil(G.Y[G.Y.length-1]+pad)) - rect.top; }
    const r = await W.recognize(cv, rect ? {rectangle:rect} : {}, {blocks:true, text:true});
    let words = wordsOf(r.data);
    if(!G){
      // 가로선만 있는 표(세로선 없음)는 줄은 선으로, 열은 글자 자리로
      const hl = L.h.filter(l=>l.b-l.a > P.W*0.3).map(l=>l.p).sort((a,b)=>a-b);
      G = gridFromText(words, hl.length>=3 && shape!=="text" ? hl : null);
      if(G && G.mode==="rows"){ const inside = words.filter(w=>w.cy>G.Y[0] && w.cy<G.Y[G.Y.length-1]); if(inside.length) G = gridFromText(inside, G.Y); words = inside; }
    }
    if(!G || !words.length) throw new Error("표를 찾지 못했습니다. 표가 사진 대부분을 차지하게 다시 찍거나, 표 모양을 '선이 없는 표'로 바꿔 보세요.");
    // 빈 줄·빈 열 빼기(선 사이 여백 등)
    let cells = place(words, G);
    // 2차: 비었는데 글자 자국이 있는 칸, 확신이 낮은 한 줄짜리 칸은 그 칸만 따로 다시 읽는다(한 글자·짧은 숫자를 놓치지 않게)
    { const R = G.Y.length-1, C = G.X.length-1, hid = new Set(), head = new Map(), mh = median(words.map(w=>w.h)) || 20, m0 = G.mode==="lines" ? 7 : 2, redo = [];
      G.merges.forEach(m=>{ head.set(m.r0*C+m.c0, m); for(let r=m.r0;r<=m.r1;r++) for(let c=m.c0;c<=m.c1;c++) if(r!==m.r0 || c!==m.c0) hid.add(r*C+c); });
      for(let r=0;r<R;r++) for(let c=0;c<C;c++){ if(hid.has(r*C+c)) continue; const m = head.get(r*C+c);
        const x0 = G.X[c]+m0, x1 = G.X[m ? m.c1+1 : c+1]-m0, y0 = G.Y[r]+m0, y1 = G.Y[m ? m.r1+1 : r+1]-m0; if(x1-x0 < 6 || y1-y0 < 6) continue;
        const cell = cells[r][c], one = y1-y0 < mh*2.2;
        const short = cell.t && cell.t.replace(/\s/g,"").length <= 2;
        if((!cell.t && ink(P.B, P.W, x0, y0, x1, y1) > 0.006) || (cell.t && one && (cell.c < 62 || (short && cell.c < 85)))) redo.push({r, c, x0, y0, x1, y1, one, short: !cell.t || short}); }
      if(redo.length && redo.length <= 300){
        say(`칸 ${redo.length}곳을 한 번 더 읽는 중…`);
        for(const [i, q] of redo.entries()){
          bar(0.9 + 0.09*i/redo.length);
          const rect = {left:Math.floor(q.x0), top:Math.floor(q.y0), width:Math.ceil(q.x1-q.x0), height:Math.ceil(q.y1-q.y0)};
          let best = null;
          for(const psm of q.one ? (q.short ? ["7","8","10"] : ["7","8"]) : ["6"]){
            await W.setParameters({tessedit_pageseg_mode:psm});
            const rr = await W.recognize(cv, {rectangle:rect}, {blocks:true}), ws = wordsOf(rr.data).map(w=>({...w, x0:w.x0, x1:w.x1}));
            const j = join(ws, mh); if(j.t && (!best || j.c > best.c)) best = j;
            if(best && best.c >= 80) break; }
          const cur = cells[q.r][q.c];
          if(best && best.t && (!cur.t || best.c > cur.c + 5)) cells[q.r][q.c] = best; } } }
    const keepR = cells.map(row=>row.some(c=>c.t)), keepC = cells[0].map((_,j)=>cells.some(row=>row[j].t));
    const mapR = [], mapC = []; keepR.forEach((k,i)=>{ if(k) mapR[i] = mapR.filter(x=>x!=null).length; }); keepC.forEach((k,j)=>{ if(k) mapC[j] = mapC.filter(x=>x!=null).length; });
    let merges = G.merges.map(m=>{ const rs = [...Array(m.r1-m.r0+1)].map((_,i)=>mapR[m.r0+i]).filter(x=>x!=null), cs = [...Array(m.c1-m.c0+1)].map((_,i)=>mapC[m.c0+i]).filter(x=>x!=null);
      return rs.length && cs.length ? {r0:Math.min(...rs), r1:Math.max(...rs), c0:Math.min(...cs), c1:Math.max(...cs)} : null; }).filter(m=>m && (m.r1>m.r0 || m.c1>m.c0));
    cells = cells.filter((_,i)=>keepR[i]).map(row=>row.filter((_,j)=>keepC[j]));
    // 열 성격과 맞지 않는 칸은 확인하라고 표시(한글 열인데 한글이 없음 / 숫자 열인데 숫자가 아님)
    for(let j=0;j<(cells[0]||[]).length;j++){ const body = cells.slice(1).map(r=>r[j]).filter(c=>c.t);
      if(body.length < 4) continue;
      const ko = body.filter(c=>/[가-힣]/.test(c.t)).length/body.length, nu = body.filter(c=>toNum(c.t)).length/body.length;
      body.forEach(c=>{ if((ko>=0.7 && !/[가-힣]/.test(c.t)) || (nu>=0.7 && !toNum(c.t) && !/[가-힣]/.test(c.t))) c.c = Math.min(c.c, 50); });
      // 숫자 열 대부분이 천 단위 쉼표를 쓰면, 쉼표가 빠진 칸(인식에서 흔히 빠짐)에도 붙여 맞춘다
      if(nu>=0.7 && body.filter(c=>/\d,\d{3}/.test(c.t)).length >= body.length*0.4) body.forEach(c=>{ if(/^-?\d{4,}$/.test(c.t)) c.t = c.t.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }); }
    result = {cells, merges, mode:G.mode, ang:P.ang, P, G};
    drawOverlay(P, G);
    bar(1); say("");
    show();
  }catch(e){ console.warn(e); say(e.message && /표를|글자/.test(e.message) ? e.message : "읽지 못했습니다. 다른 사진으로 해 보세요."); }
  finally{ busy = false; bar(null); draw(); }
}

// ---------- 결과 보여 주기·고치기 ----------
function show(){
  const {cells, merges} = result, hidden = new Set(), span = new Map();
  merges.forEach(m=>{ span.set(m.r0+","+m.c0, m); for(let r=m.r0;r<=m.r1;r++) for(let c=m.c0;c<=m.c1;c++) if(r!==m.r0 || c!==m.c0) hidden.add(r+","+c); });
  const low = cells.flat().filter(c=>c.t && c.c < 70).length;
  $("toTable").innerHTML = `<table><tbody>${cells.map((row,r)=>`<tr>${row.map((c,j)=>{ if(hidden.has(r+","+j)) return ""; const m = span.get(r+","+j);
    return `<td contenteditable="true" spellcheck="false" data-r="${r}" data-c="${j}"${m?` rowspan="${m.r1-m.r0+1}" colspan="${m.c1-m.c0+1}"`:""} class="${c.t && c.c<70?"low":""}${toNum(c.t)?" num":""}">${esc(c.t).replace(/\n/g,"<br>")}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
  $("toOut").hidden = false;
  $("toInfo").textContent = `${cells.length}줄 × ${cells[0].length}칸${merges.length?` · 합친 칸 ${merges.length}곳`:""} · ${result.mode==="lines" ? "표 선으로 칸을 나눴습니다" : result.mode==="rows" ? "가로선과 글자 자리로 칸을 나눴습니다" : "글자 자리로 칸을 나눴습니다"}${result.ang ? ` · ${Math.abs(result.ang).toFixed(1)}° 기울어진 사진을 바로잡았습니다` : ""}`;
  $("toLow").textContent = low ? `노란 칸 ${low}곳은 글자를 확신하지 못한 곳입니다. 사진과 비교해 눌러서 고친 뒤 받으세요.` : "칸을 눌러 바로 고칠 수 있습니다. 고친 내용 그대로 엑셀에 들어갑니다.";
  $("toOut").scrollIntoView({behavior:"smooth", block:"start"});
}
function current(){   // 화면에서 고친 내용까지 읽는다
  const {cells} = result, out = cells.map(row=>row.map(c=>c.t));
  $("toTable").querySelectorAll("td").forEach(td=>{ out[+td.dataset.r][+td.dataset.c] = td.innerText.replace(/ /g," ").replace(/\n+$/,"").trim(); });
  return out;
}
function drawOverlay(P, G){
  const c = $("toPrevC"), k = Math.min(1, 900/P.W); c.width = Math.round(P.W*k); c.height = Math.round(P.H*k);
  const x = c.getContext("2d"); x.drawImage(P.c, 0, 0, c.width, c.height); x.lineWidth = 2;
  x.strokeStyle = "rgba(220,38,38,.85)";
  for(const y of G.Y){ x.beginPath(); x.moveTo(G.X[0]*k, y*k); x.lineTo(G.X[G.X.length-1]*k, y*k); x.stroke(); }
  for(const xx of G.X){ x.beginPath(); x.moveTo(xx*k, G.Y[0]*k); x.lineTo(xx*k, G.Y[G.Y.length-1]*k); x.stroke(); }
  x.fillStyle = "rgba(37,99,235,.16)";
  G.merges.forEach(m=>x.fillRect(G.X[m.c0]*k, G.Y[m.r0]*k, (G.X[m.c1+1]-G.X[m.c0])*k, (G.Y[m.r1+1]-G.Y[m.r0])*k));
  $("toPrevT").textContent = "빨간 선 = 찾은 칸 나눔, 파란 칸 = 합친 칸";
}

// ---------- 내보내기 ----------
const xesc = s=>String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const colL = n=>{ let s = ""; n++; while(n){ const m = (n-1)%26; s = String.fromCharCode(65+m)+s; n = Math.floor((n-1)/26); } return s; };
const wide = s=>{ let n = 0; for(const ch of s) n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1; return n; };
async function xlsx(rows, merges, head, nums){
  await script(ZIP, ()=>!!window.JSZip); const z = new JSZip();
  const C = Math.max(...rows.map(r=>r.length)), widths = Array(C).fill(6);
  rows.forEach(r=>r.forEach((v,c)=>{ widths[c] = Math.max(widths[c], Math.min(50, Math.max(...String(v).split("\n").map(wide)) + 2)); }));
  // 스타일: 0 기본(테두리) · 1 머리(굵게·배경) · 2 숫자(천 단위 쉼표) · 3 퍼센트 · 4 줄바꿈
  const sd = rows.map((r,i)=>`<row r="${i+1}">${r.map((v,c)=>{ const ref = colL(c)+(i+1), hd = head && i===0, n = nums && !hd ? toNum(String(v)) : null;
      if(n) return `<c r="${ref}" s="${n.pct?3:(/,/.test(v)||Math.abs(n.v)>=1000?2:0)}"><v>${n.v}</v></c>`;
      if(!String(v)) return `<c r="${ref}" s="${hd?1:0}"/>`;
      return `<c r="${ref}" t="inlineStr" s="${hd?1:/\n/.test(v)?4:0}"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`; }).join("")}</row>`).join("");
  const mc = merges.length ? `<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${colL(m.c0)}${m.r0+1}:${colL(m.c1)}${m.r1+1}"/>`).join("")}</mergeCells>` : "";
  const pane = head && rows.length>1 ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const X = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  z.file("[Content_Types].xml", X+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  z.file("_rels/.rels", X+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file("xl/workbook.xml", X+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="표" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", X+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  const bd = `<border><left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border>`;
  z.file("xl/styles.xml", X+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${bd}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  z.file("xl/worksheets/sheet1.xml", X+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}<sheetFormatPr defaultRowHeight="16.5"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sd}</sheetData>${mc}</worksheet>`);
  return z.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression:"DEFLATE"});
}
const save = (blob, name)=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); };
const fname = ext=>((src && src.name || "표").replace(/\.[^.]+$/,"") || "표") + "-표." + ext;

// ---------- 화면 ----------
function draw(){
  $("toGo").disabled = busy || !src;
  $("toGo").textContent = busy ? "읽는 중…" : result ? "다시 읽기" : "표 읽기";
}
async function setFile(f){
  if(busy || !f) return;
  if(!/^image\//.test(f.type) && !isHeic(f)){ toast("사진 파일만 넣을 수 있습니다(JPG·PNG·WebP·HEIC)"); return; }
  try{ const bmp = await toBitmap(f); src = {bmp, name:f.name || "붙여 넣은 표"}; }catch(_){ toast("사진을 열지 못했습니다"); return; }
  result = null; $("toOut").hidden = true;
  const c = $("toPrevC"), k = Math.min(1, 900/src.bmp.width); c.width = Math.round(src.bmp.width*k); c.height = Math.round(src.bmp.height*k);
  c.getContext("2d").drawImage(src.bmp, 0, 0, c.width, c.height); $("toPrev").hidden = false; $("toPrevT").textContent = src.name;
  draw();
}
$("toFile").addEventListener("change", e=>{ setFile(e.target.files[0]); e.target.value = ""; });
const drop = $("toDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>setFile(e.dataTransfer.files[0]));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("toFile").click(); } });
document.addEventListener("paste", e=>{ if(e.target && e.target.closest && e.target.closest("#toTable")) return;
  const f = [...(e.clipboardData?.items||[])].filter(it=>it.kind==="file").map(it=>it.getAsFile()).find(Boolean); if(f){ e.preventDefault(); setFile(f); toast("붙여 넣은 사진을 넣었습니다"); } });
$("toGo").addEventListener("click", run);
$("toXlsx").addEventListener("click", async ()=>{ if(!result) return; save(await xlsx(current(), result.merges, $("toHead").checked, $("toNum").checked), fname("xlsx")); });
$("toCsv").addEventListener("click", ()=>{ if(!result) return; const q = v=>/[",\n\r]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;
  save(new Blob(["﻿" + current().map(r=>r.map(q).join(",")).join("\r\n") + "\r\n"], {type:"text/csv"}), fname("csv")); });
$("toCopy").addEventListener("click", async ()=>{ if(!result) return; const rows = current();
  const tsv = rows.map(r=>r.map(v=>/[\t\n"]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v).join("\t")).join("\n");
  try{ await navigator.clipboard.writeText(tsv); toast("표를 복사했습니다. 엑셀·구글 시트 칸에 붙여 넣으세요"); }catch(_){ toast("복사하지 못했습니다. 엑셀로 받기를 쓰세요"); } });
document.querySelectorAll("input[name=toShape],input[name=toLang]").forEach(r=>r.addEventListener("change", ()=>{ if(result) $("toGo").textContent = "이 설정으로 다시 읽기"; }));
if(location.hash==="#bot") window.__to = {current:()=>current(), result:()=>result, toNum, dbg:async ()=>{ const P = await prepare(src.bmp, ()=>{}); const L = lines(P.B, P.W, P.H); const G = gridFromLines(P, L); const c = document.createElement("canvas"); c.width = P.W; c.height = P.H; const x = c.getContext("2d"), id = x.createImageData(P.W, P.H); for(let i=0;i<P.B.length;i++){ const v = P.B[i] ? 0 : 255; id.data[i*4]=id.data[i*4+1]=id.data[i*4+2]=v; id.data[i*4+3]=255; } x.putImageData(id,0,0); x.strokeStyle="red"; L.h.forEach(l=>{ x.beginPath(); x.moveTo(l.a,l.p); x.lineTo(l.b,l.p); x.stroke(); }); x.strokeStyle="blue"; L.v.forEach(l=>{ x.beginPath(); x.moveTo(l.p,l.a); x.lineTo(l.p,l.b); x.stroke(); }); return {ang:P.ang, W:P.W, H:P.H, h:L.h.length, v:L.v.length, grid:!!G, png:c.toDataURL()}; }};
draw();
})();

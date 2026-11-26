// SHIFT AI 무료 도구 — 사진 얼굴·번호판 모자이크.
// 얼굴은 OpenCV 의 Haar 학습 데이터(/lib/haar/, Intel License)를 이 파일 안의 검출기로 돌려 찾는다(정면 + 옆얼굴, 좌우 뒤집어 한 번 더).
// 번호판은 글자 테두리가 빽빽한 가로로 긴 밝은 사각형을 찾는 방식(학습 데이터 없음)이라 '후보'로만 보여 준다.
// 찾은 칸은 끌어서 옮기고 크기를 바꾸고 지울 수 있고, 손으로 더 그릴 수 있다. 저장할 때 사진 정보(EXIF·위치)는 남지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("pmDrop")) return;
const HAAR = "/lib/haar/", ZIP = "/lib/jszip/jszip.min.js", HEIC = "/lib/heic-to/heic-to.js", MAX = 20;
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200); };
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("load")); document.head.appendChild(s); });
const isHeic = f=>/heic|heif/i.test(f.type||"") || /\.hei[cf]$/i.test(f.name||"");
const pause = ()=>new Promise(r=>setTimeout(r,0));
let photos = [], cur = -1, cas = null;

// ---------- Haar 얼굴 검출기 ----------
async function cascades(){
  if(cas) return cas;
  const get = async n=>pack(await (await fetch(HAAR+n+".json")).json());
  cas = {front: await get("frontalface_alt2"), side: await get("profileface")};
  return cas;
}
function pack(j){   // 단계·약분류기·특징을 숫자 배열로 펴서 빨리 돈다
  const nodes = [], leaves = [], cls = [], st = [];
  for(const [thr, cs] of j.s){ st.push(cls.length/3, cs.length, thr);
    for(const [ns, lv] of cs){ cls.push(nodes.length/4, leaves.length, ns.length); ns.forEach(n=>nodes.push(...n)); leaves.push(...lv); } }
  return {w:j.w, h:j.h, f:j.f, st:Float64Array.from(st), cls:Int32Array.from(cls), nodes:Float64Array.from(nodes), leaves:Float64Array.from(leaves), ns:j.s.length};
}
function integral(g, W, H){
  const I = new Float64Array((W+1)*(H+1)), Q = new Float64Array((W+1)*(H+1));
  for(let y=0;y<H;y++){ let s = 0, q = 0; const r = (y+1)*(W+1), p = y*(W+1);
    for(let x=0;x<W;x++){ const v = g[y*W+x]; s += v; q += v*v; I[r+x+1] = I[p+x+1] + s; Q[r+x+1] = Q[p+x+1] + q; } }
  return {I, Q, S:W+1};
}
async function detect(C, g, W, H, minSize, fast){
  const {I, Q, S} = integral(g, W, H), out = [];
  const nf0 = C.f.length, fs = new Int32Array(nf0+1); let nr = 0; C.f.forEach((rs,i)=>{ fs[i] = nr; nr += rs.length; }); fs[nf0] = nr;
  const cor = new Int32Array(nr*4), wt = new Float64Array(nr);
  for(let s = Math.max(1, minSize/C.w); ; s *= fast ? 1.18 : 1.12){
    const ww = Math.round(C.w*s), wh = Math.round(C.h*s); if(ww >= W || wh >= H) break;
    // 이 크기에 맞춰 특징 칸을 늘리고(적분 영상의 네 귀퉁이 자리로 미리 바꿔 둠) 무게를 창 넓이로 나눈다
    const ex = Math.round(s), ew = Math.round((C.w-2)*s), eh = Math.round((C.h-2)*s), inv = 1/(ew*eh);
    for(let i=0;i<nf0;i++){ const rs = C.f[i]; let sum0 = 0, a0 = 1;
      for(let k=0;k<rs.length;k++){ const r = rs[k], x = Math.round(r[0]*s), y = Math.round(r[1]*s), w = Math.round(r[2]*s), h = Math.round(r[3]*s), j = fs[i]+k;
        cor[j*4] = y*S+x; cor[j*4+1] = y*S+x+w; cor[j*4+2] = (y+h)*S+x; cor[j*4+3] = (y+h)*S+x+w; wt[j] = r[4]*inv;
        if(k===0) a0 = w*h; else sum0 += wt[j]*w*h; }
      wt[fs[i]] = -sum0/a0; }
    const v0 = ex*S+ex, v1 = ex*S+ex+ew, v2 = (ex+eh)*S+ex, v3 = (ex+eh)*S+ex+ew;
    const step = Math.max(2, Math.round(s*(fast ? 1.6 : 1.2))), st = C.st, cls = C.cls, nodes = C.nodes, leaves = C.leaves, ns = C.ns;
    for(let y=0;y+wh<H;y+=step){ for(let x=0;x+ww<W;x+=step){
      const o = y*S+x, m = (I[o+v3]-I[o+v1]-I[o+v2]+I[o+v0])*inv, v = (Q[o+v3]-Q[o+v1]-Q[o+v2]+Q[o+v0])*inv - m*m;
      if(v < 64) continue;   // 밝기가 거의 고른 곳(하늘·벽)은 얼굴일 수 없으니 건너뛴다
      const nf = Math.sqrt(v);
      let pass = true;
      for(let k=0;k<ns;k++){ const c0 = st[k*3], cn = st[k*3+1]; let sum = 0;
        for(let c=c0;c<c0+cn;c++){ const nb = cls[c*3], lb = cls[c*3+1]; let n = 0;
          for(;;){ const b4 = (nb+n)*4, fi = nodes[b4+2]; let val = 0;
            for(let j=fs[fi];j<fs[fi+1];j++){ const q = j*4; val += (I[o+cor[q+3]] - I[o+cor[q+1]] - I[o+cor[q+2]] + I[o+cor[q]])*wt[j]; }
            const nx = val < nodes[b4+3]*nf ? nodes[b4] : nodes[b4+1];
            if(nx <= 0){ sum += leaves[lb - nx]; break; } n = nx; } }
        if(sum < st[k*3+2]){ pass = false; break; } }
      if(pass) out.push([x, y, ww, wh]); } }
    await pause();
  }
  return out;
}
function group(rs, minN){   // OpenCV groupRectangles 와 같은 묶기(eps 0.2)
  const n = rs.length, par = [...Array(n).keys()], find = i=>par[i]===i ? i : (par[i] = find(par[i]));
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){ const a = rs[i], b = rs[j], d = 0.2*(Math.min(a[2],b[2]) + Math.min(a[3],b[3]))*0.5;
    if(Math.abs(a[0]-b[0])<=d && Math.abs(a[1]-b[1])<=d && Math.abs(a[0]+a[2]-b[0]-b[2])<=d && Math.abs(a[1]+a[3]-b[1]-b[3])<=d) par[find(i)] = find(j); }
  const g = new Map(); rs.forEach((r,i)=>{ const k = find(i); if(!g.has(k)) g.set(k, []); g.get(k).push(r); });
  const out = [];
  for(const v of g.values()) if(v.length > minN){ const a = [0,0,0,0]; v.forEach(r=>r.forEach((x,i)=>a[i] += x)); out.push(a.map(x=>x/v.length)); }
  return out.filter((r,i)=>!out.some((o,j)=>j!==i && o[2]>r[2] && r[0]>=o[0]-o[2]*0.1 && r[1]>=o[1]-o[3]*0.1 && r[0]+r[2]<=o[0]+o[2]*1.1 && r[1]+r[3]<=o[1]+o[3]*1.1));
}
const iou = (a,b)=>{ const x0 = Math.max(a.x,b.x), y0 = Math.max(a.y,b.y), x1 = Math.min(a.x+a.w,b.x+b.w), y1 = Math.min(a.y+a.h,b.y+b.h); const i = Math.max(0,x1-x0)*Math.max(0,y1-y0); return i/(a.w*a.h + b.w*b.h - i); };
function grayAt(bmp, maxSide){
  const k = Math.min(1, maxSide/Math.max(bmp.width, bmp.height)), W = Math.max(1, Math.round(bmp.width*k)), H = Math.max(1, Math.round(bmp.height*k));
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", {willReadFrequently:true}); x.drawImage(bmp, 0, 0, W, H);
  const d = x.getImageData(0,0,W,H).data, g = new Uint8Array(W*H); for(let i=0,j=0;j<g.length;i+=4,j++) g[j] = (d[i]*77 + d[i+1]*150 + d[i+2]*29)>>8;
  return {g, W, H, k};
}
async function findFaces(p){
  const C = await cascades(), {g, W, H, k} = grayAt(p.bmp, 960), minS = Math.max(20, Math.round(Math.min(W,H)/40));
  // 대비를 고르게(어두운 사진에서도 찾게): 히스토그램 평활화
  const hist = new Uint32Array(256); g.forEach(v=>hist[v]++); const cdf = new Float64Array(256); let a = 0; for(let i=0;i<256;i++){ a += hist[i]; cdf[i] = a; }
  const lo = cdf.find(v=>v>0), eq = new Uint8Array(g.length); for(let i=0;i<g.length;i++) eq[i] = Math.round((cdf[g[i]]-lo)/(g.length-lo || 1)*255);
  const flip = new Uint8Array(eq.length); for(let y=0;y<H;y++) for(let x=0;x<W;x++) flip[y*W+x] = eq[y*W+W-1-x];
  const raw = [...group(await detect(C.front, eq, W, H, minS, true), 1).map(r=>({r, kind:"front"})),
               ...group(await detect(C.side, eq, W, H, minS, true), 3).map(r=>({r, kind:"side"})),
               ...group(await detect(C.side, flip, W, H, minS, true), 3).map(r=>({r:[W-r[0]-r[2], r[1], r[2], r[3]], kind:"side"}))];
  // 컬러 사진이면 얼굴 가운데에 살색(YCbCr 범위, 피부색과 무관하게 넓게)이 조금이라도 있어야 얼굴로 본다 — 하늘·건물을 얼굴로 잡는 것을 줄임
  const color = colorful(p), boxes = [];
  for(const {r} of raw){
    if(color && skin(p, r, k) < 0.12) continue;
    const pad = 0.18, b = clip({x:(r[0]-r[2]*pad)/k, y:(r[1]-r[3]*pad*1.4)/k, w:r[2]*(1+pad*2)/k, h:r[3]*(1+pad*2.4)/k, auto:"face"}, p);
    const o = boxes.find(o=>{ const ix = Math.max(0, Math.min(o.x+o.w,b.x+b.w)-Math.max(o.x,b.x)), iy = Math.max(0, Math.min(o.y+o.h,b.y+b.h)-Math.max(o.y,b.y)); return ix*iy > 0.35*Math.min(o.w*o.h, b.w*b.h); });
    if(o){ const x0 = Math.min(o.x,b.x), y0 = Math.min(o.y,b.y); o.w = Math.max(o.x+o.w, b.x+b.w)-x0; o.h = Math.max(o.y+o.h, b.y+b.h)-y0; o.x = x0; o.y = y0; }   // 겹치면 하나로 합친다
    else boxes.push(b); }
  return boxes;
}
// ---------- 번호판 후보(학습 데이터 없이) ----------
function findPlates(p){
  const {g, W, H, k} = grayAt(p.bmp, 1200), E = new Uint8Array(W*H);
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){ const i = y*W+x, gx = Math.abs(g[i+1]-g[i-1]); E[i] = gx > 48 ? 1 : 0; }   // 글자 세로 테두리
  // 가로로 이어 붙이기(글자 사이 메우기) → 덩어리
  const r = Math.max(3, Math.round(W/150)), D = new Uint8Array(W*H);
  for(let y=0;y<H;y++){ let last = -1e9; for(let x=0;x<W;x++){ if(E[y*W+x]) last = x; if(x-last <= r) D[y*W+x] = 1; } let nxt = 1e9; for(let x=W-1;x>=0;x--){ if(E[y*W+x]) nxt = x; if(nxt-x <= r) D[y*W+x] = 1; } }
  const lab = new Int32Array(W*H), comps = []; let id = 0;
  for(let i=0;i<W*H;i++){ if(!D[i] || lab[i]) continue; id++; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0; const st = [i]; lab[i] = id;
    while(st.length){ const j = st.pop(), x = j%W, y = (j/W)|0; n++; if(x<x0) x0 = x; if(x>x1) x1 = x; if(y<y0) y0 = y; if(y>y1) y1 = y;
      for(const q of [j-1, j+1, j-W, j+W]) if(q>=0 && q<W*H && D[q] && !lab[q] && Math.abs((q%W)-x)<=1){ lab[q] = id; st.push(q); } }
    comps.push({x0, y0, x1, y1, n}); }
  const out = [];
  for(const c of comps){ const w = c.x1-c.x0+1, h = c.y1-c.y0+1, ar = w/h;
    if(ar < 2 || ar > 6.5 || h < H/80 || h > H/6 || w < W/25 || w > W*0.6) continue;
    let e = 0, dark = 0, sum = 0; for(let y=c.y0;y<=c.y1;y++) for(let x=c.x0;x<=c.x1;x++){ const v = g[y*W+x]; e += E[y*W+x]; sum += v; }
    const mean = sum/(w*h); for(let y=c.y0;y<=c.y1;y++) for(let x=c.x0;x<=c.x1;x++) if(g[y*W+x] < mean-35) dark++;
    const ed = e/(w*h), dr = dark/(w*h);
    if(ed < 0.08 || ed > 0.5 || dr < 0.08 || dr > 0.5 || mean < 90) continue;
    // 글자 덩어리에서 밝은 판 바탕이 이어지는 데까지 넓힌다(판 가장자리까지 가리게)
    let bg = 0, bn = 0; for(let y=c.y0;y<=c.y1;y++) for(let x=c.x0;x<=c.x1;x++){ const v = g[y*W+x]; if(v >= mean) { bg += v; bn++; } } bg = bn ? bg/bn : mean;
    const colOk = x=>{ if(x<0 || x>=W) return false; let s2 = 0; for(let y=c.y0;y<=c.y1;y++) s2 += g[y*W+x]; return s2/h > bg-45; };
    const rowOk = y=>{ if(y<0 || y>=H) return false; let s2 = 0; for(let x=c.x0;x<=c.x1;x++) s2 += g[y*W+x]; return s2/w > bg-45; };
    let L = c.x0, Rr = c.x1, T = c.y0, Bt = c.y1;
    while(L > c.x0 - w*0.25 && colOk(L-1)) L--; while(Rr < c.x1 + w*0.25 && colOk(Rr+1)) Rr++;
    while(T > c.y0 - h*0.6 && rowOk(T-1)) T--; while(Bt < c.y1 + h*0.6 && rowOk(Bt+1)) Bt++;
    const pw = Rr-L+1, ph = Bt-T+1;
    out.push({x:(L - pw*0.04)/k, y:(T - ph*0.12)/k, w:pw*1.08/k, h:ph*1.24/k, auto:"plate", s: ed*(1-Math.abs(ar-4.5)/6)}); }
  return out.sort((a,b)=>b.s-a.s).slice(0, 4).map(b=>clip(b, p));
}
let rgbCache = new WeakMap();
function rgbOf(p){ if(rgbCache.has(p)) return rgbCache.get(p); const k = Math.min(1, 400/Math.max(p.bmp.width, p.bmp.height)), W = Math.max(1,Math.round(p.bmp.width*k)), H = Math.max(1,Math.round(p.bmp.height*k));
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", {willReadFrequently:true}); x.drawImage(p.bmp, 0, 0, W, H); const o = {d:x.getImageData(0,0,W,H).data, W, H, k}; rgbCache.set(p, o); return o; }
function colorful(p){ const {d} = rgbOf(p); let s = 0, n = 0; for(let i=0;i<d.length;i+=16){ s += Math.max(d[i],d[i+1],d[i+2]) - Math.min(d[i],d[i+1],d[i+2]); n++; } return s/n > 12; }
function skin(p, r, k){   // r 은 검출용 축소 좌표 → 원래 좌표 → 400px 축소 좌표
  const {d, W, k:k2} = rgbOf(p), f = k2/k, x0 = Math.floor((r[0]+r[2]*0.2)*f), x1 = Math.ceil((r[0]+r[2]*0.8)*f), y0 = Math.floor((r[1]+r[3]*0.25)*f), y1 = Math.ceil((r[1]+r[3]*0.85)*f);
  let hit = 0, n = 0;
  for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++){ const i = (y*W+x)*4, R = d[i], G = d[i+1], B = d[i+2]; if(R===undefined) continue; n++;
    const cb = 128 - 0.168736*R - 0.331264*G + 0.5*B, cr = 128 + 0.5*R - 0.418688*G - 0.081312*B; if(cb>=72 && cb<=132 && cr>=130 && cr<=180) hit++; }
  return n ? hit/n : 1;
}
function clip(b, p){ const x = Math.max(0, b.x), y = Math.max(0, b.y); return {...b, x, y, w:Math.min(p.bmp.width - x, b.w - (x-b.x)), h:Math.min(p.bmp.height - y, b.h - (y-b.y))}; }

// ---------- 가리기 ----------
function cover(ctx, src, b, mode, round, strength){
  const x = Math.round(b.x), y = Math.round(b.y), w = Math.max(1, Math.round(b.w)), h = Math.max(1, Math.round(b.h));
  ctx.save(); ctx.beginPath(); if(round) ctx.ellipse(x+w/2, y+h/2, w/2, h/2, 0, 0, Math.PI*2); else ctx.rect(x, y, w, h); ctx.clip();
  if(mode==="black"){ ctx.fillStyle = "#111"; ctx.fill(); }
  else{
    // 모자이크: 긴 변을 칸 몇 개로만 남겨 줄였다가 계단 그대로 키운다(되돌릴 수 없게 크게). 흐리게: 여러 번 줄였다 키워 번지게
    const cells = mode==="pixel" ? Math.max(3, Math.round(12/strength)) : Math.max(2, Math.round(6/strength));
    const k = cells/Math.max(w,h), sw = Math.max(1, Math.round(w*k)), sh = Math.max(1, Math.round(h*k));
    const t = document.createElement("canvas"); t.width = sw; t.height = sh; const tx = t.getContext("2d"); tx.imageSmoothingQuality = "high";
    tx.drawImage(src, x, y, w, h, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = mode!=="pixel"; if(mode!=="pixel") ctx.imageSmoothingQuality = "high";
    ctx.drawImage(t, 0, 0, sw, sh, x, y, w, h);
    if(mode==="blur"){ // 한 번 더 번지게(가장자리 계단을 지운다)
      const t2 = document.createElement("canvas"); t2.width = Math.max(1,sw*2); t2.height = Math.max(1,sh*2); t2.getContext("2d").drawImage(ctx.canvas, x, y, w, h, 0, 0, t2.width, t2.height); ctx.drawImage(t2, 0, 0, t2.width, t2.height, x, y, w, h); }
  }
  ctx.restore();
}
function render(p, scale = 1){
  const c = document.createElement("canvas"); c.width = Math.round(p.bmp.width*scale); c.height = Math.round(p.bmp.height*scale);
  const x = c.getContext("2d"); x.drawImage(p.bmp, 0, 0, c.width, c.height);
  const src = document.createElement("canvas"); src.width = c.width; src.height = c.height; src.getContext("2d").drawImage(c, 0, 0);
  const mode = val("pmMode"), round = $("pmRound").checked, st = val("pmStr")==="strong" ? 2 : 1;
  p.boxes.forEach(b=>cover(x, src, {x:b.x*scale, y:b.y*scale, w:b.w*scale, h:b.h*scale}, mode, round && b.auto!=="plate", st));
  return c;
}
const val = n=>document.querySelector(`input[name=${n}]:checked`).value;

// ---------- 편집 화면 ----------
const stage = $("pmStage"), view = $("pmView");
let vs = 1;
function paint(){
  const p = photos[cur]; $("pmEdit").hidden = !p; $("pmSave").disabled = !p; if(!p){ thumbs(); return; }
  const maxW = stage.clientWidth || 600, maxH = Math.max(320, Math.min(window.innerHeight*0.72, 900));
  vs = Math.min(maxW/p.bmp.width, maxH/p.bmp.height, 1);
  const dpr = Math.min(2, window.devicePixelRatio||1), c = render(p, vs*dpr);
  view.width = c.width; view.height = c.height; view.style.width = Math.round(p.bmp.width*vs)+"px"; view.style.height = Math.round(p.bmp.height*vs)+"px";
  view.getContext("2d").drawImage(c, 0, 0);
  $("pmBoxes").style.width = view.style.width; $("pmBoxes").style.height = view.style.height;
  $("pmBoxes").innerHTML = p.boxes.map((b,i)=>`<div class="pmbox${b.auto?" auto-"+b.auto:""}" data-i="${i}" style="left:${b.x*vs}px;top:${b.y*vs}px;width:${b.w*vs}px;height:${b.h*vs}px"><button type="button" class="pmdel" data-del="${i}" aria-label="이 칸 지우기">×</button><span class="pmrs" data-rs="${i}" aria-hidden="true"></span></div>`).join("");
  const nf = p.boxes.filter(b=>b.auto==="face").length, np = p.boxes.filter(b=>b.auto==="plate").length, nm = p.boxes.length - nf - np;
  $("pmCount").textContent = p.state==="find" ? "얼굴을 찾는 중…" : `가릴 곳 ${p.boxes.length}곳${nf?` · 찾은 얼굴 ${nf}`:""}${np?` · 번호판 후보 ${np}`:""}${nm?` · 직접 그린 ${nm}`:""}`;
  thumbs();
}
function thumbs(){
  $("pmList").innerHTML = photos.map((p,i)=>`<button type="button" class="${i===cur?"on":""}" data-pick="${i}" aria-label="${esc(p.name)}"><img src="${p.url}" alt=""><span>${p.state==="find" ? "…" : p.boxes.length}</span></button>`).join("");
  $("pmList").hidden = photos.length < 2;
  $("pmZip").hidden = photos.length < 2;
}
// 끌어서 새 칸 그리기·옮기기·크기 바꾸기
let drag = null;
$("pmBoxes").addEventListener("pointerdown", e=>{
  const p = photos[cur]; if(!p) return;
  if(e.target.closest(".pmdel")) return;
  const r = $("pmBoxes").getBoundingClientRect(), px = (e.clientX - r.left)/vs, py = (e.clientY - r.top)/vs;
  const rs = e.target.closest(".pmrs"), bx = e.target.closest(".pmbox");
  if(rs){ drag = {mode:"rs", i:+rs.dataset.rs, sx:px, sy:py, b:{...p.boxes[+rs.dataset.rs]}}; }
  else if(bx){ drag = {mode:"mv", i:+bx.dataset.i, sx:px, sy:py, b:{...p.boxes[+bx.dataset.i]}}; }
  else { p.boxes.push({x:px, y:py, w:1, h:1}); drag = {mode:"new", i:p.boxes.length-1, sx:px, sy:py}; }
  $("pmBoxes").setPointerCapture(e.pointerId); e.preventDefault();
});
$("pmBoxes").addEventListener("pointermove", e=>{
  if(!drag) return; const p = photos[cur], r = $("pmBoxes").getBoundingClientRect(), px = (e.clientX - r.left)/vs, py = (e.clientY - r.top)/vs, b = p.boxes[drag.i];
  const W = p.bmp.width, H = p.bmp.height, cl = (v,a,z)=>Math.max(a, Math.min(z, v));
  if(drag.mode==="new"){ b.x = cl(Math.min(drag.sx, px),0,W); b.y = cl(Math.min(drag.sy, py),0,H); b.w = Math.min(W-b.x, Math.abs(px-drag.sx)); b.h = Math.min(H-b.y, Math.abs(py-drag.sy)); }
  else if(drag.mode==="mv"){ b.x = cl(drag.b.x + px-drag.sx, 0, W-b.w); b.y = cl(drag.b.y + py-drag.sy, 0, H-b.h); }
  else { b.w = cl(drag.b.w + px-drag.sx, 8, W-b.x); b.h = cl(drag.b.h + py-drag.sy, 8, H-b.y); }
  schedule();
});
const end = ()=>{ if(!drag) return; const p = photos[cur], b = p.boxes[drag.i]; if(drag.mode==="new" && (b.w*vs < 8 || b.h*vs < 8)) p.boxes.splice(drag.i, 1); drag = null; paint(); };
$("pmBoxes").addEventListener("pointerup", end); $("pmBoxes").addEventListener("pointercancel", end);
$("pmBoxes").addEventListener("click", e=>{ const d = e.target.closest(".pmdel"); if(!d) return; photos[cur].boxes.splice(+d.dataset.del, 1); paint(); });
let raf = 0; const schedule = ()=>{ if(raf) return; raf = requestAnimationFrame(()=>{ raf = 0; paint(); }); };

// ---------- 넣기·저장 ----------
async function add(list){
  list = [...list].filter(f=>/^image\//.test(f.type) || isHeic(f));
  if(!list.length){ toast("사진 파일만 넣을 수 있습니다"); return; }
  if(photos.length + list.length > MAX){ toast(`한 번에 ${MAX}장까지 넣을 수 있습니다`); list = list.slice(0, MAX - photos.length); }
  for(let f of list){
    try{
      if(isHeic(f)){ await script(HEIC, ()=>typeof window.HeicTo==="function"); f = new File([await window.HeicTo({blob:f, type:"image/jpeg", quality:0.95})], f.name.replace(/\.hei[cf]$/i,"")+".jpg", {type:"image/jpeg"}); }
      const bmp = await createImageBitmap(f), p = {name:f.name || "붙여 넣은 사진.png", type:f.type, bmp, boxes:[], url:URL.createObjectURL(f), state:"find"};
      photos.push(p); if(cur<0) cur = 0;
    }catch(_){ toast("열 수 없는 사진이 있습니다"); }
  }
  paint();
  for(const p of photos.filter(x=>x.state==="find")){
    try{ if($("pmAuto").checked) p.boxes.push(...await findFaces(p)); }catch(e){ console.warn(e); toast("얼굴 찾기 데이터를 받지 못했습니다. 손으로 칸을 그려 가리세요"); }
    p.state = ""; if(photos[cur]===p) paint(); else thumbs();
  }
  $("pmHint").textContent = !$("pmAuto").checked ? "가릴 곳을 사진 위에서 끌어 칸을 그리세요. 칸은 끌어서 옮기고 오른쪽 아래 모서리로 크기를 바꿉니다." : photos.some(p=>p.boxes.some(b=>b.auto)) ? "찾은 칸이 맞는지 확인하세요. 빠진 얼굴·번호판은 사진 위를 끌어 칸을 그리고, 잘못 찾은 칸은 ×로 지웁니다." : "찾은 얼굴이 없습니다. 가릴 곳을 사진 위에서 끌어 칸을 그리세요.";
}
function outType(p){ const t = $("pmFmt").value; if(t!=="same") return t; return /png/.test(p.type) ? "image/png" : /webp/.test(p.type) ? "image/webp" : "image/jpeg"; }
async function blobOf(p){ const c = render(p, 1), t = outType(p); return new Promise(ok=>c.toBlob(ok, t, 0.92)); }
const nameOf = (p, t)=>p.name.replace(/\.[^.]+$/,"") + "-가림." + (/png/.test(t) ? "png" : /webp/.test(t) ? "webp" : "jpg");
const save = (b, n)=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = n; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); };
$("pmSave").addEventListener("click", async ()=>{ const p = photos[cur]; if(!p) return; if(!p.boxes.length && !confirmNo()) return; save(await blobOf(p), nameOf(p, outType(p))); });
$("pmZip").addEventListener("click", async ()=>{ await script(ZIP, ()=>!!window.JSZip); const z = new JSZip(), used = new Set();
  for(const p of photos){ const t = outType(p); let n = nameOf(p, t), k = 2; while(used.has(n)) n = n.replace(/(\.\w+)$/, `-${k++}$1`); used.add(n); z.file(n, await blobOf(p)); }
  save(await z.generateAsync({type:"blob"}), "모자이크-사진.zip"); });
$("pmPlate").addEventListener("click", ()=>{ const p = photos[cur]; if(!p) return; const got = findPlates(p).filter(b=>!p.boxes.some(o=>iou(o,b)>0.2)); p.boxes.push(...got); paint();
  toast(got.length ? `번호판 후보 ${got.length}곳을 더했습니다. 번호판이 아닌 칸은 지우세요` : "번호판 후보를 찾지 못했습니다. 손으로 칸을 그려 주세요"); });
$("pmClear").addEventListener("click", ()=>{ const p = photos[cur]; if(p){ p.boxes = []; paint(); } });
$("pmRemove").addEventListener("click", ()=>{ if(cur<0) return; URL.revokeObjectURL(photos[cur].url); photos.splice(cur,1); cur = Math.min(cur, photos.length-1); paint(); thumbs(); });
$("pmList").addEventListener("click", e=>{ const b = e.target.closest("[data-pick]"); if(b){ cur = +b.dataset.pick; paint(); } });
$("pmFile").addEventListener("change", e=>{ add(e.target.files); e.target.value = ""; });
const drop = $("pmDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>add(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("pmFile").click(); } });
document.addEventListener("paste", e=>{ const f = [...(e.clipboardData?.items||[])].filter(it=>it.kind==="file").map(it=>it.getAsFile()).filter(Boolean); if(f.length){ e.preventDefault(); add(f); } });
document.querySelectorAll("input[name=pmMode],input[name=pmStr]").forEach(r=>r.addEventListener("change", paint));
$("pmRound").addEventListener("change", paint);
window.addEventListener("resize", ()=>{ if(cur>=0) schedule(); });
if(location.hash==="#bot") window.__pm = {photos:()=>photos, findFaces, findPlates, render, detect, cascades, grayAt};
$("pmSave").disabled = true;
})();

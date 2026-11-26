// SHIFT AI 무료 도구 — PDF 용량 줄이기.
// ① 글자 살리기: /lib/pdf-lib/(pdf-lib 1.17.1, MIT)로 PDF 안의 사진만 '쪽에 보이는 크기'에 맞춰 줄이고 JPEG 로 다시 압축한다. 글자·표·링크·책갈피는 그대로.
//    쪽 내용(content stream)을 읽어 사진이 몇 pt 크기로 놓였는지 재고, 못 재면 가장 큰 쪽 크기를 기준으로 줄인다(덜 줄이는 쪽으로).
// ② 쪽을 그림으로: /lib/pdfjs/(PDF.js, Apache-2.0)로 쪽마다 그림을 그려 새 PDF 로 만든다(스캔본용, 글자 선택은 안 됨).
// 파일은 이 브라우저 안에서만 처리한다. 여러 파일은 /lib/jszip/(MIT)로 묶어 받는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("pcDrop")) return;
const LIB = "/lib/pdf-lib/pdf-lib.min.js", ZIP = "/lib/jszip/jszip.min.js", MAXF = 20;
// 단계(위에서 아래로 더 많이 줄임). 목표 용량을 고르면 고른 단계부터 내려가며 맞춘다.
const LADDER = {
  keep: [{dpi:220,q:.85},{dpi:150,q:.72},{dpi:120,q:.62},{dpi:96,q:.52},{dpi:80,q:.45},{dpi:72,q:.38}],
  page: [{dpi:150,q:.8},{dpi:120,q:.68},{dpi:100,q:.58},{dpi:90,q:.5},{dpi:80,q:.44},{dpi:72,q:.38}]
};
const START = {hi:0, mid:1, low:3};
const LOCKED = "암호가 걸린 PDF라 열 수 없습니다. PDF 프로그램에서 암호를 푼 사본을 만든 뒤 넣어 주세요.";
const STOP = "멈췄습니다.";
let files = [], busy = false, stop = false, pdfjs = null, view = null;
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const mb = n=>n>=1048576 ? (n/1048576).toFixed(n>=104857600?0:1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다. 새로 고침해 주세요.")); document.head.appendChild(s); });
const lib = ()=>script(LIB, ()=>!!window.PDFLib).then(()=>window.PDFLib);
const pj = async ()=>{ if(!pdfjs){ pdfjs = await import("/lib/pdfjs/pdf.min.js"); pdfjs.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.js"; } return pdfjs; };
const openPdf = async b=>(await pj()).getDocument({data: b.slice(0), cMapUrl:"/lib/pdfjs/cmaps/", cMapPacked:true, isEvalSupported:false}).promise;
const val = n=>document.querySelector(`input[name=${n}]:checked`).value;
const pause = ()=>new Promise(r=>setTimeout(r,0));
const base = n=>(n||"문서").replace(/\.pdf$/i,"").replace(/[\\/:*?"<>|]/g,"_");

// ---------- 바이트 풀기(Flate·ASCII85·ASCIIHex·PNG 예측) ----------
async function inflate(u8){
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function a85(b){
  const out = new Uint8Array(Math.ceil(b.length*4/5)+4); let o = 0, t = 0, n = 0, i = 0;
  if(b[0]===60 && b[1]===126) i = 2;   // <~
  for(; i<b.length; i++){ const c = b[i];
    if(c===126) break; if(c<=32) continue;
    if(c===122 && n===0){ out[o++]=0; out[o++]=0; out[o++]=0; out[o++]=0; continue; }
    if(c<33 || c>117) throw new Error("a85");
    t = t*85 + (c-33); if(++n===5){ out[o++]=t>>>24&255; out[o++]=t>>>16&255; out[o++]=t>>>8&255; out[o++]=t&255; t=0; n=0; } }
  if(n>1){ for(let k=n;k<5;k++) t = t*85+84; const q=[t>>>24&255,t>>>16&255,t>>>8&255,t&255]; for(let k=0;k<n-1;k++) out[o++]=q[k]; }
  return out.subarray(0,o);
}
function ahx(b){
  const out = new Uint8Array(b.length>>1); let o = 0, hi = -1;
  for(const c of b){ if(c===62) break; const v = c>=48&&c<=57 ? c-48 : c>=65&&c<=70 ? c-55 : c>=97&&c<=102 ? c-87 : -1; if(v<0) continue;
    if(hi<0) hi = v; else { out[o++] = hi*16+v; hi = -1; } }
  if(hi>=0) out[o++] = hi*16;
  return out.subarray(0,o);
}
function unpredict(raw, P, colors, cols){
  if(!P || P===1) return raw;
  const row = cols*colors;
  if(P===2){ const out = raw.slice(); for(let r=0;r*row<out.length;r++) for(let i=r*row+colors;i<Math.min((r+1)*row,out.length);i++) out[i] = out[i]+out[i-colors]&255; return out; }
  const rows = Math.floor(raw.length/(row+1)), out = new Uint8Array(rows*row);
  for(let r=0;r<rows;r++){ const ft = raw[r*(row+1)], s = r*(row+1)+1, d = r*row, p = d-row;
    for(let i=0;i<row;i++){ const x = raw[s+i], a = i>=colors ? out[d+i-colors] : 0, b = r ? out[p+i] : 0, c = r && i>=colors ? out[p+i-colors] : 0; let v;
      if(ft===0) v = x; else if(ft===1) v = x+a; else if(ft===2) v = x+b; else if(ft===3) v = x+((a+b)>>1);
      else if(ft===4){ const pp = a+b-c, pa = Math.abs(pp-a), pb = Math.abs(pp-b), pc = Math.abs(pp-c); v = x+(pa<=pb&&pa<=pc ? a : pb<=pc ? b : c); }
      else throw new Error("predictor");
      out[d+i] = v&255; } }
  return out;
}
// ---------- 그림 줄이기 ----------
const canvasOf = (w,h)=>{ if(typeof OffscreenCanvas!=="undefined"){ try{ return new OffscreenCanvas(w,h); }catch(_){} } const c = document.createElement("canvas"); c.width=w; c.height=h; return c; };
function shrink(src, tw, th, gray){
  let cur = src, cw = src.width, ch = src.height;
  while(cw/2 >= tw && ch/2 >= th){   // 반씩 줄여 계단 무늬·물결 무늬를 막는다
    const c = canvasOf(Math.ceil(cw/2), Math.ceil(ch/2)), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(cur,0,0,c.width,c.height);
    if(cur!==src){ cur.width = cur.height = 0; } cur = c; cw = c.width; ch = c.height; }
  const c = canvasOf(tw,th), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.fillStyle = "#fff"; x.fillRect(0,0,tw,th); x.drawImage(cur,0,0,tw,th);
  if(cur!==src){ cur.width = cur.height = 0; }
  if(gray) toGray(c);
  return c;
}
function toGray(c){
  const x = c.getContext("2d"), d = x.getImageData(0,0,c.width,c.height), p = d.data;
  for(let i=0;i<p.length;i+=4){ const y = (p[i]*77 + p[i+1]*150 + p[i+2]*29)>>8; p[i]=p[i+1]=p[i+2]=y; }
  x.putImageData(d,0,0);
}
async function jpeg(c, q){
  const b = c.convertToBlob ? await c.convertToBlob({type:"image/jpeg", quality:q}) : await new Promise(ok=>c.toBlob(ok,"image/jpeg",q));
  if(!b || b.type!=="image/jpeg") throw new Error("jpeg");
  return new Uint8Array(await b.arrayBuffer());
}

// ---------- 사진이 쪽에 몇 pt 로 놓였는지 재기 ----------
const WS = new Uint8Array(256); [0,9,10,12,13,32].forEach(c=>WS[c]=1);
const DL = new Uint8Array(256); [40,41,60,62,91,93,123,125,47,37].forEach(c=>DL[c]=1);
const TS = {}, TO = {}, TC = {};   // 글자열·여는 괄호·닫는 괄호 표시(숫자 0·1·2 와 헷갈리지 않게 객체로)
function* tokens(b){
  const n = b.length; let i = 0;
  while(i<n){ const c = b[i];
    if(WS[c]){ i++; continue; }
    if(c===37){ while(i<n && b[i]!==10 && b[i]!==13) i++; continue; }
    if(c===40){ let d = 1; i++; while(i<n && d>0){ const k = b[i]; if(k===92){ i+=2; continue; } if(k===40) d++; else if(k===41) d--; i++; } yield TS; continue; }
    if(c===60){ if(b[i+1]===60){ i+=2; yield TO; continue; } i++; while(i<n && b[i]!==62) i++; i++; yield TS; continue; }
    if(c===62){ i += b[i+1]===62 ? 2 : 1; yield TC; continue; }
    if(c===91){ i++; yield TO; continue; } if(c===93){ i++; yield TC; continue; }
    if(c===123||c===125||c===41){ i++; continue; }
    if(c===47){ let j = i+1; while(j<n && !WS[b[j]] && !DL[b[j]]) j++; let s = ""; for(let k=i+1;k<j;k++) s += String.fromCharCode(b[k]); i = j;
      yield {n: s.replace(/#([0-9a-fA-F]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)))}; continue; }
    let j = i; while(j<n && !WS[b[j]] && !DL[b[j]]) j++;
    let s = ""; for(let k=i;k<j;k++) s += String.fromCharCode(b[k]); i = j;
    const v = +s;
    if(s!=="" && !isNaN(v) && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)){ yield v; continue; }
    if(s==="ID"){   // 쪽 안에 박힌 작은 그림(BI … ID 데이터 EI)은 건너뛴다
      i++; while(i<n-1){ if(b[i]===69 && b[i+1]===73 && WS[b[i-1]] && (i+2>=n || WS[b[i+2]] || DL[b[i+2]])){ i+=2; break; } i++; }
      yield {o:"EI"}; continue; }
    yield {o:s};
  }
}
const mul = (m,c)=>[m[0]*c[0]+m[1]*c[2], m[0]*c[1]+m[1]*c[3], m[2]*c[0]+m[3]*c[2], m[2]*c[1]+m[3]*c[3], m[4]*c[0]+m[5]*c[2]+c[4], m[4]*c[1]+m[5]*c[3]+c[5]];
function measureTools(L, ctx){
  const N = s=>L.PDFName.of(s), map = new Map(), cap = new Set();
  const isImg = o=>o instanceof L.PDFStream && o.dict.get(N("Subtype"))===N("Image");
  const isForm = o=>o instanceof L.PDFStream && o.dict.get(N("Subtype"))===N("Form");
  const numArr = a=>a instanceof L.PDFArray ? a.asArray().map(x=>{ const v = ctx.lookup(x); return v && v.asNumber ? v.asNumber() : 0; }) : null;
  async function bytesOf(s){
    if(!(s instanceof L.PDFStream)) return new Uint8Array(0);
    if(!(s instanceof L.PDFRawStream)) return s.getContents ? s.getContents() : new Uint8Array(0);
    const f = s.dict.lookup(N("Filter")), fl = f instanceof L.PDFArray ? f.asArray().map(x=>String(ctx.lookup(x))) : f ? [String(f)] : [];
    let d = s.contents;
    for(const x of fl){ if(x==="/FlateDecode"||x==="/Fl") d = await inflate(d); else if(x==="/ASCII85Decode"||x==="/A85") d = a85(d); else if(x==="/ASCIIHexDecode"||x==="/AHx") d = ahx(d); else throw new Error("filter "+x); }
    const dp = s.dict.lookup(N("DecodeParms"));
    if(dp instanceof L.PDFDict){ const pr = dp.lookup(N("Predictor")); if(pr && pr.asNumber() > 1) throw new Error("predictor"); }
    return d;
  }
  // 주석·무늬·투명도·글꼴 안에 든 그림은 크기를 못 재므로 '쪽 크기 기준'으로만 줄인다
  function capFrom(o, seen = new Set()){
    const st = [o];
    while(st.length){ let x = st.pop(); if(!x) continue;
      if(x instanceof L.PDFRef){ const k = x.toString(); if(seen.has(k)) continue; seen.add(k); const t = ctx.lookup(x); if(isImg(t)) cap.add(k); x = t; if(!x) continue; }
      if(x instanceof L.PDFStream) x = x.dict;
      if(x instanceof L.PDFDict){ for(const [k,v] of x.entries()){ const s = k.toString(); if(s!=="/Parent" && s!=="/P" && s!=="/Dest" && s!=="/A") st.push(v); } }
      else if(x instanceof L.PDFArray){ for(const v of x.asArray()) st.push(v); } }
  }
  let budget = 4000, seq = [];
  async function walk(bytes, res, m0, depth){
    if(res instanceof L.PDFDict){ for(const k of ["Pattern","ExtGState","Font","Shading"]) capFrom(res.get(N(k))); }
    let m = m0.slice(); const st = [], ops = []; let nest = 0;
    for(const t of tokens(bytes)){
      if(t===TO){ nest++; continue; } if(t===TC){ if(nest>0) nest--; if(!nest) ops.push(null); continue; }
      if(nest) continue;
      if(t===TS){ ops.push(null); continue; }
      if(typeof t==="number"){ ops.push(t); continue; }
      if(t.n!==undefined){ ops.push(t.n); continue; }
      const o = t.o;
      if(o==="q") st.push(m.slice());
      else if(o==="Q"){ if(st.length) m = st.pop(); }
      else if(o==="cm"){ const a = ops.slice(-6); if(a.length===6 && a.every(v=>typeof v==="number")) m = mul(a, m); }
      else if(o==="Do"){ const nm = ops[ops.length-1];
        if(typeof nm==="string" && res instanceof L.PDFDict){ const xo = res.lookup(N("XObject"));
          if(xo instanceof L.PDFDict){ const r = xo.get(N(nm)), x = r instanceof L.PDFRef ? ctx.lookup(r) : r;
            if(isImg(x) && r instanceof L.PDFRef){ const k = r.toString(), w = Math.hypot(m[0],m[1]), h = Math.hypot(m[2],m[3]), p = map.get(k); map.set(k, p ? [Math.max(p[0],w), Math.max(p[1],h)] : [w,h]); seq.push(k); }
            else if(isForm(x)){ if(depth>=8 || budget--<=0) throw new Error("too deep");
              const fm = numArr(x.dict.lookup(N("Matrix"))) || [1,0,0,1,0,0], fr = x.dict.lookup(N("Resources"));
              await walk(await bytesOf(x), fr instanceof L.PDFDict ? fr : res, mul(fm.length===6?fm:[1,0,0,1,0,0], m), depth+1); } } } }
      ops.length = 0;
    }
  }
  return {map, cap, walk, bytesOf, capFrom, newPage:()=>(seq = [])};
}
async function measure(L, doc){
  const ctx = doc.context, N = s=>L.PDFName.of(s), T = measureTools(L, ctx);
  let ok = true, cap = 0; const pages = [];
  for(const page of doc.getPages()){
    const node = page.node, sz = page.getSize(); cap = Math.max(cap, sz.width, sz.height);
    pages.push(T.newPage());
    try{
      let res = node.getInheritableAttribute ? node.getInheritableAttribute(N("Resources")) : node.Resources();
      if(res instanceof L.PDFRef) res = ctx.lookup(res);
      const cs = node.Contents(); let parts = [];
      if(cs instanceof L.PDFArray){ for(const r of cs.asArray()) parts.push(await T.bytesOf(ctx.lookup(r))); } else if(cs) parts.push(await T.bytesOf(cs));
      const all = new Uint8Array(parts.reduce((a,p)=>a+p.length+1,0)); let o = 0; for(const p of parts){ all.set(p,o); o += p.length; all[o++] = 10; }
      await T.walk(all, res, [1,0,0,1,0,0], 0);
      const an = node.lookup(N("Annots")); if(an instanceof L.PDFArray) for(const a of an.asArray()){ const ad = ctx.lookup(a); if(ad instanceof L.PDFDict) T.capFrom(ad.get(N("AP"))); }
    }catch(e){ ok = false; }
  }
  return {map:T.map, cap:T.cap, ok, pageCap: cap || 842, pages};
}
// 인쇄용(CMYK) 사진은 브라우저의 JPEG 풀기와 PDF 뷰어의 색 바꾸기가 달라 색이 바뀐다 → PDF.js(뷰어)가 푼 그림을 그대로 받아 쓴다.
// 쪽마다 그리는 순서로 놓인 그림 중 가로·세로가 같은 것을 짝짓고, 못 찾으면 그 사진은 줄이지 않는다.
async function decodeByViewer(bytes, pages, want){
  const P = await pj(), out = new Map();
  const d = await P.getDocument({data: bytes.slice(0), cMapUrl:"/lib/pdfjs/cmaps/", cMapPacked:true, isEvalSupported:false, isOffscreenCanvasSupported:false}).promise;
  try{
    for(let i=0;i<pages.length && i<d.numPages;i++){
      const keys = [...new Set(pages[i])].filter(k=>want.has(k) && !out.has(k)); if(!keys.length) continue;
      if(stop) break;
      const pg = await d.getPage(i+1), ol = await pg.getOperatorList(), ids = [];
      ol.fnArray.forEach((fn,j)=>{ if(fn===P.OPS.paintImageXObject || fn===P.OPS.paintImageXObjectRepeat){ const id = ol.argsArray[j][0]; if(typeof id==="string" && !ids.includes(id)) ids.push(id); } });
      const got = [];
      for(const id of ids){ const store = id.startsWith("g_") ? pg.commonObjs : pg.objs;
        const im = await Promise.race([new Promise(r=>{ try{ store.get(id, r); }catch(_){ r(null); } }), new Promise(r=>setTimeout(()=>r(null), 20000))]);
        if(im && im.width && im.height) got.push(im); }
      for(const k of keys){ const a = want.get(k), j = got.findIndex(im=>im.width===a.w && im.height===a.h); if(j<0) continue;
        const im = got.splice(j,1)[0];
        try{ if(im.bitmap){ out.set(k, await createImageBitmap(im.bitmap)); continue; }
          const n = im.width*im.height, src = im.data, id = new ImageData(im.width, im.height), px = id.data;
          if(im.kind===3 && src.length>=n*4) px.set(src.subarray(0,n*4));
          else if(im.kind===2 && src.length>=n*3) for(let p=0,q=0;p<n;p++,q+=3){ px[p*4]=src[q]; px[p*4+1]=src[q+1]; px[p*4+2]=src[q+2]; px[p*4+3]=255; }
          else continue;
          for(let p=3;p<px.length;p+=4) px[p] = 255;   // 투명도는 원래 PDF 의 SMask 가 맡는다
          out.set(k, await createImageBitmap(id)); }catch(_){} }
      pg.cleanup();
    }
  }finally{ await d.destroy(); }
  return out;
}

// ---------- ① 글자 살리기: 사진만 다시 압축 ----------
function colorComps(L, ctx, cs){
  if(!cs) return 0;
  if(cs instanceof L.PDFName){ const s = cs.toString(); return s==="/DeviceRGB"||s==="/RGB" ? 3 : s==="/DeviceGray"||s==="/G" ? 1 : s==="/DeviceCMYK"||s==="/CMYK" ? 4 : 0; }
  if(cs instanceof L.PDFArray){ const a = cs.asArray(), k = String(ctx.lookup(a[0]));
    if(k==="/ICCBased"){ const s = ctx.lookup(a[1]), n = s && s.dict && s.dict.lookup(L.PDFName.of("N")), v = n && n.asNumber ? n.asNumber() : 0; return v===1||v===3||v===4 ? v : 0; }
    if(k==="/CalRGB") return 3; if(k==="/CalGray") return 1; }
  return 0;
}
const KEEPOUT = new Set(["/Filter","/DecodeParms","/Width","/Height","/ColorSpace","/BitsPerComponent","/Decode","/Length","/DL","/Metadata"]);
// 그림 하나를 다룰 수 있는지 보고, 풀 준비를 한다(못 다루면 null)
function analyze(L, ctx, o){
  const N = s=>L.PDFName.of(s), d = o.dict;
  const num = k=>{ const v = d.lookup(N(k)); return v && v.asNumber ? v.asNumber() : 0; };
  if(String(d.lookup(N("ImageMask")))==="true") return null;
  const w = num("Width"), h = num("Height");
  if(!w || !h || num("BitsPerComponent")!==8 || w*h > 60e6) return null;
  if(d.lookup(N("Mask")) instanceof L.PDFArray) return null;   // 색으로 투명하게 하는 그림은 손실 압축하면 테두리가 생긴다
  const f = d.lookup(N("Filter")); const fl = f instanceof L.PDFArray ? f.asArray().map(x=>String(ctx.lookup(x))) : f ? [String(f)] : [];
  const dp = d.lookup(N("DecodeParms")); const dps = dp instanceof L.PDFArray ? dp.asArray().map(x=>ctx.lookup(x)) : [dp];
  let pre = 0; while(pre<fl.length-1 && /^\/(ASCII85Decode|A85|ASCIIHexDecode|AHx)$/.test(fl[pre])) pre++;
  if(fl.length-pre!==1) return null;
  const kind = /^\/(DCTDecode|DCT)$/.test(fl[pre]) ? "dct" : /^\/(FlateDecode|Fl)$/.test(fl[pre]) ? "flate" : "";
  if(!kind) return null;
  const cs = colorComps(L, ctx, d.lookup(N("ColorSpace"))); if(!cs) return null;
  const dec = d.lookup(N("Decode"));
  if(dec instanceof L.PDFArray && cs!==4){ const a = dec.asArray().map(x=>{ const v = ctx.lookup(x); return v && v.asNumber ? v.asNumber() : NaN; });
    if(!a.every((v,i)=>v===(i%2?1:0))) return null; }
  if(kind==="flate" && cs!==4){ const p = dps[pre] instanceof L.PDFDict ? dps[pre] : null; const v = p && p.lookup(N("BitsPerComponent")); if(v && v.asNumber && v.asNumber()!==8) return null; }
  return {w, h, kind, cs, fl, pre, parms: dps[pre] instanceof L.PDFDict ? dps[pre] : null};
}
async function recompress(L, ctx, ref, o, a, set, M, noResize, viewer){
  const N = s=>L.PDFName.of(s), d = o.dict, {w, h, kind, cs} = a;
  let bmp;
  if(cs===4){ bmp = viewer; if(!bmp) return 0; }   // 인쇄용 CMYK 는 PDF.js 가 푼 것만 쓴다
  else{
    let data = o.contents;
    for(let i=0;i<a.pre;i++) data = /Hex|AHx/.test(a.fl[i]) ? ahx(data) : a85(data);
    if(kind==="dct") bmp = await createImageBitmap(new Blob([data],{type:"image/jpeg"}), {imageOrientation:"none", colorSpaceConversion:"none"});
    else{
      const p = a.parms, pn = k=>{ const v = p && p.lookup(N(k)); return v && v.asNumber ? v.asNumber() : 0; };
      let raw = await inflate(data);
      raw = unpredict(raw, p ? pn("Predictor") : 1, p ? (pn("Colors")||1) : 1, p ? (pn("Columns")||1) : 1);
      if(raw.length < w*h*cs) return 0;
      // 색이 적은 그림(도표·캡처·로고)은 JPEG 로 바꾸면 글자 가장자리가 번진다 → 그대로 둔다
      const seen = new Set(), step = Math.max(1, Math.floor(w*h/20000));
      for(let i=0;i<w*h && seen.size<400;i+=step){ const k = i*cs; seen.add(cs===3 ? raw[k]<<16|raw[k+1]<<8|raw[k+2] : raw[k]); }
      if(seen.size<400) return 0;
      const id = new ImageData(w,h), px = id.data;
      if(cs===3) for(let i=0,j=0;i<w*h;i++,j+=3){ px[i*4]=raw[j]; px[i*4+1]=raw[j+1]; px[i*4+2]=raw[j+2]; px[i*4+3]=255; }
      else for(let i=0;i<w*h;i++){ px[i*4]=px[i*4+1]=px[i*4+2]=raw[i]; px[i*4+3]=255; }
      bmp = await createImageBitmap(id);
    }
  }
  if(bmp.width!==w || bmp.height!==h){ bmp.close(); return 0; }   // 사진 방향 정보로 돌아간 경우
  const k = ref.toString(), sh = M.map.get(k);
  let need;
  if(M.ok && sh && !M.cap.has(k)) need = Math.max(sh[0]/72*set.dpi/w, sh[1]/72*set.dpi/h);
  else need = M.pageCap/72*set.dpi/Math.max(w,h);
  let s = noResize ? 1 : Math.min(1, need);
  if(s>0.92) s = 1;
  if(w*h*s*s > 16.7e6) s = Math.sqrt(16.7e6/(w*h));   // 아이폰 캔버스 한도
  const tw = Math.max(1, Math.round(w*s)), th = Math.max(1, Math.round(h*s));
  if(noResize && (tw!==w || th!==h)){ bmp.close(); return 0; }
  const c = shrink(bmp, tw, th, set.gray); bmp.close();
  const jb = await jpeg(c, set.q); c.width = c.height = 0;
  if(jb.length > o.contents.length*0.9) return 0;
  const nd = L.PDFDict.withContext(ctx);
  for(const [kk,v] of d.entries()) if(!KEEPOUT.has(kk.toString())) nd.set(kk, v);
  nd.set(N("Type"), N("XObject")); nd.set(N("Subtype"), N("Image"));
  nd.set(N("Width"), L.PDFNumber.of(tw)); nd.set(N("Height"), L.PDFNumber.of(th));
  nd.set(N("ColorSpace"), N("DeviceRGB")); nd.set(N("BitsPerComponent"), L.PDFNumber.of(8)); nd.set(N("Filter"), N("DCTDecode"));
  ctx.assign(ref, L.PDFRawStream.of(nd, jb));
  return o.contents.length - jb.length;
}
function gc(L, ctx){   // 아무 데서도 안 쓰는 객체(예전 수정본의 찌꺼기 등)를 지운다
  const keep = new Set(), st = [ctx.trailerInfo.Root, ctx.trailerInfo.Info];
  while(st.length){ let x = st.pop(); if(!x) continue;
    if(x instanceof L.PDFRef){ const k = x.toString(); if(keep.has(k)) continue; keep.add(k); x = ctx.lookup(x); if(!x) continue; }
    if(x instanceof L.PDFStream) x = x.dict;
    if(x instanceof L.PDFDict){ for(const [,v] of x.entries()) st.push(v); }
    else if(x instanceof L.PDFArray){ for(const v of x.asArray()) st.push(v); } }
  if(!keep.size) return;
  for(const [r] of ctx.enumerateIndirectObjects()) if(!keep.has(r.toString())) ctx.delete(r);
}
async function keepText(bytes, set, tick){
  const L = await lib(), N = s=>L.PDFName.of(s);
  const doc = await L.PDFDocument.load(bytes, {ignoreEncryption:true, updateMetadata:false});
  if(doc.isEncrypted) throw new Error(LOCKED);
  const ctx = doc.context, M = await measure(L, doc);
  const imgs = [], masks = new Set(), matte = new Set();
  for(const [r,o] of ctx.enumerateIndirectObjects()){
    if(!(o instanceof L.PDFRawStream) || o.dict.get(N("Subtype"))!==N("Image")) continue;
    imgs.push([r,o]);
    for(const k of ["SMask","Mask"]){ const m = o.dict.get(N(k)); if(m instanceof L.PDFRef){ masks.add(m.toString()); const ms = ctx.lookup(m); if(k==="SMask" && ms && ms.dict && ms.dict.get(N("Matte"))) matte.add(r.toString()); } }
  }
  imgs.sort((a,b)=>b[1].contents.length - a[1].contents.length);
  const info = new Map(), want = new Map();
  for(const [r,o] of imgs){ const k = r.toString(); if(masks.has(k) || o.contents.length < 12000) continue;
    const a = analyze(L, ctx, o); if(!a) continue; info.set(k, a); if(a.cs===4) want.set(k, a); }
  let viewer = new Map(), cmyk = 0;
  if(want.size && M.ok){ tick(0.05); try{ viewer = await decodeByViewer(bytes, M.pages, want); }catch(e){ console.warn(e); } }
  let changed = 0, done = 0;
  for(const [r,o] of imgs){
    if(stop) throw new Error(STOP);
    tick(0.1 + 0.8*done++/Math.max(1,imgs.length));
    const k = r.toString(), a = info.get(k); if(!a) continue;
    try{ if(await recompress(L, ctx, r, o, a, set, M, matte.has(k), viewer.get(k))){ changed++; if(a.cs===4) cmyk++; } }catch(e){ /* 못 다루는 그림은 그대로 둔다 */ }
    await pause();
  }
  viewer.forEach(b=>{ try{ b.close(); }catch(_){} });
  gc(L, ctx); tick(0.94);
  const out = await doc.save({useObjectStreams:true, addDefaultPage:false, objectsPerTick:200});
  return {bytes: out, changed, cmyk, skippedCmyk: want.size - cmyk, images: imgs.length - masks.size, pages: doc.getPageCount(), measured: M.ok};
}

// ---------- ② 쪽을 그림으로 ----------
async function rasterize(bytes, set, tick){
  const L = await lib(), P = await pj();
  const src = await openPdf(bytes), out = await L.PDFDocument.create({updateMetadata:false});
  const n = src.numPages;
  for(let i=1;i<=n;i++){
    if(stop){ await src.destroy(); throw new Error(STOP); }
    const pg = await src.getPage(i), v1 = pg.getViewport({scale:1});
    let s = set.dpi/72; if(v1.width*v1.height*s*s > 16.7e6) s = Math.sqrt(16.7e6/(v1.width*v1.height));
    const vp = pg.getViewport({scale:s}), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0,0,c.width,c.height);
    await pg.render({canvasContext:x, viewport:vp, intent:"print", annotationMode:P.AnnotationMode.ENABLE_STORAGE}).promise;
    if(set.gray) toGray(c);
    const jb = await jpeg(c, set.q); c.width = c.height = 0; pg.cleanup();
    const img = await out.embedJpg(jb), p = out.addPage([v1.width, v1.height]);
    p.drawImage(img, {x:0, y:0, width:v1.width, height:v1.height});
    tick(0.03 + 0.9*i/n); await pause();
  }
  await src.destroy();
  const b = await out.save({useObjectStreams:true, addDefaultPage:false});
  return {bytes:b, changed:n, images:n, pages:n, measured:true};
}

// ---------- 파일 넣기·화면 ----------
async function addFiles(list){
  list = [...list];
  const fs = list.filter(f=>/\.pdf$/i.test(f.name) || f.type==="application/pdf");
  if(!fs.length){ toast("PDF 파일만 넣을 수 있습니다"); return; }
  if(busy) return;
  const room = MAXF - files.length; if(fs.length>room) toast(`한 번에 ${MAXF}개까지 넣을 수 있습니다`);
  const L = await lib().catch(()=>null); if(!L){ $("pcHint").textContent = "PDF 프로그램을 받지 못했습니다. 새로 고침해 주세요."; return; }
  for(const f of fs.slice(0, Math.max(0,room))){
    const it = {id: Math.random().toString(36).slice(2), name:f.name, size:f.size};
    try{ it.bytes = new Uint8Array(await f.arrayBuffer());
      const d = await L.PDFDocument.load(it.bytes, {ignoreEncryption:true, updateMetadata:false});
      if(d.isEncrypted) throw new Error(LOCKED);
      it.n = d.getPageCount();
      it.signed = /\/ByteRange\s*\[/.test(new TextDecoder("latin1").decode(it.bytes.subarray(0, Math.min(it.bytes.length, 8e6))));
    }catch(e){ it.err = e.message===LOCKED ? LOCKED : "PDF를 읽지 못했습니다. 손상되었거나 PDF가 아닌 파일입니다."; delete it.bytes; }
    files.push(it);
  }
  draw();
}
function setOf(){ const mode = val("pcMode"), lv = val("pcLv"); return {mode, lv, gray:$("pcGray").checked, target: +$("pcTarget").value || 0}; }
function stepName(mode, i){ const s = LADDER[mode][i]; return mode==="keep" ? `사진 ${s.dpi}dpi · 품질 ${Math.round(s.q*100)}` : `쪽 ${s.dpi}dpi · 품질 ${Math.round(s.q*100)}`; }
function draw(){
  const o = setOf();
  $("pcList").innerHTML = files.map((f,i)=>{
    const r = f.res;
    let right = "", sub;
    if(f.err) sub = esc(f.err);
    else if(f.state==="run") sub = `${f.n}쪽 · ${mb(f.size)} · 줄이는 중…`;
    else if(r && r.err) sub = `${f.n}쪽 · ${mb(f.size)} · <em>${esc(r.err)}</em>`;
    else if(r){ const pct = Math.min(99, Math.floor((1 - r.size/f.size)*100));
      sub = r.size < f.size*0.98 ? `${mb(f.size)} → <b class="pcnew">${mb(r.size)}</b> <span class="pcpct">${pct}% 줄임</span>` : `${mb(f.size)} → ${mb(r.size)} · 더 줄지 않았습니다`;
      if(r.note) sub += `<small>${esc(r.note)}</small>`;
      right = (r.size < f.size*0.98 ? `<a class="btn" href="${r.url}" download="${esc(r.name)}">내려받기</a>` : "") + `<button type="button" class="ghost" data-cmp="${i}">비교해 보기</button>`; }
    else sub = `${f.n}쪽 · ${mb(f.size)}${f.signed?" · 전자 서명이 든 PDF":""}`;
    return `<li class="${f.err||(r&&r.err)?"bad":""}${f.state==="run"?" run":""}"><span class="pcico" aria-hidden="true">PDF</span><div class="pcn"><b>${esc(f.name)}</b><span>${sub}</span></div><span class="pcbtn">${right}<button type="button" class="pcx" data-rm="${i}" aria-label="${esc(f.name)} 빼기" ${busy?"disabled":""}>✕</button></span></li>`;
  }).join("");
  const ok = files.filter(f=>!f.err);
  $("pcStatus").textContent = ok.length ? `${ok.length}개 · 모두 ${mb(ok.reduce((a,f)=>a+f.size,0))}` : "";
  $("pcGo").disabled = busy || !ok.length;
  $("pcGo").textContent = busy ? "줄이는 중…" : ok.some(f=>f.res) ? "이 설정으로 다시 줄이기" : ok.length>1 ? `PDF ${ok.length}개 줄이기` : "PDF 줄이기";
  $("pcStop").hidden = !busy;
  $("pcModeNote").textContent = o.mode==="keep" ? "글자·표·링크는 그대로 두고 PDF 안의 사진만 줄입니다. 사진이 많은 보고서·포트폴리오·카탈로그에 맞습니다." : "쪽마다 사진 한 장으로 다시 만듭니다. 스캔한 PDF에 맞고, 글자를 고르거나 검색할 수는 없게 됩니다.";
  const done = ok.filter(f=>f.res && !f.res.err && f.res.size < f.size*0.98);
  $("pcZip").hidden = done.length<2;
  if(ok.some(f=>f.signed) && !ok.some(f=>f.res)) $("pcHint").textContent = "전자 서명(인증서 서명)이 든 PDF는 줄이면 서명 확인이 깨집니다. 서명이 필요한 제출용이라면 원본을 쓰세요.";
}
const bar = r=>{ $("pcBar").hidden = r==null; if(r!=null) $("pcBar").firstElementChild.style.width = Math.round(Math.min(1,r)*100)+"%"; };
async function shrinkFile(f, o, tick){
  const lad = LADDER[o.mode], fn = o.mode==="keep" ? keepText : rasterize;
  let i = START[o.lv], best = null;
  for(;;){
    const r = await fn(f.bytes, {...lad[i], gray:o.gray}, p=>tick(p));
    if(!best || r.bytes.length < best.bytes.length) best = {...r, step:i};
    if(!o.target || r.bytes.length <= o.target || i>=lad.length-1 || (o.mode==="keep" && !r.changed)) break;
    i++; tick(0); $("pcHint").textContent = `${f.name}: 목표보다 커서 한 단계 더 줄여 봅니다 (${stepName(o.mode,i)})`;
  }
  return best;
}
async function go(){
  if(busy) return; const o = setOf(), list = files.filter(f=>!f.err);
  if(!list.length) return;
  busy = true; stop = false; closeView();
  list.forEach(f=>{ if(f.res && f.res.url) URL.revokeObjectURL(f.res.url); f.res = null; });
  draw(); bar(0); $("pcHint").textContent = "";
  let k = 0;
  for(const f of list){
    f.state = "run"; draw();
    try{
      const r = await shrinkFile(f, o, p=>bar((k+p)/list.length));
      const blob = new Blob([r.bytes], {type:"application/pdf"});
      let note = "";
      if(o.mode==="keep"){
        const tidy = blob.size < f.size*0.98;
        if(!r.changed) note = r.images ? `PDF 안의 사진이 이미 충분히 작거나 다룰 수 없는 형식입니다.${tidy?" PDF 구조만 정리해 조금 줄였습니다.":" 글꼴·글자가 용량 대부분이면 이 방식으로는 많이 줄지 않습니다."}`
          : `줄일 사진이 없는 PDF입니다${tidy?". PDF 구조만 정리해 조금 줄였습니다":"(글자·글꼴 위주)"}. 더 줄이려면 '쪽을 그림으로'를 쓰세요(글자를 고를 수 없게 됩니다).`;
        else note = `사진 ${r.changed}장을 줄였습니다 · ${stepName(o.mode, r.step)}${r.measured?"":" · 쪽 구조를 다 읽지 못해 조금 덜 줄였습니다"}`;
        if(r.skippedCmyk) note += ` · 인쇄용(CMYK) 사진 ${r.skippedCmyk}장은 색이 바뀌지 않게 그대로 두었습니다`;
      }else note = blob.size >= f.size ? "글자 위주 PDF는 쪽을 그림으로 바꾸면 오히려 커집니다. '글자 살리기'를 쓰세요." : `${r.pages}쪽을 그림으로 · ${stepName(o.mode, r.step)}`;
      if(o.target && r.bytes.length > o.target) note += ` · 목표(${mb(o.target)})까지는 못 줄였습니다${o.mode==="keep"?". '쪽을 그림으로'를 써 보세요":""}`;
      f.res = {size:blob.size, blob, url:URL.createObjectURL(blob), name:base(f.name)+"-압축.pdf", note, mode:o.mode};
    }catch(e){ f.res = {err: e.message===STOP ? STOP : e.message===LOCKED ? LOCKED : "줄이지 못했습니다. PDF 구조가 특이한 파일일 수 있습니다."+(o.mode==="keep"?" '쪽을 그림으로'를 써 보세요.":"")};
      if(e.message!==STOP) console.warn(e); }
    f.state = ""; k++; draw();
    if(stop) break;
  }
  busy = false; bar(null); draw();
  const good = list.filter(f=>f.res && !f.res.err && f.res.size < f.size*0.98);
  if(stop) $("pcHint").textContent = "멈췄습니다. 끝난 파일만 받을 수 있습니다.";
  else if(good.length){ const a = good.reduce((s,f)=>s+f.size,0), b = good.reduce((s,f)=>s+f.res.size,0);
    $("pcHint").textContent = `${good.length}개 파일 ${mb(a)} → ${mb(b)} (${Math.min(99, Math.floor((1-b/a)*100))}% 줄임). '비교해 보기'로 글자·사진이 괜찮은지 확인하고 받으세요.`;
    if(list.length===1) openView(files.indexOf(list[0])); }
  else if(!$("pcHint").textContent || /목표보다/.test($("pcHint").textContent)) $("pcHint").textContent = "더 줄어든 파일이 없습니다. 위 목록의 안내를 보고 방식이나 정도를 바꿔 보세요.";
}

// ---------- 전후 비교 ----------
function closeView(){ if(view){ view.docs.forEach(d=>d.destroy()); view = null; } $("pcView").hidden = true; }
async function openView(i){
  const f = files[i]; if(!f || !f.res || f.res.err) return;
  closeView(); const v = view = {i, page:1, zoom:false, docs:[]};
  $("pcView").hidden = false; $("pcVName").textContent = f.name;
  $("pcVA").textContent = `원래 ${mb(f.size)}`; $("pcVB").textContent = `줄인 뒤 ${mb(f.res.size)}`;
  try{ v.docs = [await openPdf(f.bytes), await openPdf(new Uint8Array(await f.res.blob.arrayBuffer()))]; }catch(_){ $("pcVPage").textContent = "미리 보기를 열지 못했습니다."; return; }
  if(view!==v){ v.docs.forEach(d=>d.destroy()); return; }
  v.n = v.docs[0].numPages; await render(); $("pcView").scrollIntoView({behavior:"smooth", block:"start"});
}
async function render(){
  const v = view; if(!v) return;
  $("pcVPage").textContent = `${v.page} / ${v.n}쪽`; $("pcPrev").disabled = v.page<=1; $("pcNext").disabled = v.page>=v.n;
  $("pcZoom").textContent = v.zoom ? "한눈에 보기" : "크게 보기(글자 확인)"; $("pcView").classList.toggle("zoom", v.zoom);
  const box = $("pcVA").parentElement.querySelector(".pcvs"), W = Math.max(240, box.clientWidth || 300), dpr = Math.min(2, window.devicePixelRatio||1);
  for(const [k,id] of [[0,"pcCA"],[1,"pcCB"]]){
    const d = v.docs[k], pg = await d.getPage(Math.min(v.page, d.numPages)), v1 = pg.getViewport({scale:1});
    const s = (v.zoom ? 2.2 : W/v1.width), vp = pg.getViewport({scale:s*dpr}), c = $(id);
    c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.style.width = Math.round(vp.width/dpr)+"px";
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0,0,c.width,c.height);
    await pg.render({canvasContext:x, viewport:vp}).promise;
    if(view!==v) return;
  }
}
let sync = false;
["pcSA","pcSB"].forEach((id,k)=>$(id).addEventListener("scroll", e=>{ if(sync) return; sync = true; const o = $(k?"pcSA":"pcSB"); o.scrollTop = e.target.scrollTop; o.scrollLeft = e.target.scrollLeft; requestAnimationFrame(()=>sync=false); }));
$("pcPrev").addEventListener("click", ()=>{ if(view && view.page>1){ view.page--; render(); } });
$("pcNext").addEventListener("click", ()=>{ if(view && view.page<view.n){ view.page++; render(); } });
$("pcZoom").addEventListener("click", ()=>{ if(view){ view.zoom = !view.zoom; render(); } });
$("pcClose").addEventListener("click", closeView);

// ---------- 이벤트 ----------
$("pcFile").addEventListener("change", e=>{ addFiles(e.target.files); e.target.value = ""; });
const drop = $("pcDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>addFiles(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("pcFile").click(); } });
$("pcList").addEventListener("click", e=>{ const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.rm!=null && !busy){ const f = files[+b.dataset.rm]; if(f && f.res && f.res.url) URL.revokeObjectURL(f.res.url); if(view && view.i===+b.dataset.rm) closeView(); files.splice(+b.dataset.rm,1); if(view && view.i>+b.dataset.rm) view.i--; draw(); }
  else if(b.dataset.cmp!=null) openView(+b.dataset.cmp); });
document.querySelectorAll("input[name=pcMode],input[name=pcLv]").forEach(r=>r.addEventListener("change", draw));
$("pcGo").addEventListener("click", go);
$("pcStop").addEventListener("click", ()=>{ stop = true; $("pcHint").textContent = "멈추는 중…"; });
$("pcZip").addEventListener("click", async ()=>{
  const done = files.filter(f=>f.res && !f.res.err && f.res.size < f.size*0.98); if(!done.length) return;
  await script(ZIP, ()=>!!window.JSZip); const z = new JSZip(), used = new Set();
  done.forEach(f=>{ let n = f.res.name, k = 2; while(used.has(n)) n = f.res.name.replace(/\.pdf$/, `-${k++}.pdf`); used.add(n); z.file(n, f.res.blob); });
  const b = await z.generateAsync({type:"blob"}), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "PDF-압축.zip"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
});
if(typeof DecompressionStream==="undefined") $("pcHint").textContent = "이 브라우저는 오래되어 '글자 살리기'가 일부 PDF에서 안 될 수 있습니다. 크롬·엣지·사파리 최신판을 권합니다.";
// 점검용(주소 끝 #bot): 파일 없이 바이트로 돌려 보기
if(location.hash==="#bot") window.__pc = {keepText, rasterize, decodeByViewer, measure:async b=>{ const L = await lib(); return measure(L, await L.PDFDocument.load(b,{ignoreEncryption:true})); }, LADDER, files:()=>files};
draw();
})();

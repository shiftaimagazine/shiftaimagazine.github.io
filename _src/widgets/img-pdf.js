// SHIFT AI 무료 도구 — JPG → PDF 변환, PDF → JPG 변환. 파일은 이 브라우저 안에서만 처리한다.
// PDF 만들기는 /lib/pdf-lib/(pdf-lib, MIT), PDF 그리기는 /lib/pdfjs/(PDF.js, Apache-2.0), 아이폰 HEIC 는 /lib/heic-to/(heic-to, LGPL-3.0), ZIP 은 /lib/jszip/(MIT).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
const LIB = "/lib/pdf-lib/pdf-lib.min.js", ZIP = "/lib/jszip/jszip.min.js", HEIC = "/lib/heic-to/heic-to.js";
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2000); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const kb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다. 새로 고침해 주세요.")); document.head.appendChild(s); });
const radio = n=>(document.querySelector(`input[name=${n}]:checked`)||{}).value;
const safeName = s=>(String(s||"").trim() || "문서").replace(/[\\/:*?"<>|]/g,"_");
const save = (blob, name)=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); };
const toBlob = (cv, type, q)=>new Promise((ok,no)=>cv.toBlob(b=>b ? ok(b) : no(new Error("그림을 저장하지 못했습니다.")), type, q));
async function zipAll(list, name){ await script(ZIP, ()=>!!window.JSZip); const z = new JSZip(); const seen = {};
  list.forEach(o=>{ let n = o.name; if(seen[n]){ n = n.replace(/(\.[a-z]+)$/i, `-${++seen[n]}$1`); } else seen[n] = 1; z.file(n, o.blob); });
  save(await z.generateAsync({type:"blob"}), name); }

// =====================================================================
// JPG → PDF
// =====================================================================
if($("ipDrop")) (function(){
  const MAX = 100, A4 = [595.28, 841.89], LETTER = [612, 792];
  let items = [], busy = false, outs = [];
  const isHeic = f=>/hei[cf]/i.test(f.type||"") || /\.hei[cf]$/i.test(f.name||"");
  const isImg = f=>/^image\//.test(f.type||"") || /\.(jpe?g|png|webp|gif|bmp|avif|hei[cf])$/i.test(f.name||"");
  const say = m=>{ $("ipStatus").textContent = m; };
  // JPG 속 방향 정보(EXIF Orientation, 1~8)
  function orientation(u8){
    if(u8[0]!==0xFF || u8[1]!==0xD8) return 1;
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let p = 2;
    while(p + 4 < u8.length){
      if(u8[p]!==0xFF){ p++; continue; }
      const m = u8[p+1], len = dv.getUint16(p+2);
      if(m===0xE1 && dv.getUint32(p+4)===0x45786966){ const t = p+10, le = dv.getUint16(t)===0x4949, g16 = o=>dv.getUint16(t+o, le), g32 = o=>dv.getUint32(t+o, le);
        const ifd = g32(4), n = g16(ifd); for(let i=0;i<n;i++){ const e = ifd + 2 + i*12; if(g16(e)===0x0112) return g16(e+8) || 1; } return 1; }
      if(m===0xDA) break; p += 2 + len;
    }
    return 1;
  }
  const ROT = {1:0, 3:180, 6:90, 8:270};   // 거울상(2·4·5·7)은 그림으로 다시 그린다
  async function add(list){
    list = [...list].filter(Boolean);
    const fs = list.filter(isImg); if(!fs.length){ toast("사진 파일만 넣을 수 있습니다"); return; }
    if(items.length + fs.length > MAX) toast(`한 번에 ${MAX}장까지 넣을 수 있습니다`);
    const take = fs.slice(0, Math.max(0, MAX - items.length));
    const news = take.map(f=>({name: f.name || "붙여넣은 사진.png", file: f, size: f.size, rot: 0, wait: true}));
    items.push(...news); clearOut(); draw();
    for(let k=0;k<news.length;k++){ const it = news[k]; say(`사진 읽는 중… (${k+1}/${news.length})`);
      try{
        let blob = it.file;
        if(isHeic(it.file)){ say("아이폰 사진(HEIC) 변환 프로그램을 준비하는 중… (처음 한 번만 몇 초 걸립니다)");
          await script(HEIC, ()=>typeof window.HeicTo==="function"); blob = await window.HeicTo({blob: it.file, type: "image/jpeg", quality: 0.95}); it.name = it.name.replace(/\.hei[cf]$/i, ".jpg"); }
        it.bytes = new Uint8Array(await blob.arrayBuffer()); it.type = blob.type || it.file.type || "";
        if(/\.jpe?g$/i.test(it.name) && !it.type) it.type = "image/jpeg";
        it.orient = /jpe?g/i.test(it.type) ? orientation(it.bytes) : 1;
        const bmp = await createImageBitmap(new Blob([it.bytes], {type: it.type || "image/jpeg"}), {imageOrientation: "from-image"});
        it.w = bmp.width; it.h = bmp.height;
        const s = 160 / Math.max(it.w, it.h), cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(it.w*s)); cv.height = Math.max(1, Math.round(it.h*s));
        cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close && bmp.close();
        it.thumb = URL.createObjectURL(await toBlob(cv, "image/jpeg", 0.8));
      }catch(e){ it.err = "이 사진을 열지 못했습니다. 손상되었거나 이 브라우저가 읽지 못하는 형식입니다."; }
      it.wait = false; draw();
    }
    const ok = items.filter(i=>!i.err).length; say(ok ? `${ok}장` : "");
  }
  const disp = it=>it.rot % 180 ? [it.h, it.w] : [it.w, it.h];   // it.w/h 는 사진 속 방향 정보로 이미 바로잡은 크기
  function draw(){
    $("ipList").innerHTML = items.map((it,i)=>`<li draggable="true" data-i="${i}" class="${it.err?"bad":""}">
      <span class="pmgrip" aria-hidden="true">⋮⋮</span>
      <div class="ipthumb">${it.thumb?`<img src="${it.thumb}" alt="" style="transform:rotate(${it.rot}deg)">`:""}</div>
      <div class="pmn"><b>${i+1}. ${esc(it.name)}</b><span>${it.err ? esc(it.err) : it.wait ? "읽는 중…" : `${disp(it).join("×")} · ${kb(it.size)}`}</span></div>
      <span class="pmbtn"><button type="button" data-rot="${i}" aria-label="오른쪽으로 90° 돌리기" title="90° 돌리기" ${it.err||it.wait?"disabled":""}>↻</button><button type="button" data-up="${i}" aria-label="위로" ${i?"":"disabled"}>▲</button><button type="button" data-dn="${i}" aria-label="아래로" ${i<items.length-1?"":"disabled"}>▼</button><button type="button" data-rm="${i}" aria-label="빼기">✕</button></span></li>`).join("");
    const ok = items.filter(i=>!i.err && !i.wait);
    $("ipGo").disabled = busy || !ok.length || items.some(i=>i.wait);
    $("ipGo").textContent = radio("ipOut")==="each" && ok.length>1 ? `PDF ${ok.length}개 만들기` : ok.length ? `${ok.length}장으로 PDF 만들기` : "PDF 만들기";
    const fit = radio("ipSize")==="fit"; $("ipPageRow").hidden = fit; $("ipPageRow2").hidden = fit;
    const q = radio("ipQ");
    $("ipQHint").textContent = q==="orig" ? "원본 화질: JPG는 다시 압축하지 않고 그대로 넣습니다. 화질은 그대로지만 PDF 용량이 사진 용량만큼 커집니다."
      : q==="low" ? "가볍게: 긴 변을 1,600픽셀까지 줄이고 JPG로 더 압축합니다. 한 장에 수백 KB 정도라 메일·업로드 용량 제한에 맞추기 좋습니다."
      : "보통: 긴 변을 2,480픽셀(A4를 300dpi로 인쇄하는 크기)까지 줄이고 JPG로 다시 저장합니다. 글자가 든 서류 사진도 또렷합니다.";
  }
  function clearOut(){ outs.forEach(o=>URL.revokeObjectURL(o.url)); outs = []; $("ipOutList").innerHTML = ""; $("ipHint").textContent = ""; }
  async function embed(pdf, it){
    const q = radio("ipQ"), rotate = (it.rot % 360);
    const jpg = /jpe?g/i.test(it.type), png = /png/i.test(it.type);
    // 원본 화질: JPG·PNG 는 바이트 그대로 넣고, 방향은 PDF 안에서 돌린다
    if(q==="orig" && jpg && ROT[it.orient]!=null){ return {img: await pdf.embedJpg(it.bytes), turn: (ROT[it.orient] + rotate) % 360}; }
    if(q==="orig" && png){ try{ return {img: await pdf.embedPng(it.bytes), turn: rotate}; }catch(_){} }
    const lim = q==="low" ? 1600 : q==="mid" ? 2480 : 6000, qual = q==="low" ? 0.72 : q==="mid" ? 0.85 : 0.92;
    const bmp = await createImageBitmap(new Blob([it.bytes], {type: it.type || "image/jpeg"}), {imageOrientation: "from-image"});
    const s = Math.min(1, lim / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width*s)), h = Math.max(1, Math.round(bmp.height*s));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const b = await toBlob(cv, "image/jpeg", qual); cv.width = cv.height = 1;
    return {img: await pdf.embedJpg(new Uint8Array(await b.arrayBuffer())), turn: rotate};
  }
  function place(L, page, img, turn, box){
    const iw = img.width, ih = img.height, side = turn % 180 !== 0, dw = side ? ih : iw, dh = side ? iw : ih;
    const s = Math.min(box.w / dw, box.h / dh), W = dw*s, H = dh*s, x = box.x + (box.w - W)/2, y = box.y + (box.h - H)/2;
    const w = iw*s, h = ih*s;   // 돌리기 전 그림 크기. pdf-lib 의 rotate 는 왼쪽 아래 꼭짓점을 축으로 시계 반대 방향
    const at = turn===90 ? {x, y: y + w} : turn===180 ? {x: x + w, y: y + h} : turn===270 ? {x: x + h, y} : {x, y};
    page.drawImage(img, {x: at.x, y: at.y, width: w, height: h, rotate: L.degrees(-turn)});
  }
  async function build(){
    await script(LIB, ()=>!!window.PDFLib); const L = window.PDFLib;
    const ok = items.filter(i=>!i.err && !i.wait), each = radio("ipOut")==="each", size = radio("ipSize"), ori = radio("ipOri"), m = size==="fit" ? 0 : +radio("ipMargin");
    const nm = safeName($("ipName").value).replace(/\.pdf$/i, ""), res = [];
    let pdf = each ? null : await L.PDFDocument.create();
    for(let k=0;k<ok.length;k++){
      const it = ok[k]; $("ipHint").textContent = `${k+1} / ${ok.length}장 넣는 중…`; bar(k/ok.length);
      if(each) pdf = await L.PDFDocument.create();
      const {img, turn} = await embed(pdf, it);
      const side = turn % 180 !== 0, dw = side ? img.height : img.width, dh = side ? img.width : img.height;
      let pw, ph;
      if(size==="fit"){ const s = 841.89 / Math.max(dw, dh); pw = dw*s; ph = dh*s; }
      else { const [a, b] = size==="letter" ? LETTER : A4, land = ori==="l" || (ori==="auto" && dw > dh); pw = land ? b : a; ph = land ? a : b; }
      const page = pdf.addPage([pw, ph]);
      place(L, page, img, turn, {x:m, y:m, w:pw - 2*m, h:ph - 2*m});
      if(each){ const b = new Blob([await pdf.save()], {type:"application/pdf"}); res.push({name: `${it.name.replace(/\.[a-z0-9]+$/i,"")}.pdf`, blob:b, n:1}); }
    }
    if(!each){ pdf.setTitle(nm); res.push({name: nm + ".pdf", blob: new Blob([await pdf.save()], {type:"application/pdf"}), n: ok.length}); }
    res.forEach(o=>o.url = URL.createObjectURL(o.blob));
    return res;
  }
  const bar = r=>{ $("ipBar").hidden = r==null || r>=1; if(r!=null) $("ipBar").firstElementChild.style.width = Math.round(r*100)+"%"; };
  async function go(){
    if(busy) return; busy = true; clearOut(); draw(); bar(0);
    try{
      outs = await build();
      $("ipOutList").innerHTML = outs.slice(0,60).map(o=>`<div class="hitem"><div class="hthumb pmico">PDF</div><div><b>${esc(o.name)}</b><span>${o.n}쪽 · ${kb(o.blob.size)}</span></div><a class="ghost" href="${o.url}" download="${esc(o.name)}">내려받기</a></div>`).join("");
      if(outs.length===1){ save(outs[0].blob, outs[0].name); $("ipHint").textContent = `${outs[0].n}쪽짜리 PDF를 만들었습니다(${kb(outs[0].blob.size)}). 내려받기가 시작되지 않으면 위 버튼을 누르세요.`; }
      else { await zipAll(outs, safeName($("ipName").value) + ".zip"); $("ipHint").textContent = `PDF ${outs.length}개를 ZIP으로 내려받았습니다.`; }
    }catch(e){ console.warn(e); $("ipHint").textContent = "PDF를 만들지 못했습니다. 사진 수를 줄이거나 '가볍게'로 다시 해 보세요."; }
    finally{ busy = false; bar(null); draw(); }
  }
  // 이벤트
  $("ipFile").addEventListener("change", e=>{ add(e.target.files); e.target.value = ""; });
  const drop = $("ipDrop");
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
  drop.addEventListener("drop", e=>{ if(!busy) add(e.dataTransfer.files); });
  drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("ipFile").click(); } });
  document.addEventListener("paste", e=>{ if(e.target.closest && e.target.closest("input,textarea")) return; const fs = [...(e.clipboardData||{}).files||[]].filter(isImg); if(fs.length && !busy){ e.preventDefault(); add(fs.map((f,i)=>f.name && f.name!=="image.png" ? f : new File([f], `붙여넣은 사진 ${items.length+i+1}.png`, {type:f.type}))); } });
  const L0 = $("ipList");
  L0.addEventListener("click", e=>{ const b = e.target.closest("button"); if(!b || busy) return;
    if(b.dataset.rm!=null){ const [x] = items.splice(+b.dataset.rm, 1); if(x && x.thumb) URL.revokeObjectURL(x.thumb); }
    else if(b.dataset.up!=null){ const i = +b.dataset.up; [items[i-1], items[i]] = [items[i], items[i-1]]; }
    else if(b.dataset.dn!=null){ const i = +b.dataset.dn; [items[i+1], items[i]] = [items[i], items[i+1]]; }
    else if(b.dataset.rot!=null){ const it = items[+b.dataset.rot]; it.rot = (it.rot + 90) % 360; }
    clearOut(); draw(); });
  let dragI = null;
  L0.addEventListener("dragstart", e=>{ const li = e.target.closest("li"); if(!li) return; dragI = +li.dataset.i; e.dataTransfer.effectAllowed = "move"; li.classList.add("dragging"); });
  L0.addEventListener("dragover", e=>{ if(dragI!=null) e.preventDefault(); });
  L0.addEventListener("drop", e=>{ if(dragI==null) return; e.preventDefault(); e.stopPropagation(); const li = e.target.closest("li"); if(li){ const to = +li.dataset.i, [m] = items.splice(dragI, 1); items.splice(to, 0, m); } dragI = null; clearOut(); draw(); });
  L0.addEventListener("dragend", ()=>{ dragI = null; draw(); });
  document.querySelectorAll("input[name=ipSize],input[name=ipOri],input[name=ipMargin],input[name=ipQ],input[name=ipOut]").forEach(r=>r.addEventListener("change", ()=>{ if(busy) return; clearOut(); draw(); }));   // 만드는 중에 바꾸면 결과를 지우지 않는다(다음에 만들 때 반영)
  $("ipGo").addEventListener("click", go);
  window.addEventListener("pagehide", ()=>{ items.forEach(i=>i.thumb && URL.revokeObjectURL(i.thumb)); items = []; });
  draw();
})();

// =====================================================================
// PDF → JPG
// =====================================================================
if($("pjDrop")) (function(){
  let pdfjs = null, doc = null, fname = "문서", n = 0, sel = new Set(), outs = [], busy = false, obs = null;
  const say = m=>{ $("pjStatus").textContent = m; };
  const lib = async ()=>{ if(!pdfjs){ pdfjs = await import("/lib/pdfjs/pdf.min.js"); pdfjs.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.js"; } return pdfjs; };
  function ranges(s){ const out = new Set();
    for(const part of String(s||"").replace(/\s/g,"").split(/[,，]/)){ if(!part) continue; const m = part.match(/^(\d+)?(?:([-~])(\d+)?)?$/); if(!m || (!m[1] && !m[3])) return null;
      let a = m[1] ? +m[1] : 1, b = m[2] ? (m[3] ? +m[3] : n) : a; if(a>b) [a,b] = [b,a]; for(let i=Math.max(1,a); i<=Math.min(n,b); i++) out.add(i); }
    return [...out].sort((x,y)=>x-y); }
  const fmtR = arr=>{ const o=[]; let i=0; while(i<arr.length){ let j=i; while(j+1<arr.length && arr[j+1]===arr[j]+1) j++; o.push(i===j?`${arr[i]}`:`${arr[i]}-${arr[j]}`); i=j+1; } return o.join(", "); };
  const pages = ()=>sel.size ? [...sel].sort((a,b)=>a-b) : Array.from({length:n}, (_,i)=>i+1);
  function clearOut(){ outs.forEach(o=>URL.revokeObjectURL(o.url)); outs = []; $("pjOut").innerHTML = ""; $("pjHint").textContent = ""; }
  function sync(){
    $("pjPages").querySelectorAll(".pmpg").forEach(el=>el.classList.toggle("on", sel.has(+el.dataset.p)));
    if(document.activeElement!==$("pjSel")) $("pjSel").value = fmtR([...sel].sort((a,b)=>a-b));
    const k = pages().length, join = radio("pjJoin")==="long";
    $("pjGo").disabled = busy || !doc;
    $("pjGo").textContent = !doc ? "사진으로 바꾸기" : join ? `${k}쪽을 이어 한 장으로` : `${k}쪽을 사진으로 바꾸기`;
    $("pjZip").disabled = busy || outs.length < 2;
  }
  async function open(f){
    if(!f) return; if(!/\.pdf$/i.test(f.name) && f.type!=="application/pdf"){ toast("PDF 파일만 넣을 수 있습니다"); return; }
    clearOut(); sel.clear(); if(doc){ doc.destroy(); doc = null; } n = 0; $("pjPages").innerHTML = ""; $("pjPickRow").hidden = true; sync();
    fname = f.name.replace(/\.pdf$/i, "") || "문서"; say("PDF 여는 중…");
    try{
      const L = await lib();
      doc = await L.getDocument({data: new Uint8Array(await f.arrayBuffer()), cMapUrl:"/lib/pdfjs/cmaps/", cMapPacked:true, isEvalSupported:false}).promise;
      n = doc.numPages; say(`${n}쪽`); $("pjDropS").textContent = `${f.name} · 다른 PDF를 넣으면 바뀝니다`; $("pjPickRow").hidden = false;
      $("pjPages").innerHTML = Array.from({length:n}, (_,i)=>`<button type="button" class="pmpg" data-p="${i+1}" aria-label="${i+1}쪽"><canvas></canvas><span>${i+1}</span></button>`).join("");
      thumbs(); sync();
    }catch(e){ doc = null; say(/password/i.test(e && e.name || "") ? "암호가 걸린 PDF라 열 수 없습니다." : "PDF를 열지 못했습니다. 손상되었거나 PDF가 아닌 파일입니다."); sync(); }
  }
  function thumbs(){
    if(obs) obs.disconnect(); const d = doc, q = []; let running = false;
    const run = async ()=>{ if(running) return; running = true;
      while(q.length && doc===d){ const el = q.shift(); try{ const pg = await d.getPage(+el.dataset.p), v1 = pg.getViewport({scale:1}), vp = pg.getViewport({scale: 220/v1.width});
        const cv = el.querySelector("canvas"); cv.width = vp.width; cv.height = vp.height; await pg.render({canvasContext: cv.getContext("2d"), viewport: vp}).promise; el.classList.add("done"); }catch(_){} }
      running = false; };
    obs = new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ obs.unobserve(e.target); q.push(e.target); } }); run(); }, {rootMargin:"300px"});
    $("pjPages").querySelectorAll(".pmpg").forEach(el=>obs.observe(el));
  }
  async function renderPage(p, scale){
    const pg = await doc.getPage(p), vp = pg.getViewport({scale});
    const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.floor(vp.width)); cv.height = Math.max(1, Math.floor(vp.height));
    const c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height);
    await pg.render({canvasContext: c, viewport: vp}).promise; pg.cleanup(); return cv;
  }
  const bar = r=>{ $("pjBar").hidden = r==null || r>=1; if(r!=null) $("pjBar").firstElementChild.style.width = Math.round(r*100)+"%"; };
  async function go(){
    if(busy || !doc) return; busy = true; clearOut(); sync(); bar(0);
    const png = radio("pjType")==="png", type = png ? "image/png" : "image/jpeg", ext = png ? "png" : "jpg", q = 0.9;
    let scale = +radio("pjDpi") / 72, ps = pages(); const w = String(n).length;
    try{
      if(radio("pjJoin")==="long"){
        let cut = false; if(ps.length > 40){ ps = ps.slice(0, 40); cut = true; }
        const sizes = []; for(const p of ps){ const v = (await doc.getPage(p)).getViewport({scale:1}); sizes.push([v.width, v.height]); }
        const W1 = Math.max(...sizes.map(s=>s[0])), H1 = sizes.reduce((a,s)=>a + s[1]*(W1/s[0]), 0);
        const lim = Math.min(scale, 16000 / W1, 30000 / H1, Math.sqrt(120e6 / (W1*H1)));   // 브라우저가 그릴 수 있는 크기 안으로
        if(lim < scale){ scale = lim; }
        const cw = Math.round(W1*scale), ch = Math.round(H1*scale), cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
        const c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cw, ch);
        let y = 0;
        for(let k=0;k<ps.length;k++){ $("pjHint").textContent = `${k+1} / ${ps.length}쪽 그리는 중…`; bar(k/ps.length);
          const s = scale * (W1/sizes[k][0]), one = await renderPage(ps[k], s); c.drawImage(one, 0, y); y += one.height; one.width = one.height = 1; }
        const b = await toBlob(cv, type, q); cv.width = cv.height = 1;
        outs = [{name: `${fname}-${ps.length}쪽-이어붙임.${ext}`, blob: b, url: URL.createObjectURL(b), info: `${cw}×${ch} · ${kb(b.size)}`}];
        if(cut || lim < +radio("pjDpi")/72) toast(cut ? "앞 40쪽까지만 이었습니다" : "쪽이 많아 선명도를 조금 낮춰 이었습니다");
      } else {
        for(let k=0;k<ps.length;k++){ $("pjHint").textContent = `${k+1} / ${ps.length}쪽 바꾸는 중…`; bar(k/ps.length);
          const v = (await doc.getPage(ps[k])).getViewport({scale:1}), s = Math.min(scale, 12000 / Math.max(v.width, v.height), Math.sqrt(80e6 / (v.width*v.height)));
          const cv = await renderPage(ps[k], s), b = await toBlob(cv, type, q);
          outs.push({name: `${fname}-${String(ps[k]).padStart(w,"0")}쪽.${ext}`, blob: b, url: URL.createObjectURL(b), info: `${cv.width}×${cv.height} · ${kb(b.size)}`}); cv.width = cv.height = 1; }
      }
      $("pjOut").innerHTML = outs.slice(0,80).map(o=>`<div class="hitem"><img class="hthumb" src="${o.url}" alt=""><div><b>${esc(o.name)}</b><span>${o.info}</span></div><a class="ghost" href="${o.url}" download="${esc(o.name)}">내려받기</a></div>`).join("")
        + (outs.length>80 ? `<p class="hint">… 외 ${outs.length-80}장 (ZIP에 모두 들어 있습니다)</p>` : "");
      if(outs.length===1){ save(outs[0].blob, outs[0].name); $("pjHint").textContent = "사진을 만들었습니다. 내려받기가 시작되지 않으면 위 버튼을 누르세요."; }
      else $("pjHint").textContent = `사진 ${outs.length}장을 만들었습니다. 하나씩 받거나 'ZIP으로 받기'로 한 번에 받으세요.`;
    }catch(e){ console.warn(e); $("pjHint").textContent = "바꾸지 못했습니다. 선명도를 낮추거나 쪽 수를 줄여 다시 해 보세요."; }
    finally{ busy = false; bar(null); sync(); }
  }
  $("pjFile").addEventListener("change", e=>{ open(e.target.files[0]); e.target.value = ""; });
  const drop = $("pjDrop");
  ["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
  drop.addEventListener("drop", e=>{ if(!busy) open([...e.dataTransfer.files].find(f=>/\.pdf$/i.test(f.name)||f.type==="application/pdf") || e.dataTransfer.files[0]); });
  drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("pjFile").click(); } });
  $("pjPages").addEventListener("click", e=>{ const b = e.target.closest(".pmpg"); if(!b || busy) return; const p = +b.dataset.p; sel.has(p) ? sel.delete(p) : sel.add(p); clearOut(); sync(); });
  $("pjSel").addEventListener("input", ()=>{ if(busy) return; const ps = ranges($("pjSel").value); $("pjSel").classList.toggle("bad", ps==null); if(ps){ sel = new Set(ps); clearOut(); sync(); } });
  $("pjSel").addEventListener("blur", sync);
  $("pjAll").addEventListener("click", ()=>{ if(busy) return; sel = new Set(Array.from({length:n}, (_,i)=>i+1)); clearOut(); sync(); });
  $("pjNone").addEventListener("click", ()=>{ if(busy) return; sel.clear(); clearOut(); sync(); });
  document.querySelectorAll("input[name=pjDpi],input[name=pjType],input[name=pjJoin]").forEach(r=>r.addEventListener("change", ()=>{ if(busy) return; clearOut(); sync(); }));
  $("pjGo").addEventListener("click", go);
  $("pjZip").addEventListener("click", ()=>{ if(outs.length) zipAll(outs, safeName(fname) + "-사진.zip"); });
  // 다른 페이지에서 ?to=png 로 오면 PNG 를 먼저 고른다
  try{ const t = new URLSearchParams(location.search).get("to"); if(t==="png"){ const r = document.querySelector("input[name=pjType][value=png]"); if(r) r.checked = true; } }catch(_){}
  sync();
})();
})();

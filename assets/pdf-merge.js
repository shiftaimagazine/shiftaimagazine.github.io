// SHIFT AI 무료 도구 — PDF 합치기·나누기·쪽 뽑기. /lib/pdf-lib/(pdf-lib, MIT)로 쪽을 그대로 옮겨 붙이고, 쪽 미리 보기는 /lib/pdfjs/(PDF.js, Apache-2.0).
// 파일은 이 브라우저 안에서만 처리한다. ZIP 은 /lib/jszip/(MIT).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("pmDrop")) return;
const LIB = "/lib/pdf-lib/pdf-lib.min.js", ZIP = "/lib/jszip/jszip.min.js";
let files = [], sel = new Set(), outs = [], pdfjs = null, thumbDoc = null, obs = null, busy = false;
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2000); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const kb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다")); document.head.appendChild(s); });
const lib = ()=>script(LIB, ()=>!!window.PDFLib).then(()=>window.PDFLib);
const job = ()=>document.querySelector('input[name=pmJob]:checked').value;
const how = ()=>document.querySelector('input[name=pmHow]:checked').value;
const keepSel = ()=>document.querySelector("input[name=pmKeep]:checked").value==="keep";
const base = n=>(n||"문서").replace(/\.pdf$/i,"");
const say = m=>{ $("pmStatus").textContent = m; };

// "1-3, 7, 10-" → [[1,3],[7,7],[10,n]] / 쪽 목록
function ranges(s, n){
  const out = [];
  for(const part of String(s||"").replace(/\s/g,"").split(/[,，]/)){
    if(!part) continue;
    const m = part.match(/^(\d+)?(?:([-~])(\d+)?)?$/); if(!m || (!m[1] && !m[3])) return null;
    let a = m[1] ? +m[1] : 1, b = m[2] ? (m[3] ? +m[3] : n) : a; if(a>b) [a,b] = [b,a];
    a = Math.max(1,a); b = Math.min(n,b); if(a<=b) out.push([a,b]);
  }
  return out;
}
const pagesOf = (s, n)=>{ const r = ranges(s,n); if(r==null) return null; const set = new Set(); r.forEach(([a,b])=>{ for(let i=a;i<=b;i++) set.add(i); }); return [...set].sort((x,y)=>x-y); };
const fmtRanges = arr=>{ const out=[]; let i=0; while(i<arr.length){ let j=i; while(j+1<arr.length && arr[j+1]===arr[j]+1) j++; out.push(i===j?`${arr[i]}`:`${arr[i]}-${arr[j]}`); i=j+1; } return out.join(", "); };

async function addFiles(list){
  list = [...list];   // 파일 칸을 비우기 전에 복사(비우면 목록도 사라짐)
  const L = await lib().catch(()=>null); if(!L){ say("PDF 프로그램을 받지 못했습니다. 새로 고침해 주세요."); return; }
  const fs = [...list].filter(f=>/\.pdf$/i.test(f.name) || f.type==="application/pdf");
  if(!fs.length){ toast("PDF 파일만 넣을 수 있습니다"); return; }
  const single = job()!=="merge";
  if(single){ files = []; sel.clear(); }
  for(const f of single ? fs.slice(0,1) : fs){
    const it = {name: f.name, size: f.size};
    try{
      it.bytes = new Uint8Array(await f.arrayBuffer());
      const d = await L.PDFDocument.load(it.bytes, {ignoreEncryption:true, updateMetadata:false});
      if(d.isEncrypted) throw new Error("암호가 걸린 PDF라 열 수 없습니다.");
      it.n = d.getPageCount();
    }catch(e){ it.err = /암호/.test(e.message) ? e.message : "PDF를 읽지 못했습니다. 손상되었거나 PDF가 아닌 파일입니다."; }
    files.push(it);
  }
  if(single && fs.length>1) toast("나누기·쪽 뽑기는 한 번에 PDF 하나만 씁니다. 첫 파일을 넣었습니다");
  clearOut(); draw(); if(job()==="pick") thumbs();
}
function draw(){
  const j = job();
  $("pmSplit").hidden = j!=="split"; $("pmPick").hidden = j!=="pick";
  $("pmEveryRow").hidden = how()!=="every"; $("pmRangesRow").hidden = how()!=="ranges";
  $("pmDropT").textContent = j==="merge" ? "여기를 눌러 PDF를 고르거나 끌어다 놓으세요" : "여기를 눌러 PDF 하나를 고르거나 끌어다 놓으세요";
  $("pmDropS").textContent = j==="merge" ? "합칠 PDF를 여러 개 넣고 순서를 바꿀 수 있습니다" : files.length ? "다른 PDF를 넣으면 바뀝니다" : "PDF 한 개";
  $("pmFile").multiple = j==="merge";
  $("pmList").innerHTML = files.map((f,i)=>`<li draggable="${j==="merge"}" data-i="${i}" class="${f.err?"bad":""}${j==="merge"?"":" one"}">
      ${j==="merge"?`<span class="pmgrip" aria-hidden="true">⋮⋮</span>`:""}<div class="pmn"><b>${esc(f.name)}</b><span>${f.err?esc(f.err):`${f.n}쪽 · ${kb(f.size)}`}</span></div>
      ${j==="merge"&&!f.err?`<input type="text" data-r="${i}" value="${esc(f.range||"")}" placeholder="쪽 범위(비우면 전체)" aria-label="${esc(f.name)} 쪽 범위">`:""}
      <span class="pmbtn">${j==="merge"?`<button type="button" data-up="${i}" aria-label="위로" ${i?"":"disabled"}>▲</button><button type="button" data-dn="${i}" aria-label="아래로" ${i<files.length-1?"":"disabled"}>▼</button>`:""}<button type="button" data-rm="${i}" aria-label="빼기">✕</button></span></li>`).join("");
  const ok = files.filter(f=>!f.err), total = ok.reduce((a,f)=>a+f.n,0);
  say(!files.length ? "" : j==="merge" ? `${ok.length}개 파일 · 모두 ${total}쪽` : ok[0] ? `${ok[0].n}쪽` : "");
  if(j==="pick") syncSel();
  const nm = $("pmName"); if(!nm.dataset.touched) nm.value = j==="merge" ? "합친파일" : ok[0] ? base(ok[0].name)+(j==="split"?"-나눔":"-뽑은쪽") : "";
  $("pmGo").disabled = busy || !ok.length || (j==="merge" && ok.length<2 && !ok.some(f=>f.range)) || (j==="pick" && !sel.size);
  $("pmGo").textContent = j==="merge" ? "PDF 합치기" : j==="split" ? "나눠서 ZIP으로 받기" : keepSel() ? `고른 ${sel.size}쪽으로 PDF 만들기` : `고른 ${sel.size}쪽 빼고 저장`;
  $("pmHint").textContent = j==="merge" && ok.length===1 ? "합칠 PDF를 하나 더 넣으세요. 한 파일만 넣었다면 쪽 범위를 적어 그 쪽만 저장할 수 있습니다." : "";
}
// 쪽 고르기(미리 보기)
const pickN = ()=>{ const f = files.find(x=>!x.err); return f ? f.n : 0; };
function syncSel(){
  $("pmPages").querySelectorAll(".pmpg").forEach(el=>el.classList.toggle("on", sel.has(+el.dataset.p)));
  if(document.activeElement!==$("pmSel")) $("pmSel").value = fmtRanges([...sel].sort((a,b)=>a-b));
}
async function thumbs(){
  const f = files.find(x=>!x.err); $("pmPages").innerHTML = ""; if(obs) obs.disconnect(); if(thumbDoc){ thumbDoc.destroy(); thumbDoc = null; }
  if(!f) return;
  $("pmPages").innerHTML = Array.from({length:f.n},(_,i)=>`<button type="button" class="pmpg" data-p="${i+1}" aria-label="${i+1}쪽"><canvas></canvas><span>${i+1}</span></button>`).join("");
  syncSel();
  try{
    if(!pdfjs){ pdfjs = await import("/lib/pdfjs/pdf.min.js"); pdfjs.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.js"; }
    const doc = thumbDoc = await pdfjs.getDocument({data: f.bytes.slice(0), cMapUrl:"/lib/pdfjs/cmaps/", cMapPacked:true}).promise;
    const q = []; let running = false;
    const run = async ()=>{ if(running) return; running = true;
      while(q.length && thumbDoc===doc){ const el = q.shift(); try{ const pg = await doc.getPage(+el.dataset.p), v1 = pg.getViewport({scale:1}), s = 220/v1.width, vp = pg.getViewport({scale:s});
        const cv = el.querySelector("canvas"); cv.width = vp.width; cv.height = vp.height; await pg.render({canvasContext: cv.getContext("2d"), viewport: vp}).promise; el.classList.add("done"); }catch(_){} }
      running = false; };
    obs = new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ obs.unobserve(e.target); q.push(e.target); } }); run(); }, {rootMargin:"300px"});
    $("pmPages").querySelectorAll(".pmpg").forEach(el=>obs.observe(el));
  }catch(_){ /* 미리 보기가 안 돼도 쪽 번호로 고를 수 있다 */ }
}
function clearOut(){ outs.forEach(o=>URL.revokeObjectURL(o.url)); outs = []; $("pmOut").innerHTML = ""; }

async function build(){
  const L = await lib(), j = job(), ok = files.filter(f=>!f.err); if(!ok.length) return;
  const mk = ()=>L.PDFDocument.create({updateMetadata:false});
  const load = f=>L.PDFDocument.load(f.bytes, {ignoreEncryption:true, updateMetadata:false});
  const save = async (d, name)=>{ const b = new Blob([await d.save()], {type:"application/pdf"}); return {name, blob:b, url:URL.createObjectURL(b), n:d.getPageCount()}; };
  const nm = ($("pmName").value.trim() || "문서").replace(/[\\/:*?"<>|]/g,"_").replace(/\.pdf$/i,"");
  const res = [];
  if(j==="merge"){
    const out = await mk();
    for(let k=0;k<ok.length;k++){ const f = ok[k], src = await load(f), n = src.getPageCount();
      const ps = f.range ? pagesOf(f.range, n) : Array.from({length:n},(_,i)=>i+1);
      if(ps==null) throw new Error(`'${f.name}'의 쪽 범위를 읽지 못했습니다.`);
      (await out.copyPages(src, ps.map(p=>p-1))).forEach(p=>out.addPage(p)); bar((k+1)/ok.length); }
    res.push(await save(out, nm+".pdf"));
  }else if(j==="split"){
    const f = ok[0], src = await load(f), n = src.getPageCount(); let groups;
    if(how()==="each") groups = Array.from({length:n},(_,i)=>[i+1,i+1]);
    else if(how()==="every"){ const k = Math.max(1, Math.floor(+$("pmEvery").value||1)); groups = []; for(let a=1;a<=n;a+=k) groups.push([a, Math.min(n,a+k-1)]); }
    else { groups = ranges($("pmRanges").value, n); if(!groups || !groups.length) throw new Error("범위를 '1-3, 4-10' 처럼 적어 주세요."); }
    if(groups.length>300) throw new Error("파일이 300개를 넘습니다. '몇 쪽씩'으로 묶어 주세요.");
    const w = String(n).length;
    for(let k=0;k<groups.length;k++){ const [a,b] = groups[k], d = await mk();
      (await d.copyPages(src, Array.from({length:b-a+1},(_,i)=>a-1+i))).forEach(p=>d.addPage(p));
      res.push(await save(d, `${nm}-${a===b?String(a).padStart(w,"0"):String(a).padStart(w,"0")+"~"+String(b).padStart(w,"0")}쪽.pdf`)); bar((k+1)/groups.length); }
  }else{
    const f = ok[0], src = await load(f), n = src.getPageCount(), keep = keepSel(), rot = $("pmRot").checked;
    const chosen = [...sel].filter(p=>p>=1&&p<=n).sort((a,b)=>a-b);
    const ps = keep ? chosen : Array.from({length:n},(_,i)=>i+1).filter(p=>!sel.has(p));
    if(!ps.length) throw new Error(keep ? "뽑을 쪽을 고르세요." : "모든 쪽을 빼면 남는 쪽이 없습니다.");
    const d = await mk(), cp = await d.copyPages(src, ps.map(p=>p-1));
    cp.forEach((p,i)=>{ if(rot && keep) p.setRotation(L.degrees(((p.getRotation().angle||0)+90)%360)); d.addPage(p); });
    if(rot && !keep) toast("돌리기는 '고른 쪽만 새 PDF로'에서만 됩니다");
    res.push(await save(d, nm+".pdf"));
  }
  return res;
}
const bar = r=>{ $("pmBar").hidden = r==null || r>=1; if(r!=null) $("pmBar").firstElementChild.style.width = Math.round(r*100)+"%"; };
async function go(){
  if(busy) return; busy = true; draw(); clearOut(); bar(0); $("pmHint").textContent = "만드는 중…";
  try{
    const res = await build(); outs = res;
    $("pmOut").innerHTML = res.slice(0,60).map(o=>`<div class="hitem"><div class="hthumb pmico">PDF</div><div><b>${esc(o.name)}</b><span>${o.n}쪽 · ${kb(o.blob.size)}</span></div><a class="ghost" href="${o.url}" download="${esc(o.name)}">내려받기</a></div>`).join("")
      + (res.length>60 ? `<p class="hint">… 외 ${res.length-60}개 (ZIP에 모두 들어 있습니다)</p>` : "");
    if(res.length===1){ const a = document.createElement("a"); a.href = res[0].url; a.download = res[0].name; a.click(); $("pmHint").textContent = `${res[0].n}쪽짜리 PDF를 만들었습니다. 내려받기가 시작되지 않으면 위 버튼을 누르세요.`; }
    else { await script(ZIP, ()=>!!window.JSZip); const z = new JSZip(); res.forEach(o=>z.file(o.name, o.blob));
      const b = await z.generateAsync({type:"blob"}), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = ($("pmName").value.trim()||"나눈파일")+".zip"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
      $("pmHint").textContent = `${res.length}개 파일로 나눠 ZIP으로 내려받았습니다. 하나씩 받으려면 위 목록을 쓰세요.`; }
  }catch(e){ $("pmHint").textContent = e.message || "만들지 못했습니다."; }
  finally{ busy = false; bar(null); draw(); }
}

// ---------- 이벤트 ----------
$("pmFile").addEventListener("change", e=>{ addFiles(e.target.files); e.target.value=""; });
const drop = $("pmDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>addFiles(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("pmFile").click(); } });
const L0 = $("pmList");
L0.addEventListener("click", e=>{ const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.rm!=null){ files.splice(+b.dataset.rm,1); if(job()==="pick"){ sel.clear(); thumbs(); } }
  else if(b.dataset.up!=null){ const i=+b.dataset.up; [files[i-1],files[i]]=[files[i],files[i-1]]; }
  else if(b.dataset.dn!=null){ const i=+b.dataset.dn; [files[i+1],files[i]]=[files[i],files[i+1]]; }
  clearOut(); draw(); });
L0.addEventListener("input", e=>{ const r = e.target.closest("input[data-r]"); if(!r) return; files[+r.dataset.r].range = r.value; clearOut();
  const f = files[+r.dataset.r]; r.classList.toggle("bad", !!r.value.trim() && !pagesOf(r.value, f.n)?.length); $("pmGo").disabled = busy || files.filter(f=>!f.err).length<1; });
let dragI = null;
L0.addEventListener("dragstart", e=>{ const li = e.target.closest("li"); if(!li) return; dragI = +li.dataset.i; e.dataTransfer.effectAllowed = "move"; li.classList.add("dragging"); });
L0.addEventListener("dragover", e=>{ if(dragI==null) return; e.preventDefault(); });
L0.addEventListener("drop", e=>{ if(dragI==null) return; e.preventDefault(); e.stopPropagation(); const li = e.target.closest("li"); if(li){ const to = +li.dataset.i, [m] = files.splice(dragI,1); files.splice(to,0,m); } dragI = null; clearOut(); draw(); });
L0.addEventListener("dragend", ()=>{ dragI = null; draw(); });
$("pmPages").addEventListener("click", e=>{ const b = e.target.closest(".pmpg"); if(!b) return; const p = +b.dataset.p; sel.has(p) ? sel.delete(p) : sel.add(p); clearOut(); syncSel(); draw(); });
$("pmSel").addEventListener("input", ()=>{ const ps = pagesOf($("pmSel").value, pickN()); $("pmSel").classList.toggle("bad", ps==null); if(ps){ sel = new Set(ps); clearOut(); syncSel(); draw(); } });
$("pmSel").addEventListener("blur", syncSel);
$("pmAll").addEventListener("click", ()=>{ sel = new Set(Array.from({length:pickN()},(_,i)=>i+1)); clearOut(); syncSel(); draw(); });
$("pmNone").addEventListener("click", ()=>{ sel.clear(); clearOut(); syncSel(); draw(); });
document.querySelectorAll('input[name=pmJob]').forEach(r=>r.addEventListener("change", ()=>{
  if(job()!=="merge" && files.length>1){ files = files.slice(0,1); toast("나누기·쪽 뽑기는 PDF 하나만 씁니다. 첫 파일만 남겼습니다"); }
  sel.clear(); clearOut(); draw(); if(job()==="pick") thumbs(); }));
document.querySelectorAll('input[name=pmHow],input[name=pmKeep]').forEach(r=>r.addEventListener("change", ()=>{ clearOut(); draw(); }));
["pmEvery","pmRanges","pmRot"].forEach(id=>$(id).addEventListener("input", clearOut));
$("pmName").addEventListener("input", ()=>{ $("pmName").dataset.touched = "1"; });
$("pmGo").addEventListener("click", go);
draw();
})();

// SHIFT AI 무료 도구 — HEIC를 JPG/PNG로. /lib/heic-to/heic-to.js(heic-to, LGPL-3.0, libheif 포함)를 처음 필요할 때 받아 브라우저 안에서만 바꾼다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("hDrop")) return;
const LIB = "/lib/heic-to/heic-to.js", ZIP = "/lib/jszip/jszip.min.js", MAX = 30;
const items = [];              // {name, out, blob, url, size, err}
let queue = Promise.resolve(), busy = 0, done = 0, total = 0;
let toastT; const toast = m=>{ const t=document.getElementById("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const kb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const load = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다")); document.head.appendChild(s); });
const type = ()=>document.querySelector('input[name=hType]:checked').value;
const looksHeic = f=>/\.(heic|heif)$/i.test(f.name||"") || /hei[cf]/i.test(f.type||"");

function draw(){
  $("hList").innerHTML = items.map((it,i)=> it.err
    ? `<div class="hitem bad"><div class="hthumb"></div><div><b>${esc(it.name)}</b><span>${esc(it.err)}</span></div></div>`
    : it.url ? `<div class="hitem"><img class="hthumb" src="${it.url}" alt=""><div><b>${esc(it.out)}</b><span>${kb(it.blob.size)} · 원본 ${kb(it.size)}</span></div><a class="ghost" href="${it.url}" download="${esc(it.out)}">내려받기</a></div>`
    : `<div class="hitem wait"><div class="hthumb"></div><div><b>${esc(it.name)}</b><span>바꾸는 중…</span></div></div>`).join("");
  $("hZip").disabled = !items.some(it=>it.blob) || busy>0;
  if(total){ $("hBar").hidden = busy===0; $("hBar").firstElementChild.style.width = Math.round(done/total*100)+"%"; }
}
async function convert(it, file){
  try{
    $("hStatus").textContent = "변환 프로그램을 준비하는 중입니다… (처음 한 번만 몇 초 걸립니다)";
    await load(LIB, ()=>typeof window.HeicTo==="function");
    $("hStatus").textContent = `${done+1} / ${total}장 바꾸는 중…`;
    const t = type(), q = +$("hQ").value/100;
    const blob = await window.HeicTo({blob: file, type: t, quality: q});
    it.blob = blob; it.url = URL.createObjectURL(blob);
    it.out = (it.name.replace(/\.(heic|heif)$/i,"") || "photo") + (t==="image/png" ? ".png" : ".jpg");
  }catch(e){ it.err = "바꾸지 못했습니다. HEIC 파일이 맞는지, 손상되지 않았는지 확인하세요."; }
  finally{ done++; busy--; draw(); if(!busy) $("hStatus").textContent = `${items.filter(x=>x.blob).length}장을 바꿨습니다.`; }
}
function add(list){
  let skipped = 0;
  for(const f of list){
    if(!f) continue;
    if(!looksHeic(f)){ skipped++; continue; }
    if(items.length >= MAX){ toast(`한 번에 ${MAX}장까지 바꿀 수 있습니다`); break; }
    const it = {name: f.name || `사진 ${items.length+1}.heic`, size: f.size};
    items.push(it); busy++; total++;
    queue = queue.then(()=>convert(it, f));
  }
  if(skipped) toast("HEIC·HEIF가 아닌 파일은 뺐습니다. JPG·PNG는 바꿀 필요가 없습니다");
  draw();
}
$("hFile").addEventListener("change", e=>{ add(e.target.files); e.target.value=""; });
const drop = $("hDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>add(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("hFile").click(); } });
const syncQ = ()=>{ $("hQv").textContent = $("hQ").value; $("hQWrap").hidden = type()==="image/png"; };
$("hQ").addEventListener("input", syncQ);
document.querySelectorAll('input[name=hType]').forEach(r=>r.addEventListener("change", syncQ));
$("hClear").addEventListener("click", ()=>{ if(busy) return toast("바꾸는 중에는 지울 수 없습니다"); items.forEach(it=>it.url&&URL.revokeObjectURL(it.url)); items.length=0; done=total=0; $("hBar").hidden=true; $("hStatus").textContent="사진을 넣으면 바로 바꿉니다."; draw(); });
$("hZip").addEventListener("click", async ()=>{
  const ok = items.filter(it=>it.blob); if(!ok.length) return;
  $("hZip").disabled = true; $("hStatus").textContent = "ZIP 파일을 만드는 중입니다…";
  try{
    await load(ZIP, ()=>typeof window.JSZip==="function");
    const z = new JSZip(), used = {};
    ok.forEach(it=>{ let n = it.out, k = 2; while(used[n]) n = it.out.replace(/(\.\w+)$/, `-${k++}$1`); used[n]=1; z.file(n, it.blob); });
    const b = await z.generateAsync({type:"blob"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "바꾼사진.zip"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
    $("hStatus").textContent = `${ok.length}장을 ZIP으로 내려받았습니다.`;
  }catch(_){ $("hStatus").textContent = "ZIP 파일을 만들지 못했습니다. 한 장씩 내려받아 주세요."; }
  finally{ $("hZip").disabled = false; }
});
syncQ(); draw();
})();

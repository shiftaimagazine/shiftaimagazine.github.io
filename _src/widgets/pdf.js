// SHIFT AI 무료 도구 — PDF 글자 뽑기(텍스트·마크다운). PDF.js(Apache-2.0, /lib/pdfjs/)로 이 브라우저 안에서만 읽는다. 파일은 어디에도 보내지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("pFile")) return;
const say = (m)=>{ $("pStatus").textContent = m; };
const bar = (r)=>{ $("pBar").hidden = r==null; if(r!=null) $("pBar").firstElementChild.style.width = Math.round(r*100)+"%"; };
let lib = null, busy = false, pages = [], fname = "pdf";

async function load(){
  if(lib) return lib;
  lib = await import("/lib/pdfjs/pdf.min.js");
  lib.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.js";
  return lib;
}
// "1-5, 8" → [1,2,3,4,5,8] (n 쪽까지)
function range(s, n){
  s = (s||"").replace(/\s/g,""); if(!s) return Array.from({length:n},(_,i)=>i+1);
  const out = new Set();
  for(const part of s.split(/[,，]/)){
    const m = part.match(/^(\d+)(?:[-~](\d+))?$/); if(!m) continue;
    let a = +m[1], b = m[2] ? +m[2] : a; if(a>b) [a,b]=[b,a];
    for(let i=Math.max(1,a); i<=Math.min(n,b); i++) out.add(i);
  }
  return [...out].sort((x,y)=>x-y);
}
// 한 쪽의 글자 조각을 줄로 묶는다: 같은 높이(y)면 한 줄, 줄 사이가 넓으면 문단 나눔
function linesOf(items){
  const rows = [];
  for(const it of items){
    if(!("str" in it)) continue;
    const y = it.transform[5], h = Math.abs(it.transform[3]) || it.height || 10, x = it.transform[4];
    let r = rows.find(r=>Math.abs(r.y - y) < Math.max(2, h*0.45));
    if(!r){ r = {y, h, parts:[]}; rows.push(r); }
    r.h = Math.max(r.h, h); r.parts.push({x, s: it.str, w: it.width||0});
  }
  rows.sort((a,b)=>b.y - a.y);
  return rows.map(r=>{
    r.parts.sort((a,b)=>a.x-b.x);
    let t = "", end = null;
    for(const p of r.parts){
      if(end!=null && p.x - end > r.h*0.25 && !/\s$/.test(t) && !/^\s/.test(p.s)) t += " ";
      t += p.s; end = p.x + p.w;
    }
    return {y:r.y, h:r.h, t:t.replace(/\s+/g," ").trim()};
  }).filter(l=>l.t);
}
const norm = s=>s.replace(/\d+/g,"#").replace(/\s/g,"");
async function read(file){
  busy = true; pages = []; $("pCopy").disabled = $("pDown").disabled = true; $("pOut").value = ""; $("pSum").textContent = ""; $("pScan").hidden = true;
  fname = (file.name||"pdf").replace(/\.pdf$/i,"") || "pdf";
  try{
    say("PDF 읽는 프로그램을 불러오는 중…"); bar(0);
    const L = await load();
    const buf = await file.arrayBuffer();
    const doc = await L.getDocument({data: buf, isEvalSupported:false, cMapUrl:"/lib/pdfjs/cmaps/", cMapPacked:true, useSystemFonts:false, disableFontFace:true}).promise;
    const want = range($("pRange").value, doc.numPages);
    if(!want.length){ say("쪽 범위를 다시 확인해 주세요. 이 PDF는 "+doc.numPages+"쪽입니다."); return; }
    for(let k=0; k<want.length; k++){
      const n = want[k]; say(`${n}쪽 읽는 중… (${k+1}/${want.length})`); bar(k/want.length);
      const pg = await doc.getPage(n); const tc = await pg.getTextContent();
      pages.push({n, lines: linesOf(tc.items)}); pg.cleanup();
    }
    await doc.destroy();
    bar(null); render();
    const empty = pages.filter(p=>p.lines.map(l=>l.t).join("").replace(/\s/g,"").length < 20).map(p=>p.n);
    if(empty.length){ $("pScan").hidden = false; $("pScan").innerHTML = `글자가 거의 없는 쪽: ${empty.length>12 ? empty.slice(0,12).join(", ")+" 외 "+(empty.length-12)+"쪽" : empty.join(", ")}쪽. 스캔본이거나 그림만 있는 쪽일 수 있습니다. 그 쪽을 이미지로 저장해 <a href="/tools/ocr/">사진 속 글자 뽑기</a>로 읽어 보세요.`; }
  }catch(e){
    bar(null);
    const n = e && e.name;
    say(n==="PasswordException" ? "암호가 걸린 PDF는 읽을 수 없습니다. 암호를 푼 사본을 넣어 주세요." : n==="InvalidPDFException" ? "PDF 파일이 아니거나 손상된 파일입니다." : "읽지 못했습니다. 다른 PDF로 해 보거나 쪽 범위를 줄여 보세요.");
  }finally{ busy = false; }
}
function render(){
  if(!pages.length) return;
  const md = document.querySelector('input[name=pFmt]:checked').value==="md";
  const join = $("pJoin").checked, mark = $("pMark").checked;
  // 머리글·바닥글·쪽 번호: 여러 쪽의 위아래 두 줄에 똑같이(숫자만 다르게) 나오는 줄
  const rep = new Set();
  if($("pHead").checked && pages.length>=2){
    const cnt = {};
    pages.forEach(p=>{ const ed = new Set([...p.lines.slice(0,2), ...p.lines.slice(-2)].map(l=>norm(l.t))); ed.forEach(k=>cnt[k]=(cnt[k]||0)+1); });
    Object.entries(cnt).forEach(([k,c])=>{ if(c>=Math.max(2, Math.ceil(pages.length*0.5)) && k.length<=80) rep.add(k); });
    rep.add("#"); rep.add("-#-"); rep.add("#/#");
  }
  const allH = pages.flatMap(p=>p.lines.map(l=>l.h)).sort((a,b)=>a-b), med = allH[Math.floor(allH.length/2)] || 10;
  let out = [], chars = 0;
  for(const p of pages){
    const ls = p.lines.filter((l,i)=>!(rep.has(norm(l.t)) && (i<2 || i>=p.lines.length-2)));
    if(mark) out.push(md ? `\n<!-- ${p.n}쪽 -->` : `\n[${p.n}쪽]`);
    let para = [], prev = null;
    const flush = ()=>{ if(para.length){ out.push(join ? para.reduce((a,b)=>/[-‐]$/.test(a)&&/^[a-z]/.test(b)?a.slice(0,-1)+b:a+" "+b) : para.join("\n")); para = []; } };
    for(const l of ls){
      const head = md && l.h >= med*1.3 && l.t.length <= 60;
      const bullet = /^[•·▪●○◦■□\-–]\s*/.test(l.t);
      const gap = prev ? (prev.y - l.y) > Math.max(prev.h, l.h)*1.7 : true;
      if(head){ const mk = l.h >= med*1.7 ? "# " : "## ";
        if(!para.length && prev && prev.head===mk && Math.abs(prev.h-l.h)<1 && (prev.y-l.y) < l.h*1.8){ out[out.length-1] += " " + l.t; }
        else { flush(); out.push(mk + l.t); }
        prev = Object.assign({}, l, {head: mk}); continue; }
      if(bullet){ flush(); out.push(md ? l.t.replace(/^[•·▪●○◦■□\-–]\s*/,"- ") : l.t); prev = l; continue; }
      if(gap || !join) flush();
      para.push(l.t); prev = l;
    }
    flush();
    chars += ls.reduce((s,l)=>s+l.t.length,0);
  }
  const txt = out.join("\n\n").replace(/\n{3,}/g,"\n\n").trim();
  $("pOut").value = txt; $("pOut").readOnly = false;
  $("pCopy").disabled = $("pDown").disabled = !txt;
  say(`다 읽었습니다. ${pages.length}쪽에서 ${chars.toLocaleString("ko-KR")}자를 뽑았습니다.`);
  $("pSum").textContent = rep.size>3 ? `반복되는 머리글·바닥글 ${rep.size-3}종을 뺐습니다. 결과 칸에서 바로 고칠 수 있습니다.` : "결과 칸에서 바로 고칠 수 있습니다.";
}

$("pFile").addEventListener("change", e=>{ const f=e.target.files[0]; e.target.value=""; if(f && !busy) read(f); });
const drop = $("pDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>{ const f=[...e.dataTransfer.files].find(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name)); if(!f) return say("PDF 파일만 넣을 수 있습니다."); if(!busy) read(f); });
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("pFile").click(); } });
["pJoin","pHead","pMark"].forEach(id=>$(id).addEventListener("change", render));
document.querySelectorAll('input[name=pFmt]').forEach(r=>r.addEventListener("change", render));
$("pCopy").addEventListener("click", ()=>{ const t=$("pOut").value; if(!t) return;
  (navigator.clipboard&&navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast("복사했습니다"), ()=>{ $("pOut").select(); toast("길게 눌러 복사해 주세요"); }); });
$("pDown").addEventListener("click", ()=>{ const t=$("pOut").value; if(!t) return; const md=document.querySelector('input[name=pFmt]:checked').value==="md";
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([t],{type:md?"text/markdown":"text/plain"})); a.download=fname+(md?".md":".txt"); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000); });
window.addEventListener("pagehide", ()=>{ pages = []; $("pOut").value = ""; });
})();

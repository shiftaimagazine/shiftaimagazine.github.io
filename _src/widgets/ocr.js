// SHIFT AI 무료 도구 — 사진 속 글자 뽑기(한국어 OCR). tesseract.js 를 /lib/tesseract/ 에서 받아 브라우저 안에서만 읽는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("oDrop")) return;
const LIB = "/lib/tesseract/";
const MAX = 12;                       // 한 번에 읽을 사진 수
const imgs = [];                      // {name, url, file}
let busy = false, worker = null, workerLang = "";

let toastT; const toast = msg=>{ const t=document.getElementById("toast"); if(!t) return; t.textContent=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ---------- 사진 넣기 ----------
// 아이폰 HEIC 는 /lib/heic-to/(heic-to, LGPL-3.0)로 브라우저 안에서 JPG 로 바꾼 뒤 넣는다(11/2~)
const HEIC_LIB = "/lib/heic-to/heic-to.js";
const isHeic = f=>/heic|heif/i.test(f.type||"") || /\.hei[cf]$/i.test(f.name||"");
const loadHeic = ()=> typeof window.HeicTo==="function" ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=HEIC_LIB; s.onload=ok; s.onerror=()=>no(new Error("heic")); document.head.appendChild(s); });
async function fromHeic(list){
  toast(`아이폰 사진 ${list.length}장을 JPG로 바꾸는 중입니다`);
  const out = [];
  try{ await loadHeic(); for(const f of list){ try{ const b = await window.HeicTo({blob:f, type:"image/jpeg", quality:0.95}); out.push(new File([b], (f.name||"photo").replace(/\.(heic|heif)$/i,"")+".jpg", {type:"image/jpeg"})); }catch(_){ } } }
  catch(_){ toast("HEIC 변환 프로그램을 받지 못했습니다"); }
  if(out.length) addFiles(out); if(out.length < list.length) toast("바꾸지 못한 HEIC 사진이 있습니다");
}
function addFiles(list){
  let skipped = 0; const heics = [];
  for(const f of list){
    if(f && isHeic(f)){ heics.push(f); continue; }
    if(!f || !/^image\//.test(f.type)){ skipped++; continue; }
    if(imgs.length >= MAX){ toast(`한 번에 ${MAX}장까지 읽을 수 있습니다`); break; }
    imgs.push({name: f.name || `붙여 넣은 사진 ${imgs.length+1}`, url: URL.createObjectURL(f), file: f});
  }
  if(skipped) toast("열 수 없는 파일은 뺐습니다(PNG·JPG·WebP·HEIC만)");
  drawThumbs();
  if(heics.length) fromHeic(heics);
}
function drawThumbs(){
  $("oThumbs").innerHTML = imgs.map((im,i)=>`<figure><img src="${im.url}" alt=""><figcaption>${i+1}. ${esc(im.name)}</figcaption><button type="button" data-rm="${i}" aria-label="${i+1}번 사진 빼기">×</button></figure>`).join("");
  $("oRun").disabled = !imgs.length || busy;
  $("oStatus").textContent = imgs.length ? `사진 ${imgs.length}장을 읽을 준비가 됐습니다.` : "사진을 넣으면 시작할 수 있습니다.";
}
$("oThumbs").addEventListener("click", e=>{ const b=e.target.closest("button[data-rm]"); if(!b||busy) return; const i=+b.dataset.rm; URL.revokeObjectURL(imgs[i].url); imgs.splice(i,1); drawThumbs(); });
$("oFile").addEventListener("change", e=>{ addFiles(e.target.files); e.target.value=""; });
const drop = $("oDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>addFiles(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("oFile").click(); } });
document.addEventListener("paste", e=>{
  if(e.target && (e.target.id==="oOut")) return;  // 결과 칸에 글을 붙여 넣는 것은 그대로
  const files = [...(e.clipboardData?.items||[])].filter(it=>it.kind==="file").map(it=>it.getAsFile()).filter(Boolean);
  if(files.length){ e.preventDefault(); addFiles(files); toast(`사진 ${files.length}장을 붙여 넣었습니다`); }
});

// ---------- 읽기 ----------
const loadLib = ()=> window.Tesseract ? Promise.resolve() : new Promise((ok,no)=>{
  const s=document.createElement("script"); s.src=LIB+"tesseract.min.js"; s.onload=ok; s.onerror=()=>no(new Error("글자 인식 엔진을 받지 못했습니다")); document.head.appendChild(s); });
const bar = p=>{ $("oBar").hidden=false; $("oBar").firstElementChild.style.width = Math.round(Math.max(0,Math.min(1,p))*100)+"%"; };
let stage = {i:0, n:1};
function log(m){
  if(m.status==="recognizing text") bar((stage.i + (m.progress||0)) / stage.n);
  else if(/loading|initializ/.test(m.status||"")) $("oStatus").textContent = "글자 인식 데이터를 준비하는 중입니다… (처음 한 번만 오래 걸립니다)";
}
async function getWorker(lang){
  if(worker && workerLang===lang) return worker;
  if(worker){ await worker.terminate(); worker=null; }
  await loadLib();
  worker = await Tesseract.createWorker(lang.split("+"), 1, {   // 1 = LSTM 엔진만
    workerPath: LIB+"worker.min.js", corePath: LIB, langPath: LIB+"lang", gzip: true, logger: log });
  workerLang = lang; return worker;
}
function loadImg(url){ return new Promise((ok,no)=>{ const im=new Image(); im.onload=()=>ok(im); im.onerror=()=>no(new Error("사진을 열지 못했습니다")); im.src=url; }); }
async function prep(url){
  const im = await loadImg(url);
  let w = im.naturalWidth, h = im.naturalHeight, k = 1;
  if($("oScale").checked && Math.max(w,h) < 1600) k = Math.min(2, 3200/Math.max(w,h));
  if(Math.max(w,h)*k > 4200) k = 4200/Math.max(w,h);
  const c = document.createElement("canvas"); c.width = Math.round(w*k); c.height = Math.round(h*k);
  const g = c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height);
  g.imageSmoothingQuality="high"; g.drawImage(im,0,0,c.width,c.height);
  if($("oGray").checked){
    const d = g.getImageData(0,0,c.width,c.height), a=d.data;
    for(let i=0;i<a.length;i+=4){ const y = .299*a[i]+.587*a[i+1]+.114*a[i+2]; a[i]=a[i+1]=a[i+2]=y; }
    g.putImageData(d,0,0);
  }
  return c;
}
function tidy(t){
  t = t.replace(/ㆍ/g,"·").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  if($("oJoin").checked){
    // 문장이 끝나지 않은 줄은 다음 줄과 잇는다(빈 줄은 문단 경계로 남김)
    t = t.split(/\n{2,}/).map(par=>par.split("\n").reduce((acc,ln)=>{
      if(!acc) return ln;
      return /[.!?。:;)\]」』"']$|다$|요$/.test(acc.trim()) || /^\s*(?:[-•·*]|\d+[.)])\s/.test(ln) ? acc+"\n"+ln : acc+" "+ln.trim();
    }, "")).join("\n\n");
  }
  return t;
}
$("oRun").addEventListener("click", async ()=>{
  if(busy || !imgs.length) return;
  busy = true; $("oRun").disabled = true; $("oLow").hidden = true;
  const lang = document.querySelector('input[name=olang]:checked').value;
  const out = [], low = [];
  let conf = [], t0 = Date.now();
  try{
    $("oStatus").textContent = "글자 인식 엔진을 여는 중입니다…"; bar(0);
    const w = await getWorker(lang);
    stage.n = imgs.length;
    for(let i=0;i<imgs.length;i++){
      stage.i = i;
      $("oStatus").textContent = `${i+1} / ${imgs.length}장 읽는 중…`;
      const canvas = await prep(imgs[i].url);
      const r = await w.recognize(canvas, {}, {text:true, blocks:true});
      const text = tidy(r.data.text||"");
      out.push(imgs.length>1 ? `--- 사진 ${i+1}: ${imgs[i].name} ---\n${text}` : text);
      conf.push(r.data.confidence||0);
      for(const b of r.data.blocks||[]) for(const p of b.paragraphs||[]) for(const l of p.lines||[]) for(const wd of l.words||[])
        if(wd.confidence < 60 && wd.text.trim().length > 0) low.push(wd.text.trim());
    }
    bar(1);
    const all = out.join("\n\n");
    $("oOut").value = all;
    const chars = all.replace(/\s/g,"").length, avg = conf.length ? Math.round(conf.reduce((a,b)=>a+b,0)/conf.length) : 0;
    const sec = ((Date.now()-t0)/1000).toFixed(1);
    $("oSum").innerHTML = chars ? `사진 ${imgs.length}장에서 <b>${chars.toLocaleString("ko-KR")}자</b>를 뽑았습니다 · 엔진이 매긴 확신도 평균 ${avg}점 · ${sec}초`
                                : `글자를 찾지 못했습니다. 사진이 흐리거나 글씨가 너무 작은지 확인하고, '작은 글씨 키워서 읽기'를 켠 채 다시 해 보세요.`;
    const uniq = [...new Set(low)].slice(0,40);
    if(uniq.length){ $("oLow").hidden=false; $("oLow").innerHTML = `<b>확신이 낮은 글자 ${low.length}곳</b>(원본과 대조해 보세요): ${uniq.map(x=>`<span>${esc(x)}</span>`).join("")}`; }
    $("oStatus").textContent = "다 읽었습니다.";
  }catch(err){
    $("oStatus").textContent = (err && err.message) ? `읽지 못했습니다: ${err.message}` : "읽지 못했습니다. 새로고침한 뒤 다시 해 보세요.";
    try{ if(worker){ await worker.terminate(); } }catch(_){}
    worker = null; workerLang = "";
  }finally{
    busy = false; $("oRun").disabled = !imgs.length;
    setTimeout(()=>{ $("oBar").hidden = true; }, 600);
  }
});

// ---------- 결과 ----------
async function copy(text, done){
  try{ await navigator.clipboard.writeText(text); toast(done); }
  catch(_){ const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast(done); }catch(__){ toast("길게 눌러 복사해 주세요"); } ta.remove(); }
}
$("oCopy").addEventListener("click", ()=>{ const t=$("oOut").value.trim(); if(!t) return toast("먼저 글자를 뽑아 주세요"); copy(t, "복사했습니다"); });
$("oDown").addEventListener("click", ()=>{
  const t=$("oOut").value.trim(); if(!t) return toast("먼저 글자를 뽑아 주세요");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["﻿"+t],{type:"text/plain;charset=utf-8"})); a.download="뽑은글자.txt"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
});
$("oAi").addEventListener("click", ()=>{
  const t=$("oOut").value.trim(); if(!t) return toast("먼저 글자를 뽑아 주세요");
  const p = "아래는 사진에서 글자 인식(OCR)으로 뽑은 글입니다. 인식 과정에서 생긴 오탈자와 잘못 끊긴 줄을 바로잡아 읽기 좋게 정리해 주세요.\n"
    + "1) 원래 있던 문장과 숫자는 바꾸지 말고, 확실한 인식 오류만 고쳐 주세요.\n"
    + "2) 표처럼 보이는 부분은 표로 다시 만들어 주세요.\n"
    + "3) 무엇인지 확실하지 않은 글자나 숫자는 고치지 말고 [확인 필요]라고 표시해 주세요.\n\n"
    + "뽑은 글:\n" + t;
  copy(p, "프롬프트로 복사했습니다. 챗GPT·클로드·제미나이에 붙여 넣으세요");
});
drawThumbs();
})();

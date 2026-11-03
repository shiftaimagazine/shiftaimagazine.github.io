// SHIFT AI 무료 도구 — 이미지 압축·인스타 규격 자르기. 사진은 캔버스로만 다시 그려 이 브라우저 안에서 만든다(사진 정보는 남지 않음). ZIP 은 /lib/jszip/(MIT).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("irDrop")) return;
const ZIP = "/lib/jszip/jszip.min.js", MAX = 30, PV = 168;
const items = [];
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const kb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const loadZip = ()=> window.JSZip ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=ZIP; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
const job = ()=>document.querySelector('input[name=irJob]:checked').value;
const fit = ()=>document.querySelector('input[name=irFit]:checked').value;
const sizes = ()=>[...document.querySelectorAll('input[name=irSize]:checked')].map(x=>x.value);
const base = n=>(n||"photo").replace(/\.[^.]+$/,"");
const SZN = {"1080x1350":"피드 4:5","1080x1920":"스토리 9:16","1080x1080":"정사각형 1:1"};

// ---------- 그리기 ----------
// src: 그릴 그림(ImageBitmap/캔버스), sw·sh: 그 크기, W·H: 결과 크기, c: {x,y,z} 자를 자리(0~1)와 확대
function paint(ctx, src, sw, sh, W, H, how, c){
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  if(how==="crop"){
    const s = Math.max(W/sw, H/sh) * (c.z||1), dw = sw*s, dh = sh*s;
    ctx.drawImage(src, (W-dw)*c.x, (H-dh)*c.y, dw, dh); return;
  }
  if(how==="blur"){ // 작게 줄였다 키우면 흐려진다(브라우저 filter 없이도 같은 결과)
    const s = Math.max(W/sw, H/sh), t = document.createElement("canvas"); t.width = 24; t.height = Math.max(1,Math.round(24*H/W));
    const tc = t.getContext("2d"); tc.imageSmoothingQuality = "high"; tc.drawImage(src, (24-sw*s*24/W)/2, (t.height-sh*s*24/W)/2, sw*s*24/W, sh*s*24/W);
    ctx.drawImage(t, 0, 0, W, H); ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0,0,W,H);
  }else{ ctx.fillStyle = how==="black" ? "#000" : "#fff"; ctx.fillRect(0,0,W,H); }
  const s = Math.min(W/sw, H/sh), dw = sw*s, dh = sh*s;
  ctx.drawImage(src, (W-dw)/2, (H-dh)/2, dw, dh);
}
const toBlob = (cv, type, q)=>new Promise(ok=>cv.toBlob(b=>ok(b), type, q));
async function full(it){ return await createImageBitmap(it.file); }

async function makeInsta(it, sz){
  const [W,H] = sz.split("x").map(Number), bmp = await full(it), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d"); paint(ctx, bmp, bmp.width, bmp.height, W, H, fit(), it.crop[sz]); bmp.close && bmp.close();
  return {name:`${base(it.name)}-${W}x${H}.jpg`, blob: await toBlob(cv, "image/jpeg", +$("irQ").value/100)};
}
async function makeShrink(it){
  const bmp = await full(it), mx = +$("irMax").value, type = $("irType").value, target = +$("irTarget").value*1024;
  let s = mx ? Math.min(1, mx/Math.max(bmp.width,bmp.height)) : 1, q = +$("irQ").value/100, blob;
  const draw = sc=>{ const cv = document.createElement("canvas"); cv.width = Math.max(1,Math.round(bmp.width*sc)); cv.height = Math.max(1,Math.round(bmp.height*sc));
    const ctx = cv.getContext("2d"); if(type==="image/jpeg"){ ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height); }
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp,0,0,cv.width,cv.height); return cv; };
  let cv = draw(s); blob = await toBlob(cv, type, q);
  if(target && blob.size > target){
    for(let round=0; round<4 && blob.size>target; round++){
      if(type!=="image/png"){ let lo = .35, hi = q, best = null;
        for(let k=0;k<7;k++){ const mid=(lo+hi)/2, b=await toBlob(cv,type,mid); if(b.size<=target){ best=b; lo=mid; } else hi=mid; }
        if(best){ blob = best; break; } }
      s *= .82; cv = draw(s); blob = await toBlob(cv, type, type==="image/png"?undefined:Math.min(q,.8));
    }
  }
  bmp.close && bmp.close();
  const ext = {"image/jpeg":"jpg","image/webp":"webp","image/png":"png"}[type];
  return {name:`${base(it.name)}-줄임.${ext}`, blob, w:cv.width, h:cv.height, miss: target && blob.size>target};
}

// ---------- 미리 보기 ----------
function cardHTML(it, i){
  if(it.err) return `<div class="ircard bad"><b>${esc(it.name)}</b><span>${esc(it.err)}</span></div>`;
  if(!it.pv) return `<div class="ircard wait"><b>${esc(it.name)}</b><span>읽는 중…</span></div>`;
  if(job()==="shrink"){
    const r = it.out && it.out.shrink;
    return `<div class="ircard sh"><canvas data-i="${i}" data-sz="orig"></canvas><b>${esc(it.name)}</b><span>${it.w}×${it.h} · ${kb(it.file.size)}</span>`
      + (r ? `<span class="irres${r.miss?" miss":""}">→ ${r.w}×${r.h} · ${kb(r.blob.size)} <em>${Math.round((1-r.blob.size/it.file.size)*100)}% 줄임</em>${r.miss?" · 목표보다 큼":""}</span><a class="ghost" href="${r.url}" download="${esc(r.name)}">내려받기</a>` : `<button class="ghost" type="button" data-one="${i}">이 사진만 만들기</button>`) + `</div>`;
  }
  return sizes().map(sz=>{ const [W,H] = sz.split("x").map(Number), small = Math.max(W/it.w, H/it.h) > 1.05, r = it.out && it.out[sz];
    return `<div class="ircard"><div class="irpv" style="aspect-ratio:${W}/${H}"><canvas data-i="${i}" data-sz="${sz}" title="끌어서 자를 자리 고르기"></canvas></div>
      <b>${esc(it.name)}</b><span>${SZN[sz]}${small?' · <em>원본이 작음</em>':""}</span>
      ${fit()==="crop" ? `<label class="irz">확대 <input type="range" min="1" max="3" step="0.05" value="${it.crop[sz].z}" data-z="${i}" data-sz="${sz}"></label>` : ""}
      ${r ? `<a class="ghost" href="${r.url}" download="${esc(r.name)}">내려받기 ${kb(r.blob.size)}</a>` : `<button class="ghost" type="button" data-one="${i}" data-sz="${sz}">이 크기만 만들기</button>`}</div>`; }).join("");
}
function drawPv(cv){
  const it = items[+cv.dataset.i], sz = cv.dataset.sz; if(!it || !it.pv) return;
  const dpr = Math.min(2, window.devicePixelRatio||1);
  let W, H; if(sz==="orig"){ W = PV; H = Math.round(PV*it.h/it.w); } else { const [a,b] = sz.split("x").map(Number); W = PV; H = Math.round(PV*b/a); }
  cv.width = W*dpr; cv.height = H*dpr; cv.style.width = W+"px"; cv.style.height = H+"px";
  const ctx = cv.getContext("2d"); ctx.scale(dpr,dpr);
  if(sz==="orig") paint(ctx, it.pv, it.pv.width, it.pv.height, W, H, "white", {});
  else paint(ctx, it.pv, it.pv.width, it.pv.height, W, H, fit(), it.crop[sz]);
}
function draw(){
  $("irGrid").innerHTML = items.map(cardHTML).join("");
  $("irGrid").classList.toggle("shrink", job()==="shrink");
  $("irGrid").querySelectorAll("canvas").forEach(drawPv);
  const ok = items.filter(x=>x.pv);
  $("irZip").disabled = !ok.length || (job()==="insta" && !sizes().length);
  $("irZip").textContent = job()==="insta" ? `모두 만들어 ZIP으로 받기${ok.length&&sizes().length?` (${ok.length*sizes().length}장)`:""}` : `모두 줄여 ZIP으로 받기${ok.length?` (${ok.length}장)`:""}`;
  if(!items.length) $("irStatus").textContent = "사진을 넣으면 여기에 미리 보기가 나옵니다.";
  else if(job()==="insta" && !sizes().length) $("irStatus").textContent = "만들 크기를 하나 이상 고르세요.";
  else $("irStatus").textContent = job()==="insta" && fit()==="crop" ? "미리 보기를 끌어서 남길 자리를 고르세요." : `${ok.length}장`;
}
function reset(){ items.forEach(it=>{ if(it.out) Object.values(it.out).forEach(r=>r&&r.url&&URL.revokeObjectURL(r.url)); it.out = null; }); }

async function add(list){
  for(const f of list){
    if(items.length >= MAX){ toast(`한 번에 ${MAX}장까지 넣을 수 있습니다`); break; }
    if(/\.(heic|heif)$/i.test(f.name) && !/^image\/(jpeg|png|webp)/.test(f.type)){ items.push({name:f.name, err:"HEIC 사진은 먼저 HEIC → JPG 도구로 바꿔 주세요."}); continue; }
    const it = {name: f.name || `사진${items.length+1}.jpg`, file: f, crop: {}};
    ["1080x1350","1080x1920","1080x1080"].forEach(s=>it.crop[s] = {x:.5, y:.5, z:1});
    items.push(it);
  }
  draw();
  for(const it of items){ if(it.pv || it.err || it.loading) continue; it.loading = true;
    try{ const b = await createImageBitmap(it.file); it.w = b.width; it.h = b.height;
      const s = Math.min(1, 640/Math.max(b.width,b.height));
      it.pv = await createImageBitmap(b, {resizeWidth: Math.max(1,Math.round(b.width*s)), resizeHeight: Math.max(1,Math.round(b.height*s)), resizeQuality:"high"}); b.close && b.close();
    }catch(_){ it.err = "사진을 열지 못했습니다. JPG·PNG·WebP 사진인지 확인하세요."; }
    draw(); }
}

async function makeOne(it, sz){
  it.out = it.out || {};
  if(job()==="shrink"){ const r = await makeShrink(it); r.url = URL.createObjectURL(r.blob); it.out.shrink = r; return [r]; }
  const r = await makeInsta(it, sz); r.url = URL.createObjectURL(r.blob); it.out[sz] = r; return [r];
}
async function makeAll(){
  const ok = items.filter(x=>x.pv); if(!ok.length) return;
  const tasks = job()==="shrink" ? ok.map(it=>[it,null]) : ok.flatMap(it=>sizes().map(sz=>[it,sz]));
  $("irZip").disabled = true; $("irBar").hidden = false; const files = [];
  let before = 0, after = 0;
  try{
    for(let k=0;k<tasks.length;k++){
      $("irStatus").textContent = `${k+1} / ${tasks.length}장 만드는 중…`; $("irBar").firstElementChild.style.width = Math.round(k/tasks.length*100)+"%";
      const [it, sz] = tasks[k], r = (await makeOne(it, sz))[0]; files.push(r);
      if(!sz){ before += it.file.size; after += r.blob.size; }
    }
    await loadZip(); const z = new JSZip(), used = {};
    files.forEach(r=>{ let n = r.name, k = 2; while(used[n]) n = r.name.replace(/(\.\w+)$/, `-${k++}$1`); used[n]=1; z.file(n, r.blob); });
    const b = await z.generateAsync({type:"blob"}); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = job()==="shrink" ? "줄인사진.zip" : "인스타사진.zip"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
    $("irSum").textContent = job()==="shrink" ? `모두 ${kb(before)} → ${kb(after)} (${Math.round((1-after/before)*100)}% 줄임)` : `${files.length}장을 만들었습니다.`;
  }catch(e){ toast("만들지 못한 사진이 있습니다. 한 장씩 만들어 보세요"); }
  finally{ $("irBar").hidden = true; draw(); $("irStatus").textContent = `${files.length}장을 ZIP으로 내려받았습니다.`; }
}

// ---------- 끌기·확대 ----------
let dragging = null;
$("irGrid").addEventListener("pointerdown", e=>{
  const cv = e.target.closest("canvas"); if(!cv || cv.dataset.sz==="orig" || fit()!=="crop") return;
  const it = items[+cv.dataset.i]; dragging = {cv, it, sz: cv.dataset.sz, x: e.clientX, y: e.clientY}; cv.setPointerCapture(e.pointerId); e.preventDefault();
});
$("irGrid").addEventListener("pointermove", e=>{
  if(!dragging) return; const {cv, it, sz} = dragging, [W,H] = sz.split("x").map(Number), c = it.crop[sz];
  const k = W / cv.clientWidth, s = Math.max(W/it.w, H/it.h)*c.z, dw = it.w*s, dh = it.h*s;
  const dx = (e.clientX-dragging.x)*k, dy = (e.clientY-dragging.y)*k; dragging.x = e.clientX; dragging.y = e.clientY;
  if(W-dw < -0.5) c.x = Math.min(1, Math.max(0, ((W-dw)*c.x + dx)/(W-dw)));
  if(H-dh < -0.5) c.y = Math.min(1, Math.max(0, ((H-dh)*c.y + dy)/(H-dh)));
  drawPv(cv);
});
const endDrag = ()=>{ if(dragging){ const it = dragging.it; if(it.out && it.out[dragging.sz]){ URL.revokeObjectURL(it.out[dragging.sz].url); delete it.out[dragging.sz]; draw(); } } dragging = null; };
$("irGrid").addEventListener("pointerup", endDrag); $("irGrid").addEventListener("pointercancel", endDrag);
$("irGrid").addEventListener("input", e=>{ const r = e.target.closest("input[data-z]"); if(!r) return; const it = items[+r.dataset.z]; it.crop[r.dataset.sz].z = +r.value;
  const cv = $("irGrid").querySelector(`canvas[data-i="${r.dataset.z}"][data-sz="${r.dataset.sz}"]`); if(cv) drawPv(cv); });
$("irGrid").addEventListener("change", e=>{ const r = e.target.closest("input[data-z]"); if(!r) return; const it = items[+r.dataset.z]; if(it.out && it.out[r.dataset.sz]){ URL.revokeObjectURL(it.out[r.dataset.sz].url); delete it.out[r.dataset.sz]; draw(); } });
$("irGrid").addEventListener("click", async e=>{ const b = e.target.closest("button[data-one]"); if(!b) return; b.disabled = true; b.textContent = "만드는 중…";
  try{ await makeOne(items[+b.dataset.one], b.dataset.sz||null); }catch(_){ toast("만들지 못했습니다"); } draw(); });

// ---------- 설정 ----------
const sync = ()=>{ const j = job(); $("irInsta").hidden = j!=="insta"; $("irShrink").hidden = j!=="shrink";
  $("irQRow").hidden = j==="shrink" && $("irType").value==="image/png"; $("irQv").textContent = $("irQ").value; };
const changed = ()=>{ sync(); reset(); draw(); };
document.querySelectorAll('input[name=irJob],input[name=irFit],input[name=irSize]').forEach(x=>x.addEventListener("change", changed));
["irMax","irType","irTarget"].forEach(id=>$(id).addEventListener("change", changed));
$("irQ").addEventListener("input", ()=>{ $("irQv").textContent = $("irQ").value; });
$("irQ").addEventListener("change", changed);
$("irFile").addEventListener("change", e=>{ add(e.target.files); e.target.value=""; });
const drop = $("irDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>add(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("irFile").click(); } });
$("irZip").addEventListener("click", makeAll);
$("irClear").addEventListener("click", ()=>{ reset(); items.forEach(it=>it.pv&&it.pv.close&&it.pv.close()); items.length = 0; $("irSum").textContent=""; draw(); });
sync(); draw();
})();

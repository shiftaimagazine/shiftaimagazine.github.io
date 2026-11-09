// SHIFT AI 무료 도구 — 문서 비교. 두 문서(HWP·HWPX·DOCX·PPTX·PDF·TXT)의 글자를 이 브라우저 안에서 뽑아 바뀐 곳을 찾는다.
// 한글·워드·PPT 는 /assets/doc-text.js(SHIFT_DT, 같은 사이트의 '한글·워드·PPT 글자 뽑기' 도구), PDF 는 /lib/pdfjs/(PDF.js, Apache-2.0).
// 비교는 문단(또는 문장)끼리 먼저 맞춘 뒤, 바뀐 묶음 안에서 낱말·글자 단위로 다시 맞춘다(마이어스 알고리즘). 파일과 글은 어디에도 보내지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("dcA")) return;
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const glen = s=>Array.from(s).length;
const pick = n=>document.querySelector(`input[name=${n}]:checked`).value;
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다. 새로 고침해 주세요.")); document.head.appendChild(s); });
const names = {A:"", B:""};

// ---------- 파일에서 글자 뽑기 ----------
let pdfLib = null;
async function pdfText(buf){
  if(!pdfLib){ pdfLib = await import("/lib/pdfjs/pdf.min.js"); pdfLib.GlobalWorkerOptions.workerSrc = "/lib/pdfjs/pdf.worker.min.js"; }
  let doc;
  try{ doc = await pdfLib.getDocument({data: buf, isEvalSupported:false, cMapUrl:"/lib/pdfjs/cmaps/", cMapPacked:true, useSystemFonts:false, disableFontFace:true}).promise; }
  catch(e){ throw new Error(/password/i.test((e&&e.name||"")+(e&&e.message||"")) ? "암호가 걸린 PDF는 열 수 없습니다. 암호를 푼 PDF로 저장해 넣어 주세요." : "PDF를 열지 못했습니다. 손상된 파일일 수 있습니다."); }
  const out = [];
  for(let n=1; n<=doc.numPages; n++){
    const pg = await doc.getPage(n), tc = await pg.getTextContent(), rows = [];
    for(const it of tc.items){
      if(!("str" in it) || !it.str) continue;
      const y = it.transform[5], h = Math.abs(it.transform[3]) || it.height || 10, x = it.transform[4];
      let r = rows.find(r=>Math.abs(r.y - y) < Math.max(2, h*0.45));
      if(!r){ r = {y, h, parts:[]}; rows.push(r); }
      r.h = Math.max(r.h, h); r.parts.push({x, s: it.str, w: it.width||0});
    }
    rows.sort((a,b)=>b.y - a.y);
    let prevY = null, prevH = 0;
    for(const r of rows){
      r.parts.sort((a,b)=>a.x-b.x);
      let t = "", end = null;
      for(const p of r.parts){ if(end!=null && p.x - end > r.h*0.25 && !/\s$/.test(t) && !/^\s/.test(p.s)) t += " "; t += p.s; end = p.x + p.w; }
      t = t.replace(/\s+/g," ").trim();
      if(!t || /^[-–—\s]*\d{1,4}[-–—\s]*$|^\d+\s*\/\s*\d+$/.test(t)) continue;   // 쪽 번호 줄은 뺀다
      if(prevY!=null && prevY - r.y > Math.max(prevH, r.h)*1.7) out.push("");
      out.push(t); prevY = r.y; prevH = r.h;
    }
    out.push("");
  }
  if(!out.join("").trim()) throw new Error("PDF에서 글자를 찾지 못했습니다. 스캔한 PDF라면 '사진 속 글자 뽑기'로 먼저 글자를 뽑아 주세요.");
  return out.join("\n");
}
function textOf(buf){
  try{ return new TextDecoder("utf-8", {fatal:true}).decode(buf).replace(/^﻿/,""); }
  catch(e){ return new TextDecoder("euc-kr").decode(buf); }
}
async function readFile(f){
  const ext = ((f.name.match(/\.([a-z0-9]+)$/i)||[])[1]||"").toLowerCase(), buf = await f.arrayBuffer();
  if(ext==="pdf" || f.type==="application/pdf") return {text: await pdfText(buf), pdf:true};
  if(["txt","md","csv","text"].includes(ext) || f.type.startsWith("text/")) return {text: textOf(buf)};
  if(["hwp","hwpx","docx","pptx","doc","ppt","xls","xlsx"].includes(ext)){
    await script("/assets/doc-text.js", ()=>!!window.SHIFT_DT);
    const o = {notes:false, hf:false, memo:false, img:false, fill:true}, r = await window.SHIFT_DT.parse(f.name, buf, o);
    const t = window.SHIFT_DT.plain(r.blocks, o);
    if(!t.trim()) throw new Error("문서에서 글자를 찾지 못했습니다.");
    return {text: t};
  }
  throw new Error("한글(.hwp·.hwpx)·워드(.docx)·파워포인트(.pptx)·PDF·텍스트 파일만 읽을 수 있습니다.");
}
async function load(side, f){
  if(!f) return;
  const lab = $("dc"+side+"c"); lab.textContent = "읽는 중…";
  try{
    const r = await readFile(f);
    $("dc"+side).value = r.text.replace(/\r\n?/g,"\n"); names[side] = f.name;
    if(r.pdf){ const s = document.querySelector('input[name=dcAlign][value=sent]'), c = document.querySelector('input[name=dcUnit][value=char]');
      if(!s.checked || !c.checked){ s.checked = c.checked = true; toast("PDF가 있어 '문장'으로 맞추고 '글자'로 표시합니다"); } }
    run();
  }catch(e){ lab.textContent = ""; toast(e.message || "파일을 읽지 못했습니다"); $("dcStatus").textContent = (side==="A"?"원본":"수정본") + ": " + (e.message || "파일을 읽지 못했습니다"); }
}

// ---------- 비교 ----------
// 마이어스 diff: a, b 는 비교용 키 배열. 결과 [["=",i,j] | ["-",i] | ["+",j]]
function myers(a, b, limit){
  const N = a.length, M = b.length, MAX = N+M, off = MAX+1, V = new Int32Array(2*MAX+3), trace = [];
  let found = -1;
  for(let d=0; d<=MAX; d++){
    if(d>limit) return null;
    trace.push(V.slice(off-d-1, off+d+2));
    for(let k=-d; k<=d; k+=2){
      let x = (k===-d || (k!==d && V[off+k-1] < V[off+k+1])) ? V[off+k+1] : V[off+k-1]+1, y = x-k;
      while(x<N && y<M && a[x]===b[y]){ x++; y++; }
      V[off+k] = x;
      if(x>=N && y>=M){ found = d; break; }
    }
    if(found>=0) break;
  }
  const ops = []; let x = N, y = M;
  for(let d=found; d>0; d--){
    const T = trace[d], g = kk=>T[kk+d+1], k = x-y;
    const prevK = (k===-d || (k!==d && g(k-1) < g(k+1))) ? k+1 : k-1, px = g(prevK), py = px-prevK;
    while(x>px && y>py){ ops.push(["=",x-1,y-1]); x--; y--; }
    if(x===px) ops.push(["+",y-1]); else ops.push(["-",x-1]);
    x = px; y = py;
  }
  while(x>0 && y>0){ ops.push(["=",x-1,y-1]); x--; y--; }
  return ops.reverse();
}
// 띄어쓰기를 무시할 때는 띄어쓰기를 앞 글자(낱말)에 붙여 한 조각으로 만들고, 비교할 때는 띄어쓰기를 뺀 값으로 맞춘다.
//  PDF 처럼 줄이 바뀐 자리에 띄어쓰기가 끼어든 글('한 다' ↔ '한다')도 글자 단위에서는 같게 본다.
const tokens = (s, u, ws)=> ws
  ? (u==="char" ? (s.match(/^\s+|\S\s*/gu) || []) : (s.match(/^\s+|[\p{L}\p{M}\p{N}_]+\s*|[^\s\p{L}\p{M}\p{N}_]\s*/gu) || []))
  : (u==="char" ? Array.from(s) : (s.match(/\s+|[\p{L}\p{M}\p{N}_]+|[^\s\p{L}\p{M}\p{N}_]/gu) || []));
const key = (t, ws)=> ws ? t.replace(/\s+/g,"") : t;
const normU = (l, ws)=> ws ? l.replace(/\s+/g,"") : l;
function units(text, how, ws){
  text = text.replace(/\r\n?/g,"\n");
  let us = how==="sent"
    ? text.replace(/\s*\n\s*/g," ").split(/(?<=[.!?。])\s+|(?<=[.!?。]["'”’)\]])\s+/)
    : text.split("\n");
  us = us.map(u=>u.replace(/[ \t]+$/,""));
  return ws ? us.filter(u=>u.trim()) : us;
}
function inner(oldS, newS, u, ws){
  const A = tokens(oldS,u,ws), B = tokens(newS,u,ws), ops = myers(A.map(t=>key(t,ws)), B.map(t=>key(t,ws)), 3000);
  if(!ops) return [{t:"-",s:oldS},{t:"+",s:newS}].filter(x=>x.s);
  const out = [], push = (t,s,sa)=>{ const l = out[out.length-1]; if(l && l.t===t){ l.s += s; l.sa += sa??s; } else out.push({t,s,sa:sa??s}); };
  ops.forEach(([o,i,j])=> o==="=" ? push("=", B[j], A[i]) : o==="-" ? push("-", A[i]) : push("+", B[i]));
  for(let k=1;k<out.length-1;k++) if(out[k].t==="=" && /^\s+$/.test(out[k].s) && out[k-1].t!=="=" && out[k+1].t!=="=" && glen(out[k].s)<=1) out[k].t = "~";
  // 글자 단위에서 한두 글자만 같아 잘게 쪼개진 곳은 한 덩어리로(읽기 쉽게)
  if(u==="char"){
    for(let k=1;k<out.length-1;k++) if(out[k].t==="=" && glen(out[k].s)<=1 && out[k-1].t!=="=" && out[k+1].t!=="=" && !/\s/.test(out[k].s)){
      out[k-1].s += out[k].s; if(out[k-1].t==="-") out[k-1].sa = out[k-1].s; out[k].t = "+"; out[k].sa = out[k].s; }
    const m = []; for(const p of out){ const l = m[m.length-1]; if(l && l.t===p.t && p.t!=="="){ l.s += p.s; l.sa += p.sa; } else m.push({...p}); }
    return m;
  }
  return out;
}
// 두 문단이 얼마나 닮았는지(0~1): 띄어쓰기를 뺀 두 글자씩 묶음의 겹침(다이스 계수)
function sim(a, b, ws){
  const f = x=>{ x = ws ? x.replace(/\s+/g,"") : x; const m = new Map(), c = Array.from(x); for(let i=0;i<c.length-1;i++){ const k = c[i]+c[i+1]; m.set(k,(m.get(k)||0)+1); } return [m, Math.max(0,c.length-1)]; };
  const [A,na] = f(a), [B,nb] = f(b); if(!na || !nb) return a.trim()===b.trim() ? 1 : 0;
  let hit = 0; A.forEach((v,k)=>{ hit += Math.min(v, B.get(k)||0); }); return 2*hit/(na+nb);
}
// 순서를 지키며 닮은 문단끼리 짝짓기(동적 계획법). 닮은 정도가 0.35 아래면 짝짓지 않는다.
function pair(da, db, ws){
  const n = da.length, m = db.length, S = da.map(a=>db.map(b=>sim(a,b,ws)));
  const D = Array.from({length:n+1},()=>new Float64Array(m+1)), W = Array.from({length:n+1},()=>new Uint8Array(m+1));
  for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--){
    const both = S[i][j]>=0.35 ? S[i][j] + D[i+1][j+1] : -1, skipA = D[i+1][j], skipB = D[i][j+1];
    if(both>=skipA && both>=skipB){ D[i][j] = both; W[i][j] = 1; } else if(skipA>=skipB){ D[i][j] = skipA; W[i][j] = 2; } else { D[i][j] = skipB; W[i][j] = 3; }
  }
  const out = []; let i = 0, j = 0;
  while(i<n && j<m){ if(W[i][j]===1) out.push([da[i++], db[j++]]); else if(W[i][j]===2) out.push([da[i++], null]); else out.push([null, db[j++]]); }
  while(i<n) out.push([da[i++], null]); while(j<m) out.push([null, db[j++]]);
  return out;
}
function compare(){
  const ws = $("dcWs").checked, u = pick("dcUnit"), how = pick("dcAlign");
  const A = units($("dcA").value, how, ws), B = units($("dcB").value, how, ws);
  const ops = myers(A.map(l=>normU(l,ws)), B.map(l=>normU(l,ws)), 30000) || [...A.map((_,i)=>["-",i]), ...B.map((_,j)=>["+",j])];
  const rows = []; let i = 0, ai = 0, bi = 0;
  const change = (da, db)=>({eq:false, a:da.join("\n"), b:db.join("\n"), hasA:da.length>0, hasB:db.length>0, pa:ai, pb:bi, parts: inner(da.join("\n"), db.join("\n"), u, ws)});
  while(i<ops.length){
    if(ops[i][0]==="="){ rows.push({eq:true, a:A[ops[i][1]], b:B[ops[i][2]]}); ai++; bi++; i++; continue; }
    const da = [], db = [];
    while(i<ops.length && ops[i][0]!=="="){ if(ops[i][0]==="-") da.push(A[ops[i][1]]); else db.push(B[ops[i][1]]); i++; }
    if(da.length && db.length && da.length*db.length<=40000 && (da.length>1 || db.length>1)){
      // 바뀐 묶음 안에서 닮은 문단끼리 짝을 짓는다(고친 문단은 '고침', 짝이 없으면 '뺌'·'더함')
      for(const [x,y] of pair(da, db, ws)){
        if(x!=null && y!=null){ rows.push(change([x],[y])); ai++; bi++; }
        else if(x!=null){ rows.push(change([x],[])); ai++; }
        else { rows.push(change([],[y])); bi++; }
      }
    }else{ rows.push(change(da, db)); ai += da.length; bi += db.length; }
  }
  return rows;
}
const hasNum = s=>/\d/.test(s);
const mark = (tag, s)=>`<${tag}${hasNum(s)?' class="num"':''}>${esc(s)}</${tag}>`;
const side = (parts, which)=>parts.map(p=>{
  if(p.t==="=" || p.t==="~") return esc(which==="a" ? p.sa : p.s);
  if(p.t==="-" && which==="a") return mark("del", p.s);
  if(p.t==="+" && which==="b") return mark("ins", p.s);
  return "";
}).join("");
const inl = parts=>parts.map(p=>p.t==="-" ? mark("del", p.s) : p.t==="+" ? mark("ins", p.s) : esc(p.s)).join("");
const cut = (s, n)=>{ s = s.replace(/\s+/g," ").trim(); const a = Array.from(s); return a.length>n ? a.slice(0,n).join("")+"…" : s; };

// 바뀐 곳 하나를 한 줄로: 고침 '30일' → '60일' / 더함 / 뺌
// 바뀐 조각을 띄어쓰기 경계까지 넓혀 낱말째 보여 준다('2' → '3' 대신 '2월' → '3월')
function spans(parts, which){
  let s = ""; const rs = [];
  for(const p of parts){
    if(p.t==="=" || p.t==="~"){ s += which==="a" ? p.sa : p.s; continue; }
    if((p.t==="-" && which==="a") || (p.t==="+" && which==="b")){ if(p.s.trim()) rs.push([s.length, s.length+p.s.length]); s += p.s; }
  }
  const out = [];
  for(let [a,b] of rs){
    while(a>0 && !/\s/.test(s[a-1])) a--; while(b<s.length && !/\s/.test(s[b])) b++;
    const l = out[out.length-1]; if(l && a<=l[1]) l[1] = Math.max(l[1], b); else out.push([a,b]);
  }
  return out.map(([a,b])=>s.slice(a,b).trim()).filter(Boolean).join(" … ");
}
function summary(r){
  const rawD = r.parts.filter(p=>p.t==="-").map(p=>p.s).join(""), rawA = r.parts.filter(p=>p.t==="+").map(p=>p.s).join("");
  const del = r.hasA && r.hasB ? spans(r.parts,"a") : rawD, add = r.hasA && r.hasB ? spans(r.parts,"b") : rawA;
  const kind = !r.hasA ? "더함" : !r.hasB ? "뺌" : "고침";
  const where = cut((r.hasB ? r.b : r.a), 26);
  const num = hasNum(rawD) || hasNum(rawA);
  return {kind, where, del: cut(del, 70), add: cut(add, 70), num, para: r.hasB ? r.pb+1 : r.pa+1};
}

const detail = s=>s.del && s.add ? `<del>${esc(s.del)}</del> → <ins>${esc(s.add)}</ins>` : s.add ? `더한 말 <ins>${esc(s.add)}</ins>` : `뺀 말 <del>${esc(s.del)}</del>`;
let last = null;
function run(){
  const a = $("dcA").value, b = $("dcB").value;
  $("dcAc").textContent = a ? `${names.A ? names.A+" · " : ""}${glen(a).toLocaleString()}자` : "";
  $("dcBc").textContent = b ? `${names.B ? names.B+" · " : ""}${glen(b).toLocaleString()}자` : "";
  const ready = !!(a.trim() && b.trim());
  ["dcCopy","dcPrintBtn","dcAsk"].forEach(id=>$(id).disabled = true);
  if(!ready){ $("dcOut").innerHTML = ""; $("dcStats").hidden = $("dcListW").hidden = true; $("dcStatus").textContent = "두 문서를 넣으면 바로 비교합니다."; last = null; return; }
  const rows = compare(), ch = rows.filter(r=>!r.eq); last = rows;
  let add = 0, del = 0, nums = 0;
  const sums = ch.map(r=>{ r.parts.forEach(p=>{ const n = glen(p.s.replace(/\s/g,"")); if(p.t==="+") add += n; else if(p.t==="-") del += n; }); const s = summary(r); if(s.num) nums++; return s; });
  $("dcStatus").textContent = ch.length ? `바뀐 곳 ${ch.length}군데` : ($("dcWs").checked ? "두 문서의 글이 같습니다(띄어쓰기·빈 줄 차이는 무시했습니다)." : "두 문서의 글이 똑같습니다.");
  $("dcStats").hidden = false;
  $("dcStats").innerHTML = `<div><b>${ch.length.toLocaleString()}</b><span>바뀐 곳</span></div><div><b class="pdd">${nums.toLocaleString()}</b><span>숫자가 바뀐 곳</span></div>`
    + `<div><b class="pda">+${add.toLocaleString()}</b><span>더한 글자</span></div><div><b class="pdd">−${del.toLocaleString()}</b><span>뺀 글자</span></div>`;
  $("dcListW").hidden = !ch.length;
  $("dcList").innerHTML = sums.map((s,k)=>`<li><button type="button" data-k="${k}"><span class="dck dck-${s.kind==="더함"?"a":s.kind==="뺌"?"d":"c"}">${s.kind}</span>${s.num?'<span class="dcnum">숫자 바뀜</span>':""}`
    + `<span class="dcw">${esc(s.where)}</span>${s.kind==="고침" ? `<span class="dcd">${detail(s)}</span>` : ""}</button></li>`).join("");
  const only = $("dcOnly").checked, v = pick("dcView");
  const near = new Set(); rows.forEach((r,k)=>{ if(!r.eq){ near.add(k-1); near.add(k+1); } });
  let html = "", skip = 0, n = 0;
  const flush = ()=>{ if(skip){ html += `<div class="pdskip">같은 ${pick("dcAlign")==="sent"?"문장":"문단"} ${skip}개</div>`; skip = 0; } };
  rows.forEach((r,k)=>{
    if(r.eq){
      if(only && !near.has(k)){ skip++; return; }
      flush();
      html += v==="side" ? `<div class="pdrow"><div>${esc(r.a)||"&nbsp;"}</div><div>${esc(r.b)||"&nbsp;"}</div></div>` : `<div class="pdrow one"><div>${esc(r.b)||"&nbsp;"}</div></div>`;
    }else{
      flush(); const id = `dcR${n++}`;
      html += v==="side" ? `<div class="pdrow ch" id="${id}"><div class="${r.hasA?"":"none"}">${r.hasA?side(r.parts,"a"):""}</div><div class="${r.hasB?"":"none"}">${r.hasB?side(r.parts,"b"):""}</div></div>`
                         : `<div class="pdrow one ch" id="${id}"><div>${inl(r.parts)}</div></div>`;
    }
  });
  flush();
  $("dcOut").className = "pdout dcout " + v;
  $("dcOut").innerHTML = (v==="side" ? `<div class="pdrow pdh"><div>원본${names.A?" · "+esc(names.A):""}</div><div>수정본${names.B?" · "+esc(names.B):""}</div></div>` : "") + html;
  $("dcCopy").disabled = $("dcPrintBtn").disabled = !ch.length; $("dcAsk").disabled = !ch.length;
  last.sums = sums;
}

// ---------- 내보내기 ----------
function listText(){
  const s = (last && last.sums) || [];
  const head = `문서 비교 결과 — 원본: ${names.A||"붙여 넣은 글"} / 수정본: ${names.B||"붙여 넣은 글"} · 바뀐 곳 ${s.length}군데`;
  return head + "\n\n" + s.map((x,k)=>`${k+1}. [${x.kind}]${x.num?" [숫자 바뀜]":""} ${x.where}` + (x.kind==="고침" ? (x.del && x.add ? `\n   '${x.del}' → '${x.add}'` : x.add ? `\n   더한 말: ${x.add}` : `\n   뺀 말: ${x.del}`) : x.kind==="더함" ? `\n   더한 말: ${x.add}` : `\n   뺀 말: ${x.del}`)).join("\n");
}
function diffText(){
  return (last||[]).filter(r=>!r.eq).map(r=>r.parts.map(p=>p.t==="+" ? `[+${p.s}]` : p.t==="-" ? `[-${p.s}]` : p.s).join("")).join("\n\n");
}
const copy = (t, m)=>(navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast(m)).catch(()=>{ const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast(m); });
function printOut(){
  if(!last) return;
  let box = $("dcPrint"); if(!box){ box = document.createElement("div"); box.id = "dcPrint"; document.body.appendChild(box); }
  const d = new Date(), p = n=>String(n).padStart(2,"0");
  const s = last.sums || [];
  box.innerHTML = `<h1>문서 비교 결과</h1><p class="dcpm">원본: ${esc(names.A||"붙여 넣은 글")} · 수정본: ${esc(names.B||"붙여 넣은 글")} · ${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} · 바뀐 곳 ${s.length}군데</p>`
    + `<h2>바뀐 곳 목록</h2><ol>${s.map(x=>`<li><b>[${x.kind}]</b>${x.num?" <b>[숫자 바뀜]</b>":""} ${esc(x.where)}${x.kind==="고침" ? `<br>${detail(x)}` : ""}</li>`).join("")}</ol>`
    + `<h2>바뀐 문단</h2><div class="pdout inline">${last.filter(r=>!r.eq).map(r=>`<div class="pdrow one ch"><div>${inl(r.parts)}</div></div>`).join("")}</div>`
    + `<p class="dcpm">초록 바탕은 더한 말, 빨강 줄을 그은 것은 뺀 말입니다. SHIFT AI 무료 도구 '문서 비교'(shiftaimagazine.com/tools/doc-compare/)로 만들었습니다.</p>`;
  document.documentElement.classList.add("dcp");
  const done = ()=>{ document.documentElement.classList.remove("dcp"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 1500);
}

const SAMPLE_A = `용역 계약서 (예시)

제1조(목적) 이 계약은 갑이 을에게 맡기는 홈페이지 제작 용역의 범위와 조건을 정한다.
제2조(계약 기간) 계약 기간은 2026년 12월 1일부터 2027년 2월 28일까지로 한다.
제3조(대금) 용역 대금은 금 15,000,000원(부가세 별도)으로 한다.
제4조(대금 지급) 갑은 검수를 마친 날부터 30일 안에 대금을 을의 계좌로 지급한다.
제5조(지체상금) 을이 납기를 지키지 못하면 하루에 계약 금액의 1/1000을 지체상금으로 낸다.
제6조(비밀 유지) 두 당사자는 계약 기간과 계약이 끝난 뒤 1년 동안 상대의 영업 비밀을 지킨다.
제7조(저작권) 결과물의 저작권은 대금을 모두 지급한 때 갑에게 넘어간다.`;
const SAMPLE_B = `용역 계약서 (예시)

제1조(목적) 이 계약은 갑이 을에게 맡기는 홈페이지 제작 용역의 범위와 조건을 정한다.
제2조(계약 기간) 계약 기간은 2026년 12월 1일부터 2027년 3월 31일까지로 한다.
제3조(대금) 용역 대금은 금 15,000,000원(부가세 포함)으로 한다.
제4조(대금 지급) 갑은 검수를 마친 날부터 60일 안에 대금을 을의 계좌로 지급한다.
제5조(지체상금) 을이 납기를 지키지 못하면 하루에 계약 금액의 3/1000을 지체상금으로 낸다.
제6조(비밀 유지) 두 당사자는 계약 기간과 계약이 끝난 뒤 3년 동안 상대의 영업 비밀을 지킨다.
제7조(저작권) 결과물의 저작권은 계약을 맺은 때 갑에게 넘어간다.
제8조(계약 해지) 갑은 을에게 7일 전에 알리고 언제든지 계약을 해지할 수 있다.`;

let tm; const later = ()=>{ clearTimeout(tm); tm = setTimeout(run, 200); };
$("dcA").addEventListener("input", ()=>{ names.A = ""; later(); }); $("dcB").addEventListener("input", ()=>{ names.B = ""; later(); });
document.querySelectorAll('input[name=dcAlign],input[name=dcUnit],input[name=dcView]').forEach(r=>r.addEventListener("change", run));
["dcWs","dcOnly"].forEach(id=>$(id).addEventListener("change", run));
["A","B"].forEach(S=>{
  const drop = $("dcDrop"+S), inp = $("dcFile"+S);
  inp.addEventListener("change", ()=>{ load(S, inp.files[0]); inp.value = ""; });
  drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); inp.click(); } });
  drop.addEventListener("dragover", e=>{ e.preventDefault(); drop.classList.add("on"); });
  drop.addEventListener("dragleave", ()=>drop.classList.remove("on"));
  drop.addEventListener("drop", e=>{ e.preventDefault(); drop.classList.remove("on"); const fs = [...(e.dataTransfer.files||[])];
    if(fs.length>=2 && S==="A"){ load("A", fs[0]); load("B", fs[1]); } else load(S, fs[0]); });
});
$("dcList").addEventListener("click", e=>{ const b = e.target.closest("button[data-k]"); if(!b) return; const el = $("dcR"+b.dataset.k); if(!el) return;
  el.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"center"}); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); });
$("dcSample").addEventListener("click", ()=>{ names.A = "계약서_처음.txt"; names.B = "계약서_수정.txt"; $("dcA").value = SAMPLE_A; $("dcB").value = SAMPLE_B; run(); });
$("dcSwap").addEventListener("click", ()=>{ const t = $("dcA").value, n = names.A; $("dcA").value = $("dcB").value; $("dcB").value = t; names.A = names.B; names.B = n; run(); });
$("dcClear").addEventListener("click", ()=>{ $("dcA").value = $("dcB").value = ""; names.A = names.B = ""; run(); $("dcA").focus(); });
$("dcCopy").addEventListener("click", ()=>copy(listText(), "바뀐 곳 목록을 복사했습니다"));
$("dcPrintBtn").addEventListener("click", printOut);
if(window.matchMedia && matchMedia("(max-width:640px)").matches) document.querySelector("input[name=dcView][value=inline]").checked = true;   // 휴대폰은 한 칸에 보기가 읽기 쉽다
$("dcAsk").addEventListener("click", ()=>copy(`아래는 같은 문서의 원본과 수정본을 비교한 결과입니다. [+말]은 수정본에서 더한 말, [-말]은 뺀 말입니다.
1. 바뀐 곳을 빠짐없이 표로 정리해 주세요(조항·바뀐 내용·원래 내용).
2. 바뀐 곳마다 어느 쪽에 유리하거나 불리해졌는지 한 줄로 설명해 주세요. 판단할 근거가 부족하면 그렇다고 적어 주세요.
3. 상대에게 확인해야 할 질문을 3개 이내로 적어 주세요.
비교 결과에 없는 내용은 지어내지 마세요.

<바뀐_곳_목록>
${listText()}
</바뀐_곳_목록>

<바뀐_문단>
${diffText()}
</바뀐_문단>`, "AI에 붙여 넣을 프롬프트를 복사했습니다. 이름·연락처는 가린 뒤 붙여 넣으세요"));
run();
})();

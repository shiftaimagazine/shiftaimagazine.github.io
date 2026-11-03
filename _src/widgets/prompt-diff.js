// SHIFT AI 무료 도구 — 프롬프트 비교(diff). 줄 단위로 먼저 맞춘 뒤, 바뀐 줄 묶음 안에서 낱말·글자 단위로 다시 비교한다(마이어스 알고리즘).
// 글은 어디에도 보내지 않는다. 토큰 수는 /lib/gpt-tokenizer/o200k.js(MIT).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("pdA")) return;
const TOK = "/lib/gpt-tokenizer/o200k.js";
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const unit = ()=>document.querySelector('input[name=pdUnit]:checked').value;
const view = ()=>document.querySelector('input[name=pdView]:checked').value;
const glen = s=>Array.from(s).length;

// 마이어스 diff: a, b 는 비교용 키 배열. 결과 [["=",i,j] | ["-",i] | ["+",j]]
function myers(a, b, limit=4000){
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
    const T = trace[d], g = kk=>T[kk+d+1], k = x-y;   // trace[d] 는 V[off-d-1 .. off+d+1]
    const prevK = (k===-d || (k!==d && g(k-1) < g(k+1))) ? k+1 : k-1, px = g(prevK), py = px-prevK;
    while(x>px && y>py){ ops.push(["=",x-1,y-1]); x--; y--; }
    if(x===px) ops.push(["+",y-1]); else ops.push(["-",x-1]);
    x = px; y = py;
  }
  while(x>0 && y>0){ ops.push(["=",x-1,y-1]); x--; y--; }
  return ops.reverse();
}
const tokens = (s, u)=> u==="char" ? Array.from(s) : (s.match(/\s+|[\p{L}\p{M}\p{N}_]+|[^\s\p{L}\p{M}\p{N}_]/gu) || []);
const key = (t, ws)=> ws && /^\s+$/.test(t) ? " " : t;
const normLine = (l, ws)=> ws ? l.trim().replace(/\s+/g," ") : l;

// 바뀐 묶음 안의 낱말·글자 비교 → [{t:"=",s}|{t:"-",s}|{t:"+",s}]
function inner(oldS, newS, u, ws){
  if(u==="line") return [{t:"-",s:oldS},{t:"+",s:newS}].filter(x=>x.s);
  const A = tokens(oldS,u), B = tokens(newS,u), ops = myers(A.map(t=>key(t,ws)), B.map(t=>key(t,ws)), 3000);
  if(!ops) return [{t:"-",s:oldS},{t:"+",s:newS}];
  const out = [], push = (t,s,sa)=>{ const l = out[out.length-1]; if(l && l.t===t){ l.s += s; l.sa += sa??s; } else out.push({t,s,sa:sa??s}); };
  ops.forEach(([o,i,j])=> o==="=" ? push("=", B[j], A[i]) : o==="-" ? push("-", A[i]) : push("+", B[i]));
  // 빼고 더한 것 사이에 낀 띄어쓰기 하나는 바뀐 덩어리에 붙여 읽기 쉽게
  for(let k=1;k<out.length-1;k++) if(out[k].t==="=" && /^\s+$/.test(out[k].s) && out[k-1].t!=="=" && out[k+1].t!=="=" && glen(out[k].s)<=1){ out[k].t = "~"; }
  return out;
}
function compare(){
  const ws = $("pdWs").checked, u = unit();
  let A = $("pdA").value.replace(/\r\n?/g,"\n").split("\n"), B = $("pdB").value.replace(/\r\n?/g,"\n").split("\n");
  if(ws){ A = A.filter(l=>l.trim()); B = B.filter(l=>l.trim()); }
  const ops = myers(A.map(l=>normLine(l,ws)), B.map(l=>normLine(l,ws)), 20000) || [...A.map((_,i)=>["-",i]), ...B.map((_,j)=>["+",j])];
  const rows = []; let i = 0;
  while(i<ops.length){
    if(ops[i][0]==="="){ rows.push({eq:true, a:A[ops[i][1]], b:B[ops[i][2]]}); i++; continue; }
    const da = [], db = [];
    while(i<ops.length && ops[i][0]!=="="){ if(ops[i][0]==="-") da.push(A[ops[i][1]]); else db.push(B[ops[i][1]]); i++; }
    rows.push({eq:false, a:da.join("\n"), b:db.join("\n"), hasA:da.length>0, hasB:db.length>0, parts: inner(da.join("\n"), db.join("\n"), u, ws)});
  }
  return rows;
}
const side = (parts, which)=>parts.map(p=>{
  if(p.t==="=" || p.t==="~") return esc(which==="a" ? p.sa : p.s);
  if(p.t==="-" && which==="a") return `<del>${esc(p.s)}</del>`;
  if(p.t==="+" && which==="b") return `<ins>${esc(p.s)}</ins>`;
  return "";
}).join("");
const inl = parts=>parts.map(p=>p.t==="-" ? `<del>${esc(p.s)}</del>` : p.t==="+" ? `<ins>${esc(p.s)}</ins>` : esc(p.s)).join("");

let last = null;
function run(){
  const a = $("pdA").value, b = $("pdB").value;
  $("pdAc").textContent = a ? `${glen(a).toLocaleString()}자` : ""; $("pdBc").textContent = b ? `${glen(b).toLocaleString()}자` : "";
  if(!a.trim() || !b.trim()){ $("pdOut").innerHTML = ""; $("pdStats").hidden = true; $("pdCopy").disabled = $("pdAsk").disabled = !(a.trim()&&b.trim());
    $("pdStatus").textContent = "두 칸에 글을 넣으면 바로 비교합니다."; last = null; return; }
  const rows = compare(); last = rows;
  const ch = rows.filter(r=>!r.eq);
  let add = 0, del = 0, spots = 0;
  ch.forEach(r=>r.parts.forEach(p=>{ const n = glen(p.s.replace(/\s/g,"")); if(p.t==="+"){ add += n; spots++; } else if(p.t==="-"){ del += n; spots++; } }));
  if(!ch.length){ $("pdStatus").textContent = $("pdWs").checked ? "두 글이 같습니다(띄어쓰기·빈 줄 차이는 무시했습니다)." : "두 글이 똑같습니다."; }
  else $("pdStatus").textContent = `바뀐 곳 ${ch.length}군데`;
  $("pdStats").hidden = false;
  $("pdStats").innerHTML = `<div><b class="pda">+${add.toLocaleString()}</b><span>더한 글자</span></div><div><b class="pdd">−${del.toLocaleString()}</b><span>뺀 글자</span></div>`
    + `<div><b>${glen(a).toLocaleString()} → ${glen(b).toLocaleString()}</b><span>전체 글자 수</span></div><div><b id="pdTok">…</b><span>GPT 토큰 수</span></div>`;
  const only = $("pdOnly").checked, v = view();
  const near = new Set(); rows.forEach((r,k)=>{ if(!r.eq){ near.add(k-1); near.add(k+1); } });
  let html = "", skip = 0;
  const flush = ()=>{ if(skip){ html += `<div class="pdskip">같은 줄 ${skip}개</div>`; skip = 0; } };
  rows.forEach((r,k)=>{
    if(r.eq){
      if(only && !near.has(k)){ skip++; return; }
      flush();
      html += v==="side" ? `<div class="pdrow"><div>${esc(r.a)||"&nbsp;"}</div><div>${esc(r.b)||"&nbsp;"}</div></div>` : `<div class="pdrow one"><div>${esc(r.b)||"&nbsp;"}</div></div>`;
    }else{
      flush();
      html += v==="side" ? `<div class="pdrow ch"><div class="${r.hasA?"":"none"}">${r.hasA?side(r.parts,"a"):""}</div><div class="${r.hasB?"":"none"}">${r.hasB?side(r.parts,"b"):""}</div></div>`
                         : `<div class="pdrow one ch"><div>${inl(r.parts)}</div></div>`;
    }
  });
  flush();
  $("pdOut").className = "pdout " + v;
  $("pdOut").innerHTML = (v==="side" ? `<div class="pdrow pdh"><div>원래</div><div>바꾼 뒤</div></div>` : "") + html;
  $("pdCopy").disabled = !ch.length; $("pdAsk").disabled = false;
  const T = window.SHIFT_O200K;
  const tok = ()=>{ const x = window.SHIFT_O200K, na = x.countTokens(a), nb = x.countTokens(b), el = $("pdTok"); if(el) el.textContent = `${na.toLocaleString()} → ${nb.toLocaleString()}`; };
  if(T) tok(); else { const s = document.createElement("script"); s.src = TOK; s.onload = tok; s.onerror = ()=>{ const el=$("pdTok"); if(el) el.textContent="-"; }; document.head.appendChild(s); }
}
function diffText(){
  return (last||[]).map(r=> r.eq ? r.b : r.parts.map(p=>p.t==="+" ? `[+${p.s}]` : p.t==="-" ? `[-${p.s}]` : p.s).join("")).join("\n");
}
const copy = (t, m)=>(navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast(m)).catch(()=>{ const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast(m); });
const SAMPLE_A = `너는 마케팅 전문가야.
아래 제품 소개 글을 인스타그램 캡션으로 바꿔 줘.
- 길이: 300자
- 해시태그 10개
- 이모지 많이

[제품 소개]
새로 나온 무선 이어폰입니다. 배터리가 오래갑니다.`;
const SAMPLE_B = `너는 20대 직장인을 잘 아는 마케팅 담당자야.
아래 제품 소개 글을 인스타그램 캡션으로 바꿔 줘.
- 길이: 150자 이내
- 해시태그 5개
- 첫 줄은 질문으로 시작
- 과장 광고 표현(최고, 1위)은 쓰지 마

[제품 소개]
새로 나온 무선 이어폰입니다. 배터리가 한 번 충전에 30시간 갑니다.`;
let tm; const later = ()=>{ clearTimeout(tm); tm = setTimeout(run, 150); };
$("pdA").addEventListener("input", later); $("pdB").addEventListener("input", later);
document.querySelectorAll('input[name=pdUnit],input[name=pdView]').forEach(r=>r.addEventListener("change", run));
["pdWs","pdOnly"].forEach(id=>$(id).addEventListener("change", run));
$("pdSample").addEventListener("click", ()=>{ $("pdA").value = SAMPLE_A; $("pdB").value = SAMPLE_B; run(); });
$("pdSwap").addEventListener("click", ()=>{ const t = $("pdA").value; $("pdA").value = $("pdB").value; $("pdB").value = t; run(); });
$("pdClear").addEventListener("click", ()=>{ $("pdA").value = $("pdB").value = ""; run(); $("pdA").focus(); });
$("pdCopy").addEventListener("click", ()=>copy(diffText(), "바뀐 내용을 복사했습니다"));
$("pdAsk").addEventListener("click", ()=>copy(`아래 두 프롬프트를 비교해 주세요.
1. 바뀐 부분을 빠짐없이 목록으로 정리해 주세요(더한 것·뺀 것·고친 것).
2. 바뀐 부분마다 AI 답이 어떻게 달라질지 한 줄씩 설명해 주세요.
3. 바꾼 프롬프트에 아직 모호한 지시가 있으면 짚고 고친 문장을 제안해 주세요.

<원래_프롬프트>
${$("pdA").value}
</원래_프롬프트>

<바꾼_프롬프트>
${$("pdB").value}
</바꾼_프롬프트>`, "AI에 붙여 넣을 프롬프트를 복사했습니다"));
run();
})();

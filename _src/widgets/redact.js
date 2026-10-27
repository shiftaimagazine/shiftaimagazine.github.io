// SHIFT AI 무료 도구 — 개인정보 자동 가리기. 모든 처리는 브라우저 안에서만 한다(네트워크·저장 없음).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("rIn")) return;
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const digits = s=>s.replace(/\D/g,"");

const luhn = n=>{ let s=0, alt=false; for(let i=n.length-1;i>=0;i--){ let d=+n[i]; if(alt){ d*=2; if(d>9) d-=9; } s+=d; alt=!alt; } return s%10===0; };
const bizOk = n=>{ const w=[1,3,7,1,3,7,1,3,5]; let s=0; for(let i=0;i<9;i++) s+=(+n[i])*w[i]; s+=Math.floor((+n[8])*5/10); return (10-(s%10))%10===+n[9]; };
const dateOk = (yy,mm,dd)=>{ const m=+mm, d=+dd; if(m<1||m>12||d<1) return false; const max=[31,29,31,30,31,30,31,31,30,31,30,31][m-1]; return d<=max; };

// 우선순위 순서. 앞에서 잡힌 자리는 뒤 규칙이 다시 잡지 않는다.
const TYPES = [
  {k:"rrn",   name:"주민·외국인등록번호", tag:"주민번호", on:true,
   re:/(?<![\d-])(\d{2})(\d{2})(\d{2})\s?[-–]?\s?([1-8])(\d{6})(?![\d-])/g,
   ok:m=>dateOk(m[1],m[2],m[3]), label:m=>(+m[4]>=5?"외국인등록번호":"주민번호"),
   part:v=>{ const d=digits(v); return d.slice(0,6)+"-"+d[6]+"******"; }},
  {k:"phone", name:"전화번호", tag:"전화번호", on:true,
   re:/(?:\+82[-.\s]?(?:0?1[016789]|0?[2-6]\d?)[-.\s)]?\d{3,4}[-.\s]?\d{4}|(?<![\d-])(?:01[016789]|02|0[3-6][1-5]|070|050\d)[-.\s)]?\d{3,4}[-.\s]?\d{4})(?![\d-])/g,
   part:v=>v.replace(/(\d{3,4})([-.\s)]?)(\d{4})$/,(a,b,c,d)=>"*".repeat(b.length)+c+d)},
  {k:"email", name:"이메일", tag:"이메일", on:true,
   re:/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
   part:v=>{ const [u,d]=v.split("@"); return u.slice(0,Math.min(2,u.length))+"*".repeat(Math.max(1,u.length-2))+"@"+d; }},
  {k:"biz",   name:"사업자등록번호", tag:"사업자번호", on:true,
   re:/(?<![\d-])(\d{3})-(\d{2})-(\d{5})(?![\d-])/g, ok:m=>bizOk(digits(m[0])),
   part:v=>v.slice(0,7)+"*****"},
  {k:"lic",   name:"운전면허번호", tag:"면허번호", on:true,
   re:/(?<![\d-])(1[1-9]|2[0-8])-\d{2}-\d{6}-\d{2}(?![\d-])/g, part:v=>v.slice(0,6)+"******-**"},
  {k:"card",  name:"카드번호", tag:"카드번호", on:true,
   re:/(?<![\d-])\d{4}[- ]?\d{4,6}[- ]?\d{4,5}(?:[- ]?\d{1,4})?(?![\d-])/g,
   ok:m=>{ const d=digits(m[0]); return d.length>=13 && d.length<=19 && luhn(d); },
   part:v=>v.replace(/\d(?=(?:[- ]?\d){4})/g,"*")},
  {k:"acct",  name:"계좌번호", tag:"계좌번호", on:true,
   re:/(?<![\d-])\d{2,6}-\d{2,6}-\d{2,7}(?:-\d{1,3})?(?![\d-])/g,
   ok:m=>{ const d=digits(m[0]); if(d.length<10||d.length>15) return false; return !/^(19|20)\d{2}-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])(?:$|-)/.test(m[0]); },
   part:v=>v.replace(/\d(?=(?:-?\d){4})/g,"*")},
  {k:"pass",  name:"여권번호", tag:"여권번호", on:true,
   re:/(?<![A-Za-z0-9])[MSRODG](?:\d{8}|\d{3}[A-Z]\d{4})(?![A-Za-z0-9])/g, part:v=>v[0]+"*".repeat(v.length-1)},
  {k:"ip",    name:"IP 주소", tag:"IP", on:true,
   re:/(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/g, part:v=>v.replace(/\.\d+\.\d+$/,".*.*")},
];
const WORDS = {k:"word", name:"직접 넣은 말", tag:"가림", on:true};
const state = Object.fromEntries(TYPES.map(t=>[t.k,t.on]));
let lastMap = new Map();  // 이름표 → 원래 값 (이 탭 안에서만)

function words(){ return ($("rWords").value||"").split(/[,\n]/).map(s=>s.trim()).filter(s=>s.length>=2); }

function find(text){
  const spans = []; const used = new Uint8Array(text.length + 1);
  const taken = (a,b)=>{ for(let i=a;i<b;i++) if(used[i]) return true; return false; };
  const take = (a,b)=>{ for(let i=a;i<b;i++) used[i]=1; };
  for(const t of TYPES){
    if(!state[t.k]) continue;
    t.re.lastIndex = 0; let m;
    while((m = t.re.exec(text))){
      const a=m.index, b=a+m[0].length;
      if(t.ok && !t.ok(m)) continue;
      if(taken(a,b)) continue;
      take(a,b); spans.push({a,b,t,label:t.label?t.label(m):t.tag,v:m[0]});
    }
  }
  const ws = words().sort((x,y)=>y.length-x.length);
  for(const w of ws){
    let i = 0;
    while((i = text.indexOf(w,i)) !== -1){ const a=i, b=i+w.length; i=b; if(!taken(a,b)){ take(a,b); spans.push({a,b,t:WORDS,label:WORDS.tag,v:w}); } }
  }
  return spans.sort((x,y)=>x.a-y.a);
}

function maskOf(s, mode, numbering){
  if(mode==="dot") return s.v.replace(/[^\s\-.@()+]/g,"●");
  if(mode==="part") return s.t.part ? s.t.part(s.v) : s.v[0]+"*".repeat(Math.max(1,s.v.length-1));
  const key = s.label+"|"+(s.t.k==="email"||s.t.k==="word" ? s.v.toLowerCase() : digits(s.v)||s.v);
  if(!numbering.byKey.has(key)){ const n=(numbering.count[s.label]=(numbering.count[s.label]||0)+1); numbering.byKey.set(key,`[${s.label}${n}]`); }
  return numbering.byKey.get(key);
}

let timer;
function run(){
  const text = $("rIn").value; const mode = (document.querySelector('input[name=rmode]:checked')||{}).value||"tag";
  const spans = find(text); const numbering = {count:{}, byKey:new Map()};
  let out = "", prev = "", p = 0; const cnt = {};
  lastMap = new Map();
  for(const s of spans){
    const m = maskOf(s, mode, numbering);
    if(mode==="tag") lastMap.set(m, s.v);
    out += text.slice(p, s.a) + m;
    prev += esc(text.slice(p, s.a)) + `<mark title="${esc(s.label)}">${esc(s.v)}</mark>`;
    p = s.b; cnt[s.t.name] = (cnt[s.t.name]||0)+1;
  }
  out += text.slice(p); prev += esc(text.slice(p));
  $("rOut").value = out;
  $("rPrev").innerHTML = text ? prev : "";
  $("rPrev").hidden = !text || !spans.length;
  const parts = Object.entries(cnt).map(([k,v])=>`<b>${esc(k)}</b> ${v}`);
  $("rSum").innerHTML = !text ? "글을 넣으면 찾은 개인정보가 여기에 표시됩니다." :
    spans.length ? `찾아서 가린 것 ${spans.length}곳 · ${parts.join(" · ")}` : "찾은 개인정보가 없습니다. 이름·주소 같은 것은 '직접 가릴 말'에 넣어 보세요.";
  $("rRestoreBox").hidden = mode!=="tag";
  counts(text);
  restore();
}
function counts(text){
  // 종류 버튼에 개수 표시(꺼진 종류도 몇 개 있는지 보여 줌)
  const n = {};
  for(const t of TYPES){ t.re.lastIndex=0; let m, c=0; while((m=t.re.exec(text))){ if(!t.ok||t.ok(m)) c++; } n[t.k]=c; }
  document.querySelectorAll("#rTypes button").forEach(b=>{ const c=n[b.dataset.k]; b.querySelector("small").textContent = text&&c ? c : ""; });
}
function restore(){
  const ai = $("rAi").value; if(!ai){ $("rBack").value=""; $("rBackInfo").textContent=""; return; }
  let n = 0; const back = ai.replace(/\[[^\[\]\s]{1,12}\d{1,4}\]/g, m=>{ if(lastMap.has(m)){ n++; return lastMap.get(m); } return m; });
  $("rBack").value = back; $("rBackInfo").textContent = n ? `${n}곳을 원래 값으로 바꿨습니다` : "바꿀 이름표를 찾지 못했습니다(위 1~3단계를 같은 탭에서 먼저 해 주세요)";
}
const later = ()=>{ clearTimeout(timer); timer = setTimeout(run, 120); };

$("rTypes").innerHTML = TYPES.map(t=>`<button type="button" data-k="${t.k}" aria-pressed="${state[t.k]}">${esc(t.name)} <small></small></button>`).join("");
$("rTypes").addEventListener("click", e=>{ const b=e.target.closest("button[data-k]"); if(!b) return; state[b.dataset.k]=!state[b.dataset.k]; b.setAttribute("aria-pressed", state[b.dataset.k]); run(); });
$("rIn").addEventListener("input", later); $("rWords").addEventListener("input", later); $("rAi").addEventListener("input", restore);
document.querySelectorAll('input[name=rmode]').forEach(r=>r.addEventListener("change", run));
$("rClear").onclick = ()=>{ $("rIn").value=""; $("rInfo").textContent=""; run(); $("rIn").focus(); };
$("rSample").onclick = ()=>{
  $("rIn").value = ["(가짜 예시) 고객 문의 정리","이름\t연락처\t이메일\t메모",
    "홍길동\t010-1234-5678\thong@example.com\t주민번호 900101-1234567, 환불 계좌 110-123-456789",
    "김영희\t02-123-4567\tkim.yh@example.co.kr\t카드 4111-1111-1111-1111 결제 오류, 접속 IP 192.168.0.12",
    "","시프트상사 담당자에게 2026-10-27까지 회신 예정"].join("\n");
  $("rWords").value = "홍길동, 김영희, 시프트상사"; $("rInfo").textContent = "가짜 예시입니다"; run();
};
$("rFile").addEventListener("change", async e=>{
  const f = e.target.files[0]; if(!f) return;
  if(f.size > 5*1024*1024){ $("rInfo").textContent = "5MB 이하 파일만 열 수 있습니다"; return; }
  const buf = await f.arrayBuffer(); let text;
  try{ text = new TextDecoder("utf-8",{fatal:true}).decode(buf); }catch(_){ text = new TextDecoder("euc-kr").decode(buf); }
  $("rIn").value = text.replace(/^﻿/,""); $("rIn").dataset.name = f.name; $("rInfo").textContent = `${f.name} 열림`; run(); e.target.value = "";
});
const copy = (txt, btn)=>{ if(!txt) return; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(()=>{ const o=btn.textContent; btn.textContent="복사했습니다"; setTimeout(()=>btn.textContent=o,1400); }).catch(()=>{ const ta=document.createElement("textarea"); ta.value=txt; document.body.append(ta); ta.select(); try{document.execCommand("copy");}catch(_){} ta.remove(); }); };
$("rCopy").onclick = e=>copy($("rOut").value, e.currentTarget);
$("rBackCopy").onclick = e=>copy($("rBack").value, e.currentTarget);
$("rDown").onclick = ()=>{
  const txt = $("rOut").value; if(!txt) return;
  const name = ($("rIn").dataset.name||"가린결과.txt").replace(/(\.[^.]+)?$/, m=>"-가림"+(m||".txt"));
  const isCsv = /\.(csv|tsv)$/i.test(name);
  const blob = new Blob([(isCsv?"﻿":"")+txt], {type:(isCsv?"text/csv":"text/plain")+";charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
};
run();
})();

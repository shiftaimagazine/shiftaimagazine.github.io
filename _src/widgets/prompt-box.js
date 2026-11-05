// SHIFT AI 무료 도구 — 내 프롬프트함. 프롬프트·채운 값은 이 브라우저의 localStorage("shift-promptbox-v1")에만 둔다. 어디에도 보내지 않는다.
// 빈칸: [이름] 또는 {{이름}}. 같은 이름은 한 번만 채우고, 채운 값은 vals 에 기억해 다른 프롬프트에도 먼저 넣는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("pbBody")) return;
const KEY = "shift-promptbox-v1";
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2000); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const uid = ()=>Date.now().toString(36) + Math.random().toString(36).slice(2,7);
let D = {v:1, items:[], vals:{}}, editing = null, using = null, tagF = "all", ok = true;
function load(){ try{ const d = JSON.parse(localStorage.getItem(KEY) || "null"); if(d && Array.isArray(d.items)) D = {v:1, items:d.items, vals:d.vals||{}}; }catch(_){ ok = false; } }
function store(){ try{ localStorage.setItem(KEY, JSON.stringify(D)); return true; }catch(_){ toast("이 브라우저에 저장하지 못했습니다(시크릿 창이거나 저장 공간이 꺼져 있음)"); return false; } }
// 빈칸 찾기: [이름] · {{이름}}. [1]·[x]·[ ]·링크 [글](주소)·인용 [각주1] 같은 것은 빼고, 최대 80자
const BLANK = /\{\{\s*([^{}\n]{1,60}?)\s*\}\}|\[([^\[\]\n]{1,80})\](?!\()/g;
const isBlank = n=>n && !/^\s*$/.test(n) && !/^[\dxX✓✔ \-.,]+$/.test(n) && !/^(각주|출처|주)\s*\d+$/.test(n) && !/^https?:/.test(n);
// 프롬프트 만들기 도구가 쓰는 칸 머리([맥락]·[자료] … 한 줄에 혼자 있는 것)는 빈칸이 아니다
const HEADS = new Set(["맥락","자료","할 일","꼭 지킬 것","답 형식","답하기 전에 확인할 것","역할","조건","확인"]);
const isHead = (p, m)=>{ const n = (m[2]||"").trim(); if(!n || !HEADS.has(n)) return false; const a = p.lastIndexOf("\n", m.index-1) + 1, b = p.indexOf("\n", m.index); return p.slice(a, b<0 ? p.length : b).trim()===m[0]; };
function blanks(p){ const out = []; let m; BLANK.lastIndex = 0; while((m = BLANK.exec(p))){ const n = (m[1]||m[2]||"").trim(); if(isBlank(n) && !isHead(p, m) && !out.includes(n)) out.push(n); } return out; }
const longField = n=>/붙여|자료|원문|녹취|본문|내용|메일|글$|문서|목록|표|코드|메모|공고|이력서|자기소개서/.test(n) || n.length > 14;
function fill(p, vals, mark){
  BLANK.lastIndex = 0;
  return p.replace(BLANK, (all, a, b, off)=>{ const n = (a||b||"").trim(); if(!isBlank(n) || isHead(p, {0:all, 2:b, index:off})) return mark ? esc(all) : all;
    const v = (vals[n]||"").trim(); if(!mark) return v || all; return v ? `<mark class="pbok">${esc(v)}</mark>` : `<mark class="pbno">${esc(all)}</mark>`; });
}
const fillHtml = (p, vals)=>{ let out = "", last = 0, m; BLANK.lastIndex = 0;
  while((m = BLANK.exec(p))){ out += esc(p.slice(last, m.index)); const n = (m[1]||m[2]||"").trim();
    if(isBlank(n) && !isHead(p, m)){ const v = (vals[n]||"").trim(); out += v ? `<mark class="pbok">${esc(v)}</mark>` : `<mark class="pbno">${esc(m[0])}</mark>`; } else out += esc(m[0]); last = m.index + m[0].length; }
  return out + esc(p.slice(last)); };

// ---------- 담기 ----------
function found(){ const b = blanks($("pbBody").value); $("pbFound").textContent = b.length ? `빈칸 ${b.length}개: ${b.slice(0,5).join(", ")}${b.length>5?" …":""}` : $("pbBody").value.trim() ? "빈칸 없음 — 그대로 복사하는 프롬프트" : ""; }
function save(){
  const p = $("pbBody").value.trim(), t = $("pbTitle").value.trim() || p.split("\n")[0].slice(0,40), tag = $("pbTag").value.trim();
  if(!p){ toast("프롬프트 내용을 적어 주세요"); return; }
  if(editing){ const it = D.items.find(x=>x.id===editing); if(it){ it.t = t; it.p = p; it.tag = tag; } }
  else { if(D.items.some(x=>x.p===p)){ toast("같은 내용이 이미 함에 있습니다"); return; } D.items.push({id:uid(), t, p, tag, star:false, n:0, at:Date.now(), used:0}); }
  if(store()){ toast(editing ? "고쳐 저장했습니다" : "함에 저장했습니다"); clearForm(); list(); }
}
function clearForm(){ editing = null; $("pbTitle").value = $("pbTag").value = $("pbBody").value = ""; $("pbSave").textContent = "함에 저장"; found(); }
const STARTER = [
  {t:"고객 메일 정중하게 답장", tag:"메일", p:"당신은 [회사명] 고객지원 담당자입니다. 아래 고객 메일에 답장을 써 주세요.\n\n지킬 것\n- 사과는 처음에 한 번만 짧게 합니다.\n- 해결 방법과 처리 기한([처리 기한])을 분명히 적습니다.\n- 300자 이내, 습니다체로 씁니다.\n- 메일에 없는 약속(보상·환불)은 쓰지 말고, 필요하면 '확인 필요'라고 표시해 주세요.\n\n고객 메일:\n[고객 메일 붙여 넣기]"},
  {t:"회의록 → 결정·할 일 정리", tag:"회의", p:"아래는 [회의 이름] 회의 녹취(메모)입니다. 회의에 없던 사람도 바로 이해하도록 정리해 주세요.\n\n1. 결정된 것: 한 줄씩\n2. 할 일: 표(할 일 · 담당자 · 기한)\n3. 정하지 못한 것: 다음 회의에서 다룰 질문 형태로\n\n녹취에 없는 담당자·기한은 지어내지 말고 '미정'이라고 적어 주세요.\n\n[회의 녹취록 붙여 넣기]"},
  {t:"긴 자료 3줄 요약 + 숫자 표", tag:"요약", p:"<자료>\n[요약할 보고서나 글 붙여 넣기]\n</자료>\n\n위 자료를 [보고 받을 사람]에게 보고하려고 합니다.\n1. 결론을 먼저, 세 줄로 요약해 주세요.\n2. 자료에 나온 숫자·날짜는 표로 따로 모아 주세요(항목 · 숫자 · 자료의 어느 부분).\n3. 자료만으로 확실하지 않은 내용은 '확인 필요'라고 적어 주세요."},
  {t:"엑셀 수식 만들어 달라기", tag:"엑셀", p:"엑셀(또는 구글 시트)에서 쓸 수식을 만들어 주세요.\n\n표 모양: [열 이름과 예시 데이터 3~5줄 붙여 넣기]\n하고 싶은 일: [하고 싶은 계산, 예: B열 금액이 100만 원 이상인 행만 C열에 '확인' 표시]\n\n수식은 셀에 바로 붙여 넣을 수 있게 한 줄로 주고, 각 부분이 무슨 뜻인지 쉬운 말로 풀어 주세요. 내 표에서 확인해 볼 예시 결과도 하나 보여 주세요."}
];

// ---------- 목록 ----------
function list(){
  const tags = [...new Set(D.items.map(x=>x.tag).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ko"));
  $("pbTags").innerHTML = tags.map(t=>`<option value="${esc(t)}">`).join("");
  if(tagF!=="all" && tagF!=="star" && !tags.includes(tagF)) tagF = "all";
  $("pbTagF").innerHTML = D.items.length ? `<button aria-pressed="${tagF==="all"}" data-tf="all">전체 ${D.items.length}</button>` + (D.items.some(x=>x.star) ? `<button aria-pressed="${tagF==="star"}" data-tf="star">★ 즐겨찾기</button>` : "") + tags.map(t=>`<button aria-pressed="${tagF===t}" data-tf="${esc(t)}">${esc(t)} ${D.items.filter(x=>x.tag===t).length}</button>`).join("") : "";
  const q = $("pbQ").value.trim().toLowerCase().replace(/\s/g,""), sort = $("pbSort").value;
  let xs = D.items.filter(x=>(tagF==="all" || (tagF==="star" ? x.star : x.tag===tagF)) && (!q || (x.t+x.p+x.tag).toLowerCase().replace(/\s/g,"").includes(q)));
  xs.sort((a,b)=>(b.star-a.star) || (sort==="t" ? a.t.localeCompare(b.t,"ko") : sort==="n" ? b.n-a.n : sort==="at" ? b.at-a.at : (b.used||b.at)-(a.used||a.at)));
  $("pbCount").textContent = D.items.length ? `${D.items.length}개` : "";
  $("pbList").innerHTML = !ok ? `<div class="empty">이 브라우저는 저장 공간을 쓸 수 없습니다. 시크릿 창이라면 일반 창에서 열어 주세요.</div>`
    : !D.items.length ? `<div class="empty">아직 담은 프롬프트가 없습니다. 위에서 직접 담거나 '예시 4개 담기'를 눌러 보세요. <a href="/prompts/">복붙 프롬프트 모음</a>에서 골라 담을 수도 있습니다.</div>`
    : !xs.length ? `<div class="empty">찾는 프롬프트가 없습니다.</div>`
    : xs.map(x=>{ const b = blanks(x.p); return `<article class="pbc${using===x.id?" on":""}" data-id="${x.id}">
      <div class="pbh"><button type="button" class="pbstar" data-star="${x.id}" aria-pressed="${!!x.star}" aria-label="즐겨찾기">${x.star?"★":"☆"}</button><b>${esc(x.t)}</b>${x.tag?`<span class="cat">${esc(x.tag)}</span>`:""}</div>
      <p>${esc(x.p.replace(/\s+/g," ").slice(0,140))}${x.p.length>140?"…":""}</p>
      <div class="pbm"><span>${b.length ? `빈칸 ${b.length}개` : "빈칸 없음"}${x.n ? ` · ${x.n}번 씀` : ""}</span>
        <span class="pba"><button class="btn" type="button" data-use="${x.id}">쓰기</button><button class="ghost" type="button" data-edit="${x.id}">고치기</button><button class="ghost" type="button" data-del="${x.id}">지우기</button></span></div></article>`; }).join("");
}

// ---------- 빈칸 채워 쓰기 ----------
function use(id, scroll){
  const it = D.items.find(x=>x.id===id); if(!it) return; using = id; list();
  const b = blanks(it.p);
  $("pbUseHint").innerHTML = `<b>${esc(it.t)}</b> · ${b.length ? `빈칸 ${b.length}개를 채우면 아래 미리 보기에 바로 들어갑니다.` : "빈칸이 없는 프롬프트입니다. 그대로 복사하세요."}`;
  $("pbFields").innerHTML = b.map((n,i)=>`<label class="pbf"><span>${esc(n)}</span>${longField(n) ? `<textarea rows="3" data-b="${esc(n)}" placeholder="${esc(n)}">${esc(D.vals[n]||"")}</textarea>` : `<input type="text" data-b="${esc(n)}" value="${esc(D.vals[n]||"")}" placeholder="${esc(n)}">`}</label>`).join("");
  ["pbCopy","pbReset"].forEach(k=>$(k).disabled = false);
  preview();
  if(scroll) $("pbUse").scrollIntoView({behavior:"smooth", block:"start"});
}
function preview(){
  const it = D.items.find(x=>x.id===using); if(!it){ $("pbPrev").innerHTML = ""; $("pbLeft").textContent = ""; return; }
  const vals = {...D.vals}; $("pbFields").querySelectorAll("[data-b]").forEach(el=>vals[el.dataset.b] = el.value);
  $("pbPrev").innerHTML = fillHtml(it.p, vals);
  const left = blanks(it.p).filter(n=>!(vals[n]||"").trim());
  $("pbLeft").textContent = left.length ? `아직 안 채운 빈칸: ${left.join(", ")} — 비워 두면 [ ] 그대로 복사됩니다.` : "";
}
function curVals(){ const vals = {}; $("pbFields").querySelectorAll("[data-b]").forEach(el=>vals[el.dataset.b] = el.value); return vals; }

// ---------- 이벤트 ----------
$("pbBody").addEventListener("input", found);
$("pbSave").addEventListener("click", save);
$("pbNew").addEventListener("click", clearForm);
$("pbStarter").addEventListener("click", ()=>{ let k = 0; STARTER.forEach(s=>{ if(!D.items.some(x=>x.p===s.p)){ D.items.push({id:uid(), ...s, star:false, n:0, at:Date.now()+k, used:0}); k++; } });
  if(store()){ toast(k ? `예시 ${k}개를 담았습니다` : "예시는 이미 담겨 있습니다"); list(); } });
$("pbQ").addEventListener("input", list);
$("pbSort").addEventListener("change", list);
$("pbTagF").addEventListener("click", e=>{ const b = e.target.closest("button[data-tf]"); if(!b) return; tagF = b.dataset.tf; list(); });
$("pbList").addEventListener("click", e=>{ const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.use) use(b.dataset.use, true);
  else if(b.dataset.star){ const it = D.items.find(x=>x.id===b.dataset.star); if(it){ it.star = !it.star; store(); list(); } }
  else if(b.dataset.edit){ const it = D.items.find(x=>x.id===b.dataset.edit); if(!it) return; editing = it.id; $("pbTitle").value = it.t; $("pbTag").value = it.tag||""; $("pbBody").value = it.p; $("pbSave").textContent = "고친 내용 저장"; found(); $("pbTitle").scrollIntoView({behavior:"smooth", block:"center"}); }
  else if(b.dataset.del){ const it = D.items.find(x=>x.id===b.dataset.del); if(!it || !confirm(`'${it.t}'을(를) 함에서 지울까요?`)) return; D.items = D.items.filter(x=>x!==it); if(using===it.id){ using = null; $("pbFields").innerHTML = ""; preview(); ["pbCopy","pbReset"].forEach(k=>$(k).disabled = true); $("pbUseHint").textContent = "위 목록에서 '쓰기'를 누르면 여기에 빈칸이 나옵니다."; } if(editing===it.id) clearForm(); store(); list(); }
});
$("pbFields").addEventListener("input", e=>{ const el = e.target.closest("[data-b]"); if(!el) return; D.vals[el.dataset.b] = el.value; clearTimeout(save.t); save.t = setTimeout(store, 400); preview(); });
$("pbCopy").addEventListener("click", ()=>{ const it = D.items.find(x=>x.id===using); if(!it) return;
  const t = fill(it.p, {...D.vals, ...curVals()}, false);
  (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>{ it.n = (it.n||0) + 1; it.used = Date.now(); store(); list(); toast("복사했습니다. 챗GPT·클로드·제미나이에 붙여 넣으세요"); }, ()=>toast("복사하지 못했습니다. 미리 보기를 길게 눌러 복사해 주세요")); });
$("pbReset").addEventListener("click", ()=>{ const it = D.items.find(x=>x.id===using); blanks(it ? it.p : "").forEach(n=>delete D.vals[n]); store(); if(it) use(it.id, false); toast("이 프롬프트의 채운 값을 지웠습니다"); });
$("pbCheck").addEventListener("click", ()=>{ const it = D.items.find(x=>x.id===using); try{ if(it) sessionStorage.setItem("shift-pcheck-in", fill(it.p, {...D.vals, ...curVals()}, false)); }catch(_){} });
const dl = (blob, name)=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000); };
const today = ()=>new Date().toISOString().slice(0,10);
$("pbExport").addEventListener("click", ()=>{ if(!D.items.length) return toast("담은 프롬프트가 없습니다"); dl(new Blob([JSON.stringify({app:"SHIFT AI 내 프롬프트함", v:1, saved:new Date().toISOString(), items:D.items}, null, 1)], {type:"application/json"}), `내프롬프트함-${today()}.json`); });
$("pbMd").addEventListener("click", ()=>{ if(!D.items.length) return toast("담은 프롬프트가 없습니다"); dl(new Blob([D.items.map(x=>`## ${x.t}${x.tag?` (${x.tag})`:""}\n\n${x.p}\n`).join("\n---\n\n")], {type:"text/markdown"}), `내프롬프트함-${today()}.md`); });
$("pbImport").addEventListener("change", async e=>{ const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  try{ const d = JSON.parse(await f.text()), xs = Array.isArray(d) ? d : d.items; if(!Array.isArray(xs)) throw 0; let k = 0;
    xs.forEach(x=>{ if(!x || typeof x.p!=="string" || !x.p.trim() || D.items.some(y=>y.p===x.p)) return; D.items.push({id:uid(), t:String(x.t||x.p.slice(0,40)).slice(0,120), p:x.p, tag:String(x.tag||"").slice(0,40), star:!!x.star, n:+x.n||0, at:+x.at||Date.now(), used:+x.used||0}); k++; });
    if(store()){ list(); toast(k ? `${k}개를 불러왔습니다` : "새로 들어갈 프롬프트가 없습니다(모두 이미 있음)"); }
  }catch(_){ toast("백업 파일을 읽지 못했습니다. 이 페이지에서 받은 .json 파일인지 확인해 주세요"); } });
// 다른 탭(프롬프트 모음·점검기)에서 담으면 목록을 새로 읽는다
window.addEventListener("storage", e=>{ if(e.key===KEY){ load(); list(); } });
load(); list(); found();
try{ const q = new URLSearchParams(location.search).get("use"); if(q && D.items.some(x=>x.id===q)) use(q, false); }catch(_){}
})();

// SHIFT AI 무료 도구 — 글자 수·토큰 세기. 글은 브라우저 안에서만 센다. GPT 토큰은 /lib/gpt-tokenizer/o200k.js(gpt-tokenizer, MIT)를 처음 필요할 때 받아 쓴다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("ccIn")) return;
const KEY = "shift-charcount-v1", TOK = "/lib/gpt-tokenizer/o200k.js";
const ta = $("ccIn");
const fmt = n=>n.toLocaleString("ko-KR");
const seg = typeof Intl!=="undefined" && Intl.Segmenter ? new Intl.Segmenter("ko",{granularity:"grapheme"}) : null;
const glen = s=>{ if(!s) return 0; if(seg){ let n=0; for(const _ of seg.segment(s)) n++; return n; } return Array.from(s).length; };
const enc = new TextEncoder();
let undoVal = null, tokT = null, tokLoading = null;

function count(s){
  const all = glen(s.replace(/\r\n?/g,"\n"));
  const ns = glen(s.replace(/\s/g,""));
  const utf8 = enc.encode(s.replace(/\r\n?/g,"\n")).length;
  let kr2 = 0; for(const ch of s.replace(/\r\n?/g,"\n")) kr2 += ch.charCodeAt(0) < 128 ? 1 : 2;
  const t = s.trim();
  const words = t ? t.split(/\s+/).length : 0;
  const sents = t ? t.split(/[.!?…。？！]+(?=\s|$)|\n+/).filter(x=>x.trim()).length : 0;
  const lines = s ? s.replace(/\r\n?/g,"\n").split("\n").length : 0;
  const paras = t ? t.split(/\n\s*\n/).filter(x=>x.trim()).length : 0;
  return {all, ns, utf8, kr2, words, sents, lines, paras};
}
function stat(label, val, sub){ return `<div><b>${val}</b><span>${label}</span>${sub?`<small>${sub}</small>`:""}</div>`; }
function render(){
  const s = ta.value, c = count(s);
  $("ccStats").innerHTML =
    stat("공백 포함", fmt(c.all)+"자") + stat("공백 제외", fmt(c.ns)+"자") +
    stat("바이트 (UTF-8)", fmt(c.utf8), "한글 1자 = 3바이트") + stat("바이트 (한글 2바이트)", fmt(c.kr2), "EUC-KR 같은 옛 방식") +
    stat("어절", fmt(c.words), "띄어쓰기로 나눈 덩어리") + stat("문장", fmt(c.sents), "마침표·물음표 기준 대략") +
    stat("줄", fmt(c.lines)) + stat("문단", fmt(c.paras), "빈 줄로 나눈 덩어리") +
    stat("원고지", "약 "+fmt(Math.ceil(c.all/200))+"매", "200자 원고지, 칸 규칙 없이 대략");
  goal(c); tokens(s);
  try{ if(s) localStorage.setItem(KEY, s); else localStorage.removeItem(KEY); $("ccSaved").textContent = s ? "이 브라우저에 임시 저장됨" : ""; }catch(_){}
}
function goal(c){
  const g = parseInt($("ccGoal").value,10), basis = document.querySelector('input[name=ccBasis]:checked').value;
  if(!g){ $("ccBar").hidden = true; $("ccLeft").textContent = "목표 글자 수를 넣으면 남은 글자 수를 알려 줍니다."; return; }
  const n = basis==="ns" ? c.ns : c.all, r = n/g;
  $("ccBar").hidden = false; $("ccBar").classList.toggle("over", r>1);
  $("ccBar").firstElementChild.style.width = Math.min(100, r*100)+"%";
  $("ccLeft").innerHTML = n<=g ? `${basis==="ns"?"공백 제외":"공백 포함"} ${fmt(n)}자 / ${fmt(g)}자 · <b>${fmt(g-n)}자 남음</b> (${Math.round(r*100)}%)`
                               : `${basis==="ns"?"공백 제외":"공백 포함"} ${fmt(n)}자 / ${fmt(g)}자 · <b class="over">${fmt(n-g)}자 넘음</b>`;
  try{ localStorage.setItem(KEY+"-goal", JSON.stringify({g, basis})); }catch(_){}
}
const loadTok = ()=> window.SHIFT_O200K ? Promise.resolve() : (tokLoading = tokLoading || new Promise((ok,no)=>{
  const sc=document.createElement("script"); sc.src=TOK; sc.onload=ok; sc.onerror=()=>{ tokLoading=null; no(new Error("load")); }; document.head.appendChild(sc); }));
function tokens(s){
  clearTimeout(tokT);
  if(!s.trim()){ $("ccTok").textContent = "글을 넣으면 셉니다."; return; }
  if(!window.SHIFT_O200K) $("ccTok").textContent = "토큰을 세는 프로그램을 받는 중입니다… (처음 한 번)";
  tokT = setTimeout(()=>{
    loadTok().then(()=>{
      const n = window.SHIFT_O200K.countTokens(ta.value), chars = glen(ta.value.replace(/\s/g,""));
      $("ccTok").innerHTML = `<b>${fmt(n)}</b> 토큰 <span>GPT · o200k 기준</span>` + (n ? `<small>공백 제외 ${(chars/n).toFixed(2)}자당 1토큰</small>` : "");
    }).catch(()=>{ $("ccTok").textContent = "토큰을 세는 프로그램을 받지 못했습니다. 새로고침한 뒤 다시 해 보세요."; });
  }, 250);
}
function edit(fn){ const before = ta.value, after = fn(before); if(after===before) return; undoVal = before; ta.value = after; $("ccUndo").hidden = false; render(); }
$("ccSpace").addEventListener("click", ()=>edit(s=>s.replace(/[ \t ]{2,}/g," ")));
$("ccLines").addEventListener("click", ()=>edit(s=>s.replace(/\r\n?/g,"\n").replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,"\n\n")));
$("ccTrim").addEventListener("click", ()=>edit(s=>s.split(/\r?\n/).map(l=>l.trim()).join("\n").trim()));
$("ccUndo").addEventListener("click", ()=>{ if(undoVal===null) return; ta.value = undoVal; undoVal = null; $("ccUndo").hidden = true; render(); });
$("ccClear").addEventListener("click", ()=>{ if(ta.value) undoVal = ta.value, $("ccUndo").hidden = false; ta.value = ""; render(); ta.focus(); });
ta.addEventListener("input", render);
$("ccGoal").addEventListener("input", ()=>render());
document.querySelectorAll('input[name=ccBasis]').forEach(r=>r.addEventListener("change", ()=>render()));
$("ccPresets").innerHTML = [500,700,1000,1500].map(n=>`<button type="button" data-g="${n}">${fmt(n)}자</button>`).join("");
$("ccPresets").addEventListener("click", e=>{ const b=e.target.closest("button[data-g]"); if(!b) return; $("ccGoal").value = b.dataset.g; render(); });
try{ const v = localStorage.getItem(KEY); if(v) ta.value = v; const g = JSON.parse(localStorage.getItem(KEY+"-goal")||"null");
  if(g){ $("ccGoal").value = g.g; const r=document.querySelector(`input[name=ccBasis][value="${g.basis}"]`); if(r) r.checked = true; } }catch(_){}
render();
})();

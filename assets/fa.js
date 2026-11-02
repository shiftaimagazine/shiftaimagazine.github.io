// SHIFT AI 무료 도구 — 유료 프로그램 무료 대체 찾기. 목록은 빌드할 때 HTML로 들어가 있고(news/alternatives.json), 여기서는 검색·분류로 거르기만 한다. 주소 ?q=&cat=
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("faQ")) return;
const secs = [...document.querySelectorAll(".fap")];
const n = s=>String(s||"").toLowerCase().replace(/[\s·\-_.()]/g,"");
const qs = new URLSearchParams(location.search);
let q = qs.get("q") || "", cat = qs.get("cat") || "all";
function render(){
  const w = n(q); let shown = 0;
  secs.forEach(sc=>{
    const hit = (cat==="all" || sc.dataset.cat===cat) && (!w || n(sc.dataset.k).includes(w) || n(sc.textContent).includes(w));
    sc.hidden = !hit; if(hit) shown++;
  });
  document.querySelectorAll("#faCats button[data-fc]").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.fc===cat)));
  $("faCount").textContent = `${shown}개 프로그램`;
  $("faEmpty").hidden = shown>0;
  if($("faQ").value!==q) $("faQ").value = q;
}
function url(){ const p=new URLSearchParams(); if(q) p.set("q",q); if(cat!=="all") p.set("cat",cat); try{ history.replaceState(null,"", location.pathname+(p.toString()?"?"+p:"")+location.hash); }catch(_){} }
// 검색으로 1~3개 프로그램만 남으면 그 프로그램 id를 한 번씩 센다(입력한 글자는 보내지 않는다)
const seen = new Set(); let tT;
function trackHits(){ clearTimeout(tT); tT = setTimeout(()=>{ if(!q) return; const v = secs.filter(sc=>!sc.hidden); if(!v.length){ if(!seen.has("")){ seen.add(""); window.track&&track("fa-none", "대체 프로그램 못 찾음"); } return; }
  if(v.length>3) return; v.forEach(sc=>{ if(seen.has(sc.id)) return; seen.add(sc.id); window.track&&track("fa-find:"+sc.id, "대체 프로그램 찾음"); }); }, 1500); }
$("faQ").addEventListener("input", e=>{ q = e.target.value.trim(); render(); url(); trackHits(); });
$("faCats").addEventListener("click", e=>{ const b=e.target.closest("button[data-fc]"); if(!b) return; cat = b.dataset.fc; render(); url(); });
render();
if(location.hash){ const t=document.getElementById(location.hash.slice(1)); if(t){ t.hidden=false; t.scrollIntoView(); } }
})();

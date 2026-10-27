// SHIFT AI 무료 도구 — AI 요금 계산기. 가격은 data.js 의 AI_PRICES(공식 가격표에서 확인한 값)를 쓴다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("cTable") || typeof AI_PRICES === "undefined") return;
const P = AI_PRICES;
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const won = v=>v>=1e8 ? (v/1e8).toFixed(1).replace(/\.0$/,"")+"억 원" : v>=100 ? Math.round(v).toLocaleString("ko-KR")+"원" : v>=1 ? v.toFixed(1)+"원" : v>0 ? v.toFixed(2)+"원" : "0원";
const usd = v=>"$"+(v>=100?Math.round(v).toLocaleString("en-US"):v>=0.01?v.toFixed(2):v.toFixed(4));
const unit = v=>"$"+(v>=1?v.toFixed(2):v>=0.1?v.toFixed(2):v.toFixed(3));

const PRESETS = [
  {k:"chat", name:"고객 상담 챗봇", in:1500, out:500, n:1000, d:30, note:"하루 1,000건 상담"},
  {k:"sum",  name:"보고서·회의록 요약", in:20000, out:1500, n:20, d:22, note:"긴 자료를 하루 20번, 평일만"},
  {k:"code", name:"코딩 도우미", in:8000, out:2000, n:150, d:22, note:"하루 150번, 평일만"},
  {k:"mail", name:"메일 초안 쓰기", in:800, out:600, n:50, d:22, note:"하루 50통, 평일만"},
  {k:"blog", name:"글·상품 설명 대량 생성", in:1000, out:3000, n:300, d:30, note:"하루 300개"},
];
let provFilter = "all", preset = "chat";
$("cPresets").innerHTML = PRESETS.map(p=>`<button type="button" data-p="${p.k}" aria-pressed="${p.k===preset}">${esc(p.name)}</button>`).join("");
const setPreset = k=>{ const p = PRESETS.find(x=>x.k===k); preset=k; $("cIn").value=p.in; $("cOut").value=p.out; $("cN").value=p.n; $("cD").value=p.d;
  document.querySelector('input[name=cunit][value=char]').checked = true; units(); document.querySelectorAll("#cPresets button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.p===k)); calc(); };
$("cPresets").addEventListener("click", e=>{ const b=e.target.closest("button[data-p]"); if(b) setPreset(b.dataset.p); });

const provs = [...new Set(P.models.map(m=>m.provider))];
$("cProv").innerHTML = `<button type="button" data-v="all" aria-pressed="true">전체</button>` + provs.map(v=>`<button type="button" data-v="${esc(v)}" aria-pressed="false">${esc(v)}</button>`).join("");
$("cProv").addEventListener("click", e=>{ const b=e.target.closest("button[data-v]"); if(!b) return; provFilter=b.dataset.v; document.querySelectorAll("#cProv button").forEach(x=>x.setAttribute("aria-pressed", x===b)); calc(); });

function units(){ const tok = document.querySelector('input[name=cunit]:checked').value==="tok";
  document.querySelectorAll(".cu").forEach(e=>e.textContent = tok?"토큰":"글자"); $("cRatio").disabled = tok; }
document.querySelectorAll('input[name=cunit]').forEach(r=>r.addEventListener("change", ()=>{
  // 단위를 바꿔도 같은 양이 되게 숫자를 바꿔 준다
  const tok = r.value==="tok" && r.checked, ratio = +$("cRatio").value||1;
  if(r.checked){ for(const id of ["cIn","cOut"]){ const v=+$(id).value||0; $(id).value = Math.round(tok ? v/ratio : v*ratio); } }
  units(); calc(); }));

const TODAY = new Date(Date.now()+9*3600e3).toISOString().slice(0,10);  // 한국 날짜
function basePrice(m){ // 예정된 가격 변경(changes)이 오늘 날짜에 이미 시작됐으면 그 값
  let b = {in:m.in, out:m.out, cached:m.cached};
  for(const c of m.changes||[]) if(TODAY >= c.from) b = {in:c.in, out:c.out, cached:c.cached};
  return b;
}
function tierPrice(m, inTok){ // 긴 입력 구간 가격(있을 때)
  if(m.long && inTok > m.long.over) return {in:m.long.in, out:m.long.out, cached:m.long.cached ?? m.cached, long:true};
  return basePrice(m);
}
const upcoming = m=>(m.changes||[]).find(c=>TODAY < c.from);
const md = d=>{ const [,mm,dd]=d.split("-"); return `${+mm}월 ${+dd}일`; };
function calc(){
  const tok = document.querySelector('input[name=cunit]:checked').value==="tok";
  const ratio = Math.max(0.3, +$("cRatio").value||1), fx = +$("cFx").value||P.fx.rate;
  const inTok = tok ? (+$("cIn").value||0) : (+$("cIn").value||0)/ratio;
  const outTok = tok ? (+$("cOut").value||0) : (+$("cOut").value||0)/ratio;
  const n = Math.max(0, +$("cN").value||0), d = Math.max(1, Math.min(31, +$("cD").value||1));
  const rows = P.models.filter(m=>provFilter==="all"||m.provider===provFilter).map(m=>{
    const t = tierPrice(m, inTok); const one = (inTok*t.in + outTok*t.out)/1e6; const month = one*n*d;
    return {m, one, month, t};
  }).sort((a,b)=>a.month-b.month);
  const max = Math.max(...rows.map(r=>r.month), 1e-9);
  $("cSumUse").textContent = `한 번에 입력 약 ${Math.round(inTok).toLocaleString("ko-KR")}토큰 · 출력 약 ${Math.round(outTok).toLocaleString("ko-KR")}토큰 · 한 달 ${(n*d).toLocaleString("ko-KR")}번`;
  $("cTable").innerHTML = `<div class="crow chead"><span>모델</span><span>100만 토큰당 (입력 / 출력)</span><span>한 번</span><span>한 달</span></div>` +
    rows.map(r=>`<div class="crow"><span><b>${esc(r.m.name)}</b><small>${esc(r.m.provider)} · ${esc(r.m.tier)}${r.t.long?" · 긴 입력 요금 적용":""}${r.m.free?" · 무료 등급 있음":""}${upcoming(r.m)?` · ${md(upcoming(r.m).from)}부터 입력 $${upcoming(r.m).in}·출력 $${upcoming(r.m).out}로 인상`:""}</small></span>
      <span class="cp">${unit(r.t.in)} / ${unit(r.t.out)}</span><span class="c1">${won(r.one*fx)}</span>
      <span class="cm"><b>${won(r.month*fx)}</b><small>${usd(r.month)}</small><i style="width:${Math.max(2, r.month/max*100).toFixed(1)}%"></i></span></div>`).join("");
}
["cIn","cOut","cN","cD","cRatio","cFx"].forEach(id=>$(id).addEventListener("input", calc));

$("cFx").value = P.fx.rate;
$("cAsof").textContent = `가격 기준일 ${P.asof}`;
$("cSrc").innerHTML = [...new Map(P.models.map(m=>[m.url, m.provider])).entries()].map(([u,p])=>`<li>${esc(p)} — <a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//,""))}</a></li>`).join("");
$("cFxSrc").innerHTML = `환율 기본값: ${P.fx.rate.toLocaleString("ko-KR")}원 (${esc(P.fx.date)}, <a href="${esc(P.fx.url)}" target="_blank" rel="noopener">${esc(P.fx.source)}</a>). 위 칸에서 바꿀 수 있다.`;
units(); setPreset(preset);
})();

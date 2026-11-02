// SHIFT AI 무료 도구 — AI 구독료 계산기. 요금은 빌드할 때 news/vs.json(10/29 각 사 공식 페이지 확인)에서 #subData 로 들어온다.
// 고른 구독은 이 브라우저(localStorage)에만 저장하고 어디에도 보내지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("sSvc") || !$("subData")) return;
const D = JSON.parse($("subData").textContent);
const FX = D.fx.rate, KEY = "shift-subs-v1";
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const won = n=>Math.round(n/100)*100;
const fmt = n=>won(n).toLocaleString("ko-KR")+"원";
let sel = [];   // {k: "svc:i" | "c:<n>", q, y(연간), n, usd|krw (직접 넣은 것)}
try{ sel = JSON.parse(localStorage.getItem(KEY)||"[]").filter(x=>x&&x.k); }catch(_){ sel = []; }
const save = ()=>{ try{ localStorage.setItem(KEY, JSON.stringify(sel)); }catch(_){} };
const planOf = k=>{ const [s,i]=k.split(":"); const sv=D.services[s]; return sv&&sv.plans[+i] ? {svc:s, sv, p:sv.plans[+i]} : null; };
// 한 달 원화(연간 결제를 켜면 연간 가격 기준)
function monthly(x){
  if(x.k.startsWith("c:")) return (x.cur==="krw" ? x.price : x.price*FX) * (x.q||1);
  const o = planOf(x.k); if(!o) return 0; const p = o.p;
  let m = p.krw!=null ? p.krw : p.usd*FX;
  if(x.y){ if(p.yusd!=null) m = p.yusd*FX; else if(p.ykrw!=null) m = p.ykrw/12; }
  return m * (x.q||1);
}
function renderSvc(){
  $("sSvc").innerHTML = Object.entries(D.services).map(([s,sv])=>`<div class="sbrow"><b>${esc(sv.name)}</b><div class="chips">${sv.plans.map((p,i)=>{
    const k=s+":"+i, on=sel.some(x=>x.k===k); const pr = p.krw!=null ? p.krw.toLocaleString("ko-KR")+"원" : "$"+p.usd;
    return `<button type="button" data-k="${k}" aria-pressed="${on}">${esc(p.n)} <small>${pr}</small></button>`; }).join("")}</div></div>`).join("");
  $("sAsof").textContent = `요금: 각 사 공식 요금 페이지·도움말 ${D.checked.replace(/^(\d+)-0?(\d+)-0?(\d+)$/,"$1년 $2월 $3일")} 확인 · 환율: 1달러=${FX.toLocaleString("ko-KR")}원(${D.fx.source}, ${D.fx.date.replace(/^\d+-0?(\d+)-0?(\d+)$/,"$1월 $2일")})`;
}
function renderList(){
  $("sNum").textContent = sel.length ? `${sel.length}개` : "";
  if(!sel.length){ $("sList").innerHTML = `<p class="empty">위에서 요금제를 누르면 여기에 담깁니다.</p>`; return; }
  $("sList").innerHTML = sel.map((x,i)=>{
    const o = planOf(x.k), name = o ? `${o.sv.name} ${o.p.n}` : x.n;
    const canY = o && (o.p.yusd!=null || o.p.ykrw!=null), team = o ? o.p.team : true;
    return `<div class="sbitem"><span class="sbn">${esc(name)}${o?"":" <small>직접 넣음</small>"}</span>
      ${team?`<label class="inl">인원 <input type="number" min="1" max="999" value="${x.q||1}" data-q="${i}" style="width:64px"></label>`:""}
      ${canY?`<label class="sby"><input type="checkbox" data-y="${i}" ${x.y?"checked":""}> 연간 결제</label>`:""}
      <span class="sbm">${fmt(monthly(x))}<small>/월</small></span>
      <button type="button" class="sbx" data-rm="${i}" aria-label="${esc(name)} 빼기">빼기</button></div>`;
  }).join("");
}
function renderSum(){
  const tot = sel.reduce((s,x)=>s+monthly(x),0);
  $("sCopy").disabled = !sel.length;
  if(!sel.length){ $("sSum").innerHTML = `<p class="empty">요금제를 고르면 합계가 나옵니다.</p>`; $("sTips").innerHTML = ""; return; }
  $("sSum").innerHTML = `<div><span>한 달</span><b>${fmt(tot)}</b></div><div><span>1년</span><b>${fmt(tot*12)}</b></div>`;
  const tips = [];
  // 겹치는 챗봇 구독: 서비스별 한 달 합
  const per = {}; sel.forEach(x=>{ const o=planOf(x.k); if(o) per[o.svc]=(per[o.svc]||0)+monthly(x); });
  const svcs = Object.keys(per);
  if(svcs.length>=2){
    const vals = svcs.map(s=>per[s]), sum = vals.reduce((a,b)=>a+b,0), lo = sum-Math.max(...vals), hi = sum-Math.min(...vals);
    const one = won(lo)===won(hi), rg = (x,y)=>one ? fmt(x) : `${fmt(x)}~${fmt(y)}`;
    const pairs = D.pairs.filter(p=>svcs.includes(p.a)&&svcs.includes(p.b));
    tips.push(`<div class="sbtip"><b>챗봇 유료 구독이 ${svcs.length}개입니다</b><p>${svcs.map(s=>esc(D.services[s].name)).join("·")}는 모두 무료 요금제가 있습니다. 많이 쓰는 하나만 남기고 나머지를 무료로 쓰면 한 달 ${rg(lo,hi)}, 1년 ${rg(lo*12,hi*12)}을 줄일 수 있습니다.</p>${pairs.length?`<p>무엇을 남길지 비교: ${pairs.map(p=>`<a href="/vs/${p.id}/">${esc(D.services[p.a].name)} vs ${esc(D.services[p.b].name)}</a>`).join(" · ")}</p>`:""}</div>`);
  }
  // 연간 결제로 바꾸면
  const ys = sel.filter(x=>{ const o=planOf(x.k); return o && !x.y && (o.p.yusd!=null||o.p.ykrw!=null); }).map(x=>{ const o=planOf(x.k); const yr = monthly(Object.assign({},x,{y:true})); return [o, (monthly(x)-yr)*12]; }).filter(([,d])=>d>0);
  if(ys.length) tips.push(`<div class="sbtip"><b>연간 결제로 바꾸면</b><p>${ys.map(([o,d])=>`${esc(o.sv.name)} ${esc(o.p.n)}: 1년에 ${fmt(d)} 줄어듭니다.`).join(" ")} 1년 치를 한 번에 내는 방식이니 해지·환불 안내를 먼저 확인하세요.</p></div>`);
  const usdOnly = sel.some(x=>{ const o=planOf(x.k); return (o && o.p.krw==null && !(x.y && o.p.ykrw!=null)) || (!o && x.cur!=="krw"); });
  if(usdOnly) tips.push(`<p class="hint">달러로 내는 구독은 세금과 해외 결제 수수료가 따로 붙어 실제 청구액이 더 많을 수 있습니다.</p>`);
  tips.push(`<p class="hint">유료 프로그램 구독도 있다면 <a href="/tools/free-alternatives/">유료 프로그램 무료 대체 찾기</a>, API로 쓴다면 <a href="/tools/ai-cost/">AI 요금 계산기</a>로 이어서 보세요.</p>`);
  $("sTips").innerHTML = tips.join("");
}
const all = ()=>{ renderSvc(); renderList(); renderSum(); save(); };
$("sSvc").addEventListener("click", e=>{ const b=e.target.closest("button[data-k]"); if(!b) return; const k=b.dataset.k, i=sel.findIndex(x=>x.k===k);
  if(i>=0) sel.splice(i,1); else sel.push({k, q:1, y:false}); all(); });
$("sList").addEventListener("click", e=>{ const b=e.target.closest("button[data-rm]"); if(!b) return; sel.splice(+b.dataset.rm,1); all(); });
$("sList").addEventListener("change", e=>{ const t=e.target;
  if(t.dataset.y!=null){ sel[+t.dataset.y].y = t.checked; all(); }
  if(t.dataset.q!=null){ sel[+t.dataset.q].q = Math.min(999, Math.max(1, Math.round(+t.value)||1)); all(); } });
$("sAdd").addEventListener("click", ()=>{ const n=$("sName").value.trim().slice(0,30), v=+$("sPrice").value;
  if(!n || !(v>0) || v>10000000) return toast("이름과 한 달 금액을 넣어 주세요");
  const cur=document.querySelector('input[name=sCur]:checked').value; sel.push({k:"c:"+Date.now(), n, price:v, cur, q:1}); $("sName").value=""; $("sPrice").value=""; all(); });
$("sClear").addEventListener("click", ()=>{ sel=[]; try{ localStorage.removeItem(KEY); }catch(_){} all(); });
$("sCopy").addEventListener("click", ()=>{ const tot=sel.reduce((s,x)=>s+monthly(x),0);
  const lines = sel.map(x=>{ const o=planOf(x.k); return `- ${o?o.sv.name+" "+o.p.n:x.n}${(x.q||1)>1?` ×${x.q}`:""}${x.y?" (연간 결제)":""}: ${fmt(monthly(x))}/월`; });
  const t = `AI 구독료 정리 (SHIFT AI 계산기)\n${lines.join("\n")}\n한 달 ${fmt(tot)} · 1년 ${fmt(tot*12)}\n${location.origin}/tools/ai-subscriptions/`;
  (navigator.clipboard&&navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast("복사했습니다"), ()=>toast("복사하지 못했습니다")); });
all();
})();

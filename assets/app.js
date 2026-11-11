const SITE = "https://shiftaimagazine.com";
const ROUTE = document.body.dataset.route || "home";
const PRE = document.body.dataset.pre === "1";
const P = r=>{ if(!r||r==="home") return "/"; const k=r.slice(0,2), v=r.slice(2);
  if(k==="a-") return "/news/"+v+"/"; if(k==="t-") return "/tutorial/"+v+"/"; if(k==="c-") return "/column/"+v+"/"; if(k==="d-") return "/daily/"+v+"/"; if(k==="w-") return "/dict/"+v+"/";
  return "/"+r+"/"; };

const IG="https://www.instagram.com/shift_ai_magazine/", TH="https://www.threads.com/@shift_ai_magazine";
const $ = s=>document.querySelector(s);
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtDate = d=>d.replace(/-/g,".");
const WD=["일","월","화","수","목","금","토"];
const korDate = d=>{const [y,m,dd]=d.split("-").map(Number); const w=new Date(Date.UTC(y,m-1,dd)).getUTCDay(); return `${y}년 ${m}월 ${dd}일 (${WD[w]})`;};
const byId = Object.fromEntries(ARTICLES.map(a=>[a.id,a]));
const colById = Object.fromEntries(COLUMNS.map(c=>[c.id,c]));
const tutById = Object.fromEntries(TUTORIALS.map(t=>[t.id,t]));
const dayById = Object.fromEntries(DAILY.map(d=>["d-"+d.date,d]));
const termByName = Object.fromEntries(TERMS.map(t=>[t.t,t]));
const termBySlug = Object.fromEntries(TERMS.map(t=>["w-"+t.s,t]));
const TP = t=>"/dict/"+t.s+"/";
const sorted = [...ARTICLES].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
const dailySorted = [...DAILY].sort((a,b)=>b.date.localeCompare(a.date));
const CATS = [...new Set(ARTICLES.map(a=>a.cat))];
const textOf = b=>(b||[]).map(x=>x.p||x.lead||x.q||(x.ul?x.ul.flat().join(" "):"")||(x.pred?x.pred.join(" "):"")||"").join(" ");
const readMin = b=>Math.max(1,Math.round(textOf(b).replace(/\s/g,"").length/350));
const imgOf = a=>a.image&&a.image.src ? a.image : {src:"img/logo.webp",credit:""};
const fig = (im,cls="")=>`<figure class="${cls}"><img src="${im.src}" alt="${esc(im.alt||"")}" loading="lazy">${im.credit?`<figcaption>${esc(im.credit)}</figcaption>`:""}</figure>`;
const thumb = im=>`<img class="thumb" src="${im.src}" alt="" loading="lazy">`;

// 수정 기록(글 아래)·틀린 곳 알려 주기(메일, 11/3~)
const updHTML = x=>x.upd&&x.upd.length ? `<div class="upd"><b>수정 기록</b><ul>${x.upd.map(([d,t])=>`<li><time datetime="${esc(d)}">${fmtDate(d)}</time> ${esc(t)}</li>`).join("")}</ul></div>` : "";
const updMeta = x=>x.upd&&x.upd.length ? `<span class="dot"></span><span>${fmtDate(x.upd[x.upd.length-1][0])} 수정</span>` : "";
const fixLink = (title, path)=>`<a href="mailto:shiftai.magazine@gmail.com?subject=${encodeURIComponent("[정정 요청] "+title)}&body=${encodeURIComponent("페이지: https://shiftaimagazine.com"+path+"\n틀린 곳:\n바른 내용과 근거(원문 링크):\n")}">틀린 곳 알려 주기</a>`;
// 함께 보면 좋은 콘텐츠(11/3~, 이름 11/5~): 빌드할 때(assemble.py) 기사·칼럼마다 고른 길잡이·튜토리얼·무료 도구·AI 사전
const nxHTML = x=>x.nx&&x.nx.length ? `<nav class="nxbox" aria-label="함께 보면 좋은 콘텐츠"><b>함께 보면 좋은 콘텐츠</b>${x.nx.map(([k,h,t])=>`<a href="${esc(h)}" data-ev="next:${esc(h)}"><span>${esc(k)}</span>${esc(t)}</a>`).join("")}</nav>` : "";
const VD = {try:["써볼 만해요","vd-try"], watch:["지켜보세요","vd-watch"], hype:["과장이에요","vd-hype"]};  // 기사 판정(11/2~)
const vdTag = a=>a.verdict&&VD[a.verdict.v] ? `<span class="vd ${VD[a.verdict.v][1]}">${VD[a.verdict.v][0]}</span>` : "";
const postHTML = a=>`<a class="post" href="${P("a-"+a.id)}">${thumb(imgOf(a))}
  <div class="b"><span class="cat">${esc(a.cat)}${vdTag(a)}</span><h3>${tp(a.title)}</h3><p>${esc(a.hook)}</p><div class="meta"><span>${fmtDate(a.date)}</span><span class="dot"></span><span>${a.rm||readMin(a.body)}분 읽기</span></div></div></a>`;
// 튜토리얼: 읽는 시간(글자 수 기준)과 단위(STEP / 프롬프트)
const tutText = t=>[t.deck,t.why,t.intro,...(t.quick?t.quick.lines:[]),...t.items.flatMap(x=>[x.h,x.d,x.how,...(x.more||[]),x.prompt,...(x.term||[]).flat(),...(x.code||[]).map(c=>c.cmd+" "+(c.ok||"")),x.bad,x.good]),...(t.bonus?t.bonus.items:[]),...(t.limits||[])].filter(Boolean).join(" ");
const tutRead = t=>t.rd||Math.max(1,Math.round(tutText(t).replace(/\s/g,"").length/350));
const tutUnit = t=>t.kind==="steps" ? `STEP ${t.n??t.items.length}개` : `프롬프트 ${t.n??t.items.length}개`;
const tutLabel = (t,k)=>t.kind==="steps" ? `STEP ${k+1}` : `프롬프트 ${k+1}`;
const tutHTML = t=>`<a class="post" href="${P(t.id)}">${thumb({src:t.thumb})}
  <div class="b"><span class="cat">${esc(t.cat||"튜토리얼")} · ${esc(t.level)}</span><h3>${tp(t.title)}</h3><p>${esc(t.deck)}</p><div class="meta"><span>${fmtDate(t.date)}</span><span class="dot"></span><span>${tutUnit(t)}</span><span class="dot"></span><span>읽는 데 ${tutRead(t)}분</span>${t.pdf?`<span class="dot"></span><span>PDF 정리본</span>`:""}</div></div></a>`;
const toolHTML = t=>`<a class="post" href="${t.href}">${thumb({src:t.thumb})}
  <div class="b"><span class="cat">무료 도구 · ${esc(t.tag)}</span><h3>${tp(t.title)}</h3><p>${esc(t.desc)}</p><div class="meta"><span>설치·가입 없음</span><span class="dot"></span><span>브라우저에서 바로</span></div></div></a>`;
const colImg = c=>c.image||(c.rel&&byId[c.rel]?imgOf(byId[c.rel]):{src:"img/logo.webp"});
const colHTML = c=>`<a class="post" href="${P(c.id)}">${thumb(colImg(c))}
  <div class="b"><span class="cat">칼럼</span><h3>${tp(c.title)}</h3><p>${esc(c.deck)}</p><div class="meta"><span>${fmtDate(c.date)}</span><span class="dot"></span><span>${c.rm||readMin(c.body)}분 읽기</span></div></div></a>`;
const dayItems = d=>d.items.map(id=>byId[id]).filter(Boolean);
const dayPhoto = d=>{const its=dayItems(d); return (byId[d.lead]&&!byId[d.lead].image.temp)?byId[d.lead]:(its.find(a=>!a.image.temp)||byId[d.lead]||its[0]);};

// AI가 처음이라면 이 순서로(11/5~): 홈 '처음 오셨나요?'와 튜토리얼 목록 맨 위. [튜토리얼 id, 짧은 제목]
const START = [["t-free-vs-paid","챗GPT·클로드·제미나이, 무료로 어디까지 될까"],["t-privacy-settings","쓰기 전에 개인정보·학습 설정부터 점검하기"],["t-verify-numbers","AI가 말한 숫자·날짜, 원문으로 확인하기"]];
const startHTML = ()=>START.filter(([id])=>tutById[id]).map(([id,s],k)=>`<a href="${P(id)}" data-ev="start:${esc(id)}"><i>${k+1}</i><b>${esc(s)}</b><span>${esc(String(tutById[id].time||"").replace(/\s*\(.*$/,""))}</span></a>`).join("");
// ---- 홈(11/5 리디자인): 첫 화면 숫자·카드 2장, 최신 AI 뉴스(데일리 큰 카드 + 겹치지 않는 기사 4개), 튜토리얼(직무·주제 줄 + 카드 8개), 무료 도구 12개 ----
// 줄(칩)은 모두 링크다. 미리 그려 둔 페이지(PRE)에서도 그대로 동작한다.
const LVC = {"입문":"lv1","중급":"lv2"};
const tUnit = t=>{ const n=t.n??(t.items||[]).length; return t.kind==="steps" ? `STEP ${n}` : `프롬프트 ${n}`; };
const pillsHTML = (xs,on)=>xs.map(([k,v,n])=>`<button type="button" data-v="${esc(v)}" aria-pressed="${v===on}">${esc(k)} <span>${n}</span></button>`).join("");
const toolName = t=>t.title.replace(/\s*\(.*?\)\s*$/,"");
const firstSent = s=>{ const m=String(s||"").match(/^.*?다\.(?=\s|$)/); return m?m[0]:s; };
const VC = {try:"v-try", watch:"v-watch", hype:"v-hype"};
const vchip = a=>a.verdict&&VD[a.verdict.v] ? `<span class="vchip ${VC[a.verdict.v]}">${VD[a.verdict.v][0]}</span>` : "";
const mdShort = d=>{ const [y,m,dd]=d.split("-").map(Number); return `${m}월 ${dd}일`; };
const chipA = (href,label,on,ev)=>`<a href="${href}"${on?' aria-current="true"':""}${ev?` data-ev="${esc(ev)}"`:""}>${esc(label)}</a>`;
const ROLES = [["마케터","marketer"],["디자이너","designer"],["기획자·PM","pm"],["영업","sales"],["데이터 분석","data"],["개발자","developer"],["연구자","researcher"],["크리에이터","creator"]];
// 제목 줄바꿈(11/6~, .tph — .tp 는 튜토리얼 본문 문단이 이미 씀): 쉼표 뒤·줄바꿈 기호(\n) 자리에서 먼저 끊고, 덩어리 안에서는 낱말 단위로만 끊는다
const tp = x=>{ x=String(x??""); const ps = x.includes("\n") ? x.split(/\n/) : (()=>{ const i=x.indexOf(", "); return i>3&&i<x.length-4 ? [x.slice(0,i+1), x.slice(i+2)] : [x]; })();
  return ps.length>1 ? `<span class="tphw">${ps.map(y=>`<span class="tph">${esc(y)}</span>`).join(" ")}</span>` : esc(x); };
const ncardHTML = a=>`<a class="ncard" href="${P("a-"+a.id)}">${thumb(imgOf(a))}<span class="nc-b"><span class="nc-m"><span class="nc-cat">${esc(a.cat)}</span>${vchip(a)}</span><b>${tp(a.title)}</b><span class="nc-d">${mdShort(a.date)}</span></span></a>`;
const tc2HTML = t=>`<a class="tc2" href="${P(t.id)}">${thumb({src:t.thumb})}<span class="tc2-b"><span class="tc2-t"><span class="lvc">${esc(t.level)}</span>${(t.tool||[]).length?`<span class="tlc">${esc(t.tool.slice(0,2).join(" · "))}</span>`:""}</span><b>${tp(t.title)}</b><span class="tc2-m">${tUnit(t)} · ${esc(t.cat||"튜토리얼")}</span></span></a>`;
const xcardHTML = t=>`<a class="xcard" href="${t.href}"><span class="tglyph" aria-hidden="true">${esc(t.glyph||t.tag.slice(0,2))}</span><span class="xc-t"><b>${esc(toolName(t))}</b><span>${esc((t.cover&&t.cover.line||t.tag).replace(/\n/g," "))}</span></span></a>`;
// 홈 튜토리얼 카드: 최신순으로 고르되 한 분류에서 2편까지만(같은 묶음이 화면을 다 차지하지 않게), 모자라면 나머지 최신순
const homeTutPick = (n=8)=>{ const xs=[...TUTORIALS].sort((a,b)=>b.date.localeCompare(a.date)), out=[], c={};
  for(const t of xs){ const k=t.cat||""; if((c[k]||0)<2){ out.push(t); c[k]=(c[k]||0)+1; } if(out.length===n) return out; }
  for(const t of xs){ if(!out.includes(t)) out.push(t); if(out.length===n) break; } return out; };
// 홈 무료 도구 카드(11/6 A안): 썸네일 + 분류 + 이름 + 한 줄
const hcardHTML = t=>`<a class="hcard" href="${t.href}" data-ev="home-tool:${esc(t.id)}"><span class="ph">${t.thumb?`<img src="${t.thumb}" alt="" loading="lazy" decoding="async">`:""}</span><span class="hc-b"><span class="k">${esc(t.tag)}</span><b>${tp(toolName(t))}</b><span class="d">${tp(t.cover&&t.cover.line||t.desc||"")}</span></span></a>`;
// 썸네일 띠: 같은 줄을 두 번 이어 붙여 끊김 없이 흐르게(두 번째 줄은 화면 읽기·탭 이동에서 뺌)
const wallRow = xs=>{ const one=(x,h,k)=>`<a href="${x.href}"${h?' tabindex="-1" aria-hidden="true"':` data-ev="home-wall:${esc(x.id)}"`}><img src="${x.src}" alt="${h?"":esc(x.alt)}"${!h&&k<5?' fetchpriority="low"':' loading="lazy"'} decoding="async"></a>`;
  return xs.map((x,k)=>one(x,false,k)).join("") + xs.map((x,k)=>one(x,true,k)).join(""); };  // 첫 화면에 보이는 앞쪽 5장은 바로 불러 빈 칸이 안 보이게
// 흐르는 띠 속도 맞추기(11/6~ 사용자 요청): 도구·튜토리얼·판정 띠 모두 같은 속도(초당 23px, 처음 도구 띠의 절반)로 흐른다.
// 줄마다 길이가 달라도 같은 빠르기가 되도록 길이(복제 포함의 절반) ÷ 속도로 시간을 정한다.
const MARQ_PX = 23;
const syncMarq = ()=>document.querySelectorAll(".hwall .wl-t, .hticker .tk-t").forEach(el=>{ const half=el.scrollWidth/2; if(half>0) el.style.animationDuration=(half/MARQ_PX).toFixed(1)+"s"; });
let marqT=0; addEventListener("resize",()=>{ clearTimeout(marqT); marqT=setTimeout(syncMarq,200); });
addEventListener("load",syncMarq); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(syncMarq);  // 미리 그린 페이지도 열 때마다 화면 폭에 맞춰 다시 잰다
function renderHome2(d){
  if(d){ $("#hPill").href=P("d-"+d.date); $("#hPillT").textContent=`${mdShort(d.date)} · 오늘 기사 ${dayItems(d).length}건`; }
  if($("#hAll")) $("#hAll").textContent = `AI 뉴스 ${ARTICLES.length+COLUMNS.length}개 전체 보기`;
  if($("#newsMore")) $("#newsMore").innerHTML = `<span class="sr">최신 기사 </span>AI 뉴스 ${ARTICLES.length+COLUMNS.length}개 전체 보기 <span class="ne" aria-hidden="true">↗</span>`;
  const tw = TOOLS.filter(t=>t.thumb).slice(0,10).map(t=>({href:t.href,src:t.thumb,alt:toolName(t),id:t.id}));
  const uw = homeTutPick(10).filter(t=>t.thumb).map(t=>({href:P(t.id),src:t.thumb,alt:t.title,id:t.id}));
  if($("#hWall1")) $("#hWall1").innerHTML = wallRow(tw);
  if($("#hWall2")) $("#hWall2").innerHTML = wallRow(uw);
  if($("#hTicker")){ const xs = sorted.slice(0,6), one = (a,h)=>`<a href="${P("a-"+a.id)}"${h?' tabindex="-1" aria-hidden="true"':` data-ev="home-ticker:${esc(a.id)}"`}>${vchip(a)}<span>${tp(a.title)}</span></a>`;
    const row = h=>`<div class="tk-g"><b class="tk-k">SHIFT 판정</b>${xs.map(a=>one(a,h)).join("")}</div>`; $("#hTicker").innerHTML = row(false)+row(true); }
  requestAnimationFrame(syncMarq); if(document.fonts&&document.fonts.ready) document.fonts.ready.then(syncMarq);
  $("#tutMore").innerHTML = `튜토리얼 ${TUTORIALS.length}편 전체 보기 <span class="ne" aria-hidden="true">↗</span>`;
  $("#hRoles").insertAdjacentHTML("beforeend", ROLES.filter(([,s])=>tutById["t-skills-"+s]).map(([k,s])=>chipA(P("t-skills-"+s),k,false,"home-role:"+s)).join("") + chipA("/tutorial/","전체 튜토리얼 →",false,"home-role:all"));
  $("#homeTuts").innerHTML = homeTutPick(4).map(tc2HTML).join("");
  $("#toolsMore").innerHTML = `도구 ${TOOLS.length}개 전체 보기 <span class="ne" aria-hidden="true">↗</span>`;
  $("#homeTools").innerHTML = TOOLS.slice(0,6).map(hcardHTML).join("");
}
// 고르기·미리보기·숫자 올라가기·스크롤 등장(미리 그린 페이지에서도 동작)
const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const replay = el=>{ if(RM) return; el.classList.remove("fade"); void el.offsetWidth; el.classList.add("fade"); };
document.addEventListener("click",e=>{
  const b = e.target.closest("#tutLv button, #dictG button"); if(!b) return;
  const box = b.parentElement, v = b.dataset.v; box.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", String(x===b)));
  if(box.id==="tutLv"){ let k=0; document.querySelectorAll("#homeTuts .tcard").forEach(c=>{ const ok=(!v||c.dataset.lv===v)&&k<6; if(ok){k++;replay(c);} c.hidden=!ok; }); track("home-tut:"+(v||"all"),"홈 튜토리얼 난이도"); }
  else { document.querySelectorAll("#homeTerms .dcard").forEach(c=>{ const ok=c.dataset.g===v; c.hidden=!ok; if(ok) replay(c); }); track("home-dict:"+v,"홈 AI 사전 분야"); }
});
const texPick = r=>{ if(!r||r.classList.contains("on")) return; const i=r.dataset.i;
  document.querySelectorAll("#homeTools .xrow").forEach(x=>x.classList.toggle("on", x===r));
  document.querySelectorAll("#homeTools .tex-pv").forEach(p=>{ const ok=p.dataset.i===i; p.hidden=!ok; if(ok){ replay(p); $("#texPath").textContent="shiftaimagazine.com / tools / "+p.dataset.id; } }); };
["mouseover","focusin"].forEach(ty=>document.addEventListener(ty,e=>{ const r=e.target.closest&&e.target.closest("#homeTools .xrow"); if(r) texPick(r); }));
document.addEventListener("mouseover",function pre(e){ if(!e.target.closest||!e.target.closest("#homeTools")) return;
  document.querySelectorAll("#homeTools .tex-pv img").forEach(im=>im.loading="eager"); document.removeEventListener("mouseover",pre); });
document.addEventListener("keydown",e=>{ if(e.key!=="/"||e.ctrlKey||e.metaKey||e.altKey) return; const t=e.target;
  if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; const f=$("#hq")||$("#sq"); if(f){ e.preventDefault(); f.focus(); } });
// 움직임(11/3 시안): 머리말 그림자·읽기 진행 막대·스크롤 등장(차례로)·섹션 줄 긋기·큰 제호 글자 올라오기·숫자 올라가기.
// 미리 그린 페이지(PRE)에서만 돌려 숨김 상태가 HTML에 박히지 않게 한다. '동작 줄이기' 설정이면 등장 효과는 모두 끈다.
const STAG = ".list > .post, .ngrid > a, .tgrid2 > a, .xgrid > a, .hcgrid > a, .tgrid > .tcard, .dgrid > .dcard, .dailyhome ol li, .tex-list > .xrow, .dlist > a, .sterms > a, .hubs > a, .tcards > a";
function motion(){
  const H = document.documentElement; let t1=0, t2=0;
  const hs = ()=>{ t1=0; H.classList.toggle("scrolled", scrollY>8); };
  addEventListener("scroll",()=>{ if(!t1) t1=requestAnimationFrame(hs); },{passive:true}); hs();
  const art = document.querySelector("article.article"), hd = document.querySelector("header");
  if(art && hd){ const bar=document.createElement("div"); bar.className="rprog"; bar.setAttribute("aria-hidden","true"); bar.innerHTML="<i></i>"; hd.appendChild(bar); const bi=bar.firstChild;
    const up = ()=>{ t2=0; const r=art.getBoundingClientRect(); const p=Math.min(1,Math.max(0,(90-r.top)/Math.max(1,r.height-innerHeight+90))); bi.style.transform=`scaleX(${p.toFixed(4)})`; };
    addEventListener("scroll",()=>{ if(!t2) t2=requestAnimationFrame(up); },{passive:true}); addEventListener("resize",up); up(); }
  if(RM || !("IntersectionObserver" in window)) return;
  const below = el=>el.getBoundingClientRect().top > innerHeight*0.96;
  const io = new IntersectionObserver(es=>{ let k=0; es.forEach(en=>{ if(!en.isIntersecting) return; const el=en.target; io.unobserve(el);
    if(el.dataset.n){ const n=+el.dataset.n, t0=performance.now(); const st=now=>{ const p=Math.min(1,(now-t0)/1200); el.textContent=Math.round(n*(1-Math.pow(1-p,3))).toLocaleString("ko-KR"); if(p<1) requestAnimationFrame(st); }; requestAnimationFrame(st); return; }
    const d = el.classList.contains("stg") ? Math.min(k++,5)*60 : 0;
    el.style.setProperty("--d", d+"ms"); el.classList.add("rvi"); requestAnimationFrame(()=>el.classList.remove("rv-pre"));
    setTimeout(()=>{ el.classList.remove("rvi","stg"); el.style.removeProperty("--d"); }, d+1700); }); },{rootMargin:"0px 0px -6% 0px"});
  document.querySelectorAll(".rv, .sec, .fword").forEach(el=>{ if(below(el)){ el.classList.add("rv-pre"); io.observe(el); } });
  document.querySelectorAll(STAG).forEach(el=>{ if(below(el) && !el.hidden){ el.classList.add("rv-pre","stg"); io.observe(el); } });
  document.querySelectorAll("#hNums [data-n]").forEach(el=>{ if(below(el)){ el.textContent="0"; io.observe(el); } });
}

function renderHome(){
  if($("#hRoles") && $("#hRoles").children.length>1) return;  // 미리 그려 둔 페이지는 이미 채워져 있다
  const d = dailySorted[0], its = d ? dayItems(d) : [];
  if(d){ const lead=dayPhoto(d), im=lead?imgOf(lead):null; const [y,m,dd]=d.date.split("-").map(Number); const w=new Date(Date.UTC(y,m-1,dd)).getUTCDay();
    $("#dailyHome").href = P("d-"+d.date);
    $("#dailyHome").innerHTML = `${im?`<span class="df-fig"><img src="${im.src}" alt="${esc(im.alt||"")}" loading="lazy">${im.credit?`<span class="df-cr">${esc(im.credit)}</span>`:""}</span>`:""}<span class="df-b"><span class="df-k">데일리 이슈 · ${m}월 ${dd}일 ${WD[w]}요일</span><b>${tp(d.title)}</b><ol>${its.slice(0,3).map(a=>`<li>${tp(a.title)}</li>`).join("")}</ol><span class="df-go">이날 소식 ${its.length}건 보기 <span class="ar">→</span></span></span>`; }
  $("#homeNews").innerHTML = sorted.filter(a=>!its.includes(a)).slice(0,4).map(ncardHTML).join("");
  $("#homeNewsM").innerHTML = sorted.slice(0,4).map(postHTML).join("");
  renderHome2(d);
  const rl = sorted.slice(0,3);
  $("#reelwelcome").innerHTML = `<b>릴스 보고 오셨군요. 반갑습니다, SHIFT 편집부입니다.</b><p>방금 보신 영상의 기사 전문과 오늘 올라온 기사를 아래에 모아 두었습니다.</p><div class="acts">${rl.map(a=>`<a href="${P("a-"+a.id)}">${tp(a.title)}</a>`).join("")}</div>`;
}

// AI 뉴스 목록 = 기사 + 칼럼(분류 "칼럼")
const COL = "칼럼";
const FEED = [...ARTICLES.map(a=>({k:"a", key:a.date+" "+(a.time||"00:00"), o:a, cat:a.cat})), ...COLUMNS.map(c=>({k:"c", key:c.date+" 23:59", o:c, cat:COL}))].sort((x,y)=>y.key.localeCompare(x.key));
let catFilter = new URLSearchParams(location.search).get("cat") || "all";
function renderNews(){
  if(!$("#newsList")) return;
  const cnt = c=>FEED.filter(x=>x.cat===c).length;
  $("#catFilters").innerHTML = `<button aria-pressed="${catFilter==="all"}" data-c="all">전체 ${FEED.length}</button>`+[...CATS, COL].map(c=>`<button aria-pressed="${catFilter===c}" data-c="${esc(c)}">${esc(c)} ${cnt(c)}</button>`).join("");
  const q = "";
  const list = FEED.filter(x=>(catFilter==="all"||x.cat===catFilter) && (!q || (x.o.title+(x.o.hook||x.o.deck||"")+(x.o.sub||"")+x.cat).toLowerCase().includes(q)));
  $("#newsList").innerHTML = list.length ? list.map(x=>x.k==="c"?colHTML(x.o):postHTML(x.o)).join("") : `<div class="empty">해당하는 기사가 없습니다.</div>`;
}
$("#catFilters") && $("#catFilters").addEventListener("click",e=>{const b=e.target.closest("button[data-c]"); if(!b) return; catFilter=b.dataset.c; renderNews();
  try{ history.replaceState(null,"", catFilter==="all" ? "/news/" : "/news/?cat="+encodeURIComponent(catFilter)); }catch(_){} });

const KO = ["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let dictFilter = "all", grpFilter = "all";
const GROUPS = ["AI","제품·회사","개발","인프라","보안·개인정보","비즈니스·정책"];
const ORD = [...KO,...EN];
const TERMS_SORTED = [...TERMS].sort((a,b)=>(ORD.indexOf(a.i)-ORD.indexOf(b.i)) || a.t.localeCompare(b.t,"ko"));
function renderDict(){
  if(!$("#terms")) return;
  if($("#grp")) $("#grp").innerHTML = `<button aria-pressed="${grpFilter==="all"}" data-g="all">전체 ${TERMS.length}</button>` + GROUPS.map(g=>`<button aria-pressed="${grpFilter===g}" data-g="${esc(g)}">${esc(g)} ${TERMS.filter(t=>t.g===g).length}</button>`).join("");
  const have = new Set(TERMS.filter(t=>grpFilter==="all"||t.g===grpFilter).map(t=>t.i));
  $("#idx").innerHTML = `<button aria-pressed="${dictFilter==="all"}" data-i="all">전체</button>` + [...KO,...EN].map(c=>`<button aria-pressed="${dictFilter===c}" data-i="${c}" ${have.has(c)?"":"disabled"}>${c}</button>`).join("");
  const q = norm($("#dq") ? $("#dq").value : "");
  const list = TERMS_SORTED.filter(t=>(dictFilter==="all"||t.i===dictFilter) && (grpFilter==="all"||t.g===grpFilter) && (!q || norm(t.t+" "+t.en+" "+t.d).includes(q)));
  $("#terms").innerHTML = list.map(t=>`<div class="term"><dt><a href="${TP(t)}">${esc(t.t)}</a><small>${esc(t.en)}</small>${t.g?`<span class="tg">${esc(t.g)}</span>`:""}</dt><dd>${esc(t.d)}${t.rel&&byId[t.rel]?`<br><a href="${P("a-"+t.rel)}">관련 기사: ${esc(byId[t.rel].title)}</a>`:""}</dd></div>`).join("");
  $("#dictEmpty").hidden = list.length>0;
}
$("#idx") && $("#idx").addEventListener("click",e=>{const b=e.target.closest("button[data-i]"); if(!b||b.disabled) return; dictFilter=b.dataset.i; renderDict();});
$("#grp") && $("#grp").addEventListener("click",e=>{const b=e.target.closest("button[data-g]"); if(!b) return; grpFilter=b.dataset.g; dictFilter="all"; renderDict();});

const drowHTML = d=>{const its=dayItems(d); const lead=dayPhoto(d); const [y,m,dd]=d.date.split("-");
    return `<a class="drow" href="${P("d-"+d.date)}"><div class="dd">${m}.${dd}<small>${korDate(d.date).split(" ").pop()} · ${its.length}건</small></div>
      <div><h3>${tp(d.title)}</h3><ul>${(d.three||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>${lead?`<figure>${thumb(imgOf(lead))}</figure>`:"<span></span>"}</a>`;};
// 튜토리얼 목록 = 검색칸 + 도구 버튼 + 주제 버튼 + 최신순 목록 (주소: /tutorial/?cat=주제&tool=도구&q=검색어)
const _tq = new URLSearchParams(ROUTE==="tutorial" ? location.search : "");
let tutFilter = _tq.get("cat") || "all", tutTool = _tq.get("tool") || "all", tutQ = _tq.get("q") || "";
const TOOL_TAG = "무료 도구";  // 주제 줄 맨 앞: 무료 도구만 모아 보기
const TUT_TOOLS = (()=>{ const c={}; TUTORIALS.forEach(t=>(t.tool||[]).forEach(x=>c[x]=(c[x]||0)+1)); return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,n])=>[k,n]); })();
const tutMatch = (t,q)=>{ if(!q) return true; const n=s=>String(s||"").toLowerCase().replace(/\s/g,""); const h=n([t.title,t.deck,t.cat,(t.tool||[]).join(" "),tutText(t)].join(" ")); return n(q).split(/[,]/).every(w=>!w||h.includes(w)); };
function renderTutList(){
  if(!$("#tutGrid")) return;
  if($("#tutTools")) $("#tutTools").innerHTML = `<span class="flbl">도구</span><button aria-pressed="${tutTool==="all"}" data-tt="all">전체</button>`
    +TUT_TOOLS.map(([k,n])=>`<button aria-pressed="${tutTool===k}" data-tt="${esc(k)}">${esc(k)} ${n}</button>`).join("");
  if($("#tutFilters")) $("#tutFilters").innerHTML = `<span class="flbl">주제</span><button aria-pressed="${tutFilter==="all"}" data-tc="all">전체</button>`
    +`<button class="tooltag" aria-pressed="${tutFilter===TOOL_TAG}" data-tc="${TOOL_TAG}">${TOOL_TAG} ${TOOLS.length}</button>`
    +TUT_CATS.filter(c=>TUTORIALS.some(t=>t.cat===c)).map(c=>`<button aria-pressed="${tutFilter===c}" data-tc="${esc(c)}">${esc(c)} ${TUTORIALS.filter(t=>t.cat===c).length}</button>`).join("");
  if($("#tutQ") && $("#tutQ").value!==tutQ) $("#tutQ").value = tutQ;
  let html, n;
  if(tutFilter===TOOL_TAG){ const ts=TOOLS.filter(t=>!tutQ||[t.title,t.desc,t.tag].join(" ").includes(tutQ)); html=ts.map(toolHTML).join(""); n=ts.length; }
  else { const list = TUTORIALS.filter(t=>(tutFilter==="all"||t.cat===tutFilter)&&(tutTool==="all"||(t.tool||[]).includes(tutTool))&&tutMatch(t,tutQ)); html=list.map(tutHTML).join(""); n=list.length; }
  if($("#tutStart")){ $("#tutStart").hidden = tutFilter!=="all"||tutTool!=="all"||!!tutQ; if(!$("#tutStartL").innerHTML) $("#tutStartL").innerHTML = startHTML(); }
  $("#tutGrid").innerHTML = n ? html : `<div class="empty">조건에 맞는 글이 없습니다. 검색어나 버튼을 바꿔 보세요.</div>`;
  if($("#tutCount")) $("#tutCount").textContent = `${n}편`;
}
function tutURL(){ const q=new URLSearchParams(); if(tutFilter!=="all") q.set("cat",tutFilter); if(tutTool!=="all") q.set("tool",tutTool); if(tutQ) q.set("q",tutQ);
  try{ history.replaceState(null,"", "/tutorial/"+(q.toString()?"?"+q:"")); }catch(_){} }
$("#tutFilters") && $("#tutFilters").addEventListener("click",e=>{const b=e.target.closest("button[data-tc]"); if(!b) return; tutFilter=b.dataset.tc; renderTutList(); tutURL(); });
$("#tutTools") && $("#tutTools").addEventListener("click",e=>{const b=e.target.closest("button[data-tt]"); if(!b) return; tutTool=b.dataset.tt; if(tutFilter===TOOL_TAG) tutFilter="all"; renderTutList(); tutURL(); });
$("#tutQ") && $("#tutQ").addEventListener("input",e=>{ tutQ=e.target.value.trim(); renderTutList(); tutURL(); });
function renderLists(){
  if($("#colGrid")) $("#colGrid").innerHTML = COLUMNS.map(colHTML).join("");
  renderTutList();
  renderTools();
  if($("#resGrid")) $("#resGrid").innerHTML = RESOURCES.map(r=>`<div class="res"><a class="cv" href="${r.pdf}" target="_blank" rel="noopener"><img src="${r.cover}" alt="" loading="lazy"></a>
    <div class="b"><span class="cat">PDF 정리본 · ${r.pages}쪽</span><h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p><div class="meta"><span>${fmtDate(r.date)}</span></div>
    <div class="acts"><a class="btn" href="${r.pdf}" target="_blank" rel="noopener">PDF 열기</a>${r.tut?`<a class="ghost" href="${P(r.tut)}">웹에서 읽기</a>`:""}</div></div></div>`).join("");
  if($("#dailyList")) $("#dailyList").innerHTML = dailySorted.map(drowHTML).join("");
  if($("#dailyPreview")) $("#dailyPreview").innerHTML = dailySorted.slice(0,3).map(drowHTML).join("");
}

// 무료 도구 사용법·도구 탭(11/5~): 첫 화면은 theme.js 가 정한다. 고른 탭은 도구마다 기억한다.
function tpSync(){ const v = document.documentElement.getAttribute("data-tpane"); document.querySelectorAll(".ttabs [data-tp]").forEach(b=>b.setAttribute("aria-selected", String(b.dataset.tp===v))); }
document.addEventListener("click", e=>{ const b = e.target.closest("[data-tp]"); if(!b) return;
  const v = b.dataset.tp; document.documentElement.setAttribute("data-tpane", v); tpSync();
  try{ localStorage.setItem("shift-tg:"+location.pathname, v); }catch(_){}
  if(location.hash==="#guide"||location.hash==="#use"){ try{ history.replaceState(null,"",location.pathname+location.search); }catch(_){} }
  const tb = document.querySelector(".ttabs"); if(tb && tb.getBoundingClientRect().top < 0) tb.scrollIntoView({block:"start"}); });
window.addEventListener("hashchange", ()=>{ if(location.hash==="#guide"||location.hash==="#use"){ document.documentElement.setAttribute("data-tpane", location.hash==="#use"?"tool":"guide"); tpSync(); } });
tpSync();
// 무료 도구 목록(/tools/, 11/5~): 주제 버튼 + 검색. 주소 ?cat=&q=  (주제는 tools.json cats, 검색은 제목·설명·태그·kw)
const TOOL_CATS = ["AI 활용","파일 변환","글쓰기","PDF·문서","사진·이미지","개인정보","비용 절약","번역·회의"];
const TOOL_HINTS = ["PDF","JPG","한글","차트","프롬프트","사진 용량","개인정보","엑셀"];
const _tlq = new URLSearchParams(ROUTE==="tools" ? location.search : "");
let tlCat = TOOL_CATS.includes(_tlq.get("cat")) ? _tlq.get("cat") : "all", tlQ = _tlq.get("q") || "";
function renderTools(){
  if(!$("#toolsGrid")) return;
  if(!$("#tlCats")){ $("#toolsGrid").innerHTML = TOOLS.map(toolHTML).join(""); return; }
  const n=s=>String(s||"").toLowerCase().replace(/[\s·,.\-→()]/g,"");
  const cats = TOOL_CATS.filter(c=>TOOLS.some(t=>(t.cats||[]).includes(c)));
  $("#tlCats").innerHTML = `<span class="flbl">주제</span><button aria-pressed="${tlCat==="all"}" data-tl="all">전체 ${TOOLS.length}</button>`
    + cats.map(c=>`<button aria-pressed="${tlCat===c}" data-tl="${esc(c)}">${esc(c)} ${TOOLS.filter(t=>(t.cats||[]).includes(c)).length}</button>`).join("");
  if($("#tlQ").value!==tlQ) $("#tlQ").value = tlQ;
  const words = tlQ.split(/[\s,]+/).map(n).filter(Boolean);
  const hay = t=>n([t.title,t.desc,t.tag,(t.cats||[]).join(" "),t.kw].join(" "));
  const score = t=>words.reduce((a,w)=>a+(n(t.title).includes(w)?3:0)+(n(t.tag+t.kw).includes(w)?2:0),0);
  let list = TOOLS.filter(t=>(tlCat==="all"||(t.cats||[]).includes(tlCat)) && words.every(w=>hay(t).includes(w)));
  if(words.length) list = list.map((t,i)=>[t,score(t),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).map(x=>x[0]);
  $("#tlCount").textContent = `${list.length}개`;
  $("#toolsGrid").innerHTML = list.length ? list.map(toolHTML).join("")
    : `<div class="empty">'${esc(tlQ)}'에 맞는 도구가 없습니다. 이런 말로 찾아보세요: ${TOOL_HINTS.map(h=>`<a href="/tools/?q=${encodeURIComponent(h)}" data-tlq="${esc(h)}">${esc(h)}</a>`).join(" · ")}</div>`;
}
function tlURL(){ const q=new URLSearchParams(); if(tlCat!=="all") q.set("cat",tlCat); if(tlQ) q.set("q",tlQ); try{ history.replaceState(null,"","/tools/"+(q.toString()?"?"+q:"")); }catch(_){} }
$("#tlCats") && $("#tlCats").addEventListener("click",e=>{const b=e.target.closest("button[data-tl]"); if(!b) return; tlCat=b.dataset.tl; renderTools(); tlURL(); });
$("#tlQ") && $("#tlQ").addEventListener("input",e=>{ tlQ=e.target.value.trim(); renderTools(); tlURL(); });
$("#toolsGrid") && $("#toolsGrid").addEventListener("click",e=>{const a=e.target.closest("a[data-tlq]"); if(!a) return; e.preventDefault(); tlQ=a.dataset.tlq; tlCat="all"; renderTools(); tlURL(); });
// 복붙 프롬프트 모음(/prompts/, 11/2~): 튜토리얼의 prompt·master 를 한곳에. 주소 ?cat=&q=
const PROMPTS = (()=>{ const out=[]; [...TUTORIALS].sort((a,b)=>(a.kind==="prompts"?0:1)-(b.kind==="prompts"?0:1)).forEach(t=>{ const slug=t.id.slice(2);  /* 바로 복사해 쓰는 프롬프트 글이 먼저 */
  if(t.master&&t.master.prompt) out.push({id:slug+"-all", h:"통째로 맡기는 프롬프트: "+t.title, d:(t.master.tool||"AI")+"에 붙여 넣으면 이 글의 단계를 대신 진행합니다.", p:t.master.prompt, t});
  (t.items||[]).forEach((it,i)=>{ if(it.prompt) out.push({id:slug+"-"+(i+1), h:it.h, d:it.d||"", p:it.prompt, t}); }); }); return out; })();
const _pq = new URLSearchParams(ROUTE==="prompts" ? location.search : "");
let prCat = _pq.get("cat") || "all", prQ = _pq.get("q") || "";
function renderPrompts(){
  if(!$("#prList")) return;
  const n=s=>String(s||"").toLowerCase().replace(/\s/g,"");
  const cats = TUT_CATS.filter(c=>PROMPTS.some(x=>x.t.cat===c));
  $("#prCats").innerHTML = `<span class="flbl">주제</span><button aria-pressed="${prCat==="all"}" data-pc="all">전체 ${PROMPTS.length}</button>`
    + cats.map(c=>`<button aria-pressed="${prCat===c}" data-pc="${esc(c)}">${esc(c)} ${PROMPTS.filter(x=>x.t.cat===c).length}</button>`).join("");
  if($("#prQ").value!==prQ) $("#prQ").value = prQ;
  const list = PROMPTS.filter(x=>(prCat==="all"||x.t.cat===prCat) && (!prQ || n(prQ).split(",").every(w=>!w||n([x.h,x.d,x.p,x.t.title,x.t.cat].join(" ")).includes(w))));
  $("#prCount").textContent = `${list.length}개`;
  $("#prList").innerHTML = list.length ? list.map(x=>`<article class="prc" id="${x.id}">
    <div class="prh"><span class="cat">${esc(x.t.cat)}</span><h2>${esc(x.h)}</h2>${x.d?`<p>${esc(x.d)}</p>`:""}</div>
    <div class="pr${x.p.length>420?" clip":""}"><div class="pt">${esc(x.p)}</div><div class="pra"><button class="copy dark" data-copy="${esc(x.p)}">복사하기</button><button class="copy dark" type="button" data-pbox="${x.id}">내 함에 담기</button>${x.p.length>420?`<button class="copy dark prmore" type="button">전체 보기</button>`:""}</div></div>
    <a class="prsrc" href="${P(x.t.id)}">이 프롬프트가 나온 글: ${esc(x.t.title)}</a></article>`).join("")
    : `<div class="empty">조건에 맞는 프롬프트가 없습니다. 검색어나 주제를 바꿔 보세요.</div>`;
}
function prURL(){ const q=new URLSearchParams(); if(prCat!=="all") q.set("cat",prCat); if(prQ) q.set("q",prQ); try{ history.replaceState(null,"","/prompts/"+(q.toString()?"?"+q:"")); }catch(_){} }
$("#prCats") && $("#prCats").addEventListener("click",e=>{const b=e.target.closest("button[data-pc]"); if(!b) return; prCat=b.dataset.pc; renderPrompts(); prURL(); });
$("#prQ") && $("#prQ").addEventListener("input",e=>{ prQ=e.target.value.trim(); renderPrompts(); prURL(); });
$("#prList") && $("#prList").addEventListener("click",e=>{const b=e.target.closest(".prmore"); if(!b) return; const box=b.closest(".pr"); box.classList.toggle("open"); b.textContent=box.classList.contains("open")?"접기":"전체 보기"; });
// AI 판정 모아보기(/verdict/, 11/2~). 주소 ?v=try|watch|hype
let vFilter = new URLSearchParams(ROUTE==="verdict" ? location.search : "").get("v") || "all";
function renderVerdict(){
  if(!$("#vList")) return;
  const vs = sorted.filter(a=>a.verdict&&VD[a.verdict.v]);
  $("#vFilters").innerHTML = `<button aria-pressed="${vFilter==="all"}" data-vf="all">전체 ${vs.length}</button>` + Object.entries(VD).map(([k,[name]])=>`<button aria-pressed="${vFilter===k}" data-vf="${k}">${name} ${vs.filter(a=>a.verdict.v===k).length}</button>`).join("");
  const list = vs.filter(a=>vFilter==="all"||a.verdict.v===vFilter);
  $("#vList").innerHTML = list.map(a=>`<a class="post vpost" href="${P("a-"+a.id)}">${thumb(imgOf(a))}
    <div class="b"><span class="cat">${esc(a.cat)}${vdTag(a)}</span><h3>${tp(a.title)}</h3><p class="vwhy">${esc(a.verdict.why)}</p><div class="meta"><span>${fmtDate(a.date)}</span></div></div></a>`).join("") || `<div class="empty">아직 이 판정을 받은 기사가 없습니다.</div>`;
}
$("#vFilters") && $("#vFilters").addEventListener("click",e=>{const b=e.target.closest("button[data-vf]"); if(!b) return; vFilter=b.dataset.vf; renderVerdict(); try{ history.replaceState(null,"","/verdict/"+(vFilter!=="all"?"?v="+vFilter:"")); }catch(_){} });

function renderAbout(){
  if(!$("#stats")) return;
  const n=[["기사",ARTICLES.length,"/news/"],["튜토리얼",TUTORIALS.length,"/tutorial/"],["칼럼",COLUMNS.length,"/news/?cat=칼럼"],["데일리 이슈",DAILY.length,"/daily/"],["AI 사전",TERMS.length,"/dict/"]];
  $("#stats").innerHTML = n.map(([k,v,h])=>`<a class="stat" href="${h}"><b>${k}</b><span>${v}</span></a>`).join("");
  const f = ARTICLES.find(a=>a.featured) || sorted[0];
  const last = (f.body.filter(x=>x.p).slice(-1)[0]||{}).p||f.hook;
  $("#two").innerHTML = `<figure><img src="${ABOUT_CARD.src}" alt="스레드·인스타그램 카드 예시"><figcaption>${esc(ABOUT_CARD.caption)}</figcaption></figure>
    <div class="long"><small>매거진 기사 · ${esc(f.title)}</small>${esc(last)}<div class="acts"><a href="${P("a-"+f.id)}">기사 전문 읽기</a><a href="${IG}" target="_blank" rel="noopener">30초 영상은 인스타그램에서</a></div></div>`;
}

// ---- 검색: 위쪽 검색칸·휴대폰 검색 버튼 → /search/ (기사·칼럼·데일리·튜토리얼·AI 사전 한 번에) ----
// (11/3~ 머리말 검색칸은 돋보기 버튼으로 바뀌고, 홈 첫 화면 검색칸(#hq)은 /search/ 로 바로 보낸다)
if($("#searchForm")) $("#searchForm").addEventListener("submit",e=>{e.preventDefault(); const q=$("#q").value.trim();
  if(ROUTE==="search"){ $("#sq").value=q; renderSearch(true); return; } location.href="/search/"+(q?"?q="+encodeURIComponent(q):"");});
const norm = s=>String(s??"").toLowerCase().replace(/\s+/g,"");
const SKINDS = ["기사","칼럼","데일리 이슈","튜토리얼","AI 사전"];
let SIDX = null;
function buildIndex(){
  const it = (k,o,date,title,meta,body)=>({k,o,date,title:norm(title),meta:norm(meta),body:norm(body)});
  return [
    ...ARTICLES.map(a=>it("기사",a,a.date+" "+(a.time||""),a.title,[a.sub,a.hook,a.cat,(a.terms||[]).join(" ")].join(" "),textOf(a.body)+" "+(a.facts||[]).flat().join(" "))),
    ...COLUMNS.map(c=>it("칼럼",c,c.date,c.title,[c.deck,c.sub].join(" "),textOf(c.body))),
    ...DAILY.map(d=>it("데일리 이슈",d,d.date,d.title,[d.summary,(d.three||[]).join(" "),korDate(d.date)].join(" "),dayItems(d).map(a=>a.title).join(" "))),
    ...TUTORIALS.map(t=>it("튜토리얼",t,t.date,t.title,[t.deck,t.cat,t.tools].join(" "),[t.why,t.intro,...t.items.map(x=>[x.h,x.d,x.how,x.prompt].join(" "))].join(" "))),
    ...TERMS.map(x=>it("AI 사전",x,"",x.t+" "+(x.en||""),x.d,"")),
  ];
}
function searchAll(q){
  const words = q.toLowerCase().split(/\s+/).map(norm).filter(Boolean); if(!words.length) return [];
  SIDX = SIDX || buildIndex(); const whole = norm(q); const out = [];
  for(const x of SIDX){
    let score = 0, ok = true;
    for(const w of words){ const s = x.title.includes(w)?10 : x.meta.includes(w)?4 : x.body.includes(w)?1 : 0; if(!s){ ok=false; break; } score += s; }
    if(!ok && words.length>1 && (x.title+x.meta+x.body).includes(whole)){ ok = true; score = 2; }
    if(ok){ if(x.title===whole) score += 20; out.push([score,x]); }
  }
  return out.sort((a,b)=>b[0]-a[0] || b[1].date.localeCompare(a[1].date)).map(p=>p[1]);
}
const termCard = t=>`<a class="sterm" href="${TP(t)}"><b>${esc(t.t)}</b>${t.en?`<small>${esc(t.en)}</small>`:""}<span>${esc(t.d)}</span></a>`;
function groupHTML(k, xs){
  if(k==="AI 사전") return `<div class="sterms">${xs.map(x=>termCard(x.o)).join("")}</div>`;
  if(k==="데일리 이슈") return `<div class="dlist">${xs.map(x=>drowHTML(x.o)).join("")}</div>`;
  const f = k==="기사"?postHTML : k==="칼럼"?colHTML : tutHTML;
  return `<div class="list">${xs.map(x=>f(x.o)).join("")}</div>`;
}
let sTab = "all";
const SUGG = ["챗GPT","클로드","제미나이","오픈AI","앤트로픽","프롬프트","에이전트","개인정보","보안","이미지","회의","무료"];
function renderSearch(push){
  if(!$("#sResults")) return;
  const q = ($("#sq").value||"").trim(); if($("#q")) $("#q").value = q;
  if(push){ try{ history.replaceState(null,"", q ? "/search/?q="+encodeURIComponent(q) : "/search/"); }catch(_){} }
  document.title = (q ? `‘${q}’ 검색 결과 · ` : "검색 · ") + "SHIFT AI";
  if($("#sChips") && !$("#sChips").dataset.done){ $("#sChips").innerHTML = SUGG.filter(s=>searchAll(s).length).map(s=>`<button type="button" data-sq="${esc(s)}">${esc(s)}</button>`).join(""); $("#sChips").dataset.done="1"; }
  const all = q ? searchAll(q) : [];
  const cnt = k=>all.filter(x=>x.k===k).length;
  if(sTab!=="all" && !cnt(sTab)) sTab = "all";
  $("#sTabs").innerHTML = q ? `<button aria-pressed="${sTab==="all"}" data-st="all">전체 ${all.length}</button>` + SKINDS.filter(cnt).map(k=>`<button aria-pressed="${sTab===k}" data-st="${k}">${k} ${cnt(k)}</button>`).join("") : "";
  $("#sSugg").hidden = !!(q && all.length);
  if(!q){ $("#sResults").innerHTML = ""; return; }
  if(!all.length){ $("#sResults").innerHTML = `<div class="empty">‘${esc(q)}’에 맞는 글을 찾지 못했습니다. 다른 말로 찾아보거나 아래 추천 검색어를 눌러 보세요.</div>`; return; }
  if(sTab==="all"){
    $("#sResults").innerHTML = SKINDS.filter(cnt).map(k=>{ const xs = all.filter(x=>x.k===k);
      return `<section class="sgroup"><div class="sec"><h2>${k} <small>${xs.length}</small></h2>${xs.length>4?`<button class="more" type="button" data-st="${k}">${k} ${xs.length}개 모두 보기</button>`:""}</div>${groupHTML(k, xs.slice(0,4))}</section>`; }).join("");
  } else {
    $("#sResults").innerHTML = groupHTML(sTab, all.filter(x=>x.k===sTab).slice(0,80));
  }
}
if($("#sForm")){
  $("#sForm").addEventListener("submit",e=>{ e.preventDefault(); $("#sq").blur(); renderSearch(true); });
  let st; $("#sq").addEventListener("input",()=>{ clearTimeout(st); st=setTimeout(()=>renderSearch(true),150); });
  $("#v-search").addEventListener("click",e=>{
    const t=e.target.closest("[data-st]"); if(t){ sTab=t.dataset.st; renderSearch(); window.scrollTo({top:0}); return; }
    const s=e.target.closest("[data-sq]"); if(s){ $("#sq").value=s.dataset.sq; sTab="all"; renderSearch(true); }
  });
}
// AI 사전 자체 검색칸
const dq0 = ROUTE==="dict" ? (new URLSearchParams(location.search).get("t") || new URLSearchParams(location.search).get("q")) : null;
if($("#dq")){ if(dq0) $("#dq").value = dq0;
  $("#dq").addEventListener("input",()=>{ dictFilter="all"; renderDict(); });
  $("#dForm").addEventListener("submit",e=>{ e.preventDefault(); $("#dq").blur(); }); }

// 본문 시각 자료(10/29~): 막대(bars)·기능 표(matrix)·서비스 카드(cards)·연표(steps). 그림 파일이 아니라 HTML 이라 검색엔진이 글자를 읽고 어두운 화면에도 맞습니다.
//  색은 항목(회사)마다 정해진 순서로 고정(.s1~.s4), 숫자·글자는 글자색. 쓰는 법은 news/VISUAL_GUIDE.md
const vizHead = (t,sub)=>t?`<div class="vz-h"><b>${esc(t)}</b>${sub?`<span>${esc(sub)}</span>`:""}</div>`:"";
const vizNote = n=>n?`<div class="note">${esc(n)}</div>`:"";
function vizBars(v){  // {t, sub, rows:[[그룹, 항목, 값(숫자), 보이는 값]], unit, note}
  const groups=v.groups||[...new Set(v.rows.map(r=>r[0]))], max=Math.max(...v.rows.map(r=>r[2]));  // groups 로 색 순서를 정할 수 있음
  return `<figure class="viz vz-bars">${vizHead(v.t,v.sub)}
    ${groups.length>1?`<div class="vz-legend">${groups.map((g,i)=>`<span><i class="s${i%4+1}"></i>${esc(g)}</span>`).join("")}</div>`:""}
    <div class="vz-rows">${v.rows.map(([g,l,val,txt])=>`<div class="vz-row" title="${esc(g+" "+l+" · "+txt)}"><span class="vz-l">${esc(g)} <b>${esc(l)}</b></span><span class="vz-track"><i class="s${groups.indexOf(g)%4+1}" style="width:${Math.max(2,val/max*100).toFixed(1)}%"></i></span><span class="vz-v">${esc(txt)}</span></div>`).join("")}</div>
    ${vizNote(v.note)}</figure>`;
}
const MX = {o:["<i class=\"mk mk-o\"></i>","무료로 됨"],p:["<i class=\"mk mk-p\"></i>","무료는 조금만"],x:["<i class=\"mk mk-x\"></i>","유료부터"],"-":["–","기능 없음"],"?":["?","공식 자료로 확인 못 함"]};  // 표시는 CSS 로 그림(글꼴마다 기호 크기가 달라서)
function vizMatrix(v){  // {t, sub, head:[...], rows:[[기능, o|p|x|-|?, ...]], note}
  const used=[...new Set(v.rows.flatMap(r=>r.slice(1)))].filter(k=>MX[k]);
  return `<figure class="viz vz-matrix">${vizHead(v.t,v.sub)}<div class="tbl"><table class="dtable mx"><thead><tr>${v.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${v.rows.map(r=>`<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map(k=>`<td class="mx-${k==="-"?"n":k==="?"?"q":k}"><span aria-hidden="true">${MX[k]?MX[k][0]:esc(k)}</span><span class="sr">${MX[k]?MX[k][1]:esc(k)}</span></td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="vz-key">${used.map(k=>`<span><b class="mx-${k==="-"?"n":k==="?"?"q":k}">${MX[k][0]}</b>${MX[k][1]}</span>`).join("")}</div>${vizNote(v.note)}</figure>`;
}
function vizCards(v){  // {t, sub, items:[{n:이름, d:설명, b:요금제 표시, g:묶음}], note}
  return `<figure class="viz vz-cards">${vizHead(v.t,v.sub)}<div class="vz-grid">${v.items.map(it=>`<div class="vz-card">${it.g?`<span class="vz-g">${esc(it.g)}</span>`:""}<b>${esc(it.n)}</b><p>${esc(it.d)}</p>${it.b?`<span class="vz-b">${esc(it.b)}</span>`:""}</div>`).join("")}</div>${vizNote(v.note)}</figure>`;
}
function vizSteps(v){  // {t, sub, items:[[날짜, 내용]], note}
  return `<figure class="viz vz-steps">${vizHead(v.t,v.sub)}<ol>${v.items.map(([d,x])=>`<li><time>${esc(d)}</time><span>${esc(x)}</span></li>`).join("")}</ol>${vizNote(v.note)}</figure>`;
}
function bodyHTML(body){
  return body.map(x=>{
    if(x.lead) return `<p class="lead">${esc(x.lead)}</p>`;
    if(x.p) return `<p>${esc(x.p)}</p>`;
    if(x.h) return `<h3>${esc(x.h)}</h3>`;
    if(x.ul) return `<ul>${x.ul.map(([h,d])=>`<li><b>${esc(h)}.</b> ${esc(d)}</li>`).join("")}</ul>`;
    if(x.q) return `<div class="q">${esc(x.q)}<br><button class="copy" data-copy="${esc(x.q)}">복사하기</button></div>`;
    if(x.bars) return vizBars(x.bars);
    if(x.matrix) return vizMatrix(x.matrix);
    if(x.cards) return vizCards(x.cards);
    if(x.steps) return vizSteps(x.steps);
    if(x.link) return `<a class="linkbox" href="${esc(x.link.u)}"><span class="lk">${esc(x.link.k||"함께 보기")}</span><b>${esc(x.link.t)}</b>${x.link.d?`<span class="ld">${esc(x.link.d)}</span>`:""}</a>`;
    if(x.pred) return `<div class="pred"><div class="ph2">편집장의 전망</div><ol>${x.pred.map(p=>`<li>${esc(p)}</li>`).join("")}</ol></div>`;
    if(x.table) return `<div class="tbl"><table class="dtable"><thead><tr>${x.table.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${x.table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${x.table.note?`<div class="note">${esc(x.table.note)}</div>`:""}`;
    if(x.img) return fig(x.img,"inline-fig");
    return "";
  }).join("");
}
const factsHTML = f=>f&&f.length?`<div class="box"><b>한눈에 보기</b><table class="facts"><tbody>${f.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>`:"";
const srcHTML = s=>s&&s.length?`<div class="src"><b>원문</b>${s.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(n)} · ${esc(u)}</a>`).join("")}</div>`:"";
const linkCopy = (h,label)=>`<a href="${P(h)}" data-copy="${SITE}${P(h)}">${label}</a>`;

// 본문 용어 풀이(11/5~): 기사 terms 에 든 AI 사전 용어를 본문에서 처음 나올 때 한 번만 점선 밑줄로 표시하고,
// 누르면 뜻과 AI 사전 링크가 뜬다. 링크·굵은 글씨·코드·'한눈에' 상자 안은 건드리지 않는다. 한 글자 용어는 빼고, 최대 5개.
function markTerms(root, tl){
  if(!root||!tl||!tl.length) return;
  const ts = tl.filter(t=>t.t.length>=2).sort((a,b)=>b.t.length-a.t.length); let n=0;
  for(const t of ts){
    if(n>=5) break;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode:x=>x.parentElement.closest("a,b,strong,code,pre,.tm,.glance,figure,table,h2,h3")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    let x; while((x=w.nextNode())){ const k=x.data.indexOf(t.t); if(k<0) continue;
      const r=x.splitText(k); r.splitText(t.t.length);
      const sp=document.createElement("span"); sp.className="tm"; sp.tabIndex=0; sp.setAttribute("role","button"); sp.setAttribute("aria-expanded","false"); sp.dataset.t=t.t; sp.textContent=t.t;
      r.replaceWith(sp); n++; break; }
  }
}
let tmPop=null;
function tmClose(){ if(tmPop){ tmPop.remove(); tmPop=null; document.querySelectorAll('.tm[aria-expanded="true"]').forEach(e=>e.setAttribute("aria-expanded","false")); } }
function tmOpen(el){
  const t=termByName[el.dataset.t]; if(!t) return; const same=el.getAttribute("aria-expanded")==="true"; tmClose(); if(same) return;
  tmPop=document.createElement("div"); tmPop.className="tmpop"; tmPop.setAttribute("role","note");
  tmPop.innerHTML=`<b>${esc(t.t)}</b>${t.en&&t.en!==t.t?`<small>${esc(t.en)}</small>`:""}<p>${esc(t.d)}</p><a href="${TP(t)}" data-ev="term:${esc(t.s)}">AI 사전에서 자세히 보기 →</a>`;
  document.body.appendChild(tmPop); el.setAttribute("aria-expanded","true");
  const r=el.getBoundingClientRect(), w=Math.min(320, innerWidth-32), left=Math.max(16, Math.min(r.left+scrollX, scrollX+innerWidth-16-w));
  tmPop.style.width=w+"px"; tmPop.style.left=left+"px"; tmPop.style.top=(r.bottom+scrollY+8)+"px";
  track("term-tip:"+t.s, t.t);
}
document.addEventListener("click",e=>{ const el=e.target.closest(".tm"); if(el){ e.preventDefault(); tmOpen(el); return; } if(tmPop&&!e.target.closest(".tmpop")) tmClose(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") return tmClose(); const el=e.target.closest&&e.target.closest(".tm"); if(el&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); tmOpen(el); } });
addEventListener("resize",tmClose);
function renderArticle(a){
  const i = sorted.findIndex(x=>x.id===a.id); const nx = sorted[(i+1)%sorted.length];
  const tl = (a.terms||[]).map(t=>termByName[t]).filter(Boolean);
  const ul = a.body.find(x=>x.ul); const rest = a.body.filter(x=>!x.ul);
  const day = DAILY.find(d=>d.items.includes(a.id));
  // 휴대폰(11/4~): 첫 문단 바로 뒤 '한눈에'(판정+오늘 바로 해 보세요+세 줄 요약, 11/5~ 한 상자), 핵심 정보·원문은 접기
  const lp = rest[0]&&rest[0].lead ? 1 : 0;
  const vd = a.verdict&&VD[a.verdict.v];
  const glance = (vd||ul||a.try) ? `<div class="glance m-only">${vd?`<a class="gv" href="/verdict/"><i class="${VD[a.verdict.v][1]}">SHIFT 판정 · ${VD[a.verdict.v][0]}</i><span>${esc(a.verdict.why)}</span></a>`:""}${a.try?`<div class="gt"><b>오늘 바로 해 보세요</b><span>${esc(a.try)}</span></div>`:""}${ul?`<ul>${ul.ul.map(([h,d])=>`<li><b>${esc(h)}.</b> ${esc(d)}</li>`).join("")}</ul>`:""}</div>` : "";
  const mfold = (a.facts&&a.facts.length)||(a.sources&&a.sources.length) ? `<div class="mfold m-only">${a.facts&&a.facts.length?`<details><summary>핵심 정보 ${a.facts.length}개</summary><table class="facts"><tbody>${a.facts.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table></details>`:""}${a.sources&&a.sources.length?`<details><summary>원문 ${a.sources.length}곳</summary><div class="srcl">${a.sources.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join("")}</div></details>`:""}</div>` : "";
  $("#v-article").innerHTML = `<article class="article narrow art-news">
    <a class="back" href="/news/">← AI 뉴스</a>
    <span class="cat">${esc(a.cat)}</span>
    <h1>${tp(a.title)}</h1><p class="deck">${esc(a.sub)}</p>
    ${a.who?`<p class="who"><b>이런 분께 추천합니다</b><span>${esc(a.who)}</span></p>`:""}
    ${vd||a.try?`<div class="vcard">${vd?`<a class="vdbox ${vd[1]}" href="/verdict/"><b>SHIFT 판정 · ${vd[0]}</b><span>${esc(a.verdict.why)}</span></a>`:""}${a.try?`<div class="trynow"><b>오늘 바로 해 보세요</b><span>${esc(a.try)}</span></div>`:""}</div>`:""}
    <div class="meta"><span>SHIFT 편집부</span><span class="dot"></span><span>${fmtDate(a.date)} ${a.time}</span>${updMeta(a)}<span class="dot"></span><span>${readMin(a.body)}분 읽기</span></div>
    ${fig(imgOf(a),"lead-fig")}
    ${factsHTML(a.facts)}
    ${ul?`<div class="box keyp"><b>세 줄 요약</b><ul>${ul.ul.map(([h,d])=>`<li><b>${esc(h)}.</b> ${esc(d)}</li>`).join("")}</ul></div>`:""}
    <div class="body">${bodyHTML(rest.slice(0,lp))}${glance}${bodyHTML(rest.slice(lp))}</div>
    <div class="ask"><small>생각해 볼 질문</small>${esc(a.ask)}</div>
    ${nxHTML(a)}
    ${srcHTML(a.sources)}
    ${mfold}
    ${updHTML(a)}
    ${tl.length?`<div class="chips">${tl.map(t=>`<a href="${TP(t)}" title="${esc(t.d)}">${esc(t.t)}</a>`).join("")}</div>`:""}
    ${a.ask?`<div class="ask m-only"><small>생각해 볼 질문</small>${esc(a.ask)}</div>`:""}
    <div class="links">${day?`<a href="${P("d-"+day.date)}">${fmtDate(day.date)} 데일리 이슈</a>`:""}<a href="${a.reel||IG}" target="_blank" rel="noopener">30초 영상 보기</a><a href="${a.thread||TH}" target="_blank" rel="noopener">스레드에서 의견 남기기</a>${linkCopy("a-"+a.id,"링크 복사")}${fixLink(a.title, P("a-"+a.id))}</div>
    ${FOLLOWBOX}
    <div class="next"><div class="lbl">다음 기사</div><div class="list">${postHTML(nx)}</div></div>
  </article>`;
  markTerms($("#v-article .body"), tl);
}
function renderColumn(c){
  const i = COLUMNS.findIndex(x=>x.id===c.id); const nx = COLUMNS[(i+1)%COLUMNS.length]; const rel = c.rel && byId[c.rel];
  $("#v-article").innerHTML = `<article class="article narrow">
    <a class="back" href="/news/?cat=칼럼">← AI 뉴스 · 칼럼</a>
    <span class="cat">칼럼</span>
    <h1>${tp(c.title)}</h1><p class="deck">${esc(c.deck)}</p>
    <div class="meta"><span>SHIFT 편집장 기획 · AI 에디터 작성</span><span class="dot"></span><span>${fmtDate(c.date)}</span>${updMeta(c)}<span class="dot"></span><span>${readMin(c.body)}분 읽기</span></div>
    ${fig(colImg(c),"lead-fig")}
    <div class="body">${bodyHTML(c.body)}</div>
    ${nxHTML(c)}
    ${updHTML(c)}
    ${rel?`<div class="next"><div class="lbl">바탕이 된 기사</div><div class="list">${postHTML(rel)}</div></div>`:""}
    <div class="links"><a href="${TH}" target="_blank" rel="noopener">스레드에서 반론 남기기</a>${linkCopy(c.id,"링크 복사")}${fixLink(c.title, P(c.id))}</div>
    ${FOLLOWBOX}
    <div class="next"><div class="lbl">다음 칼럼</div><div class="list">${colHTML(nx)}</div></div>
  </article>`;
}
function renderTutorial(t){
  const i = TUTORIALS.findIndex(x=>x.id===t.id); const nx = TUTORIALS[(i+1)%TUTORIALS.length]; const rel = t.rel && byId[t.rel];
  const steps = t.kind==="steps";
  const code = c=>`<div class="code"><div class="cl"><span>${esc(c.label||"터미널")}</span><button class="copy" data-copy="${esc(c.cmd)}">복사</button></div><pre>${esc(c.cmd)}</pre>${c.ok?`<p class="ok"><b>확인</b>${esc(c.ok)}</p>`:""}</div>`;
  const items = t.items.map((it,k)=>`<section class="ti" id="s${k+1}"><div class="tb">
        <h3><span class="sn">${tutLabel(t,k)}</span>${esc(it.h)}${it.time?`<small>${esc(it.time)}</small>`:""}</h3>
        <p class="d">${esc(it.d)}</p>
        ${it.img?`<figure class="tfig"><img src="${it.img.src}" alt="${esc(it.img.alt||it.h)}" loading="lazy">${it.img.cap?`<figcaption>${esc(it.img.cap)}</figcaption>`:""}</figure>`:""}
        ${it.how?`<div class="how">${steps?"":"<b>이렇게 쓰세요</b>"}${esc(it.how)}</div>`:""}
        ${(it.more||[]).map(p=>`<p class="tp">${esc(p)}</p>`).join("")}
        ${(it.term||[]).map(([w,x])=>`<div class="term2"><b>용어 · ${esc(w)}</b>${esc(x)}</div>`).join("")}
        ${(it.code||[]).map(code).join("")}
        ${it.bad||it.good?`<div class="vs">${it.bad?`<div class="no"><b>이렇게 말고</b>${esc(it.bad.replace(/^❌\s*/,""))}</div>`:""}${it.good?`<div class="yes"><b>이렇게</b>${esc(it.good.replace(/^✅\s*/,""))}</div>`:""}</div>`:""}
        ${it.table?`<div class="tbl"><table class="dtable"><thead><tr>${it.table.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${it.table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:""}
        ${it.prompt?`<div class="pr"><b>복사해서 쓰는 프롬프트</b><div class="pt">${esc(it.prompt)}</div><button class="copy dark" data-copy="${esc(it.prompt)}">복사하기</button></div>`:""}
        ${it.example?`<div class="ex"><div><b>넣는 것 (예시)</b><pre>${esc(it.example.in)}</pre></div><div><b>나오는 것 (예시)</b><pre>${esc(it.example.out)}</pre></div></div>`:""}
      </div></section>`).join("");
  const toc = `<div class="tinside"><div class="th"><b>이 글에 담긴 것</b><span>${tutUnit(t)} · 따라 하는 데 ${esc(t.time)}</span></div>
      <ol>${t.items.map((it,k)=>`<li><a href="#s${k+1}"><span>${tutLabel(t,k)}</span>${esc(it.h)}</a></li>`).join("")}</ol></div>`;
  const quick = t.quick&&t.quick.lines&&t.quick.lines.length ? `<div class="quick"><b>바쁘면 이것만</b><ol>${t.quick.lines.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>${(t.quick.links||[]).length?`<div class="ql">${t.quick.links.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join("")}</div>`:""}</div>` : "";
  const master = t.master&&t.master.prompt ? `<details class="master"><summary><b>통째로 맡기는 프롬프트</b><span>${esc(t.master.tool||"AI")}에 붙여 넣으면 이 글의 단계를 대신 진행합니다</span></summary><div class="pr"><div class="pt">${esc(t.master.prompt)}</div><button class="copy dark" data-copy="${esc(t.master.prompt)}">복사하기</button></div></details>` : "";
  const limits = t.limits&&t.limits.length ? `<div class="limits"><b>솔직히 한계</b><ul>${t.limits.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
  const srcs = t.sources&&t.sources.length ? `<div class="src"><b>공식 자료</b>${t.sources.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(n)} · ${esc(u)}</a>`).join("")}</div>` : "";
  $("#v-article").innerHTML = `<article class="article narrow tut-page">
    <a class="back" href="/tutorial/">← 튜토리얼</a>
    <span class="cat">튜토리얼 · ${esc(t.cat||"")} · ${esc(t.level)}</span>
    <h1>${tp(t.title)}</h1><p class="deck">${esc(t.deck)}</p>
    <div class="meta"><span>SHIFT 편집부</span><span class="dot"></span><span>${fmtDate(t.date)}</span>${updMeta(t)}<span class="dot"></span><span>읽는 데 ${tutRead(t)}분</span><span class="dot"></span><span>${tutUnit(t)}</span></div>
    ${(t.tool||[]).length?`<div class="ttags">${t.tool.map(x=>`<a href="/tutorial/?tool=${encodeURIComponent(x)}">${esc(x)}</a>`).join("")}</div>`:""}
    ${t.pdf?`<div class="pdfbox"><div class="pages">${t.pdf.pages.map((p,k)=>`<img src="${p}" alt="정리본 ${k+1}쪽" loading="lazy">`).join("")}</div>
      <div class="pdfmeta"><div><b>PDF 정리본 · ${t.pdf.count}쪽</b>이 글을 그대로 담은 PDF입니다. 저장해 두고 필요할 때 꺼내 보세요.</div><a class="btn" href="${t.pdf.url}" target="_blank" rel="noopener">PDF 열기</a></div></div>`:fig({src:t.cover||t.thumb, credit:t.coverCredit||""},"lead-fig")}
    ${t.app?`<div class="appbox"><div><b>${esc(t.app.label)}</b>${esc(t.app.note)}</div><a class="btn" href="${t.app.url}" target="_blank" rel="noopener">${esc(t.app.btn)}</a></div>`:""}
    ${toc}
    ${quick}
    ${master}
    <div class="prep"><div><b>필요한 것</b>${esc(t.tools)}</div><div><b>걸리는 시간</b>${esc(t.time)}</div><div><b>왜 필요한가요</b>${esc(t.why)}</div></div>
    ${t.intro?`<div class="intro">${esc(t.intro)}</div>`:""}
    <div class="items">${items}</div>
    ${t.bonus?`<div class="bonus"><b>보너스 · ${esc(t.bonus.title)}</b><ol>${t.bonus.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>`:""}
    ${limits}
    ${srcs}
    ${updHTML(t)}
    ${rel?`<div class="next"><div class="lbl">관련 기사</div><div class="list">${postHTML(rel)}</div></div>`:""}
    <div class="links">${t.app?`<a href="${t.app.url}" target="_blank" rel="noopener">${esc(t.app.btn)}</a>`:""}${t.pdf?`<a href="${t.pdf.url}" target="_blank" rel="noopener">PDF 정리본 열기</a>`:""}<a href="${TH}" target="_blank" rel="noopener">스레드에서 질문하기</a>${linkCopy(t.id,"링크 복사")}${fixLink(t.title, P(t.id))}</div>
    ${FOLLOWBOX}
    <div class="next"><div class="lbl">다음 튜토리얼</div><div class="list">${tutHTML(nx)}</div></div>
  </article>`;
}
function renderDaily(d){
  const its=dayItems(d); const lead=dayPhoto(d);
  const i=dailySorted.findIndex(x=>x.date===d.date); const prev=dailySorted[i+1], next=dailySorted[i-1];
  const nums=its.map(a=>{const r=(a.facts||[]).find(([k])=>/숫자|금액|가격|규모|성능|영향/.test(k)); return r?[a,r[1]]:null;}).filter(Boolean);
  $("#v-article").innerHTML = `<article class="article narrow daily-page">
    <a class="back" href="/daily/">← 데일리 이슈</a>
    <span class="dk">AI 데일리 · ${korDate(d.date)}</span>
    <h1>${tp(d.title)}</h1>${d.summary?`<p class="deck">${esc(d.summary)}</p>`:""}
    <div class="meta"><span>SHIFT 편집부</span><span class="dot"></span><span>소식 ${its.length}건</span></div>
    ${lead?fig(imgOf(lead),"lead-fig"):""}
    ${d.three&&d.three.length?`<div class="box three"><b>오늘의 3줄</b><ol>${d.three.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>`:""}
    <div class="items">${its.map((a,k)=>`<a class="it" href="${P("a-"+a.id)}"><span class="n">${String(k+1).padStart(2,"0")}</span><div><span class="cat">${esc(a.cat)}</span><h3>${tp(a.title)}</h3><p>${esc(a.hook)}</p></div><figure>${thumb(imgOf(a))}</figure></a>`).join("")}</div>
    ${nums.length?`<div class="sec" style="margin-top:40px"><h2>숫자로 보는 오늘</h2></div><div class="tbl"><table class="dtable"><thead><tr><th>소식</th><th>숫자</th></tr></thead><tbody>${nums.map(([a,v])=>`<tr><td>${tp(a.title)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>`:""}
    <div class="links">${prev?`<a href="${P("d-"+prev.date)}">← ${fmtDate(prev.date)}</a>`:""}${next?`<a href="${P("d-"+next.date)}">${fmtDate(next.date)} →</a>`:""}${linkCopy("d-"+d.date,"링크 복사")}</div>
    ${FOLLOWBOX}
  </article>`;
}

// AI 사전 용어 한 개 = 한 페이지(/dict/<s>/): 뜻 + 관련 기사·튜토리얼 + 함께 보면 좋은 용어
const termCo = t=>{ const mine=new Set(t.arts); const sc=TERMS.filter(x=>x!==t).map(x=>[x, x.arts.filter(i=>mine.has(i)).length*3 + (x.g===t.g?1:0)]);
  return sc.filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1] || a[0].t.localeCompare(b[0].t,"ko")).slice(0,8).map(([x])=>x); };
function renderTerm(t){
  const arts=t.arts.map(i=>byId[i]).filter(Boolean), tuts=t.tuts.map(i=>tutById[i]).filter(Boolean), co=termCo(t);
  const brand = t.g==="제품·회사";
  $("#v-article").innerHTML = `<article class="article narrow term-page">
    <a class="back" href="/dict/">← AI 사전</a>
    <span class="cat">AI 사전 · ${esc(t.g)}</span>
    <h1>${esc(t.t)}${t.en&&t.en!==t.t?`<small>${esc(t.en)}</small>`:""}</h1>
    <div class="tdef"><b>${brand?"한 줄 소개":"뜻"}</b><p>${esc(t.d)}</p>${!brand&&t.en&&/[가-힣]/.test(t.t)&&!t.t.toLowerCase().includes(t.en.toLowerCase())?`<p class="ten"><span>영어 표기</span><i lang="en">${esc(t.en)}</i></p>`:""}</div>
    ${t.use&&t.use.length?`<nav class="nxbox usebox" aria-label="바로 써 보기"><b>‘${esc(t.t)}’ 바로 써 보기</b>${t.use.map(([k,h,n])=>`<a href="${esc(h)}" data-ev="dict-use:${esc(h)}"><span>${esc(k)}</span>${esc(n)}</a>`).join("")}</nav>`:""}
    ${arts.length?`<div class="sec"><h2>${esc(t.t)} ${brand?"최신 소식":"관련 기사"} <small>${arts.length}건</small></h2></div><div class="list">${arts.map(postHTML).join("")}</div>`:""}
    ${tuts.length?`<div class="sec"><h2>${esc(t.t)} 튜토리얼</h2></div><div class="list">${tuts.map(tutHTML).join("")}</div>`:""}
    ${co.length?`<div class="sec"><h2>함께 보면 좋은 용어</h2></div><dl class="terms">${co.map(x=>`<div class="term"><dt><a href="${TP(x)}">${esc(x.t)}</a><small>${esc(x.en)}</small></dt><dd>${esc(x.d)}</dd></div>`).join("")}</dl>`:""}
    ${(typeof VS!=="undefined"?VS:[]).some(v=>v.k.includes(t.s))?`<div class="sec"><h2>요금·무료 범위 비교</h2></div><div class="vslinks">${VS.filter(v=>v.k.includes(t.s)).map(v=>`<a href="/vs/${v.id}/">${esc(v.t)}</a>`).join("")}</div>`:""}
    <div class="links"><a href="/dict/">AI 사전 전체 ${TERMS.length}개</a><a href="/search/?q=${encodeURIComponent(t.t)}">‘${esc(t.t)}’ 검색</a>${linkCopy("w-"+t.s,"링크 복사")}</div>
    ${FOLLOWBOX}
  </article>`;
}

// 방문자 행동 세기(GoatCounter 이벤트). 이름·주소·프로그램 id 같은 정해진 값만 보내고, 사람이 입력한 글은 절대 보내지 않는다.
// 통계 스크립트가 없으면(개발 중·로봇·켜기 전) 아무 일도 안 한다.
const track = (p,t)=>{ try{ const g=window.goatcounter; if(g&&g.count) g.count({path:String(p).slice(0,200), title:t||String(p).slice(0,200), event:true}); }catch(_){} };
window.track = track;
document.addEventListener("click",e=>{
  const el=e.target.closest&&e.target.closest("a,button"); if(!el) return;
  if(el.dataset.ev) return track(el.dataset.ev);
  if(el.tagName!=="A") return;
  const h=el.getAttribute("href")||"";
  if(h.startsWith("mailto:")) return track("fix-report:"+location.pathname, "틀린 곳 알려 주기");
  if(/^https?:/i.test(h) && el.hostname && el.hostname!==location.hostname) track("out:"+el.hostname.replace(/^www\./,""), "나가는 링크");
},true);
// 머리말 '팔로우' 메뉴(11/9~, <details class="fol">): 밖을 누르거나 Esc·링크를 누르면 닫고, 열 때 첫 항목으로 초점을 옮긴다. 화살표 위·아래로 항목 사이를 움직인다
(()=>{ const d=document.getElementById("fol"); if(!d) return; const sm=d.querySelector("summary"), items=()=>[...d.querySelectorAll(".folm a")];
  sm.setAttribute("aria-haspopup","true"); sm.setAttribute("aria-expanded","false");
  d.addEventListener("toggle",()=>{ sm.setAttribute("aria-expanded", d.open?"true":"false"); if(d.open){ track("follow:open","팔로우 메뉴"); if(d._kb){ const a=items()[0]; if(a) a.focus(); } } d._kb=false; });
  sm.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "||e.key==="ArrowDown"){ d._kb=true; if(e.key==="ArrowDown"&&!d.open){ e.preventDefault(); d.open=true; } } });
  document.addEventListener("click",e=>{ if(d.open && !d.contains(e.target)) d.open=false; });
  d.addEventListener("click",e=>{ if(e.target.closest(".folm a")) setTimeout(()=>{ d.open=false; },0); });
  d.addEventListener("keydown",e=>{
    if(e.key==="Escape" && d.open){ d.open=false; sm.focus(); return; }
    const xs=items(), i=xs.indexOf(document.activeElement); if(i<0) return;
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); xs[(i+(e.key==="ArrowDown"?1:-1)+xs.length)%xs.length].focus(); }
  });
  d.addEventListener("focusout",e=>{ if(d.open && e.relatedTarget && !d.contains(e.relatedTarget)) d.open=false; });
})();
// 같은 페이지 안 링크(튜토리얼 목차 #s1·바닥글 '맨 위로' #top 등, 11/7~): <base href="/"> 때문에 첫 화면으로 나가지 않게 이 페이지 안에서 움직인다
document.addEventListener("click",e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
  const a=e.target.closest&&e.target.closest('a[href^="#"]'); if(!a||a.dataset.nav||a.hasAttribute("data-copy")) return;
  const h=a.getAttribute("href"), id=decodeURIComponent(h.slice(1)); if(!id) return;
  const el = id==="top" ? document.body : document.getElementById(id); if(!el) return;
  e.preventDefault(); const bh = RM ? "auto" : "smooth";
  if(id==="top"){ scrollTo({top:0,behavior:bh}); setTimeout(()=>{ if(scrollY>12) scrollTo(0,0); }, bh==="smooth"?900:200); } else { el.scrollIntoView({behavior:bh,block:"start"}); if(!el.hasAttribute("tabindex")) el.setAttribute("tabindex","-1"); el.focus({preventScroll:true});
    setTimeout(()=>{ const want=parseFloat(getComputedStyle(el).scrollMarginTop)||0, top=el.getBoundingClientRect().top; if(Math.abs(top-want)>12) el.scrollIntoView({block:"start"}); }, bh==="smooth"?900:200); }
  try{ history.replaceState(history.state,"",location.pathname+location.search+(id==="top"?"":h)); }catch(_){}
});
// 무료 도구: 페이지를 연 뒤 처음으로 무언가를 넣거나 누르면 '사용'으로 한 번 센다
let toolUsed=false;
const firstUse=e=>{ if(toolUsed) return; const t=e.target; if(!t||!t.closest) return;
  const m=t.closest('main[id^="v-tool"]'); if(!m||t.closest(".tfaq,.back,a")) return;
  if(e.type==="click" && !t.closest("button,label,input,select,textarea")) return;
  toolUsed=true; track("tool-use:"+location.pathname, "무료 도구 사용"); };
["input","change","click","drop"].forEach(ty=>document.addEventListener(ty,firstUse,true));
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-copy]"); if(!b) return; e.preventDefault();
  const pc=b.closest(".prc"); track(b.tagName==="A"?"copy-link:"+location.pathname : (ROUTE.startsWith("tool-")?"tool-done:":"copy-prompt:")+location.pathname+(pc?"#"+pc.id:""), b.tagName==="A"?"링크 복사":"복사");
  const txt=b.dataset.copy; const done=()=>toast("복사했습니다");
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(fallback);}else fallback();
  function fallback(){const ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");done();}catch(_){toast("길게 눌러 복사해 주세요");}ta.remove();}
});
// 내 프롬프트함(11/5~): 어느 페이지에서든 담을 수 있게. 저장은 이 브라우저 localStorage 에만(/tools/prompt-box/ 와 같은 열쇠·모양)
const PBOX_KEY = "shift-promptbox-v1";
function pboxAdd(t, p, tag, src){
  try{ const d = JSON.parse(localStorage.getItem(PBOX_KEY)||"null") || {v:1, items:[], vals:{}}; if(!Array.isArray(d.items)) d.items = [];
    if(d.items.some(x=>x.p===p)){ toast("이미 내 프롬프트함에 있습니다"); return false; }
    d.items.push({id: Date.now().toString(36)+Math.random().toString(36).slice(2,7), t: String(t||p.slice(0,40)).slice(0,120), p, tag: tag||"", star:false, n:0, at:Date.now(), used:0, src: src||""});
    localStorage.setItem(PBOX_KEY, JSON.stringify(d)); track("pbox-add:"+location.pathname, "내 프롬프트함에 담기"); toast("내 프롬프트함에 담았습니다 · 무료 도구 → 내 프롬프트함"); return true;
  }catch(_){ toast("이 브라우저에서는 저장할 수 없습니다"); return false; }
}
window.SHIFT_PBOX_ADD = pboxAdd;
document.addEventListener("click",e=>{ const b=e.target.closest("[data-pbox]"); if(!b) return; e.preventDefault();
  const x = PROMPTS.find(q=>q.id===b.dataset.pbox); if(x) pboxAdd(x.h, x.p, x.t.cat, "/prompts/#"+x.id); });
let toastT; function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),1600);}

// 주간 메일 구독(11/11~). 구독 칸(.subf)은 build.py 가 구독 서버 주소(data-api)를 넣어 모든 페이지 맨 아래에 붙인다. 팝업은 그 양식을 복사해 쓴다.
// 신청 → 서버가 확인 메일을 보냄 → 메일 링크(/subscribe/?t=…)에서 '구독 확정하기'를 눌러야 명단에 들어간다(메일 보안 검사기가 링크만 열어서는 확정되지 않게 버튼으로).
// 입력한 주소는 구독 서버로만 보내고 통계(track)에는 절대 넣지 않는다.
const SUB_T0 = Date.now();
const SUB_ERR = {bad_email:"이메일 주소를 다시 확인해 주세요.", too_many:"신청이 많습니다. 1분 뒤 다시 시도해 주세요.", busy:"지금 확인 메일을 보내기 어렵습니다. 잠시 뒤(늦으면 내일) 다시 시도해 주세요.",
  not_open:"아직 구독 신청을 받기 전입니다.", expired:"확인 링크가 만료됐습니다. 아래에서 다시 신청해 주세요.", bad:"확인 링크가 올바르지 않습니다. 메일의 링크를 그대로 열었는지 확인해 주세요."};
const subPost = (api,path,body)=>fetch(api+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json().catch(()=>({ok:false}))).catch(()=>({ok:false,error:"net"}));
document.addEventListener("submit",async e=>{
  const f=e.target.closest&&e.target.closest("form.subf"); if(!f) return; e.preventDefault();
  const msg=f.querySelector(".submsg"), btn=f.querySelector("button[type=submit]"), em=f.elements.email.value.trim();
  const say=(m,bad)=>{ msg.textContent=m; msg.classList.toggle("bad",!!bad); };
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { f.elements.email.focus(); return say(SUB_ERR.bad_email,1); }
  if(!f.elements.agree.checked) { f.elements.agree.focus(); return say("이메일 주소 수집·이용에 동의해야 구독할 수 있습니다.",1); }
  if(!f.elements.agree_abroad.checked) { f.elements.agree_abroad.focus(); return say("메일은 미국 Resend로 보내기 때문에, 국외 이전에 동의해야 구독할 수 있습니다.",1); }
  if(!f.dataset.api) return say("구독 신청을 준비하고 있습니다. 잠시 뒤 다시 와 주세요.",1);
  btn.disabled=true; say("보내는 중입니다…");
  const j=await subPost(f.dataset.api,"/subscribe",{email:em, hp:f.elements.website.value, ms:Date.now()-SUB_T0});
  btn.disabled=false;
  if(j.ok){ say(`${em} 주소로 확인 메일을 보냈습니다. 메일 안의 '구독 확정하기'를 눌러야 구독이 끝납니다. 메일이 안 보이면 스팸함이나 프로모션함을 확인해 주세요.`); f.elements.email.value=""; try{ localStorage.setItem("shift-sub","1"); }catch(_){} track(f.closest(".subpop")?"subscribe:request-pop":"subscribe:request","구독 신청"); }
  else say(SUB_ERR[j.error]||"연결이 원활하지 않습니다. 잠시 뒤 다시 시도해 주세요.",1);
});
// 구독 팝업: 페이지를 열 때마다 한 번(12초가 지나거나 글을 절반쯤 읽었을 때) 오른쪽 아래에 작게 띄운다. 강요하지 않게 배경을 막지 않고 닫기·Esc 로 바로 닫힌다.
// 구독을 신청한 브라우저, 구독 페이지, 맨 아래 구독 칸이 이미 보일 때, 로봇(미리 그리기 포함)에는 띄우지 않는다. 주소에 ?subpop 을 붙이면 바로 띄운다(시험용).
(function(){
  const src=document.querySelector(".wrap>.subbox .subf[data-api]"); if(!src) return;
  const force=new URLSearchParams(location.search).has("subpop");
  if(!force && (navigator.webdriver || ROUTE==="subscribe")) return;
  try{ if(!force && localStorage.getItem("shift-sub")) return; }catch(_){}
  let done=false, timer;
  const inView=el=>{ const r=el.getBoundingClientRect(); return r.top<innerHeight && r.bottom>0; };
  const onScroll=()=>{ const h=document.documentElement.scrollHeight-innerHeight; if(h>0 && scrollY>h*0.5) show(); };
  function stop(){ clearTimeout(timer); removeEventListener("scroll",onScroll); }
  function show(){
    if(done) return; if(!force && inView(src.closest(".subbox"))) return;
    const a=document.activeElement; if(!force && a && a.matches && a.matches("input,textarea,select")) return;  // 무언가 입력하는 중이면 방해하지 않음
    done=true; stop();
    const p=document.createElement("aside"); p.className="subpop"; p.setAttribute("role","dialog"); p.setAttribute("aria-label","주간 메일 구독");
    p.innerHTML='<button class="subpop-x" type="button" aria-label="닫기">×</button><span class="subpop-k">주간 메일 · 매주 월요일 아침 7시</span><b class="subpop-t">이번 주 AI 핫 이슈를 메일로 받아 보세요</b><p class="subpop-d">한 주 소식 중 꼭 볼 것만 골라 보냅니다. 무료이고 언제든 해지할 수 있습니다.</p>';
    const f=src.cloneNode(true); f.querySelector(".submsg").textContent=""; f.querySelectorAll("details").forEach(d=>d.open=false); p.appendChild(f);
    const close=how=>{ p.remove(); removeEventListener("keydown",esc); track("subpop:close-"+how,"구독 팝업 닫기"); };
    const esc=e=>{ if(e.key==="Escape") close("esc"); };
    p.querySelector(".subpop-x").addEventListener("click",()=>close("x")); addEventListener("keydown",esc);
    document.body.appendChild(p); track("subpop:show","구독 팝업");
  }
  timer=setTimeout(show, force?300:12000); addEventListener("scroll",onScroll,{passive:true});
})();
(function(){
  if(ROUTE!=="subscribe" || !$("#subConfirm")) return;
  const t=new URLSearchParams(location.search).get("t"); if(!t) return;
  try{ history.replaceState(null,"","/subscribe/"); }catch(_){}  // 주소창·방문 기록에 토큰이 남지 않게
  let em=""; try{ em=decodeURIComponent(escape(atob(t.split(".")[0].replace(/-/g,"+").replace(/_/g,"/")))).split("|")[0]; }catch(_){}
  const box=$("#subConfirm"), b=$("#subCBtn"), f=document.querySelector("#v-subscribe form.subf");
  box.hidden=false; $("#subCEmail").textContent=em||"신청한";
  b.addEventListener("click",async ()=>{
    b.disabled=true; b.textContent="확정하는 중…";
    const j=await subPost(f?f.dataset.api:"","/confirm",{t});
    if(j.ok){ $("#subCTitle").textContent="구독이 확정됐습니다"; $("#subCMsg").textContent=`돌아오는 월요일 아침 7시부터 ${em||"이 주소"}로 주간 메일이 갑니다. 해지는 메일 아래 '구독 해지' 링크 한 번이면 됩니다.`; b.remove(); if(f) f.closest(".subbox").hidden=true; try{ localStorage.setItem("shift-sub","1"); }catch(_){} track("subscribe:confirm","구독 확정"); }
    else { $("#subCTitle").textContent="구독을 확정하지 못했습니다"; $("#subCMsg").textContent=SUB_ERR[j.error]||"잠시 뒤 다시 눌러 주세요."; b.disabled=false; b.textContent="다시 시도"; if(j.error==="expired"||j.error==="bad") b.remove(); }
  });
})();

const NAV = r=>r.startsWith("tool-")?"tools":r.startsWith("w-")?"dict":r.startsWith("a-")?"news":r.startsWith("t-")?"tutorial":r.startsWith("c-")?"news":r.startsWith("d-")?"daily":r;
// 옛 해시 주소(#a-… 등)로 들어오면 새 주소로 보낸다
(function(){ const h=location.hash.slice(1); if(!h) return;
  if(h==="reel") return location.replace("/?from=reels");
  if(/^(a|t|c|d)-/.test(h) || ["news","tutorial","column","daily","dict","about","home"].includes(h)) location.replace(P(h)); })();
const q0 = new URLSearchParams(location.search).get("q"); if(q0 && $("#q") && !/^(prompts|tools$|tool-|tutorial$)/.test(ROUTE)) $("#q").value = q0;  // 프롬프트·도구 페이지의 ?q= 는 그 페이지 안 검색어라 머리말 검색칸에 넣지 않는다
if(q0 && ROUTE==="news") location.replace("/search/?q="+encodeURIComponent(q0));  // 예전 검색 주소
if(ROUTE==="search" && $("#sq")) $("#sq").value = q0 || "";
// 낮·밤 바꾸기 버튼(11/3~): 고른 값은 이 브라우저에만 저장(shift-theme). 첫 적용은 assets/theme.js 가 한다.
const sysDark = ()=>!!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
const isDark = ()=>{ const t=document.documentElement.getAttribute("data-theme"); return t ? t==="dark" : sysDark(); };
function themeSync(){ const b=$("#themeBtn"), d=isDark(); if(b) b.setAttribute("aria-pressed", String(d));
  const m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", d?"#141518":"#FFFFFF"); }
document.addEventListener("click",e=>{ if(!e.target.closest("#themeBtn")) return;
  const next = isDark() ? "light" : "dark", h=document.documentElement;
  if(!RM){ h.classList.add("theme-anim"); setTimeout(()=>h.classList.remove("theme-anim"),400); }
  h.setAttribute("data-theme", next); try{ localStorage.setItem("shift-theme", next); }catch(_){}
  themeSync(); track("theme:"+next, next==="dark"?"다크 모드":"라이트 모드"); });
if(window.matchMedia){ const mq=matchMedia("(prefers-color-scheme: dark)"); (mq.addEventListener?mq.addEventListener("change",themeSync):mq.addListener&&mq.addListener(themeSync)); }
function init(){
  const r = ROUTE;
  if(!PRE){
    if($("#dailyHome")) renderHome();
    renderNews(); renderDict(); renderLists(); renderAbout(); renderPrompts(); renderVerdict();
    if(r.startsWith("a-") && byId[r.slice(2)]) renderArticle(byId[r.slice(2)]);
    else if(r.startsWith("t-") && tutById[r]) renderTutorial(tutById[r]);
    else if(r.startsWith("c-") && colById[r]) renderColumn(colById[r]);
    else if(r.startsWith("d-") && dayById[r]) renderDaily(dayById[r]);
    else if(r.startsWith("w-") && termBySlug[r]) renderTerm(termBySlug[r]);
    // 화면 맨 위 그림은 바로 받는다(가장 큰 그림이 늦게 뜨지 않게): 첫 그림의 지연 로딩을 끔
    const lcp = document.querySelector("main img[loading=lazy]"); if(lcp){ lcp.removeAttribute("loading"); lcp.setAttribute("fetchpriority","high"); }
  } else if(q0 || dq0 || catFilter!=="all"){ renderNews(); renderDict(); renderTutList(); }
  if(PRE && (ROUTE==="prompts"||ROUTE==="verdict"||ROUTE==="tools") && location.search){ renderPrompts(); renderVerdict(); renderTools(); }
  if($("#sResults")) renderSearch();
  const from = new URLSearchParams(location.search).get("from");
  if($("#reelwelcome")) $("#reelwelcome").hidden = !["reels","reel","ig","instagram"].includes(from||"");
  document.querySelectorAll("[data-nav]").forEach(a=>a.setAttribute("aria-current", a.dataset.nav===NAV(r) ? "true":"false"));
  themeSync();
  // (11/6~) 홈 검색창 안내는 .hs2-hint 가 맡는다. placeholder 는 빈칸(" ")으로 두어야 안내가 겹치지 않는다
  if(PRE) motion();  // 미리 그리는 중(PRE 아님)에는 숨김·0 이 HTML에 박히지 않게 돌리지 않는다
}
init();
// 휴대폰 위쪽 메뉴(11/5~): 메뉴가 화면보다 길면 오른쪽 끝을 흐리게 해 옆으로 밀 수 있다는 걸 보인다. 끝까지 밀면 흐림을 끈다. 순서는 바꾸지 않는다.
(function(){ const n=document.querySelector("nav.main"); if(!n) return;
  const f=()=>{ const o=n.scrollWidth>n.clientWidth+2; n.classList.toggle("ovf",o); n.classList.toggle("end",o&&n.scrollLeft+n.clientWidth>=n.scrollWidth-2); };
  const cur=n.querySelector('[aria-current="true"]'); if(cur&&n.scrollWidth>n.clientWidth&&cur.offsetLeft+cur.offsetWidth>n.clientWidth) n.scrollLeft=cur.offsetLeft-16;
  f(); n.addEventListener("scroll",f,{passive:true}); addEventListener("resize",f); })();

// 위쪽 메뉴 두 줄(11/6~): 큰 분류 4개(AI 소식·따라 하기·무료 도구·소개)를 누르면 그 분류의 메뉴가 아래 한 줄로 펼쳐진다.
// 지금 보는 페이지가 속한 분류의 줄은 처음부터 펼쳐 두고, 그 안에서 지금 페이지를 표시한다. 같은 분류를 다시 누르면 접는다.
// 미리 그릴 때 펼친 상태가 HTML에 박혀서 JS 없이도 지금 분류의 줄이 보인다. 누르기 동작은 미리 그린 페이지(PRE)에서도 붙인다.
(function(){
  const nav=document.querySelector("nav.main"), box=$("#subnav"); if(!nav||!box) return;
  const r=ROUTE, cat=new URLSearchParams(location.search).get("cat")||"";
  const grp = /^(daily|news|verdict)$|^(a|c|d)-|^weekly/.test(r) ? "news"
    : /^(tutorial|prompts|guide|vs)$|^t-|^guide-|^vs-/.test(r) ? "learn"
    : r==="tools"||r.startsWith("tool-") ? "tools"
    : /^(about|privacy|subscribe)$/.test(r) ? "about" : "";
  const sub = r==="daily"||r.startsWith("d-") ? "daily"
    : r.startsWith("c-")||(r==="news"&&cat==="칼럼") ? "column"
    : r==="news"||r.startsWith("a-") ? "news"
    : r.startsWith("weekly") ? "weekly" : r==="verdict" ? "verdict"
    : r==="tutorial"||r.startsWith("t-") ? "tutorial" : r.startsWith("guide") ? "guide"
    : r==="prompts" ? "prompts" : r.startsWith("vs") ? "vs"
    : r==="tools" ? (cat?"tc:"+cat:"tools") : r.startsWith("tool-") ? "tools"
    : r==="about" ? "about" : r==="privacy" ? "privacy" : "";
  const tabs=[...nav.querySelectorAll("[data-grp]")], rows=[...box.querySelectorAll(".sub")];
  const show=g=>{ rows.forEach(x=>x.hidden = x.dataset.grp!==g); tabs.forEach(a=>a.setAttribute("aria-expanded", a.dataset.grp===g?"true":"false"));
    document.body.classList.toggle("has-sub", !!g); };
  tabs.forEach(a=>a.setAttribute("aria-current", a.dataset.grp===grp?"true":"false"));
  box.querySelectorAll("[data-sub]").forEach(a=>{ if(a.dataset.sub===sub) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  show(grp);
  let open=grp;
  nav.addEventListener("click",e=>{ const a=e.target.closest("[data-grp]"); if(!a) return;
    e.preventDefault(); const g=a.dataset.grp, row0=$("#sub-"+g), seen=row0&&!row0.hidden&&row0.offsetHeight>0;
    open = seen ? "" : g; show(open);
    document.documentElement.classList.toggle("sub-user", !!open);  // 직접 연 줄은 스크롤해도 접지 않는다
    track("nav-open:"+(open||"close"), a.textContent.trim());
    const row=open&&$("#sub-"+open); if(row){ const c=row.querySelector('[aria-current="page"]'); const f=row.querySelector(".sub-in"); if(c&&f&&f.scrollWidth>f.clientWidth) f.scrollLeft=c.offsetLeft-16; } });
  const back=()=>{ open=grp; show(grp); document.documentElement.classList.remove("sub-user"); };
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&open!==grp) back(); });
  document.addEventListener("click",e=>{ if(open!==grp && !e.target.closest("header")) back(); });
})();

// 휴대폰인데 브라우저가 'PC 화면(데스크톱 사이트)'으로 연 경우 알림(11/3~).
// 이 상태에서는 브라우저가 휴대폰용 화면 폭 설정을 무시하고 980px 폭으로 그려 글자가 작아진다. 사이트가 바꿀 수 없어 끄는 법을 알려 준다.
(function(){
  let z;
  try{ const sw=Math.min(screen.width,screen.height); z=innerWidth/screen.width;
    if(!(navigator.maxTouchPoints>0 && sw<700 && innerWidth>=800 && z>1.6)) return;
    if(localStorage.getItem("shift-pd-off")) return; }catch(_){ if(!z) return; }
  const n=document.createElement("div"); n.className="pdnote"; n.setAttribute("role","note"); n.style.setProperty("--z", z.toFixed(2));
  n.innerHTML='<p><b>PC 화면으로 열려 있어 글자가 작게 보여요.</b> 브라우저 메뉴(⋮)에서 <b>‘데스크톱 사이트’</b>를 끄면 휴대폰 화면으로 바뀝니다.</p><button type="button">닫기</button>';
  n.querySelector("button").addEventListener("click",()=>{ n.remove(); try{ localStorage.setItem("shift-pd-off","1"); }catch(_){} track("pd-note-close","PC 화면 알림 닫기"); });
  document.body.prepend(n); track("pd-note","PC 화면 알림");
})();

// 한국어 줄바꿈 다듬기(11/7~): 화면에 보이는 글자에만 보이지 않는 이음표를 넣어 이상한 곳에서 줄이 바뀌지 않게 한다.
//  ① 가운뎃점(·)으로 줄이 시작하지 않게(점 앞을 붙임)  ② ']을', ')이'처럼 괄호 뒤 조사가 떨어지지 않게
//  ③ '1) 날짜별'처럼 번호가 줄 끝에 홀로 남지 않게  ④ '[ ]' 빈칸 괄호가 갈라지지 않게
//  ⑤ 문단 마지막 줄에 '줘.', '빼 줘.'처럼 한두 글자만 남지 않게 마지막 낱말을 앞 낱말과 붙임.
//  복사되는 글(data-copy)·입력칸·코드는 건드리지 않는다. 처음 한 번 + 목록이 다시 그려질 때마다 돈다.
(function(){
  const SKIP="script,style,textarea,input,select,pre,code,svg,[contenteditable],.hwall,.hticker,.fword,.pdout,.dclist,#dcPrint";   // 비교 결과(.pdout·.dclist)는 글자를 그대로 보여야 한다
  const done=new WeakSet(), INL=/^(inline|contents)$/;
  const blockOf=n=>{ let e=n.parentElement; while(e&&e!==document.body&&INL.test(getComputedStyle(e).display)) e=e.parentElement; return e; };
  const letters=s=>(s.match(/[\p{L}\p{N}]/gu)||[]).length;
  function inner(s){
    return s.replace(/([^\s⁠])·/g,"$1⁠·")
            .replace(/ · /g," · ")
            .replace(/([\]\)』」’”])(?=[가-힣])/g,"$1⁠")
            .replace(/\[ \]/g,"[ ]")
            .replace(/(^|[ \n(])(\d{1,2}\)|[①-⑳]) /g,"$1$2 ")
            .replace(/([^\s\u2060])\/([가-힣A-Za-z]{1,2})(?![가-힣A-Za-z])/g,"$1\u2060/\u2060$2")
            .replace(/ (\.[a-z][\w-]{0,15})/g,"\u00a0$1")
            .replace(/--(?=[a-z])/g,"-\u2060-\u2060")
            .replace(/ \(([^()\s]{1,6})\)/g,"\u00a0($1)")
            .replace(/([^\s\u2060])\((?=[^()\s]{1,6}\))/g,"$1\u2060(")
            .replace(/([A-Za-z])-(?=\d)/g,"$1-\u2060")
            .replace(/([A-Za-z가-힣]) (\d+(?:\.\d+)+)(?![\d.])/g,"$1\u00a0$2")
            .replace(/([\d+%]) ([가-힣]{1,2})(?![가-힣])/g,"$1\u00a0$2");
  }
  function tail(s){ // 마지막 낱말이 너무 짧으면 앞 낱말과 붙인다(붙인 꼬리는 12자 이내)
    const m=s.match(/^([\s\S]*?)((?:[^ \n]+ )*[^ \n]+)\s*$/); if(!m) return s;
    const ws=s.replace(/\s+$/,"").split(" "); if(ws.length<3) return s;
    let k=1; while(k<4 && letters(ws.slice(-k).join(""))<4 && ws.slice(-(k+1)).join(" ").length<=12) k++;
    if(k===1) return s;
    return ws.slice(0,-k).join(" ")+" "+ws.slice(-k).join(" ")+s.slice(s.replace(/\s+$/,"").length);
  }
  function run(root){
    if(!root||!root.querySelectorAll) return;
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const last=new Map(); let n;
    while((n=w.nextNode())){
      if(done.has(n)||!n.data.trim()) continue;
      const p=n.parentElement; if(!p||p.closest(SKIP)) continue;
      done.add(n); const v=inner(n.data); if(v!==n.data) n.data=v;
      const b=blockOf(n); if(b) last.set(b,n);
    }
    last.forEach(t=>{ const v=tail(t.data); if(v!==t.data) t.data=v; });
    // 표의 짧은 칸('만드는 곳', '5개 언어')은 한 줄로. 넘치면 표가 옆으로 밀린다(.tbl 가로 스크롤)
    root.querySelectorAll("td,th,.vz-l").forEach(c=>{ if(c.closest(SKIP)||c.textContent.trim().length>16||(c.matches("td,th")&&!c.closest(".tbl"))) return;
      const w2=document.createTreeWalker(c,NodeFilter.SHOW_TEXT); let x; while((x=w2.nextNode())) { const v=x.data.replace(/ /g,"\u00a0").replace(/·(?!\u2060)/g,"·\u2060").replace(/([^\s\u2060])\(/g,"$1\u2060(").replace(/-(?!\u2060)(?=\S)/g,"-\u2060"); if(v!==x.data) x.data=v; } });
  }
  window.fixBreaks=run;
  const go=()=>{ run(document.body); };
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",go); else go();
  let q=[]; const mo=new MutationObserver(ms=>{ for(const m of ms) m.addedNodes.forEach(x=>q.push(x.nodeType===3?x.parentElement:x)); requestAnimationFrame(()=>{ const xs=q; q=[]; xs.forEach(x=>x&&x.isConnected&&run(x)); }); });
  mo.observe(document.body,{childList:true,subtree:true});
})();

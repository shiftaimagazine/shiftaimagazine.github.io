const SITE = "https://shiftaimagazine.com";
const ROUTE = document.body.dataset.route || "home";
const PRE = document.body.dataset.pre === "1";
const P = r=>{ if(!r||r==="home") return "/"; const k=r.slice(0,2), v=r.slice(2);
  if(k==="a-") return "/news/"+v+"/"; if(k==="t-") return "/tutorial/"+v+"/"; if(k==="c-") return "/column/"+v+"/"; if(k==="d-") return "/daily/"+v+"/";
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
const sorted = [...ARTICLES].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
const dailySorted = [...DAILY].sort((a,b)=>b.date.localeCompare(a.date));
const CATS = [...new Set(ARTICLES.map(a=>a.cat))];
const textOf = b=>(b||[]).map(x=>x.p||x.lead||x.q||(x.ul?x.ul.flat().join(" "):"")||(x.pred?x.pred.join(" "):"")||"").join(" ");
const readMin = b=>Math.max(1,Math.round(textOf(b).replace(/\s/g,"").length/350));
const imgOf = a=>a.image&&a.image.src ? a.image : {src:"img/logo.webp",credit:""};
const fig = (im,cls="")=>`<figure class="${cls}"><img src="${im.src}" alt="${esc(im.alt||"")}" loading="lazy">${im.credit?`<figcaption>${esc(im.credit)}</figcaption>`:""}</figure>`;
const thumb = im=>`<img class="thumb" src="${im.src}" alt="" loading="lazy">`;

const postHTML = a=>`<a class="post" href="${P("a-"+a.id)}">${thumb(imgOf(a))}
  <div class="b"><span class="cat">${esc(a.cat)}</span><h3>${esc(a.title)}</h3><p>${esc(a.hook)}</p><div class="meta"><span>${fmtDate(a.date)}</span><span class="dot"></span><span>${readMin(a.body)}분 읽기</span></div></div></a>`;
// 튜토리얼: 읽는 시간(글자 수 기준)과 단위(STEP / 프롬프트)
const tutText = t=>[t.deck,t.why,t.intro,...(t.quick?t.quick.lines:[]),...t.items.flatMap(x=>[x.h,x.d,x.how,...(x.more||[]),x.prompt,...(x.term||[]).flat(),...(x.code||[]).map(c=>c.cmd+" "+(c.ok||"")),x.bad,x.good]),...(t.bonus?t.bonus.items:[]),...(t.limits||[])].filter(Boolean).join(" ");
const tutRead = t=>Math.max(1,Math.round(tutText(t).replace(/\s/g,"").length/350));
const tutUnit = t=>t.kind==="steps" ? `STEP ${t.items.length}개` : `프롬프트 ${t.items.length}개`;
const tutLabel = (t,k)=>t.kind==="steps" ? `STEP ${k+1}` : `프롬프트 ${k+1}`;
const tutHTML = t=>`<a class="post" href="${P(t.id)}">${thumb({src:t.thumb})}
  <div class="b"><span class="cat">${esc(t.cat||"튜토리얼")} · ${esc(t.level)}</span><h3>${esc(t.title)}</h3><p>${esc(t.deck)}</p><div class="meta"><span>${fmtDate(t.date)}</span><span class="dot"></span><span>${tutUnit(t)}</span><span class="dot"></span><span>읽는 데 ${tutRead(t)}분</span>${t.pdf?`<span class="dot"></span><span>PDF 정리본</span>`:""}</div></div></a>`;
const toolHTML = t=>`<a class="post" href="${t.href}">${thumb({src:t.thumb})}
  <div class="b"><span class="cat">무료 도구 · ${esc(t.tag)}</span><h3>${esc(t.title)}</h3><p>${esc(t.desc)}</p><div class="meta"><span>설치·가입 없음</span><span class="dot"></span><span>브라우저에서 바로</span></div></div></a>`;
const colImg = c=>c.image||(c.rel&&byId[c.rel]?imgOf(byId[c.rel]):{src:"img/logo.webp"});
const colHTML = c=>`<a class="post" href="${P(c.id)}">${thumb(colImg(c))}
  <div class="b"><span class="cat">칼럼</span><h3>${esc(c.title)}</h3><p>${esc(c.deck)}</p><div class="meta"><span>${fmtDate(c.date)}</span><span class="dot"></span><span>${readMin(c.body)}분 읽기</span></div></div></a>`;
const dayItems = d=>d.items.map(id=>byId[id]).filter(Boolean);
const dayPhoto = d=>{const its=dayItems(d); return (byId[d.lead]&&!byId[d.lead].image.temp)?byId[d.lead]:(its.find(a=>!a.image.temp)||byId[d.lead]||its[0]);};

function renderHome(){
  const d = dailySorted[0];
  if(d){ const its=dayItems(d); const lead=dayPhoto(d);
    $("#dailyHome").innerHTML = `<div><span class="k">AI 데일리 · ${korDate(d.date)}</span><h3>${esc(d.title)}</h3>
      <ol>${its.slice(0,5).map((a,i)=>`<li><a href="${P("a-"+a.id)}"><i>${String(i+1).padStart(2,"0")}</i><div><span>${esc(a.cat)}</span><b>${esc(a.title)}</b></div></a></li>`).join("")}</ol>
      <a class="go" href="${P("d-"+d.date)}">이날 소식 ${its.length}건 전체 보기</a></div>${lead?fig(imgOf(lead)):""}`; }
  $("#homeNews").innerHTML = sorted.slice(0,6).map(postHTML).join("");
  $("#homeTuts").innerHTML = TUTORIALS.slice(0,3).map(tutHTML).join("");
  $("#homeCols").innerHTML = COLUMNS.slice(0,3).map(colHTML).join("");
  if($("#homeTools")) $("#homeTools").innerHTML = TOOLS.slice(0,3).map(toolHTML).join("");
  $("#homeTerms").innerHTML = TERMS.filter(t=>t.rel&&byId[t.rel]).slice(0,6).map(t=>`<a href="/dict/"><b>${esc(t.t)}</b><span>${esc(t.d)}</span></a>`).join("");
  const rl = sorted.slice(0,3);
  $("#reelwelcome").innerHTML = `<b>릴스에서 오셨군요! 반갑습니다. 저희는 SHIFT AI 매거진입니다.</b><p>방금 보신 영상의 기사 전문과 오늘 올라온 기사를 아래에 모아 두었습니다.</p><div class="acts">${rl.map(a=>`<a href="${P("a-"+a.id)}">${esc(a.title)}</a>`).join("")}</div>`;
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
  $("#terms").innerHTML = list.map(t=>`<div class="term"><dt>${esc(t.t)}<small>${esc(t.en)}</small>${t.g?`<span class="tg">${esc(t.g)}</span>`:""}</dt><dd>${esc(t.d)}${t.rel&&byId[t.rel]?`<br><a href="${P("a-"+t.rel)}">관련 기사: ${esc(byId[t.rel].title)}</a>`:""}</dd></div>`).join("");
  $("#dictEmpty").hidden = list.length>0;
}
$("#idx") && $("#idx").addEventListener("click",e=>{const b=e.target.closest("button[data-i]"); if(!b||b.disabled) return; dictFilter=b.dataset.i; renderDict();});
$("#grp") && $("#grp").addEventListener("click",e=>{const b=e.target.closest("button[data-g]"); if(!b) return; grpFilter=b.dataset.g; dictFilter="all"; renderDict();});

const drowHTML = d=>{const its=dayItems(d); const lead=dayPhoto(d); const [y,m,dd]=d.date.split("-");
    return `<a class="drow" href="${P("d-"+d.date)}"><div class="dd">${m}.${dd}<small>${korDate(d.date).split(" ").pop()} · ${its.length}건</small></div>
      <div><h3>${esc(d.title)}</h3><ul>${(d.three||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>${lead?`<figure>${thumb(imgOf(lead))}</figure>`:"<span></span>"}</a>`;};
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
  if($("#toolsGrid")) $("#toolsGrid").innerHTML = TOOLS.map(toolHTML).join("");
  if($("#resGrid")) $("#resGrid").innerHTML = RESOURCES.map(r=>`<div class="res"><a class="cv" href="${r.pdf}" target="_blank" rel="noopener"><img src="${r.cover}" alt="" loading="lazy"></a>
    <div class="b"><span class="cat">PDF 정리본 · ${r.pages}쪽</span><h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p><div class="meta"><span>${fmtDate(r.date)}</span></div>
    <div class="acts"><a class="btn" href="${r.pdf}" target="_blank" rel="noopener">PDF 열기</a>${r.tut?`<a class="ghost" href="${P(r.tut)}">웹에서 읽기</a>`:""}</div></div></div>`).join("");
  if($("#dailyList")) $("#dailyList").innerHTML = dailySorted.map(drowHTML).join("");
  if($("#dailyPreview")) $("#dailyPreview").innerHTML = dailySorted.slice(0,3).map(drowHTML).join("");
}

function renderAbout(){
  if(!$("#stats")) return;
  const n=[["기사",ARTICLES.length,"/news/"],["튜토리얼",TUTORIALS.length,"/tutorial/"],["칼럼",COLUMNS.length,"/news/?cat=칼럼"],["데일리 이슈",DAILY.length,"/daily/"],["AI 사전",TERMS.length,"/dict/"]];
  $("#stats").innerHTML = n.map(([k,v,h])=>`<a class="stat" href="${h}"><b>${k}</b><span>${v}</span></a>`).join("");
  const f = ARTICLES.find(a=>a.featured) || sorted[0];
  const last = (f.body.filter(x=>x.p).slice(-1)[0]||{}).p||f.hook;
  $("#two").innerHTML = `<figure><img src="${ABOUT_CARD.src}" alt="쓰레드·인스타그램 카드 예시"><figcaption>${esc(ABOUT_CARD.caption)}</figcaption></figure>
    <div class="long"><small>매거진 기사 · ${esc(f.title)}</small>${esc(last)}<div class="acts"><a href="${P("a-"+f.id)}">기사 전문 읽기</a><a href="${IG}" target="_blank" rel="noopener">30초 영상은 인스타그램에서</a></div></div>`;
}

// ---- 검색: 위쪽 검색칸·휴대폰 검색 버튼 → /search/ (기사·칼럼·데일리·튜토리얼·AI 사전 한 번에) ----
$("#searchForm").addEventListener("submit",e=>{e.preventDefault(); const q=$("#q").value.trim();
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
const termCard = t=>`<a class="sterm" href="/dict/?t=${encodeURIComponent(t.t)}"><b>${esc(t.t)}</b>${t.en?`<small>${esc(t.en)}</small>`:""}<span>${esc(t.d)}</span></a>`;
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
  const q = ($("#sq").value||"").trim(); $("#q").value = q;
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

function bodyHTML(body){
  return body.map(x=>{
    if(x.lead) return `<p class="lead">${esc(x.lead)}</p>`;
    if(x.p) return `<p>${esc(x.p)}</p>`;
    if(x.h) return `<h3>${esc(x.h)}</h3>`;
    if(x.ul) return `<ul>${x.ul.map(([h,d])=>`<li><b>${esc(h)}.</b> ${esc(d)}</li>`).join("")}</ul>`;
    if(x.q) return `<div class="q">${esc(x.q)}<br><button class="copy" data-copy="${esc(x.q)}">복사하기</button></div>`;
    if(x.pred) return `<div class="pred"><div class="ph2">편집장의 전망</div><ol>${x.pred.map(p=>`<li>${esc(p)}</li>`).join("")}</ol></div>`;
    if(x.table) return `<div class="tbl"><table class="dtable"><thead><tr>${x.table.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${x.table.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${x.table.note?`<div class="note">${esc(x.table.note)}</div>`:""}`;
    if(x.img) return fig(x.img,"inline-fig");
    return "";
  }).join("");
}
const factsHTML = f=>f&&f.length?`<div class="box"><b>한눈에 보기</b><table class="facts"><tbody>${f.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>`:"";
const srcHTML = s=>s&&s.length?`<div class="src"><b>원문</b>${s.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(n)} · ${esc(u)}</a>`).join("")}</div>`:"";
const linkCopy = (h,label)=>`<a href="${P(h)}" data-copy="${SITE}${P(h)}">${label}</a>`;

function renderArticle(a){
  const i = sorted.findIndex(x=>x.id===a.id); const nx = sorted[(i+1)%sorted.length];
  const tl = (a.terms||[]).map(t=>termByName[t]).filter(Boolean);
  const ul = a.body.find(x=>x.ul); const rest = a.body.filter(x=>!x.ul);
  const day = DAILY.find(d=>d.items.includes(a.id));
  $("#v-article").innerHTML = `<article class="article narrow">
    <a class="back" href="/news/">← AI 뉴스</a>
    <span class="cat">${esc(a.cat)}</span>
    <h1>${esc(a.title)}</h1><p class="deck">${esc(a.sub)}</p>
    ${a.try?`<div class="trynow"><b>오늘 바로 해 볼 것</b><span>${esc(a.try)}</span></div>`:""}
    <div class="meta"><span>SHIFT AI 편집부</span><span class="dot"></span><span>${fmtDate(a.date)} ${a.time}</span><span class="dot"></span><span>${readMin(a.body)}분 읽기</span></div>
    ${fig(imgOf(a),"lead-fig")}
    ${factsHTML(a.facts)}
    ${ul?`<div class="box keyp"><b>세 줄 요약</b><ul>${ul.ul.map(([h,d])=>`<li><b>${esc(h)}.</b> ${esc(d)}</li>`).join("")}</ul></div>`:""}
    <div class="body">${bodyHTML(rest)}</div>
    <div class="ask"><small>생각해 볼 질문</small>${esc(a.ask)}</div>
    ${srcHTML(a.sources)}
    ${tl.length?`<div class="chips">${tl.map(t=>`<a href="/dict/" title="${esc(t.d)}">${esc(t.t)}</a>`).join("")}</div>`:""}
    <div class="links">${day?`<a href="${P("d-"+day.date)}">${fmtDate(day.date)} 데일리 이슈</a>`:""}<a href="${a.reel||IG}" target="_blank" rel="noopener">30초 영상 보기</a><a href="${a.thread||TH}" target="_blank" rel="noopener">쓰레드에서 의견 남기기</a>${linkCopy("a-"+a.id,"링크 복사")}</div>
    ${FOLLOWBOX}
    <div class="next"><div class="lbl">다음 기사</div><div class="list">${postHTML(nx)}</div></div>
  </article>`;
}
function renderColumn(c){
  const i = COLUMNS.findIndex(x=>x.id===c.id); const nx = COLUMNS[(i+1)%COLUMNS.length]; const rel = c.rel && byId[c.rel];
  $("#v-article").innerHTML = `<article class="article narrow">
    <a class="back" href="/news/?cat=칼럼">← AI 뉴스 · 칼럼</a>
    <span class="cat">칼럼</span>
    <h1>${esc(c.title)}</h1><p class="deck">${esc(c.deck)}</p>
    <div class="meta"><span>SHIFT AI 편집장</span><span class="dot"></span><span>${fmtDate(c.date)}</span><span class="dot"></span><span>${readMin(c.body)}분 읽기</span></div>
    ${fig(colImg(c),"lead-fig")}
    <div class="body">${bodyHTML(c.body)}</div>
    ${rel?`<div class="next"><div class="lbl">바탕이 된 기사</div><div class="list">${postHTML(rel)}</div></div>`:""}
    <div class="links"><a href="${TH}" target="_blank" rel="noopener">쓰레드에서 반론 남기기</a>${linkCopy(c.id,"링크 복사")}</div>
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
    <h1>${esc(t.title)}</h1><p class="deck">${esc(t.deck)}</p>
    <div class="meta"><span>SHIFT AI 편집부</span><span class="dot"></span><span>${fmtDate(t.date)}</span><span class="dot"></span><span>읽는 데 ${tutRead(t)}분</span><span class="dot"></span><span>${tutUnit(t)}</span></div>
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
    ${rel?`<div class="next"><div class="lbl">관련 기사</div><div class="list">${postHTML(rel)}</div></div>`:""}
    <div class="links">${t.app?`<a href="${t.app.url}" target="_blank" rel="noopener">${esc(t.app.btn)}</a>`:""}${t.pdf?`<a href="${t.pdf.url}" target="_blank" rel="noopener">PDF 정리본 열기</a>`:""}<a href="${TH}" target="_blank" rel="noopener">쓰레드에서 질문하기</a>${linkCopy(t.id,"링크 복사")}</div>
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
    <h1>${esc(d.title)}</h1>${d.summary?`<p class="deck">${esc(d.summary)}</p>`:""}
    <div class="meta"><span>SHIFT AI 편집부</span><span class="dot"></span><span>소식 ${its.length}건</span></div>
    ${lead?fig(imgOf(lead),"lead-fig"):""}
    ${d.three&&d.three.length?`<div class="box three"><b>오늘의 3줄</b><ol>${d.three.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>`:""}
    <div class="items">${its.map((a,k)=>`<a class="it" href="${P("a-"+a.id)}"><span class="n">${String(k+1).padStart(2,"0")}</span><div><span class="cat">${esc(a.cat)}</span><h3>${esc(a.title)}</h3><p>${esc(a.hook)}</p></div><figure>${thumb(imgOf(a))}</figure></a>`).join("")}</div>
    ${nums.length?`<div class="sec" style="margin-top:40px"><h2>숫자로 보는 오늘</h2></div><div class="tbl"><table class="dtable"><thead><tr><th>소식</th><th>숫자</th></tr></thead><tbody>${nums.map(([a,v])=>`<tr><td>${esc(a.title)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>`:""}
    <div class="links">${prev?`<a href="${P("d-"+prev.date)}">← ${fmtDate(prev.date)}</a>`:""}${next?`<a href="${P("d-"+next.date)}">${fmtDate(next.date)} →</a>`:""}${linkCopy("d-"+d.date,"링크 복사")}</div>
    ${FOLLOWBOX}
  </article>`;
}

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-copy]"); if(!b) return; e.preventDefault();
  const txt=b.dataset.copy; const done=()=>toast("복사했습니다");
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(fallback);}else fallback();
  function fallback(){const ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");done();}catch(_){toast("길게 눌러 복사해 주세요");}ta.remove();}
});
let toastT; function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),1600);}

const NAV = r=>r.startsWith("a-")?"news":r.startsWith("t-")?"tutorial":r.startsWith("c-")?"news":r.startsWith("d-")?"daily":r;
// 옛 해시 주소(#a-… 등)로 들어오면 새 주소로 보낸다
(function(){ const h=location.hash.slice(1); if(!h) return;
  if(h==="reel") return location.replace("/?from=reels");
  if(/^(a|t|c|d)-/.test(h) || ["news","tutorial","column","daily","dict","about","home"].includes(h)) location.replace(P(h)); })();
const q0 = new URLSearchParams(location.search).get("q"); if(q0) $("#q").value = q0;
if(q0 && ROUTE==="news") location.replace("/search/?q="+encodeURIComponent(q0));  // 예전 검색 주소
if(ROUTE==="search" && $("#sq")) $("#sq").value = q0 || "";
function init(){
  const r = ROUTE;
  if(!PRE){
    if($("#dailyHome")) renderHome();
    renderNews(); renderDict(); renderLists(); renderAbout();
    if(r.startsWith("a-") && byId[r.slice(2)]) renderArticle(byId[r.slice(2)]);
    else if(r.startsWith("t-") && tutById[r]) renderTutorial(tutById[r]);
    else if(r.startsWith("c-") && colById[r]) renderColumn(colById[r]);
    else if(r.startsWith("d-") && dayById[r]) renderDaily(dayById[r]);
  } else if(q0 || dq0 || catFilter!=="all"){ renderNews(); renderDict(); renderTutList(); }
  if($("#sResults")) renderSearch();
  const from = new URLSearchParams(location.search).get("from");
  if($("#reelwelcome")) $("#reelwelcome").hidden = !["reels","reel","ig","instagram"].includes(from||"");
  document.querySelectorAll("[data-nav]").forEach(a=>a.setAttribute("aria-current", a.dataset.nav===NAV(r) ? "true":"false"));
}
init();

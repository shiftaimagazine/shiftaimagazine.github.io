const SITE = "https://shiftaimagazine.github.io";
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
const tutHTML = t=>`<a class="post" href="${P(t.id)}">${thumb({src:t.thumb})}
  <div class="b"><span class="cat">튜토리얼 · ${esc(t.level)}</span><h3>${esc(t.title)}</h3><p>${esc(t.deck)}</p><div class="meta"><span>${fmtDate(t.date)}</span><span class="dot"></span><span>${t.items.length}개 항목 · ${esc(t.time)}</span>${t.pdf?`<span class="dot"></span><span>PDF 정리본</span>`:""}</div></div></a>`;
const colImg = c=>c.image||(c.rel&&byId[c.rel]?imgOf(byId[c.rel]):{src:"img/logo.webp"});
const colHTML = c=>`<a class="post" href="${P(c.id)}">${thumb(colImg(c))}
  <div class="b"><span class="cat">칼럼 · 확신도 ${esc(c.level)}</span><h3>${esc(c.title)}</h3><p>${esc(c.deck)}</p><div class="meta"><span>${fmtDate(c.date)}</span><span class="dot"></span><span>점검일 ${fmtDate(c.check)}</span><span class="dot"></span><span>${readMin(c.body)}분 읽기</span></div></div></a>`;
const dayItems = d=>d.items.map(id=>byId[id]).filter(Boolean);
const dayPhoto = d=>{const its=dayItems(d); return (byId[d.lead]&&!byId[d.lead].image.temp)?byId[d.lead]:(its.find(a=>!a.image.temp)||byId[d.lead]||its[0]);};

function renderHome(){
  const f = ARTICLES.find(a=>a.featured) || sorted[0];
  $("#feature").href = P("a-"+f.id);
  $("#feature").innerHTML = `${fig(imgOf(f))}<div class="ft"><span class="cat">${esc(f.cat)}</span><h1>${esc(f.title)}</h1><p>${esc(f.hook)}</p><div class="meta"><span>${fmtDate(f.date)}</span><span class="dot"></span><span>${readMin(f.body)}분 읽기</span></div></div>`;
  const d = dailySorted[0];
  if(d){ const its=dayItems(d); const lead=dayPhoto(d);
    $("#dailyHome").innerHTML = `<div><span class="k">AI 데일리 · ${korDate(d.date)}</span><h3>${esc(d.title)}</h3>
      <ol>${its.slice(0,5).map((a,i)=>`<li><a href="${P("a-"+a.id)}"><i>${String(i+1).padStart(2,"0")}</i><div><span>${esc(a.cat)}</span><b>${esc(a.title)}</b></div></a></li>`).join("")}</ol>
      <a class="go" href="${P("d-"+d.date)}">이날 소식 ${its.length}건 전체 보기</a></div>${lead?fig(imgOf(lead)):""}`; }
  $("#homeNews").innerHTML = sorted.filter(a=>a.id!==f.id).slice(0,6).map(postHTML).join("");
  $("#homeTuts").innerHTML = TUTORIALS.slice(0,3).map(tutHTML).join("");
  $("#homeCols").innerHTML = COLUMNS.slice(0,3).map(colHTML).join("");
  $("#homeTerms").innerHTML = TERMS.filter(t=>t.rel&&byId[t.rel]).slice(0,6).map(t=>`<a href="/dict/"><b>${esc(t.t)}</b><span>${esc(t.d)}</span></a>`).join("");
  const rl = sorted.slice(0,3);
  $("#reelwelcome").innerHTML = `<b>릴스에서 오셨군요. 여기서는 끝까지 읽습니다.</b><p>방금 본 30초 영상의 긴 판과 오늘 기사가 아래에 있습니다.</p><div class="acts">${rl.map(a=>`<a href="${P("a-"+a.id)}">${esc(a.title)}</a>`).join("")}</div>`;
}

let catFilter="all";
function renderNews(){
  if(!$("#newsList")) return;
  $("#catFilters").innerHTML = `<button aria-pressed="${catFilter==="all"}" data-c="all">전체 ${ARTICLES.length}</button>`+CATS.map(c=>`<button aria-pressed="${catFilter===c}" data-c="${esc(c)}">${esc(c)} ${ARTICLES.filter(a=>a.cat===c).length}</button>`).join("");
  const q = ($("#q").value||"").trim().toLowerCase();
  const list = sorted.filter(a=>(catFilter==="all"||a.cat===catFilter) && (!q || (a.title+a.hook+a.sub+a.cat).toLowerCase().includes(q)));
  $("#newsList").innerHTML = list.length ? list.map(postHTML).join("") : `<div class="empty">해당하는 기사가 없다.</div>`;
}
$("#catFilters") && $("#catFilters").addEventListener("click",e=>{const b=e.target.closest("button[data-c]"); if(!b) return; catFilter=b.dataset.c; renderNews();});

const KO = ["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let dictFilter = "all";
function renderDict(){
  if(!$("#terms")) return;
  const have = new Set(TERMS.map(t=>t.i));
  $("#idx").innerHTML = `<button aria-pressed="${dictFilter==="all"}" data-i="all">전체</button>` + [...KO,...EN].map(c=>`<button aria-pressed="${dictFilter===c}" data-i="${c}" ${have.has(c)?"":"disabled"}>${c}</button>`).join("");
  const q = ($("#q").value||"").trim().toLowerCase();
  const list = TERMS.filter(t=>(dictFilter==="all"||t.i===dictFilter) && (!q || (t.t+t.en+t.d).toLowerCase().includes(q)));
  $("#terms").innerHTML = list.map(t=>`<div class="term"><dt>${esc(t.t)}<small>${esc(t.en)}</small></dt><dd>${esc(t.d)}${t.rel&&byId[t.rel]?`<br><a href="${P("a-"+t.rel)}">관련 기사: ${esc(byId[t.rel].title)}</a>`:""}</dd></div>`).join("");
  $("#dictEmpty").hidden = list.length>0;
}
$("#idx") && $("#idx").addEventListener("click",e=>{const b=e.target.closest("button[data-i]"); if(!b||b.disabled) return; dictFilter=b.dataset.i; renderDict();});

const drowHTML = d=>{const its=dayItems(d); const lead=dayPhoto(d); const [y,m,dd]=d.date.split("-");
    return `<a class="drow" href="${P("d-"+d.date)}"><div class="dd">${m}.${dd}<small>${korDate(d.date).split(" ").pop()} · ${its.length}건</small></div>
      <div><h3>${esc(d.title)}</h3><ul>${(d.three||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>${lead?`<figure>${thumb(imgOf(lead))}</figure>`:"<span></span>"}</a>`;};
function renderLists(){
  if($("#colGrid")) $("#colGrid").innerHTML = COLUMNS.map(colHTML).join("");
  if($("#tutGrid")) $("#tutGrid").innerHTML = TUTORIALS.map(tutHTML).join("");
  if($("#resGrid")) $("#resGrid").innerHTML = RESOURCES.map(r=>`<div class="res"><a class="cv" href="${r.pdf}" target="_blank" rel="noopener"><img src="${r.cover}" alt="" loading="lazy"></a>
    <div class="b"><span class="cat">PDF 정리본 · ${r.pages}쪽</span><h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p><div class="meta"><span>${fmtDate(r.date)}</span></div>
    <div class="acts"><a class="btn" href="${r.pdf}" target="_blank" rel="noopener">PDF 열기</a>${r.tut?`<a class="ghost" href="${P(r.tut)}">웹에서 읽기</a>`:""}</div></div></div>`).join("");
  if($("#dailyList")) $("#dailyList").innerHTML = dailySorted.map(drowHTML).join("");
  if($("#dailyPreview")) $("#dailyPreview").innerHTML = dailySorted.slice(0,3).map(drowHTML).join("");
}

function renderAbout(){
  if(!$("#stats")) return;
  const n=[["기사",ARTICLES.length,"/news/"],["튜토리얼",TUTORIALS.length,"/tutorial/"],["칼럼",COLUMNS.length,"/column/"],["데일리 이슈",DAILY.length,"/daily/"],["AI 사전",TERMS.length,"/dict/"]];
  $("#stats").innerHTML = n.map(([k,v,h])=>`<a class="stat" href="${h}"><b>${k}</b><span>${v}</span></a>`).join("");
  const f = ARTICLES.find(a=>a.featured) || sorted[0];
  const last = (f.body.filter(x=>x.p).slice(-1)[0]||{}).p||f.hook;
  $("#two").innerHTML = `<figure><img src="${ABOUT_CARD.src}" alt="쓰레드·인스타그램 카드 예시"><figcaption>${esc(ABOUT_CARD.caption)}</figcaption></figure>
    <div class="long"><small>매거진 판 · ${esc(f.title)}</small>${esc(last)}<div class="acts"><a href="${P("a-"+f.id)}">기사 전문 읽기</a><a href="${IG}" target="_blank" rel="noopener">30초 판은 인스타그램</a></div></div>`;
}

$("#searchForm").addEventListener("submit",e=>{e.preventDefault(); const q=$("#q").value.trim(); if(q && !["news","dict"].includes(ROUTE)) location.href="/news/?q="+encodeURIComponent(q);});
$("#q").addEventListener("input",()=>{ renderNews(); renderDict(); });

function bodyHTML(body){
  return body.map(x=>{
    if(x.lead) return `<p class="lead">${esc(x.lead)}</p>`;
    if(x.p) return `<p>${esc(x.p)}</p>`;
    if(x.h) return `<h3>${esc(x.h)}</h3>`;
    if(x.ul) return `<ul>${x.ul.map(([h,d])=>`<li><b>${esc(h)}.</b> ${esc(d)}</li>`).join("")}</ul>`;
    if(x.q) return `<div class="q">${esc(x.q)}<br><button class="copy" data-copy="${esc(x.q)}">복사하기</button></div>`;
    if(x.pred) return `<div class="pred"><div class="ph2">편집장의 예측</div><ol>${x.pred.map(p=>`<li>${esc(p)}</li>`).join("")}</ol></div>`;
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
    <div class="meta"><span>SHIFT AI 편집부</span><span class="dot"></span><span>${fmtDate(a.date)} ${a.time}</span><span class="dot"></span><span>${readMin(a.body)}분 읽기</span></div>
    ${fig(imgOf(a),"lead-fig")}
    ${factsHTML(a.facts)}
    ${ul?`<div class="box keyp"><b>핵심 3줄</b><ul>${ul.ul.map(([h,d])=>`<li><b>${esc(h)}.</b> ${esc(d)}</li>`).join("")}</ul></div>`:""}
    <div class="body">${bodyHTML(rest)}</div>
    <div class="ask"><small>남는 질문</small>${esc(a.ask)}</div>
    ${srcHTML(a.sources)}
    ${tl.length?`<div class="chips">${tl.map(t=>`<a href="/dict/" title="${esc(t.d)}">${esc(t.t)}</a>`).join("")}</div>`:""}
    <div class="links">${day?`<a href="${P("d-"+day.date)}">${fmtDate(day.date)} 데일리 이슈</a>`:""}<a href="${a.reel||IG}" target="_blank" rel="noopener">30초 판 보기</a><a href="${a.thread||TH}" target="_blank" rel="noopener">쓰레드에서 의견 남기기</a>${linkCopy("a-"+a.id,"링크 복사")}</div>
    ${SUBBOX}
    <div class="next"><div class="lbl">다음 기사</div><div class="list">${postHTML(nx)}</div></div>
  </article>`;
}
function renderColumn(c){
  const i = COLUMNS.findIndex(x=>x.id===c.id); const nx = COLUMNS[(i+1)%COLUMNS.length]; const rel = c.rel && byId[c.rel];
  $("#v-article").innerHTML = `<article class="article narrow">
    <a class="back" href="/column/">← 칼럼</a>
    <span class="cat">칼럼 · 편집장의 예측</span>
    <h1>${esc(c.title)}</h1><p class="deck">${esc(c.deck)}</p>
    <div class="meta"><span>SHIFT AI 편집장</span><span class="dot"></span><span>${fmtDate(c.date)}</span><span class="dot"></span><span>확신도 ${esc(c.level)}</span><span class="dot"></span><span>점검일 ${fmtDate(c.check)}</span></div>
    ${fig(colImg(c),"lead-fig")}
    <div class="body">${bodyHTML(c.body)}<div class="pred"><div class="chk"><span>확신도 ${esc(c.level)}</span><span>점검일 ${fmtDate(c.check)}</span><span>결과: 아직</span></div></div></div>
    ${rel?`<div class="next"><div class="lbl">바탕이 된 기사</div><div class="list">${postHTML(rel)}</div></div>`:""}
    <div class="links"><a href="${TH}" target="_blank" rel="noopener">쓰레드에서 반론 남기기</a>${linkCopy(c.id,"링크 복사")}</div>
    ${SUBBOX}
    <div class="next"><div class="lbl">다음 칼럼</div><div class="list">${colHTML(nx)}</div></div>
  </article>`;
}
function renderTutorial(t){
  const i = TUTORIALS.findIndex(x=>x.id===t.id); const nx = TUTORIALS[(i+1)%TUTORIALS.length]; const rel = t.rel && byId[t.rel];
  const items = t.items.map((it,k)=>`<section class="ti"><div class="no">${String(k+1).padStart(2,"0")}</div>
      <div class="tb"><h3>${esc(it.h)}</h3><p class="d">${esc(it.d)}</p>
        ${it.how?`<div class="how"><b>이렇게 쓰세요</b>${esc(it.how)}</div>`:""}
        ${it.prompt?`<div class="pr"><b>복사해서 쓰는 프롬프트</b><div class="pt">${esc(it.prompt)}</div><button class="copy dark" data-copy="${esc(it.prompt)}">복사하기</button></div>`:""}
        ${it.example?`<div class="ex"><div><b>넣는 것 (예시)</b><pre>${esc(it.example.in)}</pre></div><div><b>나오는 것 (예시)</b><pre>${esc(it.example.out)}</pre></div></div>`:""}
      </div></section>`).join("");
  $("#v-article").innerHTML = `<article class="article narrow tut-page">
    <a class="back" href="/tutorial/">← 튜토리얼</a>
    <span class="cat">튜토리얼 · ${esc(t.level)}</span>
    <h1>${esc(t.title)}</h1><p class="deck">${esc(t.deck)}</p>
    <div class="meta"><span>SHIFT AI 편집부</span><span class="dot"></span><span>${fmtDate(t.date)}</span><span class="dot"></span><span>${t.items.length}개 항목 · ${esc(t.time)}</span></div>
    ${t.pdf?`<div class="pdfbox"><div class="pages">${t.pdf.pages.map((p,k)=>`<img src="${p}" alt="정리본 ${k+1}쪽" loading="lazy">`).join("")}</div>
      <div class="pdfmeta"><div><b>PDF 정리본 · ${t.pdf.count}쪽</b>이 글을 그대로 담은 PDF. 저장해 두고 꺼내 쓰면 된다.</div><a class="btn" href="${t.pdf.url}" target="_blank" rel="noopener">PDF 열기</a></div></div>`:fig({src:t.cover||t.thumb, credit:t.coverCredit||""},"lead-fig")}
    <div class="prep"><div><b>필요한 것</b>${esc(t.tools)}</div><div><b>걸리는 시간</b>${esc(t.time)}</div><div><b>왜 하나</b>${esc(t.why)}</div></div>
    ${t.intro?`<div class="intro">${esc(t.intro)}</div>`:""}
    <div class="items">${items}</div>
    ${t.bonus?`<div class="bonus"><b>보너스 · ${esc(t.bonus.title)}</b><ol>${t.bonus.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>`:""}
    ${srcHTML(t.sources)}
    ${rel?`<div class="next"><div class="lbl">관련 기사</div><div class="list">${postHTML(rel)}</div></div>`:""}
    <div class="links">${t.pdf?`<a href="${t.pdf.url}" target="_blank" rel="noopener">PDF 정리본 열기</a>`:""}<a href="${TH}" target="_blank" rel="noopener">쓰레드에서 질문하기</a>${linkCopy(t.id,"링크 복사")}</div>
    ${SUBBOX}
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
    ${SUBBOX}
  </article>`;
}

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-copy]"); if(!b) return; e.preventDefault();
  const txt=b.dataset.copy; const done=()=>toast("복사했습니다");
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(done).catch(fallback);}else fallback();
  function fallback(){const ta=document.createElement("textarea");ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand("copy");done();}catch(_){toast("길게 눌러 복사해 주세요");}ta.remove();}
});
let toastT; function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),1600);}

const NAV = r=>r.startsWith("a-")?"news":r.startsWith("t-")?"tutorial":r.startsWith("c-")?"column":r.startsWith("d-")?"daily":r;
// 옛 해시 주소(#a-… 등)로 들어오면 새 주소로 보낸다
(function(){ const h=location.hash.slice(1); if(!h) return;
  if(h==="reel") return location.replace("/?from=reels");
  if(/^(a|t|c|d)-/.test(h) || ["news","tutorial","column","daily","dict","about","home"].includes(h)) location.replace(P(h)); })();
const q0 = new URLSearchParams(location.search).get("q"); if(q0) $("#q").value = q0;
function init(){
  const r = ROUTE;
  if(!PRE){
    if($("#feature")) renderHome();
    renderNews(); renderDict(); renderLists(); renderAbout();
    if(r.startsWith("a-") && byId[r.slice(2)]) renderArticle(byId[r.slice(2)]);
    else if(r.startsWith("t-") && tutById[r]) renderTutorial(tutById[r]);
    else if(r.startsWith("c-") && colById[r]) renderColumn(colById[r]);
    else if(r.startsWith("d-") && dayById[r]) renderDaily(dayById[r]);
  } else if(q0){ renderNews(); renderDict(); }
  const from = new URLSearchParams(location.search).get("from");
  if($("#reelwelcome")) $("#reelwelcome").hidden = !["reels","reel","ig","instagram"].includes(from||"");
  document.querySelectorAll("[data-nav]").forEach(a=>a.setAttribute("aria-current", a.dataset.nav===NAV(r) ? "true":"false"));
}
init();

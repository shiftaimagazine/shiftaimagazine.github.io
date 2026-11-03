// SHIFT AI 무료 도구 — AI 답변 서식 정리기. 마크다운(챗GPT·클로드·제미나이 복사 버튼 결과)을 카톡용 글자, 한글·워드용 서식 글, 엑셀용 표로 바꾼다.
// /lib/marked/marked.umd.js(marked, MIT)는 글을 나누는 데(lexer)만 쓰고, 화면에 내는 HTML 은 여기서 글자를 이스케이프해 직접 만든다. 글은 어디에도 보내지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("fmIn")) return;
const LIB = "/lib/marked/marked.umd.js";
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const load = ()=> window.marked ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=LIB; s.onload=ok; s.onerror=()=>no(new Error("load")); document.head.appendChild(s); });
const opt = ()=>({ to: document.querySelector('input[name=fmTo]:checked').value, head: $("fmHead").value, bul: $("fmBul").value, table: $("fmTable").value,
  cite: $("fmCite").checked, emoji: $("fmEmoji").checked, link: $("fmLink").checked, hr: $("fmHr").checked });

// ---- 글 다듬기(마크다운을 읽기 전·후) ----
const TEX = {"\\times":"×","\\cdot":"·","\\div":"÷","\\pm":"±","\\le":"≤","\\leq":"≤","\\ge":"≥","\\geq":"≥","\\neq":"≠","\\ne":"≠","\\approx":"≈","\\infty":"∞",
  "\\rightarrow":"→","\\to":"→","\\leftarrow":"←","\\Rightarrow":"⇒","\\sum":"Σ","\\pi":"π","\\alpha":"α","\\beta":"β","\\theta":"θ","\\lambda":"λ","\\mu":"μ","\\sigma":"σ","\\Delta":"Δ","\\%":"%","\\,":" ","\\;":" ","\\quad":" "};
function tex(s){
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)").replace(/\\sqrt\{([^{}]*)\}/g, "√($1)").replace(/\\text\{([^{}]*)\}/g, "$1").replace(/\\mathrm\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\[A-Za-z]+|\\[%,;]/g, m=>TEX[m] ?? m);
  return s.replace(/\^\{([^{}]*)\}/g, "^$1").replace(/_\{([^{}]*)\}/g, "_$1").replace(/\s{2,}/g," ").trim();
}
function pre(src, o){
  let s = src.replace(/\r\n?/g,"\n").replace(/ /g," ");
  if(o.cite){
    s = s.replace(/【[^】\n]{0,80}】/g,"")                       // 챗GPT 출처 표시 【4:0†source】
         .replace(/[-][^\n]*?[-]/g,"").replace(/[-]/g,"") // 보이지 않는 출처 표시 문자
         .replace(/\b(?:cite|filecite|navlist)?turn\d+(?:search|news|view|file|fetch)\d+\b/g,"")
         .replace(/\[\^?\d{1,3}\](?!\()/g,"")                       // [1] [^2] 각주 번호
         .replace(/\(\[([^\]]{1,60})\]\((https?:[^)\s]+)\)\)/g, (m,t,u)=>o.link?` (${u})`:"") // ([example.com](주소)) 꼴 출처
         .replace(/^\[\^?\d{1,3}\]:.*$/gm,"");
  }
  s = s.replace(/\\\[([\s\S]+?)\\\]/g,(m,x)=>"\n\n"+tex(x)+"\n\n").replace(/\$\$([\s\S]+?)\$\$/g,(m,x)=>"\n\n"+tex(x)+"\n\n")
       .replace(/\\\((.+?)\\\)/g,(m,x)=>tex(x)).replace(/(^|[^\\$\w])\$([^$\n]{1,80}?)\$(?![\w$])/g,(m,a,x)=>/[\\^_{}]/.test(x)?a+tex(x):m);
  return s;
}
const EMO = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic})|[\u{1F3FB}-\u{1F3FF}])*️?\s?/gu;
const post = (s,o)=> o.emoji ? s.replace(EMO,"").replace(/[ \t]+\n/g,"\n") : s;

// ---- 인라인: 글자 / HTML ----
function itext(ts, o){
  return (ts||[]).map(t=>{
    switch(t.type){
      case "text": return t.tokens ? itext(t.tokens,o) : unesc(t.text);
      case "escape": return t.text;
      case "strong": case "em": case "del": return itext(t.tokens,o);
      case "codespan": return unesc(t.text);
      case "br": return "\n";
      case "link": { const x = itext(t.tokens,o), u = t.href||"";
        if(!o.link || !/^https?:|^mailto:/i.test(u) || x===u || x.replace(/^https?:\/\//,"")===u.replace(/^https?:\/\//,"")) return x || u;
        return `${x} (${u.replace(/^mailto:/i,"")})`; }
      case "image": return t.text ? `[그림: ${t.text}]` : "";
      case "html": return t.text.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"");
      case "checkbox": return "";
      default: return t.text ? unesc(t.text) : "";
    }
  }).join("");
}
const unesc = s=>String(s??"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const safeUrl = u=>/^(https?:|mailto:)/i.test(u||"") ? u : "";
function ihtml(ts, o){
  return (ts||[]).map(t=>{
    switch(t.type){
      case "text": return t.tokens ? ihtml(t.tokens,o) : esc(unesc(t.text));
      case "escape": return esc(t.text);
      case "strong": return `<b>${ihtml(t.tokens,o)}</b>`;
      case "em": return `<i>${ihtml(t.tokens,o)}</i>`;
      case "del": return `<s>${ihtml(t.tokens,o)}</s>`;
      case "codespan": return `<code style="font-family:Consolas,monospace;background:#f1f1f1;padding:0 3px">${esc(unesc(t.text))}</code>`;
      case "br": return "<br>";
      case "link": { const u = safeUrl(t.href), x = ihtml(t.tokens,o); return u ? `<a href="${esc(u)}">${x||esc(u)}</a>` : x; }
      case "image": return t.text ? esc(`[그림: ${t.text}]`) : "";
      case "html": return /^<br\s*\/?>$/i.test(t.text.trim()) ? "<br>" : esc(t.text.replace(/<[^>]+>/g,""));
      case "checkbox": return "";
      default: return esc(unesc(t.text||""));
    }
  }).join("");
}

// ---- 글자(카톡·문자) ----
const BUL = {dot:["•","◦","▪"], dash:["-","-","-"], mid:["·","·","·"]};
const cellsOf = (row,o)=>row.map(c=>itext(c.tokens,o).replace(/\n+/g," ").trim());
function tableText(t, o, mode){
  const h = cellsOf(t.header,o), rows = t.rows.map(r=>cellsOf(r,o));
  if(mode==="tab") return [h,...rows].map(r=>r.join("\t")).join("\n");
  if(mode==="pipe") return [h,...rows].map(r=>r.join(" | ")).join("\n");
  // 줄마다: 첫 칸을 머리로, 나머지는 '열: 값'
  const b = BUL[o.bul][0];
  return rows.map(r=> h.length<=1 ? `${b} ${r[0]||""}` :
    [`[${r[0]||"-"}]`, ...r.slice(1).map((v,i)=>v?`${b} ${h[i+1]||"항목"}: ${v}`:"").filter(Boolean)].join("\n")).join("\n\n");
}
function btext(ts, o, depth=0, ctx={}){
  const out = [];
  for(const t of ts||[]){
    switch(t.type){
      case "space": break;
      case "heading": { const x = itext(t.tokens,o).trim(); if(!x) break; ctx.h++;
        out.push(o.head==="sq" ? (t.depth<=2?"■ ":"□ ")+x : o.head==="br" ? `【${x}】` : x); break; }
      case "paragraph": out.push(itext(t.tokens,o).trim()); break;
      case "text": out.push(t.tokens ? itext(t.tokens,o).trim() : unesc(t.text).trim()); break;
      case "code": out.push(t.text); ctx.code++; break;
      case "blockquote": out.push(btext(t.tokens,o,depth,ctx).split("\n").map(l=>l?"│ "+l:l).join("\n")); break;
      case "hr": if(!o.hr) out.push("──────────"); break;
      case "table": ctx.tab++; ctx.rows += t.rows.length; out.push(tableText(t,o,o.table)); break;
      case "list": {
        ctx.list += t.items.length;
        const pad = "  ".repeat(depth), b = BUL[o.bul][Math.min(depth,2)];
        let n = +t.start || 1;
        const lines = t.items.map(it=>{
          const ck = it.task ? (it.checked ? "☑ " : "☐ ") : "";
          const mark = t.ordered ? `${n++}.` : (it.task ? "" : b);
          let k = 0; while(k<it.tokens.length && !["list","table","code","blockquote","heading"].includes(it.tokens[k].type)) k++;
          const head = btext(it.tokens.slice(0,k),o,depth+1,ctx).replace(/\n{2,}/g,"\n");
          const lead = pad + (mark?mark+" ":"") + ck;
          const body = head.split("\n").map((l,i)=>i?pad+"   "+l:lead+l).join("\n");
          const tail = it.tokens.slice(k).map(s=> s.type==="list" ? btext([s],o,depth+1,ctx)
            : btext([s],o,depth+1,ctx).split("\n").map(l=>l?pad+"   "+l:l).join("\n")).filter(Boolean).join("\n");
          return tail ? body + "\n" + tail : body;
        });
        out.push(lines.join(t.loose?"\n\n":"\n")); break; }
      case "html": { const x = t.text.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"").trim(); if(x) out.push(x); break; }
      case "def": break;
      default: if(t.text) out.push(unesc(t.text));
    }
  }
  return out.filter(x=>x!=="").join(depth?"\n":"\n\n");
}

// ---- HTML(한글·워드·메일) ----
const TD = 'style="border:1px solid #999;padding:4px 8px;vertical-align:top"';
const TH = 'style="border:1px solid #999;padding:4px 8px;background:#f2f2f2;font-weight:bold;text-align:left"';
function bhtml(ts, o, ctx){
  return (ts||[]).map(t=>{
    switch(t.type){
      case "space": return "";
      case "heading": ctx.h++; { const d = Math.min(Math.max(t.depth,1),4); return `<h${d}>${ihtml(t.tokens,o)}</h${d}>`; }
      case "paragraph": return `<p>${ihtml(t.tokens,o)}</p>`;
      case "text": return t.tokens ? ihtml(t.tokens,o) : esc(unesc(t.text));
      case "code": ctx.code++; return `<pre style="font-family:Consolas,monospace;background:#f6f6f6;padding:8px;white-space:pre-wrap">${esc(t.text)}</pre>`;
      case "blockquote": return `<blockquote style="border-left:3px solid #ccc;margin:0 0 0 4px;padding-left:10px;color:#444">${bhtml(t.tokens,o,ctx)}</blockquote>`;
      case "hr": return o.hr ? "" : "<hr>";
      case "table": ctx.tab++; ctx.rows += t.rows.length; {
        const al = i=>t.align[i] ? `;text-align:${t.align[i]}` : "";
        return `<table style="border-collapse:collapse;margin:6px 0"><thead><tr>${t.header.map((c,i)=>`<th ${TH.replace('text-align:left',"text-align:"+(t.align[i]||"left"))}>${ihtml(c.tokens,o)}</th>`).join("")}</tr></thead>`
          + `<tbody>${t.rows.map(r=>`<tr>${r.map((c,i)=>`<td ${TD.replace('vertical-align:top','vertical-align:top'+al(i))}>${ihtml(c.tokens,o)}</td>`).join("")}</tr>`).join("")}</tbody></table>`; }
      case "list": ctx.list += t.items.length; {
        const tag = t.ordered ? "ol" : "ul", st = t.ordered && +t.start>1 ? ` start="${+t.start}"` : "";
        return `<${tag}${st}>${t.items.map(it=>`<li>${it.task?(it.checked?"☑ ":"☐ "):""}${bhtml(it.tokens,o,ctx)}</li>`).join("")}</${tag}>`; }
      case "html": { const x = t.text.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"").trim(); return x ? `<p>${esc(x).replace(/\n/g,"<br>")}</p>` : ""; }
      default: return "";
    }
  }).join("");
}

// ---- 표만(엑셀·시트) ----
function sheets(ts, o, acc=[]){
  for(const t of ts||[]){
    if(t.type==="table") acc.push(t);
    else if(t.type==="list") t.items.forEach(it=>sheets(it.tokens,o,acc));
    else if(t.tokens && t.type==="blockquote") sheets(t.tokens,o,acc);
  }
  return acc;
}

// ---- 기호를 얼마나 지웠는지(설명용) ----
function count(src){
  return { bold: (src.match(/\*\*[^*\n]+\*\*|__[^_\n]+__/g)||[]).length, head: (src.match(/^#{1,6}\s/gm)||[]).length,
           cite: (src.match(/【[^】\n]{0,80}】|[-]/g)||[]).length };
}

let last = {text:"", html:"", plain:""};
function run(){
  const src = $("fmIn").value, o = opt();
  $("fmOptsText").hidden = o.to!=="text";
  $("fmCite").closest("label").hidden = o.to==="sheet";
  ["fmLink","fmHr"].forEach(id=>$(id).closest("label").hidden = o.to==="sheet");
  if(!src.trim()){ last={text:"",html:"",plain:""}; $("fmOut").value=""; $("fmOut").hidden=false; $("fmRich").hidden=true; $("fmFound").textContent=""; $("fmHint").textContent="";
    $("fmStatus").textContent="글을 넣으면 바로 정리합니다."; $("fmCopy").disabled=$("fmDown").disabled=true; return; }
  if(!window.marked){ $("fmStatus").textContent="정리 프로그램을 준비하는 중입니다…"; load().then(run).catch(()=>$("fmStatus").textContent="정리 프로그램을 받지 못했습니다. 새로 고침해 주세요."); return; }
  const tok = window.marked.lexer(pre(src,o), {gfm:true, breaks:false});
  const ctx = {h:0, list:0, tab:0, rows:0, code:0}, c = count(src);
  let msg;
  if(o.to==="text"){
    last.text = post(btext(tok,o,0,ctx),o).replace(/[ \t]+$/gm,"").replace(/\n{3,}/g,"\n\n").trim();
    last.plain = last.text; last.html = "";
    $("fmOut").value = last.text; $("fmOut").hidden=false; $("fmRich").hidden=true;
    msg = "카톡·문자에 붙일 글자만 남겼습니다.";
  }else if(o.to==="rich"){
    last.html = post(bhtml(tok,o,ctx),o); last.plain = post(btext(tok,Object.assign({},o,{head:"none",table:"tab"}),0,{h:0,list:0,tab:0,rows:0,code:0}),o).replace(/\n{3,}/g,"\n\n").trim();
    $("fmRich").innerHTML = last.html; $("fmRich").hidden=false; $("fmOut").hidden=true;
    msg = "한글·워드·메일에 서식째 붙일 수 있습니다. 아래 모습대로 복사됩니다.";
  }else{
    const tabs = sheets(tok,o);
    if(!tabs.length){ last={text:"",html:"",plain:""}; $("fmOut").value=""; $("fmOut").hidden=false; $("fmRich").hidden=true;
      $("fmStatus").textContent="표를 찾지 못했습니다. AI 답에 | 로 된 표가 있는지 확인하세요."; $("fmCopy").disabled=$("fmDown").disabled=true; $("fmFound").textContent=""; $("fmHint").textContent=""; return; }
    ctx.tab = tabs.length; ctx.rows = tabs.reduce((n,t)=>n+t.rows.length,0);
    last.plain = tabs.map(t=>tableText(t,o,"tab")).join("\n\n"); last.text = last.plain;
    last.html = bhtml(tabs,o,{h:0,list:0,tab:0,rows:0,code:0});
    $("fmRich").innerHTML = last.html; $("fmRich").hidden=false; $("fmOut").hidden=true;
    msg = tabs.length>1 ? `표 ${tabs.length}개를 뽑았습니다. 엑셀·구글 시트의 칸 하나를 누르고 붙여 넣으세요.` : "표를 뽑았습니다. 엑셀·구글 시트의 칸 하나를 누르고 붙여 넣으세요.";
  }
  const f = [c.head||ctx.h ? `제목 ${ctx.h}개` : "", c.bold ? `굵게 표시 ${c.bold}곳` : "", ctx.list ? `목록 ${ctx.list}줄` : "", ctx.tab ? `표 ${ctx.tab}개(${ctx.rows}줄)` : "", o.cite&&c.cite ? `출처 표시 ${c.cite}곳` : ""].filter(Boolean);
  $("fmFound").textContent = f.length ? "찾은 것: " + f.join(" · ") : "마크다운 기호가 거의 없는 글입니다";
  $("fmStatus").textContent = msg;
  $("fmHint").textContent = o.to==="text" ? "고칠 곳이 있으면 결과 칸에서 바로 고친 뒤 복사하세요." : "글꼴과 글자 크기는 붙여 넣는 문서의 설정을 따릅니다.";
  $("fmCopy").disabled = $("fmDown").disabled = false;
}

async function copy(){
  const o = opt();
  const txt = o.to==="text" ? $("fmOut").value : last.plain;
  if(o.to!=="text" && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write){
    const doc = `<meta charset="utf-8"><div style="font-family:'Malgun Gothic',sans-serif">${last.html}</div>`;
    try{ await navigator.clipboard.write([new ClipboardItem({"text/html": new Blob([doc],{type:"text/html"}), "text/plain": new Blob([txt],{type:"text/plain"})})]); toast("서식째 복사했습니다"); return; }catch(_){}
  }
  if(o.to!=="text"){ // 서식 복사가 막힌 브라우저: 미리 보기 영역을 골라 복사
    try{ const r=document.createRange(); r.selectNodeContents($("fmRich")); const s=getSelection(); s.removeAllRanges(); s.addRange(r); const ok=document.execCommand("copy"); s.removeAllRanges(); if(ok){ toast("서식째 복사했습니다"); return; } }catch(_){}
  }
  try{ await navigator.clipboard.writeText(txt); toast("복사했습니다"); }
  catch(_){ const ta=$("fmOut"); const h=ta.hidden; ta.hidden=false; ta.value=txt; ta.select(); document.execCommand("copy"); ta.hidden=h; toast("복사했습니다"); }
}
function down(){
  const o = opt(), isHtml = o.to==="rich";
  const body = isHtml ? `<!doctype html><meta charset="utf-8"><title>정리한 글</title><body style="font-family:'Malgun Gothic',sans-serif;line-height:1.6">${last.html}</body>` : (o.to==="text" ? $("fmOut").value : last.plain);
  const b = new Blob([isHtml ? body : "﻿"+body], {type: isHtml ? "text/html" : (o.to==="sheet" ? "text/tab-separated-values" : "text/plain")});
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = isHtml ? "정리한글.html" : o.to==="sheet" ? "표.tsv" : "정리한글.txt"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}

const SAMPLE = `## 📌 주간 업무 보고 요약

이번 주 **핵심 결과**는 세 가지입니다.【4:0†source】

1. **신규 고객 12곳** 계약 완료
2. 앱 오류 신고 *30% 감소*
   - 로그인 오류 수정
   - 결제 화면 속도 개선
3. 다음 주 출시 일정 확정

---

### 팀별 진행 상황

| 팀 | 이번 주 | 다음 주 |
|---|---|---|
| 영업 | 계약 12건 | 제안서 5건 |
| 개발 | 오류 18건 수정 | 2.4 버전 출시 |
| 마케팅 | 광고 시안 3개 | 인스타 캠페인 |

> **참고:** 자세한 수치는 [대시보드](https://example.com/dashboard)에서 볼 수 있습니다.

✅ 확인이 필요한 일: \`예산 승인\`(금요일까지)`;

let tm;
$("fmIn").addEventListener("input", ()=>{ clearTimeout(tm); tm=setTimeout(run,120); });
document.querySelectorAll('input[name=fmTo]').forEach(r=>r.addEventListener("change", run));
["fmHead","fmBul","fmTable","fmCite","fmEmoji","fmLink","fmHr"].forEach(id=>$(id).addEventListener("change", run));
$("fmSample").addEventListener("click", ()=>{ $("fmIn").value = SAMPLE; run(); });
$("fmClear").addEventListener("click", ()=>{ $("fmIn").value = ""; run(); $("fmIn").focus(); });
$("fmCopy").addEventListener("click", copy);
$("fmDown").addEventListener("click", down);
load().then(()=>{ if($("fmIn").value.trim()) run(); }).catch(()=>{});
run();
})();

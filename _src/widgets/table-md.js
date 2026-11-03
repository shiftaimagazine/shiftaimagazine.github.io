// SHIFT AI 무료 도구 — 엑셀·CSV → 마크다운 표. 붙여 넣은 칸(탭)·CSV·.xlsx 를 이 브라우저 안에서 읽는다.
// .xlsx 는 /lib/jszip/(MIT)로 압축을 풀어 XML 을 직접 읽는다(공유 문자열·날짜 서식·합친 칸). 토큰 수는 /lib/gpt-tokenizer/o200k.js(MIT).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("tmIn")) return;
const ZIP = "/lib/jszip/jszip.min.js", TOK = "/lib/gpt-tokenizer/o200k.js";
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
let book = null;      // .xlsx: {sheets:[{name, rows, merges}]}
let grid = null, off = new Set(), fname = "표";

// ---------- CSV·탭 ----------
function parseDelim(s){
  s = s.replace(/^﻿/,"").replace(/\r\n?/g,"\n");
  const first = s.split("\n").slice(0,5).join("\n"), cnt = ch=>(first.match(new RegExp(ch==="|"?"\\|":ch,"g"))||[]).length;
  const d = cnt("\t") ? "\t" : (cnt(";") > cnt(",") ? ";" : ",");
  const rows = []; let row = [], cell = "", q = false;
  for(let i=0;i<s.length;i++){
    const c = s[i];
    if(q){ if(c==='"'){ if(s[i+1]==='"'){ cell+='"'; i++; } else q = false; } else cell += c; continue; }
    if(c==='"' && cell==="") { q = true; continue; }
    if(c===d){ row.push(cell); cell=""; continue; }
    if(c==="\n"){ row.push(cell); rows.push(row); row=[]; cell=""; continue; }
    cell += c;
  }
  if(cell!=="" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
// 이미 마크다운 표면 그대로 읽기(다시 정리용)
function parseMd(s){
  const ls = s.trim().split(/\r?\n/).filter(l=>l.trim());
  if(ls.length<2 || !/^\s*\|/.test(ls[0]) || !/^\s*\|?\s*:?-{2,}/.test(ls[1])) return null;
  const cut = l=>l.trim().replace(/^\|/,"").replace(/\|$/,"").split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,"|"));
  return [cut(ls[0]), ...ls.slice(2).map(cut)];
}

// ---------- .xlsx ----------
const colN = s=>{ let n=0; for(const ch of s) n = n*26 + ch.charCodeAt(0)-64; return n-1; };
const xml = s=>new DOMParser().parseFromString(s, "application/xml");
const kids = (el, name)=>Array.from(el.getElementsByTagNameNS("*", name));
const DATE_ID = new Set([14,15,16,17,18,19,20,21,22,27,30,36,45,46,47,50,57]);
function serialDate(v, d1904, kind){
  const ms = Math.round(((d1904 ? v + 1462 : v) - 25569) * 86400000), d = new Date(ms), p = n=>String(n).padStart(2,"0");
  const ymd = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`, hm = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  return kind==="t" ? hm : kind==="dt" ? `${ymd} ${hm}` : ymd;
}
async function readXlsx(buf){
  await script(ZIP, ()=>!!window.JSZip);
  const z = await JSZip.loadAsync(buf), get = p=>z.file(p) ? z.file(p).async("string") : Promise.resolve(null);
  const wb = xml(await get("xl/workbook.xml")), rels = xml(await get("xl/_rels/workbook.xml.rels") || "<r/>");
  const d1904 = kids(wb,"workbookPr").some(e=>/^(1|true)$/.test(e.getAttribute("date1904")||""));
  const relMap = {}; kids(rels,"Relationship").forEach(r=>relMap[r.getAttribute("Id")] = r.getAttribute("Target"));
  const ss = []; const sx = await get("xl/sharedStrings.xml");
  if(sx) kids(xml(sx),"si").forEach(si=>ss.push(kids(si,"t").filter(t=>t.parentNode.localName!=="rPh").map(t=>t.textContent).join("")));
  // 날짜 서식
  const dateFmt = []; const st = await get("xl/styles.xml");
  if(st){ const S = xml(st), custom = {};
    kids(S,"numFmt").forEach(f=>custom[f.getAttribute("numFmtId")] = f.getAttribute("formatCode")||"");
    const xfs = kids(S,"cellXfs")[0]; if(xfs) kids(xfs,"xf").forEach(x=>{ const id = +x.getAttribute("numFmtId"), code = (custom[id]||"").replace(/"[^"]*"|\[[^\]]*\]|\\./g,"");
      dateFmt.push(DATE_ID.has(id) ? ((id>=18&&id<=21)||id===45||id===46||id===47 ? "t" : id===22 ? "dt" : "d")
        : /[yd]/i.test(code) ? (/h/i.test(code) ? "dt" : "d") : /h|ss/i.test(code) ? "t" : /%/.test(code)||id===9||id===10 ? "%" : ""); }); }
  const sheets = [];
  for(const s of kids(wb,"sheet")){
    const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    let path = relMap[rid] || ""; path = path.startsWith("/") ? path.slice(1) : "xl/" + path.replace(/^\.\//,"");
    const sx2 = await get(path); if(!sx2) continue;
    const D = xml(sx2), rows = [];
    kids(D,"row").forEach((r, ri)=>{
      const rn = (+r.getAttribute("r") || ri+1) - 1, row = rows[rn] = rows[rn] || [];
      kids(r,"c").forEach((c, ci)=>{
        const ref = c.getAttribute("r"), col = ref ? colN(ref.replace(/\d+/g,"")) : ci, t = c.getAttribute("t"), sIdx = +(c.getAttribute("s")||0);
        const v = kids(c,"v")[0], is = kids(c,"is")[0]; let val = "";
        if(t==="s") val = v ? ss[+v.textContent] ?? "" : "";
        else if(t==="inlineStr") val = is ? kids(is,"t").map(x=>x.textContent).join("") : "";
        else if(t==="b") val = v ? (v.textContent==="1" ? "TRUE" : "FALSE") : "";
        else if(t==="str" || t==="e") val = v ? v.textContent : "";
        else if(v){ const n = +v.textContent, k = dateFmt[sIdx];
          val = isNaN(n) ? v.textContent : k==="d"||k==="t"||k==="dt" ? serialDate(n, d1904, k) : k==="%" ? +(n*100).toPrecision(12)+"%" : String(+n.toPrecision(15)); }
        row[col] = val;
      });
    });
    const merges = kids(D,"mergeCell").map(m=>{ const [a,b] = (m.getAttribute("ref")||"").split(":"); if(!b) return null;
      const p = x=>[ +x.replace(/[A-Z]+/,"")-1, colN(x.replace(/\d+/g,"")) ]; return [...p(a), ...p(b)]; }).filter(Boolean);
    sheets.push({name: s.getAttribute("name") || `시트${sheets.length+1}`, rows: Array.from(rows, r=>Array.from(r||[], x=>x??"")), merges});
  }
  return {sheets};
}
function sheetGrid(sh){
  const rows = sh.rows.map(r=>r.slice());
  if($("tmMerge").checked) sh.merges.forEach(([r0,c0,r1,c1])=>{ const v = (rows[r0]||[])[c0] ?? "";
    for(let r=r0;r<=r1;r++){ rows[r] = rows[r] || []; for(let c=c0;c<=c1;c++) if(r!==r0||c!==c0) rows[r][c] = v; } });
  return rows;
}

// ---------- 마크다운 만들기 ----------
const wide = s=>{ let n=0; for(const ch of s) n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{1F300}-\u{1FAFF}]/u.test(ch) ? 2 : 1; return n; };
const isNum = s=>/^[-+]?[\d,]*\.?\d+(?:[eE][-+]?\d+)?%?$/.test(s.replace(/^[₩$€¥]/,"").trim()) && /\d/.test(s);
function build(){
  if(!grid) return null;
  let rows = grid.map(r=>r.map(x=>String(x??"").trim()));
  const w = Math.max(0, ...rows.map(r=>r.length)); rows = rows.map(r=>{ const o = r.slice(); while(o.length<w) o.push(""); return o; });
  if($("tmEmpty").checked){ rows = rows.filter(r=>r.some(x=>x!==""));
    const keep = Array.from({length:w},(_,c)=>rows.some(r=>r[c]!=="")); rows = rows.map(r=>r.filter((_,c)=>keep[c])); }
  if(!rows.length || !rows[0].length) return null;
  const hasHead = $("tmHead").checked;
  let head = hasHead ? rows[0] : rows[0].map((_,i)=>`열${i+1}`), body = hasHead ? rows.slice(1) : rows;
  head = head.map((h,i)=>h || `열${i+1}`);
  const cols = head.map((h,i)=>({h, i})), use = cols.filter(c=>!off.has(c.h+"#"+c.i));
  const total = body.length, mx = +$("tmMax").value; if(mx && body.length>mx) body = body.slice(0,mx);
  const br = $("tmBr").value==="br" ? "<br>" : " ";
  const cell = s=>s.replace(/\|/g,"\\|").replace(/\n+/g, br);
  const H = use.map(c=>cell(c.h)), B = body.map(r=>use.map(c=>cell(r[c.i]||"")));
  const right = use.map(c=>$("tmNum").checked && body.length && body.filter(r=>r[c.i]!=="").length>0 && body.filter(r=>r[c.i]!=="").every(r=>isNum(r[c.i])));
  const pad = $("tmPad").checked, W = use.map((_,k)=>Math.max(3, wide(H[k]), ...B.map(r=>wide(r[k]))));
  const fit = (s,k)=>pad ? (right[k] ? " ".repeat(W[k]-wide(s)) + s : s + " ".repeat(W[k]-wide(s))) : s;
  const sep = use.map((_,k)=>{ const n = pad ? W[k] : 3; return right[k] ? "-".repeat(n-1)+":" : "-".repeat(n); });
  const line = a=>"| " + a.join(" | ") + " |";
  let md = [line(H.map(fit)), line(sep), ...B.map(r=>line(r.map(fit)))].join("\n");
  if(mx && total>mx) md += `\n\n(전체 ${total}행 중 앞 ${mx}행)`;
  if($("tmNote").checked) md = `아래는 ${book && book.sheets.length ? `'${$("tmSheet").selectedOptions[0]?.textContent||fname}' 시트` : `'${fname}'`} 표입니다. ${Math.min(total, mx||total)}행 × ${use.length}열이고 첫 줄은 열 이름입니다.\n\n` + md;
  return {md, head, use, body, total, cols};
}
function preview(r){
  const H = r.use.map(c=>`<th>${esc(c.h)}</th>`).join(""), B = r.body.slice(0,50).map(row=>`<tr>${r.use.map(c=>`<td>${esc(row[c.i]||"")}</td>`).join("")}</tr>`).join("");
  $("tmPrev").innerHTML = `<table><thead><tr>${H}</tr></thead><tbody>${B}</tbody></table>` + (r.body.length>50 ? `<p class="hint">미리 보기는 50행까지만 보여 줍니다.</p>` : "");
}
let tokT, tokLoading = null;
function run(){
  const r = build();
  if(!r){ $("tmOut").value = ""; $("tmCopy").disabled = $("tmDown").disabled = true; $("tmColsW").hidden = true; $("tmPrevW").hidden = true; $("tmTok").textContent = "";
    $("tmStatus").textContent = grid ? "표에 값이 없습니다." : "표를 넣으면 바로 바꿉니다."; return; }
  $("tmOut").value = r.md; $("tmCopy").disabled = $("tmDown").disabled = false;
  $("tmColsW").hidden = r.cols.length < 2;
  $("tmCols").innerHTML = r.cols.map(c=>`<button type="button" data-k="${esc(c.h+"#"+c.i)}" aria-pressed="${!off.has(c.h+"#"+c.i)}">${esc(c.h)}</button>`).join("");
  $("tmStatus").textContent = `${r.total}행 × ${r.use.length}열${r.use.length<r.cols.length?` (전체 ${r.cols.length}열 중)`:""}`;
  $("tmPrevW").hidden = false; preview(r);
  clearTimeout(tokT); tokT = setTimeout(()=>{
    const chars = r.md.length;
    $("tmTok").textContent = `${chars.toLocaleString()}자`;
    (window.SHIFT_O200K ? Promise.resolve() : (tokLoading = tokLoading || script(TOK, ()=>!!window.SHIFT_O200K))).then(()=>{
      const n = window.SHIFT_O200K.countTokens($("tmOut").value); $("tmTok").textContent = `${$("tmOut").value.length.toLocaleString()}자 · 약 ${n.toLocaleString()}토큰(GPT o200k 기준)`; }).catch(()=>{});
  }, 250);
}
function fromText(){
  const s = $("tmIn").value; book = null; $("tmSheetW").hidden = true;
  if(!s.trim()){ grid = null; $("tmFound").textContent = ""; run(); return; }
  const md = parseMd(s);
  grid = md || parseDelim(s);
  $("tmFound").textContent = md ? "마크다운 표를 다시 정리합니다" : /\t/.test(s.split("\n")[0]) ? "엑셀·시트에서 복사한 표" : "CSV 글";
  run();
}
async function fromFile(f){
  fname = f.name.replace(/\.[^.]+$/,""); off.clear();
  try{
    const buf = await f.arrayBuffer(), u = new Uint8Array(buf);
    if(u[0]===0xD0 && u[1]===0xCF) throw new Error("옛 엑셀(.xls) 파일입니다. 엑셀에서 .xlsx나 CSV로 저장한 뒤 넣어 주세요.");
    if(u[0]===0x50 && u[1]===0x4B){
      $("tmFound").textContent = "엑셀 파일을 여는 중…"; book = await readXlsx(buf);
      if(!book.sheets.length) throw new Error("시트를 찾지 못했습니다.");
      $("tmSheet").innerHTML = book.sheets.map((s,i)=>`<option value="${i}">${esc(s.name)} (${s.rows.filter(r=>r.some(x=>x!=="")).length}행)</option>`).join("");
      const first = Math.max(0, book.sheets.findIndex(s=>s.rows.some(r=>r.some(x=>x!==""))));
      $("tmSheet").value = first; $("tmSheetW").hidden = book.sheets.length<2;
      grid = sheetGrid(book.sheets[first]); $("tmIn").value = ""; $("tmFound").textContent = `${f.name} · 시트 ${book.sheets.length}개`; run(); return;
    }
    let s; try{ s = new TextDecoder("utf-8", {fatal:true}).decode(u); }catch(_){ s = new TextDecoder("euc-kr").decode(u); toast("EUC-KR(한국어 엑셀) 파일로 읽었습니다"); }
    $("tmIn").value = s; fromText(); $("tmFound").textContent = f.name;
  }catch(e){ grid = null; book = null; $("tmFound").textContent = ""; $("tmStatus").textContent = e.message || "파일을 읽지 못했습니다."; run(); $("tmStatus").textContent = e.message || "파일을 읽지 못했습니다."; }
}
const SAMPLE = "지점\t담당자\t10월 매출(만원)\t전월 대비\t메모\n강남점\t김민지\t4,820\t12%\t신메뉴 반응 좋음\n홍대점\t이준호\t3,150\t-4%\t\n판교점\t박서연\t5,310\t8%\t평일 점심 붐빔\n\n수원점\t최지훈\t2,740\t3%\t리모델링 | 11월 재개장";

let tm;
$("tmIn").addEventListener("input", ()=>{ clearTimeout(tm); tm = setTimeout(()=>{ fname = "표"; off.clear(); fromText(); }, 150); });
$("tmFile").addEventListener("change", e=>{ const f = e.target.files[0]; if(f) fromFile(f); e.target.value = ""; });
const ta = $("tmIn");
ta.addEventListener("dragover", e=>e.preventDefault());
ta.addEventListener("drop", e=>{ const f = e.dataTransfer.files[0]; if(f){ e.preventDefault(); fromFile(f); } });
$("tmSheet").addEventListener("change", ()=>{ off.clear(); grid = sheetGrid(book.sheets[+$("tmSheet").value]); run(); });
["tmHead","tmEmpty","tmNum","tmPad","tmNote","tmMax","tmBr"].forEach(id=>$(id).addEventListener("change", run));
$("tmMerge").addEventListener("change", ()=>{ if(book) grid = sheetGrid(book.sheets[+$("tmSheet").value]); run(); });
$("tmCols").addEventListener("click", e=>{ const b = e.target.closest("button[data-k]"); if(!b) return; const k = b.dataset.k;
  if(off.has(k)) off.delete(k); else { const r = build(); if(r && r.use.length<=1) return toast("열을 하나는 남겨야 합니다"); off.add(k); } run(); });
$("tmSample").addEventListener("click", ()=>{ $("tmIn").value = SAMPLE; fname = "지점별 매출"; off.clear(); fromText(); });
$("tmClear").addEventListener("click", ()=>{ $("tmIn").value = ""; book = null; grid = null; off.clear(); $("tmSheetW").hidden = true; fromText(); });
$("tmCopy").addEventListener("click", ()=>{ const t = $("tmOut").value; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast("복사했습니다")).catch(()=>{ $("tmOut").select(); document.execCommand("copy"); toast("복사했습니다"); }); });
$("tmDown").addEventListener("click", ()=>{ const b = new Blob([$("tmOut").value+"\n"], {type:"text/markdown"}), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = (fname||"표")+".md"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000); });
run();
})();

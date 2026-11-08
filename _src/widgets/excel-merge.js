// SHIFT AI 무료 도구 — 엑셀 합치기. 여러 .xlsx·.csv 파일과 시트를 한 시트로 잇거나 한 파일에 시트로 모은다.
// .xlsx 는 /lib/jszip/(MIT)로 압축을 풀어 XML 을 직접 읽고(공유 문자열·날짜 서식·합친 칸), 결과 .xlsx 도 같은 JSZip 으로 직접 쓴다.
// 파일은 이 브라우저 안에서만 처리하고 어디에도 보내지 않는다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("xmDrop")) return;
const ZIP = "/lib/jszip/jszip.min.js", MAXF = 50, MAXROWS = 1048576;
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2000); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다. 새로 고침해 주세요.")); document.head.appendChild(s); });
const zipLib = ()=>script(ZIP, ()=>!!window.JSZip).then(()=>window.JSZip);
const job = ()=>document.querySelector("input[name=xmJob]:checked").value;
const kb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
let files = [], busy = false;   // {name, size, sheets:[{name, rows:[[cell]]}], err}

// 칸 값: 문자열 | 숫자 | true/false | {d: 엑셀 날짜 일련번호, k: "d"|"dt"|"t"}
const isDate = v=>v && typeof v==="object" && "d" in v;
const blank = v=>v==null || v==="" ;
function show(v){
  if(blank(v)) return "";
  if(isDate(v)){ const ms = Math.round((v.d - 25569) * 86400000), d = new Date(ms), p = n=>String(n).padStart(2,"0");
    const ymd = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`, hm = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
    return v.k==="t" ? hm : v.k==="dt" ? `${ymd} ${hm}` : ymd; }
  if(typeof v==="boolean") return v ? "TRUE" : "FALSE";
  if(typeof v==="number") return String(+v.toPrecision(15));
  return String(v);
}
const keyOf = v=>isDate(v) ? "d"+v.d : typeof v + ":" + show(v);

// ---------- 읽기: CSV ----------
function decode(buf){
  try{ return new TextDecoder("utf-8", {fatal:true}).decode(buf); }catch(e){ return new TextDecoder("euc-kr").decode(buf); }
}
function parseDelim(s, tsv){
  s = s.replace(/^﻿/,"").replace(/\r\n?/g,"\n");
  const first = s.split("\n").slice(0,5).join("\n"), cnt = ch=>first.split(ch).length - 1;
  const d = tsv || cnt("\t")>cnt(",") ? "\t" : (cnt(";") > cnt(",") ? ";" : ",");
  const rows = []; let row = [], cell = "", q = false, quoted = false;
  const put = ()=>{ row.push(quoted ? cell : num(cell)); cell = ""; quoted = false; };
  for(let i=0;i<s.length;i++){
    const c = s[i];
    if(q){ if(c==='"'){ if(s[i+1]==='"'){ cell+='"'; i++; } else q = false; } else cell += c; continue; }
    if(c==='"' && cell===""){ q = true; quoted = true; continue; }
    if(c===d){ put(); continue; }
    if(c==="\n"){ put(); rows.push(row); row=[]; continue; }
    cell += c;
  }
  if(cell!=="" || row.length){ put(); rows.push(row); }
  return rows;
}
// CSV 숫자: 앞자리 0(우편번호·전화번호)이나 쉼표가 든 값은 글자로 둔다(엑셀에서 0이 사라지지 않게)
const num = s=>{
  if(/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(s)) return +s;
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\.?$/);   // 2026-11-03 같은 날짜는 엑셀 날짜로
  if(m && +m[2]>=1 && +m[2]<=12 && +m[3]>=1 && +m[3]<=31) return {d: (Date.UTC(+m[1], +m[2]-1, +m[3]) - Date.UTC(1899,11,30)) / 86400000, k:"d"};
  return s;
};

// ---------- 읽기: .xlsx ----------
const colN = s=>{ let n=0; for(const ch of s) n = n*26 + ch.charCodeAt(0)-64; return n-1; };
const xml = s=>new DOMParser().parseFromString(s, "application/xml");
const kids = (el, name)=>Array.from(el.getElementsByTagNameNS("*", name));
const DATE_ID = new Set([14,15,16,17,18,19,20,21,22,27,30,36,45,46,47,50,57]);
async function readXlsx(buf){
  const JSZip = await zipLib();
  const z = await JSZip.loadAsync(buf).catch(()=>{ throw new Error("파일을 열지 못했습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다."); });
  const get = p=>z.file(p) ? z.file(p).async("string") : Promise.resolve(null);
  const wbx = await get("xl/workbook.xml"); if(!wbx) throw new Error("엑셀 파일이 아닙니다.");
  const wb = xml(wbx), rels = xml(await get("xl/_rels/workbook.xml.rels") || "<r/>");
  const d1904 = kids(wb,"workbookPr").some(e=>/^(1|true)$/.test(e.getAttribute("date1904")||""));
  const relMap = {}; kids(rels,"Relationship").forEach(r=>relMap[r.getAttribute("Id")] = r.getAttribute("Target"));
  const ss = []; const sx = await get("xl/sharedStrings.xml");
  if(sx) kids(xml(sx),"si").forEach(si=>ss.push(kids(si,"t").filter(t=>t.parentNode.localName!=="rPh").map(t=>t.textContent).join("")));
  const fmt = []; const st = await get("xl/styles.xml");
  if(st){ const S = xml(st), custom = {};
    kids(S,"numFmt").forEach(f=>custom[f.getAttribute("numFmtId")] = f.getAttribute("formatCode")||"");
    const xfs = kids(S,"cellXfs")[0]; if(xfs) kids(xfs,"xf").forEach(x=>{ const id = +x.getAttribute("numFmtId"), code = (custom[id]||"").replace(/"[^"]*"|\[[^\]]*\]|\\./g,"");
      fmt.push(DATE_ID.has(id) ? ((id>=18&&id<=21)||id===45||id===46||id===47 ? "t" : id===22 ? "dt" : "d")
        : /[yd]/i.test(code) ? (/h/i.test(code) ? "dt" : "d") : /h|ss/i.test(code) ? "t" : ""); }); }
  const sheets = [];
  for(const s of kids(wb,"sheet")){
    if(/hidden/i.test(s.getAttribute("state")||"")) continue;   // 숨긴 시트는 뺀다
    const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    let path = relMap[rid] || ""; path = path.startsWith("/") ? path.slice(1) : "xl/" + path.replace(/^\.\//,"");
    const sx2 = await get(path); if(!sx2) continue;   // 차트 시트 등
    const D = xml(sx2), rows = [];
    kids(D,"row").forEach((r, ri)=>{
      const rn = (+r.getAttribute("r") || ri+1) - 1; if(rn>=MAXROWS) return;
      const row = rows[rn] = rows[rn] || [];
      kids(r,"c").forEach((c, ci)=>{
        const ref = c.getAttribute("r"), col = ref ? colN(ref.replace(/\d+/g,"")) : ci, t = c.getAttribute("t"), sIdx = +(c.getAttribute("s")||0);
        const v = kids(c,"v")[0], is = kids(c,"is")[0]; let val = "";
        if(t==="s") val = v ? ss[+v.textContent] ?? "" : "";
        else if(t==="inlineStr") val = is ? kids(is,"t").map(x=>x.textContent).join("") : "";
        else if(t==="b") val = v ? v.textContent==="1" : "";
        else if(t==="str" || t==="e") val = v ? v.textContent : "";
        else if(v){ const n = +v.textContent, k = fmt[sIdx];
          val = isNaN(n) ? v.textContent : (k==="d"||k==="t"||k==="dt") ? {d: d1904 ? n + 1462 : n, k} : n; }
        row[col] = val;
      });
    });
    sheets.push({name: s.getAttribute("name") || `시트${sheets.length+1}`, rows: Array.from(rows, r=>Array.from(r||[], x=>x??""))});
  }
  return sheets;
}
async function readFile(f){
  const buf = await f.arrayBuffer(), u = new Uint8Array(buf.slice(0,4)), ext = ((f.name.match(/\.([a-z0-9]+)$/i)||[])[1]||"").toLowerCase();
  if(u[0]===0xD0 && u[1]===0xCF) throw new Error("옛 엑셀(.xls)이거나 암호가 걸린 파일입니다. 엑셀에서 .xlsx로 저장해 넣어 주세요.");
  if(u[0]===0x50 && u[1]===0x4B) return await readXlsx(buf);
  if(["csv","tsv","txt"].includes(ext)) return [{name: f.name.replace(/\.[^.]+$/,""), rows: parseDelim(decode(buf), ext==="tsv")}];
  throw new Error(".xlsx·.xlsm·.csv 파일만 넣을 수 있습니다.");
}

// ---------- 합치기 ----------
const trimRow = r=>{ let n = r.length; while(n && blank(r[n-1])) n--; return r.slice(0,n); };
const emptyRow = r=>r.every(blank);
const TOTAL = /^\s*(합\s*계|소\s*계|총\s*계|누\s*계|total|subtotal|sum)\s*$/i;
function headIdx(rows){
  const h = $("xmHead").value;
  if(h==="0") return -1;
  if(h!=="auto") return Math.min(+h - 1, Math.max(0, rows.length-1));
  // 위쪽 10줄 가운데 글자 칸이 가장 많은 줄(같으면 위쪽)
  let best = 0, bn = -1;
  rows.slice(0,10).forEach((r,i)=>{ const n = (r||[]).filter(v=>typeof v==="string" && v.trim()).length; if(n>bn){ bn = n; best = i; } });
  return best;
}
const normH = s=>show(s).replace(/\s+/g," ").trim();
function sources(){
  const which = $("xmSheets").value, out = [];
  files.filter(f=>!f.err).forEach(f=>f.sheets.forEach((s,i)=>{
    if(which==="first" && i>0) return;
    if(which.startsWith("n:") && s.name!==which.slice(2)) return;
    if(!s.rows.some(r=>r && !emptyRow(r))) return;
    out.push({file:f.name, sheet:s.name, rows:s.rows});
  }));
  return out;
}
function stack(){
  const src = sources(), byName = $("xmMatch").value==="name";
  const cols = [], idx = new Map(), have = new Map(), body = [], seen = new Set();
  let dropped = {empty:0, total:0, dup:0};
  const colFor = (name, pos)=>{
    const k = byName ? name : "#"+pos;
    if(!idx.has(k)){ idx.set(k, cols.length); cols.push(byName ? name : (name || `열${pos+1}`)); }
    return idx.get(k);
  };
  for(const s of src){
    const rows = s.rows.map(r=>trimRow(r||[]));
    const hi = headIdx(rows), H = hi>=0 ? (rows[hi]||[]) : [];
    const width = Math.max(H.length, ...rows.slice(hi+1).map(r=>r.length), 0);
    const names = [], dupN = {};
    for(let c=0;c<width;c++){
      let n = normH(H[c]) || `열${c+1}`;
      if(dupN[n]){ dupN[n]++; n = `${n} (${dupN[n]})`; } else dupN[n] = 1;
      names.push(n);
    }
    const map = names.map((n,c)=>{ const j = colFor(n, c); have.set(j, (have.get(j)||0) + 1); return j; });
    for(const r of rows.slice(hi+1)){
      if(!r.length || emptyRow(r)){ if($("xmEmpty").checked){ dropped.empty++; continue; } }
      const first = r.find(v=>!blank(v));
      if($("xmTotal").checked && typeof first==="string" && TOTAL.test(first)){ dropped.total++; continue; }
      const o = []; r.forEach((v,c)=>{ if(!blank(v)) o[map[c]] = v; });
      if($("xmDup").checked){ const k = Array.from({length:cols.length},(_,i)=>blank(o[i]) ? "" : keyOf(o[i])).join("\u0001"); if(seen.has(k)){ dropped.dup++; continue; } seen.add(k); }
      body.push({f:s.file, s:s.sheet, v:o});
      if(body.length>=MAXROWS-1) break;
    }
  }
  const pre = [...($("xmSrcF").checked ? ["파일 이름"] : []), ...($("xmSrcS").checked ? ["시트 이름"] : [])];
  const head = [...pre, ...cols];
  const rows = body.map(b=>[...($("xmSrcF").checked ? [b.f] : []), ...($("xmSrcS").checked ? [b.s] : []), ...Array.from({length:cols.length},(_,i)=>b.v[i] ?? "")]);
  const partial = byName ? cols.map((c,i)=>({c, n:have.get(i)||0})).filter(x=>x.n<src.length) : [];
  return {head, rows, n:src.length, partial, dropped, srcHeads: src.length};
}
// 시트 이름: 31자, \ / ? * [ ] : 금지, 겹치면 (2)
function sheetNames(list){
  const used = new Set();
  return list.map(n=>{
    let b = String(n).replace(/[\\/?*[\]:]/g,"_").replace(/^'+|'+$/g,"").trim() || "시트";
    b = Array.from(b).slice(0,31).join(""); let x = b, k = 2;
    while(used.has(x.toLowerCase())){ const t = ` (${k++})`; x = Array.from(b).slice(0,31-t.length).join("") + t; }
    used.add(x.toLowerCase()); return x;
  });
}
function book(){
  const out = [];
  files.filter(f=>!f.err).forEach(f=>{
    const base = f.name.replace(/\.[^.]+$/,""), ss = f.sheets.filter(s=>s.rows.some(r=>r && !emptyRow(r)));
    ss.forEach(s=>out.push({name: ss.length>1 ? `${base}-${s.name}` : base, rows: s.rows.map(r=>trimRow(r||[]))}));
  });
  const nm = sheetNames(out.map(s=>s.name)); out.forEach((s,i)=>s.name = nm[i]);
  return out;
}

// ---------- 쓰기: .xlsx ----------
const xesc = s=>String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g,"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const colL = n=>{ let s = ""; n++; while(n){ const m = (n-1)%26; s = String.fromCharCode(65+m) + s; n = Math.floor((n-1)/26); } return s; };
const wide = s=>{ let n=0; for(const ch of s) n += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1; return n; };
function sheetXml(rows, head){
  const w = Math.max(0, ...rows.map(r=>r.length)), widths = Array(w).fill(8);
  rows.slice(0,2000).forEach(r=>r.forEach((v,c)=>{ widths[c] = Math.max(widths[c], Math.min(50, wide(show(v).split("\n")[0]) + 2)); }));
  const cell = (v, r, c, hd)=>{
    if(blank(v)) return "";
    const ref = colL(c) + (r+1);
    if(isDate(v)) return `<c r="${ref}" s="${v.k==="t"?4:v.k==="dt"?3:2}"><v>${v.d}</v></c>`;
    if(typeof v==="number" && isFinite(v)) return `<c r="${ref}"${hd?' s="1"':""}><v>${v}</v></c>`;
    if(typeof v==="boolean") return `<c r="${ref}" t="b"><v>${v?1:0}</v></c>`;
    const s = String(v); if(!s) return "";
    return `<c r="${ref}" t="inlineStr"${hd?' s="1"':""}><is><t${/^\s|\s$|\n/.test(s)?' xml:space="preserve"':""}>${xesc(s)}</t></is></c>`;
  };
  const sd = rows.map((r,i)=>{ const cs = r.map((v,c)=>cell(v,i,c,head && i===0)).join(""); return cs ? `<row r="${i+1}">${cs}</row>` : ""; }).join("");
  const pane = head && rows.length>1 ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const cols = w ? `<cols>${widths.map((x,i)=>`<col min="${i+1}" max="${i+1}" width="${x}" customWidth="1"/>`).join("")}</cols>` : "";
  const af = head && w && rows.length>1 ? `<autoFilter ref="A1:${colL(w-1)}${rows.length}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pane}<sheetFormatPr defaultRowHeight="16.5"/>${cols}<sheetData>${sd}</sheetData>${af}</worksheet>`;
}
async function writeXlsx(sheets){   // sheets: [{name, rows, head}]
  const JSZip = await zipLib(), z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xesc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd hh:mm"/><numFmt numFmtId="166" formatCode="hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/><family val="3"/><charset val="129"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  sheets.forEach((s,i)=>z.file(`xl/worksheets/sheet${i+1}.xml`, sheetXml(s.rows, s.head)));
  return z.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression:"DEFLATE"});
}
function csvOf(rows){
  const q = v=>{ const s = show(v); return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  return "﻿" + rows.map(r=>r.map(q).join(",")).join("\r\n") + "\r\n";
}
function save(blob, name){
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
const fileBase = ()=>($("xmName").value.trim() || "합친파일").replace(/[\\/:*?"<>|]/g,"_");

// ---------- 화면 ----------
function sheetChoice(){
  const sel = $("xmSheets"), cur = sel.value, names = {}; let multi = false;
  files.filter(f=>!f.err).forEach(f=>{ if(f.sheets.length>1) multi = true; f.sheets.forEach(s=>names[s.name] = (names[s.name]||0) + 1); });
  const ok = files.filter(f=>!f.err).length;
  const opts = [["all","모든 시트"],["first","파일마다 첫 시트만"], ...Object.entries(names).filter(([,n])=>multi && n>=2).map(([n,c])=>["n:"+n, `'${n}' 시트만 (${c}개 파일)`])];
  sel.innerHTML = opts.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join("");
  sel.value = opts.some(o=>o[0]===cur) ? cur : "all";
  if(!$("xmSrcS").dataset.touched) $("xmSrcS").checked = multi;
  return ok;
}
function renderList(){
  $("xmList").innerHTML = files.map((f,i)=>`<li class="${f.err?"bad":"one xm"}" data-i="${i}">
    <div class="pmn"><b>${esc(f.name)}</b><span>${f.err ? esc(f.err) : f.sheets.length ? `시트 ${f.sheets.length}장 · ${f.sheets.map(s=>`${esc(s.name)} ${s.rows.filter(r=>r && !emptyRow(r)).length.toLocaleString()}줄`).slice(0,4).join(" · ")}${f.sheets.length>4?" …":""} · ${kb(f.size)}` : "읽는 중…"}</span></div>
    <span class="pmbtn"><button type="button" data-up="${i}" aria-label="위로" ${i?"":"disabled"}>▲</button><button type="button" data-dn="${i}" aria-label="아래로" ${i<files.length-1?"":"disabled"}>▼</button><button type="button" data-rm="${i}" aria-label="빼기">✕</button></span></li>`).join("");
  $("xmClear").hidden = !files.length;
}
let res = null;
function run(){
  renderList();
  const ok = sheetChoice(), st = job()==="stack";
  $("xmOpts").querySelectorAll(".xmgrid,.ochecks").forEach(e=>e.hidden = !st); $("xmBookHint").hidden = st;
  $("xmStatus").textContent = files.length ? `${ok}개 파일` + (files.length>ok ? ` · 못 읽은 파일 ${files.length-ok}개` : "") : "";
  $("xmGo").disabled = $("xmCsv").disabled = true; $("xmWarn").hidden = true; $("xmPrev").hidden = true; res = null;
  if(!ok){ $("xmSum").textContent = ""; return; }
  if(st){
    const r = stack(); res = r;
    if(!r.rows.length){ $("xmSum").textContent = "합칠 줄이 없습니다. 열 이름이 있는 줄을 다시 골라 보세요."; return; }
    const d = r.dropped, dn = [d.empty&&`빈 줄 ${d.empty}`, d.total&&`합계 줄 ${d.total}`, d.dup&&`겹친 줄 ${d.dup}`].filter(Boolean);
    $("xmSum").textContent = `시트 ${r.n}장 → ${r.rows.length.toLocaleString()}줄 × ${r.head.length}열${dn.length ? ` (뺀 것: ${dn.join(", ")})` : ""}`;
    const W = [];
    if(r.partial.length) W.push(...r.partial.slice(0,6).map(x=>`'${esc(x.c)}' 열은 시트 ${r.n}장 가운데 ${x.n}장에만 있습니다. 없는 시트의 줄은 빈칸이 됩니다.`));
    if(r.partial.length>6) W.push(`그 밖에 ${r.partial.length-6}개 열도 일부 시트에만 있습니다.`);
    if(r.partial.length && r.partial.length >= r.head.length/2) W.push("열 이름이 많이 다릅니다. 표 위에 제목 줄이 있다면 '열 이름이 있는 줄'을 직접 골라 보세요.");
    if(r.rows.length>=MAXROWS-1) W.push("엑셀 한 시트의 한도(1,048,576줄)에 닿아 그 뒤는 뺐습니다.");
    $("xmWarn").innerHTML = W.map(w=>`<li>${w}</li>`).join(""); $("xmWarn").hidden = !W.length;
    const P = r.rows.slice(0,30);
    $("xmPrev").innerHTML = `<table><thead><tr>${r.head.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${P.map(row=>`<tr>${row.map(v=>`<td${typeof v==="number"?' class="num"':""}>${esc(typeof v==="number" ? v.toLocaleString("ko-KR",{maximumFractionDigits:10}) : show(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      + (r.rows.length>30 ? `<p class="hint xmmore">미리 보기는 앞 30줄만 보여 줍니다. 받은 파일에는 ${r.rows.length.toLocaleString()}줄이 모두 들어갑니다.</p>` : "");
    $("xmPrev").hidden = false; $("xmGo").disabled = $("xmCsv").disabled = busy;
  }else{
    const b = book(); res = {book:b};
    $("xmSum").textContent = `시트 ${b.length}장을 한 파일에 모읍니다`;
    $("xmPrev").innerHTML = `<table><thead><tr><th>새 시트 이름</th><th>줄 수</th></tr></thead><tbody>${b.map(s=>`<tr><td>${esc(s.name)}</td><td>${s.rows.filter(r=>!emptyRow(r)).length.toLocaleString()}</td></tr>`).join("")}</tbody></table>`;
    $("xmPrev").hidden = false; $("xmGo").disabled = busy || !b.length; $("xmCsv").disabled = true;
  }
}
async function add(list){
  list = [...list];
  if(files.length + list.length > MAXF){ toast(`한 번에 ${MAXF}개까지 넣을 수 있습니다`); list = list.slice(0, Math.max(0, MAXF - files.length)); }
  const items = list.map(f=>({name:f.name, size:f.size, sheets:[], err:null, f}));
  files.push(...items); run();
  for(const it of items){
    try{ it.sheets = await readFile(it.f); if(!it.sheets.length) it.err = "읽을 수 있는 시트가 없습니다."; }
    catch(e){ it.err = e.message || "파일을 읽지 못했습니다."; }
    delete it.f; run();
  }
}
// 예시: 지점 세 곳의 판매 실적(열 순서가 다르고, 한 곳은 표 위에 제목 줄, 한 곳은 '담당자' 열이 더 있음)
function sample(){
  const D = (y,m,d)=>({d: (Date.UTC(y,m-1,d) - Date.UTC(1899,11,30)) / 86400000, k:"d"});
  files = [
    {name:"서울지점_11월.xlsx", size:9800, sheets:[{name:"판매", rows:[["날짜","상품","수량","금액"],[D(2026,11,2),"무선 이어폰",12,1068000],[D(2026,11,3),"충전 케이블",30,270000],[D(2026,11,4),"보조 배터리",8,312000],["합계","",50,1650000]]}]},
    {name:"부산지점_11월.xlsx", size:10400, sheets:[{name:"판매", rows:[["11월 판매 실적 (부산)"],[],["날짜","상품","금액","수량","담당자"],[D(2026,11,2),"보조 배터리",390000,10,"김하늘"],[D(2026,11,5),"무선 이어폰",534000,6,"이도윤"]]}]},
    {name:"대구지점_11월.csv", size:180, sheets:[{name:"대구지점_11월", rows:[["날짜","상품","수량","금액"],["2026-11-03","충전 케이블",14,126000],["2026-11-06","무선 이어폰",4,356000]]}]},
  ];
  run();
}
$("xmFile").addEventListener("change", e=>{ add(e.target.files); e.target.value = ""; });
const drop = $("xmDrop");
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("xmFile").click(); } });
drop.addEventListener("dragover", e=>{ e.preventDefault(); drop.classList.add("on"); });
drop.addEventListener("dragleave", ()=>drop.classList.remove("on"));
drop.addEventListener("drop", e=>{ e.preventDefault(); drop.classList.remove("on"); add(e.dataTransfer.files); });
$("xmList").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.rm!=null) files.splice(+b.dataset.rm, 1);
  else if(b.dataset.up!=null){ const i = +b.dataset.up; [files[i-1], files[i]] = [files[i], files[i-1]]; }
  else if(b.dataset.dn!=null){ const i = +b.dataset.dn; [files[i+1], files[i]] = [files[i], files[i+1]]; }
  run();
});
$("xmSample").addEventListener("click", sample);
$("xmClear").addEventListener("click", ()=>{ files = []; run(); });
document.querySelectorAll("input[name=xmJob]").forEach(r=>r.addEventListener("change", run));
["xmSheets","xmHead","xmMatch"].forEach(id=>$(id).addEventListener("change", run));
["xmSrcF","xmSrcS","xmEmpty","xmTotal","xmDup"].forEach(id=>$(id).addEventListener("change", ()=>{ $(id).dataset.touched = "1"; run(); }));
$("xmGo").addEventListener("click", async ()=>{
  if(!res || busy) return; busy = true; $("xmGo").disabled = true; const t = $("xmGo").textContent; $("xmGo").textContent = "만드는 중…";
  try{
    const sheets = res.book ? res.book.map(s=>({name:s.name, rows:s.rows, head:false})) : [{name:"합친 표", rows:[res.head, ...res.rows], head:true}];
    save(await writeXlsx(sheets), fileBase() + ".xlsx"); toast("엑셀 파일을 내려받았습니다");
  }catch(e){ toast("파일을 만들지 못했습니다: " + (e.message||e)); }
  busy = false; $("xmGo").textContent = t; run();
});
$("xmCsv").addEventListener("click", ()=>{ if(!res || res.book) return; save(new Blob([csvOf([res.head, ...res.rows])], {type:"text/csv;charset=utf-8"}), fileBase() + ".csv"); toast("CSV 파일을 내려받았습니다"); });
$("xmName").addEventListener("keydown", e=>{ if(e.key==="Enter") $("xmGo").click(); });
run();
})();

// SHIFT AI 무료 도구 — 표 → 차트 그림(보고서·PPT용). 붙여 넣은 표(탭·CSV·마크다운)·.xlsx·.csv 를 이 브라우저 안에서 읽어 SVG 로 그리고 PNG 로 바꾼다.
// .xlsx 는 /lib/jszip/(MIT)로 압축을 풀어 XML 을 직접 읽는다. 색은 색각 이상 시뮬레이션으로 검사한 범주색 순서(이웃 색 ΔE ≥ 9)를 그대로 쓴다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("tcIn")) return;
const ZIP = "/lib/jszip/jszip.min.js";
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2000); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
const radio = n=>(document.querySelector(`input[name=${n}]:checked`)||{}).value;
const COLORS = ["#2a78d6","#eb6834","#1baf7a","#eda100","#e87ba4","#008300","#6250d6","#e34948"];
const GRAYS = ["#222222","#8a8a8a","#bdbdbd","#555555","#d8d8d8","#3c3c3c","#a3a3a3","#6f6f6f"];
const DASH = ["", "8 5", "2 4", "12 4 2 4", "", "8 5", "2 4", "12 4 2 4"];
const SIZES = {"169":[960,540], "43":[800,600], "11":[720,720], "45":[720,900]};
const FONT = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif";
const INK = "#111214", SUB = "#5f6066", GRID = "#e6e6e3", BASE = "#b9b9b4";
let raw = [], book = null, flip = false, picked = null, lastSvg = "", lastSize = [960,540];

// ---------- 표 읽기 ----------
function parseDelim(s){
  s = s.replace(/^﻿/,"").replace(/\r\n?/g,"\n");
  const first = s.split("\n").slice(0,5).join("\n"), cnt = ch=>(first.match(new RegExp(ch,"g"))||[]).length;
  const d = cnt("\t") ? "\t" : (cnt(";") > cnt(",") ? ";" : ",");
  const rows = []; let row = [], cell = "", q = false;
  for(let i=0;i<s.length;i++){ const c = s[i];
    if(q){ if(c==='"'){ if(s[i+1]==='"'){ cell+='"'; i++; } else q = false; } else cell += c; continue; }
    if(c==='"' && cell===""){ q = true; continue; }
    if(c===d){ row.push(cell); cell = ""; continue; }
    if(c==="\n"){ row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += c; }
  if(cell!=="" || row.length){ row.push(cell); rows.push(row); }
  return rows;
}
function parseMd(s){
  const ls = s.trim().split(/\r?\n/).map(l=>l.trim()).filter(l=>/^\|.*\|$/.test(l) || /^\|/.test(l));
  if(ls.length < 2 || !/^\|?\s*:?-{2,}/.test(ls[1])) return null;
  const cut = l=>l.replace(/^\|/,"").replace(/\|$/,"").split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,"|").replace(/\*\*/g,""));
  return [cut(ls[0]), ...ls.slice(2).map(cut)];
}
const xml = s=>new DOMParser().parseFromString(s, "application/xml");
const kids = (el, name)=>Array.from(el.getElementsByTagNameNS("*", name));
const colN = s=>{ let n=0; for(const ch of s) n = n*26 + ch.charCodeAt(0)-64; return n-1; };
async function readXlsx(buf){
  await script(ZIP, ()=>!!window.JSZip);
  const z = await JSZip.loadAsync(buf), get = p=>z.file(p) ? z.file(p).async("string") : Promise.resolve(null);
  const wb = xml(await get("xl/workbook.xml")), rels = xml(await get("xl/_rels/workbook.xml.rels") || "<r/>");
  const relMap = {}; kids(rels,"Relationship").forEach(r=>relMap[r.getAttribute("Id")] = r.getAttribute("Target"));
  const ss = []; const sx = await get("xl/sharedStrings.xml");
  if(sx) kids(xml(sx),"si").forEach(si=>ss.push(kids(si,"t").filter(t=>t.parentNode.localName!=="rPh").map(t=>t.textContent).join("")));
  const pct = []; const st = await get("xl/styles.xml");
  if(st){ const S = xml(st), custom = {}; kids(S,"numFmt").forEach(f=>custom[f.getAttribute("numFmtId")] = f.getAttribute("formatCode")||"");
    const xfs = kids(S,"cellXfs")[0]; if(xfs) kids(xfs,"xf").forEach(x=>{ const id = +x.getAttribute("numFmtId"); pct.push(id===9 || id===10 || /%/.test((custom[id]||"").replace(/"[^"]*"/g,""))); }); }
  const sheets = [];
  for(const s of kids(wb,"sheet")){
    const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
    let path = relMap[rid] || ""; path = path.startsWith("/") ? path.slice(1) : "xl/" + path.replace(/^\.\//,"");
    const sx2 = await get(path); if(!sx2) continue;
    const rows = [];
    kids(xml(sx2),"row").forEach((r, ri)=>{ const rn = (+r.getAttribute("r") || ri+1) - 1, row = rows[rn] = rows[rn] || [];
      kids(r,"c").forEach((c, ci)=>{ const ref = c.getAttribute("r"), col = ref ? colN(ref.replace(/\d+/g,"")) : ci, t = c.getAttribute("t");
        const v = kids(c,"v")[0], is = kids(c,"is")[0]; let val = "";
        if(t==="s") val = v ? ss[+v.textContent] ?? "" : ""; else if(t==="inlineStr") val = is ? kids(is,"t").map(x=>x.textContent).join("") : "";
        else if(v){ const n = +v.textContent; val = isNaN(n) ? v.textContent : pct[+(c.getAttribute("s")||0)] ? +(n*100).toPrecision(12)+"%" : String(+n.toPrecision(15)); }
        row[col] = val; }); });
    sheets.push({name: s.getAttribute("name") || `시트${sheets.length+1}`, rows: Array.from(rows, r=>Array.from(r||[], x=>x??""))});
  }
  return {sheets};
}
// 숫자 읽기: "1,234원" "12.5%" "(1,200)" "1.2억" → {v, mul, pct}
const MUL = {"천":1e3, "만":1e4, "억":1e8, "조":1e12};
function num(s){
  let t = String(s??"").trim(); if(!t || /^[-–—]$/.test(t)) return null;
  let neg = false; if(/^\(.*\)$/.test(t)){ neg = true; t = t.slice(1,-1); }
  t = t.replace(/[\s,₩$€¥£＄]/g,"").replace(/^(KRW|USD)/i,"");
  // 날짜·순서(1월·3년·2주·5위)는 숫자로 읽지 않는다 — 대개 가로축 이름이다
  const m = t.match(/^([-+−]?\d*\.?\d+(?:[eE][-+]?\d+)?)(%|천|만|억|조)?(원|달러|명|개|건|회|점|배|시간|분|초|kg|g|km|대|곳|가구|표|권|편|ea|EA|pt|p)?$/);
  if(!m) return null;
  const v = parseFloat(m[1].replace("−","-"));
  return isNaN(v) ? null : {v: neg ? -Math.abs(v) : v, mul: MUL[m[2]] || 1, pct: m[2]==="%", w: m[3] || ""};
}
function grid(){
  let rows = raw.map(r=>r.map(x=>String(x??"").trim())).filter(r=>r.some(x=>x));
  const w = Math.max(0, ...rows.map(r=>r.length)); rows = rows.map(r=>Array.from({length:w}, (_,i)=>r[i]||""));
  if(flip) rows = Array.from({length:w}, (_,c)=>rows.map(r=>r[c]));
  return rows;
}
// 열 분석: 숫자 열(값의 60% 이상이 숫자) = 그릴 숫자, 나머지 = 이름 후보
function analyze(rows){
  if(rows.length < 2) return null;
  const head = rows[0], body = rows.slice(1), cols = head.map((h,i)=>{ const vals = body.map(r=>num(r[i])), filled = body.filter(r=>r[i]).length;
    const ok = vals.filter(Boolean).length; return {i, name: h || `열 ${i+1}`, num: filled && ok / Math.max(1, filled) >= .6 && ok >= 1, vals}; });
  return {head, body, cols};
}
function model(){
  const rows = grid(), A = analyze(rows); if(!A) return null;
  // 첫 열이 연도·월·순번처럼 보이면 숫자여도 가로축 이름으로 쓴다
  const c0 = A.cols[0];
  if(c0 && c0.num && A.cols.length > 1 && (/(연도|년도|년|월|일자|날짜|기간|분기|주차|회차|순번|번호|year|month|date|no\.?)$/i.test(c0.name.trim()) || A.body.every(r=>/^(19|20)\d\d$/.test(String(r[0]).trim())))) c0.num = false;
  const labCols = A.cols.filter(c=>!c.num), numCols = A.cols.filter(c=>c.num);
  if(!numCols.length) return {err:"숫자가 든 열을 찾지 못했습니다. 첫 줄은 이름, 그 아래는 숫자인지 확인해 주세요."};
  // 이름 열 고르기
  const labSel = $("tcLab"), labOpts = [...A.cols.filter(c=>!c.num), ...(labCols.length ? [] : [{i:-1, name:"(번호)"}])];
  const prev = labSel.value; labSel.innerHTML = labOpts.map(c=>`<option value="${c.i}">${esc(c.name)}</option>`).join("") + (labCols.length ? `<option value="-1">(번호로)</option>` : "");
  if([...labSel.options].some(o=>o.value===prev)) labSel.value = prev;
  const li = +labSel.value;
  // 그릴 숫자 고르기(처음엔 앞 8개)
  const key = numCols.map(c=>c.name).join("\u0001");
  if(!picked || picked.key!==key) picked = {key, on: new Set(numCols.slice(0,8).map(c=>c.i))};
  $("tcSeries").innerHTML = numCols.map((c,k)=>`<label><input type="checkbox" data-s="${c.i}" ${picked.on.has(c.i)?"checked":""}> ${esc(c.name)}</label>`).join("");
  $("tcColsW").hidden = false;
  let series = numCols.filter(c=>picked.on.has(c.i)).slice(0,8);
  if(!series.length) return {err:"그릴 숫자를 하나 이상 고르세요."};
  // 단위 섞임(천·만·억·조) 맞추기
  let unitHint = "", pctAll = true;
  const all = series.flatMap(c=>c.vals.filter(Boolean)); const muls = new Set(all.map(x=>x.mul)); pctAll = all.length && all.every(x=>x.pct);
  let scale = 1;
  if(muls.size === 1 && [...muls][0] !== 1) unitHint = Object.keys(MUL).find(k=>MUL[k]===[...muls][0]);
  else if(muls.size > 1){ const mx = Math.max(...all.map(x=>Math.abs(x.v*x.mul))); const u = mx >= 1e8 ? "억" : mx >= 1e4 ? "만" : ""; scale = u ? MUL[u] : 1; unitHint = u; }
  const ws = new Set(all.map(x=>x.w).filter(Boolean)); if(ws.size === 1){ const w = [...ws][0]; unitHint = unitHint ? `${unitHint} ${w}` : w; }
  const val = x=>x==null ? null : muls.size > 1 ? x.v * x.mul / scale : x.v;
  const cats = A.body.map((r,k)=>li >= 0 ? (r[li] || `${k+1}`) : `${k+1}`);
  const S = series.map(c=>({name: c.name, vals: c.vals.map(val)}));
  const keep = cats.map((_,k)=>S.some(s=>s.vals[k]!=null));
  return {cats: cats.filter((_,k)=>keep[k]), series: S.map(s=>({...s, vals: s.vals.filter((_,k)=>keep[k])})), unitHint: unitHint || (pctAll ? "%" : ""), more: numCols.length > 8 && picked.on.size > 8};
}

// ---------- 눈금·숫자 ----------
function nice(lo, hi, n=5){
  if(lo===hi){ if(lo===0) hi = 1; else if(lo>0) lo = 0; else hi = 0; }
  const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const st = (f<=1 ? 1 : f<=2 ? 2 : f<=2.5 ? 2.5 : f<=5 ? 5 : 10) * mag;
  const a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, ticks = [];
  for(let v=a; v<=b + st/2; v+=st) ticks.push(+v.toPrecision(12));
  return {lo:a, hi:b, ticks, st};
}
const dec = vs=>Math.min(2, Math.max(0, ...vs.filter(v=>v!=null).map(v=>((String(+v.toPrecision(12)).split(".")[1])||"").length)));
const fmtN = (v, d, unit)=>v==null ? "" : v.toLocaleString("ko-KR", {minimumFractionDigits:0, maximumFractionDigits:d}) + (unit==="%" ? "%" : "");
const tw = (s, px)=>{ let w = 0; for(const ch of String(s)) w += /[ㄱ-힣一-鿿]/.test(ch) ? px*0.98 : /[A-Z0-9%]/.test(ch) ? px*0.62 : /[\s.,:;'()\-]/.test(ch) ? px*0.32 : px*0.55; return w; };
function clip(s, px, max){ s = String(s); if(tw(s, px) <= max) return s; while(s.length > 1 && tw(s + "…", px) > max) s = s.slice(0,-1); return s + "…"; }
function wrap2(s, px, max){ s = String(s); if(tw(s, px) <= max) return [s];
  const ws = s.split(/\s+/); if(ws.length > 1){ let a = ""; for(const w of ws){ if(tw((a+" "+w).trim(), px) <= max) a = (a+" "+w).trim(); else break; } if(a){ const b = s.slice(a.length).trim(); return [a, clip(b, px, max)]; } }
  let k = s.length; while(k > 1 && tw(s.slice(0,k), px) > max) k--; return [s.slice(0,k), clip(s.slice(k), px, max)]; }
const T = (x, y, s, px, o={})=>`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${px}" fill="${o.fill||SUB}"${o.anchor?` text-anchor="${o.anchor}"`:""}${o.w?` font-weight="${o.w}"`:""}${o.base?` dominant-baseline="${o.base}"`:""}>${esc(s)}</text>`;
// 위쪽(또는 오른쪽) 끝만 둥근 막대
function barPath(x, y, w, h, r, dir){   // dir: up | down | right | left (둥근 쪽)
  r = Math.max(0, Math.min(r, (dir==="up"||dir==="down" ? w : h)/2, (dir==="up"||dir==="down" ? h : w)));
  if(dir==="up") return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`;
  if(dir==="down") return `M${x},${y}V${y+h-r}Q${x},${y+h} ${x+r},${y+h}H${x+w-r}Q${x+w},${y+h} ${x+w},${y+h-r}V${y}Z`;
  if(dir==="right") return `M${x},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h-r}Q${x+w},${y+h} ${x+w-r},${y+h}H${x}Z`;
  return `M${x+w},${y}H${x+r}Q${x},${y} ${x},${y+r}V${y+h-r}Q${x},${y+h} ${x+r},${y+h}H${x+w}Z`;
}

// ---------- 그리기 ----------
function draw(M, o){
  const [W, H] = o.size, k = o.big ? 1.25 : 1, fT = Math.round(26*k), fS = Math.round(14*k), fA = Math.round(13*k), fV = Math.round(13*k), fL = Math.round(14*k);
  const pal = o.gray ? GRAYS : COLORS, pad = 40;
  const unit = (o.unit||"").trim(), out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(FONT)}" role="img" aria-label="${esc(o.title||"차트")}">`);
  if(!o.clear) out.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  let y = pad;
  if(o.title){ out.push(T(pad, y + fT*0.82, clip(o.title, fT, W - pad*2), fT, {fill:INK, w:800})); y += fT + 8; }
  const unitLine = unit && unit!=="%" ? `단위: ${unit}` : "";
  if(unitLine){ out.push(T(pad, y + fS*0.9, unitLine, fS)); y += fS + 6; }
  let S = M.series, cats = M.cats.slice();
  const type = o.type;
  // 정렬
  let order = cats.map((_,i)=>i);
  if(o.sort && type!=="line"){ const tot = i=>type==="stack" ? S.reduce((a,s)=>a+(s.vals[i]||0),0) : (S[0].vals[i]??-Infinity); order.sort((a,b)=>tot(b)-tot(a)); }
  cats = order.map(i=>cats[i]); S = S.map(s=>({...s, vals: order.map(i=>s.vals[i])}));
  // 범례(2개 이상)
  if(S.length > 1 && type!=="pie"){
    y += 10; let x = pad; const lh = fL + 10;
    S.forEach((s,i)=>{ const wv = 14 + 6 + tw(s.name, fL) + 18; if(x + wv > W - pad){ x = pad; y += lh; }
      out.push(type==="line" ? `<line x1="${x}" y1="${y+fL/2}" x2="${x+16}" y2="${y+fL/2}" stroke="${pal[i]}" stroke-width="3" stroke-linecap="round"${DASH[i]&&o.gray?` stroke-dasharray="${DASH[i]}"`:""}/>` : `<rect x="${x}" y="${y+fL/2-7}" width="14" height="14" rx="3" fill="${pal[i]}"/>`);
      out.push(T(x + 22, y + fL*0.85, s.name, fL, {fill:INK})); x += wv; });
    y += lh;
  }
  y += 14;
  const P = {x: pad, y, w: W - pad*2, h: H - y - pad};
  const allV = S.flatMap(s=>s.vals).filter(v=>v!=null), d = dec(allV);
  const titleOf = (c, s, v)=>`<title>${esc(c)}${S.length>1?" · "+esc(s):""}: ${esc(fmtN(v, d, unit))}${unit && unit!=="%" ? " "+esc(unit) : ""}</title>`;

  if(type==="pie"){
    let items = cats.map((c,i)=>({c, v: S[0].vals[i]})).filter(x=>x.v!=null && x.v > 0);
    if(items.length > 6){ items.sort((a,b)=>b.v-a.v); const rest = items.slice(5).reduce((a,x)=>a+x.v,0); items = [...items.slice(0,5), {c:"기타", v:rest, other:true}]; }
    const tot = items.reduce((a,x)=>a+x.v,0); if(!tot){ out.push(T(W/2, H/2, "0보다 큰 값이 없습니다", fS, {anchor:"middle"})); out.push("</svg>"); return out.join(""); }
    const wide = P.w > P.h * 1.2, R = Math.min(wide ? P.w*0.42 : P.w, P.h * (wide ? 1 : 0.62)) / 2 - 4, cx = wide ? P.x + R + 8 : P.x + P.w/2, cy = wide ? P.y + P.h/2 : P.y + R + 4, ri = R*0.58;
    let a0 = -Math.PI/2;
    items.forEach((it,i)=>{ const a1 = a0 + it.v/tot*Math.PI*2, big = a1 - a0 > Math.PI ? 1 : 0, col = it.other ? "#b9b9b4" : pal[i];
      const p = (r,a)=>`${(cx+r*Math.cos(a)).toFixed(2)},${(cy+r*Math.sin(a)).toFixed(2)}`;
      const path = items.length===1 ? `M${cx-R},${cy}a${R},${R} 0 1,0 ${R*2},0a${R},${R} 0 1,0 ${-R*2},0M${cx-ri},${cy}a${ri},${ri} 0 1,1 ${ri*2},0a${ri},${ri} 0 1,1 ${-ri*2},0Z`
        : `M${p(R,a0)}A${R},${R} 0 ${big},1 ${p(R,a1)}L${p(ri,a1)}A${ri},${ri} 0 ${big},0 ${p(ri,a0)}Z`;
      out.push(`<path d="${path}" fill="${col}" stroke="${o.clear?"none":"#ffffff"}" stroke-width="2" fill-rule="evenodd">${titleOf(it.c, S[0].name, it.v)}</path>`);
      a0 = a1; });
    out.push(T(cx, cy - 2, "합계", fS, {anchor:"middle"}), T(cx, cy + fT*0.9, fmtN(tot, d, unit), Math.round(fT*0.9), {anchor:"middle", fill:INK, w:800}));
    // 조각 이름·값·비율(색만으로 구별하지 않게 글로 적는다)
    const lx = wide ? cx + R + 36 : P.x, ly0 = wide ? cy - items.length*(fL+16)/2 : cy + R + 24, colW = wide ? P.x + P.w - lx : P.w;
    items.forEach((it,i)=>{ const yy = ly0 + i*(fL+16), col = it.other ? "#b9b9b4" : pal[i], pc = (it.v/tot*100);
      out.push(`<rect x="${lx}" y="${yy}" width="14" height="14" rx="3" fill="${col}"/>`);
      out.push(T(lx + 22, yy + fL*0.85, clip(it.c, fL, colW*0.55), fL, {fill:INK, w:700}));
      out.push(T(lx + colW, yy + fL*0.85, `${fmtN(it.v, d, unit)}${unit && unit!=="%" ? " "+unit : ""} · ${pc.toFixed(pc<10?1:0)}%`, fL, {anchor:"end"})); });
    out.push("</svg>"); return out.join("");
  }

  const stack = type==="stack", hbar = type==="hbar", line = type==="line";
  let lo, hi;
  if(stack){ const pos = cats.map((_,i)=>S.reduce((a,s)=>a+Math.max(0, s.vals[i]||0),0)), neg = cats.map((_,i)=>S.reduce((a,s)=>a+Math.min(0, s.vals[i]||0),0)); lo = Math.min(0, ...neg); hi = Math.max(0, ...pos); }
  else { lo = Math.min(...allV); hi = Math.max(...allV); if(!line){ lo = Math.min(0, lo); hi = Math.max(0, hi); } else { const sp = (hi - lo) || Math.abs(hi) || 1; lo -= sp*0.08; hi += sp*0.08; if(Math.min(...allV) >= 0 && lo < 0) lo = 0; } }
  const N = nice(lo, hi, hbar ? 5 : Math.max(3, Math.min(6, Math.round(P.h/70))));
  const tickLabs = N.ticks.map(v=>fmtN(v, Math.max(d, (String(N.st).split(".")[1]||"").length), unit));
  if(hbar){
    const labW = Math.min(P.w*0.34, Math.max(...cats.map(c=>tw(c, fA))) + 18);
    const X0 = P.x + labW, PW = P.w - labW - (o.val ? Math.max(...allV.map(v=>tw(fmtN(v,d,unit), fV))) + 10 : 8), PH = P.h - fA - 12;
    const sx = v=>X0 + (v - N.lo)/(N.hi - N.lo)*PW, band = PH / cats.length;
    N.ticks.forEach((v,i)=>{ const x = sx(v); out.push(`<line x1="${x.toFixed(1)}" y1="${P.y}" x2="${x.toFixed(1)}" y2="${P.y+PH}" stroke="${v===0?BASE:GRID}" stroke-width="1"/>`, T(x, P.y + PH + fA + 6, tickLabs[i], fA, {anchor:"middle"})); });
    const bh = Math.min(48, band*0.72 / (stack ? 1 : S.length)), gap = stack || S.length===1 ? 0 : 2;
    cats.forEach((c,i)=>{ const top = P.y + i*band + (band - (stack ? bh : bh*S.length + gap*(S.length-1)))/2;
      out.push(T(X0 - 10, P.y + i*band + band/2 + fA*0.35, clip(c, fA, labW - 10), fA, {anchor:"end", fill:INK}));
      if(stack){ let pp = 0, nn = 0; const segs = S.map((s,j)=>({j, v:s.vals[i]||0})).filter(x=>x.v);
        const lastP = [...segs].reverse().find(x=>x.v>0), lastN = [...segs].reverse().find(x=>x.v<0);
        segs.forEach(sg=>{ const a = sg.v>0 ? pp : nn, b = a + sg.v; if(sg.v>0) pp = b; else nn = b;
          const x1 = sx(Math.min(a,b)), x2 = sx(Math.max(a,b)), end = sg===lastP || sg===lastN, wv = Math.max(0, x2 - x1 - (end ? 0 : 2));
          const xx = sg.v>0 ? x1 : x1 + (end ? 0 : 2);
          out.push(`<path d="${end ? barPath(xx, top, wv, bh, 4, sg.v>0?"right":"left") : `M${xx},${top}h${wv}v${bh}h${-wv}Z`}" fill="${pal[sg.j]}">${titleOf(c, S[sg.j].name, sg.v)}</path>`); });
        if(o.val){ const t = S.reduce((a,s)=>a+(s.vals[i]||0),0); out.push(T(sx(pp) + 6, top + bh/2 + fV*0.35, fmtN(t, d, unit), fV, {fill:INK, w:700})); }
      } else S.forEach((s,j)=>{ const v = s.vals[i]; if(v==null) return; const yy = top + j*(bh+gap), x0 = sx(0), x1 = sx(v);
        out.push(`<path d="${barPath(Math.min(x0,x1), yy, Math.abs(x1-x0), bh, 4, v>=0?"right":"left")}" fill="${pal[j]}">${titleOf(c, s.name, v)}</path>`);
        if(o.val) out.push(T(v>=0 ? x1 + 6 : x1 - 6, yy + bh/2 + fV*0.35, fmtN(v, d, unit), fV, {fill:INK, anchor: v>=0 ? "start" : "end"})); });
    });
    out.push("</svg>"); return out.join("");
  }
  // 세로 막대·누적·꺾은선
  const axW = Math.max(...tickLabs.map(s=>tw(s, fA))) + 10, X0 = P.x + axW, PW = P.w - axW;
  const band = PW / cats.length, maxLab = band - 6;
  const labLines = cats.map(c=>wrap2(c, fA, Math.max(24, maxLab)));
  const labH = labLines.some(l=>l.length>1) ? fA*2 + 14 : fA + 12, PH = P.h - labH - (o.val && !line ? 0 : 0);
  const sy = v=>P.y + PH - (v - N.lo)/(N.hi - N.lo)*PH;
  N.ticks.forEach((v,i)=>{ const yy = sy(v); out.push(`<line x1="${X0}" y1="${yy.toFixed(1)}" x2="${X0+PW}" y2="${yy.toFixed(1)}" stroke="${v===0 && !line?BASE:GRID}" stroke-width="1"/>`, T(X0 - 8, yy + fA*0.35, tickLabs[i], fA, {anchor:"end"})); });
  const every = Math.max(1, Math.ceil(cats.length / Math.max(1, Math.floor(PW / Math.max(40, Math.min(...labLines.map(l=>tw(l[0], fA))) + 12)))));
  cats.forEach((c,i)=>{ if(line && i % every && i !== cats.length-1) return; const cx = X0 + band*(i+.5);
    labLines[i].forEach((ln,k)=>out.push(T(cx, P.y + PH + fA + 6 + k*(fA+3), ln, fA, {anchor:"middle", fill:INK}))); });
  if(line){
    const xs = i=>X0 + band*(i+.5), lw = 2.5, mr = cats.length > 40 ? 0 : 4;
    S.forEach((s,j)=>{ let dd = "", pen = false; s.vals.forEach((v,i)=>{ if(v==null){ pen = false; return; } dd += (pen ? "L" : "M") + xs(i).toFixed(1) + "," + sy(v).toFixed(1); pen = true; });
      out.push(`<path d="${dd}" fill="none" stroke="${pal[j]}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"${o.gray&&DASH[j]?` stroke-dasharray="${DASH[j]}"`:""}/>`);
      if(mr) s.vals.forEach((v,i)=>{ if(v==null) return; out.push(`<circle cx="${xs(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="${mr}" fill="${pal[j]}" stroke="${o.clear?"none":"#fff"}" stroke-width="2">${titleOf(cats[i], s.name, v)}</circle>`); }); });
    // 숫자는 마지막 점(과 최고점)에만: 모든 점에 숫자를 쓰면 읽기 어렵다
    if(o.val) S.forEach((s,j)=>{ const idx = s.vals.map((v,i)=>v==null?-1:i).filter(i=>i>=0); if(!idx.length) return; const last = idx[idx.length-1];
      const mx = idx.reduce((a,i)=>s.vals[i] > s.vals[a] ? i : a, idx[0]); const show = S.length > 2 ? [last] : [...new Set([mx, last])];
      show.forEach(i=>out.push(T(xs(i), sy(s.vals[i]) - 10, fmtN(s.vals[i], d, unit), fV, {anchor: i===cats.length-1 && band < 60 ? "end" : "middle", fill:INK, w:700}))); });
  } else if(stack){
    const bw = Math.min(72, band*0.62);
    cats.forEach((c,i)=>{ const x = X0 + band*(i+.5) - bw/2; let pp = 0, nn = 0; const segs = S.map((s,j)=>({j, v:s.vals[i]||0})).filter(q=>q.v);
      const lastP = [...segs].reverse().find(q=>q.v>0), lastN = [...segs].reverse().find(q=>q.v<0);
      segs.forEach(sg=>{ const a = sg.v>0 ? pp : nn, b = a + sg.v; if(sg.v>0) pp = b; else nn = b; const y1 = sy(Math.max(a,b)), y2 = sy(Math.min(a,b)), end = sg===lastP || sg===lastN;
        const hh = Math.max(0, y2 - y1 - (end ? 0 : 2)), yy = sg.v>0 ? (end ? y1 : y1 + 2) : y1;
        out.push(`<path d="${end ? barPath(x, yy, bw, hh, 4, sg.v>0?"up":"down") : `M${x},${yy}h${bw}v${hh}h${-bw}Z`}" fill="${pal[sg.j]}">${titleOf(c, S[sg.j].name, sg.v)}</path>`); });
      if(o.val){ const t = S.reduce((a,s)=>a+(s.vals[i]||0),0); out.push(T(x + bw/2, sy(pp) - 8, fmtN(t, d, unit), fV, {anchor:"middle", fill:INK, w:700})); } });
  } else {
    const gap = S.length > 1 ? 2 : 0, gw = Math.min(band*0.72, S.length*56), bw = (gw - gap*(S.length-1))/S.length;
    const showVal = o.val && bw >= tw(fmtN(Math.max(...allV.map(Math.abs)), d, unit), fV) * 0.7;
    cats.forEach((c,i)=>{ const x0 = X0 + band*(i+.5) - gw/2; S.forEach((s,j)=>{ const v = s.vals[i]; if(v==null) return; const x = x0 + j*(bw+gap), y0 = sy(0), y1 = sy(v);
      out.push(`<path d="${barPath(x, Math.min(y0,y1), bw, Math.abs(y1-y0), 4, v>=0?"up":"down")}" fill="${pal[j]}">${titleOf(c, s.name, v)}</path>`);
      if(showVal) out.push(T(x + bw/2, v>=0 ? y1 - 7 : y1 + fV + 4, fmtN(v, d, unit), fV, {anchor:"middle", fill:INK})); }); });
    if(o.val && !showVal) lastHint = "막대가 좁아 숫자를 적지 않았습니다. 가로 막대나 PPT 16:9 크기를 고르면 숫자가 들어갑니다.";
  }
  out.push("</svg>"); return out.join("");
}
let lastHint = "";

// ---------- 화면 ----------
function opts(){ return {type: radio("tcType"), size: SIZES[radio("tcSize")] || SIZES["169"], title: $("tcTitle").value.trim(), unit: $("tcUnit").value.trim(),
  val: $("tcVal").checked, sort: $("tcSort").checked, big: $("tcBig").checked, gray: $("tcGray").checked, clear: $("tcClearBg").checked}; }
let unitAuto = "";
function render(){
  lastHint = "";
  const M = raw.length ? model() : null, ok = M && !M.err;
  ["tcPng","tcCopy","tcSvg"].forEach(id=>$(id).disabled = !ok);
  if(!M){ $("tcPrev").innerHTML = `<p class="hint">표를 넣으면 여기에 차트가 그려집니다.</p>`; $("tcStatus").textContent = ""; $("tcColsW").hidden = !raw.length; lastSvg = ""; $("tcHint").textContent = ""; return; }
  if(M.err){ $("tcPrev").innerHTML = `<p class="hint warn">${esc(M.err)}</p>`; lastSvg = ""; return; }
  if(M.unitHint && (!$("tcUnit").value.trim() || $("tcUnit").value.trim()===unitAuto)){ $("tcUnit").value = unitAuto = M.unitHint; }
  const o = opts(); lastSize = o.size; lastSvg = draw(M, o);
  $("tcPrev").innerHTML = lastSvg;
  const pie = o.type==="pie";
  $("tcStatus").textContent = `${M.cats.length}개 항목 · 숫자 ${M.series.length}묶음`;
  const hint = [];
  if(pie && M.series.length > 1) hint.push(`도넛은 첫 숫자 묶음(${M.series[0].name})만 그립니다.`);
  if(pie && M.cats.length > 6) hint.push("조각이 6개를 넘어 작은 것들은 '기타'로 묶었습니다.");
  if(pie && M.series[0].vals.some(v=>v!=null && v<0)) hint.push("0보다 작은 값은 도넛에 넣지 않았습니다.");
  if(o.type==="bar" && M.cats.length > 14) hint.push("항목이 많으면 '가로 막대'가 더 읽기 쉽습니다.");
  if(M.more) hint.push("숫자 묶음은 8개까지만 그립니다.");
  if(lastHint) hint.push(lastHint);
  $("tcHint").textContent = hint.join(" ");
}
async function png(scale=2){
  const [W,H] = lastSize, img = new Image(), url = URL.createObjectURL(new Blob([lastSvg], {type:"image/svg+xml;charset=utf-8"}));
  await new Promise((ok,no)=>{ img.onload = ok; img.onerror = ()=>no(new Error("그림을 만들지 못했습니다")); img.src = url; });
  const cv = document.createElement("canvas"); cv.width = W*scale; cv.height = H*scale; const c = cv.getContext("2d"); c.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
  return new Promise((ok,no)=>cv.toBlob(b=>b ? ok(b) : no(new Error("그림을 만들지 못했습니다")), "image/png"));
}
const fname = ext=>(($("tcTitle").value.trim() || "차트").replace(/[\\/:*?"<>|]/g,"_")) + "." + ext;
const save = (blob, name)=>{ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 4000); };
const SAMPLE = "월\t1팀\t2팀\t3팀\n1월\t1,200만원\t980만원\t640만원\n2월\t1,350만원\t1,020만원\t710만원\n3월\t1,480만원\t1,110만원\t820만원\n4월\t1,390만원\t1,260만원\t905만원\n5월\t1,620만원\t1,310만원\t990만원\n6월\t1,710만원\t1,405만원\t1,080만원";
function readText(s){
  book = null; $("tcSheetW").hidden = true;
  const md = parseMd(s); raw = md || parseDelim(s); picked = null; render();
}
$("tcIn").addEventListener("input", ()=>readText($("tcIn").value));
$("tcSample").addEventListener("click", ()=>{ $("tcIn").value = SAMPLE; flip = false; if(!$("tcTitle").value) $("tcTitle").value = "팀별 월 매출"; readText(SAMPLE); });
$("tcClear").addEventListener("click", ()=>{ $("tcIn").value = ""; raw = []; book = null; picked = null; $("tcSheetW").hidden = true; $("tcColsW").hidden = true; if($("tcUnit").value===unitAuto) $("tcUnit").value = unitAuto = ""; render(); });
$("tcFlip").addEventListener("click", ()=>{ flip = !flip; picked = null; render(); toast(flip ? "행과 열을 바꿨습니다" : "원래대로 돌렸습니다"); });
$("tcFile").addEventListener("change", async e=>{ const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  try{
    if(/\.xlsx$/i.test(f.name)){ book = await readXlsx(await f.arrayBuffer()); if(!book.sheets.length) throw 0;
      $("tcSheet").innerHTML = book.sheets.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join(""); $("tcSheetW").hidden = book.sheets.length < 2;
      raw = book.sheets[0].rows; $("tcIn").value = raw.map(r=>r.join("\t")).join("\n"); }
    else { const b = new Uint8Array(await f.arrayBuffer()); let s = new TextDecoder("utf-8").decode(b); if(/�/.test(s)) s = new TextDecoder("euc-kr").decode(b); $("tcIn").value = s; raw = parseDelim(s); book = null; $("tcSheetW").hidden = true; }
    picked = null; flip = false; if(!$("tcTitle").value) $("tcTitle").value = f.name.replace(/\.[a-z]+$/i,""); render();
  }catch(_){ toast("파일을 읽지 못했습니다. .xlsx·.csv 파일인지 확인해 주세요"); } });
$("tcSheet").addEventListener("change", ()=>{ if(!book) return; raw = book.sheets[+$("tcSheet").value].rows; $("tcIn").value = raw.map(r=>r.join("\t")).join("\n"); picked = null; render(); });
$("tcLab").addEventListener("change", render);
$("tcSeries").addEventListener("change", e=>{ const c = e.target.closest("input[data-s]"); if(!c || !picked) return; const i = +c.dataset.s; c.checked ? picked.on.add(i) : picked.on.delete(i);
  if(picked.on.size > 8){ toast("숫자 묶음은 8개까지 그립니다"); } render(); });
document.querySelectorAll("input[name=tcType],input[name=tcSize]").forEach(r=>r.addEventListener("change", render));
["tcVal","tcSort","tcBig","tcGray","tcClearBg"].forEach(id=>$(id).addEventListener("change", render));
["tcTitle","tcUnit"].forEach(id=>$(id).addEventListener("input", render));
$("tcPng").addEventListener("click", async ()=>{ if(!lastSvg) return; try{ save(await png(2), fname("png")); }catch(e){ toast(e.message); } });
$("tcSvg").addEventListener("click", ()=>{ if(lastSvg) save(new Blob([lastSvg], {type:"image/svg+xml"}), fname("svg")); });
$("tcCopy").addEventListener("click", async ()=>{ if(!lastSvg) return;
  if(!(navigator.clipboard && window.ClipboardItem)){ toast("이 브라우저는 그림 복사를 지원하지 않습니다. PNG로 받아 주세요"); return; }
  try{ await navigator.clipboard.write([new ClipboardItem({"image/png": png(2)})]); toast("그림을 복사했습니다. PPT·한글에서 붙여 넣으세요"); }
  catch(_){ toast("복사하지 못했습니다. PNG로 받아 주세요"); } });
render();
})();

// SHIFT AI 무료 도구 — 한글·워드·파워포인트 글자 뽑기. HWP(5.0)·HWPX·DOCX·PPTX 를 이 브라우저 안에서만 읽는다(파일은 어디에도 보내지 않음).
// 본 제품은 한글과컴퓨터의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// HWP 는 문서 구조(복합 문서 파일 → BodyText 레코드)를 직접 읽고, 압축은 브라우저 내장 DecompressionStream('deflate-raw')으로 푼다.
// HWPX·DOCX·PPTX 는 /lib/jszip/(MIT)로 압축을 풀어 XML 을 읽는다. 토큰 수는 /lib/gpt-tokenizer/o200k.js(MIT).
(function(){
"use strict";
const ZIP = "/lib/jszip/jszip.min.js";
const script = (src, test)=> test() ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>no(new Error("프로그램을 받지 못했습니다. 새로 고침해 주세요.")); document.head.appendChild(s); });
const zipLib = ()=>script(ZIP, ()=>!!window.JSZip).then(()=>window.JSZip);
const xml = s=>new DOMParser().parseFromString(s, "application/xml");
const kids = (el, name)=>el ? Array.from(el.children).filter(c=>c.localName===name) : [];
const kid = (el, name)=>kids(el, name)[0] || null;
const desc = (el, name)=>el ? Array.from(el.getElementsByTagNameNS("*", name)) : [];
const attr = (el, name)=>{ if(!el) return null; if(el.hasAttribute(name)) return el.getAttribute(name); for(const a of el.attributes) if(a.localName===name) return a.value; return null; };
const clean = s=>String(s||"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g,"").replace(/[  　]+/g," ");
class DocErr extends Error {}

// ---------- 결과 모양(블록) ----------
// {t:"h", lv, s} 제목 · {t:"p", s} 문단 · {t:"li", s, lv, mk} 목록 · {t:"tbl", rows:[[{s,cs,rs}]]} 표 · {t:"slide", n, s, hide} · {t:"memo", s} 발표자 메모 · {t:"img"} 그림 자리

// 한글 문단 번호 모양(HWPX 이름 = HWP 5.0 번호 모양 순서)
const HSHAPE = ["DIGIT","CIRCLED_DIGIT","ROMAN_CAPITAL","ROMAN_SMALL","LATIN_CAPITAL","LATIN_SMALL","CIRCLED_LATIN_CAPITAL","CIRCLED_LATIN_SMALL","HANGUL_SYLLABLE","CIRCLED_HANGUL_SYLLABLE","HANGUL_JAMO","CIRCLED_HANGUL_JAMO","HANGUL_PHONETIC","IDEOGRAPH","CIRCLED_IDEOGRAPH"];
function hnum(shape, n){
  const GA = "가나다라마바사아자차카타파하", JA = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ", HAN = "一二三四五六七八九十";
  switch(shape){
    case "CIRCLED_DIGIT": return n>=1 && n<=20 ? String.fromCharCode(0x2460+n-1) : `(${n})`;
    case "ROMAN_CAPITAL": return roman(n); case "ROMAN_SMALL": return roman(n).toLowerCase();
    case "LATIN_CAPITAL": return String.fromCharCode(65+(n-1)%26); case "LATIN_SMALL": return String.fromCharCode(97+(n-1)%26);
    case "CIRCLED_LATIN_CAPITAL": return String.fromCharCode(0x24B6+(n-1)%26); case "CIRCLED_LATIN_SMALL": return String.fromCharCode(0x24D0+(n-1)%26);
    case "HANGUL_SYLLABLE": return GA[(n-1)%14]; case "CIRCLED_HANGUL_SYLLABLE": return String.fromCharCode(0x326E+(n-1)%14);
    case "HANGUL_JAMO": return JA[(n-1)%14]; case "CIRCLED_HANGUL_JAMO": return String.fromCharCode(0x3260+(n-1)%14);
    case "HANGUL_PHONETIC": return "일이삼사오육칠팔구십"[(n-1)%10]; case "IDEOGRAPH": case "CIRCLED_IDEOGRAPH": return HAN[(n-1)%10];
    default: return String(n);
  }
}
// 문단 머리(자동 번호·글머리표) 세기: key 마다 단계별 번호를 이어 센다. lv 는 0부터, levels[lv] = {fmt:"^1.", shape, start}
function headMark(state, key, levels, lv){
  const L = levels && levels[lv]; if(!L) return "";
  const c = state[key] = state[key] || [];
  c[lv] = c[lv]==null ? (L.start||1) : c[lv] + 1; c.length = lv + 1;
  return (L.fmt || "").replace(/\^(\d)/g, (_, d)=>{ const i = +d - 1, D = levels[i] || L; return hnum(D.shape, c[i]!=null ? c[i] : (D.start||1)); }).trim();
}
const bulletChar = ch=>!ch || /[\ue000-\uf8ff]/.test(ch) ? "•" : ch;

// =====================================================================
// HWP 5.0 — 복합 문서 파일(CFB) 읽기
// =====================================================================
function cfb(buf){
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const sig = [0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1];
  if(u8.length < 512 || sig.some((b,i)=>u8[i]!==b)) throw new DocErr("한글(HWP) 파일이 아니거나 손상되었습니다.");
  const ss = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true);
  const nFat = dv.getUint32(44, true), dir0 = dv.getUint32(48, true), cutoff = dv.getUint32(56, true);
  const mfat0 = dv.getUint32(60, true), nMfat = dv.getUint32(64, true), difat0 = dv.getUint32(68, true), nDifat = dv.getUint32(72, true);
  const off = n=>(n+1)*ss, END = 0xFFFFFFFE;
  const fatSecs = [];
  for(let i=0;i<109 && fatSecs.length<nFat;i++){ const s = dv.getUint32(76+i*4, true); if(s < 0xFFFFFFFA) fatSecs.push(s); }
  for(let d=difat0, k=0; d < 0xFFFFFFFA && k < nDifat && fatSecs.length < nFat; k++){
    for(let i=0;i<ss/4-1 && fatSecs.length<nFat;i++){ const s = dv.getUint32(off(d)+i*4, true); if(s < 0xFFFFFFFA) fatSecs.push(s); }
    d = dv.getUint32(off(d)+ss-4, true);
  }
  const fat = new Uint32Array(fatSecs.length*ss/4);
  fatSecs.forEach((s,i)=>{ for(let j=0;j<ss/4;j++) if(off(s)+j*4+4 <= u8.length) fat[i*ss/4+j] = dv.getUint32(off(s)+j*4, true); });
  const chain = (start, tbl)=>{ const out = []; for(let s=start, g=0; s < 0xFFFFFFFA && s < tbl.length && g < 1e6; g++){ out.push(s); s = tbl[s]; } return out; };
  const readChain = (start, size)=>{ const ch = chain(start, fat), out = new Uint8Array(ch.length*ss);
    ch.forEach((s,i)=>out.set(u8.subarray(off(s), Math.min(u8.length, off(s)+ss)), i*ss)); return size==null ? out : out.subarray(0, size); };
  const dirBytes = readChain(dir0), dirs = [];
  for(let i=0;i*128+128<=dirBytes.length;i++){
    const b = dirBytes.subarray(i*128, i*128+128), v = new DataView(b.buffer, b.byteOffset, 128), nl = v.getUint16(64, true);
    let name = ""; for(let j=0;j<Math.max(0,nl-2);j+=2) name += String.fromCharCode(v.getUint16(j, true));
    dirs.push({name, type:b[66], left:v.getUint32(68,true), right:v.getUint32(72,true), child:v.getUint32(76,true), start:v.getUint32(116,true), size:v.getUint32(120,true)});
  }
  const root = dirs[0]; if(!root) throw new DocErr("한글(HWP) 파일 구조를 읽지 못했습니다.");
  const mini = readChain(root.start, root.size);
  const mfat = new Uint32Array(Math.max(0,nMfat)*ss/4);
  chain(mfat0, fat).forEach((s,i)=>{ for(let j=0;j<ss/4 && i*ss/4+j<mfat.length;j++) mfat[i*ss/4+j] = dv.getUint32(off(s)+j*4, true); });
  const readMini = (start, size)=>{ const ch = chain(start, mfat), out = new Uint8Array(ch.length*mss); ch.forEach((s,i)=>out.set(mini.subarray(s*mss, s*mss+mss), i*mss)); return out.subarray(0, size); };
  // 경로 → 디렉터리 항목
  const paths = {};
  const walk = (id, pre, seen)=>{ if(id >= dirs.length || id === 0xFFFFFFFF || seen.has(id)) return; seen.add(id); const d = dirs[id];
    walk(d.left, pre, seen); walk(d.right, pre, seen); const p = pre + d.name; paths[p] = d; if(d.type===1) walk(d.child, p + "/", seen); };
  walk(root.child, "", new Set());
  return { has: p=>!!paths[p], list: ()=>Object.keys(paths),
    read(p){ const d = paths[p]; if(!d || d.type!==2) return null; return d.size < cutoff ? readMini(d.start, d.size) : readChain(d.start, d.size); } };
}
async function inflateRaw(u8){
  if(typeof DecompressionStream === "undefined") throw new DocErr("이 브라우저는 한글 파일 압축 풀기를 지원하지 않습니다. 크롬·엣지·사파리 최신판에서 열어 주세요.");
  const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter();
  w.write(u8).catch(()=>{}); w.close().catch(()=>{});
  const r = ds.readable.getReader(), parts = []; let n = 0;
  try{ for(;;){ const {value, done} = await r.read(); if(done) break; parts.push(value); n += value.length; } }
  catch(e){ if(!n) throw new DocErr("한글 파일의 압축을 풀지 못했습니다. 손상된 파일일 수 있습니다."); }
  const out = new Uint8Array(n); let o = 0; parts.forEach(p=>{ out.set(p, o); o += p.length; }); return out;
}
// 레코드 → 나무(레벨로 부모를 정함)
function records(u8){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), root = {tag:-1, lv:-1, kids:[]}, stack = [root];
  let p = 0;
  while(p + 4 <= u8.length){
    const h = dv.getUint32(p, true); p += 4;
    const tag = h & 0x3FF, lv = (h >>> 10) & 0x3FF; let size = (h >>> 20) & 0xFFF;
    if(size === 0xFFF){ if(p + 4 > u8.length) break; size = dv.getUint32(p, true); p += 4; }
    if(p + size > u8.length) size = u8.length - p;
    const rec = {tag, lv, data: u8.subarray(p, p+size), kids:[]}; p += size;
    while(stack.length > 1 && stack[stack.length-1].lv >= lv) stack.pop();
    stack[stack.length-1].kids.push(rec); stack.push(rec);
  }
  return root;
}
const T_NUM = 23, T_BULLET = 24, T_PSHAPE = 25, T_STYLE = 26, T_PARA = 66, T_TEXT = 67, T_CTRL = 71, T_LIST = 72, T_TABLE = 77, T_EQ = 88;
const u16 = (d,o)=>o+2<=d.length ? d[o] | (d[o+1]<<8) : 0, u32 = (d,o)=>o+4<=d.length ? (d[o] | (d[o+1]<<8) | (d[o+2]<<16) | (d[o+3]<<24))>>>0 : 0;
const ctrlId = d=>{ const v = u32(d,0); return String.fromCharCode((v>>>24)&255, (v>>>16)&255, (v>>>8)&255, v&255); };
const wstr = (d,o,n)=>{ let s = ""; for(let i=0;i<n && o+i*2+1<d.length;i++) s += String.fromCharCode(u16(d,o+i*2)); return s; };
const CHAR1 = new Set([0,10,13,24,25,26,27,28,29,30,31]);   // 한 글자짜리 조절 문자. 나머지 1~31 은 8글자(16바이트)를 차지한다.
const EXT = new Set([1,2,3,11,12,14,15,16,17,18,21,22,23]);  // 확장 조절 문자 = 문단 아래 CTRL_HEADER 하나씩과 짝

async function parseHwp(buf, opt){
  const f = cfb(buf);
  const fh = f.read("FileHeader");
  if(!fh || !/^HWP Document File/.test(String.fromCharCode(...fh.subarray(0,17)))) throw new DocErr("한글(HWP) 5.0 파일이 아닙니다. 한글 97 같은 옛 형식은 한글에서 '다른 이름으로 저장 → HWP' 또는 HWPX로 다시 저장해 주세요.");
  const prop = u32(fh, 36), zipped = !!(prop & 1);
  if(prop & 2) throw new DocErr("암호가 걸린 한글 파일이라 열 수 없습니다. 한글에서 암호를 푼 사본을 만든 뒤 넣어 주세요.");
  const warn = [];
  const getS = async p=>{ const r = f.read(p); return r ? (zipped ? await inflateRaw(r) : r) : null; };
  if(prop & 4){
    const pv = f.read("PrvText");
    if(pv && pv.length){ warn.push("배포용 문서라 본문은 잠겨 있습니다. 한글이 파일 안에 넣어 둔 미리 보기 글자(앞부분 일부)만 꺼냈습니다.");
      const s = wstr(pv, 0, pv.length/2).replace(/<|>/g,"");
      return {blocks: s.split(/\r?\n/).filter(x=>x.trim()).map(x=>({t:"p", s:clean(x)})), notes:[], warn, meta:{}}; }
    throw new DocErr("배포용(읽기 전용) 한글 문서라 글자를 꺼낼 수 없습니다.");
  }
  // DocInfo: 스타일 이름(제목·개요) · 문단 모양(문단 머리 종류) · 문단 번호 · 글머리표
  const styles = [], pshapes = [], nums = [], bullets = [];
  try{ const di = await getS("DocInfo"); if(di){ const walkS = r=>{ for(const k of r.kids){ const d = k.data;
      if(k.tag===T_STYLE){ const n = u16(d,0); styles.push(wstr(d,2,n)); }
      else if(k.tag===T_PSHAPE){ const a = u32(d,0); pshapes.push({head:(a>>>23)&3, lv:(a>>>25)&7, ref:u16(d,30)}); }
      else if(k.tag===T_BULLET) bullets.push(bulletChar(String.fromCharCode(u16(d,12))));
      else if(k.tag===T_NUM){ const lvs = []; let o = 0;
        for(let i=0;i<7 && o+14<=d.length;i++){ const fl = u32(d,o), n = u16(d,o+12); lvs.push({fmt:wstr(d,o+14,n), shape:HSHAPE[(fl>>>5)&15] || "DIGIT", start:1}); o += 14 + n*2; }
        const st = u16(d,o); o += 2; lvs.forEach((L,i)=>{ L.start = o + i*4 + 4 <= d.length ? (u32(d, o+i*4) || 1) : (st || 1); });
        nums.push(lvs); }
      walkS(k); } }; walkS(records(di)); } }catch(_){}
  const secs = f.list().filter(p=>/^BodyText\/Section\d+$/.test(p)).sort((a,b)=>+a.match(/\d+$/)[0] - +b.match(/\d+$/)[0]);
  if(!secs.length) throw new DocErr("한글 파일에서 본문을 찾지 못했습니다.");
  const blocks = [], notes = [];
  for(const sp of secs){
    let raw; try{ raw = await getS(sp); }catch(e){ warn.push(`${sp.replace("BodyText/Section","")}번째 구역을 읽지 못했습니다.`); continue; }
    hwpList(records(raw).kids, blocks, {opt, styles, pshapes, nums, bullets, heads:{}, notes, depth:0});
  }
  return {blocks, notes, warn, meta:{sections: secs.length}};
}
function headOf(style){   // 문단 모양 이름 → 마크다운 제목 단계(0 = 제목 아님). '제목' = #, '개요 1~3' = ##~####
  const m = /^(?:개요|Outline)\s*(\d+)/i.exec(style||""); if(m) return +m[1] <= 3 ? +m[1] + 1 : 0;
  if(/^(제목|Title)$/i.test(style||"")) return 1;
  return 0;
}
// 같은 수준의 레코드 목록(문단들)을 블록으로
function hwpList(recs, out, ctx){
  for(const r of recs) if(r.tag===T_PARA) hwpPara(r, out, ctx);
}
function hwpPara(pr, out, ctx){
  const text = pr.kids.find(k=>k.tag===T_TEXT), ctrls = pr.kids.filter(k=>k.tag===T_CTRL);
  const styleId = pr.data[10], style = ctx.styles[styleId] || "", ps = ctx.pshapes[u16(pr.data, 8)];
  let s = "", ci = 0, head = null;
  const flush = ()=>{ let t = clean(s).replace(/[ \t]+$/gm,""); s = "";
    if(!t.trim()) return;
    if(head==null){ head = "";   // 문단 머리(자동 번호·글머리표)는 문단의 첫 줄에 한 번만
      if(ps && ps.head===3) head = ctx.bullets[ps.ref-1] || "•";
      else if(ps && (ps.head===1 || ps.head===2)) head = headMark(ctx.heads, ps.head===1 ? "o" : "n"+ps.ref, ctx.nums[ps.head===1 ? 0 : ps.ref-1], ps.lv);
    }
    const lv = ctx.depth ? 0 : headOf(style), body = t.replace(/^\s+/, "");
    if(lv && t.length <= 120 && !t.includes("\n")) out.push({t:"h", lv, s:(head ? head + " " : "") + body.trim()});
    else if(head){ out.push({t:"li", s:body, lv: ps ? ps.lv : 0, mk: head}); head = ""; }
    else out.push({t:"p", s:t}); };
  if(text){
    const d = text.data;
    for(let o=0; o+1<d.length; ){
      const c = u16(d, o);
      if(c < 32){
        if(CHAR1.has(c)){ if(c===10) s += "\n"; else if(c===24) s += "-"; else if(c===30||c===31) s += " "; o += 2; continue; }
        if(c===9){ s += "\t"; o += 16; continue; }
        if(EXT.has(c)){
          const cr = ctrls[ci++];
          if(cr){ const id = ctrlId(cr.data);
            if(id==="tbl "){ flush(); hwpTable(cr, out, ctx); }
            else if(id==="fn  " || id==="en  "){ if(ctx.opt.notes){ const sub = []; hwpBody(cr, sub, {...ctx, depth:ctx.depth+1}); const k = ctx.notes.push(plain(sub, ctx.opt).trim()); s += `[각주${k}]`; } }
            else if(id==="head" || id==="foot"){ if(ctx.opt.hf){ const sub = []; hwpBody(cr, sub, {...ctx, depth:ctx.depth+1}); const t = plain(sub, ctx.opt).trim(); if(t && !ctx.hfSeen?.has(t)){ (ctx.hfSeen = ctx.hfSeen || new Set()).add(t); flush(); out.push({t:"p", s:(id==="head"?"[머리말] ":"[꼬리말] ")+t}); } } }
            else if(id==="gso "){ const sub = []; hwpBody(cr, sub, {...ctx, depth:ctx.depth+1});
              if(sub.length){ flush(); out.push(...sub); } else if(ctx.opt.img){ flush(); out.push({t:"img"}); } }
            else if(id==="eqed"){ const eq = findTag(cr, T_EQ); if(eq){ const n = u16(eq.data, 4); const sc = wstr(eq.data, 6, n).trim(); if(sc) s += ` [수식: ${sc}] `; } }
          }
          o += 16; continue;
        }
        o += 16; continue;   // 나머지 인라인 조절 문자(필드 끝 등)
      }
      s += String.fromCharCode(c); o += 2;
    }
  } else {
    // 글자는 없고 표·그림만 있는 문단
    for(const cr of ctrls){ const id = ctrlId(cr.data);
      if(id==="tbl ") hwpTable(cr, out, ctx);
      else if(id==="gso "){ const sub = []; hwpBody(cr, sub, {...ctx, depth:ctx.depth+1}); if(sub.length) out.push(...sub); else if(ctx.opt.img) out.push({t:"img"}); } }
  }
  flush();
}
function findTag(r, tag){ for(const k of r.kids){ if(k.tag===tag) return k; const f = findTag(k, tag); if(f) return f; } return null; }
// 조절 문자 아래 어딘가에 있는 문단들(글상자·각주 안)을 모두 블록으로
function hwpBody(r, out, ctx){
  const go = rec=>{ for(const k of rec.kids){ if(k.tag===T_PARA) hwpPara(k, out, ctx); else go(k); } };
  go(r);
}
function hwpTable(cr, out, ctx){
  const ti = cr.kids.findIndex(k=>k.tag===T_TABLE), tb = cr.kids[ti];
  let nr = tb ? u16(tb.data, 4) : 0, nc = tb ? u16(tb.data, 6) : 0;
  const cells = [], cap = []; let cur = null, seq = 0;
  const ok = a=>a.c < nc && a.r < nr && a.cs >= 1 && a.rs >= 1 && a.c + a.cs <= nc && a.r + a.rs <= nr;
  cr.kids.forEach((k, i)=>{
    if(k.tag===T_LIST){
      if(ti >= 0 && i < ti){ cur = {cap:true, blocks:cap}; return; }   // 표 정보 앞의 목록 = 캡션
      const d = k.data, at = o=>({c:u16(d,o), r:u16(d,o+2), cs:u16(d,o+4), rs:u16(d,o+6)});
      let a = at(8); if(!ok(a)) a = at(6);
      if(!ok(a)) a = {c: nc ? seq % nc : seq, r: nc ? Math.floor(seq / nc) : 0, cs:1, rs:1};   // 칸 주소를 못 읽으면 차례대로
      seq++; cur = {...a, blocks:[]}; cells.push(cur);
    } else if(k.tag===T_PARA && cur) hwpPara(k, cur.blocks, {...ctx, depth:ctx.depth+1});
  });
  if(cells.length){
    nr = Math.max(nr, ...cells.map(c=>c.r + c.rs)); nc = Math.max(nc, ...cells.map(c=>c.c + c.cs));
    out.push(grid(cells.map(c=>({r:c.r, c:c.c, rs:c.rs, cs:c.cs, s:cellText(c.blocks, ctx.opt)})), nr, nc));
  }
  const ct = plain(cap, ctx.opt).trim(); if(ct) out.push({t:"p", s:ct});
}
// 칸 목록 → 표 블록. 칸 = {r, c, rs, cs, s}
function grid(cells, nr, nc){
  nr = Math.min(nr, 2000); nc = Math.min(nc, 200);
  const rows = Array.from({length:nr}, ()=>Array.from({length:nc}, ()=>null));
  for(const c of cells){ if(c.r>=nr || c.c>=nc) continue;
    for(let i=0;i<c.rs && c.r+i<nr;i++) for(let j=0;j<c.cs && c.c+j<nc;j++) rows[c.r+i][c.c+j] = {s:c.s, ...(i||j ? {m:i?"r":"c"} : {cs:c.cs, rs:c.rs})}; }
  const keep = rows.filter(r=>r.some(x=>x && x.s)).map(r=>r.map(x=>x || {s:""}));
  // 글자가 든 칸이 하나도 시작하지 않는 열(빈 간격 열·합친 칸의 나머지)은 뺀다
  const used = Array.from({length:nc}, (_,j)=>keep.some(r=>r[j].s && !r[j].m));
  return {t:"tbl", rows: keep.map(r=>r.filter((_,j)=>used[j]))};
}
const cellText = (blocks, opt)=>plain(blocks, opt).trim().replace(/\n{2,}/g,"\n");

// =====================================================================
// HWPX — OWPML(XML) 읽기
// =====================================================================
async function parseHwpx(buf, opt){
  const JSZip = await zipLib(); let z;
  try{ z = await JSZip.loadAsync(buf); }catch(_){ throw new DocErr("HWPX 파일을 열지 못했습니다. 손상되었거나 HWPX가 아닌 파일입니다."); }
  const names = Object.keys(z.files), secs = names.filter(n=>/^Contents\/section\d+\.xml$/i.test(n)).sort((a,b)=>+a.match(/(\d+)\.xml$/i)[1] - +b.match(/(\d+)\.xml$/i)[1]);
  if(!secs.length){ if(z.file("META-INF/manifest.xml") && names.some(n=>/encrypt/i.test(n))) throw new DocErr("암호가 걸린 HWPX 파일이라 열 수 없습니다."); throw new DocErr("HWPX 파일에서 본문을 찾지 못했습니다."); }
  const styles = {}, paraPr = {}, nums = {}, bullets = {};
  const hx = z.file("Contents/header.xml");
  if(hx){ try{ const H = xml(await hx.async("string"));
    desc(H, "style").forEach(s=>styles[attr(s,"id")] = attr(s,"name") || attr(s,"engName") || "");
    desc(H, "paraPr").forEach(p=>{ const h = desc(p, "heading")[0]; if(h) paraPr[attr(p,"id")] = {type:attr(h,"type"), ref:attr(h,"idRef"), lv:+(attr(h,"level")||0)}; });
    desc(H, "numbering").forEach(n=>{ const L = []; kids(n, "paraHead").forEach(ph=>{ L[(+attr(ph,"level")||1)-1] = {fmt:ph.textContent, shape:attr(ph,"numFormat")||"DIGIT", start:+(attr(ph,"start")||1)}; }); nums[attr(n,"id")] = L; });
    desc(H, "bullet").forEach(b=>bullets[attr(b,"id")] = bulletChar(attr(b,"char")));
  }catch(_){} }
  const blocks = [], notes = [], ctx = {opt, styles, paraPr, nums, bullets, heads:{}, notes, depth:0};
  for(const sp of secs){ const D = xml(await z.file(sp).async("string")); const root = D.documentElement;
    ctx.outline = attr(desc(root, "secPr")[0], "outlineShapeIDRef") || ctx.outline || "1";
    hxList(kids(root, "p"), blocks, ctx); }
  return {blocks, notes, warn:[], meta:{sections: secs.length}};
}
function hxList(ps, out, ctx){ for(const p of ps) hxPara(p, out, ctx); }
// el 아래의 subList 가운데 다른 subList 안에 들어 있지 않은 것만(안쪽 표·글상자는 그 문단을 읽을 때 따로 읽는다)
function hxSub(el, out, ctx){
  for(const sl of desc(el, "subList")){ let q = sl.parentElement, inner = false; while(q && q!==el){ if(q.localName==="subList"){ inner = true; break; } q = q.parentElement; }
    if(!inner) hxList(kids(sl, "p"), out, {...ctx, depth:ctx.depth+1}); }
}
function hxPara(p, out, ctx){
  const style = ctx.styles[attr(p,"styleIDRef")] || "", ph = ctx.paraPr[attr(p,"paraPrIDRef")];
  let s = "", head = null;
  const flush = ()=>{ let t = clean(s).replace(/[ \t]+$/gm,""); s = ""; if(!t.trim()) return;
    if(head==null){ head = "";
      if(ph && ph.type==="BULLET") head = ctx.bullets[ph.ref] || "•";
      else if(ph && ph.type==="OUTLINE") head = headMark(ctx.heads, "o", ctx.nums[ctx.outline], ph.lv);
      else if(ph && ph.type==="NUMBER") head = headMark(ctx.heads, "n"+ph.ref, ctx.nums[ph.ref], ph.lv);
    }
    const lv = ctx.depth ? 0 : headOf(style), body = t.replace(/^\s+/, "");
    if(lv && t.length <= 120 && !t.includes("\n")) out.push({t:"h", lv, s:(head ? head + " " : "") + body.trim()});
    else if(head){ out.push({t:"li", s:body, lv: ph ? ph.lv : 0, mk: head}); head = ""; }
    else out.push({t:"p", s:t}); };
  for(const run of kids(p, "run")){
    for(const el of run.children){
      const n = el.localName;
      if(n==="t") s += hxText(el);
      else if(n==="tbl"){ flush(); hxTable(el, out, ctx); }
      else if(n==="ctrl"){
        for(const c of el.children){ const cn = c.localName;
          if((cn==="footNote" || cn==="endNote") && ctx.opt.notes){ const sub = []; hxSub(c, sub, ctx); const k = ctx.notes.push(plain(sub, ctx.opt).trim()); s += `[각주${k}]`; }
          else if((cn==="header" || cn==="footer") && ctx.opt.hf){ const sub = []; hxSub(c, sub, ctx); const t = plain(sub, ctx.opt).trim(); if(t && !ctx.hfSeen?.has(t)){ (ctx.hfSeen = ctx.hfSeen || new Set()).add(t); flush(); out.push({t:"p", s:(cn==="header"?"[머리말] ":"[꼬리말] ")+t}); } }
        }
      }
      else if(n==="equation"){ const sc = (desc(el,"script")[0]||{}).textContent || ""; if(sc.trim()) s += ` [수식: ${sc.trim()}] `; }
      else if(n==="dutmal"){ const mt = (kid(el,"mainText")||{}).textContent || "", st = (kid(el,"subText")||{}).textContent || ""; s += mt + (st.trim() ? `(${st.trim()})` : ""); }   // 덧말
      else if(n==="compose"){ s += attr(el,"composeText") || ""; }   // 글자 겹치기
      else if(n==="textart"){ const ta = (attr(el,"text")||"").replace(/\u240d?\u240a|\u240d/g, "\n"); if(ta.trim()){ flush(); out.push({t:"p", s:clean(ta).trim()}); } }   // 글맵시
      else if(["rect","ellipse","polygon","curve","arc","container","textart","line","connectLine"].includes(n)){
        const sub = []; hxSub(el, sub, ctx); if(sub.length){ flush(); out.push(...sub); } }
      else if(n==="pic" || n==="ole"){ if(ctx.opt.img){ flush(); out.push({t:"img"}); } }
    }
  }
  flush();
}
function hxText(t){
  let s = "";
  for(const n of t.childNodes){
    if(n.nodeType===3) s += n.nodeValue;
    else if(n.nodeType===1){ const ln = n.localName;
      if(ln==="tab") s += "\t"; else if(ln==="lineBreak") s += "\n"; else if(ln==="hyphen") s += "-"; else if(ln==="nbSpace" || ln==="fwSpace") s += " ";
      else if(!/^(markpen|titleMark|insert|delete|indexmark)/.test(ln)) s += n.textContent || ""; }
  }
  return s;
}
function hxTable(tb, out, ctx){
  const cells = [];
  for(const tr of kids(tb, "tr")) for(const tc of kids(tr, "tc")){
    const ad = kid(tc, "cellAddr"), sp = kid(tc, "cellSpan"), sub = [];
    for(const sl of kids(tc, "subList")) hxList(kids(sl, "p"), sub, {...ctx, depth:ctx.depth+1});
    cells.push({r:+attr(ad,"rowAddr")||0, c:+attr(ad,"colAddr")||0, rs:+attr(sp,"rowSpan")||1, cs:+attr(sp,"colSpan")||1, s:cellText(sub, ctx.opt)});
  }
  if(!cells.length) return;
  const nr = Math.max(+attr(tb,"rowCnt")||0, ...cells.map(c=>c.r+c.rs)), nc = Math.max(+attr(tb,"colCnt")||0, ...cells.map(c=>c.c+c.cs));
  out.push(grid(cells, nr, nc));
}

// =====================================================================
// DOCX — 워드
// =====================================================================
const NUMFMT = {
  decimal: n=>n+"", decimalZero: n=>String(n).padStart(2,"0"), lowerLetter: n=>String.fromCharCode(96+((n-1)%26+1)), upperLetter: n=>String.fromCharCode(64+((n-1)%26+1)),
  lowerRoman: n=>roman(n).toLowerCase(), upperRoman: n=>roman(n), ganada: n=>"가나다라마바사아자차카타파하"[(n-1)%14], chosung: n=>"ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ"[(n-1)%14],
  decimalEnclosedCircle: n=>n<=20 ? String.fromCharCode(0x2460+n-1) : `(${n})`, koreanDigital: n=>"일이삼사오육칠팔구십"[(n-1)%10], koreanCounting: n=>"하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열".split(" ")[(n-1)%10]
};
function roman(n){ const v=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]; let s=""; for(const [a,b] of v) while(n>=a){ s+=b; n-=a; } return s; }
async function parseDocx(buf, opt){
  const JSZip = await zipLib(); let z;
  try{ z = await JSZip.loadAsync(buf); }catch(_){ throw new DocErr("워드 파일을 열지 못했습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다. (.doc 옛 형식은 워드에서 .docx로 다시 저장해 주세요)"); }
  const get = async p=>z.file(p) ? xml(await z.file(p).async("string")) : null;
  const doc = await get("word/document.xml"); if(!doc) throw new DocErr("워드(.docx) 파일에서 본문을 찾지 못했습니다.");
  const st = await get("word/styles.xml"), nm = await get("word/numbering.xml"), fn = await get("word/footnotes.xml"), en = await get("word/endnotes.xml");
  // 스타일: id → {name, basedOn, numPr, outline}
  const S = {};
  desc(st, "style").forEach(s=>{ const pPr = kid(s,"pPr"), np = kid(pPr,"numPr");
    S[attr(s,"styleId")] = {name:(attr(kid(s,"name"),"val")||"").toLowerCase(), base:attr(kid(s,"basedOn"),"val"), num: np ? {id:attr(kid(np,"numId"),"val"), lv:+(attr(kid(np,"ilvl"),"val")||0)} : null, ol: kid(pPr,"outlineLvl") ? +attr(kid(pPr,"outlineLvl"),"val") : null}; });
  const sty = (id, k, g=0)=>{ const s = S[id]; if(!s || g>8) return null; return s[k]!=null ? s[k] : sty(s.base, k, g+1); };
  // 번호 매기기: numId → abstract 의 단계별 {fmt, text, start}
  const ABS = {}, NUM = {};
  desc(nm, "abstractNum").forEach(a=>{ const L = {}; kids(a,"lvl").forEach(l=>L[+attr(l,"ilvl")] = {fmt:attr(kid(l,"numFmt"),"val")||"decimal", text:attr(kid(l,"lvlText"),"val")||"", start:+(attr(kid(l,"start"),"val")||1)}); ABS[attr(a,"abstractNumId")] = L; });
  desc(nm, "num").forEach(n=>{ if(n.parentElement && n.parentElement.localName!=="numbering") return; NUM[attr(n,"numId")] = attr(kid(n,"abstractNumId"),"val"); });
  const counters = {};
  const listMark = (numId, lv)=>{ const L = ABS[NUM[numId]]; if(!L || numId==="0") return null; const def = L[lv] || {fmt:"bullet", text:"•"};
    if(def.fmt==="bullet" || def.fmt==="none") return def.fmt==="none" ? "" : "-";
    const c = counters[numId] = counters[numId] || {}; c[lv] = (c[lv]==null ? def.start : c[lv]+1); for(const k in c) if(+k>lv) delete c[k];
    let t = def.text || `%${lv+1}.`; t = t.replace(/%(\d)/g, (_,d)=>{ const i=+d-1, D=L[i]||def, v = i===lv ? c[lv] : (c[i]!=null ? c[i] : (D.start||1)); return (NUMFMT[D.fmt]||NUMFMT.decimal)(v); });
    return t.trim() || "-"; };
  // 각주
  const FN = {};
  for(const [d, tag] of [[fn,"footnote"],[en,"endnote"]]) desc(d, tag).forEach(n=>{ const sub = []; kids(n,"p").forEach(p=>dxPara(p, sub, null)); FN[tag+":"+attr(n,"id")] = plain(sub, opt).trim(); });
  const notes = [], blocks = [];
  const ctx = {opt, sty, listMark, FN, notes};
  function dxPara(p, out, c){
    let s = "", extra = [];
    const walk = el=>{ for(const n of el.children){ const ln = n.localName;
      if(ln==="r" || ln==="hyperlink" || ln==="ins" || ln==="smartTag" || ln==="fldSimple" || ln==="sdt" || ln==="sdtContent" || ln==="customXml" || ln==="moveTo") walk(n);
      else if(ln==="t") s += n.textContent;
      else if(ln==="tab" && el.localName==="r") s += "\t";
      else if(ln==="br"){ if(attr(n,"type")!=="page" && attr(n,"type")!=="column") s += "\n"; }
      else if(ln==="cr") s += "\n";
      else if(ln==="noBreakHyphen") s += "-";
      else if(ln==="sym"){ const ch = attr(n,"char"); if(ch && /^[0-9A-F]{4}$/i.test(ch) && parseInt(ch,16) < 0xF000) s += String.fromCharCode(parseInt(ch,16)); }
      else if((ln==="footnoteReference" || ln==="endnoteReference") && c && c.opt.notes){ const t = c.FN[(ln==="footnoteReference"?"footnote:":"endnote:")+attr(n,"id")]; if(t){ const k = c.notes.push(t); s += `[각주${k}]`; } }
      else if(ln==="AlternateContent"){ const ch = kid(n,"Choice") || kid(n,"Fallback"); if(ch) walk(ch); }
      else if(ln==="drawing" || ln==="pict" || ln==="object"){ const tx = desc(n,"txbxContent"); if(tx.length){ tx.forEach(b=>kids(b,"p").forEach(q=>dxPara(q, extra, c))); } else if(c && c.opt.img) extra.push({t:"img"}); }
      else if(ln==="txbxContent"){ kids(n,"p").forEach(q=>dxPara(q, extra, c)); }
    } };
    walk(p);
    const t = clean(s).replace(/[ \t]+$/gm,"");
    if(t.trim() && c){
      const pPr = kid(p,"pPr"), sid = attr(kid(pPr,"pStyle"),"val"), name = (S[sid]||{}).name || "";
      const np = kid(pPr,"numPr"), num = np ? {id:attr(kid(np,"numId"),"val"), lv:+(attr(kid(np,"ilvl"),"val")||0)} : c.sty(sid, "num");
      const ol = kid(pPr,"outlineLvl") ? +attr(kid(pPr,"outlineLvl"),"val") : c.sty(sid, "ol");
      const hm = /^heading (\d)$/.exec(name) || /^제목 (\d)$/.exec(name);
      const lv = name==="title" || name==="제목" ? 1 : hm ? +hm[1] : (ol!=null && ol < 9 ? ol+1 : 0);
      if(lv && t.length <= 150 && !t.includes("\n")) out.push({t:"h", lv:Math.min(6,lv), s:t.trim()});
      else if(num && num.id){ const mk = c.listMark(num.id, num.lv); if(mk!=null && mk!=="") out.push({t:"li", s:t.trim(), lv:num.lv, mk}); else out.push({t:"p", s:t}); }
      else out.push({t:"p", s:t});
    } else if(t.trim()) out.push({t:"p", s:t});
    out.push(...extra);
  }
  function dxTable(tb, out, c){
    const cells = [], col = {}; let r = 0;
    for(const tr of kids(tb, "tr")){
      let ci = 0;
      for(const tc of kids(tr, "tc")){
        const pr = kid(tc,"tcPr"), cs = +(attr(kid(pr,"gridSpan"),"val")||1), vm = kid(pr,"vMerge");
        if(vm && attr(vm,"val")!=="restart"){ const top = col[ci]; if(top){ top.rs++; } ci += cs; continue; }
        const sub = []; dxBody(tc, sub, c);
        const cell = {r, c:ci, rs:1, cs, s:cellText(sub, c.opt)}; cells.push(cell);
        for(let k=0;k<cs;k++) col[ci+k] = vm ? cell : null;
        if(vm) col[ci] = cell;
        ci += cs;
      }
      r++;
    }
    if(cells.length) out.push(grid(cells, r, Math.max(...cells.map(x=>x.c+x.cs))));
  }
  function dxBody(el, out, c){ for(const n of el.children){ const ln = n.localName;
    if(ln==="p") dxPara(n, out, c); else if(ln==="tbl") dxTable(n, out, c); else if(ln==="sdt"){ const sc = kid(n,"sdtContent"); if(sc) dxBody(sc, out, c); } else if(ln==="customXml") dxBody(n, out, c); } }
  if(opt.hf){ const hf = Object.keys(z.files).filter(n=>/^word\/(header|footer)\d*\.xml$/.test(n)).sort(), seen = new Set();
    for(const h of hf){ const sub = []; const D = await get(h); dxBody(D.documentElement, sub, ctx); const t = plain(sub, opt).trim(); if(t && !seen.has(t)){ seen.add(t); blocks.push({t:"p", s:(/header/.test(h)?"[머리말] ":"[꼬리말] ")+t}); } } }
  dxBody(kid(doc.documentElement, "body"), blocks, ctx);
  return {blocks, notes, warn:[], meta:{}};
}

// =====================================================================
// PPTX — 파워포인트
// =====================================================================
async function parsePptx(buf, opt){
  const JSZip = await zipLib(); let z;
  try{ z = await JSZip.loadAsync(buf); }catch(_){ throw new DocErr("파워포인트 파일을 열지 못했습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다. (.ppt 옛 형식은 파워포인트에서 .pptx로 다시 저장해 주세요)"); }
  const get = async p=>z.file(p) ? xml(await z.file(p).async("string")) : null;
  const rels = async p=>{ const d = p.lastIndexOf("/"), r = await get(p.slice(0,d) + "/_rels/" + p.slice(d+1) + ".rels"), m = {};
    desc(r, "Relationship").forEach(x=>{ m[attr(x,"Id")] = {t: resolve(p, attr(x,"Target")), type: attr(x,"Type")||""}; }); return m; };
  const pres = await get("ppt/presentation.xml"); if(!pres) throw new DocErr("파워포인트(.pptx) 파일에서 슬라이드를 찾지 못했습니다.");
  const pr = await rels("ppt/presentation.xml");
  let order = desc(pres, "sldId").map(s=>(pr[attr(s,"id")]||{}).t).filter(Boolean);
  if(!order.length) order = Object.keys(z.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>+a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
  const blocks = [];
  for(let i=0;i<order.length;i++){
    const D = await get(order[i]); if(!D) continue;
    const R = await rels(order[i]), hide = attr(D.documentElement, "show")==="0";
    const items = []; await pxTree(kid(kid(D.documentElement,"cSld"),"spTree"), items, {opt, R, get, z}, 0, 0);
    items.sort((a,b)=>(b.title-a.title) || (a.y-b.y) || (a.x-b.x));
    const title = items.find(x=>x.title && x.blocks.length);
    const tt = title ? plain(title.blocks, opt).replace(/\s+/g," ").trim() : "";
    blocks.push({t:"slide", n:i+1, s:tt, hide});
    items.forEach(x=>{ if(x!==title) blocks.push(...x.blocks); });
    if(opt.memo){ const nt = Object.values(R).find(x=>/notesSlide$/.test(x.type));
      if(nt){ const N = await get(nt.t); if(N){ const sub = [];
        for(const sp of desc(N, "sp")){ const ph = desc(kid(sp,"nvSpPr"),"ph")[0]; if(!ph || attr(ph,"type")!=="body") continue; pxText(kid(sp,"txBody"), sub, false); }
        const t = plain(sub, opt).trim(); if(t) blocks.push({t:"memo", s:t}); } } }
  }
  return {blocks, notes:[], warn:[], meta:{slides: order.length}};
}
function resolve(base, t){ if(!t) return t; if(t.startsWith("/")) return t.slice(1); const parts = base.split("/").slice(0,-1); for(const s of t.split("/")){ if(s==="..") parts.pop(); else if(s!==".") parts.push(s); } return parts.join("/"); }
const emu = el=>{ const off = el ? desc(el, "off")[0] : null; return {x: +(attr(off,"x")||0), y: +(attr(off,"y")||0)}; };
async function pxTree(tree, items, c, gx, gy){
  if(!tree) return;
  for(const n of tree.children){ const ln = n.localName;
    if(ln==="sp"){ const ph = desc(kid(n,"nvSpPr"),"ph")[0], type = attr(ph,"type"), pos = emu(kid(n,"spPr"));
      if(type==="sldNum" || type==="dt" || type==="ftr") continue;
      const title = type==="title" || type==="ctrTitle", body = !!ph && !title && (type==null || type==="body" || type==="obj"), sub = [];
      pxText(kid(n,"txBody"), sub, body && !(type==="subTitle"));
      if(sub.length) items.push({title, x:gx+pos.x, y:gy+pos.y, blocks:sub}); }
    else if(ln==="grpSp"){ const pos = emu(kid(n,"grpSpPr")), sub = []; await pxTree(n, sub, c, 0, 0); sub.sort((a,b)=>(a.y-b.y)||(a.x-b.x));
      const bl = sub.flatMap(x=>x.blocks); if(bl.length) items.push({title:false, x:gx+pos.x, y:gy+pos.y, blocks:bl}); }
    else if(ln==="graphicFrame"){ const pos = emu(kid(n,"xfrm")), gd = desc(n,"graphicData")[0], uri = attr(gd,"uri")||"", sub = [];
      if(/table/.test(uri)){ const tb = desc(gd,"tbl")[0]; if(tb) pxTable(tb, sub, c.opt); }
      else if(/diagram/.test(uri)){ const ri = desc(gd,"relIds")[0], dm = ri && c.R[attr(ri,"dm")]; if(dm){ const D = await c.get(dm.t);
        if(D) desc(D,"pt").forEach(pt=>{ const ty = attr(pt,"type"); if(ty && ty!=="node" && ty!=="asst") return; const tb = kid(pt,"t"); if(!tb) return; const t = desc(tb,"p").map(p=>pxRuns(p)).join(" ").replace(/\s+/g," ").trim(); if(t) sub.push({t:"li", s:t, lv:0, mk:"-"}); }); } }
      else if(/chart/.test(uri) && c.opt.img) sub.push({t:"img", s:"차트"});
      if(sub.length) items.push({title:false, x:gx+pos.x, y:gy+pos.y, blocks:sub}); }
    else if(ln==="pic" && c.opt.img){ const pos = emu(kid(n,"spPr")); items.push({title:false, x:gx+pos.x, y:gy+pos.y, blocks:[{t:"img"}]}); }
    else if(ln==="AlternateContent"){ const ch = kid(n,"Choice") || kid(n,"Fallback"); if(ch) await pxTree(ch, items, c, gx, gy); }
  }
}
function pxRuns(p){ let s = ""; for(const n of p.children){ const ln = n.localName; if(ln==="r" || ln==="fld"){ const t = kid(n,"t"); if(t) s += t.textContent; } else if(ln==="br") s += "\n"; } return s; }
function pxText(tx, out, bulletDefault){
  if(!tx) return;
  for(const p of kids(tx, "p")){
    const t = clean(pxRuns(p)).replace(/[ \t]+$/gm,""); if(!t.trim()) continue;
    const pPr = kid(p,"pPr"), lv = +(attr(pPr,"lvl")||0);
    const bu = kid(pPr,"buChar") ? "-" : kid(pPr,"buAutoNum") ? "1." : kid(pPr,"buNone") ? null : (bulletDefault ? "-" : null);
    out.push(bu ? {t:"li", s:t.trim(), lv, mk:bu} : {t:"p", s:t});
  }
  // 자동 번호는 순서대로 다시 센다
  let k = 0; out.forEach(b=>{ if(b.t==="li" && b.mk==="1.") b.mk = (++k)+"."; else if(b.t!=="li") k = 0; });
}
function pxTable(tb, out, opt){
  const cells = []; let r = 0;
  for(const tr of kids(tb,"tr")){ let ci = 0;
    for(const tc of kids(tr,"tc")){
      if(attr(tc,"hMerge")==="1" || attr(tc,"vMerge")==="1"){ ci++; continue; }
      const sub = []; pxText(kid(tc,"txBody"), sub, false);
      cells.push({r, c:ci, rs:+(attr(tc,"rowSpan")||1), cs:+(attr(tc,"gridSpan")||1), s:cellText(sub, opt)}); ci++;
    }
    r++; }
  if(cells.length) out.push(grid(cells, r, Math.max(...cells.map(x=>x.c+x.cs))));
}

// =====================================================================
// 글로 그리기
// =====================================================================
// 목록 들여쓰기: 첫 항목은 0단계, 그다음은 앞 항목보다 한 단계까지만 더 들여 쓴다
let LVS = [];
function lvOf(b, cont){ const raw = b.lv||0; if(!cont) LVS = [];
  while(LVS.length && LVS[LVS.length-1].raw > raw) LVS.pop();
  const top = LVS[LVS.length-1]; let eff;
  if(!top) eff = 0; else if(top.raw===raw) eff = top.eff; else eff = top.eff + 1;
  if(!top || top.raw!==raw) LVS.push({raw, eff}); return eff; }
function plain(blocks, opt){
  const out = []; let prev = "", prev2 = "", lastLv = -1;
  for(const b of blocks){
    if(prev==="li" && b.t!=="li") out.push("");
    prev2 = prev; prev = b.t;
    if(b.t==="h" || b.t==="p") out.push(b.s, "");
    else if(b.t==="li"){ const lv = lvOf(b, prev2==="li"); out.push("  ".repeat(lv) + (b.mk==="-" ? "• " : b.mk + " ") + b.s.replace(/\n/g, " ")); }
    else if(b.t==="tbl"){ if(b.rows.length===1 && b.rows[0].length===1){ out.push(b.rows[0][0].s, ""); continue; }   // 한 칸짜리 표(상자)는 글로
      out.push(""); b.rows.forEach(r=>out.push(cellsOf(r, opt).map(x=>x.replace(/\n/g," / ")).join(" | "))); out.push(""); }
    else if(b.t==="slide") out.push("", `[슬라이드 ${b.n}${b.hide?" · 숨긴 슬라이드":""}]${b.s?" "+b.s:""}`, "");
    else if(b.t==="memo") out.push("(발표자 메모) " + b.s, "");
    else if(b.t==="img") out.push(b.s ? `[${b.s}]` : "[그림]", "");
  }
  return tidy(out.join("\n"));
}
function cellsOf(r, opt){ return r.map(x=>x.m && !(opt && opt.fill) ? "" : (x.m==="c" && opt && opt.fill ? "" : x.s)); }
function md(blocks, opt){
  const out = [], e = s=>s.replace(/\\/g,"\\\\").replace(/\|/g,"\\|");
  let prevLi = false, lastLv = -1;
  for(const b of blocks){
    if(b.t!=="li" && prevLi){ out.push(""); prevLi = false; lastLv = -1; }
    if(b.t==="h") out.push("#".repeat(b.lv) + " " + b.s, "");
    else if(b.t==="p") out.push(b.s.replace(/\n/g, "  \n"), "");
    else if(b.t==="li"){ const lv = lvOf(b, prevLi);   // 앞 항목보다 두 단계 이상 들여 쓰면 코드 칸으로 읽혀서 한 단계씩만
      out.push("  ".repeat(lv) + (b.mk==="-" || b.mk==="•" ? "-" : b.mk) + " " + b.s.replace(/\n/g, " ")); prevLi = true; }
    else if(b.t==="tbl"){
      const rows = b.rows.map(r=>cellsOf(r, opt).map(x=>e(x).replace(/\n/g,"<br>")));
      if(!rows.length) continue;
      const n = Math.max(...rows.map(r=>r.length));
      if(n===1 && rows.length===1){ out.push(rows[0][0].replace(/<br>/g,"\n"), ""); continue; }   // 한 칸짜리 표(상자)는 글로
      const pad = r=>Array.from({length:n}, (_,i)=>r[i]||"");
      out.push("| " + pad(rows[0]).join(" | ") + " |", "|" + Array(n).fill(" --- ").join("|") + "|", ...rows.slice(1).map(r=>"| " + pad(r).join(" | ") + " |"), "");
    }
    else if(b.t==="slide") out.push("---", "", `## 슬라이드 ${b.n}${b.hide?" (숨긴 슬라이드)":""}${b.s?": "+b.s:""}`, "");
    else if(b.t==="memo") out.push("> 발표자 메모: " + b.s.replace(/\n/g, "\n> "), "");
    else if(b.t==="img") out.push(b.s ? `[${b.s}]` : "[그림]", "");
  }
  return tidy(out.join("\n")).replace(/^---\n\n/, "");
}
const tidy = s=>s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

async function parse(name, buf, opt){
  opt = Object.assign({notes:true, hf:false, memo:true, img:false, fill:true}, opt||{});
  const u8 = new Uint8Array(buf.slice ? buf.slice(0, 8) : buf);
  const ext = (name.match(/\.([a-z0-9]+)$/i)||[])[1]?.toLowerCase() || "";
  const isZip = u8[0]===0x50 && u8[1]===0x4B, isCfb = u8[0]===0xD0 && u8[1]===0xCF;
  if(ext==="hwp" || (isCfb && ext!=="doc" && ext!=="ppt" && ext!=="xls")){ if(!isCfb) throw new DocErr(isZip ? "확장자는 .hwp지만 HWPX 형식입니다. 이름 끝을 .hwpx로 바꾸거나 그대로 다시 넣어 주세요." : "한글(HWP) 파일이 아니거나 손상되었습니다."); return {kind:"hwp", ...await parseHwp(buf, opt)}; }
  if(ext==="doc" || ext==="ppt" || ext==="xls") throw new DocErr(`.${ext}는 오래된 형식이라 읽지 못합니다. ${ext==="doc"?"워드":ext==="ppt"?"파워포인트":"엑셀"}에서 '다른 이름으로 저장'으로 .${ext}x 형식으로 바꿔 넣어 주세요.`);
  if(ext==="xlsx" || ext==="csv") throw new DocErr("엑셀 파일은 '엑셀·CSV → 마크다운 표 변환' 도구에서 바로 표로 바꿀 수 있습니다.");
  if(!isZip) throw new DocErr("한글(.hwp·.hwpx)·워드(.docx)·파워포인트(.pptx) 파일만 읽을 수 있습니다.");
  const JSZip = await zipLib(), z = await JSZip.loadAsync(buf).catch(()=>null);
  if(!z) throw new DocErr("파일을 열지 못했습니다. 손상되었거나 암호가 걸린 파일일 수 있습니다.");
  if(z.file("word/document.xml")) return {kind:"docx", ...await parseDocx(buf, opt)};
  if(z.file("ppt/presentation.xml")) return {kind:"pptx", ...await parsePptx(buf, opt)};
  if(Object.keys(z.files).some(n=>/^Contents\/section\d+\.xml$/i.test(n)) || z.file("Contents/content.hpf")) return {kind:"hwpx", ...await parseHwpx(buf, opt)};
  if(z.file("xl/workbook.xml")) throw new DocErr("엑셀 파일은 '엑셀·CSV → 마크다운 표 변환' 도구에서 바로 표로 바꿀 수 있습니다.");
  throw new DocErr("한글·워드·파워포인트 문서가 아닙니다.");
}
const SHIFT_DT = {parse, plain, md, DocErr};
if(typeof window!=="undefined") window.SHIFT_DT = SHIFT_DT;

// =====================================================================
// 화면
// =====================================================================
const $ = id=>document.getElementById(id);
if(typeof document==="undefined" || !$("dtDrop")) return;
const TOK = "/lib/gpt-tokenizer/o200k.js", MAXF = 20, MAXB = 200*1024*1024;
const KIND = {hwp:"한글 HWP", hwpx:"한글 HWPX", docx:"워드", pptx:"파워포인트"}, ICO = {hwp:"HWP", hwpx:"HWPX", docx:"DOCX", pptx:"PPTX"};
let docs = [], busy = false, tokT = null;
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const kb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const opt = ()=>({fill:$("dtFill").checked, notes:$("dtNotes").checked, memo:$("dtMemo").checked, hf:$("dtHf").checked, img:$("dtImg").checked});
const fmt = ()=>document.querySelector("input[name=dtFmt]:checked").value;
const say = m=>{ $("dtStatus").textContent = m; };
const base = n=>String(n||"문서").replace(/\.(hwpx?|docx|pptx)$/i,"");
const OK_EXT = /\.(hwp|hwpx|docx|pptx|doc|ppt|xls|xlsx)$/i;

async function add(list){
  list = [...list];
  const fs = list.filter(f=>OK_EXT.test(f.name));
  if(!fs.length){ toast("한글·워드·파워포인트 파일만 넣을 수 있습니다"); return; }
  if(docs.length + fs.length > MAXF) toast(`한 번에 ${MAXF}개까지 넣을 수 있습니다`);
  for(const f of fs.slice(0, Math.max(0, MAXF - docs.length))){
    const d = {name:f.name, size:f.size};
    if(f.size > MAXB){ d.err = "파일이 너무 큽니다(200MB까지)."; docs.push(d); continue; }
    try{ d.buf = await f.arrayBuffer(); }catch(_){ d.err = "파일을 읽지 못했습니다."; }
    docs.push(d);
  }
  await parseAll();
}
async function parseAll(){
  if(busy) return; busy = true; draw();
  const o = opt(); let k = 0;
  for(const d of docs){
    k++; if(!d.buf) continue;
    say(`읽는 중… (${k}/${docs.length})`);
    try{ d.res = await parse(d.name, d.buf.slice(0), o); d.err = null; }
    catch(e){ d.res = null; d.err = e instanceof DocErr ? e.message : "읽지 못했습니다. 손상되었거나 지원하지 않는 형식일 수 있습니다."; if(!(e instanceof DocErr)) console.warn(e); }
  }
  busy = false;
  const ok = docs.filter(d=>d.res).length;
  say(!docs.length ? "" : ok ? `${ok}개 문서를 다 읽었습니다` : "읽은 문서가 없습니다");
  draw(); render();
}
function stats(d){
  const b = d.res.blocks, tbl = b.filter(x=>x.t==="tbl").length, sl = b.filter(x=>x.t==="slide").length;
  return [KIND[d.res.kind], sl ? `슬라이드 ${sl}장` : "", tbl ? `표 ${tbl}개` : "", d.res.notes.length ? `각주 ${d.res.notes.length}개` : ""].filter(Boolean).join(" · ");
}
function draw(){
  $("dtList").innerHTML = docs.map((d,i)=>`<div class="hitem${d.err?" bad":""}"><div class="hthumb pmico dtico dt-${d.res?d.res.kind:"x"}">${esc(d.res ? ICO[d.res.kind] : (d.name.match(/\.([a-z]+)$/i)||["",""])[1].toUpperCase())}</div>
    <div><b>${esc(d.name)}</b><span>${d.err ? esc(d.err) : d.res ? esc(stats(d)) + " · " + kb(d.size) : "읽는 중…"}</span></div>
    <button class="ghost" type="button" data-rm="${i}" aria-label="${esc(d.name)} 빼기">빼기</button></div>`).join("");
  const ok = docs.filter(d=>d.res);
  $("dtPickW").hidden = ok.length < 2;
  const cur = $("dtPick").value;
  $("dtPick").innerHTML = (ok.length > 1 ? `<option value="all">모두 합쳐 보기 (${ok.length}개)</option>` : "") + ok.map(d=>`<option value="${docs.indexOf(d)}">${esc(d.name)}</option>`).join("");
  if([...$("dtPick").options].some(o=>o.value===cur)) $("dtPick").value = cur;
}
function textOf(d, md){
  const o = opt(); let s = md ? SHIFT_DT.md(d.res.blocks, o) : SHIFT_DT.plain(d.res.blocks, o);
  if(d.res.notes.length) s += (md ? "\n\n---\n\n**각주**\n\n" : "\n\n각주\n") + d.res.notes.map((x,i)=>`[각주${i+1}] ${x}`).join(md ? "\n\n" : "\n");
  return s.trim();
}
function current(){
  const ok = docs.filter(d=>d.res); if(!ok.length) return {text:"", name:"문서", list:[]};
  const v = $("dtPick").value, md = fmt()==="md";
  const list = v==="all" || ok.length===1 && v==="" ? ok : [docs[+v]].filter(d=>d && d.res);
  const one = list.length===1 ? list[0] : null;
  const text = one ? textOf(one, md) : list.map(d=>(md ? `# ${d.name}\n\n` : `===== ${d.name} =====\n\n`) + textOf(d, md)).join("\n\n");
  return {text, name: one ? base(one.name) : "문서 모음", list};
}
function render(){
  const {text, list} = current();
  $("dtOut").value = text;
  ["dtCopy","dtDown","dtAsk"].forEach(id=>$(id).disabled = !text);
  const warn = list.flatMap(d=>d.res.warn.map(w=>list.length>1 ? `${d.name}: ${w}` : w));
  const empty = list.filter(d=>!SHIFT_DT.plain(d.res.blocks, opt()).trim()).map(d=>d.name);
  if(empty.length) warn.push(`${empty.join(", ")}에서 글자를 찾지 못했습니다. 그림으로만 된 문서라면 그림을 저장해 '사진 속 글자 뽑기'로 읽어 보세요.`);
  $("dtWarn").hidden = !warn.length; $("dtWarn").textContent = warn.join(" ");
  $("dtSum").textContent = text ? `${text.length.toLocaleString()}자` : "";
  clearTimeout(tokT);
  if(text) tokT = setTimeout(()=>script(TOK, ()=>!!window.SHIFT_O200K).then(()=>{ if($("dtOut").value!==text) return;
    const n = window.SHIFT_O200K.countTokens(text.length > 400000 ? text.slice(0, 400000) : text);
    $("dtSum").textContent = `${text.length.toLocaleString()}자 · 약 ${n.toLocaleString()}${text.length > 400000 ? "+" : ""}토큰(GPT o200k 기준)`; }).catch(()=>{}), 250);
}
const copy = t=>(navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast("복사했습니다"), ()=>{ $("dtOut").select(); toast("길게 눌러 복사해 주세요"); });

// ---------- 이벤트 ----------
$("dtFile").addEventListener("change", e=>{ add(e.target.files); e.target.value = ""; });
const drop = $("dtDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>{ if(!busy) add(e.dataTransfer.files); });
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("dtFile").click(); } });
$("dtList").addEventListener("click", e=>{ const b = e.target.closest("button[data-rm]"); if(!b || busy) return; docs.splice(+b.dataset.rm, 1); say(docs.length ? "" : ""); draw(); render(); });
["dtNotes","dtMemo","dtHf","dtImg"].forEach(id=>$(id).addEventListener("change", parseAll));
$("dtFill").addEventListener("change", render);
document.querySelectorAll("input[name=dtFmt]").forEach(r=>r.addEventListener("change", render));
$("dtPick").addEventListener("change", render);
$("dtCopy").addEventListener("click", ()=>{ const t = $("dtOut").value; if(t) copy(t); });
$("dtDown").addEventListener("click", ()=>{ const t = $("dtOut").value; if(!t) return; const md = fmt()==="md";
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], {type: md ? "text/markdown" : "text/plain"})); a.download = current().name + (md ? ".md" : ".txt"); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000); });
$("dtAsk").addEventListener("click", ()=>{ const {text, name} = current(); if(!text) return;
  copy(`아래는 '${name}' 문서에서 뽑은 내용입니다. 표는 마크다운 표로 되어 있습니다.\n\n1. 이 문서가 무엇에 관한 것인지 두 문장으로 알려 주세요.\n2. 핵심 내용을 5줄 이내 목록으로 정리해 주세요.\n3. 숫자·날짜·기한·담당자는 따로 표로 모아 주세요.\n4. 원문에 없는 내용은 덧붙이지 말고, 뜻이 불분명한 곳은 '원문 확인 필요'라고 적어 주세요.\n\n---\n\n${text}`); });
window.addEventListener("pagehide", ()=>{ docs = []; $("dtOut").value = ""; });
})();

// SHIFT AI 무료 도구 — 사진 위치정보(EXIF) 지우기. JPG·PNG·WebP 파일을 바이트 단위로 읽어 정보가 든 부분만 잘라 낸다(다시 압축하지 않음).
// 지운 결과를 다시 읽어 GPS·기종·날짜가 남지 않았는지 확인한 뒤에만 내려받게 한다. 사진은 어디에도 보내지 않는다. ZIP 은 /lib/jszip/(MIT).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("exDrop")) return;
const ZIP = "/lib/jszip/jszip.min.js", MAX = 50;
const items = [];
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const kb = n=>n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const loadZip = ()=> window.JSZip ? Promise.resolve() : new Promise((ok,no)=>{ const s=document.createElement("script"); s.src=ZIP; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
const mode = ()=>document.querySelector('input[name=exMode]:checked').value;
const ascii = (u,a,b)=>{ let s=""; for(let i=a;i<b&&i<u.length;i++) s+=String.fromCharCode(u[i]); return s; };
const u16be = (u,i)=>u[i]<<8|u[i+1], u32be = (u,i)=>(u[i]<<24|u[i+1]<<16|u[i+2]<<8|u[i+3])>>>0;

// ---------- EXIF(TIFF) 읽기 ----------
const TSZ = {1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8};
function tiff(u, base, len){
  const end = Math.min(u.length, base+len), info = {tags:{}, gps:null, gpsIfd:null, ifd0:null, orient:1, thumb:false};
  if(end-base < 8) return info;
  const le = u[base]===0x49, r16 = i=> le ? u[i]|u[i+1]<<8 : u[i]<<8|u[i+1], r32 = i=> (le ? (u[i]|u[i+1]<<8|u[i+2]<<16|u[i+3]<<24) : (u[i]<<24|u[i+1]<<16|u[i+2]<<8|u[i+3]))>>>0;
  if(r16(base+2)!==42) return info;
  info.le = le; info.r16 = r16; info.r32 = r32;
  const val = (p, type, cnt)=>{ // p = 엔트리 위치
    const sz = (TSZ[type]||1)*cnt, at = sz<=4 ? p+8 : base + r32(p+8);
    if(at<base || at+sz>end) return null;
    if(type===2) return ascii(u, at, at+sz).replace(/\0[\s\S]*$/,"").trim();
    if(type===3) return cnt===1 ? r16(at) : Array.from({length:cnt},(_,i)=>r16(at+i*2));
    if(type===4) return cnt===1 ? r32(at) : Array.from({length:cnt},(_,i)=>r32(at+i*4));
    if(type===5) return Array.from({length:cnt},(_,i)=>{ const d=r32(at+i*8+4); return d ? r32(at+i*8)/d : 0; });
    return {bytes: sz, at};
  };
  const ifd = (off, fn)=>{
    const p = base+off; if(off<8 || p+2>end) return null;
    const n = r16(p); if(n>500 || p+2+n*12>end) return null;
    for(let k=0;k<n;k++){ const e=p+2+k*12; fn(r16(e), r16(e+2), r32(e+4), e); }
    return p;
  };
  const T = info.tags;
  info.ifd0 = ifd(r32(base+4), (tag,type,cnt,e)=>{
    if(tag===0x010F) T.make = val(e,type,cnt); else if(tag===0x0110) T.model = val(e,type,cnt);
    else if(tag===0x0131) T.software = val(e,type,cnt); else if(tag===0x0132) T.date = val(e,type,cnt);
    else if(tag===0x013B) T.artist = val(e,type,cnt); else if(tag===0x8298) T.copyright = val(e,type,cnt);
    else if(tag===0x0112) info.orient = val(e,type,cnt)||1;
    else if(tag===0x8769) T._exif = r32(e+8); else if(tag===0x8825) info.gpsIfd = r32(e+8);
  });
  if(info.ifd0){ const n=r16(info.ifd0), nx = r32(info.ifd0+2+n*12); if(nx) ifd(nx, tag=>{ if(tag===0x0201) info.thumb = true; }); }
  if(T._exif) ifd(T._exif, (tag,type,cnt,e)=>{
    if(tag===0x9003) T.taken = val(e,type,cnt); else if(tag===0xA434) T.lens = val(e,type,cnt);
    else if(tag===0xA431) T.serial = val(e,type,cnt); else if(tag===0xA430) T.owner = val(e,type,cnt);
    else if(tag===0x927C) T.maker = true; else if(tag===0x9010) T.tz = val(e,type,cnt);
  });
  if(info.gpsIfd){ const g = {}; let any = false;
    ifd(info.gpsIfd, (tag,type,cnt,e)=>{ any = true;
      if(tag===1) g.latRef = val(e,type,cnt); else if(tag===2) g.lat = val(e,type,cnt);
      else if(tag===3) g.lonRef = val(e,type,cnt); else if(tag===4) g.lon = val(e,type,cnt);
      else if(tag===6) g.alt = val(e,type,cnt); });
    if(any) info.gps = g;
  }
  delete T._exif;
  return info;
}
// GPS 묶음을 그 자리에서 0 으로 덮어 지운다(위치만 지우기)
function wipeGps(u, base, info){
  if(!info.gpsIfd) return false;
  const p = base + info.gpsIfd, {r16, r32} = info; if(p+2>u.length) return false;
  const n = r16(p); if(n>500 || p+2+n*12>u.length) return false;
  for(let k=0;k<n;k++){ const e=p+2+k*12, type=r16(e+2), cnt=r32(e+4), sz=(TSZ[type]||1)*cnt;
    if(sz>4){ const at=base+r32(e+8); if(at+sz<=u.length) u.fill(0, at, at+sz); }
    u.fill(0, e, e+12); }
  u[p] = 0; u[p+1] = 0;
  return true;
}
const dms = a=>Array.isArray(a)&&a.length>=3 ? a[0]+a[1]/60+a[2]/3600 : null;
function gpsText(g){
  const la = dms(g.lat), lo = dms(g.lon);
  if(la==null || lo==null || (la===0&&lo===0)) return "위치 칸 있음(좌표 없음)";
  return `${(g.latRef==="S"?-la:la).toFixed(5)}, ${(g.lonRef==="W"?-lo:lo).toFixed(5)}`;
}

// ---------- 파일 형식별 ----------
function readJpeg(u){
  const out = {kind:"JPG", exif:null, xmp:false, iptc:false, comment:false, mpf:false, trailer:0, segs:[]};
  let i = 2, eoi = -1;
  while(i+4 <= u.length){
    if(u[i]!==0xFF){ i++; continue; }
    const m = u[i+1];
    if(m===0xFF){ i++; continue; }
    if(m===0xD8 || (m>=0xD0&&m<=0xD7) || m===0x01){ i+=2; continue; }
    if(m===0xD9){ eoi = i; break; }
    const len = u16be(u,i+2), s = {m, at:i, end:i+2+len};
    if(s.end>u.length) break;
    out.segs.push(s);
    if(m===0xE1){ const id = ascii(u,i+4,i+10);
      if(id==="Exif\0\0"){ s.exif = true; if(!out.exif) out.exif = Object.assign(tiff(u, i+10, len-8), {base:i+10}); }
      else if(ascii(u,i+4,i+33).startsWith("http://ns.adobe.com/")) { s.xmp = true; out.xmp = true; } }
    else if(m===0xED) out.iptc = true;
    else if(m===0xFE) out.comment = true;
    else if(m===0xE2 && ascii(u,i+4,i+8)==="MPF\0") out.mpf = true;
    if(m===0xDA){ // 사진 데이터: EOI(FFD9)까지 그대로
      let j = s.end; while(j+1<u.length && !(u[j]===0xFF && u[j+1]===0xD9)) j++;
      eoi = j; break; }
    i = s.end;
  }
  out.eoi = eoi; out.trailer = eoi>0 ? u.length-(eoi+2) : 0;
  return out;
}
function minimalExif(orient){ // 방향 하나만 든 EXIF(APP1)
  const b = new Uint8Array(36);
  b.set([0xFF,0xE1,0,34, 0x45,0x78,0x69,0x66,0,0, 0x4D,0x4D,0,42, 0,0,0,8, 0,1, 0x01,0x12, 0,3, 0,0,0,1, 0,orient,0,0, 0,0,0,0]);
  return b;
}
function cleanJpeg(u, info, m){
  const parts = [u.subarray(0,2)];
  let mini = m==="all" && info.exif && info.exif.orient>1 && info.exif.orient<=8 ? minimalExif(info.exif.orient) : null;
  if(mini && !(info.segs[0] && info.segs[0].m===0xE0)){ parts.push(mini); mini = null; }
  let after = info.segs.length ? info.segs[info.segs.length-1] : null;
  for(const s of info.segs){
    if(s.m===0xDA){ after = s; break; }
    const drop = m==="all"
      ? (s.m===0xE1 || s.m===0xED || s.m===0xFE || (s.m>=0xE3 && s.m<=0xEC) || (s.m===0xE2 && ascii(u,s.at+4,s.at+16)!=="ICC_PROFILE\0") || s.m===0xEF)
      : (s.xmp || s.m===0xED || s.m===0xFE || (s.m===0xE2 && ascii(u,s.at+4,s.at+8)==="MPF\0"));
    if(drop) continue;
    if(m==="gps" && s.exif){ const c = u.slice(s.at, s.end); const t = tiff(c, 10, c.length-10); wipeGps(c, 10, t); parts.push(c); continue; }
    parts.push(u.subarray(s.at, s.end));
    if(mini && s.m===0xE0){ parts.push(mini); mini = null; }
  }
  if(!after || after.m!==0xDA || info.eoi<0) throw new Error("JPG 구조를 읽지 못했습니다");
  parts.push(u.subarray(after.at, info.eoi+2)); // 사진 데이터 + EOI. 그 뒤에 붙은 다른 사진·정보는 버림
  return concat(parts);
}
const PNG_KEEP = new Set(["IHDR","PLTE","IDAT","IEND","tRNS","gAMA","cHRM","sRGB","iCCP","sBIT","bKGD","pHYs","hIST","acTL","fcTL","fdAT","cICP","mDCv","cLLi"]);
function readPng(u){
  const out = {kind:"PNG", exif:null, chunks:[], text:[], time:false};
  let i = 8;
  while(i+12 <= u.length){
    const len = u32be(u,i), type = ascii(u,i+4,i+8), end = i+12+len; if(end>u.length) break;
    out.chunks.push({type, at:i, end});
    if(type==="eXIf") out.exif = tiff(u, i+8, len);
    else if(type==="tEXt"||type==="iTXt"||type==="zTXt"){ const k = ascii(u,i+8,Math.min(i+8+80,end)).split("\0")[0]; out.text.push(k); }
    else if(type==="tIME") out.time = true;
    i = end; if(type==="IEND") break;
  }
  return out;
}
const cleanPng = (u, info)=>concat([u.subarray(0,8), ...info.chunks.filter(c=>PNG_KEEP.has(c.type)).map(c=>u.subarray(c.at,c.end))]);
function readWebp(u){
  const out = {kind:"WebP", exif:null, xmp:false, chunks:[]};
  let i = 12;
  while(i+8 <= u.length){
    const type = ascii(u,i,i+4), len = u[i+4]|u[i+5]<<8|u[i+6]<<16|u[i+7]<<24, end = i+8+len+(len&1); if(i+8+len>u.length) break;
    out.chunks.push({type, at:i, end:Math.min(end,u.length)});
    if(type==="EXIF"){ let b = i+8; if(ascii(u,b,b+6)==="Exif\0\0") b += 6; out.exif = tiff(u, b, len-(b-i-8)); }
    else if(type==="XMP ") out.xmp = true;
    i = end;
  }
  return out;
}
function cleanWebp(u, info){
  const keep = info.chunks.filter(c=>c.type!=="EXIF" && c.type!=="XMP ").map(c=>{ const b = u.slice(c.at, c.end); if(c.type==="VP8X") b[8] &= ~0x0C; return b; });
  const body = concat(keep), out = new Uint8Array(12+body.length);
  out.set(u.subarray(0,12)); out.set(body,12);
  const n = out.length-8; out[4]=n&255; out[5]=n>>8&255; out[6]=n>>16&255; out[7]=n>>>24&255;
  return out;
}
function concat(parts){ const n = parts.reduce((a,p)=>a+p.length,0), o = new Uint8Array(n); let k=0; for(const p of parts){ o.set(p,k); k+=p.length; } return o; }
function sniff(u){
  if(u[0]===0xFF && u[1]===0xD8) return "jpg";
  if(u[0]===0x89 && ascii(u,1,4)==="PNG") return "png";
  if(ascii(u,0,4)==="RIFF" && ascii(u,8,12)==="WEBP") return "webp";
  if(ascii(u,4,8)==="ftyp") return "heic";
  return "";
}
const READ = {jpg:readJpeg, png:readPng, webp:readWebp};

// 무엇이 들어 있나 → 사람이 읽는 줄
function found(info){
  const r = [], e = info.exif, T = e ? e.tags : {};
  if(e && e.gps) r.push(["위치(GPS)", gpsText(e.gps), true]);
  if(T.make || T.model) r.push(["기기", [T.make, T.model && !(T.make && T.model.startsWith(T.make)) ? T.model : (T.model||"")].filter(Boolean).join(" ").replace(/\s+/g," ")]);
  if(T.taken || T.date) r.push(["찍은 날짜", (T.taken||T.date).replace(/^(\d{4}):(\d{2}):(\d{2})/,"$1-$2-$3") + (T.tz ? ` (${T.tz})` : "")]);
  if(T.lens) r.push(["렌즈", T.lens]);
  if(T.serial) r.push(["기기 일련번호", T.serial, true]);
  if(T.owner || T.artist) r.push(["소유자·작성자", T.owner || T.artist, true]);
  if(T.copyright) r.push(["저작권 표시", T.copyright]);
  if(T.software) r.push(["편집 프로그램", T.software]);
  if(T.maker) r.push(["제조사 기록", "카메라 회사가 넣은 추가 기록(MakerNote)"]);
  if(e && e.thumb) r.push(["작은 미리 보기", "원본 사진의 작은 사본"]);
  if(info.xmp) r.push(["XMP 기록", "편집 이력·위치가 들어갈 수 있는 기록"]);
  if(info.iptc) r.push(["IPTC 기록", "설명·키워드·작성자 기록"]);
  if(info.comment) r.push(["설명 글", "파일 안 메모"]);
  if(info.mpf || info.trailer>1024) r.push(["덧붙은 사진", "파일 뒤에 붙은 다른 사진(깊이 지도·움직이는 사진 등)"]);
  if(info.text && info.text.length) r.push(["글 기록", info.text.slice(0,5).join(", ")]);
  if(info.time) r.push(["저장 시각", "마지막으로 저장한 시각"]);
  return r;
}

async function handle(it, file){
  try{
    const u = new Uint8Array(await file.arrayBuffer()), k = sniff(u);
    if(k==="heic") throw new Error("HEIC 사진입니다. HEIC → JPG 도구로 바꾸면 정보가 함께 지워집니다.");
    if(!READ[k]) throw new Error("JPG·PNG·WebP 사진만 처리할 수 있습니다.");
    const info = READ[k](u); it.kind = info.kind; it.before = found(info);
    const m = mode(); it.mode = m;
    const out = k==="jpg" ? cleanJpeg(u, info, m) : k==="png" ? cleanPng(u, info) : cleanWebp(u, info);
    // 지운 결과를 다시 읽어 확인
    const chk = READ[k](out), left = found(chk);
    const leftGps = chk.exif && chk.exif.gps && dms(chk.exif.gps.lat)!=null;
    if(leftGps) throw new Error("위치 정보를 지우지 못했습니다. 이 사진은 원본을 보내지 마세요.");
    it.after = left; it.orient = chk.exif ? chk.exif.orient : 1;
    it.blob = new Blob([out], {type: file.type || {jpg:"image/jpeg",png:"image/png",webp:"image/webp"}[k]});
    it.url = URL.createObjectURL(it.blob); it.size = u.length; it.ok = true;
    it.thumbUrl = URL.createObjectURL(it.blob);
  }catch(e){ it.err = e.message || "읽지 못했습니다."; }
  draw();
}
function draw(){
  $("exList").innerHTML = items.map(it=>{
    if(it.err) return `<div class="exitem bad"><div class="exh"><b>${esc(it.name)}</b><span>${esc(it.err)}</span></div></div>`;
    if(!it.ok) return `<div class="exitem wait"><div class="exh"><b>${esc(it.name)}</b><span>확인하는 중…</span></div></div>`;
    const has = it.before.length, gps = it.before.some(r=>r[0]==="위치(GPS)");
    const rows = has ? it.before.map(([k,v,warn])=>`<li${warn?' class="warn"':""}><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join("") : `<li><span>들어 있던 정보</span><b>없음</b></li>`;
    const leftTxt = it.after.length ? "남긴 것: " + it.after.map(r=>r[0]).join(", ") : (it.orient>1 ? "남긴 것: 사진 방향" : "남은 정보 없음");
    return `<div class="exitem${gps?" gps":""}"><img class="exthumb" src="${it.thumbUrl}" alt="">
      <div class="exh"><b>${esc(it.name)}</b><span>${it.kind} · ${kb(it.size)} → ${kb(it.blob.size)}${gps?' · <em>위치가 들어 있었습니다</em>':""}</span></div>
      <ul class="exrows">${rows}</ul>
      <div class="exok"><span>✓ 확인함 · ${esc(leftTxt)}</span><a class="ghost" href="${it.url}" download="${esc(it.name)}">내려받기</a></div></div>`;
  }).join("");
  const ok = items.filter(x=>x.ok), g = ok.filter(x=>x.before.some(r=>r[0]==="위치(GPS)")).length, wait = items.some(x=>!x.ok&&!x.err);
  $("exZip").disabled = !ok.length || wait;
  $("exStatus").textContent = !items.length ? "사진을 넣으면 바로 확인합니다." : wait ? "확인하는 중…" :
    `${ok.length}장 처리 · 위치가 들어 있던 사진 ${g}장${items.length>ok.length?` · 못 한 사진 ${items.length-ok.length}장`:""}`;
}
function add(list){
  for(const f of list){
    if(items.length >= MAX){ toast(`한 번에 ${MAX}장까지 처리할 수 있습니다`); break; }
    const it = {name: f.name || `사진${items.length+1}.jpg`}; items.push(it); handle(it, f);
  }
  draw();
}
$("exFile").addEventListener("change", e=>{ add(e.target.files); e.target.value=""; });
const drop = $("exDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>add(e.dataTransfer.files));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("exFile").click(); } });
document.querySelectorAll('input[name=exMode]').forEach(r=>r.addEventListener("change", ()=>{ if(items.length) toast("새로 넣는 사진부터 적용됩니다. 이미 넣은 사진은 '모두 지우기' 뒤 다시 넣으세요"); }));
$("exClear").addEventListener("click", ()=>{ items.forEach(it=>{ it.url&&URL.revokeObjectURL(it.url); }); items.length=0; draw(); });
$("exZip").addEventListener("click", async ()=>{
  const ok = items.filter(it=>it.ok); if(!ok.length) return;
  $("exZip").disabled = true;
  try{ await loadZip(); const z = new JSZip(), used = {};
    ok.forEach(it=>{ let n = it.name, k = 2; while(used[n]) n = it.name.replace(/(\.\w+)?$/, m=>`-${k++}${m}`); used[n]=1; z.file(n, it.blob); });
    const b = await z.generateAsync({type:"blob"}); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "정보지운사진.zip"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  }catch(_){ toast("ZIP을 만들지 못했습니다. 한 장씩 내려받아 주세요"); }
  finally{ $("exZip").disabled = false; }
});
draw();
})();

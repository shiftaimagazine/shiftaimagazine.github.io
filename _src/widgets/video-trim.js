// SHIFT AI 무료 도구 — 영상 자르기·용량 줄이기.
// MP4·MOV(H.264·HEVC)는 브라우저 내장 WebCodecs 로 고른 구간만 풀고(VideoDecoder) 다시 압축(VideoEncoder, H.264)한 뒤
// 이 파일 안의 MP4 쓰개로 묶는다. 소리(AAC)는 다시 압축하지 않고 그대로 옮긴다. 라이브러리·서버 없음.
// 위 방식으로 못 여는 파일(WebM 등)은 브라우저가 재생할 수 있으면 '실시간 녹화'(MediaRecorder)로 만든다(영상 길이만큼 걸림).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("vtDrop")) return;
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const mb = n=>n>=1073741824 ? (n/1073741824).toFixed(2)+"GB" : n>=1048576 ? (n/1048576).toFixed(1)+"MB" : Math.max(1,Math.round(n/1024))+"KB";
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const fmt = s=>{ s = Math.max(0,s); const m = Math.floor(s/60), x = s-m*60; return `${m}:${x<10?"0":""}${x.toFixed(1)}`; };
const parseT = v=>{ v = String(v).trim().replace(/[,，]/g,"."); if(!v) return NaN; const p = v.split(":").map(Number); if(p.some(isNaN)) return NaN; return p.length===1 ? p[0] : p.length===2 ? p[0]*60+p[1] : p[0]*3600+p[1]*60+p[2]; };
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2400); };
const HEVC_TIP = "아이폰에서 찍은 고효율(HEVC) 영상은 이 브라우저에서 열 수 없습니다. 사파리나 맥·윈도의 크롬에서 열어 보거나, 아이폰 '설정 > 카메라 > 포맷'에서 '높은 호환성'으로 찍은 영상을 쓰세요.";

// ---------- MP4·MOV 읽기 ----------
class Reader {
  constructor(file){ this.f = file; this.size = file.size; this.cs = 0; this.ce = 0; this.cb = null; }
  async read(off, len){
    if(this.cb && off>=this.cs && off+len<=this.ce) return this.cb.subarray(off-this.cs, off-this.cs+len);
    if(len > 8e6) return new Uint8Array(await this.f.slice(off, off+len).arrayBuffer());
    const e = Math.min(this.size, off + Math.max(len, 16e6));
    this.cb = new Uint8Array(await this.f.slice(off, e).arrayBuffer()); this.cs = off; this.ce = e;
    return this.cb.subarray(0, len);
  }
}
const u32 = (b,i)=>((b[i]<<24)>>>0) + (b[i+1]<<16) + (b[i+2]<<8) + b[i+3];
const u64 = (b,i)=>u32(b,i)*4294967296 + u32(b,i+4);
const s32 = (b,i)=>(b[i]<<24) | (b[i+1]<<16) | (b[i+2]<<8) | b[i+3];
const u16 = (b,i)=>(b[i]<<8) | b[i+1];
const typ = (b,i)=>String.fromCharCode(b[i],b[i+1],b[i+2],b[i+3]);
function* boxes(b, s=0, e=b.length){
  let i = s;
  while(i+8<=e){ let size = u32(b,i), t = typ(b,i+4), h = 8;
    if(size===1){ size = u64(b,i+8); h = 16; } else if(size===0) size = e-i;
    if(size<h || i+size>e) break;
    yield {t, s:i+h, e:i+size, start:i}; i += size; }
}
const child = (b, box, t)=>{ for(const x of boxes(b, box.s, box.e)) if(x.t===t) return x; return null; };
const path = (b, box, ...ts)=>{ let x = box; for(const t of ts){ x = x && child(b, x, t); } return x; };
async function topBoxes(R){
  const out = []; let i = 0;
  while(i+8<=R.size){ const h = await R.read(i, 16); let size = u32(h,0), t = typ(h,4), hl = 8;
    if(size===1){ size = u64(h,8); hl = 16; } else if(size===0) size = R.size-i;
    if(size<8) break; out.push({t, start:i, size, hl}); i += size; }
  return out;
}
function hvcCodec(c){   // hvcC → 'hvc1.1.6.L93.B0' 모양(ISO/IEC 14496-15 부록 E)
  const ps = c[1]>>6, tier = (c[1]>>5)&1, pidc = c[1]&31; let flags = u32(c,2), rev = 0;
  for(let i=0;i<32;i++){ rev = (rev<<1) | (flags&1); flags >>>= 1; }
  const cons = [c[6],c[7],c[8],c[9],c[10],c[11]]; while(cons.length && !cons[cons.length-1]) cons.pop();
  return `hvc1.${["","A","B","C"][ps]}${pidc}.${(rev>>>0).toString(16).toUpperCase()}.${tier?"H":"L"}${c[12]}${cons.map(x=>"."+x.toString(16).toUpperCase()).join("")}`;
}
async function demux(file){
  const R = new Reader(file), tops = await topBoxes(R);
  const mv = tops.find(x=>x.t==="moov"); if(!mv) throw new Error("nomoov");
  if(tops.some(x=>x.t==="moof")) throw new Error("fragmented");
  const b = await R.read(mv.start, mv.size), moov = {s:mv.hl, e:mv.size};
  const mvhd = child(b, moov, "mvhd"); const mvTs = b[mvhd.s]===1 ? u32(b,mvhd.s+20) : u32(b,mvhd.s+12);
  const tracks = [];
  for(const tk of boxes(b, moov.s, moov.e)){ if(tk.t!=="trak") continue;
    const tkhd = child(b, tk, "tkhd"), mdia = child(b, tk, "mdia"), hdlr = child(b, mdia, "hdlr"), mdhd = child(b, mdia, "mdhd");
    const kind = typ(b, hdlr.s+8); if(kind!=="vide" && kind!=="soun") continue;
    const ts = b[mdhd.s]===1 ? u32(b,mdhd.s+20) : u32(b,mdhd.s+12);
    const tv = b[tkhd.s]; const mOff = tkhd.s + (tv===1 ? 52 : 40);
    const matrix = b.slice(mOff, mOff+36);
    const stbl = path(b, mdia, "minf", "stbl"), stsd = child(b, stbl, "stsd");
    const ent = [...boxes(b, stsd.s+8, stsd.e)][0]; if(!ent) continue;
    const T = {kind, ts, fmt: ent.t, entry: b.slice(ent.start, ent.e), matrix};
    if(kind==="vide"){
      T.w = u16(b, ent.s+24); T.h = u16(b, ent.s+26);
      for(const x of boxes(b, ent.s+78, ent.e)){
        if(x.t==="avcC"){ T.desc = b.slice(x.s, x.e); T.codec = "avc1."+[T.desc[1],T.desc[2],T.desc[3]].map(v=>v.toString(16).padStart(2,"0")).join(""); }
        if(x.t==="hvcC"){ T.desc = b.slice(x.s, x.e); T.codec = hvcCodec(T.desc); } }
    }else{ T.ch = u16(b, ent.s+16); T.rate = u32(b, ent.s+24)>>>16; T.aac = ent.t==="mp4a"; }
    // 표본 표
    const g = t=>child(b, stbl, t);
    const stsz = g("stsz"), stco = g("stco"), co64 = g("co64"), stsc = g("stsc"), stts = g("stts"), ctts = g("ctts"), stss = g("stss");
    const n = u32(b, stsz.s+8), cs = u32(b, stsz.s+4), sizes = new Array(n);
    for(let i=0;i<n;i++) sizes[i] = cs || u32(b, stsz.s+12+i*4);
    const co = co64 || stco, nc = u32(b, co.s+4), chunk = new Array(nc);
    for(let i=0;i<nc;i++) chunk[i] = co64 ? u64(b, co.s+8+i*8) : u32(b, co.s+8+i*4);
    const sc = [], nsc = u32(b, stsc.s+4); for(let i=0;i<nsc;i++) sc.push([u32(b,stsc.s+8+i*12), u32(b,stsc.s+12+i*12)]);
    const off = new Array(n); let k = 0;
    for(let e=0;e<sc.length && k<n;e++){ const first = sc[e][0], last = e+1<sc.length ? sc[e+1][0]-1 : nc, per = sc[e][1];
      for(let c=first;c<=last && k<n;c++){ let o = chunk[c-1]; for(let j=0;j<per && k<n;j++){ off[k] = o; o += sizes[k]; k++; } } }
    const dts = new Array(n); let t = 0; k = 0; const nt = u32(b, stts.s+4);
    for(let i=0;i<nt;i++){ const cnt = u32(b, stts.s+8+i*8), d = u32(b, stts.s+12+i*8); for(let j=0;j<cnt && k<n;j++){ dts[k++] = t; t += d; } }
    while(k<n) dts[k++] = t;
    const cto = new Array(n).fill(0);
    if(ctts){ k = 0; const v1 = b[ctts.s]===1, nn = u32(b, ctts.s+4); for(let i=0;i<nn;i++){ const cnt = u32(b, ctts.s+8+i*8), o = v1 ? s32(b, ctts.s+12+i*8) : u32(b, ctts.s+12+i*8); for(let j=0;j<cnt && k<n;j++) cto[k++] = o; } }
    let key = null; if(stss){ key = new Uint8Array(n); const ns = u32(b, stss.s+4); for(let i=0;i<ns;i++){ const x = u32(b, stss.s+8+i*4)-1; if(x<n) key[x] = 1; } }
    // 편집 목록: 앞쪽 빈 구간(empty edit)과 시작 위치(media_time)만 반영
    let mt = 0, delay = 0; const elst = path(b, tk, "edts", "elst");
    if(elst){ const v1 = b[elst.s]===1, ne = u32(b, elst.s+4); let p = elst.s+8;
      for(let i=0;i<ne;i++){ const dur = v1 ? u64(b,p) : u32(b,p), m = v1 ? (s32(b,p+8)*4294967296 + u32(b,p+12)) : s32(b,p+4); p += v1 ? 20 : 12;
        if(m===-1){ delay += dur/mvTs; continue; } mt = m; break; } }
    T.samples = sizes.map((sz,i)=>({off:off[i], size:sz, dts:dts[i], pts:(dts[i]+cto[i]-mt)/ts + delay, key: key ? !!key[i] : true}));
    T.duration = t/ts;
    T.bytes = sizes.reduce((a,x)=>a+x,0);
    tracks.push(T);
  }
  const v = tracks.find(x=>x.kind==="vide" && x.samples.length), a = tracks.find(x=>x.kind==="soun" && x.samples.length);
  if(!v) throw new Error("novideo");
  return {R, v, a, duration: Math.max(...v.samples.map(s=>s.pts)) + (v.samples.length>1 ? v.duration/v.samples.length : 0)};
}

// ---------- MP4 쓰기(ftyp + moov + mdat, moov 앞쪽: 받자마자 재생) ----------
class W { constructor(){ this.p = []; this.n = 0; }
  u8(v){ this.p.push(Uint8Array.of(v&255)); this.n += 1; return this; }
  u16(v){ this.p.push(Uint8Array.of(v>>8&255, v&255)); this.n += 2; return this; }
  u32(v){ this.p.push(Uint8Array.of(v>>>24&255, v>>>16&255, v>>>8&255, v&255)); this.n += 4; return this; }
  u64(v){ return this.u32(Math.floor(v/4294967296)).u32(v>>>0); }
  str(s){ for(const c of s) this.u8(c.charCodeAt(0)); return this; }
  bytes(b){ this.p.push(b); this.n += b.length; return this; }
  zero(k){ this.p.push(new Uint8Array(k)); this.n += k; return this; }
  out(){ const o = new Uint8Array(this.n); let i = 0; for(const x of this.p){ o.set(x,i); i += x.length; } return o; } }
const box = (t, ...parts)=>{ const w = new W(); let len = 8; parts.forEach(p=>len += p.length); w.u32(len).str(t); parts.forEach(p=>w.bytes(p)); return w.out(); };
const full = (t, v, f, ...parts)=>box(t, new W().u8(v).u8(f>>16).u16(f&65535).out(), ...parts);
const IDENT = new W().u32(0x10000).u32(0).u32(0).u32(0).u32(0x10000).u32(0).u32(0).u32(0).u32(0x40000000).out();
function runs(arr){ const r = []; for(const v of arr){ if(r.length && r[r.length-1][1]===v) r[r.length-1][0]++; else r.push([1,v]); } return r; }
function trak(t, id, mvTs, chunkOff, co64){
  const durMv = Math.round((t.edur!=null ? t.edur : t.dur/t.ts)*mvTs);
  const tkhd = full("tkhd", 0, 3, new W().u32(0).u32(0).u32(id).u32(0).u32(durMv).zero(8).u16(0).u16(0).u16(t.video?0:0x100).u16(0)
    .bytes(t.matrix || IDENT).u32(t.video ? t.w<<16 : 0).u32(t.video ? t.h<<16 : 0).out());
  const edts = t.mt!=null ? box("edts", full("elst", 0, 0, new W().u32(1).u32(durMv).u32(t.mt).u16(1).u16(0).out())) : new Uint8Array(0);
  const mdhd = full("mdhd", 0, 0, new W().u32(0).u32(0).u32(t.ts).u32(t.dur).u16(0x55c4).u16(0).out());
  const hdlr = full("hdlr", 0, 0, new W().u32(0).str(t.video?"vide":"soun").zero(12).str(t.video?"VideoHandler":"SoundHandler").u8(0).out());
  const mh = t.video ? full("vmhd", 0, 1, new W().zero(8).out()) : full("smhd", 0, 0, new W().zero(4).out());
  const dinf = box("dinf", full("dref", 0, 0, new W().u32(1).out(), full("url ", 0, 1)));
  const stsd = full("stsd", 0, 0, new W().u32(1).out(), t.entry);
  const sr = runs(t.deltas), stts = full("stts", 0, 0, (()=>{ const x = new W().u32(sr.length); sr.forEach(([c,d])=>x.u32(c).u32(d)); return x.out(); })());
  let ctts = new Uint8Array(0);
  if(t.cto && t.cto.some(v=>v)){ const cr = runs(t.cto); ctts = full("ctts", 1, 0, (()=>{ const x = new W().u32(cr.length); cr.forEach(([c,o])=>x.u32(c).u32(o>>>0)); return x.out(); })()); }
  let stss = new Uint8Array(0);
  if(t.keys && t.keys.some(k=>!k)){ const ks = []; t.keys.forEach((k,i)=>{ if(k) ks.push(i+1); }); stss = full("stss", 0, 0, (()=>{ const x = new W().u32(ks.length); ks.forEach(v=>x.u32(v)); return x.out(); })()); }
  const stsc = full("stsc", 0, 0, new W().u32(1).u32(1).u32(1).u32(1).out());
  const stsz = full("stsz", 0, 0, (()=>{ const x = new W().u32(0).u32(t.sizes.length); t.sizes.forEach(s=>x.u32(s)); return x.out(); })());
  const stco = co64 ? full("co64", 0, 0, (()=>{ const x = new W().u32(chunkOff.length); chunkOff.forEach(o=>x.u64(o)); return x.out(); })())
                    : full("stco", 0, 0, (()=>{ const x = new W().u32(chunkOff.length); chunkOff.forEach(o=>x.u32(o)); return x.out(); })());
  const stbl = box("stbl", stsd, stts, ctts, stss, stsc, stsz, stco);
  return box("trak", tkhd, edts, box("mdia", mdhd, hdlr, box("minf", mh, dinf, stbl)));
}
function avcEntry(w, h, avcC){
  const x = new W().zero(6).u16(1).zero(16).u16(w).u16(h).u32(0x480000).u32(0x480000).u32(0).u16(1).zero(32).u16(0x18).u16(0xffff);
  return box("avc1", x.out(), box("avcC", avcC));
}
function mux(tracks){   // tracks: [{video, entry, ts, dur, deltas, cto, keys, sizes, data:[Uint8Array], times:[sec], matrix, mt, w, h}]
  const mvTs = 1000, ftyp = box("ftyp", new W().str("isom").u32(512).str("isomiso2avc1mp41").out());
  // 시간 순서로 섞어 놓는다(재생하면서 받기 좋게)
  const order = []; tracks.forEach((t,ti)=>t.sizes.forEach((_,i)=>order.push([t.times[i], ti, i]))); order.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  const total = order.reduce((s,[,ti,i])=>s+tracks[ti].sizes[i], 0), co64 = total > 4e9;
  const build = base=>{ const offs = tracks.map(t=>new Array(t.sizes.length)); let o = base; for(const [,ti,i] of order){ offs[ti][i] = o; o += tracks[ti].sizes[i]; }
    const mvDur = Math.max(...tracks.map(t=>Math.round((t.edur!=null ? t.edur : t.dur/t.ts)*mvTs)));
    const mvhd = full("mvhd", 0, 0, new W().u32(0).u32(0).u32(mvTs).u32(mvDur).u32(0x10000).u16(0x100).zero(10).bytes(IDENT).zero(24).u32(tracks.length+1).out());
    return box("moov", mvhd, ...tracks.map((t,ti)=>trak(t, ti+1, mvTs, offs[ti], co64))); };
  let moov = build(0); moov = build(ftyp.length + moov.length + (co64?16:8));
  const head = co64 ? new W().u32(1).str("mdat").u64(total+16).out() : new W().u32(total+8).str("mdat").out();
  return new Blob([ftyp, moov, head, ...order.map(([,ti,i])=>tracks[ti].data[i])], {type:"video/mp4"});
}

// ---------- 다시 압축(WebCodecs) ----------
const LV = [[3.0,1620,40500,0x1e],[3.1,3600,108000,0x1f],[3.2,5120,216000,0x20],[4.0,8192,245760,0x28],[4.2,8704,522240,0x2a],[5.0,22080,589824,0x32],[5.1,36864,983040,0x33],[5.2,36864,2073600,0x34]];
async function pickEncoder(w, h, fps, bitrate, mode){
  const mbs = Math.ceil(w/16)*Math.ceil(h/16), lv = LV.find(l=>l[1]>=mbs && l[2]>=mbs*fps) || LV[LV.length-1];
  for(const p of ["6400","4d00","4200"]){ const cfg = {codec:`avc1.${p}${lv[3].toString(16)}`, width:w, height:h, bitrate, framerate:fps, bitrateMode:mode, latencyMode:"quality", avc:{format:"avc"}};
    try{ const s = await VideoEncoder.isConfigSupported(cfg); if(s.supported) return cfg; }catch(_){}
    try{ const c2 = {...cfg}; delete c2.bitrateMode; const s = await VideoEncoder.isConfigSupported(c2); if(s.supported) return c2; }catch(_){} }
  return null;
}
async function transcode(D, o, onp, ctl){
  const v = D.v, a = o.mute ? null : D.a, s0 = o.start, s1 = o.end;
  const dec = {codec:v.codec, codedWidth:v.w, codedHeight:v.h, description:v.desc};
  if(!v.codec || !(await VideoDecoder.isConfigSupported(dec).catch(()=>({supported:false}))).supported) throw new Error(/^hvc|^hev/.test(v.codec||"") || /hvc1|hev1/.test(v.fmt) ? "hevc" : "codec");
  const tw = o.w, th = o.h;
  const enc = await pickEncoder(tw, th, o.fps, o.bitrate, o.cbr ? "constant" : "variable");
  if(!enc) throw new Error("encoder");
  // 시작보다 앞선 가장 가까운 키프레임부터 푼다
  const S = v.samples; let k0 = 0;
  for(let i=0;i<S.length;i++){ if(S[i].key && S[i].pts <= s0+1e-4) k0 = i; }
  let kLast = S.length-1; for(let i=k0;i<S.length;i++){ if(S[i].pts > s1 + 1.5 && i>k0){ kLast = i; break; } }
  const out = {data:[], times:[], keys:[], desc:null}; let encErr = null, decErr = null, nIn = 0;
  const encoder = new VideoEncoder({output:(c, meta)=>{ const d = new Uint8Array(c.byteLength); c.copyTo(d); out.data.push(d); out.times.push(c.timestamp/1e6); out.keys.push(c.type==="key"); if(meta && meta.decoderConfig && meta.decoderConfig.description && !out.desc) out.desc = new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : meta.decoderConfig.description.buffer.slice(meta.decoderConfig.description.byteOffset, meta.decoderConfig.description.byteOffset+meta.decoderConfig.description.byteLength)); }, error:e=>encErr = e});
  encoder.configure(enc);
  const cv = (typeof OffscreenCanvas!=="undefined") ? new OffscreenCanvas(tw, th) : Object.assign(document.createElement("canvas"), {width:tw, height:th});
  const cx = cv.getContext("2d", {alpha:false}); cx.imageSmoothingQuality = "high";
  let lastKey = -1e9, made = 0;
  const decoder = new VideoDecoder({output: f=>{
    const t = f.timestamp/1e6;
    if(t < s0-1e-4 || t >= s1-1e-4 || encErr){ f.close(); return; }
    let vf = f;
    if(f.displayWidth!==tw || f.displayHeight!==th){ cx.drawImage(f, 0, 0, tw, th); vf = new VideoFrame(cv, {timestamp: f.timestamp, duration: f.duration || undefined}); f.close(); }
    const ts = Math.round((t - s0)*1e6), key = t - lastKey >= 2;
    const vf2 = new VideoFrame(vf, {timestamp: ts}); vf.close();
    if(key) lastKey = t;
    try{ encoder.encode(vf2, {keyFrame:key}); }catch(e){ encErr = e; }
    vf2.close(); made++;
  }, error:e=>decErr = e});
  decoder.configure(dec);
  const total = kLast - k0 + 1;
  for(let i=k0;i<=kLast;i++){
    if(ctl.stop) break; if(encErr || decErr) break;
    while(decoder.decodeQueueSize > 8 || encoder.encodeQueueSize > 8){ await sleep(4); if(encErr||decErr) break; }
    const sm = S[i], data = await D.R.read(sm.off, sm.size);
    decoder.decode(new EncodedVideoChunk({type: sm.key ? "key" : "delta", timestamp: Math.round(sm.pts*1e6), data}));
    nIn++; if(nIn%5===0) onp(0.02 + 0.93*nIn/total);
  }
  if(!ctl.stop && !decErr) await decoder.flush().catch(e=>decErr = e);
  if(!ctl.stop && !encErr) await encoder.flush().catch(e=>encErr = e);
  try{ decoder.close(); }catch(_){} try{ encoder.close(); }catch(_){}
  if(ctl.stop) throw new Error("stop");
  if(decErr) throw new Error(/^hvc|hev/.test(v.codec) ? "hevc" : "decode");
  if(encErr || !out.data.length || !out.desc) throw new Error("encoder");
  // 화면 순서와 저장 순서가 다를 수 있다(B 프레임) → 저장 순서는 encoder 가 준 순서, 표시 시각은 timestamp
  const ts = 90000, n = out.data.length;
  const pts = out.times.map(t=>Math.round(t*ts)), sortedP = [...pts].sort((x,y)=>x-y);
  const avgD = n>1 ? Math.round((sortedP[n-1]-sortedP[0])/(n-1)) : Math.round(ts/o.fps);
  const dts = sortedP.map((p,i)=>i===0 ? 0 : p - sortedP[0] - 0);   // 표시 시각을 차례대로 늘어놓은 것을 저장 시각으로
  const deltas = dts.map((d,i)=>i<n-1 ? dts[i+1]-d : avgD);
  const cto = pts.map((p,i)=>p - sortedP[0] - dts[i]);
  const shift = Math.min(0, ...cto);   // 음수가 되지 않게
  const vt = {video:true, entry:avcEntry(tw, th, out.desc), ts, dur: dts[n-1]+avgD, deltas, cto: cto.map(c=>c-shift), keys: out.keys, sizes: out.data.map(d=>d.length), data: out.data,
    times: out.times, matrix: v.matrix, mt: cto.some(c=>c-shift) ? -shift : null, w:tw, h:th};
  if(!vt.mt) vt.mt = null;
  vt.edur = vt.dur/ts;
  const tracks = [vt];
  if(a && a.aac){ // 소리는 그대로 옮기고, 편집 목록으로 영상 시작과 정확히 맞춘다
    const A = a.samples; let i0 = 0; for(let i=0;i<A.length;i++){ if(A[i].pts <= s0) i0 = i; else break; }
    i0 = Math.max(0, i0-1);
    const keep = []; for(let i=i0;i<A.length && A[i].pts < s1;i++) keep.push(i);
    if(keep.length){
      const ad = []; for(const i of keep) ad.push((await D.R.read(A[i].off, A[i].size)).slice());
      const d0 = A[keep[0]].dts, adts = keep.map(i=>A[i].dts - d0), last = keep[keep.length-1];
      const adeltas = adts.map((d,j)=>j<adts.length-1 ? adts[j+1]-d : (last+1<A.length ? A[last+1].dts - A[last].dts : 1024));
      const mt = Math.max(0, Math.round((s0 - A[keep[0]].pts)*a.ts));
      const adur = adts[adts.length-1]+adeltas[adeltas.length-1];
      tracks.push({video:false, entry:a.entry, ts:a.ts, dur: adur, edur: Math.min(s1-s0, (adur-mt)/a.ts), deltas:adeltas, sizes: ad.map(x=>x.length), data: ad,
        times: keep.map(i=>A[i].pts - s0), mt, matrix:null});
    }
  }
  onp(0.98);
  return {blob: mux(tracks), frames: n, audio: tracks.length>1, codec: enc.codec};
}

// ---------- 대체: 실시간 녹화(MediaRecorder) ----------
async function record(file, o, onp, ctl){
  const v = document.createElement("video"); v.src = URL.createObjectURL(file); v.playsInline = true; v.preload = "auto";
  await new Promise((ok,no)=>{ v.onloadedmetadata = ok; v.onerror = ()=>no(new Error("play")); });
  const cv = document.createElement("canvas"); cv.width = o.w; cv.height = o.h; const cx = cv.getContext("2d", {alpha:false});
  const stream = cv.captureStream(o.fps);
  let ac = null;
  if(!o.mute){ try{ ac = new AudioContext(); const src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach(t=>stream.addTrack(t)); }catch(_){ ac = null; } }
  // MP4 는 H.264 로 담길 때만 쓴다(그냥 "video/mp4" 는 VP9 가 담기기도 해서 아이폰에서 안 열릴 수 있다)
  const types = ["video/mp4;codecs=avc1.42E01F,mp4a.40.2","video/mp4;codecs=avc1.42E01F,opus","video/mp4;codecs=avc1.42E01F","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
  const mime = types.find(t=>window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if(!mime) throw new Error("recorder");
  const rec = new MediaRecorder(stream, {mimeType:mime, videoBitsPerSecond:o.bitrate, audioBitsPerSecond:128000}); const parts = [];
  rec.ondataavailable = e=>{ if(e.data.size) parts.push(e.data); };
  v.currentTime = o.start; await new Promise(r=>v.onseeked = r);
  const draw = ()=>{ cx.drawImage(v, 0, 0, o.w, o.h); };
  draw(); rec.start(500); if(ac) await ac.resume();
  await v.play();
  await new Promise(res=>{
    const step = ()=>{ if(ctl.stop || v.ended || v.currentTime >= o.end){ res(); return; } draw(); onp(Math.min(.97,(v.currentTime-o.start)/(o.end-o.start)));
      v.requestVideoFrameCallback ? v.requestVideoFrameCallback(step) : requestAnimationFrame(step); };
    step(); });
  v.pause(); await new Promise(r=>{ rec.onstop = r; rec.stop(); });
  if(ac) ac.close(); URL.revokeObjectURL(v.src);
  if(ctl.stop) throw new Error("stop");
  return {blob: new Blob(parts, {type: mime.split(";")[0]}), live:true, mime};
}

// ---------- 화면 ----------
let F = null, D = null, out = null, busy = false, loading = false, ctl = {stop:false}, srcUrl = null;
const P = $("vtPlayer");
function info(){
  if(!F) return;
  const dur = D ? D.duration : (P.duration||0), vw = D ? D.v.w : P.videoWidth, vh = D ? D.v.h : P.videoHeight;
  const rot = D && D.v.matrix ? (u32(D.v.matrix,4)!==0 ? 90 : 0) : 0;
  const dispW = rot ? vh : vw, dispH = rot ? vw : vh;
  const fps = D ? Math.round(D.v.samples.length / Math.max(0.1, D.v.duration)) : 30;
  $("vtInfo").innerHTML = `<b>${esc(F.name)}</b><span>${fmt(dur)} · ${dispW}×${dispH} · ${fps}fps · ${mb(F.size)}${D ? ` · ${D.v.codec ? (/^avc/.test(D.v.codec) ? "H.264" : /^hvc|^hev/.test(D.v.codec) ? "HEVC" : D.v.codec) : esc(D.v.fmt)}${D.a ? (D.a.aac ? " + AAC 소리" : " + 소리") : " · 소리 없음"}` : ""}</span>`;
}
function opts(){
  const dur = D ? D.duration : (P.duration||0);
  let start = parseT($("vtStart").value), end = parseT($("vtEnd").value);
  if(isNaN(start)) start = 0; if(isNaN(end)) end = dur;
  start = Math.max(0, Math.min(start, dur)); end = Math.max(start, Math.min(end, dur));
  const vw = D ? D.v.w : P.videoWidth, vh = D ? D.v.h : P.videoHeight;
  const res = +document.querySelector("input[name=vtRes]:checked").value, q = document.querySelector("input[name=vtQ]:checked").value;
  const short = Math.min(vw, vh), sc = res && short > res ? res/short : 1;
  const ev = x=>Math.max(2, Math.round(x*sc/2)*2), w = ev(vw), h = ev(vh);
  const fps = D ? Math.min(60, Math.max(1, Math.round(D.v.samples.length / Math.max(0.1, D.v.duration)))) : 30;
  const bpp = {hi:.11, mid:.075, low:.045}[q];
  let bitrate = Math.round(w*h*fps*bpp);
  const srcBr = D ? D.v.bytes*8/Math.max(0.1, D.v.duration) : 0;
  if(srcBr && sc===1) bitrate = Math.min(bitrate, Math.round(srcBr*0.95));   // 원래보다 크게 만들지 않는다
  bitrate = Math.max(250000, bitrate);
  const mute = $("vtMute").checked, len = end-start;
  const aBytes = (!mute && D && D.a && D.a.aac) ? D.a.bytes * (len/Math.max(0.1, D.a.duration)) : (!mute && !D ? len*16000 : 0);
  const target = +$("vtTarget").value; let cbr = false, tooSmall = false;
  if(target && len>0){ const br = Math.floor((target*0.94 - aBytes)*8/len); if(br < bitrate){ bitrate = Math.max(150000, br); cbr = true; if(br < w*h*fps*0.02) tooSmall = true; } }
  const rot = D && D.v.matrix && u32(D.v.matrix,4)!==0;   // 세로로 돌려 보여 주는 영상이면 화면 표시는 가로·세로를 바꿔 쓴다
  return {start, end, len, w, h, dw: rot ? h : w, dh: rot ? w : h, fps, bitrate, mute, est: bitrate*len/8 + aBytes, cbr, tooSmall, target};
}
function draw(){
  const ok = !!F && !loading && (D || P.duration);
  $("vtSet").hidden = !ok; $("vtGoRow").hidden = !ok;
  if(!ok){ $("vtGo").disabled = true; return; }
  const o = opts();
  $("vtLen").textContent = `${fmt(o.start)} ~ ${fmt(o.end)} · ${fmt(o.len)} 길이`;
  const pct = x=>(100*x/((D?D.duration:P.duration)||1)).toFixed(2)+"%";
  $("vtRange").style.setProperty("--a", pct(o.start)); $("vtRange").style.setProperty("--b", pct(o.end));
  $("vtEst").innerHTML = `만들 영상: <b>${o.dw}×${o.dh}</b> · 약 <b>${mb(o.est)}</b>${F ? ` (원래 ${mb(F.size)})` : ""}${o.mute ? " · 소리 없음" : ""}` + (o.tooSmall ? `<em>목표 용량에 비해 영상이 길어 화질이 많이 떨어집니다. 구간을 짧게 하거나 해상도를 낮추세요.</em>` : "");
  $("vtGo").disabled = busy || o.len < 0.2;
  $("vtGo").textContent = busy ? "만드는 중…" : "MP4로 만들기";
  $("vtStop").hidden = !busy;
}
function syncSliders(){ const o = opts(), d = (D?D.duration:P.duration)||1; $("vtA").max = $("vtB").max = d; $("vtA").value = o.start; $("vtB").value = o.end; }
async function load(file){
  if(busy) return;
  if(!file){ return; }
  if(!/^video\//.test(file.type) && !/\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(file.name)){ toast("영상 파일만 넣을 수 있습니다"); return; }
  F = file; D = null; loading = true; clearOut(); $("vtSet").hidden = true; $("vtGoRow").hidden = true;
  if(srcUrl) URL.revokeObjectURL(srcUrl); srcUrl = URL.createObjectURL(file); P.src = srcUrl; $("vtPrev").hidden = false;
  $("vtHint").textContent = ""; $("vtMode").textContent = "";
  try{ D = typeof VideoDecoder!=="undefined" && typeof VideoEncoder!=="undefined" ? await demux(file) : null; }catch(e){ D = null; }
  if(D && !D.v.codec) D = null;
  if(D){ const ok = (await VideoDecoder.isConfigSupported({codec:D.v.codec, codedWidth:D.v.w, codedHeight:D.v.h, description:D.v.desc}).catch(()=>({supported:false}))).supported;
    if(!ok){ D.unsupported = true; } }
  await new Promise(r=>{ if(P.readyState>=1) r(); else { P.onloadedmetadata = r; P.onerror = r; setTimeout(r, 4000); } });
  const playable = P.readyState>=1 && P.duration>0 && P.videoWidth>0;   // 소리만 나오고 화면은 못 푸는 경우(HEVC 등)를 거른다
  if(D && D.unsupported){ if(playable){ D = null; $("vtMode").textContent = "이 영상은 빠른 방식으로 열 수 없어 '실시간 녹화' 방식으로 만듭니다. 고른 길이만큼 시간이 걸리고, 그동안 이 탭을 열어 두어야 합니다."; }
    else { $("vtHint").textContent = /hvc|hev/.test(D.v.fmt) ? HEVC_TIP : "이 브라우저가 풀 수 없는 영상 형식입니다."; F = null; } }
  else if(!D){ if(playable) $("vtMode").textContent = "MP4·MOV가 아닌 영상이라 '실시간 녹화' 방식으로 만듭니다. 고른 길이만큼 시간이 걸리고, 그동안 이 탭을 열어 두어야 합니다.";
    else { $("vtHint").textContent = "이 영상을 열지 못했습니다. MP4·MOV(H.264) 영상을 넣어 주세요."; F = null; } }
  loading = false;
  if(!F){ $("vtPrev").hidden = true; $("vtInfo").textContent = ""; draw(); return; }
  $("vtStart").value = fmt(0); $("vtEnd").value = fmt(D ? D.duration : P.duration);
  syncSliders(); info(); draw();
}
function clearOut(){ if(out && out.url) URL.revokeObjectURL(out.url); out = null; $("vtOut").hidden = true; $("vtOutV").removeAttribute("src"); }
const bar = r=>{ $("vtBar").hidden = r==null; if(r!=null) $("vtBar").firstElementChild.style.width = Math.round(r*100)+"%"; };
async function go(){
  if(busy || !F) return; const o = opts(); if(o.len < 0.2) return;
  busy = true; ctl = {stop:false}; clearOut(); P.pause(); draw(); bar(0); $("vtHint").textContent = D ? "만드는 중… 고른 구간만 풀고 다시 압축합니다." : "실시간으로 녹화하는 중… 이 탭을 닫거나 다른 탭으로 옮기지 마세요.";
  const t0 = performance.now();
  try{
    const r = D ? await transcode(D, o, bar, ctl) : await record(F, o, bar, ctl);
    const ext = /webm/.test(r.blob.type) ? "webm" : "mp4";
    out = {blob:r.blob, url:URL.createObjectURL(r.blob), name:(F.name.replace(/\.[^.]+$/,"")||"영상")+`-편집.${ext}`};
    $("vtOut").hidden = false; $("vtOutV").src = out.url; $("vtDl").href = out.url; $("vtDl").download = out.name;
    const sec = (performance.now()-t0)/1000;
    $("vtOutI").innerHTML = `<b>${esc(out.name)}</b><span>${o.dw}×${o.dh} · ${fmt(o.len)} · <b class="vtnew">${mb(r.blob.size)}</b>${r.blob.size < F.size ? ` <span class="pcpct">${Math.min(99,Math.floor((1-r.blob.size/F.size)*100))}% 줄임</span>` : ""}</span>`;
    let note = `${sec<60 ? Math.max(1,Math.round(sec))+"초" : Math.round(sec/60)+"분"} 걸렸습니다.`;
    if(o.target && r.blob.size > o.target) note += ` 목표(${mb(o.target)})보다 조금 큽니다. 구간을 줄이거나 해상도를 낮춰 다시 만들어 보세요.`;
    if(D && D.a && !D.a.aac && !o.mute) note += " 원래 소리가 AAC가 아니라서 소리 없이 만들었습니다.";
    if(r.live && ext==="webm") note += " 이 브라우저는 MP4로 녹화할 수 없어 WebM으로 만들었습니다. 아이폰 사진 앱에서는 열리지 않을 수 있습니다.";
    $("vtHint").textContent = note;
    $("vtOut").scrollIntoView({behavior:"smooth", block:"nearest"});
  }catch(e){
    const m = e.message;
    $("vtHint").textContent = m==="stop" ? "멈췄습니다." : m==="hevc" ? HEVC_TIP : m==="encoder" ? "이 브라우저에서 H.264로 압축할 수 없습니다. 크롬·엣지·사파리 최신판에서 해 보세요." : m==="recorder" ? "이 브라우저는 영상 녹화를 지원하지 않습니다." : "만들지 못했습니다. 영상이 손상되었거나 이 브라우저가 풀 수 없는 형식입니다.";
    if(m!=="stop") console.warn(e);
  }finally{ busy = false; bar(null); draw(); }
}

// ---------- 이벤트 ----------
$("vtFile").addEventListener("change", e=>{ load(e.target.files[0]); e.target.value = ""; });
const drop = $("vtDrop");
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.add("on"); }));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev, e=>{ e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", e=>load(e.dataTransfer.files[0]));
drop.addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("vtFile").click(); } });
$("vtSetA").addEventListener("click", ()=>{ $("vtStart").value = fmt(P.currentTime); if(parseT($("vtEnd").value) <= P.currentTime) $("vtEnd").value = fmt((D?D.duration:P.duration)); clearOut(); syncSliders(); draw(); });
$("vtSetB").addEventListener("click", ()=>{ $("vtEnd").value = fmt(P.currentTime); if(parseT($("vtStart").value) >= P.currentTime) $("vtStart").value = fmt(0); clearOut(); syncSliders(); draw(); });
["vtStart","vtEnd"].forEach(id=>$(id).addEventListener("change", ()=>{ const o = opts(); $("vtStart").value = fmt(o.start); $("vtEnd").value = fmt(o.end); clearOut(); syncSliders(); draw(); }));
$("vtA").addEventListener("input", ()=>{ let a = +$("vtA").value, b = +$("vtB").value; if(a > b-0.2){ a = Math.max(0, b-0.2); $("vtA").value = a; } $("vtStart").value = fmt(a); P.currentTime = a; clearOut(); draw(); });
$("vtB").addEventListener("input", ()=>{ let a = +$("vtA").value, b = +$("vtB").value; if(b < a+0.2){ b = a+0.2; $("vtB").value = b; } $("vtEnd").value = fmt(b); P.currentTime = b; clearOut(); draw(); });
$("vtPlaySel").addEventListener("click", ()=>{ const o = opts(); P.currentTime = o.start; P.play(); const stopAt = ()=>{ if(P.currentTime >= o.end){ P.pause(); P.removeEventListener("timeupdate", stopAt); } }; P.addEventListener("timeupdate", stopAt); });
document.querySelectorAll("input[name=vtRes],input[name=vtQ]").forEach(r=>r.addEventListener("change", ()=>{ clearOut(); draw(); }));
["vtTarget","vtMute"].forEach(id=>$(id).addEventListener("change", ()=>{ clearOut(); draw(); }));
$("vtGo").addEventListener("click", go);
$("vtStop").addEventListener("click", ()=>{ ctl.stop = true; $("vtHint").textContent = "멈추는 중…"; });
P.addEventListener("loadedmetadata", ()=>{ if(F && !D && !loading){ info(); syncSliders(); draw(); } });
if(typeof VideoEncoder==="undefined") $("vtHint").textContent = "이 브라우저는 빠른 영상 압축(WebCodecs)을 지원하지 않아 '실시간 녹화' 방식으로만 만들 수 있습니다. 크롬·엣지·사파리 최신판을 권합니다.";
if(location.hash==="#bot") window.__vt = {demux, opts, D:()=>D};
draw();
})();

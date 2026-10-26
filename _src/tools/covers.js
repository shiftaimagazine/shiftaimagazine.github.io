// usage: node covers.js list.json outdir
const {chromium}=require('playwright'); const fs=require('fs'); const path=require('path');
const [,,listFile,outDir]=process.argv; const list=JSON.parse(fs.readFileSync(listFile,'utf8'));
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const page=(it)=>`<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1280px;height:720px;background:#161616;color:#f1f1ee;font-family:"Noto Sans CJK KR","Noto Sans KR","Apple SD Gothic Neo",sans-serif;position:relative;overflow:hidden}
.brand{position:absolute;left:84px;top:70px;font-weight:800;font-size:30px;letter-spacing:-.01em}.brand b{color:#E0663A}
.num{position:absolute;right:84px;top:62px;font-weight:800;font-size:120px;line-height:1;color:#262626;letter-spacing:-.04em}
.tag{position:absolute;left:84px;top:330px;background:#E0663A;color:#fff;font-weight:800;font-size:22px;border-radius:999px;padding:8px 20px}
h1{position:absolute;left:84px;right:84px;top:390px;font-size:${it.title.length>26?50:58}px;line-height:1.2;font-weight:800;letter-spacing:-.03em;word-break:keep-all}
.line{position:absolute;left:84px;right:84px;bottom:92px;font-size:22px;color:#b9bab3;word-break:keep-all}
.foot{position:absolute;left:84px;right:84px;bottom:40px;display:flex;justify-content:space-between;font-size:17px;color:#8a8b85}
</style><div class="brand">SHIFT <b>AI</b></div>${it.num?`<div class="num">${esc(it.num)}</div>`:''}<div class="tag">${esc(it.tag||'SHIFT AI 무료 정리본')}</div><h1>${esc(it.title)}</h1><div class="line">${esc(it.line||'')}</div><div class="foot"><span>@shift_ai_magazine</span><span>Don't search. Just Shift.</span></div>`;
(async()=>{const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1280,height:720}});
 fs.mkdirSync(outDir,{recursive:true});
 for(const it of list){ await p.setContent(page(it)); await p.waitForTimeout(60); const f=path.join(outDir,it.id+'.png'); await p.screenshot({path:f}); }
 await b.close(); console.log('rendered',list.length);})();

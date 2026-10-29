// 표지 인포그래픽 만들기: _src/news/covers.json 의 항목마다 1600×900 그림을 그려 img/cover/<id>.png 로 저장한다.
// (webp 변환은 _src/covers.py 가 이어서 함 — 한 번에: python3 _src/covers.py [id …])
// 회사 로고·제품 화면을 흉내 내지 않고 글자와 색 띠만 쓴다. AI 생성 이미지가 아니다. 쓰는 법은 news/VISUAL_GUIDE.md
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.dirname(SRC);
const specs = JSON.parse(fs.readFileSync(path.join(SRC, 'news/covers.json')));
const only = process.argv.slice(2);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const html = c => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1600px;height:900px;background:#f6f4ef;font-family:"Noto Sans CJK KR","Noto Sans KR",sans-serif;color:#111214;padding:84px 96px 70px;display:flex;flex-direction:column}
.k{font-size:30px;font-weight:700;color:#d4581f;letter-spacing:.01em}
h1{font-size:${c.size || 76}px;line-height:1.22;font-weight:800;margin-top:22px;letter-spacing:-.02em;white-space:pre-line}
.tiles{display:grid;grid-template-columns:repeat(${c.tiles.length},1fr);gap:22px;margin-top:auto}
.t{background:#fff;border-radius:22px;padding:28px 28px 26px;border-top:12px solid var(--c);box-shadow:0 1px 0 #e6e6e3}
.t b{display:block;font-size:${c.tileSize || 38}px;font-weight:800;line-height:1.2}
.t span{display:block;font-size:25px;line-height:1.45;color:#3a3b3f;margin-top:10px;white-space:pre-line}
.f{display:flex;justify-content:space-between;align-items:center;margin-top:30px;font-size:23px;color:#6f7076}
.f b{color:#111214;font-weight:800;letter-spacing:.02em}
</style></head><body>
<div class="k">${esc(c.kicker)}</div><h1>${esc(c.title)}</h1>
<div class="tiles">${c.tiles.map((t, i) => `<div class="t" style="--c:${COLORS[i % 4]}"><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div>`).join('')}</div>
<div class="f"><span>${esc(c.foot || '')}</span><b>SHIFT AI</b></div>
</body></html>`;
(async () => {
  const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  const pg = await b.newPage({ viewport: { width: 1600, height: 900 } });
  fs.mkdirSync(path.join(OUT, 'img/cover'), { recursive: true });
  for (const c of specs) {
    if (only.length && !only.includes(c.id)) continue;
    await pg.setContent(html(c), { waitUntil: 'load' });
    await pg.screenshot({ path: path.join(OUT, 'img/cover', c.id + '.png') });
    console.log('cover', c.id);
  }
  await b.close();
})();

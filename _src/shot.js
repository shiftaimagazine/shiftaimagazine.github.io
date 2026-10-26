// 원문 페이지 첫 화면 캡처(1280×720). 사용: node _src/shot.js <url> <out.png>
const { chromium } = require('playwright');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'ko-KR' });
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: out });
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

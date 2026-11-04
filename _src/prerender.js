// 각 페이지를 브라우저로 한 번 그려서 완성된 HTML로 저장한다(검색엔진·미리보기용).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.dirname(SRC);
const pages = JSON.parse(fs.readFileSync(path.join(SRC, 'build/pages.json')));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(OUT, p);
  if (!f.startsWith(OUT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port, base = `http://127.0.0.1:${port}`;
  const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}); const ctx = await b.newContext();
  await ctx.route(/.*/, r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  // 가벼운 데이터(assets/data-lite.js, 11/3~): 다 그려 둔 페이지는 기사 본문·튜토리얼 단계가 필요 없다.
  // 목록 카드에 쓰는 읽는 시간·단계 수는 app.js 의 같은 함수로 미리 계산해 넣는다. 본문 검색이 필요한 페이지(FULL)만 전체 data.js 를 받는다.
  const FULL = new Set(['/search/', '/prompts/', '/tutorial/']);
  const KEYS = ['ARTICLES', 'TUTORIALS', 'TUT_CATS', 'TOOLS', 'AI_PRICES', 'RESOURCES', 'COLUMNS', 'DAILY', 'TERMS', 'VS', 'ABOUT_CARD'];
  const dk = Object.keys(JSON.parse(fs.readFileSync(path.join(SRC, 'build/data.json'))));
  if (dk.join() !== KEYS.join()) throw new Error('data.json 항목이 바뀜: prerender.js 의 KEYS 와 lite 계산을 고칠 것 → ' + dk.join());
  await pg.goto(base + '/', { waitUntil: 'load' });
  const lite = await pg.evaluate(() => {
    const omit = (o, ks) => { const r = { ...o }; ks.forEach(k => delete r[k]); return r; };
    return { ARTICLES: ARTICLES.map(a => ({ ...omit(a, ['body', 'facts', 'sources', 'ask', 'try', 'sub', 'terms', 'who']), rm: readMin(a.body) })),
      TUTORIALS: TUTORIALS.map(t => ({ ...omit(t, ['items', 'limits', 'intro', 'bonus', 'quick', 'sources', 'master', 'why']), n: t.items.length, rd: tutRead(t) })),
      TUT_CATS, TOOLS, AI_PRICES, RESOURCES, COLUMNS: COLUMNS.map(c => ({ ...omit(c, ['body']), rm: readMin(c.body) })), DAILY, TERMS, VS, ABOUT_CARD, FOLLOWBOX };
  });
  fs.writeFileSync(path.join(OUT, 'assets/data-lite.js'), Object.entries(lite).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};\n`).join(''));
  for (const p of pages) {
    errs.length = 0;
    await pg.goto(base + p, { waitUntil: 'load' });
    // 줄바꿈 다듬기(11/3~): 제목·굵은 글씨에서 가운뎃점(·) 앞에서 줄이 바뀌어 '·마크다운'처럼 줄이 점으로 시작하지 않게
    // 점 앞에 보이지 않는 이음표(U+2060)를 넣는다. 점 뒤에서는 그대로 줄을 바꿀 수 있다. 본문·주소·복사용 글은 건드리지 않는다.
    let doc = await pg.evaluate(() => {
      document.querySelectorAll('h1,h2,h3,h4,b,strong').forEach(el => {
        if (el.closest('[data-copy],pre,code,script,style,textarea')) return;
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
        while ((n = w.nextNode())) if (n.data.includes('·')) n.data = n.data.replace(/(\S)·/g, '$1\u2060·');
      });
      document.body.dataset.pre = '1'; return '<!doctype html>\n' + document.documentElement.outerHTML + '\n'; });
    if (errs.length) { console.error('JS error on', p, errs); process.exitCode = 1; }
    if (!FULL.has(p)) { const n0 = doc.length; doc = doc.replace(/<script src="\/assets\/data\.js\?v=/, '<script src="/assets/data-lite.js?v='); if (doc.length === n0) { console.error('data.js 줄 없음', p); process.exitCode = 1; } }
    const file = p === '/' ? path.join(OUT, 'index.html') : path.join(OUT, p, 'index.html');
    fs.writeFileSync(file, doc);
  }
  // 404
  fs.renameSync(path.join(OUT, '404-tmp/index.html'), path.join(OUT, '404.html')); fs.rmdirSync(path.join(OUT, '404-tmp'));
  await b.close(); server.close();
  console.log('prerendered', pages.length);
});

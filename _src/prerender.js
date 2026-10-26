// 각 페이지를 브라우저로 한 번 그려서 완성된 HTML로 저장한다(검색엔진·미리보기용).
// 구독 폼: _src/subscribe-embed.html 이 있으면 <!--SUB-->…<!--/SUB--> 자리에 넣는다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRC = __dirname, OUT = path.dirname(SRC);
const pages = JSON.parse(fs.readFileSync(path.join(SRC, 'build/pages.json')));
const embedFile = path.join(SRC, 'subscribe-embed.html');
const EMBED = fs.existsSync(embedFile) ? fs.readFileSync(embedFile, 'utf8').trim() : null;
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
  const b = await chromium.launch(); const ctx = await b.newContext();
  await ctx.route(/.*/, r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  for (const p of pages) {
    errs.length = 0;
    await pg.goto(base + p, { waitUntil: 'load' });
    let doc = await pg.evaluate(() => { document.body.dataset.pre = '1'; return '<!doctype html>\n' + document.documentElement.outerHTML + '\n'; });
    if (errs.length) { console.error('JS error on', p, errs); process.exitCode = 1; }
    if (EMBED) doc = doc.replace(/<!--SUB-->[\s\S]*?<!--\/SUB-->/g, '<!--SUB-->' + EMBED + '<!--/SUB-->');
    const file = p === '/' ? path.join(OUT, 'index.html') : path.join(OUT, p, 'index.html');
    fs.writeFileSync(file, doc);
  }
  // 404
  fs.renameSync(path.join(OUT, '404-tmp/index.html'), path.join(OUT, '404.html')); fs.rmdirSync(path.join(OUT, '404-tmp'));
  await b.close(); server.close();
  console.log('prerendered', pages.length, EMBED ? 'with subscribe embed' : 'without embed (placeholder)');
});

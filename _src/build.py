# SHIFT AI 매거진 정적 사이트 빌드.
# 순서: python3 _src/assemble.py → python3 _src/build.py → node _src/prerender.js  (한 번에: sh _src/build.sh)
import json, os, re, html, hashlib, datetime
from PIL import Image, ImageDraw, ImageFont

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
OUT = os.path.dirname(SRC.rstrip('/')) + '/'
SITE = 'https://shiftaimagazine.github.io'
IG = 'https://www.instagram.com/shift_ai_magazine/'
D = json.load(open(SRC + 'build/data.json'))
A, T, C, DY, TERMS = D['ARTICLES'], D['TUTORIALS'], D['COLUMNS'], D['DAILY'], D['TERMS']
byId = {a['id']: a for a in A}
esc = lambda s: html.escape(str(s or ''), quote=True)
view = lambda n: open(SRC + 'views/' + n + '.html').read()

# ---- 정적 조각 ----
def fix_links(s):
    s = s.replace('href="#home"', 'href="/"')
    s = re.sub(r'href="#(news|tutorial|column|daily|dict|about)"', r'href="/\1/"', s)
    return s

FOLLOWBOX = view('follow-box').strip()
header = fix_links(view('header'))
footer = fix_links(view('footer')).replace('<span>shiftai.magazine@gmail.com</span>',
    '<a href="/privacy/">개인정보처리방침</a><a href="/feed.xml">RSS</a><span>shiftai.magazine@gmail.com</span>')
assert '/privacy/' in footer

def with_follow(v, before='</main>'):
    i = v.rindex(before); return v[:i] + FOLLOWBOX + '\n' + v[i:]

home = fix_links(view('home'))
home = home.replace('<div class="sec"><h2>튜토리얼</h2>', FOLLOWBOX + '\n  <div class="sec"><h2>튜토리얼</h2>', 1)
about = fix_links(view('about'))

STATIC = {
    'home': home,
    'news': with_follow(fix_links(view('news'))),
    'tutorial': with_follow(fix_links(view('tutorial'))),
    'daily': with_follow(fix_links(view('daily'))),
    'dict': fix_links(view('dict')),
    'about': about,
    'privacy': view('privacy'),
}

# ---- 공유 이미지(og) ----
os.makedirs(OUT + 'og', exist_ok=True)
FONT_B = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
FONT_R = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def border(im):
    w, h = im.size; px = []
    for box in [(0, 0, w, 3), (0, h - 3, w, h), (0, 0, 3, h), (w - 3, 0, w, h)]:
        px += list(im.crop(box).getdata())
    px.sort(key=sum); return px[len(px) // 2]
def og_from(src, name):
    out = f'og/{name}.jpg'
    if os.path.exists(OUT + out) and os.path.getmtime(OUT + out) > os.path.getmtime(OUT + src): return out
    im = Image.open(OUT + src).convert('RGB'); W, H = 1200, 630
    r = min(W / im.width, H / im.height); nw, nh = round(im.width * r), round(im.height * r)
    c = Image.new('RGB', (W, H), border(im)); c.paste(im.resize((nw, nh), Image.LANCZOS), ((W - nw) // 2, (H - nh) // 2))
    c.save(OUT + out, 'JPEG', quality=84, optimize=True, progressive=True); return out
def og_brand():
    out = 'og/site.jpg'; W, H = 1200, 630
    c = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(c)
    logo = Image.open(OUT + 'img/logo-wide.webp').convert('RGBA'); s = 520 / logo.width
    logo = logo.resize((520, round(logo.height * s)), Image.LANCZOS); c.paste(logo, ((W - 520) // 2, 150), logo)
    fb = ImageFont.truetype(FONT_B, 50, index=1); fr = ImageFont.truetype(FONT_R, 28, index=1)
    t1 = 'AI 소식, 검색하지 말고 SHIFT 하세요.'; t2 = 'AI 데일리 이슈 · AI 뉴스 · 튜토리얼 · AI 사전'
    y = 150 + logo.height + 56
    d.text(((W - d.textlength(t1, font=fb)) / 2, y), t1, font=fb, fill=(17, 18, 20))
    d.text(((W - d.textlength(t2, font=fr)) / 2, y + 78), t2, font=fr, fill=(111, 112, 118))
    d.rectangle((0, H - 10, W, H), fill=(242, 201, 76))
    c.save(OUT + out, 'JPEG', quality=86, optimize=True); return out
OG_SITE = og_brand() if os.path.exists(FONT_B) or not os.path.exists(OUT + 'og/site.jpg') else 'og/site.jpg'
img_of = lambda a: (a.get('image') or {}).get('src') or 'img/logo.webp'
def col_img(c):
    if c.get('image') and c['image'].get('src'): return c['image']['src']
    return img_of(byId[c['rel']]) if c.get('rel') in byId else 'img/logo.webp'
def day_img(d):
    its = [byId[i] for i in d['items'] if i in byId]
    lead = byId.get(d.get('lead')) or its[0]
    return img_of(lead)

# favicon
lg = Image.open(OUT + 'img/logo.webp').convert('RGBA')
for size, name in [(64, 'favicon.png'), (180, 'apple-touch-icon.png')]:
    bg = Image.new('RGBA', lg.size, (255, 255, 255, 255)); bg.alpha_composite(lg)
    bg.convert('RGB').resize((size, size), Image.LANCZOS).save(OUT + name, 'PNG', optimize=True)

# ---- 공유 자산 ----
os.makedirs(OUT + 'assets', exist_ok=True)
data_js = ''.join(f'const {k} = {json.dumps(v, ensure_ascii=False)};\n' for k, v in D.items()) + f'const FOLLOWBOX = {json.dumps(FOLLOWBOX, ensure_ascii=False)};\n'
app_js = open(SRC + 'app.js').read()
css = open(SRC + 'site.css').read()
open(OUT + 'assets/data.js', 'w').write(data_js)
open(OUT + 'assets/app.js', 'w').write(app_js)
open(OUT + 'assets/site.css', 'w').write(css)
VER = hashlib.sha1((data_js + app_js + css).encode()).hexdigest()[:8]

VERIFY = (open(SRC + 'verify-meta.html').read().strip() + '\n') if os.path.exists(SRC + 'verify-meta.html') else ''
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap">'
def kst(date, time='09:00'): return f'{date}T{time}:00+09:00'

def page(path, route, title, desc, main, og, typ='website', extra=''):
    url = SITE + path
    doc = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<base href="/">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="SHIFT AI">
<meta property="og:locale" content="ko_KR">
<meta property="og:type" content="{typ}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
<meta name="robots" content="index,follow,max-image-preview:large">
{VERIFY}{extra}<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="SHIFT AI" href="/feed.xml">
{FONTS}
<link rel="stylesheet" href="/assets/site.css?v={VER}">
</head>
<body data-route="{route}">
<div class="wrap">
{header}
{main}
{footer}
</div>
<div class="toast" id="toast" role="status"></div>
<script src="/assets/data.js?v={VER}"></script>
<script src="/assets/app.js?v={VER}"></script>
</body>
</html>
'''
    d = OUT + path.strip('/'); os.makedirs(d, exist_ok=True) if path != '/' else None
    open((d + '/' if path != '/' else OUT) + 'index.html', 'w').write(doc)
    PAGES.append(path)

PAGES = []
TAG = 'AI 소식, 검색하지 말고 SHIFT 하세요'
HOME_LD = [{'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'SHIFT AI', 'alternateName': 'SHIFT AI 매거진', 'url': SITE + '/', 'inLanguage': 'ko',
            'potentialAction': {'@type': 'SearchAction', 'target': SITE + '/news/?q={search_term_string}', 'query-input': 'required name=search_term_string'}},
           {'@context': 'https://schema.org', '@type': 'NewsMediaOrganization', 'name': 'SHIFT AI', 'url': SITE + '/', 'logo': SITE + '/img/brand/logo-800.png', 'email': 'shiftai.magazine@gmail.com',
            'sameAs': [IG, 'https://www.threads.com/@shift_ai_magazine', 'https://www.youtube.com/channel/UCWzwTQoe0q2IdwZV6BuopVw']}]
HOME_EXTRA = ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in HOME_LD)
page('/', 'home', 'SHIFT AI — 오늘의 AI 뉴스, 원문부터 읽는 인공지능 매거진', '오늘 나온 AI 뉴스를 회사 발표·논문·공식 게시물 같은 원문부터 읽고 쉽게 정리합니다. 챗GPT·클로드·제미나이 등 인공지능 소식, AI 데일리 이슈, 따라 하는 AI 튜토리얼과 칼럼.', STATIC['home'], OG_SITE, 'website', HOME_EXTRA)
LISTS = {'news': ('AI 뉴스 — 오늘의 인공지능 소식', '오늘 나온 AI 뉴스와 인공지능 기사. 회사 발표·논문·공식 게시물 같은 원문을 읽고 쓰며, 모든 기사 끝에 원문 링크가 있다.'),
         'tutorial': ('튜토리얼 · AI 실전 꿀팁', '오늘 바로 따라 할 수 있는 AI 실전 꿀팁. 항목마다 복사해 쓰는 프롬프트와 함께.'),
         'daily': ('AI 데일리 뉴스 — 날마다 정리하는 AI 이슈', '그날 나온 AI 뉴스를 한 장에. 제목 한 줄, 요점 세 줄, 소식 목록과 숫자.'),
         'dict': ('AI 사전', '기사에 나오는 AI 용어를 한 줄로 풀고 관련 기사로 잇는다.'),
         'about': ('소개', 'SHIFT AI는 AI 소식을 원문부터 읽고 "그래서 무엇이 달라지는가"를 쓰는 AI 매거진이다.'),
         'privacy': ('개인정보처리방침', 'SHIFT AI 매거진 개인정보처리방침.')}
for r, (t, ds) in LISTS.items():
    page(f'/{r}/', r, f'{t} · SHIFT AI', ds, STATIC[r], OG_SITE)

ART = '<main id="v-article"></main>'
# 뉴스레터 페이지는 없앰 → /subscribe/ 는 첫 화면으로
os.makedirs(OUT + 'subscribe', exist_ok=True)
open(OUT + 'subscribe/index.html', 'w').write(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>SHIFT AI</title><link rel="canonical" href="{SITE}/"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0; url=/"><script>location.replace("/")</script></head><body><a href="/">SHIFT AI</a></body></html>\n')
# 칼럼 목록은 AI 뉴스 안의 '칼럼' 분류로 옮김 → 예전 주소 /column/ 은 그쪽으로 넘긴다
_go = '/news/?cat=%EC%B9%BC%EB%9F%BC'
os.makedirs(OUT + 'column', exist_ok=True)
open(OUT + 'column/index.html', 'w').write(f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>칼럼 · SHIFT AI</title>
<link rel="canonical" href="{SITE}{_go}"><meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url={_go}"><script>location.replace("{_go}")</script></head>
<body><a href="{_go}">칼럼 보기</a></body></html>
''')
# 주소가 바뀐 글: 예전 주소 → 새 주소 (_src/news/redirects.json {"/news/옛-id/": "/news/새-id/"})
_rp = SRC + 'news/redirects.json'
for _old, _new in (json.load(open(_rp)) if os.path.exists(_rp) else {}).items():
    assert _old.startswith('/') and _old.endswith('/') and _new.startswith('/'), ('redirects 형식', _old, _new)
    os.makedirs(OUT + _old.strip('/'), exist_ok=True)
    open(OUT + _old.strip('/') + '/index.html', 'w').write(f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>SHIFT AI</title>
<link rel="canonical" href="{SITE}{_new}"><meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0; url={_new}"><script>location.replace("{_new}")</script></head>
<body><a href="{_new}">새 주소로 이동</a></body></html>
''')
for a in A:
    og = og_from(img_of(a), 'a-' + a['id'])
    ld = {'@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': a['title'], 'description': a['hook'],
          'image': [f'{SITE}/{og}'], 'datePublished': kst(a['date'], a.get('time') or '09:00'), 'dateModified': kst(a['date'], a.get('time') or '09:00'),
          'author': {'@type': 'Organization', 'name': 'SHIFT AI 편집부'},
          'publisher': {'@type': 'Organization', 'name': 'SHIFT AI', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/img/logo.webp'}},
          'mainEntityOfPage': f"{SITE}/news/{a['id']}/", 'articleSection': a['cat'], 'inLanguage': 'ko'}
    extra = (f'<meta property="article:published_time" content="{kst(a["date"], a.get("time") or "09:00")}">\n'
             f'<meta property="article:section" content="{esc(a["cat"])}">\n'
             f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n')
    page(f"/news/{a['id']}/", 'a-' + a['id'], f"{a['title']} · SHIFT AI", a['hook'], ART, og, 'article', extra)
for t in T:
    og = og_from(t['thumb'], t['id'])
    page(f"/tutorial/{t['id'][2:]}/", t['id'], f"{t['title']} · SHIFT AI 튜토리얼", t['deck'], ART, og, 'article')
for c in C:
    og = og_from(col_img(c), c['id'])
    page(f"/column/{c['id'][2:]}/", c['id'], f"{c['title']} · SHIFT AI 칼럼", c['deck'], ART, og, 'article')
for d in DY:
    og = og_from(day_img(d), 'd-' + d['date'])
    y, m, dd = d['date'].split('-')
    page(f"/daily/{d['date']}/", 'd-' + d['date'], f"{int(y)}년 {int(m)}월 {int(dd)}일 AI 데일리 뉴스 — {d['title']} · SHIFT AI", d.get('summary') or ' / '.join(d['three']), ART, og, 'article')

# 404
nf = '''<main id="v-404"><div class="notfound narrow"><h1>찾는 페이지가 없습니다</h1><p>주소가 바뀌었거나 지워진 글입니다. 아래에서 다시 찾아보세요.</p>
<div class="acts"><a class="btn" href="/">첫 화면</a><a class="ghost" href="/news/">AI 뉴스</a><a class="ghost" href="/daily/">데일리 이슈</a></div></div></main>'''
page('/404-tmp/', '404', '페이지를 찾을 수 없습니다 · SHIFT AI', 'SHIFT AI 매거진', nf, OG_SITE)
PAGES.remove('/404-tmp/')

# ---- 사이트맵·RSS·robots ----
last = {'/': max(a['date'] for a in A)}
for a in A: last[f"/news/{a['id']}/"] = a['date']
for t in T: last[f"/tutorial/{t['id'][2:]}/"] = t['date']
for c in C: last[f"/column/{c['id'][2:]}/"] = c['date']
for d in DY: last[f"/daily/{d['date']}/"] = d['date']
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for p in PAGES:
    if p == '/privacy/': continue
    sm.append(f'<url><loc>{SITE}{p}</loc>' + (f'<lastmod>{last[p]}</lastmod>' if p in last else f'<lastmod>{last["/"]}</lastmod>') + '</url>')
sm.append('</urlset>')
open(OUT + 'sitemap.xml', 'w').write('\n'.join(sm) + '\n')
open(OUT + 'robots.txt', 'w').write(f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
def rfc822(date, time):
    dt = datetime.datetime.strptime(f'{date} {time}', '%Y-%m-%d %H:%M')
    return dt.strftime('%a, %d %b %Y %H:%M:00 +0900')
items = []
for a in sorted(A, key=lambda a: a['date'] + (a.get('time') or ''), reverse=True)[:40]:
    u = f"{SITE}/news/{a['id']}/"
    items.append(f"<item><title>{esc(a['title'])}</title><link>{u}</link><guid>{u}</guid><pubDate>{rfc822(a['date'], a.get('time') or '09:00')}</pubDate><category>{esc(a['cat'])}</category><description>{esc(a['hook'])}</description></item>")
rss = (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>SHIFT AI 매거진</title><link>{SITE}/</link>'
       f'<description>{esc(TAG)}</description><language>ko</language>' + ''.join(items) + '</channel></rss>\n')
open(OUT + 'feed.xml', 'w').write(rss)
json.dump(PAGES + ['/404-tmp/'], open(SRC + 'build/pages.json', 'w'))
print('pages', len(PAGES), 'version', VER)

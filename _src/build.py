# SHIFT AI 매거진 정적 사이트 빌드.
# 순서: python3 _src/assemble.py → python3 _src/build.py → node _src/prerender.js  (한 번에: sh _src/build.sh)
import json, os, re, html, hashlib, datetime
from PIL import Image, ImageDraw, ImageFont

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
OUT = os.path.dirname(SRC.rstrip('/')) + '/'
SITE = 'https://shiftaimagazine.com'
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
    'search': view('search'),
    'tools': with_follow(fix_links(view('tools'))),
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
# 무료 도구 스크립트(_src/widgets/*.js → assets/)
WIDGET_VER = {}
for _f in sorted(os.listdir(SRC + 'widgets')) if os.path.isdir(SRC + 'widgets') else []:
    if _f.endswith('.js'):
        _w = open(SRC + 'widgets/' + _f).read(); open(OUT + 'assets/' + _f, 'w').write(_w); WIDGET_VER[_f] = hashlib.sha1(_w.encode()).hexdigest()[:8]
VER = hashlib.sha1((data_js + app_js + css).encode()).hexdigest()[:8]

VERIFY = (open(SRC + 'verify-meta.html').read().strip() + '\n') if os.path.exists(SRC + 'verify-meta.html') else ''
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap">'
# 방문 통계: GoatCounter(쿠키 없음, IP 저장 안 함). 개인정보처리방침 7일 전 공지 약속에 따라 시행일부터 센다. 미리 그리기(prerender)·로컬에서는 안 셈.
GC_CODE, GC_START = 'shiftai', '2026-11-03T00:00:00+09:00'
ANALYTICS = ('<script>(function(){if(navigator.webdriver||location.hostname!=="shiftaimagazine.com"||Date.now()<Date.parse("' + GC_START + '"))return;'
             'var s=document.createElement("script");s.async=true;s.dataset.goatcounter="https://' + GC_CODE + '.goatcounter.com/count";s.src="https://gc.zgo.at/count.js";document.head.appendChild(s)})()</script>\n') if GC_CODE else ''
def kst(date, time='09:00'): return f'{date}T{time}:00+09:00'
# 구조화 데이터(JSON-LD) 도우미
LD = lambda *xs: ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in xs)
def crumbs(*items):  # (이름, 경로) … → BreadcrumbList (첫 화면이 맨 앞)
    its = [('SHIFT AI', '/')] + list(items)
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList',
            'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE + u} for i, (n, u) in enumerate(its)]}
BRAND_ALT = ['SHIFT AI 매거진', '시프트 AI', '시프트 AI 매거진', 'SHIFT AI Magazine']
PUBLISHER = {'@type': 'NewsMediaOrganization', 'name': 'SHIFT AI', 'url': SITE + '/', 'logo': {'@type': 'ImageObject', 'url': SITE + '/img/brand/logo-800.png'}}
AUTHOR = {'@type': 'Organization', 'name': 'SHIFT AI 편집부', 'url': SITE + '/about/'}

def page(path, route, title, desc, main, og, typ='website', extra='', robots='index,follow,max-image-preview:large'):
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
<meta name="robots" content="{robots}">
{VERIFY}{extra}{ANALYTICS}<link rel="icon" type="image/png" href="/favicon.png">
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
HOME_LD = [{'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'SHIFT AI', 'alternateName': BRAND_ALT, 'url': SITE + '/', 'inLanguage': 'ko',
            'potentialAction': {'@type': 'SearchAction', 'target': SITE + '/search/?q={search_term_string}', 'query-input': 'required name=search_term_string'}},
           {'@context': 'https://schema.org', '@type': 'NewsMediaOrganization', 'name': 'SHIFT AI', 'alternateName': BRAND_ALT, 'url': SITE + '/', 'logo': SITE + '/img/brand/logo-800.png', 'email': 'shiftai.magazine@gmail.com',
            'description': 'AI 소식을 회사 발표·논문 같은 원문부터 확인하고 써 볼 만한지 판정하는 한국어 AI 매거진', 'inLanguage': 'ko', 'publishingPrinciples': SITE + '/about/',
            'sameAs': [IG, 'https://www.threads.com/@shift_ai_magazine', 'https://www.youtube.com/channel/UCWzwTQoe0q2IdwZV6BuopVw']}]
HOME_EXTRA = ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in HOME_LD)
page('/', 'home', 'SHIFT AI(시프트 AI) — 오늘의 AI 뉴스, 원문부터 읽는 인공지능 매거진', '오늘 나온 AI 뉴스를 회사 발표나 논문 같은 원문부터 읽고 써 볼 만한지 판정합니다. 챗GPT, 클로드, 제미나이 같은 인공지능 소식과 AI 데일리 이슈, 따라 해 볼 수 있는 튜토리얼, 칼럼을 싣습니다.', STATIC['home'], OG_SITE, 'website', HOME_EXTRA)
LISTS = {'news': ('AI 뉴스 — 오늘의 인공지능 소식', '오늘 나온 AI 뉴스와 인공지능 기사. 회사 발표·논문·공식 게시물 같은 원문을 읽고 쓰며, 모든 기사 끝에 원문 링크가 있습니다.'),
         'tutorial': ('튜토리얼 · AI 실전 꿀팁', '오늘 바로 따라 할 수 있는 AI 실전 꿀팁. 프롬프트 모음부터 클로드 코드·n8n·리모션 설정까지, 공식 문서로 확인한 내용만 단계별로 정리했습니다.'),
         'daily': ('AI 데일리 뉴스 — 날마다 정리하는 AI 이슈', '그날 나온 AI 뉴스를 한 장에 모았습니다. 제목 한 줄과 요점 세 줄, 소식 목록과 숫자를 한 번에 봅니다.'),
         'dict': ('AI 사전 — AI 용어 뜻 쉽게 풀이', f'AI 용어 {len(TERMS)}개의 뜻을 쉬운 말로 풀었습니다. 에이전트·RAG·MCP·토큰 같은 AI 용어부터 API·GPU 같은 IT 용어, 클로드·챗GPT·제미나이 같은 제품 이름까지 관련 기사와 함께 봅니다.'),
         'tools': ('무료 AI 도구 — 설치·가입 없이 브라우저에서 바로', '개인정보 자동 가리기, AI 요금 계산기, 무료 실시간 크롬 번역처럼 돈 내고 쓰던 기능을 설치 없이 브라우저에서 바로 씁니다. 넣은 파일은 어디에도 보내지 않습니다.'),
         'about': ('소개', 'SHIFT AI는 AI 소식을 원문부터 확인하고 써 볼 만한지 판정하는 AI 매거진입니다.'),
         'privacy': ('개인정보처리방침', 'SHIFT AI 매거진 개인정보처리방침.')}
LIST_NAME = {'news': 'AI 뉴스', 'tutorial': '튜토리얼', 'daily': '데일리 이슈', 'dict': 'AI 사전', 'tools': '무료 도구', 'about': '소개', 'privacy': '개인정보처리방침'}
TERMSET = {'@type': 'DefinedTermSet', 'name': 'SHIFT AI AI 사전', 'url': SITE + '/dict/', 'inLanguage': 'ko'}
for r, (t, ds) in LISTS.items():
    xs = [crumbs((LIST_NAME[r], f'/{r}/'))]
    if r == 'dict': xs.append({'@context': 'https://schema.org', **TERMSET, 'description': ds,
                               'hasDefinedTerm': [{'@type': 'DefinedTerm', 'name': x['t'], 'url': f"{SITE}/dict/{x['s']}/"} for x in TERMS]})
    if r == 'about': xs.append({'@context': 'https://schema.org', '@type': 'AboutPage', 'name': 'SHIFT AI 소개', 'url': SITE + '/about/', 'about': {k: v for k, v in PUBLISHER.items()}})
    page(f'/{r}/', r, f'{t} · SHIFT AI', ds, STATIC[r], OG_SITE, 'website', LD(*xs))

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
          'author': AUTHOR, 'publisher': PUBLISHER, 'isAccessibleForFree': True,
          'mainEntityOfPage': f"{SITE}/news/{a['id']}/", 'articleSection': a['cat'], 'inLanguage': 'ko'}
    if a.get('terms'): ld['keywords'] = ', '.join(a['terms'])
    if a.get('sources'): ld['isBasedOn'] = [u for _, u in a['sources']][:6]
    extra = (f'<meta property="article:published_time" content="{kst(a["date"], a.get("time") or "09:00")}">\n'
             f'<meta property="article:section" content="{esc(a["cat"])}">\n'
             + LD(ld, crumbs(('AI 뉴스', '/news/'), (a['title'], f"/news/{a['id']}/"))))
    page(f"/news/{a['id']}/", 'a-' + a['id'], f"{a['title']} · SHIFT AI", a['hook'], ART, og, 'article', extra)
for t in T:
    og = og_from(t['thumb'], t['id']); u = f"/tutorial/{t['id'][2:]}/"
    ld = {'@context': 'https://schema.org', '@type': 'TechArticle', 'headline': t['title'], 'description': t['deck'], 'image': [f'{SITE}/{og}'],
          'datePublished': kst(t['date']), 'dateModified': kst(t['date']), 'author': AUTHOR, 'publisher': PUBLISHER, 'isAccessibleForFree': True,
          'mainEntityOfPage': SITE + u, 'articleSection': '튜토리얼 · ' + (t.get('cat') or ''), 'keywords': ', '.join(t.get('tool') or []), 'inLanguage': 'ko',
          'proficiencyLevel': t.get('level') or '입문'}
    if t.get('sources'): ld['citation'] = [x for _, x in t['sources']][:8]
    page(u, t['id'], f"{t['title']} · SHIFT AI 튜토리얼", t['deck'], ART, og, 'article',
         f'<meta property="article:published_time" content="{kst(t["date"])}">\n' + LD(ld, crumbs(('튜토리얼', '/tutorial/'), (t['title'], u))))
for c in C:
    og = og_from(col_img(c), c['id']); u = f"/column/{c['id'][2:]}/"
    ld = {'@context': 'https://schema.org', '@type': 'OpinionNewsArticle', 'headline': c['title'], 'description': c['deck'], 'image': [f'{SITE}/{og}'],
          'datePublished': kst(c['date']), 'dateModified': kst(c['date']), 'author': AUTHOR, 'publisher': PUBLISHER, 'isAccessibleForFree': True,
          'mainEntityOfPage': SITE + u, 'articleSection': '칼럼', 'inLanguage': 'ko'}
    page(u, c['id'], f"{c['title']} · SHIFT AI 칼럼", c['deck'], ART, og, 'article',
         f'<meta property="article:published_time" content="{kst(c["date"])}">\n' + LD(ld, crumbs(('AI 뉴스', '/news/'), ('칼럼', '/news/?cat=%EC%B9%BC%EB%9F%BC'), (c['title'], u))))
for d in DY:
    og = og_from(day_img(d), 'd-' + d['date']); u = f"/daily/{d['date']}/"
    y, m, dd = d['date'].split('-'); name = f"{int(y)}년 {int(m)}월 {int(dd)}일 AI 데일리 뉴스"
    its = [byId[i] for i in d['items'] if i in byId]
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': f"{name} — {d['title']}", 'description': d.get('summary') or ' / '.join(d['three']),
          'url': SITE + u, 'datePublished': kst(d['date'], '07:00'), 'image': [f'{SITE}/{og}'], 'inLanguage': 'ko', 'publisher': PUBLISHER,
          'mainEntity': {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f"{SITE}/news/{a['id']}/", 'name': a['title']} for i, a in enumerate(its)]}}
    page(u, 'd-' + d['date'], f"{name} — {d['title']} · SHIFT AI", d.get('summary') or ' / '.join(d['three']), ART, og, 'article',
         LD(ld, crumbs(('데일리 이슈', '/daily/'), (name, u))))
# AI 사전 용어마다 한 페이지(/dict/<s>/, 10/29~): "RAG 뜻" 같은 검색, 회사·제품 이름은 관련 소식 모음
TERM_START = '2026-10-29'
termLast = {}
for t in TERMS:
    u = f"/dict/{t['s']}/"; arts = [byId[i] for i in t['arts'] if i in byId]; brand = t['g'] == '제품·회사'
    en = f"({t['en']})" if t.get('en') and t['en'] != t['t'] else ''
    title = (f"{t['t']}{en} — 뜻과 최신 소식" if brand and arts else f"{t['t']}{en} 뜻 — 쉽게 풀이한 AI 용어") + ' · SHIFT AI 사전'
    desc = t['d'] + (f" 관련 기사 {len(arts)}건을 함께 모았습니다." if arts else '')
    ld = {'@context': 'https://schema.org', '@type': 'DefinedTerm', 'name': t['t'], 'description': t['d'], 'url': SITE + u, 'inDefinedTermSet': TERMSET, 'inLanguage': 'ko'}
    if t.get('en') and t['en'] != t['t']: ld['alternateName'] = t['en']
    if arts: ld['subjectOf'] = [{'@type': 'NewsArticle', 'headline': a['title'], 'url': f"{SITE}/news/{a['id']}/"} for a in arts[:10]]
    og = og_from(img_of(arts[0]), 'a-' + arts[0]['id']) if arts else OG_SITE
    termLast[u] = max([a['date'] for a in arts] + [TERM_START])
    page(u, 'w-' + t['s'], title, desc, ART, og, 'article' if arts else 'website', LD(ld, crumbs(('AI 사전', '/dict/'), (t['t'], u))))

# 404
nf = '''<main id="v-404"><div class="notfound narrow"><h1>찾는 페이지가 없습니다</h1><p>주소가 바뀌었거나 지워진 글입니다. 아래에서 다시 찾아보세요.</p>
<div class="acts"><a class="btn" href="/">첫 화면</a><a class="ghost" href="/news/">AI 뉴스</a><a class="ghost" href="/daily/">데일리 이슈</a></div></div></main>'''
page('/404-tmp/', '404', '페이지를 찾을 수 없습니다 · SHIFT AI', 'SHIFT AI 매거진', nf, OG_SITE)
PAGES.remove('/404-tmp/')
# 무료 도구: 목록 + 도구마다 한 페이지(검색 노출용 설명·구조화 데이터)
TOOLS = D.get('TOOLS', [])
TOOL_PAGES = {'redact': ('개인정보 자동 가리기 — 주민번호·전화번호·카드번호 한 번에 가리고 AI에 올리기 (무료) · SHIFT AI', 'redact.js'),
              'ai-cost': ('AI 요금 계산기 — 챗GPT·클로드·제미나이 API 한 달 비용 원화로 비교 (무료) · SHIFT AI', 'ai-cost.js')}
for t in TOOLS:
    if t['id'] not in TOOL_PAGES or not os.path.exists(SRC + f"views/tool-{t['id']}.html"): continue
    title, js = TOOL_PAGES[t['id']]
    og = og_from(t['thumb'], 'tool-' + t['id']) if os.path.exists(OUT + t['thumb']) else OG_SITE
    ld = {'@context': 'https://schema.org', '@type': 'WebApplication', 'name': t['title'], 'url': SITE + t['href'], 'description': t['desc'], 'applicationCategory': 'UtilitiesApplication', 'operatingSystem': '웹 브라우저', 'inLanguage': 'ko', 'isAccessibleForFree': True,
          'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW'}, 'publisher': {'@type': 'Organization', 'name': 'SHIFT AI', 'url': SITE + '/'}}
    extra = LD(ld, crumbs(('무료 도구', '/tools/'), (t['title'], t['href']))) + f'<script defer src="/assets/{js}?v={WIDGET_VER.get(js, VER)}"></script>\n'
    page(t['href'], 'tool-' + t['id'], title, t['desc'], fix_links(view('tool-' + t['id'])), og, 'website', extra)
page('/search/', 'search', '검색 · SHIFT AI', 'SHIFT AI의 AI 뉴스·데일리 이슈·튜토리얼·AI 사전을 한 번에 찾습니다.', STATIC['search'], OG_SITE, 'website', '', 'noindex,follow')

# ---- 사이트맵·RSS·robots ----
last = {'/': max(a['date'] for a in A)}
for a in A: last[f"/news/{a['id']}/"] = a['date']
for t in T: last[f"/tutorial/{t['id'][2:]}/"] = t['date']
for c in C: last[f"/column/{c['id'][2:]}/"] = c['date']
for d in DY: last[f"/daily/{d['date']}/"] = d['date']
last.update(termLast)
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for p in PAGES:
    if p in ('/privacy/', '/search/'): continue
    sm.append(f'<url><loc>{SITE}{p}</loc>' + (f'<lastmod>{last[p]}</lastmod>' if p in last else f'<lastmod>{last["/"]}</lastmod>') + '</url>')
sm.append('</urlset>')
open(OUT + 'sitemap.xml', 'w').write('\n'.join(sm) + '\n')
# 다음(Daum) 웹마스터도구 소유 확인 줄(10/29 사용자가 발급, 지우면 인증이 풀림)
DAUM_VERIFY = '#DaumWebMasterTool:6dc606a8387b0de59eded7151dcfeb0c85e1bc4536f5959dca7e3047ede34d5b:/muGpe/rLcLTp+f7AlrcFg=='
open(OUT + 'robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\nSitemap: {SITE}/news-sitemap.xml\n\n{DAUM_VERIFY}\n')
# 구글 뉴스 사이트맵: 최근 48시간 안에 올린 기사(빌드할 때마다 다시 만든다)
_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
_pub = lambda a: datetime.datetime.fromisoformat(kst(a['date'], a.get('time') or '09:00'))
nsm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">']
for a in sorted(A, key=_pub, reverse=True):
    if _now - _pub(a) > datetime.timedelta(hours=48): continue
    nsm.append(f"<url><loc>{SITE}/news/{a['id']}/</loc><news:news><news:publication><news:name>SHIFT AI</news:name><news:language>ko</news:language></news:publication>"
               f"<news:publication_date>{kst(a['date'], a.get('time') or '09:00')}</news:publication_date><news:title>{esc(a['title'])}</news:title></news:news></url>")
nsm.append('</urlset>')
open(OUT + 'news-sitemap.xml', 'w').write('\n'.join(nsm) + '\n')
# IndexNow(네이버·빙 등에 새 글 바로 알림): 키 파일은 사이트 맨 위에. 알림은 .github/workflows/indexnow.yml
INDEXNOW_KEY = 'd86c2cf3f63249de49f140eff101c95d'
open(OUT + INDEXNOW_KEY + '.txt', 'w').write(INDEXNOW_KEY)
# llms.txt: AI 검색(챗GPT·퍼플렉시티 등)이 사이트를 읽기 쉽게 정리한 안내
_ll = [f'# SHIFT AI (시프트 AI)', '', f'> {LISTS["about"][1]} 모든 기사는 회사 발표·논문·공식 문서 같은 원문을 출처로 씁니다. 한국어 사이트입니다.', '',
       '## 섹션', f'- [AI 뉴스]({SITE}/news/): 오늘의 인공지능 소식', f'- [데일리 이슈]({SITE}/daily/): 날마다 정리하는 AI 뉴스', f'- [튜토리얼]({SITE}/tutorial/): 단계별 AI 실전 가이드',
       f'- [AI 사전]({SITE}/dict/): AI 용어 {len(TERMS)}개 뜻', f'- [무료 도구]({SITE}/tools/): 설치 없이 쓰는 AI 도구', f'- [소개]({SITE}/about/): 편집 원칙과 출처 규칙', f'- [RSS]({SITE}/feed.xml)', '',
       '## 최신 기사'] + [f"- [{a['title']}]({SITE}/news/{a['id']}/): {a['hook']}" for a in sorted(A, key=_pub, reverse=True)[:30]] + ['', '## 튜토리얼'] + \
      [f"- [{t['title']}]({SITE}/tutorial/{t['id'][2:]}/): {t['deck']}" for t in T] + ['', '## 무료 도구'] + [f"- [{t['title']}]({SITE}{t['href']}): {t['desc']}" for t in TOOLS] + \
      ['', '## AI 사전 (일부)'] + [f"- [{t['t']}]({SITE}/dict/{t['s']}/): {t['d']}" for t in sorted(TERMS, key=lambda t: -len(t['arts']))[:40]]
open(OUT + 'llms.txt', 'w').write('\n'.join(_ll) + '\n')
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

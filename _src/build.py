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
# 알림 띠(머리말 위, 11/3~): 최근 14일 안에 나온 무료 도구를 알린다. 없으면 띠를 뺀다.
def _josa(w, a, b):  # 받침 있으면 a(과·이), 없으면 b(와·가)
    c = w.strip()[-1:]
    return w + (a if c and '가' <= c <= '힣' and (ord(c) - 0xAC00) % 28 else b)
def _annc():
    tl = json.load(open(SRC + 'news/tools.json')); tl.sort(key=lambda t: t['date'], reverse=True)
    if not tl: return ''
    d0 = tl[0]['date']; now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()
    if (now - datetime.date.fromisoformat(d0)).days > 14: return ''
    new = [t for t in tl if t['date'] == d0]; nm = [re.sub(r'\s*\(.*?\)\s*$', '', t['title']) for t in new]
    if len(new) == 1: msg, href = f'새 무료 도구 {_josa(nm[0], "이", "가")} 나왔습니다', new[0]['href']
    elif len(new) == 2: msg, href = f'새 무료 도구 2개, {_josa(nm[0], "과", "와")} {_josa(nm[1], "이", "가")} 나왔습니다', '/tools/'
    else: msg, href = f'새 무료 도구 {len(new)}개가 나왔습니다', '/tools/'
    return f'<a class="annc bleed" href="{href}" data-ev="annc:{href}"><span class="nb">NEW</span><span>{esc(msg)}</span><span class="go">써 보기 →</span></a>'
header = fix_links(view('header')).replace('<!--ANNC-->', _annc())
footer = fix_links(view('footer'))
assert '/privacy/' in footer and '<!--ANNC-->' not in header

def with_follow(v, before='</main>'):
    i = v.rindex(before); return v[:i] + FOLLOWBOX + '\n' + v[i:]

home = fix_links(view('home'))
home = home.replace('<div class="sec"><h2>무료 도구</h2>', FOLLOWBOX + '\n  <div class="sec"><h2>무료 도구</h2>', 1)
assert FOLLOWBOX in home
_ng = sum(1 for g in json.load(open(SRC + 'news/guides.json'))['guides'] if g.get('page'))
home = home.replace('AI 길잡이 전체 →', f'AI 길잡이 {_ng}개 →')
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
    'prompts': with_follow(fix_links(view('prompts'))),
    'verdict': with_follow(fix_links(view('verdict'))),
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

# 휴대폰 글자 크기(11/3~): 컴퓨터 화면은 그대로 두고, 폭 640px 이하에서만 글자를 한 단계씩 키운다.
# 기준: 보그 코리아 모바일(본문 16px·줄 간격 1.62, 목록 제목 16px, 날짜 12~14px), 구글 뉴스 모바일(제목 16px, 출처·시간 12px).
# 크기 이력: 기사 본문 17(처음) → 18(1차) → 19(2차) → 21.5(3차, 너무 큼) → 18(4차, 현재).
# site.css 의 font-size 규칙을 같은 선택자·같은 순서로 다시 적어 덧붙이므로, 새 규칙을 써도 자동으로 따라간다.
# 11/3 4차(현재): 기사 본문 18px 기준. 컴퓨터 본문 17px → 18px 와 같은 비율(×18/17)로 모두 키우고 0.5px 단위로 맞춤.
# 다만 아주 작은 글자(12px 이하)는 읽히도록 13px 아래로 내려가지 않게 한다.
MOBILE_MAP = {10.5: 13, 11: 13, 11.5: 13, 12: 13, 12.5: 13.5, 13: 14, 13.5: 14.5, 14: 15, 14.5: 15.5, 15: 16, 15.5: 16.5,
              16: 17, 16.5: 17.5, 17: 18, 17.5: 18.5, 18: 19, 18.5: 19.5, 19: 20, 20: 21, 21: 22, 22: 23.5, 23: 24.5,
              24: 25.5, 26: 27.5, 27: 28.5, 28: 29.5}
# 길게 읽는 튜토리얼 설명은 기사 본문 바로 아래 17px, 첫 화면 검색칸 17px
MOBILE_FIX = {'.tcard b': 17, '.article .body': 18, '.tut-page .how': 17, '.tut-page .pr .pt': 17, '.tut-page .quick ol': 17,
              '.tut-page .limits ul': 17, '.hsearch input': 17}
MOBILE_SKIP = re.compile(r'\.annc \.nb|\.tglyph|kbd|\.chev|\.fword|\.hero h1|\.hstats b|\.hsearch kbd|\.sicon|\.cover|\.og-')
def mobile_type(src):
    out, cur, buf = [], None, []
    def flush():
        if buf: out.append('@media (max-width:%spx){%s}' % (cur, ''.join(buf)))
    def walk(text, cond):
        nonlocal cur, buf
        i = 0
        while i < len(text):
            j = text.find('{', i)
            if j < 0: break
            head = text[i:j].strip()
            if head.startswith('@'):  # @media 는 안으로 들어가고, @keyframes 같은 다른 묶음은 통째로 건너뜀
                d, k = 1, j + 1
                while d: d += {'{': 1, '}': -1}.get(text[k], 0); k += 1
                if head.startswith('@media'): walk(text[j + 1:k - 1], head[6:].strip())
                i = k; continue
            k = text.index('}', j); body = text[j + 1:k]; i = k + 1
            m = re.search(r'font-size:\s*([0-9.]+)px', body) or re.search(r'(?:^|;)\s*font:\s*(?:[a-z0-9 ]+\s)?([0-9.]+)px', body)
            if not m or MOBILE_SKIP.search(head): continue
            v = float(m.group(1)); nv = MOBILE_FIX.get(head, MOBILE_MAP.get(v))
            if nv is None or nv == v: continue
            if re.search(r'(?<![-\w])(height|width):\s*\d+px', body): nv = min(nv, v + 1)  # 지름이 정해진 동그라미·작은 칸은 1px만
            # 휴대폰(폭 360~640)에 걸리는 조건만: 조건 없음, max-width, 색·동작 설정. min-width·print 는 건너뜀
            w = 640
            if cond:
                if 'min-width' in cond or 'print' in cond: continue
                mw = re.search(r'max-width:\s*(\d+)px', cond)
                if mw: w = min(640, int(mw.group(1)))
                if 'prefers-' in cond: continue
            if w != cur: flush(); cur, buf = w, []
            buf.append('%s{font-size:%gpx}' % (head, nv))
    walk(re.sub(r'/\*.*?\*/', '', src, flags=re.S), '')
    flush()
    gen = '\n'.join(out)
    assert gen.count('{') == gen.count('}') and not re.search(r'\}[^{}]*[@}][^{}]*\{font-size', gen), '휴대폰 글자 크기 규칙이 깨짐'
    return src + '\n/* ---- 휴대폰 글자 크기: build.py mobile_type() 가 만든 부분 ---- */\n' + gen + '\n'
css = mobile_type(css)
open(OUT + 'assets/data.js', 'w').write(data_js)
open(OUT + 'assets/app.js', 'w').write(app_js)
open(OUT + 'assets/site.css', 'w').write(css)
theme_js = open(SRC + 'theme.js').read(); open(OUT + 'assets/theme.js', 'w').write(theme_js)
# 무료 도구 스크립트(_src/widgets/*.js → assets/)
WIDGET_VER = {}
for _f in sorted(os.listdir(SRC + 'widgets')) if os.path.isdir(SRC + 'widgets') else []:
    if _f.endswith('.js'):
        _w = open(SRC + 'widgets/' + _f).read(); open(OUT + 'assets/' + _f, 'w').write(_w); WIDGET_VER[_f] = hashlib.sha1(_w.encode()).hexdigest()[:8]
VER = hashlib.sha1((data_js + app_js + css + theme_js).encode()).hexdigest()[:8]

VERIFY = (open(SRC + 'verify-meta.html').read().strip() + '\n') if os.path.exists(SRC + 'verify-meta.html') else ''
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap">'
# 방문 통계: GoatCounter(쿠키 없음, IP 저장 안 함). 개인정보처리방침 7일 전 공지 약속에 따라 시행일부터 센다. 미리 그리기(prerender)·로컬에서는 안 셈.
GC_CODE, GC_START = 'shiftai', '2026-11-03T00:00:00+09:00'
# 채널 표시(11/3): 주소의 ?from=th|ig|yt 또는 utm_source 가 있으면 들어온 곳을 쓰레드·인스타·유튜브로 센다(앱 안 브라우저는 들어온 곳을 안 넘겨줌).
# 보안 점검(11/2): 통계 스크립트는 우리 서버(/lib/goatcounter/count.js)에서 내려보내고, 불러오는 코드도 바깥 파일로 둔다(페이지 안 스크립트 없음 → CSP 로 막을 수 있게).
GC_URL = f'https://{GC_CODE}.goatcounter.com' if GC_CODE else ''
if GC_CODE:
    open(OUT + 'assets/stats.js', 'w').write('(function(){if(navigator.webdriver||location.hostname!=="shiftaimagazine.com"||Date.now()<Date.parse("' + GC_START + '"))return;'
        'var f=(new URLSearchParams(location.search).get("utm_source")||new URLSearchParams(location.search).get("from")||"").toLowerCase(),M={th:"threads",threads:"threads",ig:"instagram",instagram:"instagram",reels:"instagram",reel:"instagram",yt:"youtube",youtube:"youtube",shorts:"youtube"};'
        'if(M[f])window.goatcounter={referrer:"https://www."+M[f]+".com/"};'
        'var s=document.createElement("script");s.async=true;s.dataset.goatcounter="' + GC_URL + '/count";s.src="/lib/goatcounter/count.js";document.head.appendChild(s)})();\n')
ANALYTICS = '<script defer src="/assets/stats.js"></script>\n' if GC_CODE else ''
# 콘텐츠 보안 정책(CSP): GitHub Pages 는 응답 머리를 못 바꾸므로 <meta> 로 건다. 우리 서버·구글 글꼴·통계 주소 밖으로는 스크립트를 불러오거나 데이터를 보내지 못한다.
#  'wasm-unsafe-eval' = 글자 인식(tesseract)·HEIC 변환의 WebAssembly, blob: = 그 작업용 워커. 페이지 안 <script> 는 JSON-LD(실행 안 되는 데이터)뿐.
CSP = ("default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; "
       f"img-src 'self' data: blob:{' ' + GC_URL if GC_URL else ''}; connect-src 'self'{' ' + GC_URL if GC_URL else ''}; worker-src 'self' blob:; media-src 'self' blob:; "
       "object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests")
SECMETA = f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n<meta name="referrer" content="strict-origin-when-cross-origin">\n'
# HEIC 변환 라이브러리(heic-to, libheif 를 Emscripten 으로 옮긴 것)는 작업용 워커 안에서 문자열을 코드로 바꿔 실행한다 → 그 라이브러리를 쓰는 두 페이지만 'unsafe-eval' 을 연다.
SECMETA_EVAL = SECMETA.replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'")
def kst(date, time='09:00'): return f'{date}T{time}:00+09:00'
# 수정 기록(news/updates.json, 11/3~): 고친 날짜를 dateModified·사이트맵에, 도구 페이지는 페이지 끝에 '수정 기록'
UPD = {k: sorted(v) for k, v in (json.load(open(SRC + 'news/updates.json')) if os.path.exists(SRC + 'news/updates.json') else {}).items() if not k.startswith('_')}
def modd(path, date, time='09:00'):  # 마지막으로 고친 날(없으면 처음 올린 날)
    u = UPD.get(path); return kst(u[-1][0]) if u and u[-1][0] > date else kst(date, time)
def upd_box(path):
    u = UPD.get(path)
    if not u: return ''
    ymd = lambda d: f"{int(d[:4])}년 {int(d[5:7])}월 {int(d[8:])}일"
    return '<div class="upd"><b>수정 기록</b><ul>' + ''.join(f'<li><time datetime="{d}">{ymd(d)}</time> {esc(t)}</li>' for d, t in u) + '</ul></div>\n'
# 구조화 데이터(JSON-LD) 도우미
LD = lambda *xs: ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in xs)
def crumbs(*items):  # (이름, 경로) … → BreadcrumbList (첫 화면이 맨 앞)
    its = [('SHIFT AI', '/')] + list(items)
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList',
            'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE + u} for i, (n, u) in enumerate(its)]}
BRAND_ALT = ['SHIFT AI 매거진', '시프트 AI', '시프트 AI 매거진', 'SHIFT AI Magazine']
PUBLISHER = {'@type': 'NewsMediaOrganization', 'name': 'SHIFT AI', 'url': SITE + '/', 'logo': {'@type': 'ImageObject', 'url': SITE + '/img/brand/logo-800.png'}}
AUTHOR = {'@type': 'Organization', 'name': 'SHIFT AI 편집부', 'url': SITE + '/about/'}

def page(path, route, title, desc, main, og, typ='website', extra='', robots='index,follow,max-image-preview:large', secmeta=None):
    url = SITE + path
    doc = f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
{secmeta or SECMETA}<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
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
<script src="/assets/theme.js?v={VER}"></script>
<meta name="robots" content="{robots}">
{VERIFY}{extra}{ANALYTICS}<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="SHIFT AI" href="/feed.xml">
{FONTS}
<link rel="stylesheet" href="/assets/site.css?v={VER}">
</head>
<body data-route="{route}" id="top">
{header}
<div class="wrap">
{main}
</div>
{footer}
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
_NPROMPT = sum(1 for t in T for it in t['items'] if it.get('prompt')) + sum(1 for t in T if (t.get('master') or {}).get('prompt'))
LISTS = {'news': ('AI 뉴스 — 오늘의 인공지능 소식', '오늘 나온 AI 뉴스와 인공지능 기사. 회사 발표·논문·공식 게시물 같은 원문을 읽고 쓰며, 모든 기사 끝에 원문 링크가 있습니다.'),
         'tutorial': ('튜토리얼 · AI 실전 꿀팁', '오늘 바로 따라 할 수 있는 AI 실전 꿀팁. 프롬프트 모음부터 클로드 코드·n8n·리모션 설정까지, 공식 문서로 확인한 내용만 단계별로 정리했습니다.'),
         'daily': ('AI 데일리 뉴스 — 날마다 정리하는 AI 이슈', '그날 나온 AI 뉴스를 한 장에 모았습니다. 제목 한 줄과 요점 세 줄, 소식 목록과 숫자를 한 번에 봅니다.'),
         'dict': ('AI 사전 — AI 용어 뜻 쉽게 풀이', f'AI 용어 {len(TERMS)}개의 뜻을 쉬운 말로 풀었습니다. 에이전트·RAG·MCP·토큰 같은 AI 용어부터 API·GPU 같은 IT 용어, 클로드·챗GPT·제미나이 같은 제품 이름까지 관련 기사와 함께 봅니다.'),
         'tools': (f"무료 AI 도구 {len(D.get('TOOLS', []))}가지 — 설치·가입 없이 브라우저에서 바로", '유료 프로그램 무료 대체 찾기, 글자 수·토큰 세기, HEIC JPG 변환, 이미지 텍스트 추출(OCR), AI 티 검사기, 프롬프트 생성기, 개인정보 마스킹, AI API 요금 계산기, 실시간 번역 자막을 설치·가입 없이 무료로 씁니다. 넣은 사진과 글은 내 브라우저 안에서만 처리합니다.'),
         'prompts': (f"복붙 프롬프트 모음 {_NPROMPT}개 — 챗GPT·클로드·제미나이에 바로 쓰는 업무 프롬프트", f"메일 답장, 회의록 정리, 긴 자료 요약, 이력서·자기소개서 검토, 엑셀 수식, 공부까지 바로 복사해 쓰는 프롬프트 {_NPROMPT}개를 주제별로 모았습니다. 챗GPT·클로드·제미나이에 그대로 붙여 넣으면 됩니다."),
         'verdict': ('AI 판정 모아보기 — 써볼 만해요·지켜보세요·과장이에요', 'SHIFT AI가 원문을 읽고 기사마다 붙인 판정을 모았습니다. 지금 써 볼 만한 AI 도구, 조금 더 지켜볼 발표, 근거보다 부풀려진 발표를 골라 봅니다.'),
         'about': ('소개', 'SHIFT AI는 AI 소식을 원문부터 확인하고 써 볼 만한지 판정하는 AI 매거진입니다.'),
         'privacy': ('개인정보처리방침', 'SHIFT AI 매거진 개인정보처리방침.')}
LIST_NAME = {'prompts': '복붙 프롬프트 모음', 'verdict': 'AI 판정 모아보기', 'news': 'AI 뉴스', 'tutorial': '튜토리얼', 'daily': '데일리 이슈', 'dict': 'AI 사전', 'tools': '무료 도구', 'about': '소개', 'privacy': '개인정보처리방침'}
TERMSET = {'@type': 'DefinedTermSet', 'name': 'SHIFT AI AI 사전', 'url': SITE + '/dict/', 'inLanguage': 'ko'}
for r, (t, ds) in LISTS.items():
    xs = [crumbs((LIST_NAME[r], f'/{r}/'))]
    if r == 'dict': xs.append({'@context': 'https://schema.org', **TERMSET, 'description': ds,
                               'hasDefinedTerm': [{'@type': 'DefinedTerm', 'name': x['t'], 'url': f"{SITE}/dict/{x['s']}/"} for x in TERMS]})
    if r == 'prompts':
        _pl = [(f"{t['id'][2:]}-all", '통째로 맡기는 프롬프트: ' + t['title']) for t in T if (t.get('master') or {}).get('prompt')] + \
              [(f"{t['id'][2:]}-{i + 1}", it['h']) for t in T for i, it in enumerate(t['items']) if it.get('prompt')]
        xs.append({'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': '복붙 프롬프트 모음', 'url': SITE + '/prompts/', 'inLanguage': 'ko', 'publisher': PUBLISHER,
                   'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(_pl), 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'url': f"{SITE}/prompts/#{k}"} for i, (k, n) in enumerate(_pl)]}})
    if r == 'verdict':
        _vl = [a for a in sorted(A, key=lambda a: a['date'] + (a.get('time') or ''), reverse=True) if a.get('verdict')]
        xs.append({'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'AI 판정 모아보기', 'url': SITE + '/verdict/', 'inLanguage': 'ko', 'publisher': PUBLISHER,
                   'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(_vl), 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': a['title'], 'url': f"{SITE}/news/{a['id']}/"} for i, a in enumerate(_vl)]}})
    if r == 'tools': xs.append({'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'SHIFT AI 무료 AI 도구',
                                'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': SITE + x['href'], 'name': x['title']} for i, x in enumerate(D.get('TOOLS', []))]})
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
          'image': [f'{SITE}/{og}'], 'datePublished': kst(a['date'], a.get('time') or '09:00'), 'dateModified': modd(f"/news/{a['id']}/", a['date'], a.get('time') or '09:00'),
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
          'datePublished': kst(t['date']), 'dateModified': modd(u, t['date']), 'author': AUTHOR, 'publisher': PUBLISHER, 'isAccessibleForFree': True,
          'mainEntityOfPage': SITE + u, 'articleSection': '튜토리얼 · ' + (t.get('cat') or ''), 'keywords': ', '.join(t.get('tool') or []), 'inLanguage': 'ko',
          'proficiencyLevel': t.get('level') or '입문'}
    if t.get('sources'): ld['citation'] = [x for _, x in t['sources']][:8]
    page(u, t['id'], f"{t['title']} · SHIFT AI 튜토리얼", t['deck'], ART, og, 'article',
         f'<meta property="article:published_time" content="{kst(t["date"])}">\n' + LD(ld, crumbs(('튜토리얼', '/tutorial/'), (t['title'], u))))
for c in C:
    og = og_from(col_img(c), c['id']); u = f"/column/{c['id'][2:]}/"
    ld = {'@context': 'https://schema.org', '@type': 'OpinionNewsArticle', 'headline': c['title'], 'description': c['deck'], 'image': [f'{SITE}/{og}'],
          'datePublished': kst(c['date']), 'dateModified': modd(u, c['date']), 'author': AUTHOR, 'publisher': PUBLISHER, 'isAccessibleForFree': True,
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
    ddesc = d.get('summary') or ' / '.join(d['three'])
    if len(ddesc) < 90: ddesc += ' 이날 소식: ' + ' · '.join(a['title'] for a in its[:3])
    page(u, 'd-' + d['date'], f"{name} — {d['title']} · SHIFT AI", ddesc[:300], ART, og, 'article',
         LD(ld, crumbs(('데일리 이슈', '/daily/'), (name, u))))
# AI 사전 용어마다 한 페이지(/dict/<s>/, 10/29~): "RAG 뜻" 같은 검색, 회사·제품 이름은 관련 소식 모음
TERM_START = '2026-10-29'
termLast = {}
for t in TERMS:
    u = f"/dict/{t['s']}/"; arts = [byId[i] for i in t['arts'] if i in byId]; brand = t['g'] == '제품·회사'
    en = f"({t['en']})" if t.get('en') and t['en'] != t['t'] else ''
    title = (f"{t['t']}{en} — 뜻과 최신 소식" if brand and arts else f"{t['t']}{en} 뜻 — 쉽게 풀이한 AI 용어") + ' · SHIFT AI 사전'
    desc = (f"{t['t']}{en}: " if brand else f"{t['t']}{en} 뜻: ") + t['d'] + (f" 관련 기사 {len(arts)}건을 함께 모았습니다." if arts else ' SHIFT AI 사전에서 쉬운 말로 풀었습니다.')
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
# 검색 노출(11/2): 도구마다 사람들이 실제로 검색하는 이름(이미지 텍스트 추출, 개인정보 마스킹, 프롬프트 생성기 …)을 제목·설명·다른 이름에 넣는다.
#  자주 묻는 질문은 화면에 보이는 views/tool-<id>.html 의 <section class="tfaq"> 에서 읽어 FAQPage 로도 낸다(화면과 구조화 데이터가 늘 같게).
_NPR = len(json.load(open(SRC + 'news/ai_prices.json'))['models']) if os.path.exists(SRC + 'news/ai_prices.json') else 0
TOOL_SEO = {
    'pdf-to-text': dict(js='pdf.js', title='PDF 텍스트 추출 무료 — PDF를 텍스트·마크다운으로 변환 (업로드 없음)',
                desc='PDF 속 글자를 복사할 수 있는 텍스트와 마크다운으로 바꿉니다. 반복되는 머리글과 쪽 번호를 빼고 끊긴 줄을 문단으로 이어 AI에 올리기 좋게 정리하며, 파일은 브라우저 밖으로 나가지 않습니다.',
                alt=['PDF 텍스트 추출', 'PDF 텍스트 변환', 'PDF 마크다운 변환', 'PDF 글자 복사'],
                feat=['PDF 텍스트 추출', '마크다운 변환(제목·목록 추정)', '머리글·쪽 번호 빼기', '끊긴 줄 문단으로 잇기', '쪽 범위 지정', '글자 없는 쪽(스캔본) 알림', '.txt·.md 저장']),
    'ai-subscriptions': dict(js='subs.js', title='AI 구독료 계산기 — 챗GPT·클로드·제미나이·그록 한 달·1년 합계 (원화)',
                desc='챗GPT·클로드·제미나이·그록 요금제를 고르면 한 달과 1년 구독료를 원화로 더해 줍니다. 겹치는 챗봇 구독을 하나로 줄였을 때와 연간 결제로 바꿨을 때 아끼는 돈도 계산합니다.',
                alt=['AI 구독료 계산', '챗GPT 구독료', 'AI 구독 정리', '챗GPT 클로드 구독 비교'],
                feat=['요금제별 한 달·1년 합계(원화)', '겹치는 챗봇 구독 찾기', '연간 결제 절약액', '팀 요금제 인원', '목록에 없는 구독 직접 추가', '이 브라우저에 저장']),
    'ocr': dict(js='ocr.js', title='이미지 텍스트 추출 무료 — 사진·캡처 속 한국어 글자 뽑기(OCR)',
                desc='사진이나 화면 캡처 속 글자를 복사할 수 있는 텍스트로 바꿉니다. 한국어와 영어를 함께 읽는 무료 OCR이고 가입·설치 없이 브라우저에서 바로 씁니다. 사진은 서버로 올리지 않고 내 컴퓨터 안에서만 읽습니다.',
                alt=['이미지 텍스트 추출', '사진 글자 추출', '한국어 OCR', '이미지 글자 인식'],
                feat=['한국어·영어 글자 인식(OCR)', '아이폰 HEIC 사진도 바로', '화면 캡처 바로 붙여 넣기', '한 번에 사진 12장까지', '확신도가 낮은 글자 따로 표시', '텍스트 파일로 저장', 'AI에 정리 맡기는 프롬프트 복사']),
    'ai-tell': dict(js='ai-tell.js', title='AI 티 검사기 — 챗GPT가 쓴 티 나는 표현·문장 찾아 고치기(무료)',
                desc="글을 붙여 넣으면 '핵심은', 'A가 아니라 B' 같은 AI 글 버릇 40여 가지를 찾아 색으로 표시하고 고치는 법을 알려 줍니다. 자기소개서·보고서·블로그 글에 쓸 수 있고, 글은 어디에도 보내지 않습니다.",
                alt=['AI 글 티 검사', 'GPT 티 검사기', 'AI 문체 검사'],
                feat=['AI 글 버릇 40여 가지 검사', '표시한 곳마다 이유와 고치는 법', '꼭 고칠 것·많으면 고칠 것 두 단계 표시', 'AI에게 고쳐 달라는 프롬프트 복사']),
    'prompt': dict(js='prompt.js', title='프롬프트 생성기 무료 — 7칸 채우면 완성되는 챗GPT·클로드·제미나이 프롬프트',
                desc='역할·맥락·자료·할 일·조건·답 형식·확인 방법 일곱 칸을 채우면 챗GPT·클로드·제미나이에 바로 붙여 넣을 프롬프트를 만들어 줍니다. 메일 답장·회의록·요약·이력서 검토 등 상황 예시 10가지와 XML 태그형도 있습니다.',
                alt=['프롬프트 생성기', '챗GPT 프롬프트 만들기', '프롬프트 템플릿'],
                feat=['역할·맥락·자료·할 일·조건·답 형식·확인 일곱 칸', '상황 예시 10가지', '기본형·XML 태그형', '함께 넣을 부탁 고르기', '이 브라우저에 임시 저장']),
    'redact': dict(js='redact.js', title='개인정보 마스킹 무료 — 주민번호·전화번호·카드번호 자동 가리기',
                desc='글이나 엑셀 표 속 주민등록번호·전화번호·이메일·카드번호·계좌번호를 찾아 [전화번호1]처럼 가립니다. AI 답을 원래 값으로 되돌릴 수 있고, 모든 처리는 브라우저 안에서만 합니다. 회사 자료를 AI에 올리기 전에 쓰세요.',
                alt=['개인정보 마스킹', '개인정보 비식별화 도구', '주민번호 가리기'],
                feat=['주민등록번호·외국인등록번호·전화번호·이메일·카드번호·계좌번호·사업자등록번호·여권번호·운전면허번호·IP 주소 찾기', '이름표·●·일부만 가리기 세 가지 방식', '직접 가릴 말 넣기', 'AI 답을 원래 값으로 되돌리기', '엑셀 표 붙여 넣기']),
    'ai-cost': dict(js='ai-cost.js', title='AI API 요금 계산기 — 챗GPT·클로드·제미나이 한 달 비용 원화 비교',
                desc=f'챗GPT(오픈AI)·클로드·제미나이·그록 API를 쓰면 한 달에 얼마가 드는지 회사별 공식 가격표로 계산해 원화로 비교합니다. 모델 {_NPR}개, 글자 수나 토큰 수와 하루 사용 횟수만 넣으면 됩니다.',
                alt=['AI API 가격 계산기', '챗GPT API 요금 계산기', '토큰 비용 계산기'],
                feat=[f'오픈AI·앤트로픽·구글·xAI API 모델 {_NPR}개 비교', '글자 수 또는 토큰 수로 입력', '원화 환산(환율 직접 바꾸기)', '회사별 공식 가격표 링크']),
    'free-alternatives': dict(js='fa.js', title='유료 프로그램 무료 대체 찾기 — 포토샵·한글·MS 오피스·프리미어 대신 쓰는 무료 프로그램',
                desc='포토샵, 한글(HWP), MS 오피스, 프리미어 프로, 어도비 아크로뱃, 캔바, 반디캠, 챗GPT 플러스 같은 유료 프로그램 대신 쓸 수 있는 무료 프로그램을 찾아 줍니다. 무료 범위, 한국어 지원, 여는 파일 형식을 공식 페이지 기준으로 정리했습니다.',
                alt=['무료 대체 프로그램', '포토샵 무료 대체', '한글 무료 대체', 'MS 오피스 무료 대체', '유료 프로그램 무료 대안'],
                feat=['유료 프로그램 이름으로 검색', '무료 범위(오픈소스·무료 플랜) 표시', '한국어 화면·쓸 수 있는 기기', '원래 파일을 여는지', '공식 사이트 링크']),
    'char-count': dict(js='char-count.js', title='글자 수 세기 — 공백 포함·제외, 바이트, GPT 토큰 수까지 (자기소개서 무료)',
                desc='자기소개서·보고서·블로그 글의 글자 수를 공백 포함·제외로 바로 셉니다. UTF-8·한글 2바이트 기준 바이트, 어절·줄·문단, 목표 글자 수까지 남은 양, GPT 토큰 수(o200k)까지 한 번에 보여 주고 글은 어디에도 보내지 않습니다.',
                alt=['글자수 세기', '자소서 글자수 세기', '글자 수 계산기', '토큰 수 계산기'],
                feat=['공백 포함·제외 글자 수', 'UTF-8·한글 2바이트 기준 바이트', '어절·문장·줄·문단·원고지 매수', '목표 글자 수까지 남은 양', 'GPT 토큰 수(o200k)', '띄어쓰기·빈 줄 정리', '이 브라우저에 임시 저장']),
    'heic-to-jpg': dict(js='heic.js', title='HEIC JPG 변환 무료 — 아이폰 사진 여러 장 한 번에, 서버 업로드 없이',
                desc='아이폰으로 찍은 HEIC·HEIF 사진을 JPG나 PNG로 바꿉니다. 30장까지 한 번에 바꿔 ZIP으로 받을 수 있고, 사진은 서버로 올리지 않고 브라우저 안에서만 바꿉니다. 위치 정보 같은 사진 정보도 남지 않습니다.',
                alt=['HEIC 변환', 'HEIC JPG 변환', '아이폰 사진 JPG 변환', 'HEIF 변환'],
                feat=['HEIC·HEIF를 JPG·PNG로', '한 번에 30장', 'JPG 화질 조절', 'ZIP으로 한 번에 내려받기', '브라우저 안에서만 변환']),
    'interpreter': dict(js=None, title='실시간 번역 자막 무료 — 영어 회의·유튜브를 한국어 자막으로(크롬)', os='PC 크롬 138 이상',
                desc='Zoom 회의, 유튜브, 해외 강의에서 들리는 영어·중국어·일본어·프랑스어를 한국어 자막으로 바로 바꿔 줍니다. PC 크롬만 있으면 설치·가입 없이 무료로 쓰고, 다른 창 위에 떠 있는 자막 창도 띄울 수 있습니다.',
                alt=['회의 통역창', '실시간 번역 자막', '크롬 실시간 번역'],
                feat=['영어·중국어·일본어·프랑스어를 한국어 자막으로', '원문 함께 표시', '떠 있는 자막 창', '글자 크기 조절']),
}
# 유료 프로그램 무료 대체 찾기(/tools/free-alternatives/, 11/2~): news/alternatives.json(각 프로그램 공식 페이지에서 확인한 값만) → 정적 HTML
_FC = {'완전 무료(오픈소스)': 'fc-oss', '완전 무료': 'fc-free', '무료 플랜(제한 있음)': 'fc-plan'}
def fa_render(v):
    F = json.load(open(SRC + 'news/alternatives.json')); ck = F.get('checked') or ''
    progs = [dict(p, alts=[a for a in p['alts'] if a.get('cost_type') in _FC]) for p in F['programs']]
    progs = [p for p in progs if p['alts']]
    cats = []
    for p in progs:
        if p['category'] not in cats: cats.append(p['category'])
    yn = lambda x: '있음' if x is True else '없음' if x is False else '공식 자료로 확인 못 함'
    def card(a):
        rows = [('쓸 수 있는 곳', ' · '.join(a.get('platforms') or []) or '공식 자료로 확인 못 함')]
        if a.get('korean_ui') is not None: rows.append(('한국어 화면', yn(a['korean_ui'])))  # 공식 자료로 확인한 것만 보여 준다
        if a.get('opens_files'): rows.append(('여는 파일', ' · '.join(a['opens_files'])))
        rows.append(('무료로 할 때 막히는 것', a.get('free_limits') or '공식 페이지에 적힌 큰 제한 없음'))
        if a.get('good_for'): rows.append(('이런 분께', a['good_for']))
        if a.get('ai_features'): rows.append(('AI 기능', a['ai_features']))
        if a.get('license'): rows.append(('라이선스', a['license']))
        return (f'<div class="fac"><div class="fach"><b>{esc(a["name"])}</b><span class="fcost {_FC[a["cost_type"]]}">{esc(a["cost_type"])}</span></div>'
                f'<dl>{"".join(f"<div><dt>{esc(k)}</dt><dd>{esc(x)}</dd></div>" for k, x in rows)}</dl>'
                f'<a class="ghost" href="{esc(a["url"])}" target="_blank" rel="noopener">공식 사이트</a></div>')
    sec = ''.join(f'<section class="fap" id="{esc(p["id"])}" data-cat="{esc(p["category"])}" data-k="{esc(" ".join([p["name_ko"], p.get("name_en") or ""] + (p.get("aliases") or [])))}">'
                  f'<div class="faph"><span class="cat">{esc(p["category"])}</span><h2>{esc(p["name_ko"])} 대신 쓸 무료 프로그램</h2>'
                  f'<p>{esc(p.get("name_en") or "")}{" · " if p.get("name_en") else ""}무료 대체 {len(p["alts"])}개</p></div>'
                  f'<div class="facards">{"".join(card(a) for a in p["alts"])}</div></section>\n' for p in progs)
    chips = '<span class="flbl">분류</span><button aria-pressed="true" data-fc="all">전체 ' + str(len(progs)) + '</button>' + ''.join(f'<button aria-pressed="false" data-fc="{esc(c)}">{esc(c)} {sum(1 for p in progs if p["category"] == c)}</button>' for c in cats)
    ckd = f"{int(ck[:4])}년 {int(ck[5:7])}월 {int(ck[8:])}일" if ck else ''
    return v.replace('<!--FA_LIST-->', '<div class="falist">\n' + sec + '</div>').replace('<!--FA_CATS-->', chips).replace('<!--FA_CHECKED-->', ckd)
_tutBy = {f"/tutorial/{t['id'][2:]}/": t['title'] for t in T}
_colBy = {f"/column/{c['id'][2:]}/": c['title'] for c in C}
_termBy = {x['t']: x for x in TERMS}
def rel_item(r):  # tools.json rel: 사이트 안 주소(/tutorial/·/column/·/tools/) 또는 'dict:용어'
    if r.startswith('dict:'):
        x = _termBy[r[5:]]; return f"/dict/{x['s']}/", f"{x['t']} 뜻", 'AI 사전'
    if r in _tutBy: return r, _tutBy[r], '튜토리얼'
    if r in _colBy: return r, _colBy[r], '칼럼'
    if r == '/vs/': return r, '챗GPT·클로드·제미나이·그록 둘씩 비교', 'AI 서비스 비교'
    if r.startswith('/guide/'):
        g = next(x for x in json.load(open(SRC + 'news/guides.json'))['guides'] if f"/guide/{x['id']}/" == r); return r, g['h1'], 'AI 길잡이'
    o = next(x for x in TOOLS if x['href'] == r); return r, o['title'], '무료 도구'
def faq_of(v):
    m = re.search(r'<section class="tfaq".*?</section>', v, re.S)
    if not m: return None
    qa = re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', m.group(0), re.S)
    ab = lambda h: html.unescape(re.sub(r'href="/', f'href="{SITE}/', h))
    return {'@context': 'https://schema.org', '@type': 'FAQPage',
            'mainEntity': [{'@type': 'Question', 'name': html.unescape(re.sub('<[^>]+>', '', q)), 'acceptedAnswer': {'@type': 'Answer', 'text': ab(a)}} for q, a in qa]}
for t in TOOLS:
    sv = SRC + f"views/tool-{t['id']}.html"
    if t['id'] not in TOOL_SEO or not os.path.exists(sv): continue
    S = TOOL_SEO[t['id']]; js = S['js']
    og = og_from(t['thumb'], 'tool-' + t['id']) if os.path.exists(OUT + t['thumb']) else OG_SITE
    ld = {'@context': 'https://schema.org', '@type': 'WebApplication', 'name': t['title'], 'alternateName': S['alt'], 'url': SITE + t['href'], 'description': S['desc'],
          'image': f'{SITE}/{og}', 'screenshot': f"{SITE}/{t['thumb']}", 'applicationCategory': 'UtilitiesApplication', 'operatingSystem': S.get('os', '웹 브라우저'),
          'browserRequirements': S.get('os', 'JavaScript를 켠 최신 브라우저'), 'featureList': S['feat'], 'inLanguage': 'ko', 'isAccessibleForFree': True,
          'datePublished': t['date'], 'dateModified': max([t.get('mod') or t['date']] + [x[0] for x in UPD.get(t['href'], [])]),
          'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW'}, 'publisher': {'@type': 'Organization', 'name': 'SHIFT AI', 'url': SITE + '/'}}
    v = fix_links(view('tool-' + t['id']))
    if t['id'] == 'free-alternatives': v = fa_render(v)
    if t['id'] == 'ai-subscriptions':  # 요금은 news/vs.json plans(10/29 공식 페이지), 환율은 ai_prices.json 과 같은 값
        _v, _fx = json.load(open(SRC + 'news/vs.json')), json.load(open(SRC + 'news/ai_prices.json'))['fx']
        _sd = {'checked': _v['checked'], 'fx': _fx, 'services': {k: {'name': x['name'], 'plans': x['plans']} for k, x in _v['services'].items()}, 'pairs': [{'id': q['id'], 'a': q['a'], 'b': q['b']} for q in _v['pairs']]}
        assert '<!--SUBDATA-->' in v
        v = v.replace('<!--SUBDATA-->', '<script type="application/json" id="subData">' + json.dumps(_sd, ensure_ascii=False).replace('</', '<\\/') + '</script>')
    # 페이지 끝: 함께 보면 좋은 글 + 다른 무료 도구(사이트 안 링크)
    rels = [rel_item(r) for r in t.get('rel', [])]
    others = [o for o in TOOLS if o['id'] != t['id']]
    nav = ('<nav class="trel" aria-label="함께 보면 좋은 글과 다른 무료 도구">\n'
           + (('  <h2>함께 보면 좋은 글</h2>\n  <ul class="plain">' + ''.join(f'<li><a href="{u}">{esc(n)}</a> <span>{k}</span></li>' for u, n, k in rels) + '</ul>\n') if rels else '')
           + '  <h2>다른 무료 도구</h2>\n  <div class="trel-tools">' + ''.join(f'<a href="{o["href"]}"><b>{esc(o["title"])}</b><span>{esc(o["desc"])}</span></a>' for o in others) + '</div>\n</nav>\n')
    assert v.count('</article>') == 1, t['id']
    v = v.replace('</article>', upd_box(t['href']) + nav + '</article>')
    fq = faq_of(v)
    extra = LD(*([ld, crumbs(('무료 도구', '/tools/'), (t['title'], t['href']))] + ([fq] if fq else [])))
    if js: extra += f'<script defer src="/assets/{js}?v={WIDGET_VER.get(js, VER)}"></script>\n'
    page(t['href'], 'tool-' + t['id'], f"{S['title']} · SHIFT AI", S['desc'], v, og, 'website', extra, secmeta=SECMETA_EVAL if t['id'] in ('heic-to-jpg', 'ocr') else None)
# AI 서비스 비교(/vs/, 11/2~): news/vs.json — 요금제 칼럼(10/29 각 사 공식 페이지 확인)에 실린 사실만 쓴다. 칼럼을 고칠 때 같이 고칠 것.
VS = json.load(open(SRC + 'news/vs.json'))
_VS, _vsc = VS['services'], next((c for c in C if c['id'] == 'c-ai-plans-compare'), None)
_vsog = og_from(col_img(_vsc), _vsc['id']) if _vsc else OG_SITE
_MXL = {'o': ('<i class="mk mk-o"></i>', '무료로 됨'), 'p': ('<i class="mk mk-p"></i>', '무료는 조금만'), 'x': ('<i class="mk mk-x"></i>', '유료부터'), '-': ('–', '기능 없음'), '?': ('?', '공식 자료로 확인 못 함')}
_VSKEY = {'chatgpt': ['챗GPT', '코덱스', '오픈AI'], 'claude': ['클로드'], 'gemini': ['제미나이', '안티그래비티'], 'grok': ['그록']}
_ymd = lambda d: f"{int(d[:4])}년 {int(d[5:7])}월 {int(d[8:])}일"
def _mx(k): return f'<td class="mx-{"n" if k == "-" else "q" if k == "?" else k}"><span aria-hidden="true">{_MXL[k][0]}</span><span class="sr">{_MXL[k][1]}</span></td>'
def _faq(qa): return '<section class="tfaq" id="faq">\n    <h2>자주 묻는 질문</h2>\n' + ''.join(f'    <details><summary>{q}</summary><p>{a}</p></details>\n' for q, a in qa) + '  </section>\n'
def _vscard(q): return f'<a href="/vs/{q["id"]}/"><b>{esc(_VS[q["a"]]["name"])} vs {esc(_VS[q["b"]]["name"])}</b><span>{esc(q["deck"])}</span></a>'
_VSROWS = [('무료', 'free'), ('가장 싼 유료', 'low'), ('많이 쓰는 유료', 'pop'), ('최상위 개인 요금제', 'top'), ('팀 요금제 (1인 월)', 'team'), ('원화 결제', 'krw')]
for pr in VS['pairs']:
    X, Y = _VS[pr['a']], _VS[pr['b']]; u = f"/vs/{pr['id']}/"; xn, yn = X['name'], Y['name']
    pay = [it for it in VS['pay'] if any(k in it[1] for k in _VSKEY[pr['a']] + _VSKEY[pr['b']])]
    qa = [('무료로 더 많이 쓸 수 있는 쪽은 어디인가요?', "두 서비스 모두 무료 한도를 숫자로 공개하지 않고 '제한적' 또는 '기본 사용량'이라고만 적어 둡니다. 숫자보다는 위 표처럼 무료로 열린 기능의 종류를 보고 고르는 편이 정확합니다."),
          ('원화로 결제할 수 있나요?', f"{xn}: {X['krw']}. {yn}: {Y['krw']}. 달러 요금에는 세금이 따로 붙을 수 있습니다."),
          ('API로 쓰면 요금이 어떻게 되나요?', '앱 구독료와 API 요금은 따로 매깁니다. API로 직접 쓸 때 한 달에 얼마가 드는지는 <a href="/tools/ai-cost/">AI 요금 계산기</a>에서 원화로 비교할 수 있습니다.')]
    price = ''.join(f'<tr><td>{n}</td><td>{esc(X[k])}</td><td>{esc(Y[k])}</td></tr>' for n, k in _VSROWS)
    mxr = ''.join(f'<tr><th scope="row">{esc(r)}</th>{_mx(X["mx"][i])}{_mx(Y["mx"][i])}</tr>' for i, r in enumerate(VS['mxRows']))
    payl = ''.join(f'<li><b>{esc(t)}</b> {esc(d)}</li>' for t, d in pay)
    oth = ''.join(_vscard(q) for q in VS['pairs'] if q['id'] != pr['id'])
    ck = _ymd(VS['checked'])
    main = (f'<main id="v-vs"><article class="article narrow vs">\n'
            f'  <a class="back" href="/vs/">← AI 서비스 비교</a>\n'
            f'  <span class="cat">AI 서비스 비교 · 각 사 공식 페이지 {ck} 확인</span>\n'
            f'  <h1>{esc(xn)} vs {esc(yn)}</h1>\n'
            f'  <p class="deck">{esc(pr["deck"])}</p>\n'
            f'  <div class="vspick"><div><b>{esc(xn)} 쪽이 맞는 사람</b><p>{esc(X["fit"])}</p></div><div><b>{esc(yn)} 쪽이 맞는 사람</b><p>{esc(Y["fit"])}</p></div></div>\n'
            f'  <h2>한 달 요금</h2>\n'
            f'  <div class="tbl"><table class="dtable"><thead><tr><th></th><th>{esc(xn)}</th><th>{esc(yn)}</th></tr></thead><tbody>{price}</tbody></table></div>\n'
            f'  <p class="vsnote">각 사 공식 요금 페이지·도움말 기준({ck} 확인). 원화 금액은 1달러=1,324.3원(한국자금중개 10월 26일 매매기준율)으로 바꾼 값이고, 달러 요금에는 세금이 따로 붙을 수 있습니다.</p>\n'
            f'  <h2>무료로 되는 기능</h2>\n'
            f'  <div class="tbl"><table class="dtable mx"><thead><tr><th></th><th>{esc(xn)}</th><th>{esc(yn)}</th></tr></thead><tbody>{mxr}</tbody></table></div>\n'
            f'  <p class="vsnote"><span class="vz-key"><i class="mk mk-o mx-o"></i> 무료로 됨 · <i class="mk mk-p mx-p"></i> 무료는 조금만 · <i class="mk mk-x mx-x"></i> 유료부터 · – 기능 없음 · ? 공식 자료로 확인 못 함.</span> {esc(VS["mxNote"])}</p>\n'
            f'  <h3>{esc(xn)} 무료로 되는 것</h3><p>{esc(X["freeText"])}</p>\n'
            f'  <h3>{esc(yn)} 무료로 되는 것</h3><p>{esc(Y["freeText"])}</p>\n'
            f'  <h2>돈을 내야 하는 순간</h2>\n'
            f'  <ul class="plain vspay">{payl}</ul>\n'
            f'  {_faq(qa)}'
            f'  <div class="box"><b>틀릴 수 있는 지점</b>\n'
            f'    <p>이 비교는 {ck} 각 사 공식 요금 페이지 기준입니다. 네 회사 모두 올해 한 번 이상 요금제를 바꿨고 무료 한도는 숫자 없이 수시로 조정됩니다. 결제하기 전에 각 사 요금 페이지에서 원화 금액과 세금 포함 여부를 한 번 더 확인하세요.</p>\n'
            f'    <ul class="plain"><li><a href="{VS["column"]}">챗GPT·클로드·제미나이·그록 요금제 비교 (네 서비스 한 번에)</a></li><li><a href="{X["fam"]}">{esc(xn)} 서비스 한 번에 정리</a></li><li><a href="{Y["fam"]}">{esc(yn)} 서비스 한 번에 정리</a></li><li><a href="/dict/{X["dict"]}/">{esc(xn)} 최신 소식</a> · <a href="/dict/{Y["dict"]}/">{esc(yn)} 최신 소식</a></li></ul>\n'
            f'  </div>\n'
            f'  {upd_box(u)}'
            f'  <nav class="trel" aria-label="다른 비교"><h2>다른 비교</h2><div class="trel-tools">{oth}</div></nav>\n'
            f'</article></main>')
    title = f"{xn} vs {yn} 비교 — 요금·무료로 되는 것·맞는 사람 ({int(VS['checked'][5:7])}월 기준) · SHIFT AI"
    ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': f"{xn} vs {yn} 비교", 'description': pr['deck'], 'image': [f'{SITE}/{_vsog}'],
          'datePublished': kst('2026-11-02'), 'dateModified': modd(u, '2026-11-02'), 'author': AUTHOR, 'publisher': PUBLISHER, 'mainEntityOfPage': SITE + u, 'inLanguage': 'ko',
          'about': [{'@type': 'SoftwareApplication', 'name': xn, 'applicationCategory': 'AI 챗봇'}, {'@type': 'SoftwareApplication', 'name': yn, 'applicationCategory': 'AI 챗봇'}]}
    fq = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': re.sub(r'href="/', f'href="{SITE}/', a)}} for q, a in qa]}
    page(u, 'vs-' + pr['id'], title, pr['deck'], main, _vsog, 'article', LD(ld, crumbs(('AI 서비스 비교', '/vs/'), (f"{xn} vs {yn}", u)), fq))
_vsi = (f'<main id="v-vsindex"><div class="ph"><h1>AI 서비스 비교</h1><p>챗GPT·클로드·제미나이·그록을 둘씩 놓고 한 달 요금, 무료로 되는 기능, 돈을 내야 하는 순간, 잘 맞는 사람을 비교했습니다. 모든 값은 {_ymd(VS["checked"])} 각 사 공식 페이지에서 확인했습니다.</p></div>\n'
        f'  <div class="trel-tools vsidx">{"".join(_vscard(q) for q in VS["pairs"])}</div>\n'
        f'  <div class="box vsall"><b>네 서비스를 한 번에 보려면</b><p><a href="{VS["column"]}">챗GPT·클로드·제미나이·그록 요금제 비교, 무료로 어디까지 되고 언제 돈을 내야 할까</a> · API로 쓸 때 비용은 <a href="/tools/ai-cost/">AI 요금 계산기</a></p></div>\n'
        f'{FOLLOWBOX}\n</main>')
page('/vs/', 'vs', 'AI 서비스 비교 — 챗GPT vs 클로드·제미나이·그록 요금과 무료 범위 · SHIFT AI', '챗GPT·클로드·제미나이·그록을 둘씩 놓고 한 달 요금, 무료로 되는 기능, 돈을 내야 하는 순간, 잘 맞는 사람을 비교했습니다. 각 사 공식 요금 페이지 기준입니다.',
     _vsi, _vsog, 'website', LD(crumbs(('AI 서비스 비교', '/vs/')), {'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'AI 서비스 비교', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f"{SITE}/vs/{q['id']}/", 'name': f"{_VS[q['a']]['name']} vs {_VS[q['b']]['name']}"} for i, q in enumerate(VS['pairs'])]}))
# 주간 AI 판정(/weekly/, 11/3~): 월요일~일요일(한국 시간) 기사를 판정별로 묶는다. 지난 주는 기사 4개 이상인 주만, 이번 주는 1개부터 만든다.
_wk = lambda d: (datetime.date.fromisoformat(d) - datetime.timedelta(days=datetime.date.fromisoformat(d).weekday())).isoformat()
_md = lambda d: f"{int(d[5:7])}월 {int(d[8:])}일"
def _wrange(m):
    e = (datetime.date.fromisoformat(m) + datetime.timedelta(days=6)).isoformat()
    return f"{_md(m)}~{int(e[8:])}일" if m[5:7] == e[5:7] else f"{_md(m)}~{_md(e)}", e
_today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat()
_W = {}
for a in A: _W.setdefault(_wk(a['date']), []).append(a)
WEEKS = sorted((m for m, xs in _W.items() if len(xs) >= 4 or (m == _wk(_today) and xs)), reverse=True)
_VDN = [('try', '써볼 만해요', 'vd-try', '지금 누구나 쓸 수 있고 원문에서 돈이나 시간을 아끼는 효과를 확인한 것'), ('watch', '지켜보세요', 'vd-watch', '발표만 됐거나 일부만 쓸 수 있는 것, 효과가 아직 분명하지 않은 것'),
        ('hype', '과장이에요', 'vd-hype', '제목이나 회사 발표가 원문에 나온 근거보다 큰 것')]
def _wpost(a):
    v = a.get('verdict') or {}; tag = next((f'<span class="vd {c}">{n}</span>' for k, n, c, _ in _VDN if k == v.get('v')), '')
    return (f'<a class="post vpost" href="/news/{a["id"]}/"><img class="thumb" src="{esc(img_of(a))}" alt="" loading="lazy">'
            f'<div class="b"><span class="cat">{esc(a["cat"])}{tag}</span><h3>{esc(a["title"])}</h3><p class="vwhy">{esc(v.get("why") or a["hook"])}</p>'
            f'<div class="meta"><span>{a["date"].replace("-", ".")}</span></div></div></a>')
PIMG_W, WEEK_LAST = {}, {}
def _wcount(xs): return {k: sum(1 for a in xs if (a.get('verdict') or {}).get('v') == k) for k, *_ in _VDN}
for i, m in enumerate(WEEKS):
    xs = sorted(_W[m], key=lambda a: a['date'] + (a.get('time') or ''), reverse=True)
    rg, end = _wrange(m); now = m == _wk(_today); u = f'/weekly/{m}/'; n = _wcount(xs)
    inw = lambda d: m <= d <= end
    nt, nc, ntl, nd = [t for t in T if inw(t['date'])], [c for c in C if inw(c['date'])], [t for t in TOOLS if inw(t['date'])], sorted((d for d in DY if inw(d['date'])), key=lambda d: d['date'])
    summ = ' · '.join(f'{nm} {n[k]}개' for k, nm, *_ in _VDN if n[k])
    deck = (f"{'이번 주' if now else rg} AI 기사 {len(xs)}개를 원문과 함께 읽고 붙인 판정입니다." + (f' {summ}.' if summ else '') + (' 기사가 나오는 대로 이 페이지에 더해집니다.' if now else ''))
    secs = ''
    for k, nm, cls, how in _VDN:
        g = [a for a in xs if (a.get('verdict') or {}).get('v') == k]
        if g: secs += f'  <div class="sec"><h2><span class="vd {cls}">{nm}</span> {len(g)}개</h2><p class="wkhow">{how}</p></div>\n  <div class="list">{"".join(_wpost(a) for a in g)}</div>\n'
    rest = [a for a in xs if not (a.get('verdict') or {}).get('v')]
    if rest: secs += f'  <div class="sec"><h2>판정 없이 전한 소식 {len(rest)}개</h2><p class="wkhow">소송·판결·사건처럼 써 볼 대상이 없는 기사</p></div>\n  <ul class="plain wkrest">' + ''.join(f'<li><a href="/news/{a["id"]}/">{esc(a["title"])}</a></li>' for a in rest) + '</ul>\n'
    more = ([f'<li>튜토리얼 · <a href="/tutorial/{t["id"][2:]}/">{esc(t["title"])}</a></li>' for t in nt] + [f'<li>칼럼 · <a href="/column/{c["id"][2:]}/">{esc(c["title"])}</a></li>' for c in nc]
            + [f'<li>무료 도구 · <a href="{t["href"]}">{esc(t["title"])}</a></li>' for t in ntl] + [f'<li>데일리 · <a href="/daily/{d["date"]}/">{_md(d["date"])} AI 데일리 뉴스</a></li>' for d in nd])
    if more: secs += f'  <div class="sec"><h2>이 주에 새로 나온 것</h2></div>\n  <ul class="plain wkrest">{"".join(more)}</ul>\n'
    nav = ''.join(f'<a href="/weekly/{w}/"><b>{lab}</b><span>{_wrange(w)[0]}</span></a>' for w, lab in ((WEEKS[i + 1] if i + 1 < len(WEEKS) else None, '← 지난 주'), (WEEKS[i - 1] if i else None, '다음 주 →')) if w)
    h1 = f"이번 주 AI 판정 <small>{rg}</small>" if now else f"{rg} AI 판정"
    main = (f'<main id="v-weekly"><article class="article narrow weekly">\n  <a class="back" href="/weekly/">← 주간 AI 판정</a>\n'
            f'  <span class="cat">주간 AI 판정 · {m[:4]}년 {rg}</span>\n  <h1>{h1}</h1>\n  <p class="deck">{esc(deck)}</p>\n{secs}'
            f'  <div class="box"><b>판정은 이렇게 붙입니다</b><p>AI 에디터가 회사 발표·논문 같은 원문을 읽고 정해진 기준에 따라 판정과 한 줄 이유를 붙이고, 사람 에디터가 기준을 정하고 틀린 판정을 고칩니다. '
            f'모든 기사 끝에 원문 링크가 있습니다. <a href="/verdict/">판정 전체 모아보기</a> · <a href="/about/">SHIFT AI가 일하는 방식</a></p></div>\n'
            + (f'  <nav class="trel wknav" aria-label="다른 주"><div class="trel-tools">{nav}</div></nav>\n' if nav else '') + f'{FOLLOWBOX}\n</article></main>')
    title = f"{'이번 주 ' if now else ''}AI 판정 {rg}" + (f" — {summ}" if summ else '') + ' · SHIFT AI'
    top = next((a for k, *_ in _VDN for a in xs if (a.get('verdict') or {}).get('v') == k), xs[0])
    og = f"og/a-{top['id']}.jpg" if os.path.exists(OUT + f"og/a-{top['id']}.jpg") else OG_SITE
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': f"주간 AI 판정 {m[:4]}년 {rg}", 'description': deck, 'url': SITE + u, 'inLanguage': 'ko', 'publisher': PUBLISHER,
          'datePublished': kst(m), 'dateModified': kst(max(a['date'] for a in xs)),
          'mainEntity': {'@type': 'ItemList', 'numberOfItems': len(xs), 'itemListElement': [{'@type': 'ListItem', 'position': j + 1, 'name': a['title'], 'url': f"{SITE}/news/{a['id']}/"} for j, a in enumerate(xs)]}}
    page(u, 'weekly-' + m, title, deck, main, og, 'website', LD(ld, crumbs(('주간 AI 판정', '/weekly/'), (rg, u))))
    PIMG_W[u] = img_of(top); WEEK_LAST[u] = max(a['date'] for a in xs)
_wi = ''.join(f'<a href="/weekly/{m}/"><b>{"이번 주 · " if m == _wk(_today) else ""}{_wrange(m)[0]}</b><span>기사 {len(_W[m])}개 · ' + ' · '.join(f'{nm} {c}' for (k, nm, *_), c in zip(_VDN, _wcount(_W[m]).values()) if c) + '</span></a>' for m in WEEKS)
page('/weekly/', 'weekly', '주간 AI 판정 — 이번 주 써볼 만한 AI, 지켜볼 AI, 과장된 AI · SHIFT AI', '한 주 동안 나온 AI 소식을 원문부터 읽고 써볼 만해요·지켜보세요·과장이에요로 판정해 주마다 묶었습니다. 판정마다 한 줄 이유와 원문 링크가 있습니다.',
     f'<main id="v-weeklyindex"><div class="ph"><h1>주간 AI 판정</h1><p>한 주 동안 나온 AI 소식을 판정별로 묶었습니다. 바쁘면 이번 주 \'써볼 만해요\'만 보셔도 됩니다. 기사 하나하나는 <a href="/verdict/">AI 판정 모아보기</a>에서 봅니다.</p></div>\n'
     f'  <div class="trel-tools vsidx">{_wi}</div>\n{FOLLOWBOX}\n</main>', OG_SITE, 'website',
     LD(crumbs(('주간 AI 판정', '/weekly/')), {'@context': 'https://schema.org', '@type': 'ItemList', 'name': '주간 AI 판정', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f"{SITE}/weekly/{m}/", 'name': f"AI 판정 {_wrange(m)[0]}"} for i, m in enumerate(WEEKS)]}))
# 길잡이(/guide/, 11/3~): news/guides.json. 이미 확인한 튜토리얼·무료 도구·프롬프트를 일 단위로 묶고, 관련 기사는 기사 끝 '이어서 해 볼 것'이 이 길잡이를 고른 기사로 채운다.
GD = json.load(open(SRC + 'news/guides.json'))
GUIDES = [g for g in GD['guides'] if g.get('page')]
_TB, _TL = {t['id']: t for t in T}, {t['id']: t for t in TOOLS}
_PR = {f"{t['id'][2:]}-{i + 1}": (t, it) for t in T for i, it in enumerate(t['items']) if it.get('prompt')}
_card = lambda h, b, sp, ev='': f'<a href="{h}"{ev}><b>{esc(b)}</b><span>{esc(sp)}</span></a>'
_abs = lambda x: re.sub(r'href="/', f'href="{SITE}/', x)
GUIDE_LAST = {}
for g in GUIDES:
    u = f"/guide/{g['id']}/"
    rel = [a for a in sorted(A, key=lambda a: a['date'] + (a.get('time') or ''), reverse=True) if any(x[1] == u for x in a.get('nx', []))][:6]
    tuts, tools = [_TB[x] for x in g.get('tuts', [])], [_TL[x] for x in g.get('tools', [])]
    steps = ''.join(f'<li><b>{esc(h)}</b><p>{esc(d)} <a href="{lk}">{"도구 열기" if lk.startswith("/tools/") else "비교 보기" if lk.startswith("/vs/") else "자세히 보기"} →</a></p></li>' for h, d, lk in g['steps'])
    prs = ''.join(f'<div class="pr gpr"><b>{esc(it["h"])}</b><div class="pt">{esc(it["prompt"])}</div><div class="pra"><button class="copy dark" data-copy="{esc(it["prompt"])}">복사하기</button>'
                  f'<a href="/tutorial/{t["id"][2:]}/">나온 글: {esc(t["title"])}</a></div></div>' for t, it in (_PR[x] for x in g.get('prompts', [])))
    warns = [x for t in tuts for x in (t.get('limits') or [])[:1]][:3]
    faq = g.get('faq', [])
    main = (f'<main id="v-guide"><article class="article narrow guide">\n  <a class="back" href="/guide/">← AI 길잡이</a>\n  <span class="cat">AI 길잡이 · 일 단위로 찾기</span>\n'
            f'  <h1>{esc(g["h1"])}</h1>\n  <p class="deck">{esc(g["deck"])}</p>\n'
            f'  <div class="sec"><h2>이 순서로 하면 됩니다</h2></div>\n  <ol class="gsteps">{steps}</ol>\n'
            + (f'  <div class="sec"><h2>복사해서 바로 쓰는 프롬프트</h2><a class="more" href="/prompts/">프롬프트 모음 →</a></div>\n  <div class="gprs">{prs}</div>\n' if prs else '')
            + (f'  <div class="sec"><h2>무료 도구</h2></div>\n  <div class="trel-tools">{"".join(_card(t["href"], t["title"], t["desc"]) for t in tools)}</div>\n' if tools else '')
            + f'  <div class="sec"><h2>자세히 따라 하기</h2></div>\n  <div class="trel-tools">{"".join(_card("/tutorial/" + t["id"][2:] + "/", t["title"], t["deck"]) for t in tuts)}</div>\n'
            + (f'  <div class="box"><b>먼저 알아 둘 것</b><ul class="plain">{"".join(f"<li>{esc(w)}</li>" for w in warns)}</ul></div>\n' if warns else '')
            + (f'  <div class="sec"><h2>관련 기사와 판정</h2></div>\n  <ul class="plain wkrest">' + ''.join(f'<li><a href="/news/{a["id"]}/">{esc(a["title"])}</a>{(" · " + {"try": "써볼 만해요", "watch": "지켜보세요", "hype": "과장이에요"}[a["verdict"]["v"]]) if a.get("verdict") else ""}</li>' for a in rel) + '</ul>\n' if rel else '')
            + (_faq(faq) if faq else '')
            + f'  <nav class="trel" aria-label="다른 길잡이"><h2>다른 일 찾기</h2><div class="trel-tools">{"".join(_card("/guide/" + x["id"] + "/", x["h1"], x["card"]) for x in GUIDES if x is not g)}</div></nav>\n'
            + f'{FOLLOWBOX}\n</article></main>')
    og = og_from(tuts[0]['thumb'], 'g-' + g['id']) if tuts and os.path.exists(OUT + tuts[0]['thumb']) else OG_SITE
    mod = max([t.get('mod') or t['date'] for t in tuts] + [t.get('mod') or t['date'] for t in tools] + ['2026-11-03'])
    GUIDE_LAST[u] = max([mod] + [a['date'] for a in rel])
    ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': g['h1'], 'description': g['deck'], 'image': [f'{SITE}/{og}'], 'datePublished': kst('2026-11-03'), 'dateModified': kst(mod),
          'author': AUTHOR, 'publisher': PUBLISHER, 'mainEntityOfPage': SITE + u, 'inLanguage': 'ko'}
    fq = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': _abs(a)}} for q, a in faq]}
    page(u, 'guide-' + g['id'], g['title'] + ' · SHIFT AI', g['deck'], main, og, 'article', LD(*([ld, crumbs(('AI 길잡이', '/guide/'), (g['h1'], u))] + ([fq] if faq else []))))
page('/guide/', 'guide', 'AI 길잡이 — 회의록·PDF 요약·메일·엑셀, 일 단위로 찾는 AI 활용법 · SHIFT AI', '회의록 정리, PDF 요약, 메일 답장, 엑셀 수식, 이력서 검토처럼 하려는 일을 고르면 따라 할 순서와 복사해 쓰는 프롬프트, 무료 도구를 한곳에서 봅니다.',
     f'<main id="v-guideindex"><div class="ph"><h1>AI 길잡이</h1><p>하려는 일을 고르세요. 따라 할 순서와 복사해 쓰는 프롬프트, 설치 없이 쓰는 무료 도구, 관련 기사를 한곳에 모았습니다. 모두 공식 자료로 확인한 튜토리얼에서 가져왔습니다.</p></div>\n'
     f'  <div class="trel-tools vsidx">{"".join(_card("/guide/" + g["id"] + "/", g["h1"], g["card"]) for g in GUIDES)}</div>\n{FOLLOWBOX}\n</main>', OG_SITE, 'website',
     LD(crumbs(('AI 길잡이', '/guide/')), {'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'AI 길잡이', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': f"{SITE}/guide/{g['id']}/", 'name': g['h1']} for i, g in enumerate(GUIDES)]}))
page('/search/', 'search', '검색 · SHIFT AI', 'SHIFT AI의 AI 뉴스·데일리 이슈·튜토리얼·AI 사전을 한 번에 찾습니다.', STATIC['search'], OG_SITE, 'website', '', 'noindex,follow')

# ---- 사이트맵·RSS·robots ----
last = {'/': max(a['date'] for a in A)}
for a in A: last[f"/news/{a['id']}/"] = a['date']
for t in T: last[f"/tutorial/{t['id'][2:]}/"] = t['date']
for c in C: last[f"/column/{c['id'][2:]}/"] = c['date']
for d in DY: last[f"/daily/{d['date']}/"] = d['date']
last.update(termLast)
for t in TOOLS: last[t['href']] = t.get('mod') or t['date']
for _p in ['/vs/'] + [f"/vs/{q['id']}/" for q in VS['pairs']]: last[_p] = '2026-11-02'
if TOOLS: last['/tools/'] = max(t.get('mod') or t['date'] for t in TOOLS)
for _p, _d in WEEK_LAST.items(): last[_p] = _d
for _p, _d in GUIDE_LAST.items(): last[_p] = _d
if GUIDE_LAST: last['/guide/'] = max(GUIDE_LAST.values())
if WEEK_LAST: last['/weekly/'] = max(WEEK_LAST.values())
for _p, _u in UPD.items(): last[_p] = max([last.get(_p, '')] + [x[0] for x in _u])
# 대표 이미지(구글 이미지 검색): 기사·튜토리얼·칼럼·데일리·무료 도구. 사이트 로고는 넣지 않는다.
PIMG = {}
for a in A: PIMG[f"/news/{a['id']}/"] = img_of(a)
for t in T: PIMG[f"/tutorial/{t['id'][2:]}/"] = t['thumb']
for c in C: PIMG[f"/column/{c['id'][2:]}/"] = col_img(c)
for d in DY: PIMG[f"/daily/{d['date']}/"] = day_img(d)
for t in TOOLS: PIMG[t['href']] = t['thumb']
PIMG.update(PIMG_W)
for g in GUIDES:
    if g.get('tuts') and g['tuts'][0] in _TB: PIMG[f"/guide/{g['id']}/"] = _TB[g['tuts'][0]]['thumb']
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
for p in PAGES:
    if p in ('/privacy/', '/search/'): continue
    im = PIMG.get(p)
    im = f'<image:image><image:loc>{SITE}/{esc(im)}</image:loc></image:image>' if im and 'logo' not in im and os.path.exists(OUT + im) else ''
    sm.append(f'<url><loc>{SITE}{p}</loc>' + (f'<lastmod>{last[p]}</lastmod>' if p in last else f'<lastmod>{last["/"]}</lastmod>') + im + '</url>')
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
       f'- [AI 사전]({SITE}/dict/): AI 용어 {len(TERMS)}개 뜻', f'- [무료 도구]({SITE}/tools/): 설치 없이 쓰는 AI 도구', f'- [복붙 프롬프트 모음]({SITE}/prompts/): 튜토리얼 프롬프트를 주제별로', f'- [AI 판정 모아보기]({SITE}/verdict/): 써볼 만해요·지켜보세요·과장이에요', f'- [AI 서비스 비교]({SITE}/vs/): 챗GPT·클로드·제미나이·그록 요금과 무료 범위', f'- [소개]({SITE}/about/): 편집 원칙과 출처 규칙', f'- [RSS]({SITE}/feed.xml)', '',
       f'- [주간 AI 판정]({SITE}/weekly/): 한 주 기사를 판정별로 묶음', f'- [AI 길잡이]({SITE}/guide/): 회의록·PDF·메일·엑셀 등 일 단위 AI 활용법', '',
       '## AI 길잡이'] + [f"- [{g['h1']}]({SITE}/guide/{g['id']}/): {g['deck']}" for g in GUIDES] + ['',
       '## 최신 기사'] + [f"- [{a['title']}]({SITE}/news/{a['id']}/): {a['hook']}" for a in sorted(A, key=_pub, reverse=True)[:30]] + ['', '## 튜토리얼'] + \
      [f"- [{t['title']}]({SITE}/tutorial/{t['id'][2:]}/): {t['deck']}" for t in T] + ['', '## 무료 도구'] + [f"- [{t['title']}]({SITE}{t['href']}): {t['desc']}" for t in TOOLS] + \
      ['', '## AI 사전 (일부)'] + [f"- [{t['t']}]({SITE}/dict/{t['s']}/): {t['d']}" for t in sorted(TERMS, key=lambda t: -len(t['arts']))[:40]]
open(OUT + 'llms.txt', 'w').write('\n'.join(_ll) + '\n')
def rfc822(date, time):
    dt = datetime.datetime.strptime(f'{date} {time}', '%Y-%m-%d %H:%M')
    return dt.strftime('%a, %d %b %Y %H:%M:00 +0900')
feed = ([(a['date'], a.get('time') or '09:00', a['title'], f"/news/{a['id']}/", a['cat'], a['hook']) for a in A]
        + [(t['date'], '09:00', t['title'], f"/tutorial/{t['id'][2:]}/", '튜토리얼', t['deck']) for t in T]
        + [(c['date'], '09:00', c['title'], f"/column/{c['id'][2:]}/", '칼럼', c['deck']) for c in C]
        + [(WEEK_LAST[f'/weekly/{m}/'], '21:00', f"주간 AI 판정 {_wrange(m)[0]}", f'/weekly/{m}/', '주간 AI 판정', f"이 주에 나온 AI 기사 {len(_W[m])}개를 써볼 만해요·지켜보세요·과장이에요로 묶었습니다.") for m in WEEKS if m != _wk(_today)]
        + [(d['date'], '07:00', f"{int(d['date'][5:7])}월 {int(d['date'][8:])}일 AI 데일리 뉴스 — {d['title']}", f"/daily/{d['date']}/", '데일리 이슈', d.get('summary') or ' / '.join(d['three'])) for d in DY])
items = []
for dt, tm, ti, u, cat, ds in sorted(feed, key=lambda x: x[0] + x[1], reverse=True)[:60]:
    u = SITE + u
    items.append(f"<item><title>{esc(ti)}</title><link>{u}</link><guid>{u}</guid><pubDate>{rfc822(dt, tm)}</pubDate><category>{esc(cat)}</category><description>{esc(ds)}</description></item>")
rss = (f'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>SHIFT AI 매거진</title><link>{SITE}/</link>'
       f'<description>{esc(TAG)}</description><language>ko</language>' + ''.join(items) + '</channel></rss>\n')
open(OUT + 'feed.xml', 'w').write(rss)
json.dump(PAGES + ['/404-tmp/'], open(SRC + 'build/pages.json', 'w'))
print('pages', len(PAGES), 'version', VER)

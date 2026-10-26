# 새 기사의 대표 사진을 원문에서 받아 img/ph/<id>.webp(960×540)로 만든다. GitHub Actions(인터넷 가능)에서 돈다.
# 기사 JSON 의 "image": {"og": 사진 주소, "page": 원문 주소, "credit": "이미지: 회사", "alt": 설명, "mode": "screenshot"(선택)}
# 순서: og 주소 → 원문 페이지의 og:image → 원문 화면 캡처. 결과는 news/photos.json 에 기록, 실패는 news/photos-missing.json.
import json, os, re, io, subprocess, sys, urllib.parse
import requests
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from assemble import load_articles, SRC, N

OUT = os.path.dirname(SRC.rstrip('/')) + '/'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 (+https://shiftaimagazine.github.io)'}
W, H = 960, 540
dom = lambda u: re.sub(r'^https?://(www\.)?', '', u).split('/')[0]

def border(im):
    w, h = im.size; px = []
    for b in [(0, 0, w, 3), (0, h - 3, w, h), (0, 0, 3, h), (w - 3, 0, w, h)]: px += list(im.crop(b).getdata())
    px.sort(key=sum); return px[len(px) // 2]

def to_card(im):
    im = im.convert('RGB'); r = im.width / im.height
    if 1.6 <= r <= 1.95:  # 16:9 근처면 살짝 잘라 채우기
        s = max(W / im.width, H / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x, y = (im.width - W) // 2, (im.height - H) // 2; return im.crop((x, y, x + W, y + H))
    s = min(W / im.width, H / im.height); nw, nh = round(im.width * s), round(im.height * s)
    c = Image.new('RGB', (W, H), border(im)); c.paste(im.resize((nw, nh), Image.LANCZOS), ((W - nw) // 2, (H - nh) // 2)); return c

def find_og(page):
    r = requests.get(page, headers=UA, timeout=25); r.raise_for_status(); h = r.text[:400000]
    for pat in [r'<meta[^>]+property=["\']og:image(?::secure_url)?["\'][^>]+content=["\']([^"\']+)', r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image',
                r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)']:
        m = re.search(pat, h, re.I)
        if m: return urllib.parse.urljoin(page, m.group(1).replace('&amp;', '&'))

def get_image(url):
    r = requests.get(url, headers=UA, timeout=30); r.raise_for_status()
    im = Image.open(io.BytesIO(r.content)); im.load()
    if im.width < 400 or im.height < 200: raise ValueError('too small %sx%s' % im.size)
    return im

def screenshot(page, path):
    tmp = path + '.png'
    subprocess.run(['node', SRC + 'shot.js', page, tmp], check=True, timeout=120)
    im = Image.open(tmp); im.load(); os.remove(tmp); return im

photos = json.load(open(N + 'photos.json'))
missing, done = {}, []
for a in load_articles():
    if a['id'] in photos and os.path.exists(OUT + photos[a['id']]['src']): continue
    spec = a.get('image') or {}
    page = spec.get('page') or a['sources'][0][1]
    rel = f"img/ph/{a['id']}.webp"; im = credit = None; errs = []
    if spec.get('mode') != 'screenshot':
        try:
            og = spec.get('og') or find_og(page)
            if og: im = get_image(og); credit = spec.get('credit') or f'이미지: {dom(page)}'
        except Exception as e: errs.append('og: %s' % e)
    if im is None:
        try: im = screenshot(page, OUT + rel); credit = f'화면: {dom(page)}'
        except Exception as e: errs.append('shot: %s' % e)
    if im is None: missing[a['id']] = errs; continue
    to_card(im).save(OUT + rel, 'WEBP', quality=82, method=6)
    photos[a['id']] = {'src': rel, 'credit': credit, 'alt': spec.get('alt') or a['title'], 'auto': True}
    done.append(a['id'])
json.dump(photos, open(N + 'photos.json', 'w'), ensure_ascii=False, indent=1)
json.dump(missing, open(N + 'photos-missing.json', 'w'), ensure_ascii=False, indent=1)
print('새 사진', len(done), done, '| 실패', len(missing), list(missing))

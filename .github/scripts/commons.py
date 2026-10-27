# 위키미디어 공용(Commons)에서 자유 이용 사진을 찾고(search) 골라서 받는다(fetch). GitHub Actions(인터넷 가능)에서 돈다.
#   search: _cand/<key>.jpg(후보 6장 모음) + _cand/<key>.json(후보 정보)
#   fetch : PICKS(JSON {key: "File:..."}) → _out/<key>.webp(960×540) + _out/credits.json
import json, os, re, sys, io, html, urllib.parse
import requests
from PIL import Image, ImageDraw, ImageFont
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'SHIFTAIMagazineBot/1.0 (https://shiftaimagazine.com; image credits)'}
OK = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+|CC BY(-SA)?)', re.I)
def info(params):
    r = requests.get(API, params={'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata|mime', **params}, headers=UA, timeout=30)
    r.raise_for_status(); return list((r.json().get('query') or {}).get('pages', {}).values())
def meta(p):
    ii = p['imageinfo'][0]; em = ii.get('extmetadata', {})
    g = lambda k: html.unescape(re.sub('<[^>]+>', '', (em.get(k) or {}).get('value', ''))).strip()
    return {'title': p['title'], 'w': ii['width'], 'h': ii['height'], 'mime': ii['mime'], 'license': g('LicenseShortName'), 'artist': g('Artist')[:80],
            'page': ii.get('descriptionurl'), 'thumb': ii.get('thumburl'), 'url': ii['url'], 'desc': g('ImageDescription')[:160]}
def search(q):
    ps = info({'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 30, 'iiurlwidth': 480})
    ps.sort(key=lambda p: p.get('index', 0)); out = []
    for p in ps:
        if 'imageinfo' not in p: continue
        m = meta(p)
        if m['mime'] not in ('image/jpeg', 'image/png') or m['w'] < 1200 or not (1.25 <= m['w'] / m['h'] <= 2.1): continue
        if not OK.match(m['license']): continue
        out.append(m)
    return out
def sheet(cands, path):
    W, H = 480, 300; im = Image.new('RGB', (W * 3, H * 2 + 0), 'white'); d = ImageDraw.Draw(im)
    for i, c in enumerate(cands[:6]):
        try:
            t = Image.open(io.BytesIO(requests.get(c['thumb'], headers=UA, timeout=30).content)).convert('RGB')
            t.thumbnail((W, H)); x, y = (i % 3) * W, (i // 3) * H; im.paste(t, (x, y))
            d.rectangle([x, y, x + 34, y + 30], fill='black'); d.text((x + 10, y + 6), str(i + 1), fill='white', font=ImageFont.load_default(size=20))
        except Exception as e: print('thumb fail', c['title'], e)
    im.save(path, quality=80)
def fetch(picks):
    os.makedirs('_out', exist_ok=True); cred = {}
    for key, title in picks.items():
        p = info({'titles': title, 'iiurlwidth': 1920})[0]; m = meta(p)
        src = m['thumb'] or m['url']
        im = Image.open(io.BytesIO(requests.get(src, headers=UA, timeout=60).content))
        if im.mode in ('RGBA', 'LA', 'P'):  # 투명 배경(로고)은 흰 바탕에 올린다
            im = im.convert('RGBA'); bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg
        im = im.convert('RGB')
        if os.environ.get('CONTAIN_' + key.replace('-', '_')):  # 로고: 자르지 않고 가운데 배치
            c = Image.new('RGB', (960, 540), (245, 245, 242)); im.thumbnail((620, 360), Image.LANCZOS)
            c.paste(im, ((960 - im.width) // 2, (540 - im.height) // 2)); c.save(f'_out/{key}.webp', quality=86, method=6)
            cred[key] = m; print(key, m['title'], m['license'], m['artist']); continue
        s = max(960 / im.width, 540 / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        fy = float(os.environ.get('FOCUS_' + key.replace('-', '_'), '0.5'))
        x = (im.width - 960) // 2; y = int((im.height - 540) * fy)
        im.crop((x, y, x + 960, y + 540)).save(f'_out/{key}.webp', quality=82, method=6)
        cred[key] = m; print(key, m['title'], m['license'], m['artist'])
    json.dump(cred, open('_out/credits.json', 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'search':
        os.makedirs('_cand', exist_ok=True)
        for key, qs in json.loads(os.environ['QUERIES']).items():
            seen, c = set(), []
            for q in qs:
                for m in search(q):
                    if m['title'] not in seen: seen.add(m['title']); c.append(m)
            c = c[:6]; json.dump(c, open(f'_cand/{key}.json', 'w'), ensure_ascii=False, indent=1); sheet(c, f'_cand/{key}.jpg'); print(key, len(c))
    else: fetch(json.loads(os.environ['PICKS']))

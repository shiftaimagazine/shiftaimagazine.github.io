# IndexNow 알림: 사이트가 다시 만들어지면 새로 생기거나 바뀐 주소를 네이버·빙(그리고 IndexNow 참여 검색엔진)에 바로 알린다.
# 바뀐 주소 = sitemap.xml 에서 새로 생기거나 lastmod 가 바뀐 <url> (지난 빌드와 비교). --all 이면 사이트맵 전체.
# 쓰는 곳: .github/workflows/indexnow.yml (build-site 가 끝나면 돈다). 키 파일은 사이트 맨 위 <키>.txt (build.py INDEXNOW_KEY).
import json, re, subprocess, sys, urllib.request

SITE, HOST = 'https://shiftaimagazine.com', 'shiftaimagazine.com'
KEY = re.search(r"INDEXNOW_KEY = '([0-9a-f]+)'", open('_src/build.py').read()).group(1)
ENDPOINTS = ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow']
URL_RE = re.compile(r'<url><loc>([^<]+)</loc>(?:<lastmod>([^<]+)</lastmod>)?</url>')

def entries(xml): return dict(URL_RE.findall(xml))

def changed(base):
    now = entries(open('sitemap.xml').read())
    try: old = entries(subprocess.run(['git', 'show', f'{base}:sitemap.xml'], capture_output=True, text=True, check=True).stdout)
    except subprocess.CalledProcessError: print('지난 사이트맵을 못 찾음 → 첫 화면만'); return [SITE + '/']
    return [u for u, lm in now.items() if old.get(u) != lm]

def main():
    if '--all' in sys.argv: urls = list(entries(open('sitemap.xml').read()))
    else: urls = changed(sys.argv[1] if len(sys.argv) > 1 else 'HEAD~1')
    urls = [u for u in urls if u.startswith(SITE)][:10000]
    if not urls: print('알릴 주소 없음'); return
    print('알릴 주소', len(urls)); [print(' ', u) for u in urls[:20]]
    body = json.dumps({'host': HOST, 'key': KEY, 'keyLocation': f'{SITE}/{KEY}.txt', 'urlList': urls}).encode()
    for ep in ENDPOINTS:
        req = urllib.request.Request(ep, data=body, headers={'Content-Type': 'application/json; charset=utf-8'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r: print(ep, r.status)
        except urllib.error.HTTPError as e: print('경고:', ep, e.code, e.read()[:200])
        except Exception as e: print('경고:', ep, e)

main()

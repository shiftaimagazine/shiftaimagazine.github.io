# 원문·공식 사이트 링크 점검(11/3~): 사이트에 나가는 바깥 링크를 모두 열어 보고 끊긴 것을 report.txt 로 남긴다.
# 쓰는 곳: .github/workflows/link-check.yml (매주 월요일 새벽 + 손으로 실행). 먼저 python3 _src/assemble.py 로 build/data.json 을 만든다.
# 판정: 정상(2xx·3xx) / 끊김(404·410·주소 없음) / 확인 필요(403·429·5xx·시간 초과 — 봇을 막는 공식 사이트가 많아 사람이 열어 봐야 함)
import json, os, re, socket, sys, concurrent.futures as cf
import requests
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', 'Accept-Language': 'ko,en;q=0.8'}
uses = {}
def walk(x, where):
    if isinstance(x, dict):
        for v in x.values(): walk(v, where)
    elif isinstance(x, list):
        for v in x: walk(v, where)
    elif isinstance(x, str) and re.match(r'^https?://', x) and 'shiftaimagazine.com' not in x:
        uses.setdefault(x.strip(), set()).add(where)
D = json.load(open(SRC + 'build/data.json'))
for a in D['ARTICLES']: walk(a.get('sources'), f"/news/{a['id']}/")
for t in D['TUTORIALS']: walk([t.get('sources'), (t.get('quick') or {}).get('links'), t.get('app'), t.get('pdf')], f"/tutorial/{t['id'][2:]}/")
for c in D['COLUMNS']: walk([c.get('sources'), c.get('body')], f"/column/{c['id'][2:]}/")
for d in D['DAILY']: walk(d.get('sources'), f"/daily/{d['date']}/")
for f, w in [('news/alternatives.json', '/tools/free-alternatives/'), ('news/ai_prices.json', '/tools/ai-cost/'), ('news/vs.json', '/vs/')]:
    if os.path.exists(SRC + f): walk(json.load(open(SRC + f)), w)
def check(u):
    try:
        r = requests.head(u, headers=UA, timeout=20, allow_redirects=True)
        if r.status_code in (403, 405, 400, 501) or r.status_code >= 500:  # HEAD 를 막는 사이트는 GET 으로 다시
            r = requests.get(u, headers=UA, timeout=25, allow_redirects=True, stream=True); r.close()
        return u, r.status_code, ''
    except requests.exceptions.ConnectionError as e:
        msg = str(e)
        return u, 0, '주소 없음' if ('Name or service not known' in msg or 'NameResolution' in msg or 'getaddrinfo' in msg) else '연결 실패'
    except requests.exceptions.Timeout: return u, 0, '시간 초과'
    except Exception as e: return u, 0, type(e).__name__
with cf.ThreadPoolExecutor(16) as ex: res = list(ex.map(check, sorted(uses)))
broken = [(u, c, m) for u, c, m in res if c in (404, 410) or m == '주소 없음']
unsure = [(u, c, m) for u, c, m in res if (u, c, m) not in broken and (c == 0 or c >= 400)]
out = [f'링크 점검: 바깥 링크 {len(res)}개 · 끊김 {len(broken)} · 확인 필요 {len(unsure)}', '', '== 끊김 (고쳐야 함)']
out += [f'{c or m}  {u}\n    쓰는 곳: {", ".join(sorted(uses[u]))}' for u, c, m in broken] or ['없음']
out += ['', '== 확인 필요 (봇을 막는 사이트일 수 있음 — 브라우저로 열어 확인)']
out += [f'{c or m}  {u}\n    쓰는 곳: {", ".join(sorted(uses[u]))}' for u, c, m in unsure] or ['없음']
open('report.txt', 'w').write('\n'.join(out) + '\n'); print('\n'.join(out[:40]))

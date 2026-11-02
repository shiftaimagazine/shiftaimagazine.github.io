# 구글 서치 콘솔 주간 보고서(report.txt): 어떤 검색어로 몇 번 보였고(노출) 몇 번 눌렸는지(클릭).
# 인증은 GitHub 저장소 비밀값 GSC_SA_KEY(서비스 계정 JSON, 서치 콘솔 '제한됨' 권한)에서만 온다. 읽기 전용 범위만 쓴다.
# 지난 28일(구글 데이터는 2~3일 늦게 들어와 사흘 전까지)과 그 전 28일을 비교한다.
# 실행: GSC_SA_KEY='{"type":"service_account",...}' python3 _src/gsc_report.py report.txt
import datetime as dt, json, os, sys, urllib.parse
import requests

OUT = sys.argv[1] if len(sys.argv) > 1 else 'report.txt'
KEY = os.environ.get('GSC_SA_KEY', '').strip()
API = 'https://www.googleapis.com/webmasters/v3'
lines = []
say = lines.append

def token():
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    cr = service_account.Credentials.from_service_account_info(json.loads(KEY), scopes=['https://www.googleapis.com/auth/webmasters.readonly'])
    cr.refresh(Request()); return cr.token

def q(site, h, start, end, dims, limit=25, **extra):
    body = {'startDate': start.isoformat(), 'endDate': end.isoformat(), 'dimensions': dims, 'rowLimit': limit, 'dataState': 'final', **extra}
    r = requests.post(f'{API}/sites/{urllib.parse.quote(site, safe="")}/searchAnalytics/query', headers=h, json=body, timeout=60)
    if r.status_code != 200: raise RuntimeError(f'검색 성과 조회 실패 HTTP {r.status_code}: {r.text[:200]}')
    return r.json().get('rows', [])

def pct(a, b): return '새로' if not b else f'{(a - b) / b * 100:+.0f}%'

try:
    if not KEY: raise RuntimeError('GSC_SA_KEY 가 없습니다. 서비스 계정 JSON 을 GitHub 저장소 비밀값 GSC_SA_KEY 로 넣고, 서치 콘솔 설정 → 사용자 및 권한에 그 서비스 계정 이메일을 "제한됨"으로 추가해 주세요.')
    h = {'Authorization': 'Bearer ' + token()}
    r = requests.get(f'{API}/sites', headers=h, timeout=30); r.raise_for_status()
    sites = [s['siteUrl'] for s in r.json().get('siteEntry', []) if 'shiftaimagazine.com' in s['siteUrl']]
    if not sites: raise RuntimeError('서비스 계정이 shiftaimagazine.com 속성을 볼 수 없습니다. 서치 콘솔 → 설정 → 사용자 및 권한에 서비스 계정 이메일을 추가했는지 확인해 주세요.')
    site = os.environ.get('GSC_SITE') or sorted(sites, key=lambda s: not s.startswith('sc-domain:'))[0]
    end = dt.date.today() - dt.timedelta(days=3); start = end - dt.timedelta(days=27)
    pend = start - dt.timedelta(days=1); pstart = pend - dt.timedelta(days=27)
    say(f'SHIFT AI 구글 검색 성과  {start} ~ {end} (28일) · 비교: {pstart} ~ {pend} · 속성 {site}')
    tot = q(site, h, start, end, [], 1); ptot = q(site, h, pstart, pend, [], 1)
    t, p = (tot or [{}])[0], (ptot or [{}])[0]
    say(f"== 전체: 클릭 {t.get('clicks', 0):,.0f} (전 {p.get('clicks', 0):,.0f}, {pct(t.get('clicks', 0), p.get('clicks', 0))}) · 노출 {t.get('impressions', 0):,.0f} (전 {p.get('impressions', 0):,.0f}, {pct(t.get('impressions', 0), p.get('impressions', 0))})"
        f" · 클릭률 {t.get('ctr', 0) * 100:.1f}% · 평균 순위 {t.get('position', 0):.1f}")
    say('')
    qs = q(site, h, start, end, ['query'], 250)
    say('== 검색어 상위 30 (노출순: 노출 · 클릭 · 클릭률 · 평균 순위)')
    for x in sorted(qs, key=lambda x: -x['impressions'])[:30]:
        say(f"  {x['impressions']:>6,.0f} · {x['clicks']:>4,.0f} · {x['ctr'] * 100:4.1f}% · {x['position']:5.1f}  {x['keys'][0]}")
    say('')
    say('== 기회 검색어 (노출 20회 이상, 순위 5~20위, 클릭률 3% 미만 → 제목·설명·내용을 보강하면 클릭이 늘 수 있는 것)')
    opp = [x for x in qs if x['impressions'] >= 20 and 5 <= x['position'] <= 20 and x['ctr'] < 0.03]
    for x in sorted(opp, key=lambda x: -x['impressions'])[:20]:
        say(f"  {x['impressions']:>6,.0f} · {x['position']:5.1f}위  {x['keys'][0]}")
    if not opp: say('  (아직 없음)')
    say('')
    pg = q(site, h, start, end, ['page'], 30); ppg = {x['keys'][0]: x for x in q(site, h, pstart, pend, ['page'], 200)}
    say('== 페이지 상위 30 (노출순: 노출 · 클릭 · 지난 28일 대비 노출)')
    for x in sorted(pg, key=lambda x: -x['impressions']):
        u = x['keys'][0].replace('https://shiftaimagazine.com', '')
        say(f"  {x['impressions']:>6,.0f} · {x['clicks']:>4,.0f} · {pct(x['impressions'], ppg.get(x['keys'][0], {}).get('impressions', 0)):>6}  {u}")
    say('')
    dv = q(site, h, start, end, ['device'], 5)
    say('== 기기: ' + ' · '.join(f"{x['keys'][0].lower()} 클릭 {x['clicks']:,.0f}/노출 {x['impressions']:,.0f}" for x in dv))
except Exception as e:
    say(f'서치 콘솔을 읽지 못했습니다: {e}')
open(OUT, 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))

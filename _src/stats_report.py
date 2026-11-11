# 주간 방문 통계 보고서(report.txt). GoatCounter API 를 읽는다. 토큰은 GitHub 저장소 비밀값 GOATCOUNTER_TOKEN(읽기 전용)에서만 온다.
# 지난 7일(한국 시간, 어제까지)과 그 전 7일을 비교: 전체 조회수, 많이 본 페이지, 들어온 곳, 휴대폰 비율,
# 행동 이벤트(무료 도구 사용·결과 가져가기, 프롬프트 복사, 나가는 링크, 대체 프로그램 찾기, 틀린 곳 알려 주기).
# 실행: GOATCOUNTER_TOKEN=... python3 _src/stats_report.py  → report.txt
import collections, datetime as dt, json, os, sys, time, urllib.parse, urllib.request

SITE = os.environ.get('GOATCOUNTER_SITE', 'shiftai')
TOKEN = os.environ.get('GOATCOUNTER_TOKEN', '').strip()
OUT = sys.argv[1] if len(sys.argv) > 1 else 'report.txt'
KST = dt.timezone(dt.timedelta(hours=9))
today = dt.datetime.now(KST).date()
_t = 0 if os.environ.get('INCLUDE_TODAY') == 'true' else 1   # 손으로 돌릴 때 오늘까지 넣어 볼 수 있다
cur = (today - dt.timedelta(days=6 + _t), today - dt.timedelta(days=_t))
prev = (cur[0] - dt.timedelta(days=7), cur[0] - dt.timedelta(days=1))
lines = []
say = lines.append

def api(path, **q):
    url = f'https://{SITE}.goatcounter.com/api/v0{path}?' + urllib.parse.urlencode(q)
    for i in range(4):
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'shift-stats-report'})
        try:
            with urllib.request.urlopen(req, timeout=40) as r: return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and i < 3: time.sleep(int(e.headers.get('X-Rate-Limit-Reset') or 5) + 1); continue
            if e.code == 404:   # 그 기간에 기록이 하나도 없으면 GoatCounter 가 404 를 준다. 무슨 404 인지는 DIAG 에 남긴다
                DIAG.append(f'{path}?{urllib.parse.urlencode(q)} → 404 {e.read()[:160]!r}'); return {}
            raise RuntimeError(f'{path} → HTTP {e.code} {e.read()[:200]!r}')
    raise RuntimeError(f'{path} → 너무 많은 요청')

def rng(p):  # 한국 날짜 하루 전체를 UTC 시각(정시)으로
    a = dt.datetime.combine(p[0], dt.time(0), KST).astimezone(dt.timezone.utc); b = dt.datetime.combine(p[1] + dt.timedelta(days=1), dt.time(0), KST).astimezone(dt.timezone.utc)
    return {'start': a.strftime('%Y-%m-%dT%H:%M:%SZ'), 'end': b.strftime('%Y-%m-%dT%H:%M:%SZ')}
def cnt(h): return h.get('count') if h.get('count') is not None else (h.get('count_unique') or sum((s.get('daily') or 0) for s in h.get('stats') or []))

MORE = []; RAW = {}; DIAG = []
def hits(p):  # 상위 100개 경로(페이지·이벤트). 그보다 많으면 보고서에 적는다
    d = api('/stats/hits', limit=100, **rng(p))
    if not d.get('hits'):   # 2026-11-09: 합계는 있는데 목록이 비어 옴 → 다른 요청 모양으로 다시 받아 본다
        for alt in ({'limit': 100, 'daily': 'true', **rng(p)}, {'limit': 20, **rng(p)}, rng(p), {'limit': 100}):
            try: d2 = api('/stats/hits', **alt)
            except Exception as e: DIAG.append(f'대체 요청 {sorted(alt)} 실패: {str(e)[:120]}'); continue
            if d2.get('hits'): DIAG.append(f'대체 요청 {sorted(alt)} 로 목록 {len(d2["hits"])}개 받음'); d = d2; break
            DIAG.append(f'대체 요청 {sorted(alt)} 도 빈 값(키 {sorted(d2.keys())})')
    RAW[p] = d
    if d.get('more'): MORE.append(f'{p[0]}~{p[1]}')
    return d.get('hits') or []

def pct(a, b): return '새로' if not b else f'{(a - b) / b * 100:+.0f}%'

try:
    if not TOKEN: raise RuntimeError('GOATCOUNTER_TOKEN 이 없습니다. GoatCounter → Settings → API 에서 읽기 전용 토큰을 만들어 GitHub 저장소 Settings → Secrets and variables → Actions 에 GOATCOUNTER_TOKEN 으로 넣어 주세요.')
    say(f'SHIFT AI 주간 방문 통계  {cur[0]} ~ {cur[1]} (한국 시간)  · 비교: {prev[0]} ~ {prev[1]}')
    say('')
    hc, hp = hits(cur), hits(prev)
    pv = lambda hs: [h for h in hs if not h.get('event')]
    ev = lambda hs: [h for h in hs if h.get('event')]
    tc, tp = sum(cnt(h) for h in pv(hc)), sum(cnt(h) for h in pv(hp))
    say(f'== 페이지 조회수: {tc:,} (지난주 {tp:,}, {pct(tc, tp)})')
    try:   # 날짜별 합계(/stats/total). 페이지 목록과 따로 읽어 서로 맞는지 볼 수 있다
        t = api('/stats/total', **rng(cur)) or {}
        say(f'== 전체 합계(/stats/total): 조회 {t.get("total", 0):,} · 이벤트 {t.get("total_events", 0):,}')
        days = [(s.get('day'), s.get('daily', 0)) for s in t.get('stats') or []]
        if days: say('   날짜별: ' + ' · '.join(f'{d[5:]} {n:,}' for d, n in days))
    except Exception as e:
        say(f'== 전체 합계를 못 읽음: {str(e)[:160]}')
    if not hc:
        d = RAW.get(cur) or {}
        say(f'   (페이지 목록이 비어 있음 — 응답 키 {sorted(d.keys())}, total={d.get("total")}, more={d.get("more")})')
    for x in DIAG[:12]: say(f'   [진단] {x}')
    pm = {h['path']: cnt(h) for h in pv(hp)}
    say('== 많이 본 페이지 상위 20 (조회수 · 지난주 대비)')
    for h in sorted(pv(hc), key=cnt, reverse=True)[:20]:
        say(f'  {cnt(h):>6,}  {pct(cnt(h), pm.get(h["path"], 0)):>6}  {h["path"]}  {(h.get("title") or "")[:50]}')
    # 종류별로 묶은 페이지 조회수
    kind = collections.Counter()
    for h in pv(hc):
        p = h['path']; k = ('첫 화면' if p == '/' else '무료 도구' if p.startswith('/tools/') else '튜토리얼' if p.startswith('/tutorial') else '칼럼' if p.startswith('/column') else
             '뉴스·기사' if p.startswith('/news') else '데일리' if p.startswith('/daily') else 'AI 사전' if p.startswith('/dict') else '프롬프트 모음' if p.startswith('/prompts')
             else '판정' if p.startswith(('/verdict', '/weekly', '/vs')) else 'AI 길잡이' if p.startswith('/guide') else '기타')
        kind[k] += cnt(h)
    say('== 종류별 조회수: ' + ' · '.join(f'{k} {v:,}' for k, v in kind.most_common()))
    say('')
    say('== 행동(이벤트) 이번 주 · 지난주')
    em = collections.Counter(); ep = collections.Counter()
    for h in ev(hc): em[h['path']] += cnt(h)
    for h in ev(hp): ep[h['path']] += cnt(h)
    groups = [('tool-use:', '무료 도구 사용(페이지에서 처음 넣거나 누름)'), ('tool-run:', '무료 도구 실행 버튼'), ('tool-done:', '무료 도구 결과 가져감(복사·저장)'),
              ('copy-prompt:', '프롬프트 복사'), ('copy-link:', '링크 복사'), ('fa-find:', '무료 대체 프로그램 찾음'), ('fa-none', '대체 프로그램 못 찾음'),
              ('next:', '기사 끝 \'함께 보면 좋은 콘텐츠\' 클릭(간 곳)'), ('out:', '밖으로 나간 링크(사이트)'), ('fix-report:', '틀린 곳 알려 주기 누름')]
    for pre, label in groups:
        items = [(k, v) for k, v in em.items() if k.startswith(pre)]
        tot, totp = sum(v for _, v in items), sum(v for k, v in ep.items() if k.startswith(pre))
        say(f'-- {label}: {tot:,} (지난주 {totp:,})')
        for k, v in sorted(items, key=lambda x: -x[1])[:12]: say(f'     {v:>5,}  {k[len(pre):] or k}')
    say('')
    refs = api('/stats/toprefs', limit=20, **rng(cur)).get('stats') or []
    say('== 들어온 곳 상위 20 (조회수)')
    for r in refs: say(f'  {r.get("count", 0):>6,}  {r.get("name") or "(직접 들어옴·알 수 없음)"}')
    say('')
    if MORE: say('(경로가 100개를 넘어 상위 100개만 셌습니다: ' + ', '.join(MORE) + ')')
    sizes = api('/stats/sizes', **rng(cur)).get('stats') or []
    st = sum(s.get('count', 0) for s in sizes) or 1
    SZ = {'phone': '휴대폰', 'largephone': '큰 휴대폰·작은 태블릿', 'tablet': '태블릿·작은 노트북', 'desktop': '컴퓨터', 'desktophd': '큰 모니터', 'unknown': '알 수 없음'}
    say('== 화면 크기: ' + ' · '.join(f'{SZ.get(s.get("id") or "", s.get("name") or s.get("id") or "?")} {s.get("count", 0) * 100 / st:.0f}%' for s in sizes if s.get('count')))
except Exception as e:
    say(f'통계를 읽지 못했습니다: {e}')
open(OUT, 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))

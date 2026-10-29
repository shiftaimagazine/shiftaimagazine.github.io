# 원본 JSON들을 모아 _src/build/data.json 을 만든다.
#   기사: news/A·B·C·E.json + news/daily/YYYY-MM-DD.json (각각 {"articles": [...]})
#   대표 사진: news/photos.json {기사 id: {src, credit, alt}} — 새 기사는 fetch_images.py 가 채운다
#   본문 사진: news/inline.json · 데일리 이슈: news/daily.json · 용어: news/terms.json · 쓰레드 링크: news/threads.json
import json, os, glob, sys, re
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
N = SRC + 'news/'
J = lambda n: json.load(open(N + n))

def load_articles():
    files = [N + f + '.json' for f in 'ABCE'] + sorted(glob.glob(N + 'daily/*.json'))
    arts, seen = [], set()
    for f in files:
        for a in json.load(open(f))['articles']:
            assert a['id'] not in seen, ('중복 id', a['id'], f)
            seen.add(a['id']); a['_file'] = os.path.relpath(f, SRC); arts.append(a)
    return arts

REQ = ['id', 'date', 'time', 'cat', 'title', 'sub', 'hook', 'body', 'facts', 'sources', 'ask']
# 습니다체 검사(2026-10-28 글부터): 따옴표 밖에서 '~다.'(한다체)로 끝나는 문장이 있으면 멈춘다
STYLE_FROM = '2026-10-28'
_PLAIN = re.compile(r'(?<!니)(?<!습)다(?=[.?!…]|\s*$)')
_Q = {'“': '”', '‘': '’', '"': '"', "'": "'", '「': '」', '『': '』'}
def plain_endings(s):
    if not s: return []
    spans, i = [], 0
    while i < len(s):
        if s[i] in _Q:
            j = s.find(_Q[s[i]], i + 1)
            if j > i: spans.append((i, j)); i = j + 1; continue
        i += 1
    return [s[max(0, m.start() - 20):m.end() + 1] for m in _PLAIN.finditer(s) if not any(a < m.start() < b for a, b in spans)]
def style_check(where, texts):
    bad = [x for t in texts for x in plain_endings(t)]
    assert not bad, (where, '습니다체로 써야 합니다(한다체 문장 끝 발견, BRIEF.md 2장)', bad[:3])
CATS = {'모델·제품', '보안·안전', '정책·저작권', '비즈니스·일자리', '연구', '커뮤니티·문화'}

if __name__ == '__main__':
    arts = load_articles()
    byid = {a['id']: a for a in arts}
    photos, inline, threads = J('photos.json'), J('inline.json'), J('threads.json')
    DAILY, TERMS = J('daily.json'), J('terms.json')
    out, missing = [], []
    for a in arts:
        a = dict(a); f = a.pop('_file')
        for k in REQ: assert k in a and a[k], (a['id'], '필수 항목 없음', k, f)
        assert a['cat'] in CATS, (a['id'], '분류 오류', a['cat'])
        if a['date'] >= '2026-10-28': assert a.get('try') and len(a['try']) <= 120, (a['id'], "'오늘 바로 해 볼 것'(try) 한 문장 필요(120자 이내)")
        assert all(len(s) == 2 and s[1].startswith('http') for s in a['sources']), (a['id'], 'sources 형식은 [[이름, 주소], ...]')
        if a['date'] >= STYLE_FROM:
            style_check(a['id'], [a['hook'], a.get('try'), a['ask']] + [b.get('lead') or b.get('p') for b in a['body']] + [x[1] for b in a['body'] for x in b.get('ul', [])])
        a.pop('verify', None); spec = a.pop('image', None) or {}
        p = photos.get(a['id'])
        if p and os.path.exists(os.path.dirname(SRC.rstrip('/')) + '/' + p['src']):
            a['image'] = {'src': p['src'], 'credit': p['credit'], 'alt': p.get('alt') or spec.get('alt') or ''}
        else:
            a['image'] = {'src': 'img/logo.webp', 'credit': '', 'alt': a['title'], 'temp': True}; missing.append(a['id'])
        if a['id'] in inline:
            after, fig = inline[a['id']]['after'], inline[a['id']]['img']
            nb, flag, ins = [], False, False
            for x in a['body']:
                nb.append(x)
                if x.get('h') == after: flag = True; continue
                if flag and not ins and 'p' in x: nb.append({'img': fig}); ins = True
            if not ins: nb.append({'img': fig})
            a['body'] = nb
        if a['id'] in threads: a['thread'] = threads[a['id']]
        out.append(a)
    # 첫 화면 대표 기사: 가장 최근 데일리 이슈의 lead (사진이 있을 때)
    DAILY.sort(key=lambda d: d['date'], reverse=True)
    for d in DAILY:
        for i in d['items']: assert i in byid, ('데일리 이슈에 없는 기사', d['date'], i)
        if d['date'] >= STYLE_FROM: style_check('데일리 ' + d['date'], [d['summary']] + d.get('three', []))
        assert d.get('lead') in d['items'], ('lead 는 items 안에 있어야 함', d['date'])
    for d in DAILY:
        lead = next((x for x in out if x['id'] == d['lead']), None)
        if lead and not lead['image'].get('temp'): lead['featured'] = True; break
    GROUPS = {'AI', '제품·회사', '개발', '인프라', '보안·개인정보', '비즈니스·정책'}
    for t in TERMS:
        assert not t.get('rel') or t['rel'] in byid, ('용어 rel 오류', t['t'])
        assert t.get('g') in GROUPS, ('용어 분야(g) 오류', t['t'], t.get('g'))
    assert len({t['t'] for t in TERMS}) == len(TERMS), '중복 용어'
    # 사람이 쓴 글처럼(2026-10-29~): 새 기사는 AI 티 점검기(_src/humanize/shift_humanize.py)의 '반드시 고칠 것'(S1)이 0건이어야 합니다.
    # 고치는 법은 _src/humanize/HUMANIZE.md. GitHub Actions 빌드에서는 경고만 하고 멈추지 않습니다(사이트 배포가 막히지 않게).
    sys.path.insert(0, SRC + 'humanize')
    import shift_humanize
    _bad = shift_humanize.gate()
    if _bad and os.environ.get('GITHUB_ACTIONS'):
        print('경고: AI 티 S1', len(_bad), '건 —', _bad[:3])
    else:
        assert not _bad, ('AI 티 점검(S1) — shift_humanize.py export/apply 로 고친 뒤 다시 돌리세요(HUMANIZE.md)', _bad[:6])

    old = J('old_tut.json'); tl = J('tutorial_links.json')
    cross = old['cross']; cross['thumb'] = 'img/cover/t-crosscheck-prompts.webp'; cross['rel'] = '2026-10-19-whatsapp-hidden-ai-instructions'
    if cross['id'] in tl['TFIG']: cross['cover'], cross['coverCredit'] = tl['TFIG'][cross['id']]
    tuts = J('D_tutorials.json')['tutorials']
    for t in tuts:
        t['thumb'] = f"img/cover/{t['id']}.webp"; t['rel'] = tl['TREL'].get(t['id'])
        if t['id'] in tl['TFIG']: t['cover'], t['coverCredit'] = tl['TFIG'][t['id']]
        else: t.pop('cover', None)
    # 튜토리얼 분류 (목록의 분류 버튼 순서)
    TUT_CATS = ['업무', '자동화', '스킬·MCP', '비용 절약', '영상·이미지', 'AI 답 검증', '보안·개인정보', '공부·리서치', '콘텐츠·커리어']
    # 모든 목록은 최신순: 날짜가 같으면 나중에 넣은 글이 위
    cross['_n'] = -1
    for i, t in enumerate(tuts): t['_n'] = i
    TUTS = sorted([cross] + tuts, key=lambda t: (t['date'], t['_n']), reverse=True)
    for t in TUTS:
        t.pop('_n')
        assert t.get('cat') in TUT_CATS, ('튜토리얼 분류(cat) 오류', t['id'], t.get('cat'))
        assert isinstance(t.get('tool'), list) and t['tool'] and all(isinstance(x, str) and x for x in t['tool']), ('튜토리얼 도구(tool) 목록 필요', t['id'])
        assert t.get('kind') in ('steps', 'prompts'), ('튜토리얼 kind 는 steps 또는 prompts', t['id'])
        for it in t['items']:
            for c in it.get('code', []): assert c.get('cmd'), ('code.cmd 없음', t['id'], it['h'])
        if t['date'] >= STYLE_FROM: style_check(t['id'], [t['deck'], t['why'], t.get('intro')] + [x for it in t['items'] for x in [it.get('d'), it.get('how')] + it.get('more', [])] + t.get('limits', []))
    cols = J('columns.json')['columns']
    for c in cols:
        assert c.get('rel') is None or c['rel'] in byid, ('칼럼 rel 오류(없으면 null)', c['id'], c.get('rel'))
        if c['date'] >= STYLE_FROM: style_check(c['id'], [c['deck']] + [b.get('lead') or b.get('p') for b in c['body']] + [x for b in c['body'] for x in b.get('pred', [])])
    for c in cols:   # 칼럼 본문 링크 상자 {"link": {"k": 작은 제목, "t": 제목, "u": 사이트 안 주소, "d": 설명}}
        for b in c['body']:
            if 'link' in b: assert b['link'].get('t') and str(b['link'].get('u', '')).startswith('/'), ('칼럼 link 는 사이트 안 주소(/로 시작)만', c['id'])
    cols = [c for _, c in sorted(enumerate(cols), key=lambda x: (x[1]['date'], x[1].get('time') or '', x[0]), reverse=True)]
    old['resources'].sort(key=lambda r: r['date'], reverse=True)

    out.sort(key=lambda a: a['date'] + ' ' + (a.get('time') or ''), reverse=True)
    TOOLS = J('tools.json')
    for t in TOOLS:
        for k in ('id', 'title', 'desc', 'href', 'tag', 'date', 'thumb'): assert t.get(k), ('도구 항목 없음', t.get('id'), k)
    TOOLS.sort(key=lambda t: t['date'], reverse=True)
    # AI 요금 계산기 가격(공식 가격표에서 확인한 값만, 100만 토큰당 달러)
    PR = J('ai_prices.json') if os.path.exists(N + 'ai_prices.json') else None
    if PR:
        assert PR.get('asof') and PR['fx'].get('rate') and PR['fx'].get('url'), 'ai_prices: asof·환율 출처 필요'
        for m in PR['models']:
            for k in ('provider', 'name', 'tier', 'url'): assert m.get(k), ('ai_prices 항목 없음', m.get('name'), k)
            assert isinstance(m.get('in'), (int, float)) and isinstance(m.get('out'), (int, float)), ('ai_prices 가격', m['name'])
    # AI 사전 용어 페이지(/dict/<s>/, 10/29~): 주소 s 와 관련 기사(arts)·튜토리얼(tuts)
    #  주소: 용어 t 가 영문이면 t, 아니면 en 에서 만든다(영문 소문자·숫자·하이픈). terms.json 에 "s" 를 직접 적으면 그 값.
    #  en 을 고치면 주소가 바뀌니, 이미 있는 용어는 en 대신 "s" 를 적어 주소를 고정한다.
    #  관련 기사: 기사 terms 에 들어 있거나 rel 인 기사 + (제품·회사 용어는) 제목·요약에 이름이 나오는 기사. 최신순 최대 20건.
    def _slug(t):
        if t.get('s'): return t['s']
        src = t['t'] if re.fullmatch(r'[A-Za-z0-9 .·\-]+', t['t']) else (t.get('en') or '')
        return re.sub(r'[^a-z0-9]+', '-', src.lower()).strip('-')
    _seen = {}
    import hashlib
    for t in TERMS:   # 빌드가 멈추지 않게: 주소를 못 만들면 term-<해시>, 겹치면 뒤에 -2 (가능하면 terms.json 에 "s" 를 적어 고정)
        sl = _slug(t)
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', sl or ''): sl = 'term-' + hashlib.md5(t['t'].encode()).hexdigest()[:8]; print('알림: 용어 주소 자동', t['t'], sl)
        base, k = sl, 2
        while sl in _seen: sl = f'{base}-{k}'; k += 1
        if sl != base: print('알림: 용어 주소 겹침', t['t'], _seen[base], '→', sl)
        t['s'] = sl; _seen[sl] = t['t']
    def _named(t, text):
        names = [t['t']] + ([t['en']] if t.get('en') and len(t['en']) >= 4 and re.fullmatch(r'[A-Za-z0-9 .\-]+', t['en']) else [])
        for n in names:
            for m in re.finditer(re.escape(n), text, re.I if n.isascii() else 0):
                after = text[m.end():m.end() + 4]
                if n.isascii() and re.match(r'[A-Za-z0-9]', after): continue      # Meta → Metadata 같은 것 제외
                if after.startswith('리케이션'): continue                          # 애플 → 애플리케이션 제외
                return True
        return False
    for t in TERMS:
        arts = [a['id'] for a in out if t['t'] in (a.get('terms') or []) or a['id'] == t.get('rel')
                or (t['g'] == '제품·회사' and _named(t, a['title'] + ' ' + a['hook']))]
        t['arts'] = arts[:20]
        t['tuts'] = [x['id'] for x in TUTS if any(n and n.lower() == k.lower() for k in x['tool'] for n in (t['t'], t.get('en')))
                     or (t['g'] == '제품·회사' and _named(t, x['title']))][:6]
    DATA = {'ARTICLES': out, 'TUTORIALS': TUTS, 'TUT_CATS': TUT_CATS, 'TOOLS': TOOLS, 'AI_PRICES': PR, 'RESOURCES': old['resources'], 'COLUMNS': cols, 'DAILY': DAILY, 'TERMS': TERMS,
            'ABOUT_CARD': {'src': 'img/ph/about-card.webp', 'caption': '쓰레드·인스타그램 카드 (10월 26일 PHP2Shell 편)'}}
    os.makedirs(SRC + 'build', exist_ok=True)
    json.dump(DATA, open(SRC + 'build/data.json', 'w'), ensure_ascii=False)
    print('articles', len(out), 'tutorials', len(TUTS), 'columns', len(cols), 'daily', len(DAILY), 'terms', len(TERMS),
          '| 사진 없음', len(missing), missing[:5])

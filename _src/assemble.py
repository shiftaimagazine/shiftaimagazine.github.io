# 원본 JSON들을 모아 _src/build/data.json 을 만든다.
#   기사: news/A·B·C·E.json + news/daily/YYYY-MM-DD.json (각각 {"articles": [...]})
#   대표 사진: news/photos.json {기사 id: {src, credit, alt}} — 새 기사는 fetch_images.py 가 채운다
#   본문 사진: news/inline.json · 데일리 이슈: news/daily.json · 용어: news/terms.json · 쓰레드 링크: news/threads.json
import json, os, glob, sys, re
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
N = SRC + 'news/'
OUT = os.path.dirname(SRC.rstrip('/')) + '/'
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
    # 대표 이미지 규칙(10/29 사용자 지적, news/VISUAL_GUIDE.md): 글마다 그 글 주제의 이미지가 있어야 한다.
    #  칼럼은 image(직접 지정, 파일이 있어야 함) 또는 rel(바탕이 된 기사 — 정말 그 기사를 바탕으로 쓴 칼럼일 때만)이 필요하고, 사이트 로고는 대표 이미지로 쓰지 않는다.
    for c in cols:
        im = (c.get('image') or {}).get('src')
        assert im or c.get('rel'), ('칼럼 대표 이미지 없음 — image 를 지정하거나(표지 인포그래픽: covers.py) 바탕이 된 기사가 있을 때만 rel', c['id'])
        if im:
            assert os.path.exists(OUT + im), ('칼럼 대표 이미지 파일 없음', c['id'], im)
            assert 'logo' not in im, ('사이트 로고는 대표 이미지로 쓰지 않습니다', c['id'])
            assert (c['image'].get('credit') or '').strip(), ('칼럼 대표 이미지 출처(credit) 필요', c['id'])
    for a in out:   # 사진이 아직 없는 새 기사의 임시 로고(temp)는 빼고 본다 — fetch_images.py 가 push 뒤에 채우고, 실패는 photos-missing.json
        im = a.get('image') or {}
        assert im.get('temp') or 'logo' not in (im.get('src') or ''), ('사이트 로고는 기사 대표 이미지로 쓰지 않습니다', a['id'])
    for c in cols:   # 칼럼 본문 링크 상자 {"link": {"k": 작은 제목, "t": 제목, "u": 사이트 안 주소, "d": 설명}}
        for b in c['body']:
            if 'link' in b: assert b['link'].get('t') and str(b['link'].get('u', '')).startswith('/'), ('칼럼 link 는 사이트 안 주소(/로 시작)만', c['id'])
    cols = [c for _, c in sorted(enumerate(cols), key=lambda x: (x[1]['date'], x[1].get('time') or '', x[0]), reverse=True)]
    old['resources'].sort(key=lambda r: r['date'], reverse=True)

    out.sort(key=lambda a: a['date'] + ' ' + (a.get('time') or ''), reverse=True)
    # 기사 판정(11/2~): 기사 JSON 의 "verdict" 또는 news/verdicts.json {"기사 id": {"v": "try|watch|hype", "why": "한 줄 이유"}}
    #  try=써볼 만해요 · watch=지켜보세요 · hype=과장이에요. 소송·사건처럼 써 볼 대상이 없는 기사는 비워 둔다. 규칙은 BRIEF.md 2-2장.
    VERD = J('verdicts.json') if os.path.exists(N + 'verdicts.json') else {}
    for a in out:
        v = a.get('verdict') or VERD.get(a['id'])
        if not v: continue
        assert v.get('v') in ('try', 'watch', 'hype') and 15 <= len(v.get('why') or '') <= 90, (a['id'], 'verdict 형식: {"v": try|watch|hype, "why": 15~90자}')
        style_check(a['id'] + ' 판정', [v['why']])
        a['verdict'] = {'v': v['v'], 'why': v['why']}
    # 수정 기록(11/3~): news/updates.json {"/주소/": [["YYYY-MM-DD", "고친 내용"], ...]} → 글 아래 '수정 기록', 사이트맵·dateModified
    UPD = {k: v for k, v in (J('updates.json') if os.path.exists(N + 'updates.json') else {}).items() if not k.startswith('_')}
    for k, v in UPD.items():
        assert k.startswith('/') and k.endswith('/'), ('updates 주소 형식', k)
        for d, t in v:
            assert re.match(r'^\d{4}-\d{2}-\d{2}$', d) and 10 <= len(t) <= 160, ('updates 형식', k, d)
        style_check('수정 기록 ' + k, [t for _, t in v])
    def _upd(path): return sorted(UPD.get(path, []))
    for a in out:
        if _upd(f"/news/{a['id']}/"): a['upd'] = _upd(f"/news/{a['id']}/")
    for c in cols:
        if _upd(f"/column/{c['id'][2:]}/"): c['upd'] = _upd(f"/column/{c['id'][2:]}/")
    for t in TUTS:
        if _upd(f"/tutorial/{t['id'][2:]}/"): t['upd'] = _upd(f"/tutorial/{t['id'][2:]}/")
    TOOLS = J('tools.json')
    for t in TOOLS:
        for k in ('id', 'title', 'desc', 'href', 'tag', 'date', 'thumb'): assert t.get(k), ('도구 항목 없음', t.get('id'), k)
    TOOLS.sort(key=lambda t: t['date'], reverse=True)
    # 길잡이·'이어서 해 볼 것'(11/3~): news/guides.json. 기사·칼럼마다 맞는 주제를 골라 길잡이·튜토리얼·무료 도구를 최대 3개 붙인다(nx).
    GD = J('guides.json') if os.path.exists(N + 'guides.json') else {'guides': [], 'fallback': {}}
    _tid, _tool = {t['id']: t for t in TUTS}, {t['id']: t for t in TOOLS}
    _pids = {f"{t['id'][2:]}-{i + 1}" for t in TUTS for i, it in enumerate(t['items']) if it.get('prompt')}
    for g in GD['guides']:
        assert re.fullmatch(r'[a-z0-9-]+', g['id']) and g.get('kw'), ('guides 형식', g.get('id'))
        for x in g.get('tuts', []): assert x in _tid, ('guides 튜토리얼 없음', g['id'], x)
        for x in g.get('tools', []): assert x in _tool, ('guides 무료 도구 없음', g['id'], x)
        for x in g.get('prompts', []): assert x in _pids, ('guides 프롬프트 없음', g['id'], x)
        if g.get('page'):
            for k in ('title', 'h1', 'deck', 'card', 'steps'): assert g.get(k), ('guides 항목 없음', g['id'], k)
            style_check('길잡이 ' + g['id'], [g['deck']] + [x[1] for x in g['steps']] + [re.sub(r'<[^>]+>', '', a) for _, a in g.get('faq', [])])
            for _, ans in g.get('faq', []):
                assert not re.search(r'<(?!/?a\b)|<a (?!href="/[^"]*">)', ans), ('guides FAQ 에는 <a href="/..."> 만', g['id'])
    for v in GD.get('fallback', {}).values(): assert any(g['id'] == v for g in GD['guides']), ('guides fallback', v)
    _gid = {g['id']: g for g in GD['guides']}
    def _flat(x):
        if isinstance(x, str): return x
        if isinstance(x, dict): return ' '.join(_flat(v) for v in x.values())
        if isinstance(x, list): return ' '.join(_flat(v) for v in x)
        return ''
    def _hits(g, text): return sum(len(re.findall(re.escape(k), text, re.I)) for k in g['kw'])
    def _next(head, terms, body, cat):
        sc = sorted(((3 * _hits(g, head) + 2 * _hits(g, terms) + min(_hits(g, body), 4), i, g) for i, g in enumerate(GD['guides'])), key=lambda x: (-x[0], x[1]))
        top = [g for s_, _, g in sc if s_ >= 5][:1]
        top += [g for s_, _, g in sc[1:2] if top and s_ >= max(6, sc[0][0] * 0.6)]
        top = top or ([_gid[GD['fallback'][cat]]] if cat in GD.get('fallback', {}) else [])
        nx = []
        def add(kind, href, title):
            if len(nx) < 3 and href not in [x[1] for x in nx]: nx.append([kind, href, title])
        for g in top:
            if g.get('page'): add('길잡이', f"/guide/{g['id']}/", g['h1'])
            if g.get('tuts'): t = _tid[g['tuts'][0]]; add('튜토리얼', f"/tutorial/{t['id'][2:]}/", t['title'])
            if g.get('tools'): t = _tool[g['tools'][0]]; add('무료 도구', t['href'], t['title'])
        return nx
    for a in out:
        a['nx'] = _next(' '.join([a['title'], a.get('sub') or '', a.get('hook') or '', a.get('try') or '']), ' '.join(a.get('terms') or []), _flat(a.get('body')), a['cat'])
    for c in cols:
        c['nx'] = _next(' '.join([c['title'], c.get('deck') or '', c.get('sub') or '']), '', _flat(c.get('body')), '')
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
    _vs = J('vs.json'); _vsv = _vs['services']
    VSL = [{'id': q['id'], 't': f"{_vsv[q['a']]['name']} vs {_vsv[q['b']]['name']}", 'k': [_vsv[q['a']]['dict'], _vsv[q['b']]['dict']]} for q in _vs['pairs']]
    DATA = {'ARTICLES': out, 'TUTORIALS': TUTS, 'TUT_CATS': TUT_CATS, 'TOOLS': TOOLS, 'AI_PRICES': PR, 'RESOURCES': old['resources'], 'COLUMNS': cols, 'DAILY': DAILY, 'TERMS': TERMS, 'VS': VSL,
            'ABOUT_CARD': {'src': 'img/ph/about-card.webp', 'caption': '쓰레드·인스타그램 카드 (10월 26일 PHP2Shell 편)'}}
    # 보안 점검(11/2): 화면에 링크로 나가는 주소는 https/http(또는 사이트 안 /주소)만. javascript: 같은 주소가 섞이면 빌드를 멈춘다.
    _okurl = lambda u: isinstance(u, str) and (u.startswith('https://') or u.startswith('http://') or (u.startswith('/') and not u.startswith('//')))
    for a in out:
        for _, u in a.get('sources') or []: assert _okurl(u), ('기사 출처 주소 형식', a['id'], u)
    for t in TUTS:
        for _, u in (t.get('sources') or []) + ((t.get('quick') or {}).get('links') or []): assert _okurl(u), ('튜토리얼 링크 주소 형식', t['id'], u)
    for t in TOOLS: assert _okurl(t['href']), ('도구 주소 형식', t['id'])
    TOOL_CATS = ['AI 활용', '글쓰기', 'PDF·문서', '사진·이미지', '개인정보', '비용 절약', '번역·회의']
    for t in TOOLS: assert t.get('cats') and set(t['cats']) <= set(TOOL_CATS), ('도구 주제(cats)가 없거나 목록에 없음', t['id'], TOOL_CATS)
    os.makedirs(SRC + 'build', exist_ok=True)
    json.dump(DATA, open(SRC + 'build/data.json', 'w'), ensure_ascii=False)
    print('articles', len(out), 'tutorials', len(TUTS), 'columns', len(cols), 'daily', len(DAILY), 'terms', len(TERMS),
          '| 사진 없음', len(missing), missing[:5])

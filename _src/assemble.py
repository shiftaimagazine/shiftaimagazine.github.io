# 원본 JSON들을 모아 _src/build/data.json 을 만든다.
#   기사: news/A·B·C·E.json + news/daily/YYYY-MM-DD.json (각각 {"articles": [...]})
#   대표 사진: news/photos.json {기사 id: {src, credit, alt}} — 새 기사는 fetch_images.py 가 채운다
#   본문 사진: news/inline.json · 데일리 이슈: news/daily.json · 용어: news/terms.json · 쓰레드 링크: news/threads.json
import json, os, glob, sys
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
        assert all(len(s) == 2 and s[1].startswith('http') for s in a['sources']), (a['id'], 'sources 형식은 [[이름, 주소], ...]')
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
        assert d.get('lead') in d['items'], ('lead 는 items 안에 있어야 함', d['date'])
    for d in DAILY:
        lead = next((x for x in out if x['id'] == d['lead']), None)
        if lead and not lead['image'].get('temp'): lead['featured'] = True; break
    GROUPS = {'AI', '개발', '인프라', '보안·개인정보', '비즈니스·정책'}
    for t in TERMS:
        assert not t.get('rel') or t['rel'] in byid, ('용어 rel 오류', t['t'])
        assert t.get('g') in GROUPS, ('용어 분야(g) 오류', t['t'], t.get('g'))
    assert len({t['t'] for t in TERMS}) == len(TERMS), '중복 용어'

    old = J('old_tut.json'); tl = J('tutorial_links.json')
    cross = old['cross']; cross['thumb'] = 'img/cover/t-crosscheck-prompts.webp'; cross['rel'] = '2026-10-19-whatsapp-hidden-ai-instructions'
    tuts = J('D_tutorials.json')['tutorials']
    for t in tuts:
        t['thumb'] = f"img/cover/{t['id']}.webp"; t['rel'] = tl['TREL'].get(t['id'])
        if t['id'] in tl['TFIG']: t['cover'], t['coverCredit'] = tl['TFIG'][t['id']]
        else: t.pop('cover', None)
    tuts.sort(key=lambda t: t['date'], reverse=True)
    TUTS = [cross] + tuts
    cols = J('columns.json')['columns']
    for c in cols: assert c['rel'] in byid, c['rel']

    DATA = {'ARTICLES': out, 'TUTORIALS': TUTS, 'RESOURCES': old['resources'], 'COLUMNS': cols, 'DAILY': DAILY, 'TERMS': TERMS,
            'ABOUT_CARD': {'src': 'img/ph/about-card.webp', 'caption': '쓰레드·인스타그램 카드 (10월 26일 PHP2Shell 편)'}}
    os.makedirs(SRC + 'build', exist_ok=True)
    json.dump(DATA, open(SRC + 'build/data.json', 'w'), ensure_ascii=False)
    print('articles', len(out), 'tutorials', len(TUTS), 'columns', len(cols), 'daily', len(DAILY), 'terms', len(TERMS),
          '| 사진 없음', len(missing), missing[:5])

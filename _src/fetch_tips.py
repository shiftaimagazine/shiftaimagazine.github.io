#!/usr/bin/env python3
"""스레드 실용 팁 받기(11/11~): shift-threads 저장소에 올린 글 기록에서 실용 팁(format howto)을 읽어 _src/news/tips.json 에 쌓는다.

- 올린 글만 싣는다(posted.json 의 status ok). 한 번 쌓은 팁은 저장소에서 큐 파일이 지워져도 남는다.
- 받지 못하면(네트워크·형식 오류) 있던 파일을 그대로 두고 끝낸다. 빌드를 멈추지 않는다.
- 쓰는 법: python3 _src/fetch_tips.py            # 공개 저장소에서 받기(빌드 워크플로)
           python3 _src/fetch_tips.py --from DIR  # 내려받아 둔 shift-threads 폴더에서 읽기(시험용)
사이트 글투(습니다체)와 달리 스레드 글투(해요체) 그대로 싣고, 그림 글자(이모지)와 '저장해 두고 써 보세요' 같은 스레드용 끝 문장만 뺀다.
"""
import json, os, re, sys, urllib.request

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
OUT = SRC + 'news/tips.json'
RAW = 'https://raw.githubusercontent.com/shiftaimagazine/shift-threads/main/'
EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿️‍]')
DROP = {'저장해 두고 써 보세요.', '저장해 두고 써 보세요'}


def get(path, local):
    if local:
        with open(os.path.join(local, path), encoding='utf-8') as f: return json.load(f)
    req = urllib.request.Request(RAW + path, headers={'User-Agent': 'shift-ai-site-build'})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)


def clean(s):
    lines = [re.sub(r'[ \t]+$', '', EMOJI.sub('', x)).rstrip() for x in str(s or '').split('\n')]
    lines = [x for x in lines if x.strip() not in DROP]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def tip(x, link):
    cover = next((s for s in x.get('slides') or [] if s.get('kind') == 'cover'), {})
    lst = next((s for s in x.get('slides') or [] if s.get('kind') == 'list'), {})
    title = re.sub(r'\s+', ' ', (cover.get('title') or '').replace('==', '')).strip()
    parts = [clean(p) for p in x.get('parts') or [] if clean(p)]
    if not title or not parts: return None
    return {'id': x['id'], 'date': x['id'][:10], 'tag': cover.get('tag') or '', 'title': title, 'sub': clean(cover.get('sub')),
            'parts': parts, 'label': clean(lst.get('label')), 'steps': [[clean(i.get('h')), clean(i.get('d'))] for i in lst.get('items') or [] if i.get('h')],
            'link': link, 'sources': [u for u in x.get('sources') or [] if isinstance(u, str) and u.startswith('https://')]}


def main():
    local = sys.argv[sys.argv.index('--from') + 1] if '--from' in sys.argv else None
    have = {t['id']: t for t in (json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else [])}
    try:
        posted = get('posted.json', local)
        want = sorted({k[:10] for k, v in posted.items() if 'howto' in k and (v or {}).get('status') == 'ok' and (v or {}).get('link') and k not in have})
        added = 0
        for d in want:
            try: q = get(f'queue/{d}.json', local)
            except Exception as e: print('알림: 큐 파일 없음', d, repr(e)[:80]); continue
            for x in q:
                p = posted.get(x.get('id')) or {}
                if x.get('format') != 'howto' or p.get('status') != 'ok' or not p.get('link') or x['id'] in have: continue
                t = tip(x, p['link'])
                if t: have[t['id']] = t; added += 1
    except Exception as e:
        print('알림: 스레드 팁을 받지 못해 있던 것을 그대로 씁니다 →', repr(e)[:160]); return
    tips = sorted(have.values(), key=lambda t: t['id'], reverse=True)
    if added or not os.path.exists(OUT):
        open(OUT, 'w', encoding='utf-8').write(json.dumps(tips, ensure_ascii=False, indent=1) + '\n')
    print(f'스레드 실용 팁 {len(tips)}개 (새로 {added}개)')


if __name__ == '__main__':
    main()

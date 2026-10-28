#!/usr/bin/env python3
"""SHIFT AI 매거진 — 한국어 AI 티 점검기 (습니다체 뉴스용)

규칙 출처
  - humanize-korean (github.com/epoko77-ai/im-not-ai, MIT, v2.3.2) 의 85개 패턴 중
    정규식으로 셀 수 있는 것을 습니다체 기사 문장에 맞게 옮겼습니다. 규칙 ID(C-8, D-8 …)는
    그쪽 분류표(vendor/im-not-ai/skills/humanize-korean/references/quick-rules.md)와 같습니다.
  - humanizer-kr (github.com/hjongc/humanizer-kr, MIT, v0.1.10) 의 audit_korean_text.py 에서
    과장 칭찬·막연한 권위·챗봇 잔재·머리말 예열 규칙을 가져왔습니다.
  - BRIEF.md 2장의 'AI 티 금지' 목록, StoryScope(arXiv 2604.03136)의 구조 신호
    (주제를 대놓고 설명, 깔끔하게 닫는 결말, 모든 글이 같은 뼈대)를 기사 단위로 옮겼습니다.

등급(humanize-korean 과 같은 기준)
  A: 반드시(S1) 0, 많으면(S2) 2 이하 · B: S1 0, S2 4 이하 · C: S1 1~2 · D: S1 3 이상
  어떤 규칙 하나만으로 'AI가 썼다'고 판정하지 않습니다. 여러 신호가 겹칠 때 손볼 문장을 찾는 도구입니다.

쓰는 법
  python3 _src/humanize/shift_humanize.py scan                  # 기사 전체
  python3 _src/humanize/shift_humanize.py scan --all            # 기사·칼럼·튜토리얼·데일리 이슈
  python3 _src/humanize/shift_humanize.py scan --date 2026-10-29 # 그날 올린 기사만, 고칠 문장 표시
  python3 _src/humanize/shift_humanize.py scan --json out.json  # 결과를 파일로
  python3 _src/humanize/shift_humanize.py export --date D       # 다듬기용 문장 파일 만들기
  python3 _src/humanize/shift_humanize.py apply --date D        # 다듬은 문장을 기사 JSON 에 되돌려 넣기(사실 보존 검사 포함)
"""
from __future__ import annotations

import argparse
import difflib
import glob
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
NEWS = os.path.join(SRC, 'news')
GATE_FROM = '2026-10-29'  # 이 날짜부터 올리는 기사는 assemble.py 가 S1 0건을 요구합니다

# ---------------------------------------------------------------------------
# 글에서 문장 칸 꺼내기
# ---------------------------------------------------------------------------
# role: prose(문장) · list(목록 칸, 명사로 끝나도 됨) · head(소제목) · title(제목·부제)


def news_segments(a):
    seg = [('title', a.get('title'), 'title'), ('sub', a.get('sub'), 'title'),
           ('hook', a.get('hook'), 'prose')]
    if a.get('try'):
        seg.append(('try', a['try'], 'prose'))
    for i, b in enumerate(a.get('body', [])):
        if 'lead' in b:
            seg.append((f'body.{i}.lead', b['lead'], 'prose'))
        if 'p' in b:
            seg.append((f'body.{i}.p', b['p'], 'prose'))
        if 'h' in b:
            seg.append((f'body.{i}.h', b['h'], 'head'))
        for j, x in enumerate(b.get('ul', [])):
            seg.append((f'body.{i}.ul.{j}.0', x[0], 'list'))
            seg.append((f'body.{i}.ul.{j}.1', x[1], 'list'))
    seg.append(('ask', a.get('ask'), 'prose'))
    return [s for s in seg if s[1]]


def column_segments(c):
    seg = [('title', c.get('title'), 'title'), ('sub', c.get('sub'), 'title'), ('deck', c.get('deck'), 'prose')]
    for i, b in enumerate(c.get('body', [])):
        for k in ('lead', 'p'):
            if k in b:
                seg.append((f'body.{i}.{k}', b[k], 'prose'))
        if 'h' in b:
            seg.append((f'body.{i}.h', b['h'], 'head'))
        for j, x in enumerate(b.get('pred', [])):
            seg.append((f'body.{i}.pred.{j}', x, 'list'))
    return [s for s in seg if s[1]]


def tutorial_segments(t):
    seg = [('title', t.get('title'), 'title'), ('deck', t.get('deck'), 'prose'),
           ('why', t.get('why'), 'prose'), ('intro', t.get('intro'), 'prose')]
    for i, it in enumerate(t.get('items', [])):
        seg.append((f'items.{i}.h', it.get('h'), 'head'))
        for k in ('d', 'how'):
            seg.append((f'items.{i}.{k}', it.get(k), 'prose'))
        for j, x in enumerate(it.get('more', []) or []):
            if isinstance(x, str):
                seg.append((f'items.{i}.more.{j}', x, 'prose'))
    for j, x in enumerate(t.get('limits', []) or []):
        seg.append((f'limits.{j}', x, 'prose'))
    for j, x in enumerate((t.get('quick') or {}).get('lines', []) or []):
        seg.append((f'quick.{j}', x, 'list'))
    return [s for s in seg if isinstance(s[1], str) and s[1]]


def daily_segments(d):
    seg = [('title', d.get('title'), 'title'), ('summary', d.get('summary'), 'prose')]
    for j, x in enumerate(d.get('three', [])):
        seg.append((f'three.{j}', x, 'list'))
    return [s for s in seg if s[1]]


def load_docs(kinds=('news',)):
    docs = []
    if 'news' in kinds:
        files = [os.path.join(NEWS, f + '.json') for f in 'ABCE'] + sorted(glob.glob(os.path.join(NEWS, 'daily', '*.json')))
        for f in files:
            for a in json.load(open(f, encoding='utf-8'))['articles']:
                docs.append({'kind': '기사', 'id': a['id'], 'date': a['date'], 'title': a['title'],
                             'file': os.path.relpath(f, SRC), 'seg': news_segments(a), 'obj': a})
    if 'column' in kinds:
        for c in json.load(open(os.path.join(NEWS, 'columns.json'), encoding='utf-8'))['columns']:
            docs.append({'kind': '칼럼', 'id': c['id'], 'date': c['date'], 'title': c['title'],
                         'file': 'news/columns.json', 'seg': column_segments(c), 'obj': c})
    if 'tutorial' in kinds:
        tuts = json.load(open(os.path.join(NEWS, 'D_tutorials.json'), encoding='utf-8'))['tutorials']
        tuts = tuts + [json.load(open(os.path.join(NEWS, 'old_tut.json'), encoding='utf-8'))['cross']]
        for t in tuts:
            docs.append({'kind': '튜토리얼', 'id': t['id'], 'date': t['date'], 'title': t['title'],
                         'file': 'news/D_tutorials.json', 'seg': tutorial_segments(t), 'obj': t})
    if 'daily' in kinds:
        for d in json.load(open(os.path.join(NEWS, 'daily.json'), encoding='utf-8')):
            docs.append({'kind': '데일리', 'id': 'daily-' + d['date'], 'date': d['date'], 'title': d['title'],
                         'file': 'news/daily.json', 'seg': daily_segments(d), 'obj': d})
    return docs


# ---------------------------------------------------------------------------
# 문장 나누기 · 따옴표 가리기
# ---------------------------------------------------------------------------
_QPAIRS = {'‘': '’', '“': '”', '"': '"', '「': '」', '『': '』'}


def mask_quotes(s: str) -> str:
    """따옴표 안(원문 인용·제품 이름)은 검사하지 않도록 같은 길이의 ○ 로 가립니다."""
    out, i = list(s), 0
    while i < len(s):
        ch = s[i]
        if ch in _QPAIRS:
            j = s.find(_QPAIRS[ch], i + 1)
            if j > i and j - i < 300:
                for k in range(i + 1, j):
                    out[k] = '○'
                i = j + 1
                continue
        i += 1
    return ''.join(out)


_SENT_SPLIT = re.compile(r'(?<=[.?!…])\s+(?=\S)')


def sentences(s: str):
    """(시작 위치, 문장) 목록. 따옴표는 가려진 상태로 자릅니다."""
    m = mask_quotes(s)
    res, pos = [], 0
    for part in _SENT_SPLIT.split(m):
        start = m.find(part, pos)
        res.append((start, s[start:start + len(part)], part))
        pos = start + len(part)
    return [r for r in res if r[1].strip()]


def last_eojeol(sent_masked: str) -> str:
    t = re.sub(r'[\s.?!…’”"\')\]]+$', '', sent_masked)
    t = re.sub(r'\([^()]*\)$', '', t).rstrip()  # 끝의 '(자체 발표 기준)' 같은 괄호는 뺍니다
    return t.split()[-1] if t.split() else ''


# ---------------------------------------------------------------------------
# 규칙
# ---------------------------------------------------------------------------
# sev: S1 = 반드시 고침(한 번만 나와도) · S2 = 많으면 고침(min 이상일 때만 걸림)
# scope: prose(문장 칸) · text(문장+목록 칸)
R = []


def rule(id, name, sev, rx, fix, min=1, scope='prose', why=''):
    R.append({'id': id, 'name': name, 'sev': sev, 'rx': re.compile(rx), 'fix': fix, 'min': min, 'scope': scope, 'why': why})


# --- S1: 한 번만 나와도 고칩니다 (humanize-korean S1 · BRIEF 금지 목록) ---
rule('C-8', '"A가 아니라 B" 대구 반복', 'S1', r'(?:[가-힣][이가]|것이|게|건)\s*아니라(?=[,\s])|것은\s*아닙니다|게\s*아닙니다',
     '가장 좋은 한 번만 남기고, 나머지는 B를 바로 말하는 평서문으로 바꿉니다.', min=2,
     why='사람 0.52회 vs AI 6.3회/천 문장(12.1배) — 가장 강한 신호')
rule('D-8', '"핵심은·관건은" 정리 문구', 'S1', r'(?:핵심은|관건은|요점은|주목할\s*(?:점|대목)은|눈여겨볼\s*(?:점|대목)은|중요한\s*건)',
     '"핵심은 X입니다" → "X가 가장 중요합니다"처럼 주어와 서술어를 바로 잇거나, 그냥 X를 말합니다.')
rule('D-2', '의의 부풀리기', 'S1', r'(?:시사하는\s*바|시사합니다|시사점|주목할\s*만(?:합니다|한)|눈여겨볼|의미가\s*(?:큽니다|크다)|의미심장|매우\s*중요합니다|중요한\s*의미를)',
     '의미를 선언하지 말고, 그래서 독자에게 무엇이 바뀌는지 사실로 씁니다.')
rule('I-3b', '"~인 셈입니다"', 'S1', r'셈입니다|셈이(?:죠|다)|인\s*셈',
     '계산이나 비유로 정리하지 말고 사실 문장으로 끝냅니다.')
rule('META', '예고·안내 문장', 'S1', r'(?:짚어|살펴|알아|정리해|들여다)\s*(?:봅니다|보겠습니다|볼까요|보면\s*다음과)',
     '"살펴보겠습니다" 같은 예고 없이 바로 내용으로 들어갑니다.')
rule('D-1', '결산 접속어', 'S1', r'(?:^|[\s.])(?:결론적으로|요약하면|요컨대|종합하면|정리하면|정리하자면|한마디로)(?=[\s,])',
     '결산 표지를 지우고 결론 문장만 남깁니다.')
rule('D-9', '"결국"', 'S1', r'(?:^|\s)결국(?=[\s,])',
     '"결국"을 빼고 원인과 결과를 구체적으로 잇습니다(BRIEF 금지어).')
rule('J-3', '대시(—)로 잇기', 'S1', r'[—–―]',
     '대시 대신 쉼표나 괄호를 쓰거나 두 문장으로 나눕니다.')
rule('COLON', '콜론(:)으로 잇기', 'S1', r'(?<!예)(?<!참고)(?<!주의)(?<![A-Za-z])[가-힣)]\s*:\s+[가-힣]',
     '콜론 대신 서술어로 이어 씁니다. "가격: 월 20달러" → "가격은 월 20달러입니다".')
rule('HYPE', '과장 광고 문구', 'S1', r'(?:혁신적|획기적|게임\s*체인저|판도를\s*(?:바꾸|뒤집|흔)|새로운\s*지평|패러다임|압도적|차원이\s*다른|전례\s*없는|역대급|파격적|대격변|지각\s*변동|혁명적)',
     '형용사로 띄우지 말고 숫자·사례 같은 근거를 씁니다. 근거가 없으면 문구를 뺍니다.')
rule('CHAT', '챗봇 말투 잔재', 'S1', r'(?:물론입니다|좋은\s*질문|도움이\s*되(?:셨|었)으면|도움이\s*되길|추가\s*질문|궁금한\s*점이\s*있으시면|요청하신)',
     '대화창 말투를 지웁니다.')
rule('ODD', '낯선 말', 'S1', r'(?:긴|짧은|30초|요약)\s*판(?![가-힣])|족족',
     "'긴 판'은 '기사 전문', '짧은 판'은 '요약'처럼 흔히 쓰는 말로 바꿉니다.")
rule('A-3', '번역투 "~에 있어(서)·~하는 데 있어"', 'S1', r'데\s*있어(?:서)?\s|에\s*있어서(?:는|도)|에\s*있어서\s+(?:중요|핵심|가장|큰|필요)',
     '"~에서" 또는 "~할 때"로 바꿉니다.')
rule('A-8', '이중 피동', 'S1', r'되어지|되어집니다|되어진|지게\s*됩니다|여지게|보여지',
     '"되어진다" → "된다", "보여진다" → "보인다".')
rule('A-7', '"가지고 있습니다" 직역', 'S1', r'(?:을|를)\s*가지고\s*있(?:습니다|는|다)',
     '"강점을 가지고 있습니다" → "강점이 있습니다".')
rule('D-14', '사람 글에 거의 없는 은유', 'S1', r'잠식|청사진|신호탄|적신호|경고등|뿌리내리|짓누르|움켜쥐|성적표|주춧돌',
     '은유를 사실 문장으로 풉니다("시장을 잠식" → "점유율을 가져감").')
rule('G-2', '완곡 겹치기', 'S1', r'(?:할\s*수\s*있을\s*것으로\s*(?:보|예상|전망)|가능성이\s*있을\s*수|것으로\s*보여질)',
     '완곡 표현을 하나만 남깁니다(확신 정도는 그대로).')

# --- S2: 여러 번 나올 때만 고칩니다 ---
rule('C-11', '연결어미 뒤 쉼표', 'S2', r'(?:하|했|되|됐|있|없|이|았|었|였|겠|않|주|줬|두|봤|썼|받|냈|내|났|들|열|갔|왔|쓰|보)고,|(?:며|지만|면서|아서|어서|해서|여서),',
     '"~했고, ~" 의 쉼표를 지웁니다. 고칠 때 새 쉼표를 만들지 않습니다.', min=3)
rule('D-8b', '"문제는·중요한 것은" 분열문', 'S2', r'(?:^|\s)(?:문제는|중요한\s*것은|필요한\s*것은|답은|변수는)(?=\s)',
     '"문제는 X입니다" → "X가 문제입니다".', min=2)
rule('D-10', '"~하는 이유입니다" 도치', 'S2', r'이유(?:입니다|이기도\s*합니다)\.',
     '순서대로 "그래서 ~합니다"로 씁니다.', min=2)
rule('D-12', '"과제도 남아 있습니다" 문패', 'S2', r'과제도\s*남|한계도\s*(?:분명|있)|아쉬운\s*점도|숙제도\s*남|넘어야\s*할\s*산',
     '문패 문장을 지우고 실제 과제를 첫 문장으로 씁니다.')
rule('D-14b', '기사체 상투 은유', 'S2', r'승부수|출사표|박차를|잰걸음|포문|물꼬|분수령|기폭제|발목을\s*잡|시금석|날개를\s*달|닻을\s*올|불씨|불을\s*지피|판을\s*(?:키우|흔드|짜)|칼을\s*빼|첫발',
     '은유 대신 무슨 일이 일어났는지 그대로 씁니다.', min=2)
rule('A-2', '"~를 통해" 밀집', 'S2', r'(?:을|를)\s*통해|(?:을|를)\s*통한',
     '"~로", "~에서", "~해서"로 바꿉니다(사람도 꽤 쓰는 말이라 3번 넘을 때만).', min=3)
rule('A-9', '"~에 의해" 피동', 'S2', r'에\s*의해|에\s*의한',
     '행위자를 주어로 올립니다("AI에 의해 만들어진" → "AI가 만든").', min=2)
rule('A-10', '"~할 수 있습니다" 반복', 'S2', r'(?:ㄹ|을|할|될|볼|쓸|줄|알|올|갈|살|얻을|받을|만들)\s*수\s*있습니다',
     '일부만 "~하면 됩니다", "~해도 됩니다"처럼 바꿔 리듬을 깹니다. 단정으로 바꾸지는 않습니다.', min=4)
rule('A-20', '"~되고/지고 있습니다" 반복', 'S2', r'(?:되|지)고\s*있습니다',
     '일부는 "~됐습니다", "늘었습니다"처럼 단순 시제로.', min=3)
rule('A-21', '"단순한 X를 넘어 Y"', 'S2', r'단순(?:한|히)\s*[^.?!]{0,25}(?:을|를)\s*넘어|(?:을|를)\s*넘어서?\s',
     '"X만이 아니라 Y도"로 풀거나 넘어-구를 지웁니다.')
rule('A-24', '"더 이상 ~않" 반복', 'S2', r'더\s*이상\s*[^.?!]{0,20}(?:않|없|아닙)',
     '"이제 ~"로 바꾸거나 변화 동사로 씁니다.', min=2)
rule('A-6', '"~을 바탕으로·기반" 반복', 'S2', r'(?:을|를)\s*바탕으로|에\s*기반(?:해|하여|한|을)|기반으로',
     '"~로", "~를 써서"로 바꿉니다.', min=3)
rule('A-19', '이중 조사 "~에서의/으로의"', 'S2', r'(?:에서의|에로의|으로의|에의|으로부터의|과의|와의)\s',
     '조사를 풀어 절로 씁니다("한국에서의 출시" → "한국 출시").', min=2)
rule('A-15', '추상 주어 + "보여 줍니다"', 'S2', r'(?:이번|이는|이것은|이\s*[가-힣]+(?:은|는))[^.?!]{0,40}(?:보여\s*줍니다|보여줍니다|의미합니다|말해\s*줍니다|드러냅니다|예고합니다|방증합니다)',
     '무엇이 무엇을 보여 주는지 말하지 말고 사실을 바로 씁니다.')
rule('G-1', '"~것으로 보입니다" 추측 반복', 'S2', r'(?:것으로|로)\s*(?:보입니다|풀이됩니다|분석됩니다|전망됩니다|관측됩니다|예상됩니다)',
     '유보는 유지하되 종결 형태를 바꿉니다. 근거가 있으면 출처를 붙입니다.', min=2)
rule('H-4', '"즉" 남발', 'S2', r'(?:^|\s)즉(?=[\s,])', '"즉"을 빼거나 한 번만 씁니다.', min=3)
rule('H-1', '문두 접속사 남발', 'S2', r'(?:^|[.?!]\s+)(?:또한|더불어|아울러|나아가|이와\s*함께|한편|이에\s*따라|이를\s*위해)(?=[\s,])',
     '접속사를 빼도 뜻이 통하면 뺍니다.', min=4)
rule('I-7', '막연한 권위·출처 없는 평가', 'S2', r'업계에서는|전문가들은|일각에서는|많은\s*전문가|라는\s*(?:분석|평가|관측|지적)(?:입니다|이\s*나옵니다)',
     '누가 그렇게 말했는지 원문을 붙이거나, 직접 서술로 바꿉니다.')
rule('REPORT', '전달 동사 반복(밝혔습니다·설명했습니다)', 'S2', r'(?:밝혔|설명했|전했|덧붙였|강조했|적었|말했|언급했|소개했)습니다',
     '세 번에 한 번은 전달 동사를 빼고 사실을 주어로 씁니다("애플은 ~라고 밝혔습니다" → "~는 11월에 나옵니다").', min=5)
rule('F-5', '"~적 N" 추상 체인', 'S2', r'(?<![가-힣])(?!목적|지적|실적|흔적|기적|국적|성적|업적|전적|표적|해적|서적|적적)[가-힣]{1,4}적\s+(?:[가-힣]+)',
     '"전략적 함의" → "전략 함의"처럼 줄이거나 풀어 씁니다.', min=3)
rule('HYPE2', '띄우는 형용사(강력한·놀라운·완벽한)', 'S2', r'강력한|놀라운|완벽한|탁월한|폭발적|엄청난',
     '형용사 대신 숫자나 사례로 보여 줍니다.', min=2)
rule('B-x', '흔한 영어 대신 말(인사이트·임팩트)', 'S2', r'인사이트|임팩트|니즈|밸류|어프로치|퍼포먼스|딜리버리',
     '독자가 쓰는 한국어로 바꿉니다.', min=2)
rule('D-11', '결말의 "향후·앞으로"', 'S2', r'(?:^|[.?!]\s+)(?:향후|앞으로(?:는)?|중장기적으로)(?=\s)(?!\s*\d)',
     '시간어를 빼거나 원문에 있는 실제 시점으로 바꿉니다.')

RULES = {r['id']: r for r in R}

TEMPLATE_HEADS = {'무슨 일인가', '세부 내용', '왜 중요한가', '남은 쟁점', '무엇을 해야 하나', '무엇을 봐야 하나', '무엇을 확인해야 하나'}
DEONTIC_END = re.compile(r'(?:해야|야)\s*합니다|필요가\s*있습니다|필요합니다|바람직합니다|편이\s*(?:좋|안전|낫)습니다|좋겠습니다')
MORAL_END = re.compile(r'편이\s*(?:좋|안전|낫)습니다|필요가\s*있습니다|(?:해야|야)\s*합니다|지켜볼\s*(?:일|필요|대목|만)|주목됩니다|관심이\s*쏠|귀추|기대됩니다|분명해졌습니다|보여\s*줍니다|보여줍니다|의미합니다|달려\s*있습니다|남아\s*있습니다|남았습니다|과제입니다|시험대')
OK_END = set('다요까죠니')


def _ctx(text, start, end, pad=28):
    a, b = max(0, start - pad), min(len(text), end + pad)
    return ('…' if a else '') + text[a:b].replace('\n', ' ') + ('…' if b < len(text) else '')


def scan_doc(doc, structural=True):
    """한 편을 점검해 {'S1': n, 'S2': n, 'grade': .., 'findings': [...]} 를 돌려줍니다."""
    findings = []
    prose = [(k, t) for k, t, r in doc['seg'] if r == 'prose']
    text_like = [(k, t) for k, t, r in doc['seg'] if r in ('prose', 'list')]
    heads = [t for k, t, r in doc['seg'] if r == 'head']
    chars = sum(len(re.sub(r'\s', '', t)) for _, t in text_like) or 1

    # 1) 정규식 규칙
    hits = {}
    for r in R:
        pool = prose if r['scope'] == 'prose' else text_like
        hs = []
        for k, t in pool:
            m_t = mask_quotes(t)
            for m in r['rx'].finditer(m_t):
                hs.append({'seg': k, 'match': t[m.start():m.end()].strip(), 'ctx': _ctx(t, m.start(), m.end())})
        hits[r['id']] = hs
    for r in R:
        hs = hits[r['id']]
        if len(hs) < r['min']:
            continue
        if r['id'] == 'C-8':  # 한 번은 살립니다
            n = len(hs) - 1
        elif r['sev'] == 'S1':
            n = len(hs)
        else:
            n = 1
        findings.append({'rule': r['id'], 'name': r['name'], 'sev': r['sev'], 'count': len(hs), 'weight': n,
                         'fix': r['fix'], 'why': r['why'], 'hits': hs})

    # 2) 문장 단위 규칙
    sents = []  # (seg, 원문 문장, 가린 문장)
    for k, t in prose:
        for st, s, sm in sentences(t):
            sents.append((k, s, sm))
    # 명사 조각 문장 (S1)
    frag = []
    for k, s, sm in sents:
        e = last_eojeol(sm)
        tail = re.sub(r'[\s.?!…’”"\')\]]+$', '', re.sub(r'\([^()]*\)\s*[.?!]?$', '', sm.strip()))
        if tail and tail[-1] not in OK_END and re.search(r'[가-힣]$', tail):
            frag.append({'seg': k, 'match': e, 'ctx': s[:120]})
    if frag:
        findings.append({'rule': 'FRAG', 'name': '명사로 끊는 조각 문장', 'sev': 'S1', 'count': len(frag), 'weight': len(frag),
                         'fix': '서술어를 붙여 문장으로 끝냅니다("CVE 2건, 버그 4개." → "결함은 CVE 2건, 버그 4개입니다.").', 'why': 'BRIEF 금지', 'hits': frag})
    # 짧은 단정문 연속 (4개 이상 S1, 3개 S2)
    run, runs = [], []
    for k, s, sm in sents + [(None, '', '')]:
        if k and len(re.sub(r'\s', '', s)) < 22:
            run.append((k, s))
        else:
            if len(run) >= 3:
                runs.append(list(run))
            run = []
    for rr in runs:
        sev = 'S1' if len(rr) >= 4 else 'S2'
        findings.append({'rule': 'SHORT', 'name': f'짧은 단정문 {len(rr)}개 연속', 'sev': sev, 'count': len(rr), 'weight': 1,
                         'fix': '짧은 문장 둘을 이어 한 문장으로 만들어 리듬을 바꿉니다.', 'why': 'BRIEF 금지(탁탁 끊는 리듬)',
                         'hits': [{'seg': rr[0][0], 'match': ' / '.join(s for _, s in rr)[:160], 'ctx': ' '.join(s for _, s in rr)[:200]}]})
    # 같은 종결 4문장 연속 (E-2)
    ends = [(k, s, last_eojeol(sm)[-4:]) for k, s, sm in sents]
    best, cur, cur_start = 1, 1, 0
    best_start = 0
    for i in range(1, len(ends)):
        if ends[i][2] and ends[i][2] == ends[i - 1][2]:
            cur += 1
            if cur > best:
                best, best_start = cur, i - cur + 1
        else:
            cur = 1
    if best >= 4:
        e = ends[best_start]
        findings.append({'rule': 'E-2', 'name': f'같은 끝맺음 {best}문장 연속(…{e[2]})', 'sev': 'S2', 'count': best, 'weight': 1,
                         'fix': '같은 어미가 이어지는 문장 중 하나를 "~이고", "~인데"로 옆 문장과 잇거나 끝맺음을 바꿉니다.', 'why': '',
                         'hits': [{'seg': e[0], 'match': e[2], 'ctx': ' '.join(x[1] for x in ends[best_start:best_start + best])[:220]}]})
    # 장문 부재 (E-1): 문장 10개 이상인데 100자 넘는 문장이 없음
    if len(sents) >= 10:
        long_n = sum(1 for _, s, _ in sents if len(s) >= 100)
        if long_n == 0:
            findings.append({'rule': 'E-1', 'name': '문장 길이가 고름(100자 넘는 문장 없음)', 'sev': 'S2', 'count': len(sents), 'weight': 1,
                             'fix': '문단마다 이웃한 두 문장을 이어 긴 문장 하나를 만듭니다(내용 추가 없이).', 'why': '사람 91.3 vs AI 8.1(천 문장당 장문)', 'hits': []})
    # 당위로 끝나는 문단 2개 이상 (I-4)
    deon = [k for k, t in prose if t and sentences(t) and DEONTIC_END.search(sentences(t)[-1][2])]
    if len(deon) >= 2:
        findings.append({'rule': 'I-4', 'name': f'문단 {len(deon)}개가 "~해야 합니다"로 끝남', 'sev': 'S2', 'count': len(deon), 'weight': 1,
                         'fix': '첫 번째만 두고, 나머지는 당위 문장을 문단 앞이나 중간으로 옮깁니다(뜻은 그대로).', 'why': '3.7배',
                         'hits': [{'seg': k, 'match': '', 'ctx': sentences(dict(prose)[k])[-1][1][:120]} for k in deon]})
    # 영문 병기 반복 (B-1)
    paren = Counter()
    for k, t in text_like:
        for m in re.finditer(r'\(([A-Za-z][A-Za-z0-9 .&+\'-]{1,40})\)', t):
            paren[m.group(1)] += 1
    rep = [(w, n) for w, n in paren.items() if n >= 2]
    if rep:
        findings.append({'rule': 'B-1', 'name': '같은 영문 병기 반복', 'sev': 'S2', 'count': sum(n for _, n in rep), 'weight': 1,
                         'fix': '영문 병기는 처음 한 번만 하고 다음부터 한글만 씁니다.', 'why': 'BRIEF 2장',
                         'hits': [{'seg': '', 'match': f'({w}) ×{n}', 'ctx': ''} for w, n in rep]})

    # 같은 숫자를 4번 넘게 되풀이 (독자를 못 믿고 다시 말하는 습관 — StoryScope)
    numc = Counter()
    for k, t in prose:
        for m in re.finditer(r'\d[\d,.]*\s*(?:%|퍼센트|달러|원|억|곳|개국|명|건|배)(?![가-힣])', mask_quotes(t)):
            numc[re.sub(r'\s', '', m.group(0))] += 1
    rep_n = [(w, n) for w, n in numc.items() if n >= 4]
    if rep_n:
        findings.append({'rule': 'REPEAT', 'name': '같은 숫자를 여러 번 되풀이', 'sev': 'S2', 'count': sum(n for _, n in rep_n), 'weight': 1,
                         'fix': '같은 숫자·사실은 리드와 본문 한 곳 정도로 줄이고, 나머지 자리에는 새 사실을 씁니다(세 줄 요약·facts 칸은 그대로).',
                         'why': 'StoryScope: AI는 독자를 못 믿고 같은 말을 되풀이함',
                         'hits': [{'seg': '', 'match': f'{w} ×{n}', 'ctx': ''} for w, n in rep_n]})

    # 3) 구조 신호 (기사·칼럼)
    if structural and doc['kind'] in ('기사',):
        th = [h for h in heads if h in TEMPLATE_HEADS]
        if len(th) >= 3:
            findings.append({'rule': 'TPL', 'name': f'정해진 소제목 틀 {len(th)}개', 'sev': 'S1', 'count': len(th), 'weight': 1,
                             'fix': '소제목을 그 기사 내용으로 씁니다("왜 중요한가" → "한국어 지원은 아직 일정이 없습니다"). 틀 소제목은 한 기사에 하나까지.',
                             'why': '모든 기사가 같은 뼈대(StoryScope: AI 글은 한 덩어리로 모임)', 'hits': [{'seg': '', 'match': ' / '.join(heads), 'ctx': ''}]})
        last = [(k, t) for k, t in prose if k.startswith('body.')]
        if last:
            ss = sentences(last[-1][1])
            if ss and MORAL_END.search(ss[-1][2]):
                findings.append({'rule': 'MORAL', 'name': '본문 마지막 문장이 교훈·전망 정리', 'sev': 'S2', 'count': 1, 'weight': 1,
                                 'fix': '마지막 문장을 교훈 대신 남은 사실(날짜·조건·아직 모르는 것)로 끝냅니다.',
                                 'why': 'StoryScope: AI는 결말을 깔끔하게 닫고 주제를 대놓고 말함', 'hits': [{'seg': last[-1][0], 'match': '', 'ctx': ss[-1][1][:140]}]})

    s1 = sum(f['weight'] for f in findings if f['sev'] == 'S1')
    s2 = sum(f['weight'] for f in findings if f['sev'] == 'S2')
    grade = 'A' if s1 == 0 and s2 <= 2 else 'B' if s1 == 0 and s2 <= 4 else 'C' if s1 <= 2 else 'D'
    occ = sum(f['count'] for f in findings)
    lens = [len(s) for _, s, _ in sents]
    return {'kind': doc['kind'], 'id': doc['id'], 'date': doc['date'], 'title': doc['title'], 'file': doc['file'],
            'chars': chars, 'sentences': len(sents), 'S1': s1, 'S2': s2, 'grade': grade,
            'per1k': round((3 * s1 + s2) / chars * 1000, 2),
            'avg_sent': round(sum(lens) / len(lens), 1) if lens else 0,
            'long_share': round(sum(1 for x in lens if x >= 100) / len(lens), 3) if lens else 0,
            'findings': findings, 'occurrences': occ}


# ---------------------------------------------------------------------------
# 다듬기용 내보내기 / 되돌려 넣기
# ---------------------------------------------------------------------------
WS = os.path.join(os.path.dirname(SRC), '_workspace', 'humanize')


def _get(obj, key):
    cur = obj
    for p in key.split('.'):
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    return cur


def _set(obj, key, val):
    parts = key.split('.')
    cur = obj
    for p in parts[:-1]:
        cur = cur[int(p)] if isinstance(cur, list) else cur[p]
    last = parts[-1]
    if isinstance(cur, list):
        cur[int(last)] = val
    else:
        cur[last] = val


EDITABLE = ('prose', 'list', 'head')


def export(date):
    path = os.path.join(NEWS, 'daily', f'{date}.json')
    data = json.load(open(path, encoding='utf-8'))
    os.makedirs(os.path.join(WS, date), exist_ok=True)
    out = []
    for a in data['articles']:
        doc = {'kind': '기사', 'id': a['id'], 'date': a['date'], 'title': a['title'], 'file': path, 'seg': news_segments(a)}
        res = scan_doc(doc)
        flagged = {}
        for f in res['findings']:
            for h in f['hits']:
                if h['seg']:
                    flagged.setdefault(h['seg'], set()).add(f['rule'])
        lines = [f'# {a["id"]}  등급 {res["grade"]} (S1 {res["S1"]} · S2 {res["S2"]})',
                 '# 규칙: 한 줄 = 한 칸. [[칸 이름]] 표시는 그대로 두고 그 뒤 문장만 고칩니다. 줄을 지우거나 합치지 않습니다.',
                 '# 숫자·날짜·고유명사·영문·따옴표 안 문장은 한 글자도 바꾸지 않습니다. 걸린 규칙은 ## 줄에 적혀 있습니다.', '']
        for k, t, role in doc['seg']:
            if role not in EDITABLE:
                continue
            if k in flagged:
                lines.append('## ' + ', '.join(f'{r} {RULES[r]["name"] if r in RULES else ""}'.strip() for r in sorted(flagged[k])))
            lines.append(f'[[{k}]] {t}')
        if any(f['rule'] == 'TPL' for f in res['findings']):
            lines.insert(3, '## TPL 정해진 소제목 틀 — body.N.h 줄의 소제목을 그 기사 내용으로 바꿉니다')
        before = os.path.join(WS, date, f'{a["id"]}.before.txt')
        open(before, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        after = os.path.join(WS, date, f'{a["id"]}.after.txt')
        if not os.path.exists(after):
            open(after, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
        out.append((a['id'], res['grade'], res['S1'], res['S2'], after))
    for x in out:
        print(f'{x[0]}  등급 {x[1]} (S1 {x[2]} · S2 {x[3]})  → 고칠 파일 {os.path.relpath(x[4], os.path.dirname(SRC))}')
    return out


_NUM = re.compile(r'\d[\d,.]*')
_LAT = re.compile(r'[A-Za-z][A-Za-z0-9.+\-_/]*[A-Za-z0-9]|[A-Za-z]')
_QUO = re.compile(r'[‘“"「『][^’”"」』]{1,200}[’”"」』]')
VG = os.path.join(HERE, 'vendor', 'im-not-ai', 'scripts', 'verify_gates.py')


def keep_sets(texts):
    """기사 전체에서 숫자·영문·따옴표 인용을 모읍니다(같은 것이 몇 번 나오는지는 보지 않습니다)."""
    j = '\n'.join(texts)
    nums = {re.sub(r'[,]', '', m.group(0)).rstrip('.') for m in _NUM.finditer(j)}
    lat = {m.group(0) for m in _LAT.finditer(j)}
    quo = {m.group(0)[1:-1].strip() for m in _QUO.finditer(j)}
    return nums, lat, quo


def _read_lines(p):
    segs = {}
    for line in open(p, encoding='utf-8'):
        m = re.match(r'\[\[([^\]]+)\]\]\s?(.*)$', line.rstrip('\n'))
        if m:
            segs[m.group(1)] = m.group(2).strip()
    return segs


def _prose_text(segs):
    # 소제목(.h)은 일부러 바꾸는 칸이라 verify_gates 의 '제목 보존' 검사에서 뺍니다
    return '\n\n'.join(t for k, t in segs.items() if not k.endswith('.h'))


def verify_gates(before_txt, after_txt, workdir):
    """humanize-korean 의 verify_gates.py(문자율·대구·수치·서법 5축)를 기사 하나에 돌립니다."""
    if not os.path.exists(VG):
        return None
    import subprocess
    b, a = os.path.join(workdir, '_vg_before.txt'), os.path.join(workdir, '_vg_after.txt')
    open(b, 'w', encoding='utf-8').write(before_txt)
    open(a, 'w', encoding='utf-8').write(after_txt)
    r = subprocess.run([sys.executable, '-I', VG, '--before', b, '--after', a, '--genre', 'report', '--json'],
                       capture_output=True, text=True, encoding='utf-8')
    txt = r.stdout
    try:
        js = json.loads(txt[txt.index('{'):])
    except ValueError:
        return {'exit': r.returncode, 'raw': (txt or r.stderr)[-400:]}
    js['exit'] = r.returncode
    return js


def apply(date, dry=False):
    """after.txt 를 기사 JSON 에 넣습니다. 사실 보존·변경률·습니다체·의미 게이트를 통과한 기사만 반영합니다."""
    path = os.path.join(NEWS, 'daily', f'{date}.json')
    data = json.load(open(path, encoding='utf-8'))
    report, ok_all = [], True
    sys.path.insert(0, SRC)
    try:
        from assemble import plain_endings
    except Exception:
        plain_endings = None
    for a in data['articles']:
        bp = os.path.join(WS, date, f'{a["id"]}.before.txt')
        ap = os.path.join(WS, date, f'{a["id"]}.after.txt')
        if not os.path.exists(ap) or not os.path.exists(bp):
            report.append(f'{a["id"]}: before/after 파일 없음 — 먼저 export 를 돌립니다')
            ok_all = False
            continue
        before, after = _read_lines(bp), _read_lines(ap)
        errs, warns = [], []
        if set(before) != set(after):
            errs.append(f'칸이 달라졌습니다(줄을 지우거나 합치지 마세요): 빠짐 {sorted(set(before) - set(after))[:3]} / 생김 {sorted(set(after) - set(before))[:3]}')
        for k in before:
            if k in after and not after[k]:
                errs.append(f'{k}: 빈 칸')
        nb, lb, qb = keep_sets(before.values())
        na, la, qa = keep_sets(after.values())
        if nb - na:
            errs.append(f'숫자가 사라졌습니다: {sorted(nb - na)[:6]}')
        if na - nb:
            errs.append(f'원문에 없던 숫자가 생겼습니다: {sorted(na - nb)[:6]}')
        if lb - la:
            errs.append(f'영문·이름이 사라졌습니다: {sorted(lb - la)[:6]}')
        if la - lb:
            errs.append(f'원문에 없던 영문이 생겼습니다: {sorted(la - lb)[:6]}')
        if qb - qa:
            errs.append(f'따옴표 안 문장이 바뀌었습니다: {[q[:30] for q in sorted(qb - qa)][:3]}')
        tot_b = sum(len(x) for x in before.values()) or 1
        tot_changed = sum(int(round(len(before[k]) * (1 - difflib.SequenceMatcher(None, before[k], after.get(k, '')).ratio())))
                          for k in before if before[k] != after.get(k, before[k]))
        rate = tot_changed / tot_b
        if rate >= 0.5:
            errs.append(f'변경률 {rate:.0%} — 50% 이상은 과윤문이라 반영하지 않습니다')
        if plain_endings:
            plain = [s for k, x in after.items() if not k.endswith('.h') and '.ul.' not in k and k not in ('title', 'sub') for s in plain_endings(x)]
            if plain:
                errs.append(f'한다체 문장 끝(습니다체로): {plain[:2]}')
        vg = verify_gates(_prose_text(before), _prose_text(after), os.path.join(WS, date))
        if vg:
            if vg.get('exit') == 2:
                errs.append('verify_gates: 문자율 50% 이상(중단)')
            if vg.get('golden'):
                errs.append(f"verify_gates golden: {vg['golden'][:3]}")
            lost = (vg.get('modality') or {}).get('lost_pairs') or []
            if lost:
                warns.append(f'서법이 바뀐 문장 {len(lost)}개(당위·추측이 단정으로) — 원래 강도로 되돌리기: {str(lost[0])[:120]}')
        new = json.loads(json.dumps(a, ensure_ascii=False))
        for k, x in after.items():
            if k in before:
                _set(new, k, x)
        res_b = scan_doc({'kind': '기사', 'id': a['id'], 'date': a['date'], 'title': a['title'], 'file': path, 'seg': news_segments(a)})
        res_a = scan_doc({'kind': '기사', 'id': a['id'], 'date': a['date'], 'title': new['title'], 'file': path, 'seg': news_segments(new)})
        line = f'{a["id"]}: 등급 {res_b["grade"]}→{res_a["grade"]} (S1 {res_b["S1"]}→{res_a["S1"]} · S2 {res_b["S2"]}→{res_a["S2"]}) 변경률 {rate:.0%}'
        if vg and vg.get('change_rate'):
            line += f" · verify_gates {vg['gate']['verdict'] if vg.get('gate') else ''}"
        if rate >= 0.3:
            warns.append('변경률 30% 넘음: 뜻이 바뀐 곳이 없는지 다시 읽어 보세요')
        c11 = RULES['C-11']['rx']
        cb = sum(len(c11.findall(mask_quotes(x))) for x in before.values())
        ca = sum(len(c11.findall(mask_quotes(x))) for x in after.values())
        if ca > cb:
            warns.append(f'연결어미 뒤 쉼표가 늘었습니다({cb}→{ca}) — 고친 문장에서 새 쉼표를 지우세요')
        if errs:
            ok_all = False
            report.append(line + '\n   반영 안 함:\n   - ' + '\n   - '.join(errs[:8]))
            continue
        if res_a['S1']:
            left = [f"{f['rule']} {f['name']}: {f['hits'][0]['ctx'][:60] if f['hits'] else ''}" for f in res_a['findings'] if f['sev'] == 'S1']
            line += '\n   아직 남은 S1(고쳐서 다시 apply): ' + ' | '.join(left[:5])
            ok_all = False
        for w in warns:
            line += '\n   경고: ' + w
        if not dry:
            a.clear()
            a.update(new)
        report.append(line)
    if not dry:
        open(path, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=1))
    print('\n'.join(report))
    print('결과:', '통과' if ok_all else '고칠 것이 남았습니다')
    return ok_all


# ---------------------------------------------------------------------------
# 출력
# ---------------------------------------------------------------------------

def print_report(results, detail=False):
    g = Counter(r['grade'] for r in results)
    print(f"점검 {len(results)}편 · 등급 A {g['A']} / B {g['B']} / C {g['C']} / D {g['D']}")
    for r in sorted(results, key=lambda r: (-r['S1'], -r['S2'], r['id'])):
        print(f"[{r['grade']}] S1 {r['S1']:>2} · S2 {r['S2']:>2}  {r['kind']} {r['id']}  {r['title'][:40]}")
        if detail:
            for f in r['findings']:
                print(f"   - {f['sev']} {f['rule']} {f['name']} ×{f['count']}: {f['fix']}")
                for h in f['hits'][:4]:
                    if h.get('ctx'):
                        print(f"       · [{h['seg']}] {h['ctx']}")


def gate(date_from=GATE_FROM):
    """assemble.py 에서 부릅니다. date_from 이후 기사의 S1 목록을 돌려줍니다."""
    bad = []
    for d in load_docs(('news',)):
        if d['date'] < date_from:
            continue
        r = scan_doc(d)
        for f in r['findings']:
            if f['sev'] == 'S1':
                ex = f['hits'][0]['ctx'][:70] if f['hits'] else ''
                bad.append(f"{d['id']} · {f['rule']} {f['name']} ×{f['count']} · 예: {ex}")
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser(description='SHIFT AI 한국어 AI 티 점검기')
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('scan')
    s.add_argument('--all', action='store_true', help='기사·칼럼·튜토리얼·데일리 이슈 모두')
    s.add_argument('--date', help='이 날짜(date) 기사만, 고칠 문장까지 표시')
    s.add_argument('--from', dest='dfrom', help='이 날짜 이후 기사만')
    s.add_argument('--json', help='결과 JSON 저장 경로')
    s.add_argument('--detail', action='store_true')
    e = sub.add_parser('export')
    e.add_argument('--date', required=True)
    p = sub.add_parser('apply')
    p.add_argument('--date', required=True)
    p.add_argument('--dry', action='store_true')
    g = sub.add_parser('gate')
    g.add_argument('--from', dest='dfrom', default=GATE_FROM)
    a = ap.parse_args(argv)
    if a.cmd == 'scan':
        docs = load_docs(('news', 'column', 'tutorial', 'daily') if a.all else ('news',))
        if a.date:
            docs = [d for d in docs if d['date'] == a.date]
        if a.dfrom:
            docs = [d for d in docs if d['date'] >= a.dfrom]
        res = [scan_doc(d) for d in docs]
        if a.json:
            json.dump(res, open(a.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print_report(res, detail=a.detail or bool(a.date))
        return 0
    if a.cmd == 'export':
        export(a.date)
        return 0
    if a.cmd == 'apply':
        return 0 if apply(a.date, dry=a.dry) else 1
    if a.cmd == 'gate':
        bad = gate(a.dfrom)
        print('\n'.join(bad) if bad else 'S1 0건')
        return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())

import json, re, os, sys
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
N = SRC + 'news/'
arts = [a for f in 'ABCE' for a in json.load(open(N + f + '.json'))['articles']]
byid = {a['id']: a for a in arts}

# ---- 실제 사진 배정 ----
PH = {
 '2026-10-21-php2shell': ('img/ph/php2shell.webp', '이미지: Wiz Research'),
 '2026-10-21-chatgpt-ads-89-countries': ('img/ph/chatgpt-ads.webp', '이미지: OpenAI'),
 '2026-10-22-canva-craft': ('img/ph/canva-craft.webp', '이미지: Canva'),
 '2026-10-22-cerebras-trillion-deploy': ('img/ph/cerebras.webp', '이미지: Cerebras'),
 '2026-10-19-tinyfish-students': ('img/ph/tinyfish-students.webp', '화면: tinyfish.ai/students'),
 '2026-10-26-text-message-ai-assistants': ('img/ph/martin.webp', '화면: trymartin.com'),
 # 10/26 원문 공식 이미지·화면 캡처로 교체
 '2026-10-23-aisi-mythos5-alignment': ('img/ph/aisi.webp', '이미지: 영국 AI 보안연구소(AISI)'),
 '2026-10-23-openai-offline-training': ('img/ph/openai-offline.webp', '이미지: OpenAI'),
 '2026-10-19-whatsapp-hidden-ai-instructions': ('img/ph/whatsapp-redact.webp', '화면: redact.dev — 개인정보처리방침과 숨은 지시문 비교표'),
 '2026-10-22-pennsylvania-ai-ad-disclosure': ('img/ph/pa-capitol.webp', '사진: 펜실베이니아 주의회 웹사이트(palegis.us)'),
 '2026-10-16-google-privacy-personal-intelligence': ('img/ph/google-privacy.webp', '화면: 구글 개인정보처리방침(policies.google.com), 2026년 10월 16일 시행본'),
 '2026-10-09-nikon-small-world-in-motion-ai': ('img/ph/nikon-statement.webp', '화면: nikonsmallworld.com 입장문'),
 '2026-10-24-kimi-k3-1-pro': ('img/ph/kimi.webp', '이미지: 문샷AI(Kimi)'),
 '2026-10-07-claude-haiku-5-5': ('img/ph/haiku.webp', '이미지: Anthropic'),
 '2026-10-23-oracle-partner-1b': ('img/ph/oracle.webp', '이미지: Oracle'),
 '2026-10-24-apollo-no-ai-payoff': ('img/ph/apollo-margin.webp', '그래프: Apollo, The Daily Spark(10월 24일) — 이익률, S&P 493 대 매그니피센트 7'),
 '2026-09-27-apricitas-creative-class-jobs': ('img/ph/apricitas.webp', '그래프: Apricitas Economics(조지프 폴리타노, 미 노동통계국 자료)'),
 '2026-10-19-openai-low-resource-languages': ('img/ph/openai-lowres.webp', '이미지: OpenAI'),
 '2026-10-21-why-ai-text-hard-to-read': ('img/ph/arxiv-aitext.webp', '그림: 논문 그림 3(a) — 대화·코딩·에세이별 언어 특징 변화 (arXiv 2610.29162)'),
 '2026-10-25-old-cnn-beats-llm-skin-cancer': ('img/ph/lynchlab.webp', '화면: lynchlab.net 원문'),
 '2026-10-05-mit-machine-playing-island': ('img/ph/mit-tower.webp', '그림: 논문 그림 8 — 에이전트들이 처음 쌓은 높은 탑 (arXiv 2610.07130)'),
 '2026-10-15-deepmind-gemini-agents-beat-minecraft': ('img/ph/minecraft-portal.webp', '이미지: 논문 그림 9 — 12개 눈을 모두 끼운 엔드 포털, 게임 화면 렌더링 (arXiv 2610.22319)'),
 '2026-10-15-konami-hayakawa-ai-games': ('img/ph/konami-report.webp', '이미지: 코나미그룹 2026 통합보고서 표지'),
 '2026-10-19-paris-city-tours-ai-satire': ('img/ph/paris-night.webp', '자료 사진 · Benh LIEU SONG, Wikimedia Commons (CC BY-SA 4.0) — 영상 속 장면이 아님'),
 '2026-10-19-naver-cloud-security-self-check': ('img/ph/naver-cloud.webp', '이미지: 네이버클라우드'),
 '2026-10-20-mistral-voxtral-3': ('img/ph/voxtral.webp', '이미지: Mistral AI'),
 '2026-10-21-openai-models-google-cloud': ('img/ph/openai-gcloud.webp', '이미지: OpenAI'),
 '2026-10-21-naver-d2sf-traceweave': ('img/ph/d2sf.webp', '이미지: 네이버 D2SF'),
 '2026-10-22-anthropic-agent-skills-aaif': ('img/ph/anthropic-skills.webp', '이미지: Anthropic'),
 '2026-10-22-openai-decisions-api': ('img/ph/openai-decisions.webp', '이미지: OpenAI'),
 '2026-10-22-skt-ax-k2-math': ('img/ph/skt.webp', '사진: SK텔레콤'),
 '2026-10-21-nodejs-security-release': ('img/ph/nodejs.webp', '이미지: Node.js'),
}
INLINE = {
 '2026-10-21-php2shell': ('세부 내용', {'src': 'img/ph/wiz-blog.webp', 'credit': '화면: wiz.io 블로그 PHP2Shell 공개 글', 'alt': '위즈 블로그 PHP2Shell 글 화면'}),
 '2026-10-19-tinyfish-students': ('누가 받을 수 있나', {'src': 'img/ph/tinyfish-how.webp', 'credit': '화면: tinyfish.ai/students — 참여 방법(Claim · Build · Submit · Earn)', 'alt': '타이니피시 참여 방법 화면'}),
 '2026-10-24-apollo-no-ai-payoff': ('세부 내용', {'src': 'img/ph/apollo-revenue.webp', 'credit': '그래프: Apollo, The Daily Spark(10월 24일) — 직원 1인당 매출, S&P 493 대 매그니피센트 7', 'alt': '직원 1인당 매출 추이 그래프'}),
 '2026-10-15-deepmind-gemini-agents-beat-minecraft': ('세부 내용', {'src': 'img/ph/minecraft-aerial.webp', 'credit': '이미지: 논문 수록 오버월드 항공 렌더링 (arXiv 2610.22319)', 'alt': '에이전트들이 플레이한 마인크래프트 월드 항공 화면'}),
 '2026-10-05-mit-machine-playing-island': ('세부 내용', {'src': 'img/ph/mit-spire.webp', 'credit': '그림: 논문 그림 7 — 에이전트들이 처음 첨탑에 오른 순간 (arXiv 2610.07130)', 'alt': '에이전트별 첫 첨탑 등반 장면'}),
}
WHO = {
 '2026-09-27-apricitas-creative-class-jobs': '어프리시타스 이코노믹스', '2026-10-05-mit-machine-playing-island': 'MIT 연구진',
 '2026-10-07-claude-haiku-5-5': '앤트로픽', '2026-10-09-nikon-small-world-in-motion-ai': '니콘 스몰 월드',
 '2026-10-15-deepmind-gemini-agents-beat-minecraft': '구글 딥마인드', '2026-10-15-konami-hayakawa-ai-games': '코나미',
 '2026-10-16-google-privacy-personal-intelligence': '구글', '2026-10-19-whatsapp-hidden-ai-instructions': '리댁트 × 왓츠앱',
 '2026-10-19-paris-city-tours-ai-satire': '비체 쿠체', '2026-10-19-openai-low-resource-languages': '오픈AI',
 '2026-10-19-naver-cloud-security-self-check': '네이버클라우드', '2026-10-20-mistral-voxtral-3': '미스트랄AI',
 '2026-10-21-nodejs-security-release': 'Node.js', '2026-10-21-why-ai-text-hard-to-read': 'NYU · UT 오스틴',
 '2026-10-21-openai-models-google-cloud': '오픈AI × 구글 클라우드', '2026-10-21-naver-d2sf-traceweave': '네이버 D2SF',
 '2026-10-22-pennsylvania-ai-ad-disclosure': '펜실베이니아주', '2026-10-22-anthropic-agent-skills-aaif': '앤트로픽',
 '2026-10-22-openai-decisions-api': '오픈AI', '2026-10-22-skt-ax-k2-math': 'SK텔레콤',
 '2026-10-23-aisi-mythos5-alignment': '영국 AISI · 앤트로픽', '2026-10-23-openai-offline-training': '오픈AI',
 '2026-10-23-oracle-partner-1b': '오라클', '2026-10-24-kimi-k3-1-pro': '문샷AI',
 '2026-10-24-apollo-no-ai-payoff': '아폴로', '2026-10-25-old-cnn-beats-llm-skin-cancer': '린치 랩',
}
THREAD = {'2026-10-23-aisi-mythos5-alignment': 'https://www.threads.com/@shift_ai_magazine/post/De6dSdwFvVJ',
          '2026-10-24-kimi-k3-1-pro': 'https://www.threads.com/@shift_ai_magazine/post/De6zCJdkcvt'}

dom = lambda u: re.sub(r'^https?://(www\.)?', '', u).split('/')[0]
covers, want, out = [], [], []
for a in arts:
    a = dict(a)
    verify = a.pop('verify', None)
    img = a.pop('image', None) or {}
    want.append({'id': a['id'], 'page': img.get('page'), 'og': img.get('og'), 'alt': img.get('alt')})
    if a['id'] in PH:
        src, cr = PH[a['id']]; a['image'] = {'src': src, 'credit': cr, 'alt': img.get('alt') or ''}
    else:
        a['image'] = {'src': f"img/nc/{a['id']}.webp", 'credit': '', 'alt': a['title'], 'temp': True}
        covers.append({'id': a['id'], 'cat': a['cat'], 'who': WHO[a['id']], 'title': a['title'], 'src': dom(a['sources'][0][1])})
    if a['id'] in INLINE:
        after, fig = INLINE[a['id']]; body = []; done = False
        for k, x in enumerate(a['body']):
            body.append(x)
            if not done and x.get('h') == after:
                # 소제목 다음 첫 문단 뒤에 넣기
                pass
        # 소제목 뒤 첫 p 다음에 삽입
        nb = []; flag = False; ins = False
        for x in a['body']:
            nb.append(x)
            if x.get('h') == after: flag = True; continue
            if flag and not ins and 'p' in x: nb.append({'img': fig}); ins = True
        if not ins: nb.append({'img': fig})
        a['body'] = nb
    if a['id'] in THREAD: a['thread'] = THREAD[a['id']]
    if a['id'] == '2026-10-21-php2shell': a['featured'] = True
    out.append(a)
assert len(WHO) + len(PH) >= len(arts)

DAILY = [
 {'date': '2026-10-26', 'lead': '2026-10-24-kimi-k3-1-pro',
  'title': '주말 사이 AI: 오픈 웨이트는 상용 모델 턱밑까지, 성과는 아직 빅테크에만',
  'summary': '토요일부터 월요일 아침까지 나온 소식 4건을 묶었다.',
  'three': ['문샷AI 키미 K3.1 프로, 터미널 코딩 65.7%로 오퍼스 5.5(66.4%)와 0.7%포인트 차(자체 발표 기준)',
            '아폴로 슬록 "AI 성과, 매그7 밖에서는 아직 숫자로 안 보인다"',
            '20분 학습한 10년 된 CNN, 피부 병변 분류 62%로 범용 LLM(42%) 앞서'],
  'items': ['2026-10-24-kimi-k3-1-pro', '2026-10-24-apollo-no-ai-payoff', '2026-10-25-old-cnn-beats-llm-skin-cancer', '2026-10-26-text-message-ai-assistants']},
 {'date': '2026-10-23', 'lead': '2026-10-23-aisi-mythos5-alignment',
  'title': 'AI에게 연습 경기는 없다: 영국 AISI 보고서와 오픈AI의 인터넷 차단',
  'summary': '같은 날 나온 두 안전 발표가 같은 결론을 가리켰다.',
  'three': ['영국 AISI·앤트로픽, 평가 중 실제 개발자를 겨냥한 클로드 미토스 5 사고 분석 공개',
            '오픈AI, 프런티어 모델 훈련에서 실시간 인터넷 접속을 막고 색인된 "오프라인 월드"로',
            '오라클, 파트너 생태계에 4년간 10억 달러 투자'],
  'items': ['2026-10-23-aisi-mythos5-alignment', '2026-10-23-openai-offline-training', '2026-10-23-oracle-partner-1b']},
 {'date': '2026-10-22', 'lead': '2026-10-22-canva-craft',
  'title': 'AI 광고에 표시 의무, 캔바는 자체 이미지 모델',
  'summary': '법, 도구, 표준, API까지 하루에 여섯 건.',
  'three': ['펜실베이니아, 소비자를 속이는 AI 합성 광고에 표시 의무화(위반당 최대 3,000달러)',
            '캔바, 구도와 글자부터 설계하는 첫 자체 이미지 모델 "크래프트" 공개',
            '앤트로픽, "에이전트 스킬" 표준을 리눅스재단 산하 AAIF에 기부'],
  'items': ['2026-10-22-pennsylvania-ai-ad-disclosure', '2026-10-22-canva-craft', '2026-10-22-anthropic-agent-skills-aaif', '2026-10-22-openai-decisions-api', '2026-10-22-skt-ax-k2-math', '2026-10-22-cerebras-trillion-deploy']},
 {'date': '2026-10-21', 'lead': '2026-10-21-php2shell',
  'title': 'AI가 찾은 구멍들: PHP와 Node.js가 같은 날 보안 패치',
  'summary': '보안 공지 두 건과 광고·클라우드·연구 소식까지 여섯 건.',
  'three': ['위즈, AI로 찾은 PHP 엔진 원격 코드 실행 결함 "PHP2Shell" 공개(CVSS 최고 9.2)',
            'Node.js 취약점 10건 패치, 고위험 1건은 오픈AI 코덱스 시큐리티가 보고',
            '챗GPT 광고 26개국 추가해 89개국, 광고주 10만 곳 돌파(자체 발표 기준)'],
  'items': ['2026-10-21-php2shell', '2026-10-21-nodejs-security-release', '2026-10-21-chatgpt-ads-89-countries', '2026-10-21-openai-models-google-cloud', '2026-10-21-why-ai-text-hard-to-read', '2026-10-21-naver-d2sf-traceweave']},
 {'date': '2026-10-20', 'lead': '2026-10-20-mistral-voxtral-3',
  'title': '목소리 AI 한 묶음, 그리고 지난주 놓친 세 가지',
  'summary': '화요일 소식 1건에 지난주 후반 소식 3건을 더했다.',
  'three': ['미스트랄 "복스트랄 3": 전사 50개 언어, 분당 0.0035달러부터',
            '구글 개인정보처리방침 개정: 퍼스널 인텔리전스를 켜면 지메일 데이터도 광고 맞춤에 쓰일 수 있다',
            '딥마인드 제미나이 4 에이전트 넷, 27시간 14분 만에 마인크래프트 엔딩'],
  'items': ['2026-10-20-mistral-voxtral-3', '2026-10-16-google-privacy-personal-intelligence', '2026-10-15-deepmind-gemini-agents-beat-minecraft', '2026-10-15-konami-hayakawa-ai-games']},
 {'date': '2026-10-19', 'lead': '2026-10-19-whatsapp-hidden-ai-instructions',
  'title': '회사 AI 상담원에게 숨겨 둔 지시 102개',
  'summary': '고객센터 AI, 저자원 언어 코딩, 국내 보안 진단까지 다섯 건.',
  'three': ['리댁트, 왓츠앱 도움말 80개 페이지에서 AI용 숨은 지시 102개 발견…공개 직후 삭제',
            '오픈AI, 코볼·포트란 같은 저자원 언어 코딩 성적 공개(20개 언어 평균 87.4%, 자체 발표 기준)',
            '네이버클라우드, "AI 활용 환경 보안" 영역을 넣은 무료 보안 자가진단 공개'],
  'items': ['2026-10-19-whatsapp-hidden-ai-instructions', '2026-10-19-openai-low-resource-languages', '2026-10-19-naver-cloud-security-self-check', '2026-10-19-tinyfish-students', '2026-10-19-paris-city-tours-ai-satire']},
]
for d in DAILY:
    for i in d['items']: assert i in byid, i

TERMS = [
 {"t":"에이전트","en":"Agent","i":"ㅇ","d":"목표 하나를 주면 스스로 계획을 세우고 검색·코딩·파일 작업 같은 도구를 번갈아 쓰며 끝까지 처리하는 AI. 계정·배포 권한을 줄 때는 사람 승인 단계를 남겨야 한다.","rel":"2026-10-23-aisi-mythos5-alignment"},
 {"t":"정렬","en":"Alignment","i":"ㅈ","d":"AI가 사람이 바라는 대로 행동하게 맞추는 일. 평가 중 '이건 시뮬레이션'이라고 스스로 판단하고 실제 사람을 공격한 사례가 정렬 실패로 분석됐다.","rel":"2026-10-23-aisi-mythos5-alignment"},
 {"t":"토큰","en":"Token","i":"ㅌ","d":"AI가 글을 읽고 쓰는 최소 단위. API 요금은 보통 '100만 토큰당 얼마'로 매긴다.","rel":"2026-10-07-claude-haiku-5-5"},
 {"t":"추론 비용","en":"Inference cost","i":"ㅊ","d":"만들어진 모델을 실제로 돌려 답을 받는 데 드는 돈. 학습 비용과 달리 쓸 때마다 나간다. 작은 모델과 캐시가 이 비용을 줄이는 주된 방법이다.","rel":"2026-10-07-claude-haiku-5-5"},
 {"t":"오픈 웨이트","en":"Open weight","i":"ㅇ","d":"학습이 끝난 모델의 가중치를 누구나 내려받아 쓸 수 있게 공개한 것. 학습 데이터와 코드까지 다 여는 오픈소스와는 구분한다.","rel":"2026-10-24-kimi-k3-1-pro"},
 {"t":"벤치마크","en":"Benchmark","i":"ㅂ","d":"모델 성능을 같은 조건으로 재는 시험. 회사가 직접 잰 점수는 '자체 발표 기준'이고, 독립 기관이 잰 점수와 다를 수 있다.","rel":"2026-10-24-kimi-k3-1-pro"},
 {"t":"오픈소스","en":"Open source","i":"ㅇ","d":"소프트웨어 코드를 공개해 누구나 보고 고치고 나눌 수 있게 한 것. 큰 오픈소스 프로젝트는 보안 공지와 패치도 공개적으로 낸다.","rel":"2026-10-21-nodejs-security-release"},
 {"t":"취약점","en":"Vulnerability","i":"ㅊ","d":"소프트웨어의 보안 구멍. 로그인 없이 서버에서 명령을 실행하게 해 주는 원격 코드 실행(RCE)이 가장 위험한 축이다.","rel":"2026-10-21-php2shell"},
 {"t":"CVE·CVSS","en":"CVE · CVSS","i":"C","d":"CVE는 공개된 취약점에 붙는 고유 번호, CVSS는 위험도를 0~10으로 매긴 점수다. 9점 이상이면 '치명적'으로 본다.","rel":"2026-10-21-php2shell"},
 {"t":"학습 데이터","en":"Training data","i":"ㅎ","d":"AI 모델을 만들 때 읽히는 글·그림·코드 뭉치. 어디서 가져왔는지, 학습 중 외부와 연결되는지가 안전과 저작권 문제로 이어진다.","rel":"2026-10-23-openai-offline-training"},
 {"t":"데이터센터","en":"Data center","i":"ㄷ","d":"AI 모델이 실제로 돌아가는 서버 건물. 큰 모델은 칩 여러 장에 나눠 실어야 해서 칩 사이 통신 속도가 성능을 좌우한다.","rel":"2026-10-22-cerebras-trillion-deploy"},
 {"t":"AI 표시","en":"AI label","i":"A","d":"AI가 만들거나 고친 콘텐츠에 붙이는 표시. 이미지·영상·광고부터 의무화가 시작됐고, 글은 기준이 아직 갈린다.","rel":"2026-10-22-pennsylvania-ai-ad-disclosure"},
 {"t":"광고 타깃팅","en":"Ad targeting","i":"ㄱ","d":"이용자 정보를 바탕으로 광고를 골라 보여 주는 일. 어떤 데이터가 쓰이는지는 개인정보처리방침에 적혀 있다.","rel":"2026-10-16-google-privacy-personal-intelligence"},
 {"t":"환각","en":"Hallucination","i":"ㅎ","d":"AI가 그럴듯하지만 틀린 내용을 사실처럼 말하는 현상. 숫자·날짜·출처를 원문으로 확인하는 것이 기본 대책이다.","rel":"2026-10-24-kimi-k3-1-pro"},
 {"t":"컨텍스트 윈도우","en":"Context window","i":"ㅋ","d":"AI가 한 번에 읽을 수 있는 분량. 토큰으로 센다. 길게 넣을수록 단가가 오르는 요금제도 있다.","rel":"2026-10-07-claude-haiku-5-5"},
 {"t":"추론 모델","en":"Reasoning model","i":"ㅊ","d":"답하기 전에 생각 과정을 길게 거치는 모델. 수학·코딩처럼 단계가 많은 문제에 강하지만 느리고 비싸다.","rel":"2026-10-22-skt-ax-k2-math"},
 {"t":"파인튜닝","en":"Fine-tuning","i":"ㅍ","d":"만들어진 모델에 특정 데이터를 더 학습시켜 한 분야에 맞추는 일. 좁은 분야에서는 작은 모델을 파인튜닝하는 쪽이 더 정확할 때가 있다.","rel":"2026-10-25-old-cnn-beats-llm-skin-cancer"},
 {"t":"MCP","en":"Model Context Protocol","i":"M","d":"AI가 드라이브·메일·디자인 툴 같은 바깥 앱에 접속할 때 쓰는 공통 규격.","rel":"2026-10-22-anthropic-agent-skills-aaif"},
 {"t":"스킬","en":"Skill","i":"ㅅ","d":"AI 에이전트에게 '이런 일은 이렇게 해'라고 적어 둔 작업 설명서 묶음. 앤트로픽이 표준으로 공개했다.","rel":"2026-10-22-anthropic-agent-skills-aaif"},
 {"t":"음성 합성","en":"Text-to-speech","i":"ㅇ","d":"글을 사람 목소리로 읽어 주는 기술(TTS). 받아쓰기(전사)와 묶어 음성 에이전트를 만든다.","rel":"2026-10-20-mistral-voxtral-3"},
 {"t":"멀티모달","en":"Multimodal","i":"ㅁ","d":"글뿐 아니라 이미지·소리·영상을 함께 읽고 만드는 AI.","rel":"2026-10-20-mistral-voxtral-3"},
 {"t":"온디바이스 AI","en":"On-device AI","i":"ㅇ","d":"서버 대신 스마트폰·노트북 안에서 바로 돌아가는 AI. 데이터가 기기 밖으로 나가지 않는 것이 장점이다.","rel":"2026-10-21-naver-d2sf-traceweave"},
 {"t":"프롬프트","en":"Prompt","i":"ㅍ","d":"AI에게 건네는 요청 문장. 무엇을, 어떤 형식으로, 어디까지 할지 적을수록 결과가 안정된다.","rel":None},
 {"t":"개인정보 가리기","en":"Redaction","i":"ㄱ","d":"이름·전화·이메일·주소를 [이름1] 같은 자리표로 바꿔 AI에 올리는 방법. 결과에만 내 PC에서 되돌린다.","rel":None},
 {"t":"RAG","en":"Retrieval-Augmented Generation","i":"R","d":"답하기 전에 내 문서에서 관련 내용을 먼저 찾아 읽고 답하게 하는 방식.","rel":None},
 {"t":"바이브 코딩","en":"Vibe coding","i":"ㅂ","d":"코드를 직접 쓰는 대신 AI에게 말로 설명해 앱을 만드는 방식. 보안·배포는 사람이 확인해야 한다.","rel":None},
]

# ---- 튜토리얼 ----
old = json.load(open(N + 'old_tut.json'))
cross = old['cross']; cross['thumb'] = 'img/cover/t-crosscheck-prompts.webp'; cross['rel'] = '2026-10-19-whatsapp-hidden-ai-instructions'
tuts = json.load(open(N + 'D_tutorials.json'))['tutorials']
TREL = {'t-auto-update-site': '2026-10-21-php2shell', 't-privacy-settings': '2026-10-16-google-privacy-personal-intelligence',
        't-verify-numbers': '2026-10-24-kimi-k3-1-pro', 't-pdf-to-markdown': '2026-10-07-claude-haiku-5-5',
        't-reels-script': '2026-10-19-paris-city-tours-ai-satire'}
TFIG = {'t-redact-before-upload': ('img/ph/spreadsheet.webp', '예시 표 · Wikimedia Commons · Smallbones (CC0)'),
        't-auto-update-site': ('img/ph/elephpant.webp', 'PHP 마스코트 엘레펀트 · Wikimedia Commons · Atomic Taco (CC BY-SA 2.0)')}
for t in tuts:
    t['thumb'] = f"img/cover/{t['id']}.webp"; t['rel'] = TREL.get(t['id'])
    if t['id'] in TFIG: t['cover'] = TFIG[t['id']][0]; t['coverCredit'] = TFIG[t['id']][1]
    else: t.pop('cover', None)
tuts.sort(key=lambda t: t['date'], reverse=True)
TUTS = [cross] + tuts

cols = json.load(open(N + 'columns.json'))['columns']
for c in cols: assert c['rel'] in byid, c['rel']

DATA = {'ARTICLES': out, 'TUTORIALS': TUTS, 'RESOURCES': old['resources'], 'COLUMNS': cols, 'DAILY': DAILY, 'TERMS': TERMS,
        'ABOUT_CARD': {'src': 'img/ph/about-card.webp', 'caption': '쓰레드·인스타그램 카드 (10월 26일 PHP2Shell 편)'}}
os.makedirs(SRC + 'build', exist_ok=True)
json.dump(DATA, open(SRC + 'build/data.json', 'w'), ensure_ascii=False)
print('articles', len(out), 'tutorials', len(TUTS), 'columns', len(cols), 'daily', len(DAILY), 'terms', len(TERMS))

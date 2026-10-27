# SHIFT AI 매거진 사이트 원본

공개 주소: https://shiftaimagazine.com (2026-10-27부터, 포크번 도메인 → GitHub Pages main 브랜치 루트. 저장소 루트의 CNAME 파일이 도메인 설정. 예전 주소 shiftaimagazine.github.io 는 GitHub가 자동으로 새 주소로 넘김)
`_src/` 는 밑줄로 시작해서 GitHub Pages(Jekyll)가 공개하지 않는다.

## 자동 흐름
1. 매일 예약 작업(Claude)이 `_src/news/daily/YYYY-MM-DD.json` 에 기사를, `_src/news/daily.json` 맨 앞에 그날 데일리 이슈를 넣고 푸시
2. `.github/workflows/build.yml` 이 돈다: `fetch_images.py`(새 기사 사진: og → 원문 og:image → 원문 화면 캡처) → `build.sh` → 결과 커밋
3. GitHub Pages 가 그 커밋을 배포(1분 안팎)

## 파일
- 기사: `news/A·B·C·E.json`(초기분), `news/daily/*.json`(매일분) — 형식과 출처 규칙은 `news/BRIEF.md`
- 대표 사진 `news/photos.json`(자동 기록) · 실패 목록 `news/photos-missing.json` · 본문 사진 `news/inline.json`
- 데일리 이슈 `news/daily.json`(최신이 맨 앞, lead 기사가 첫 화면 대표) · 용어 `news/terms.json` · 쓰레드 링크 `news/threads.json`
- 튜토리얼 `news/D_tutorials.json`·`old_tut.json`·`tutorial_links.json` · 칼럼 `news/columns.json`
- 튜토리얼마다 `cat`(업무 | AI 답 검증 | 보안·개인정보 | 공부·리서치 | 콘텐츠·커리어) 필수 — 튜토리얼 목록의 분류 버튼
- 모든 목록은 최신순(날짜 → 같은 날은 나중에 넣은 글이 위). 기사 date 는 매거진에 올린 날짜(KST)
- 글 주소를 바꾸면 `news/redirects.json` 에 {"/news/옛-id/": "/news/새-id/"} 를 넣는다(예전 주소가 새 주소로 넘어감)
- 화면: `app.js`·`site.css`·`views/*.html`(팔로우 상자 `views/follow-box.html`) · 페이지 생성 `build.py` · 미리 그리기 `prerender.js`
- 검색엔진 소유 확인 태그: `verify-meta.html`(모든 페이지 head 에 들어감)

## 손으로 다시 만들기
```
python3 _src/assemble.py   # 검사만(필수 항목·중복 id·데일리 이슈 연결)
sh _src/build.sh           # 전체 빌드(Pillow, Node+Playwright 필요)
```

## 규칙
- 언론사 기사는 출처로 안 씀. AI 생성 이미지 안 씀. 사진마다 출처 표기.
- 주소: /news/<기사 id>/, /tutorial/<id에서 t- 뺀 것>/, /column/<id에서 c- 뺀 것>/, /daily/<날짜>/
- 무료 도구: 목록 `news/tools.json`(첫 화면·/tools/), 화면 `views/tool-<id>.html`, 동작 `widgets/<id>.js`(→ assets/), 페이지 제목은 build.py TOOL_PAGES. 개인정보 가리기(/tools/redact/)·AI 요금 계산기(/tools/ai-cost/, 가격 `news/ai_prices.json` — 공식 가격표에서 확인한 값만, 기준일·환율 출처 필수, 예정된 인상은 changes)
- 검색: /search/?q=검색어 (기사·칼럼·데일리 이슈·튜토리얼·AI 사전 한 번에, 브라우저 안에서 data.js 로 찾음, 색인 제외). 위쪽 검색칸·휴대폰 검색 버튼이 이리로 온다. 예전 /news/?q= 는 여기로 넘김. AI 사전은 자체 검색칸(/dict/?t=용어)
- 뉴스레터는 없앰(10/26). 대신 인스타그램·유튜브·쓰레드 팔로우 상자. 개인정보처리방침은 views/privacy.html
- 위쪽 메뉴 순서 = 첫 화면 순서: 데일리 이슈 · AI 뉴스(칼럼 포함) · 튜토리얼 · AI 사전 · 소개
- 말투(10/27~): 사이트 모든 글·화면 문구는 **습니다체**(질문은 ~나요?/~ㄹ까요?). 따옴표 안 인용·복사용 프롬프트(items.prompt)·예시(example)는 그대로. AI 티 나는 표현 금지 목록은 news/BRIEF.md 2장. assemble.py 가 2026-10-28 이후 기사·데일리·칼럼에서 한다체 문장 끝을 찾으면 멈춘다.
- 튜토리얼 목록: 분류 버튼 맨 앞에 '무료 도구'(tools.json 목록을 보여 줌, /tutorial/?cat=무료 도구). 썸네일은 실제 사진(위키미디어 공용, 출처는 news/tutorial_links.json TFIG) 위에 'SHIFT AI 튜토리얼'과 cover.line 을 얹은 것 — `python3 _src/tut_thumbs.py [튜토리얼 id…]` 로 다시 만든다. 새 사진 찾기·받기는 손으로 돌리는 Actions `commons-photos`(결과는 commons-tmp 가지).

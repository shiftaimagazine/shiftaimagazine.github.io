# SHIFT AI 매거진 사이트 원본

공개 주소: https://shiftaimagazine.github.io (GitHub Pages, main 브랜치 루트)
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
- 뉴스레터는 없앰(10/26). 대신 인스타그램·유튜브·쓰레드 팔로우 상자. 개인정보처리방침은 views/privacy.html
- 위쪽 메뉴 순서 = 첫 화면 순서: 데일리 이슈 · AI 뉴스(칼럼 포함) · 튜토리얼 · AI 사전 · 소개

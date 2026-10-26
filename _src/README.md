# SHIFT AI 매거진 사이트 원본

공개 주소: https://shiftaimagazine.github.io (GitHub Pages, main 브랜치 루트)
`_src/` 폴더는 밑줄로 시작해서 GitHub Pages(Jekyll)가 공개하지 않는다.

## 다시 만들기
```
sh _src/build.sh      # assemble.py → build.py → prerender.js
```
- `assemble.py` : news/*.json(기사 A·B·C·E, 튜토리얼 D_tutorials, 칼럼 columns, 크로스체크 old_tut)과
  안에 적힌 PH(대표 사진)·INLINE(본문 사진)·DAILY(데일리 이슈)·TERMS(용어)를 합쳐 `build/data.json` 생성
- `build.py` : 페이지마다 index.html(제목·설명·og 미리보기·JSON-LD), og/*.jpg(1200×630), sitemap.xml, feed.xml, robots.txt, 404
- `prerender.js` : 페이지를 한 번 그려 완성된 HTML로 저장. `subscribe-embed.html`이 있으면 구독 칸 자리(`<!--SUB-->…<!--/SUB-->`)에 넣음

## 글 추가
1. 기사: news/E.json(또는 새 파일) `articles`에 추가. 출처는 원문만(BRIEF.md). 사진은 img/ph/에 넣고 assemble.py `PH`에 출처와 함께 등록
2. 데일리 이슈: assemble.py `DAILY` 맨 앞에 추가
3. `sh _src/build.sh` → 커밋·푸시

## 규칙
- 언론사 기사는 출처로 안 씀. AI 생성 이미지 안 씀. 사진마다 출처 표기.
- 주소 규칙: /news/<기사 id>/, /tutorial/<id에서 t- 뺀 것>/, /column/<id에서 c- 뺀 것>/, /daily/<날짜>/
- 뉴스레터: beehiiv(무료, 2,500명까지). 매주 월요일. 개인정보처리방침은 views/privacy.html

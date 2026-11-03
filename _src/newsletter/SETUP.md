# 주간 메일 설정 안내 (처음 한 번)

비용: 0원. Resend 무료(마케팅 연락처 1,000명, 확인 메일 같은 거래용 메일 하루 100통·월 3,000통) + Cloudflare Workers 무료.
구독자가 1,000명을 넘으면 Resend 마케팅 유료 요금제가 필요합니다.

## 어떻게 돌아가나

```
구독 칸(사이트) ──신청──▶ 구독 서버(Cloudflare Worker) ──확인 메일──▶ 구독자
구독자가 메일 속 링크 → /subscribe/ 에서 '구독 확정하기' ──▶ 구독 서버 ──▶ Resend 연락처(세그먼트)에 등록
일요일 23:17 newsletter 워크플로 ──▶ 지난주(월~일) 기사로 '이번 주 AI 핫 이슈' 메일을 만들어 Resend 에 월요일 07:00 예약
구독 해지: 메일 아래 링크 → Resend 가 직접 처리
```

- 이중 확인: 확인 버튼을 누른 주소만 명단에 들어갑니다. 메일 보안 검사기가 링크만 열어서는 확정되지 않게, 링크는 사이트 페이지로 가고 거기서 버튼을 눌러야 합니다.
- 같은 주 메일은 한 번만 갑니다(Resend 발송 이름 `weekly-YYYY-MM-DD`로 확인). 기사가 4개보다 적은 주는 건너뜁니다.
- 핫 이슈는 자동으로 고르고, 편집부가 직접 고르려면 `weekly/README.md` 형식으로 파일을 올립니다.
- 사이트: 모든 페이지 맨 아래 구독 칸 + 페이지를 열 때마다 한 번 오른쪽 아래 팝업(12초 뒤 또는 글을 절반 읽었을 때, 닫기·Esc, 구독 신청한 브라우저에는 안 뜸).
- 구독 서버는 주소를 따로 저장하지 않습니다. 명단은 Resend 에만 있습니다.

## 1. Resend (직접: 가입 + 키 1개)

1. https://resend.com 가입
2. **API Keys → Create API Key** → 권한 **Full access** → 키(`re_…`) 복사

도메인 등록·세그먼트('주간 메일')는 4번 워크플로가 만듭니다. 열람·클릭 추적은 꺼진 채로 둡니다(방침에 열람·클릭 기록을 받지 않는다고 적었습니다).

## 2. Cloudflare (직접: 가입 + 토큰 1개)

1. https://dash.cloudflare.com 가입
2. **내 프로필 → API 토큰 → 토큰 만들기 → 'Cloudflare Workers 편집' 템플릿** → 토큰 요약 → 만들기 → 토큰 복사

계정 ID·workers.dev 하위 주소는 워크플로가 찾거나 만듭니다.

## 3. GitHub 저장소 비밀값 (직접: 2개 붙여 넣기)

저장소 **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `RESEND_API_KEY` | 1-2 의 `re_…` |
| `CLOUDFLARE_API_TOKEN` | 2-2 의 토큰 |

## 4. 워크플로 실행 → DNS 넣기 → 한 번 더 실행

1. **Actions → newsletter-worker → Run workflow**. Resend 도메인 등록, 세그먼트, 하위 주소, 서버 배포, 확인 링크 서명값(무작위, 어디에도 안 보임), 사이트 연결까지 합니다.
2. 실행 결과 화면(Summary)에 **포크번에 넣을 DNS 레코드 표**가 나옵니다. 포크번 → 도메인 → DNS 에 그대로 추가(기존 A·CNAME 은 건드리지 않음). `_dmarc` TXT 도 함께.
3. 몇 분 뒤 newsletter-worker 를 한 번 더 돌리면 인증을 확인합니다. Summary 에 '인증됨'이 나오면 끝.

이후 `_src/newsletter/worker/` 를 고치면 다시 자동 배포됩니다.

## 5. 여는 날(2026-11-11)

- 개인정보처리방침에 11월 4일 공지·11월 11일 시행으로 적었습니다(방침 끝 '시행 7일 전에 알린다' 약속).
- 구독 칸은 `config.json` 의 `start` 날짜 이후에 사이트를 다시 만들 때 나타납니다. 11일 아침에 **Actions → build-site → Run workflow** 를 한 번 누르면 바로 열립니다(안 눌러도 그날 밤 데일리 이슈 빌드 때 열림).
- 구독 서버도 `wrangler.toml` 의 `START` 전에는 신청을 받지 않습니다. 날짜를 바꾸려면 두 곳을 같이 고칩니다.

## 6. 시험

1. 11일에 본인 주소로 구독 → 확인 메일 → '구독 확정하기'
2. Resend **Audience → Contacts** 에 주소가 들어왔는지 확인
3. **Actions → newsletter → Run workflow** (보낼 날에 지난 월요일 날짜, '바로 보내기' 체크) → 그 주 메일이 옵니다. 같은 주 두 번은 안 갑니다(시험으로 보낸 주는 실제 발송이 건너뛰어지니, 시험은 이미 지난 주 날짜로).
4. 메일 아래 '구독 해지'를 눌러 해지되는지 확인

메일 모양만 보려면(아무것도 안 보냄): `python3 _src/assemble.py && python3 _src/newsletter/send.py --preview /tmp/mail.html --date 2026-11-09`

## 문제가 생기면

- 구독 칸에 '연결이 원활하지 않습니다': Cloudflare 대시보드 → Workers → shift-newsletter → **Logs** 에서 오류 확인. 비밀값이 빠지면 서버가 `not_configured` 로 답합니다.
- 확인 메일이 안 감: Resend **Emails** 목록, 도메인 Verify 상태 확인. 하루 100통 한도를 넘으면 다음 날 다시 됩니다.
- 주간 메일이 안 감: Actions → newsletter 실행 기록. 보통 '비밀값 없음', '시작일 전', '기사가 적어 건너뜀', '이미 만든 발송 있음' 중 하나가 적혀 있습니다.
- 신청 폭주(로봇): `wrangler.toml` 에 IP당 1분 5회 제한이 들어 있습니다. 더 막으려면 Cloudflare Turnstile 을 붙이고 비밀값 `TURNSTILE_SECRET` 을 넣습니다(구독 칸에 Turnstile 위젯과 CSP 허용 추가 필요).

## 파일

- `worker/worker.js` 구독 서버 · `worker/wrangler.toml` 설정 · `worker/test.mjs` 시험(`node _src/newsletter/worker/test.mjs`)
- `send.py` 주간 메일 만들기·예약 · `config.json` 서버 주소·시작일·발송 시각·핫 이슈 수 · `weekly/` 편집부가 고른 기사(선택)
- 화면: `_src/views/subscribe-box.html`(구독 칸, 모든 페이지 맨 아래. 팝업은 app.js 가 이 양식을 복사) · `_src/views/subscribe.html`(/subscribe/ 페이지) · `app.js` 의 '주간 메일 구독'·'구독 팝업' 부분 · `site.css` 의 `.subbox`·`.subpop`
- 워크플로: `.github/workflows/newsletter-worker.yml`(서버 배포) · `.github/workflows/newsletter.yml`(발송)

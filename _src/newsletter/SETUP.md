# 데일리 메일 설정 안내 (처음 한 번)

비용: 0원. Resend 무료(마케팅 연락처 1,000명, 확인 메일 같은 거래용 메일 하루 100통·월 3,000통) + Cloudflare Workers 무료.
구독자가 1,000명을 넘으면 Resend 마케팅 유료 요금제가 필요합니다.

## 어떻게 돌아가나

```
구독 칸(사이트) ──신청──▶ 구독 서버(Cloudflare Worker) ──확인 메일──▶ 구독자
구독자가 메일 속 링크 → /subscribe/ 에서 '구독 확정하기' ──▶ 구독 서버 ──▶ Resend 연락처(세그먼트)에 등록
매일 밤 데일리 이슈 푸시 → build-site → newsletter 워크플로 ──▶ Resend 브로드캐스트를 다음 날 07:00 으로 예약
구독 해지: 메일 아래 링크 → Resend 가 직접 처리
```

- 이중 확인: 확인 버튼을 누른 주소만 명단에 들어갑니다. 메일 보안 검사기가 링크만 열어서는 확정되지 않게, 링크는 사이트 페이지로 가고 거기서 버튼을 눌러야 합니다.
- 같은 날 같은 메일은 한 번만 갑니다(Resend 발송 이름 `daily-YYYY-MM-DD`로 확인).
- 구독 서버는 주소를 따로 저장하지 않습니다. 명단은 Resend 에만 있습니다.

## 1. Resend

1. https://resend.com 가입
2. **Domains → Add Domain** → `shiftaimagazine.com`, 지역은 기본값(North Virginia) 그대로(개인정보처리방침에 미국으로 적었습니다).
3. 화면에 나오는 DNS 레코드(MX 1개, TXT 2개 — `send` · `resend._domainkey`)를 도메인 회사(포크번) DNS 관리 화면에 그대로 추가 → Resend 에서 **Verify**. 기존 사이트 레코드(A·CNAME)는 건드리지 않습니다.
4. 포크번 DNS 에 하나 더: 종류 `TXT`, 호스트 `_dmarc`, 값 `v=DMARC1; p=none;` (지메일·네이버 스팸함 방지)
5. 도메인 설정에서 **Open tracking · Click tracking 은 끈 채로** 둡니다(방침에 열람·클릭 기록을 받지 않는다고 적었습니다).
6. **Audience → Segments → Create segment** → 이름 `데일리 메일` → 만들어진 세그먼트 **ID** 를 복사
7. **API Keys → Create API Key** → 권한 **Full access** → 키(`re_…`) 복사

## 2. Cloudflare

1. https://dash.cloudflare.com 가입
2. 왼쪽 **Workers & Pages** 를 한 번 열어 workers.dev 하위 주소를 정합니다(예: `shiftai`). 구독 서버 주소는 `https://shift-newsletter.<하위 주소>.workers.dev` 가 됩니다.
3. 오른쪽 위 계정 메뉴 → **Account ID** 복사(Workers & Pages 화면 오른쪽에도 나옴)
4. **내 프로필 → API 토큰 → 토큰 만들기 → 'Cloudflare Workers 편집' 템플릿** → 만들기 → 토큰 복사

## 3. GitHub 저장소 비밀값

저장소 **Settings → Secrets and variables → Actions → New repository secret** 에서 5개:

| 이름 | 값 |
|---|---|
| `RESEND_API_KEY` | 1-7 의 `re_…` |
| `RESEND_SEGMENT_ID` | 1-6 의 세그먼트 ID |
| `CLOUDFLARE_API_TOKEN` | 2-4 의 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | 2-3 의 Account ID |
| `NEWSLETTER_SIGNING_SECRET` | 아무도 모르는 긴 무작위 글자 40자 이상(비밀번호 생성기로 만들면 됨). 확인 링크 서명용 |

## 4. 구독 서버 배포

**Actions → newsletter-worker → Run workflow**. 끝나면 서버 주소를 `_src/newsletter/config.json` 의 `api` 에 적어 커밋하고 build-site 를 돌립니다(자동).
이후 `_src/newsletter/worker/` 를 고치면 다시 자동 배포됩니다.

## 5. 여는 날(2026-11-11)

- 개인정보처리방침에 11월 4일 공지·11월 11일 시행으로 적었습니다(방침 끝 '시행 7일 전에 알린다' 약속).
- 구독 칸은 `config.json` 의 `start` 날짜 이후에 사이트를 다시 만들 때 나타납니다. 11일 아침에 **Actions → build-site → Run workflow** 를 한 번 누르면 바로 열립니다(안 눌러도 그날 밤 데일리 이슈 빌드 때 열림).
- 구독 서버도 `wrangler.toml` 의 `START` 전에는 신청을 받지 않습니다. 날짜를 바꾸려면 두 곳을 같이 고칩니다.

## 6. 시험

1. 11일에 본인 주소로 구독 → 확인 메일 → '구독 확정하기'
2. Resend **Audience → Contacts** 에 주소가 들어왔는지 확인
3. **Actions → newsletter → Run workflow** (날짜 비우고 '바로 보내기' 체크) → 그날 데일리 메일이 옵니다. 같은 날 두 번은 안 갑니다.
4. 메일 아래 '구독 해지'를 눌러 해지되는지 확인

메일 모양만 보려면(아무것도 안 보냄): `python3 _src/assemble.py && python3 _src/newsletter/send.py --preview /tmp/mail.html --date 2026-11-03`

## 문제가 생기면

- 구독 칸에 '연결이 원활하지 않습니다': Cloudflare 대시보드 → Workers → shift-newsletter → **Logs** 에서 오류 확인. 비밀값이 빠지면 서버가 `not_configured` 로 답합니다.
- 확인 메일이 안 감: Resend **Emails** 목록, 도메인 Verify 상태 확인. 하루 100통 한도를 넘으면 다음 날 다시 됩니다.
- 데일리 메일이 안 감: Actions → newsletter 실행 기록. 보통 '비밀값 없음', '시작일 전', '이미 만든 발송 있음' 중 하나가 적혀 있습니다.
- 신청 폭주(로봇): `wrangler.toml` 에 IP당 1분 5회 제한이 들어 있습니다. 더 막으려면 Cloudflare Turnstile 을 붙이고 비밀값 `TURNSTILE_SECRET` 을 넣습니다(구독 칸에 Turnstile 위젯과 CSP 허용 추가 필요).

## 파일

- `worker/worker.js` 구독 서버 · `worker/wrangler.toml` 설정 · `worker/test.mjs` 시험(`node _src/newsletter/worker/test.mjs`)
- `send.py` 데일리 메일 만들기·예약 · `config.json` 서버 주소·시작일·발송 시각
- 화면: `_src/views/subscribe-box.html`(구독 칸, 팔로우 상자 위) · `_src/views/subscribe.html`(/subscribe/ 페이지) · `app.js` 의 '데일리 메일 구독' 부분 · `site.css` 의 `.subbox`
- 워크플로: `.github/workflows/newsletter-worker.yml`(서버 배포) · `.github/workflows/newsletter.yml`(발송)

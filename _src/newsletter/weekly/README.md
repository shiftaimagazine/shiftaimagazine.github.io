# 주간 메일 기사 고르기(선택)

이 폴더에 `<보낼 월요일 날짜>.json` 을 두면 그 주 메일은 여기 적은 기사로 나갑니다. 없으면 자동으로 고릅니다
(그날 데일리 이슈의 대표 기사 → '써볼 만해요' 판정 → 첫 화면 추천 순, '써볼 만해요'가 하나는 들어가게).

일요일 23시(한국 시간) 전까지 main 에 올려야 그 주 메일에 반영됩니다.

```json
{
  "picks": ["2026-11-03-ihitl-agent-spending-cap", "2026-11-02-deepseek-dsh-superagent"],
  "note": "편집부 한마디(선택, 메일 맨 위에 들어감)",
  "subject": "메일 제목(선택, 비우면 '[SHIFT AI] 이번 주 AI 핫 이슈 · 11월 9일~15일')"
}
```

- `picks` 는 그 주(지난주 월~일) 기사 id 만 됩니다. 다른 주 id 가 섞이면 발송이 멈추고 오류가 납니다.
- 미리 보기: `python3 _src/assemble.py && python3 _src/newsletter/send.py --preview /tmp/w.html --date 2026-11-16`

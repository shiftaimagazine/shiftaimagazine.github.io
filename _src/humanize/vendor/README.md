# 가져온 도구 (손대지 않은 원본 사본)

사용자 PC 의 Claude Code 에 설치한 두 플러그인과 같은 버전을, 매일 아침 클라우드에서 도는 기사 작업도 쓸 수 있게 필요한 파일만 복사해 두었습니다. 내용은 고치지 않았습니다.

| 폴더 | 원본 | 버전(커밋) | 라이선스 |
|---|---|---|---|
| im-not-ai/ | https://github.com/epoko77-ai/im-not-ai (humanize-korean) | 2.3.2 (b37e0206d31f, 2026-10-12) | MIT (LICENSE) |
| humanizer-kr/ | https://github.com/hjongc/humanizer-kr | 0.1.10 (a1a7069a32f6, 2026-07-02) | MIT (LICENSE) |

- 우리 기사에 맞춘 점검기·되돌려 넣기는 `../shift_humanize.py`, 다듬는 규칙은 `../HUMANIZE.md` 입니다.
- im-not-ai 의 `scripts/verify_gates.py` 는 `shift_humanize.py apply` 가 기사마다 한 번 불러 의미 보존(숫자·대구·서법) 경고를 받습니다.
- 업데이트: 원본 저장소의 새 버전을 확인한 뒤 같은 파일만 다시 복사하고 위 표의 버전을 고칩니다.

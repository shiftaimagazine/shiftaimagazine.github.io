"""데일리 메일 보내기: 가장 최근 데일리 이슈로 메일을 만들어 Resend 브로드캐스트로 예약 발송한다.

순서(GitHub Actions newsletter.yml 이 돌림, 먼저 python3 _src/assemble.py 로 _src/build/data.json 을 만들어 둔다):
  1. 오늘 또는 내일(한국 시간) 날짜의 데일리 이슈를 고른다(전날 밤 9시 45분쯤 올라오는 다음 날 호).
  2. 사이트에 그 날 페이지가 올라왔는지 확인한다(메일 속 링크가 열려야 하므로).
  3. Resend 에 같은 이름(daily-YYYY-MM-DD)의 브로드캐스트가 있으면 멈춘다(두 번 보내지 않음).
  4. 메일을 만들어 그날 send_time(기본 07:00)에 보내도록 예약한다. 이미 지났으면 바로, 정오가 지났으면 보내지 않는다.

손으로:
  python3 _src/newsletter/send.py --preview out.html [--date 2026-11-03]   # 메일 모양만 파일로(아무것도 안 보냄)
  python3 _src/newsletter/send.py [--date …] [--now]                      # 실제 예약/발송(비밀값 필요)
환경 변수: RESEND_API_KEY · RESEND_SEGMENT_ID · NEWSLETTER_FROM(선택) · NEWSLETTER_REPLY_TO(선택)
"""
import argparse, datetime, html, json, os, sys, time, urllib.error, urllib.request

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
SITE = 'https://shiftaimagazine.com'
KST = datetime.timezone(datetime.timedelta(hours=9))
CFG = json.load(open(SRC + 'newsletter/config.json'))
WD = '월화수목금토일'
VD = {'try': ('써볼 만해요', '#1f7a4d', '#e6f4ec'), 'watch': ('지켜보세요', '#8a5a00', '#fbf1d9'), 'hype': ('과장이에요', '#b3261e', '#fbe7e5')}
UTM = 'utm_source=newsletter&utm_medium=email'
esc = lambda s: html.escape(str(s or ''), quote=True)


def kor_date(d):
    y, m, dd = map(int, d.split('-'))
    return f'{y}년 {m}월 {dd}일 ({WD[datetime.date(y, m, dd).weekday()]})'


def link(path, date):
    return f'{SITE}{path}?{UTM}&utm_campaign=daily-{date}'


def load():
    D = json.load(open(SRC + 'build/data.json'))
    return D['DAILY'], {a['id']: a for a in D['ARTICLES']}


def build_mail(day, arts):
    date = day['date']
    items = [arts[i] for i in day['items'] if i in arts]
    assert items, ('데일리 이슈에 기사가 없음', date)
    subject = f"[SHIFT AI] {day['title']}"
    pre = day.get('summary') or ' · '.join(day.get('three') or [])
    daily_url = link(f'/daily/{date}/', date)
    lead = arts.get(day.get('lead')) or items[0]
    og = f"og/a-{lead['id']}.jpg"
    lead_img = f'{SITE}/{og}' if os.path.exists(os.path.dirname(SRC.rstrip('/')) + '/' + og) else ''
    F = "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"

    def card(a, i):
        v = (a.get('verdict') or {}).get('v')
        badge = f'<span style="display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:700;color:{VD[v][1]};background:{VD[v][2]}">{VD[v][0]}</span>' if v in VD else ''
        why = (a.get('verdict') or {}).get('why')
        u = link(f"/news/{a['id']}/", date)
        return f'''<tr><td style="padding:20px 28px 0">
<div style="font-size:12.5px;font-weight:700;color:#d4581f">{i:02d} · {esc(a['cat'])}{badge}</div>
<a href="{esc(u)}" style="display:block;margin-top:6px;font-size:17px;font-weight:700;line-height:1.45;color:#111214;text-decoration:none">{esc(a['title'])}</a>
<div style="margin-top:6px;font-size:14.5px;line-height:1.75;color:#3f4046">{esc(a['hook'])}</div>
{f'<div style="margin-top:6px;font-size:13.5px;line-height:1.6;color:#6f7076">판정 이유: {esc(why)}</div>' if why else ''}
<a href="{esc(u)}" style="display:inline-block;margin-top:8px;font-size:14px;font-weight:700;color:#111214">기사 읽기 →</a>
</td></tr>'''

    three = ''.join(f'<li style="margin:0 0 4px">{esc(t)}</li>' for t in (day.get('three') or []))
    body = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;{F};color:#111214">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:24px 28px 0"><a href="{esc(link('/', date))}"><img src="{SITE}/img/brand/logo-wide-mail.png" width="140" height="45" alt="SHIFT AI" style="display:block;border:0;width:140px;height:auto"></a></td></tr>
<tr><td style="padding:18px 28px 0;font-size:13px;font-weight:700;color:#6f7076">AI 데일리 · {kor_date(date)}</td></tr>
<tr><td style="padding:6px 28px 0;font-size:22px;font-weight:800;line-height:1.4;color:#111214">{esc(day['title'])}</td></tr>
{f'<tr><td style="padding:10px 28px 0;font-size:15px;line-height:1.75;color:#3f4046">{esc(day["summary"])}</td></tr>' if day.get('summary') else ''}
{f'<tr><td style="padding:16px 28px 0"><a href="{esc(daily_url)}"><img src="{lead_img}" width="544" alt="{esc((lead.get("image") or {}).get("alt"))}" style="display:block;border:0;width:100%;max-width:544px;height:auto;border-radius:8px"></a>' + (f'<div style="margin-top:4px;font-size:11.5px;color:#8a8b90">{esc((lead.get("image") or {}).get("credit"))}</div>' if (lead.get("image") or {}).get("credit") else '') + '</td></tr>' if lead_img else ''}
{f'<tr><td style="padding:18px 28px 0"><div style="background:#f6f6f4;border-radius:10px;padding:14px 18px"><div style="font-size:13px;font-weight:700;color:#111214;margin-bottom:6px">바쁘면 이것만</div><ul style="margin:0;padding-left:18px;font-size:14.5px;line-height:1.7;color:#2b2c2f">{three}</ul></div></td></tr>' if three else ''}
{''.join(card(a, i + 1) for i, a in enumerate(items))}
<tr><td style="padding:24px 28px 26px"><a href="{esc(daily_url)}" style="display:inline-block;background:#111214;color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:700;padding:12px 20px;border-radius:8px">이날 소식 {len(items)}건 사이트에서 보기</a></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:16px 18px 8px;font-size:12px;line-height:1.7;color:#8a8b90;text-align:center">
SHIFT AI는 AI 소식을 회사 발표·논문 같은 원문부터 읽고 씁니다. 기사마다 끝에 원문 링크가 있습니다.<br>
이 메일은 SHIFT AI 데일리 메일을 구독하신 분께 보냅니다. 답장하면 편집부로 갑니다.<br>
<a href="{{{{{{RESEND_UNSUBSCRIBE_URL}}}}}}" style="color:#6f7076">구독 해지</a> · <a href="{SITE}/privacy/" style="color:#8a8b90">개인정보처리방침</a> · <a href="{SITE}/" style="color:#8a8b90">shiftaimagazine.com</a>
</td></tr></table>
</td></tr></table></body></html>'''
    text = '\n'.join([f'AI 데일리 · {kor_date(date)}', day['title'], '', day.get('summary') or '', '']
                     + ([f'- {t}' for t in day.get('three') or []] + [''] if day.get('three') else [])
                     + sum(([f"{i + 1:02d} · {a['cat']}" + (f" · {VD[a['verdict']['v']][0]}" if (a.get('verdict') or {}).get('v') in VD else ''), a['title'], a['hook'], link(f"/news/{a['id']}/", date), ''] for i, a in enumerate(items)), [])
                     + [f'사이트에서 보기: {daily_url}', '', '구독 해지: {{{RESEND_UNSUBSCRIBE_URL}}}', f'SHIFT AI · {SITE}/'])
    return subject, body, text


def api(method, path, body=None):
    key = os.environ['RESEND_API_KEY']
    req = urllib.request.Request('https://api.resend.com' + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'User-Agent': 'shift-ai-newsletter'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')
            if e.code == 429 and attempt < 2: time.sleep(2 + attempt * 3); continue
            raise SystemExit(f'Resend {method} {path} → {e.code} {msg[:400]}')


def already_sent(name):
    after = None
    while True:
        r = api('GET', '/broadcasts?limit=100' + (f'&after={after}' if after else ''))
        data = r.get('data') or []
        if any(b.get('name') == name for b in data): return True
        if not r.get('has_more') or not data: return False
        after = data[-1]['id']


def site_has(path, wait_s):
    end = time.time() + wait_s
    while True:
        try:
            with urllib.request.urlopen(urllib.request.Request(SITE + path + f'?nl={int(time.time())}', headers={'User-Agent': 'shift-ai-newsletter'}), timeout=20) as r:
                if r.status == 200: return True
        except Exception: pass
        if time.time() > end: return False
        time.sleep(15)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview'); ap.add_argument('--date'); ap.add_argument('--now', action='store_true', help='예약하지 않고 바로 보냄')
    ap.add_argument('--wait', type=int, default=420, help='사이트에 그날 페이지가 올라오길 기다리는 초')
    o = ap.parse_args()
    DY, arts = load()
    now = datetime.datetime.now(KST); today = now.date()
    if o.date: day = next((d for d in DY if d['date'] == o.date), None)
    else:
        ok = {today.isoformat(), (today + datetime.timedelta(days=1)).isoformat()}
        day = max((d for d in DY if d['date'] in ok), key=lambda d: d['date'], default=None)
    if not day: print('보낼 데일리 이슈 없음(오늘·내일 날짜 호가 없음)'); return
    date = day['date']
    subject, body, text = build_mail(day, arts)
    if o.preview:
        open(o.preview, 'w').write(body); open(os.path.splitext(o.preview)[0] + '.txt', 'w').write(text)
        print('미리 보기:', o.preview, '| 제목:', subject); return

    if date < CFG['start']: print(f'구독 시작일({CFG["start"]}) 전 호라 보내지 않음:', date); return
    if not os.environ.get('RESEND_API_KEY') or not os.environ.get('RESEND_SEGMENT_ID'):
        print('::warning::RESEND_API_KEY · RESEND_SEGMENT_ID 비밀값이 없어 보내지 않음(_src/newsletter/SETUP.md)'); return
    hh, mm = map(int, CFG.get('send_time', '07:00').split(':'))
    at = datetime.datetime.fromisoformat(f'{date}T{hh:02d}:{mm:02d}:00+09:00')
    if now > at.replace(hour=12, minute=0):
        print('발송 시각이 한참 지난 호라 보내지 않음:', date); return
    name = f'daily-{date}'
    if already_sent(name): print('이미 만든 발송 있음:', name); return
    if not site_has(f'/daily/{date}/', o.wait):
        raise SystemExit(f'사이트에 /daily/{date}/ 가 아직 없음(배포 대기 시간 초과). 다음 실행에서 다시 시도합니다.')
    if already_sent(name): print('이미 만든 발송 있음:', name); return  # 기다리는 동안 다른 실행이 만들었을 수 있음
    req = {'segment_id': os.environ['RESEND_SEGMENT_ID'], 'from': os.environ.get('NEWSLETTER_FROM') or 'SHIFT AI <news@shiftaimagazine.com>',
           'reply_to': os.environ.get('NEWSLETTER_REPLY_TO') or 'shiftai.magazine@gmail.com', 'subject': subject, 'html': body, 'text': text, 'name': name, 'send': True}
    if not o.now and at > now + datetime.timedelta(minutes=2): req['scheduled_at'] = at.isoformat()
    r = api('POST', '/broadcasts', req)
    print('발송 예약됨' if 'scheduled_at' in req else '바로 보냄', name, req.get('scheduled_at', ''), r.get('id'))


if __name__ == '__main__':
    sys.exit(main())

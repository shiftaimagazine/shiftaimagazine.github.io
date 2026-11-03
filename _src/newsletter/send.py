"""주간 메일 '이번 주 AI 핫 이슈' 보내기: 지난주(월~일, 한국 시간) 기사로 메일을 만들어 Resend 브로드캐스트로 월요일 아침에 예약 발송한다.

순서(GitHub Actions newsletter.yml 이 일요일 밤·월요일 새벽에 돌림, 먼저 python3 _src/assemble.py 로 _src/build/data.json 을 만들어 둔다):
  1. 보낼 날(돌아오는 월요일)과 그 앞 7일(지난주 월~일)을 정한다. 오늘이 일요일·월요일이 아니면 아무것도 안 한다.
  2. 그 주 기사가 min_articles 보다 적으면 건너뛴다.
  3. 핫 이슈를 고른다. 편집부가 _src/newsletter/weekly/<보낼 날>.json 을 써 두면 그대로 쓰고, 없으면 자동으로 고른다
     (그날 데일리 이슈의 대표 기사 → '써볼 만해요' 판정 → 첫 화면 추천 순, 같으면 최신).
  4. Resend 에 같은 이름(weekly-YYYY-MM-DD)의 발송이 있으면 멈춘다(두 번 보내지 않음).
  5. 월요일 send_time(기본 07:00)에 보내도록 예약한다. 이미 지났으면 바로, 정오가 지났으면 보내지 않는다.

편집부가 고를 때(선택): _src/newsletter/weekly/2026-11-16.json
  {"picks": ["기사 id", ...], "note": "편집부 한마디(선택)", "subject": "메일 제목(선택)"}

손으로:
  python3 _src/newsletter/send.py --preview out.html [--date 2026-11-09]   # 메일 모양만(아무것도 안 보냄). --date 는 보낼 날(월요일)
  python3 _src/newsletter/send.py [--date …] [--now]                      # 실제 예약/발송(비밀값 필요)
환경 변수: RESEND_API_KEY · RESEND_SEGMENT_ID(선택, 없으면 '주간 메일' 세그먼트를 찾음) · NEWSLETTER_FROM(선택) · NEWSLETTER_REPLY_TO(선택)
"""
import argparse, datetime, html, json, os, sys, time, urllib.error, urllib.request

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = os.path.dirname(SRC.rstrip('/')) + '/'
SITE = 'https://shiftaimagazine.com'
KST = datetime.timezone(datetime.timedelta(hours=9))
CFG = json.load(open(SRC + 'newsletter/config.json'))
VD = {'try': ('써볼 만해요', '#1f7a4d', '#e6f4ec'), 'watch': ('지켜보세요', '#8a5a00', '#fbf1d9'), 'hype': ('과장이에요', '#b3261e', '#fbe7e5')}
esc = lambda s: html.escape(str(s or ''), quote=True)
md = lambda d: f'{d.month}월 {d.day}일'


def week_label(mon):
    sun = mon + datetime.timedelta(days=6)
    return f'{md(mon)}~{sun.day}일' if mon.month == sun.month else f'{md(mon)}~{md(sun)}'


def load():
    D = json.load(open(SRC + 'build/data.json'))
    return D['ARTICLES'], D['DAILY'], D['TUTORIALS']


def pick(send, A, DY, T):
    """보낼 날(월요일) → (지난주 월요일, 그 주 기사, 핫 이슈, 다른 소식, 튜토리얼, 편집부 메모, 제목)"""
    mon = send - datetime.timedelta(days=7); end = send - datetime.timedelta(days=1)
    inweek = lambda d: mon.isoformat() <= d <= end.isoformat()
    week = sorted((a for a in A if inweek(a['date'])), key=lambda a: a['date'] + (a.get('time') or ''), reverse=True)
    byid = {a['id']: a for a in week}
    leads = {d.get('lead') for d in DY if inweek(d['date'])}
    ov_p = SRC + f'newsletter/weekly/{send.isoformat()}.json'
    ov = json.load(open(ov_p)) if os.path.exists(ov_p) else {}
    if ov.get('picks'):
        miss = [i for i in ov['picks'] if i not in byid]
        assert not miss, (ov_p, '그 주 기사가 아닌 id', miss)
        hot = [byid[i] for i in ov['picks']]
    else:
        score = lambda a: (3 if a['id'] in leads else 0) + (2 if (a.get('verdict') or {}).get('v') == 'try' else 0) + (1 if a.get('featured') else 0)
        ranked = sorted(week, key=lambda a: (score(a), a['date'] + (a.get('time') or '')), reverse=True)
        hot = ranked[:int(CFG.get('hot', 5))]
        # 바로 써 볼 수 있는 것('써볼 만해요')이 하나도 안 들어갔으면 마지막 자리를 그중 하나로 바꾼다
        isTry = lambda a: (a.get('verdict') or {}).get('v') == 'try'
        if hot and not any(map(isTry, hot)):
            t = next((a for a in ranked if isTry(a)), None)
            if t: hot[-1] = t
        hot.sort(key=lambda a: a['date'] + (a.get('time') or ''), reverse=True)
    rest = [a for a in week if a not in hot][:10]
    tuts = [t for t in T if inweek(t['date'])][:2]
    return mon, week, hot, rest, tuts, ov.get('note'), ov.get('subject')


def build_mail(send, A, DY, T):
    mon, week, hot, rest, tuts, note, subj = pick(send, A, DY, T)
    camp = f'weekly-{send.isoformat()}'
    link = lambda path: f'{SITE}{path}?utm_source=newsletter&utm_medium=email&utm_campaign={camp}'
    lab = week_label(mon)
    subject = subj or f'[SHIFT AI] 이번 주 AI 핫 이슈 · {lab}'
    cnt = {k: sum(1 for a in week if (a.get('verdict') or {}).get('v') == k) for k in VD}
    vline = ' · '.join(f'{VD[k][0]} {n}' for k, n in cnt.items() if n)
    intro = f'{lab} 한 주 동안 AI 기사 {len(week)}개를 원문부터 읽고 썼습니다. 그중 꼭 볼 {len(hot)}개를 골랐습니다.' + (f' 판정은 {vline}입니다.' if vline else '')
    pre = ' · '.join(a['title'] for a in hot[:3])
    week_url = link(f'/weekly/{mon.isoformat()}/') if os.path.exists(OUT + f'weekly/{mon.isoformat()}/index.html') or len(week) >= int(CFG.get('min_articles', 4)) else link('/news/')
    lead = hot[0]
    og = f"og/a-{lead['id']}.jpg"
    lead_img = f'{SITE}/{og}' if os.path.exists(OUT + og) else ''
    F = "font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"

    def card(a, i):
        v = (a.get('verdict') or {}).get('v'); why = (a.get('verdict') or {}).get('why')
        badge = f'<span style="display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:700;color:{VD[v][1]};background:{VD[v][2]}">{VD[v][0]}</span>' if v in VD else ''
        u = link(f"/news/{a['id']}/"); d = datetime.date.fromisoformat(a['date'])
        return f'''<tr><td style="padding:20px 28px 0">
<div style="font-size:12.5px;font-weight:700;color:#d4581f">{i:02d} · {esc(a['cat'])} <span style="font-weight:500;color:#8a8b90">· {md(d)}</span>{badge}</div>
<a href="{esc(u)}" style="display:block;margin-top:6px;font-size:17px;font-weight:700;line-height:1.45;color:#111214;text-decoration:none">{esc(a['title'])}</a>
<div style="margin-top:6px;font-size:14.5px;line-height:1.75;color:#3f4046">{esc(a['hook'])}</div>
{f'<div style="margin-top:6px;font-size:13.5px;line-height:1.6;color:#6f7076">판정 이유: {esc(why)}</div>' if why else ''}
<a href="{esc(u)}" style="display:inline-block;margin-top:8px;font-size:14px;font-weight:700;color:#111214">기사 읽기 →</a>
</td></tr>'''

    sec = lambda t: f'<tr><td style="padding:28px 28px 0"><div style="font-size:13px;font-weight:800;color:#111214;border-top:2px solid #111214;padding-top:10px">{t}</div></td></tr>'
    rest_html = ''.join(f'<li style="margin:0 0 6px"><a href="{esc(link("/news/" + a["id"] + "/"))}" style="color:#2b2c2f;text-decoration:none">{esc(a["title"])}</a></li>' for a in rest)
    tut_html = ''.join(f'<li style="margin:0 0 8px"><a href="{esc(link("/tutorial/" + t["id"][2:] + "/"))}" style="color:#111214;font-weight:700;text-decoration:none">{esc(t["title"])}</a><div style="font-size:13.5px;color:#6f7076;line-height:1.6">{esc(t.get("deck"))}</div></li>' for t in tuts)
    img = lead.get('image') or {}
    body = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>{esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;{F};color:#111214">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:24px 28px 0"><a href="{esc(link('/'))}"><img src="{SITE}/img/brand/logo-wide-mail.png" width="140" height="45" alt="SHIFT AI" style="display:block;border:0;width:140px;height:auto"></a></td></tr>
<tr><td style="padding:18px 28px 0;font-size:13px;font-weight:700;color:#6f7076">주간 메일 · {lab}</td></tr>
<tr><td style="padding:6px 28px 0;font-size:24px;font-weight:800;line-height:1.35;color:#111214">이번 주 AI 핫 이슈</td></tr>
<tr><td style="padding:10px 28px 0;font-size:15px;line-height:1.75;color:#3f4046">{esc(intro)}</td></tr>
{f'<tr><td style="padding:14px 28px 0"><div style="background:#f6f6f4;border-radius:10px;padding:14px 18px;font-size:14.5px;line-height:1.7;color:#2b2c2f"><b style="display:block;margin-bottom:4px;color:#111214">편집부 한마디</b>{esc(note)}</div></td></tr>' if note else ''}
{f'<tr><td style="padding:18px 28px 0"><a href="{esc(link("/news/" + lead["id"] + "/"))}"><img src="{lead_img}" width="544" alt="{esc(img.get("alt"))}" style="display:block;border:0;width:100%;max-width:544px;height:auto;border-radius:8px"></a>' + (f'<div style="margin-top:4px;font-size:11.5px;color:#8a8b90">{esc(img.get("credit"))}</div>' if img.get('credit') else '') + '</td></tr>' if lead_img else ''}
{''.join(card(a, i + 1) for i, a in enumerate(hot))}
{sec('한 줄로 보는 다른 소식') + f'<tr><td style="padding:12px 28px 0"><ul style="margin:0;padding-left:18px;font-size:14.5px;line-height:1.6">{rest_html}</ul></td></tr>' if rest else ''}
{sec('이번 주 따라 해 볼 것') + f'<tr><td style="padding:12px 28px 0"><ul style="margin:0;padding-left:18px;font-size:14.5px;line-height:1.6">{tut_html}</ul></td></tr>' if tuts else ''}
<tr><td style="padding:26px 28px 26px"><a href="{esc(week_url)}" style="display:inline-block;background:#111214;color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:700;padding:12px 20px;border-radius:8px">이번 주 기사 {len(week)}개 판정별로 보기</a></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:16px 18px 8px;font-size:12px;line-height:1.7;color:#8a8b90;text-align:center">
SHIFT AI는 AI 소식을 회사 발표·논문 같은 원문부터 읽고 씁니다. 기사마다 끝에 원문 링크가 있습니다.<br>
이 메일은 SHIFT AI 주간 메일을 구독하신 분께 매주 월요일 보냅니다. 답장하면 편집부로 갑니다.<br>
<a href="{{{{{{RESEND_UNSUBSCRIBE_URL}}}}}}" style="color:#6f7076">구독 해지</a> · <a href="{SITE}/privacy/" style="color:#8a8b90">개인정보처리방침</a> · <a href="{SITE}/" style="color:#8a8b90">shiftaimagazine.com</a>
</td></tr></table>
</td></tr></table></body></html>'''
    vt = lambda a: f" · {VD[a['verdict']['v']][0]}" if (a.get('verdict') or {}).get('v') in VD else ''
    text = '\n'.join([f'주간 메일 · {lab}', '이번 주 AI 핫 이슈', '', intro, ''] + ([f'편집부 한마디: {note}', ''] if note else [])
                     + sum(([f"{i + 1:02d} · {a['cat']}{vt(a)}", a['title'], a['hook'], link(f"/news/{a['id']}/"), ''] for i, a in enumerate(hot)), [])
                     + (['한 줄로 보는 다른 소식'] + [f"- {a['title']} {link('/news/' + a['id'] + '/')}" for a in rest] + [''] if rest else [])
                     + (['이번 주 따라 해 볼 것'] + [f"- {t['title']} {link('/tutorial/' + t['id'][2:] + '/')}" for t in tuts] + [''] if tuts else [])
                     + [f'이번 주 기사 판정별로 보기: {week_url}', '', '구독 해지: {{{RESEND_UNSUBSCRIBE_URL}}}', f'SHIFT AI · {SITE}/'])
    return subject, body, text, week, hot


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
    ap.add_argument('--preview'); ap.add_argument('--date', help='보낼 날(월요일, YYYY-MM-DD)'); ap.add_argument('--now', action='store_true', help='예약하지 않고 바로 보냄')
    ap.add_argument('--wait', type=int, default=420, help='사이트에 기사 페이지가 올라오길 기다리는 초')
    o = ap.parse_args()
    A, DY, T = load()
    now = datetime.datetime.now(KST); today = now.date()
    if o.date:
        send = datetime.date.fromisoformat(o.date)
        if send.weekday() != 0: raise SystemExit(f'--date 는 월요일이어야 합니다: {o.date}')
    else:
        send = today + datetime.timedelta(days=(7 - today.weekday()) % 7)  # 오늘이 월요일이면 오늘, 아니면 돌아오는 월요일
        if (send - today).days > 1: print('일요일·월요일이 아니라서 할 일 없음. 다음 발송:', send); return
    subject, body, text, week, hot = build_mail(send, A, DY, T) if [a for a in A if (send - datetime.timedelta(days=7)).isoformat() <= a['date'] < send.isoformat()] else (None,) * 5
    if not subject: print('그 주 기사가 없음:', send); return
    if o.preview:
        open(o.preview, 'w').write(body); open(os.path.splitext(o.preview)[0] + '.txt', 'w').write(text)
        print('미리 보기:', o.preview, '| 제목:', subject, '| 기사', len(week), '핫', len(hot)); return

    if send.isoformat() < CFG['start']: print(f'구독 시작일({CFG["start"]}) 전이라 보내지 않음:', send); return
    if len(week) < int(CFG.get('min_articles', 4)): print(f'그 주 기사가 {len(week)}개뿐이라 건너뜀:', send); return
    if not os.environ.get('RESEND_API_KEY'):
        print('::warning::RESEND_API_KEY 비밀값이 없어 보내지 않음(_src/newsletter/SETUP.md)'); return
    seg = os.environ.get('RESEND_SEGMENT_ID') or next((x['id'] for x in (api('GET', '/segments').get('data') or []) if x.get('name') == '주간 메일'), None)
    if not seg: print("::warning::Resend 에 '주간 메일' 세그먼트가 없음(newsletter-worker 워크플로를 먼저 돌리세요)"); return
    hh, mm = map(int, CFG.get('send_time', '07:00').split(':'))
    at = datetime.datetime.combine(send, datetime.time(hh, mm), KST)
    if not o.now and now > datetime.datetime.combine(send, datetime.time(12, 0), KST):
        print('발송 시각이 한참 지나 보내지 않음:', send); return
    name = f'weekly-{send.isoformat()}'
    if already_sent(name): print('이미 만든 발송 있음:', name); return
    if not site_has(f"/news/{hot[0]['id']}/", o.wait):
        raise SystemExit(f"사이트에 /news/{hot[0]['id']}/ 가 없음(배포 대기 시간 초과). 다음 실행에서 다시 시도합니다.")
    if already_sent(name): print('이미 만든 발송 있음:', name); return  # 기다리는 동안 다른 실행이 만들었을 수 있음
    req = {'segment_id': seg, 'from': os.environ.get('NEWSLETTER_FROM') or 'SHIFT AI <news@shiftaimagazine.com>',
           'reply_to': os.environ.get('NEWSLETTER_REPLY_TO') or 'shiftai.magazine@gmail.com', 'subject': subject, 'html': body, 'text': text, 'name': name, 'send': True}
    if not o.now and at > now + datetime.timedelta(minutes=2): req['scheduled_at'] = at.isoformat()
    r = api('POST', '/broadcasts', req)
    print('발송 예약됨' if 'scheduled_at' in req else '바로 보냄', name, req.get('scheduled_at', ''), r.get('id'))


if __name__ == '__main__':
    sys.exit(main())

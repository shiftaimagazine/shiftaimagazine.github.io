"""주간 메일 준비(newsletter-worker 워크플로가 배포 전에 돌림). 비밀값은 RESEND_API_KEY · CLOUDFLARE_API_TOKEN 두 개만 있으면 된다.

하는 일(이미 돼 있으면 건너뜀, 여러 번 돌려도 같음):
  1. Resend 에 보내는 도메인(shiftaimagazine.com) 등록 → 도메인 회사(포크번)에 넣을 DNS 레코드를 실행 요약에 적고, 인증 확인을 요청
  2. Resend 세그먼트 '주간 메일' 만들기 → ID 를 다음 단계로 넘김
  3. Cloudflare 계정 ID 찾기, workers.dev 하위 주소가 없으면 만들기
결과는 $GITHUB_OUTPUT(segment_id · account_id · subdomain · domain_ok) 과 $GITHUB_STEP_SUMMARY(사람이 읽는 표)에 쓴다. 비밀값은 출력하지 않는다.
"""
import json, os, sys, urllib.error, urllib.request

DOMAIN = 'shiftaimagazine.com'
SEGMENT = '주간 메일'
SUBS = ['shiftai', 'shiftaimagazine', 'shift-ai-magazine']


def call(base, token, method, path, body=None):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'shift-ai-newsletter-setup'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b'{}')
        except Exception: return e.code, {}


def main():
    rk, ck = os.environ.get('RESEND_API_KEY'), os.environ.get('CLOUDFLARE_API_TOKEN')
    if not rk or not ck: sys.exit('RESEND_API_KEY · CLOUDFLARE_API_TOKEN 저장소 비밀값이 필요합니다(_src/newsletter/SETUP.md)')
    R = lambda m, p, b=None: call('https://api.resend.com', rk, m, p, b)
    C = lambda m, p, b=None: call('https://api.cloudflare.com/client/v4', ck, m, p, b)
    out, summ = {}, ['## 주간 메일 준비 결과', '']

    # 1. 보내는 도메인
    s, d = R('GET', '/domains')
    if s == 401 or s == 403: sys.exit(f'Resend API 키가 맞지 않거나 권한이 부족합니다({s}). 키를 Full access 로 다시 만들어 주세요.')
    dom = next((x for x in (d.get('data') or []) if x.get('name') == DOMAIN), None)
    if not dom:
        s, dom = R('POST', '/domains', {'name': DOMAIN, 'region': 'us-east-1'})
        if s >= 300: sys.exit(f'도메인 등록 실패 {s} {json.dumps(dom, ensure_ascii=False)[:300]}')
        print('Resend 도메인 등록함')
    s, full = R('GET', f"/domains/{dom['id']}")
    if s < 300: dom = full
    status = dom.get('status')
    if status != 'verified': R('POST', f"/domains/{dom['id']}/verify")
    out['domain_ok'] = '1' if status == 'verified' else '0'
    summ += [f"### 1. 보내는 도메인 {DOMAIN}: **{'인증됨' if status == 'verified' else '인증 전 (' + str(status) + ')'}**", '']
    if status != 'verified':
        summ += ['포크번 DNS 에 아래 레코드를 넣어 주세요(호스트는 포크번 입력칸 기준, 도메인 부분은 뺀 값). 넣은 뒤 이 워크플로를 다시 돌리면 인증을 확인합니다.', '',
                 '| 종류 | 호스트 | 값 | 우선순위 | 상태 |', '|---|---|---|---|---|']
        for r in dom.get('records') or []:
            host = (r.get('name') or '').removesuffix('.' + DOMAIN).removesuffix(DOMAIN) or '(비움)'
            summ.append(f"| {r.get('type')} | `{host}` | `{r.get('value')}` | {r.get('priority', '')} | {r.get('status')} |")
        summ += [f'| TXT | `_dmarc` | `v=DMARC1; p=none;` |  | 권장(스팸함 방지) |', '']
    print('도메인 상태:', status)

    # 2. 세그먼트
    s, d = R('GET', '/segments')
    seg = next((x for x in (d.get('data') or []) if x.get('name') == SEGMENT), None) if s < 300 else None
    if not seg:
        s, seg = R('POST', '/segments', {'name': SEGMENT})
        if s >= 300: sys.exit(f'세그먼트 만들기 실패 {s} {json.dumps(seg, ensure_ascii=False)[:300]}')
        print('세그먼트 만듦')
    out['segment_id'] = seg['id']
    summ += [f"### 2. 구독자 세그먼트 '{SEGMENT}': 준비됨", '']

    # 3. Cloudflare 계정·하위 주소
    acc = os.environ.get('CLOUDFLARE_ACCOUNT_ID')
    if not acc:
        s, d = C('GET', '/accounts')
        accs = d.get('result') or []
        if s >= 300 or not accs: sys.exit(f'Cloudflare 계정을 못 찾음({s}). API 토큰을 "Cloudflare Workers 편집" 템플릿으로 만들었는지 확인해 주세요.')
        acc = accs[0]['id']
    out['account_id'] = acc
    s, d = C('GET', f'/accounts/{acc}/workers/subdomain')
    sub = (d.get('result') or {}).get('subdomain') if s < 300 else None
    if not sub:
        for name in SUBS:
            s, d = C('PUT', f'/accounts/{acc}/workers/subdomain', {'subdomain': name})
            if s < 300: sub = name; print('workers.dev 하위 주소 만듦:', name); break
        if not sub: sys.exit('workers.dev 하위 주소를 만들지 못했습니다. Cloudflare 대시보드에서 Workers & Pages 를 한 번 열어 하위 주소를 정해 주세요.')
    out['subdomain'] = sub
    summ += [f'### 3. 구독 서버 주소: `https://shift-newsletter.{sub}.workers.dev`', '']

    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
            for k, v in out.items(): f.write(f'{k}={v}\n')
    text = '\n'.join(summ) + '\n'
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f: f.write(text)
    print(text)


if __name__ == '__main__':
    main()

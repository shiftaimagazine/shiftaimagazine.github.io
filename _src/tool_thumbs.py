# 무료 도구 썸네일(img/tools/<id>.webp, 960×540)과 공유 이미지(og/tool-<id>.jpg, 1200×630)를 만든다. (11/5~ C안 · 결과 미리 보기)
# 왼쪽은 제목·한 줄 소개·SHIFT AI 로고(img/logo-wide.webp), 오른쪽 흰 카드에는 그 도구가 만들어 주는 결과를 HTML로 다시 그린다.
# 카드는 _src/thumbs/tool/<id>.html: 맨 위 't: 제목'·'sub: 소개'(둘 다 \n 으로 줄바꿈, 소개는 두 줄) 다음 '---' 줄, 그 아래 카드 안 HTML. 모양은 같은 폴더 _style.css.
# 카드 속 버튼 이름·예시 결과는 실제 도구 화면에 나오는 것을 그대로 쓴다. AI 생성 그림은 쓰지 않는다. 사진 자리는 {{photo:a|b|c}} 로 그린 풍경.
# 글꼴 Pretendard(OFL-1.1): ~/.cache/shift-thumbs/pretendard 에 없으면 npm 으로 pretendard@1.3.9 를 받아 둔다.
# 실행(저장소 루트): python3 _src/tool_thumbs.py [id ...]      미리 보기만: --out <폴더>  (사이트 파일은 그대로 둠)
import functools, html, http.server, io, json, os, subprocess, sys, tarfile, tempfile, threading
from PIL import Image
from playwright.sync_api import sync_playwright

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
CARDS = SRC + 'thumbs/tool/'
W, H = 960, 540
BG = (236, 238, 241)
FONTS = os.path.expanduser('~/.cache/shift-thumbs/pretendard/')

# tool_guide_shots.py 가 같이 쓰는 것
HIDE = 'header,.followbox,.follow-box,#toast{display:none!important} body{padding-top:0!important}'
CC_SAMPLE = ("저는 고객의 불편을 숫자로 확인하고 고치는 일을 좋아합니다. 대학 시절 학생회 홈페이지 문의 게시판을 맡았을 때, 같은 질문이 한 달에 40번 넘게 "
             "반복된다는 것을 알고 자주 묻는 질문 페이지를 만들었습니다. 그 뒤 문의가 절반 가까이 줄었고, 남는 시간에 행사 안내를 더 일찍 올릴 수 있었습니다.\n\n"
             "입사 후에도 작은 불편을 찾아 바로 고치는 사람이 되겠습니다.")
def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=ROOT)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f'http://127.0.0.1:{s.server_address[1]}'

# 사진 자리: 하늘·해·산 두 겹으로 그린 풍경 세 가지
def _photo(sky, sun, far, near, peak):
    return (f'<svg class="ph" viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="120" height="90" fill="{sky}"/>'
            f'<circle cx="86" cy="26" r="11" fill="{sun}"/><path d="M0 90 L{peak} 38 L56 64 L74 48 L120 90Z" fill="{far}"/>'
            f'<path d="M30 90 L76 56 L120 82 L120 90Z" fill="{near}"/></svg>')
PHOTO = {'a': _photo('#A9C3E6', '#FFF4C8', '#3B4250', '#16171B', 32),
         'b': _photo('#B7D6AF', '#FFFFFF', '#2F5A3A', '#16171B', 24),
         'c': _photo('#F2C9A0', '#FFF1DC', '#7A4A33', '#2B1D16', 40)}

def fonts():
    need = [f'Pretendard-{w}.woff2' for w in ('Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black')]
    if all(os.path.exists(FONTS + n) for n in need): return FONTS
    os.makedirs(FONTS, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(['npm', 'pack', 'pretendard@1.3.9', '--silent'], cwd=d, check=True, stdout=subprocess.DEVNULL)
        with tarfile.open(d + '/pretendard-1.3.9.tgz') as t:
            for n in need:
                m = t.getmember('package/dist/web/static/woff2/' + n)
                open(FONTS + n, 'wb').write(t.extractfile(m).read())
    return FONTS

def card_html(tid, font_dir):
    head, body = open(CARDS + tid + '.html', encoding='utf-8').read().split('\n---\n', 1)
    meta = dict(l.split(':', 1) for l in head.strip().splitlines())
    meta = {k.strip(): v.strip() for k, v in meta.items()}
    for k, v in PHOTO.items(): body = body.replace('{{photo:%s}}' % k, v)
    css = open(CARDS + '_style.css', encoding='utf-8').read().replace('FONT/', 'file://' + font_dir)
    title = '<br>'.join(html.escape(x) for x in meta['t'].split('\\n'))
    sub = '<br>'.join(html.escape(x) for x in meta['sub'].split('\\n'))
    cls = ('card ' + meta['card']).strip() if meta.get('card') else 'card'
    return (f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>{css}</style></head><body>'
            f'<div class="lead"><h1>{title}</h1><p>{sub}</p></div>'
            f'<img class="logo" src="file://{ROOT}img/logo-wide.webp" alt="">'
            f'<div class="{cls}">{body}</div></body></html>')

# 제목이 왼쪽 칸(350px)을 넘으면 글자를 줄이고, 카드·소개가 넘치는지 알려 준다
FIT = '''async () => {
  await document.fonts.ready;
  const h = document.querySelector('.lead h1'); let s = 64;
  while (h.scrollWidth > 350 && s > 48) { s -= 2; h.style.fontSize = s + 'px'; }
  const c = document.querySelector('.card'), p = document.querySelector('.lead p'), warn = [];
  if (c.scrollHeight > c.clientHeight + 1) warn.push('카드 높이 넘침 ' + (c.scrollHeight - c.clientHeight) + 'px');
  c.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(), b = c.getBoundingClientRect();
    if (r.width && (r.right > b.right - 20 || r.bottom > b.bottom - 20) && !e.closest('svg')) warn.push('카드 밖: ' + e.className + ' ' + (e.textContent || '').trim().slice(0, 20)); });
  const lines = Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight));
  if (lines > 2) warn.push('소개 ' + lines + '줄');
  return {size: s, warn: [...new Set(warn)].slice(0, 6)};
}'''

def render(page, tid, font_dir, tmp):
    f = os.path.join(tmp, tid + '.html')
    open(f, 'w', encoding='utf-8').write(card_html(tid, font_dir))
    page.goto('file://' + f)
    info = page.evaluate(FIT)
    big = Image.open(io.BytesIO(page.screenshot())).convert('RGB')  # 1920×1080(배율 2)
    return big, info

def save(big, tid, out_dir=None):
    thumb = big.resize((W, H), Image.LANCZOS)
    og = Image.new('RGB', (1200, 630), BG)
    og.paste(big.resize((1120, 630), Image.LANCZOS), (40, 0))  # build.py og_from 과 같은 자리(좌우 40px 바탕색)
    if out_dir:
        thumb.save(os.path.join(out_dir, tid + '.webp'), quality=88, method=6)
        return
    thumb.save(ROOT + f'img/tools/{tid}.webp', quality=88, method=6)
    og.save(ROOT + f'og/tool-{tid}.jpg', 'JPEG', quality=86, optimize=True, progressive=True)  # 썸네일보다 늦게 저장해 빌드가 다시 만들지 않게

if __name__ == '__main__':
    args, out_dir = sys.argv[1:], None
    if '--out' in args:
        i = args.index('--out'); out_dir = args[i + 1]; del args[i:i + 2]; os.makedirs(out_dir, exist_ok=True)
    tools = [t['id'] for t in json.load(open(SRC + 'news/tools.json', encoding='utf-8'))]
    only = set(args)
    fd = fonts()
    with sync_playwright() as pw, tempfile.TemporaryDirectory() as tmp:
        b = pw.chromium.launch()
        p = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, color_scheme='light')
        for tid in tools:
            if only and tid not in only: continue
            if not os.path.exists(CARDS + tid + '.html'): print('카드 파일 없음:', tid); continue
            big, info = render(p, tid, fd, tmp)
            save(big, tid, out_dir)
            print('썸네일:', tid, f"(제목 {info['size']}px)" if info['size'] != 64 else '', *(['⚠ ' + w for w in info['warn']]))
        b.close()

# 무료 도구 썸네일(img/tools/<id>.webp, 960×540)을 만든다. 공유 이미지(og/tool-<id>.jpg)도 이 그림에서 나온다.
# 실제 도구 화면을 Playwright 로 띄워 찍고(예시 넣기 → 결과까지), 노란 바탕 위 카드로 얹은 뒤 도구 이름과 한 줄 소개를 적는다.
# 글은 news/tools.json 의 cover {t: 썸네일 제목, line: 한 줄 소개}. AI 생성 그림은 쓰지 않는다.
# 실행(저장소 루트, 빌드가 끝난 상태): python3 _src/tool_thumbs.py [id ...]
import functools, http.server, io, json, os, sys, threading
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
FD = '/usr/share/fonts/opentype/noto/'
F = lambda name, size: ImageFont.truetype(FD + f'NotoSansCJK-{name}.ttc', size, index=1)
W, H = 960, 540
BG, INK, SUB = (242, 201, 76), (17, 18, 20), (74, 62, 22)
HIDE = 'header,.followbox,.follow-box,#toast{display:none!important} body{padding-top:0!important}'

def wrap(d, text, font, width):
    words, lines, cur = text.split(' '), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width or not cur: cur = t
        else: lines.append(cur); cur = w
    return lines + [cur]

# ---------- 도구 화면 찍기 ----------
def shot(el, box=None):
    im = Image.open(io.BytesIO(el.screenshot())).convert('RGB')
    if box: im = im.crop(tuple(v * 2 for v in box))  # box 는 CSS 픽셀(x0, y0, x1, y1), 화면 배율 2
    return im

def cap_redact(p, base):
    p.goto(base + '/tools/redact/'); p.add_style_tag(content=HIDE); p.click('#rSample')
    p.wait_for_function('document.getElementById("rPrev").textContent.trim().length > 20')
    return shot(p.locator('section.tstep').nth(2), (0, 0, 508, 520))
def cap_ai_cost(p, base):
    p.set_viewport_size({'width': 680, 'height': 1000})  # 표는 넓은 화면 모양이 읽기 쉽다
    p.goto(base + '/tools/ai-cost/'); p.add_style_tag(content=HIDE)
    p.wait_for_function('document.getElementById("cTable").textContent.includes("원")')
    im = shot(p.locator('section.tstep').nth(1), (0, 0, 648, 600))
    p.set_viewport_size({'width': 540, 'height': 1000})
    return im
def cap_interpreter(p, base):
    p.goto(base + '/tools/meeting-interpreter.html'); p.add_style_tag(content='#msg{display:none!important}')  # 헤드리스 크롬의 '번역 기능 없음' 경고는 가린다
    p.wait_for_timeout(300)
    return shot(p.locator('body'), (0, 0, 540, 520))
def cap_ocr(p, base):
    p.goto(base + '/tools/ocr/'); p.add_style_tag(content=HIDE)
    p.set_input_files('#oFile', SRC + 'thumbs/ocr-sample.png'); p.click('#oRun')
    p.wait_for_function('document.getElementById("oStatus").textContent.includes("다 읽었습니다")', timeout=240000)
    res = shot(p.locator('section.tstep').nth(2), (0, 0, 508, 400))
    # 카드 위쪽에 넣은 사진, 아래쪽에 뽑은 글자: 무엇이 무엇으로 바뀌는지 한눈에
    src = Image.open(SRC + 'thumbs/ocr-sample.png').convert('RGB')
    src = src.resize((res.width - 48, round(src.height * (res.width - 48) / src.width)), Image.LANCZOS)
    band = 64
    im = Image.new('RGB', (res.width, 24 + src.height + band + res.height), (246, 246, 244))
    im.paste(src, (24, 24)); ImageDraw.Draw(im).rectangle([24, 24, 24 + src.width - 1, 24 + src.height - 1], outline=(214, 214, 210), width=2)
    ImageDraw.Draw(im).text((res.width // 2, 24 + src.height + band // 2), '↓  넣은 사진에서 뽑은 글자', font=F('Bold', 30), fill=(212, 88, 31), anchor='mm')
    im.paste(res, (0, 24 + src.height + band))
    return im
def cap_ai_tell(p, base):
    p.goto(base + '/tools/ai-tell/'); p.add_style_tag(content=HIDE); p.click('#aSample')
    p.wait_for_selector('#aRes:not([hidden])'); p.wait_for_timeout(300)
    return shot(p.locator('#aRes'), (0, 0, 508, 520))
def cap_prompt(p, base):
    p.goto(base + '/tools/prompt/'); p.add_style_tag(content=HIDE)
    p.click('#pReset'); p.click('button[data-t="report"]'); p.click('#pFill'); p.wait_for_timeout(300)
    return shot(p.locator('section.tstep').nth(1), (0, 0, 508, 520))
def shot_range(p, first, last, w=508):  # 두 요소를 위아래로 아우르는 영역(CSS 픽셀)
    box = lambda sel: p.locator(sel).evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height}}')  # 페이지 기준 좌표
    a, b = box(first), box(last)
    return Image.open(io.BytesIO(p.screenshot(clip={'x': a['x'], 'y': a['y'], 'width': min(w, a['width']), 'height': b['y'] + b['height'] - a['y']}, full_page=True))).convert('RGB')
CC_SAMPLE = ("저는 고객의 불편을 숫자로 확인하고 고치는 일을 좋아합니다. 대학 시절 학생회 홈페이지 문의 게시판을 맡았을 때, 같은 질문이 한 달에 40번 넘게 "
             "반복된다는 것을 알고 자주 묻는 질문 페이지를 만들었습니다. 그 뒤 문의가 절반 가까이 줄었고, 남는 시간에 행사 안내를 더 일찍 올릴 수 있었습니다.\n\n"
             "입사 후에도 작은 불편을 찾아 바로 고치는 사람이 되겠습니다.")
def cap_char_count(p, base):
    p.goto(base + '/tools/char-count/'); p.add_style_tag(content=HIDE)
    p.fill('#ccIn', CC_SAMPLE); p.fill('#ccGoal', '500'); p.dispatch_event('#ccGoal', 'input')
    p.wait_for_function('document.getElementById("ccTok").textContent.includes("o200k")', timeout=120000)
    return shot_range(p, 'section.tstep >> nth=1', 'section.tstep >> nth=2')
def cap_heic(p, base):
    p.goto(base + '/tools/heic-to-jpg/'); p.add_style_tag(content=HIDE)
    p.set_input_files('#hFile', SRC + 'thumbs/sample.heic')
    p.wait_for_function('document.getElementById("hStatus").textContent.includes("바꿨습니다")', timeout=120000)
    return shot_range(p, 'section.tstep >> nth=1', 'section.tstep >> nth=2')
def cap_free_alt(p, base):
    p.goto(base + '/tools/free-alternatives/'); p.add_style_tag(content=HIDE + ' .fac:nth-child(n+3){display:none}')
    p.fill('#faQ', '포토샵'); p.dispatch_event('#faQ', 'input'); p.wait_for_timeout(300)
    return shot_range(p, '.fafind', '.fap:not([hidden])')
def poll(p, sel, word, t=120):  # CSP 아래에서는 wait_for_function(eval)이 막혀 직접 기다린다
    import time
    end = time.time() + t
    while time.time() < end:
        if word in p.locator(sel).inner_text(): return
        time.sleep(0.4)
    raise TimeoutError(sel)
def cap_pdf(p, base):
    p.goto(base + '/tools/pdf-to-text/'); p.add_style_tag(content=HIDE)
    p.set_input_files('#pFile', SRC + 'thumbs/sample.pdf'); poll(p, '#pStatus', '다 읽었습니다')
    p.check('input[name=pFmt][value=md]'); p.wait_for_timeout(200)
    return shot_range(p, 'section.tstep >> nth=1', 'section.tstep >> nth=1')
def cap_subs(p, base):
    p.goto(base + '/tools/ai-subscriptions/'); p.add_style_tag(content=HIDE)
    p.evaluate('()=>{try{localStorage.removeItem("shift-subs-v1")}catch(e){}}'); p.reload(); p.add_style_tag(content=HIDE)
    for k in ('chatgpt:1', 'claude:0', 'gemini:1'): p.click(f'button[data-k="{k}"]')
    p.wait_for_timeout(200)
    return shot_range(p, 'section.tstep >> nth=1', 'section.tstep >> nth=2')
def cap_ai_format(p, base):
    p.goto(base + '/tools/ai-format/'); p.add_style_tag(content=HIDE); p.click('#fmSample'); poll(p, '#fmStatus', '카톡')
    return shot_range(p, 'section.tstep >> nth=2', 'section.tstep >> nth=2')
def cap_exif(p, base):
    p.goto(base + '/tools/exif-remove/'); p.add_style_tag(content=HIDE)
    p.set_input_files('#exFile', SRC + 'thumbs/exif-sample.jpg'); poll(p, '#exStatus', '1장 처리')
    return shot_range(p, 'section.tstep >> nth=2', 'section.tstep >> nth=2')
def cap_image(p, base):
    p.goto(base + '/tools/image-resize/'); p.add_style_tag(content=HIDE)
    p.set_input_files('#irFile', SRC + 'thumbs/insta-sample.jpg'); p.wait_for_selector('.irpv canvas'); p.wait_for_timeout(800)
    return shot_range(p, 'section.tstep >> nth=2', 'section.tstep >> nth=2')
def cap_pdf_merge(p, base):
    p.goto(base + '/tools/pdf-merge/'); p.add_style_tag(content=HIDE); p.check('input[name=pmJob][value=pick]')
    p.set_input_files('#pmFile', SRC + 'thumbs/sample.pdf'); p.wait_for_selector('.pmpg.done'); p.wait_for_timeout(1500)
    p.locator('.pmpg').nth(0).click(); p.locator('.pmpg').nth(2).click(); p.wait_for_timeout(200)
    return shot_range(p, '#pmList', '#pmPages')
def cap_table(p, base):
    p.goto(base + '/tools/table-to-markdown/'); p.add_style_tag(content=HIDE); p.click('#tmSample'); poll(p, '#tmStatus', '행')
    p.check('#tmPad'); p.wait_for_timeout(300)
    return shot_range(p, 'section.tstep >> nth=2', 'section.tstep >> nth=2')
def cap_diff(p, base):
    p.goto(base + '/tools/prompt-diff/'); p.add_style_tag(content=HIDE); p.click('#pdSample'); poll(p, '#pdStatus', '바뀐 곳')
    p.check('input[name=pdView][value=inline]'); p.wait_for_timeout(800)
    return shot_range(p, 'section.tstep >> nth=2', 'section.tstep >> nth=2')
CAP = {'ai-format': cap_ai_format, 'exif-remove': cap_exif, 'image-resize': cap_image, 'pdf-merge': cap_pdf_merge, 'table-to-markdown': cap_table, 'prompt-diff': cap_diff, 'pdf-to-text': cap_pdf, 'ai-subscriptions': cap_subs, 'redact': cap_redact, 'ai-cost': cap_ai_cost, 'interpreter': cap_interpreter, 'ocr': cap_ocr, 'ai-tell': cap_ai_tell, 'prompt': cap_prompt, 'char-count': cap_char_count, 'heic-to-jpg': cap_heic, 'free-alternatives': cap_free_alt}

# ---------- 그리기 ----------
def card(im, w, h, pad=20):
    if pad:  # 화면 가장자리에 붙은 요소는 둘레에 여백을 준다
        bg = Image.new('RGB', (im.width + pad * 4, im.height + pad * 2), im.getpixel((2, 2))); bg.paste(im, (pad * 2, pad * 2)); im = bg
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    if im.height < h:  # 화면이 짧으면 아래를 흰색으로 채워 카드가 끝까지 내려가게
        bg = Image.new('RGB', (w, h), im.getpixel((w // 2, im.height - 2))); bg.paste(im, (0, 0)); im = bg
    im = im.crop((0, 0, w, h))
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w + 30, h + 30], radius=20, fill=255)
    return im, m

def make(t, ui, out):
    c = Image.new('RGB', (W, H), BG)
    # 오른쪽: 실제 화면 카드(오른쪽·아래로 살짝 잘려 나가게)
    x0, y0, cw = 474, 48, 540
    im, m = card(ui, cw, H - y0, 0 if t['id'] == 'interpreter' else 20)
    sh = Image.new('L', (W + 200, H + 200), 0); ImageDraw.Draw(sh).rounded_rectangle([x0 + 100, y0 + 112, x0 + 130 + cw, H + 140], radius=20, fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(18)).crop((100, 100, W + 100, H + 100))
    c = Image.composite(Image.new('RGB', (W, H), (150, 112, 10)), c, sh)
    c.paste(im, (x0, y0), m)
    d = ImageDraw.Draw(c)
    d.rounded_rectangle([x0, y0, x0 + cw + 30, H + 30], radius=20, outline=(17, 18, 20), width=2)
    # 왼쪽: 표시 · 제목 · 한 줄 소개 · 아래 줄
    tag, ft = 'SHIFT AI 무료 도구', F('Bold', 22)
    tw = d.textlength(tag, font=ft)
    d.rounded_rectangle([48, 46, 48 + tw + 32, 46 + 44], radius=22, fill=INK)
    d.text((64, 68), tag, font=ft, fill=BG, anchor='lm')
    cv = t.get('cover') or {}
    ftt, fl = F('Black', 64), F('Medium', 27)
    lines = [x for ln in (cv.get('t') or t['title']).split('\n') for x in wrap(d, ln, ftt, 392)][:2]   # 줄바꿈(\n)을 직접 적을 수 있다
    sub = [x for ln in (cv.get('line') or '').split('\n') for x in wrap(d, ln, fl, 396)][:3]
    y = 136
    for ln in lines: d.text((46, y), ln, font=ftt, fill=INK, anchor='lt'); y += 80
    y += 14
    for ln in sub: d.text((48, y), ln, font=fl, fill=SUB, anchor='lt'); y += 41
    d.text((48, H - 46), '무료 · 설치·가입 없음', font=F('Bold', 23), fill=INK, anchor='ls')
    c.save(out, quality=86, method=6)

def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=ROOT)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f'http://127.0.0.1:{s.server_address[1]}'

if __name__ == '__main__':
    tools = json.load(open(SRC + 'news/tools.json'))
    only = set(sys.argv[1:])
    srv, base = serve()
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page(viewport={'width': 540, 'height': 1000}, device_scale_factor=2, color_scheme='light')
        for t in tools:
            if only and t['id'] not in only: continue
            if t['id'] not in CAP: print('찍는 방법 없음:', t['id']); continue
            out = ROOT + f"img/tools/{t['id']}.webp"
            make(t, CAP[t['id']](p, base), out)
            print('썸네일:', t['id'], '→', out[len(ROOT):])
        b.close()
    srv.shutdown()

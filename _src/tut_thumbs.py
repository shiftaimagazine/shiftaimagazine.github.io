# 튜토리얼 목록 썸네일(img/cover/<id>.webp, 960×540)을 실제 사진으로 만든다.
# 사진은 news/tutorial_links.json 의 TFIG(사진 경로, 출처). 사진 위에 'SHIFT AI 튜토리얼' 표시와 한 줄 소개(cover.line)를 얹는다.
# 실행: python3 _src/tut_thumbs.py  (저장소 루트에서) — 글꼴: Noto Sans CJK KR
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
FONT_B = os.environ.get('KR_FONT_BOLD', '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc')
FONT_M = os.environ.get('KR_FONT_MED', '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc')
F = lambda path, size: ImageFont.truetype(path, size, index=1 if path.endswith('.ttc') else 0)
ACCENT = (212, 88, 31)
W, H = 960, 540
LOGO = {'t-pdf-to-markdown'}
BUSY = {'t-meeting-interpreter', 't-redact-before-upload', 't-spreadsheet-formulas', 't-resume-review', 't-pdf-to-markdown'}

def wrap(d, text, font, width):
    words, lines, cur = text.split(' '), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width or not cur: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); return lines

def make(t, photo, out):
    im = Image.open(ROOT + photo).convert('RGB').resize((W, H), Image.LANCZOS)
    if t['id'] in LOGO:  # 로고 그림: 작게 줄여 위쪽에 두고 아래는 글 자리로
        bg = Image.new('RGB', (W, H), im.getpixel((5, 5))); sm = im.resize((int(W * .62), int(H * .62)), Image.LANCZOS)
        bg.paste(sm, ((W - sm.width) // 2, 18)); im = bg
    y0, top = (130, 248) if t['id'] in BUSY else (190, 228)
    shade = Image.new('L', (1, H))
    for y in range(H): shade.putpixel((0, y), int(min(1, max(0, (y - y0) / (H - 60 - y0))) ** 1.1 * top))
    im = Image.composite(Image.new('RGB', (W, H), (12, 12, 14)), im, shade.resize((W, H)))
    d = ImageDraw.Draw(im)
    tag, f_tag = 'SHIFT AI 튜토리얼', F(FONT_B, 23)
    tw = d.textlength(tag, font=f_tag)
    d.rounded_rectangle([36, 32, 36 + tw + 32, 32 + 44], radius=22, fill=ACCENT)
    d.text((52, 54), tag, font=f_tag, fill='white', anchor='lm')
    line = (t.get('cover') or {}).get('line') or t['title']
    f_line = F(FONT_B, 48)
    lines = wrap(d, line, f_line, W - 96)[:2]
    meta = f"{'STEP' if t.get('kind') == 'steps' else '프롬프트'} {len(t['items'])}개 · {t['time']}"
    f_meta = F(FONT_M, 25)
    y = H - 50
    d.text((48, y), meta, font=f_meta, fill=(225, 225, 222), anchor='ls')
    y -= 50
    for ln in reversed(lines):
        d.text((48, y), ln, font=f_line, fill='white', anchor='ls'); y -= 64
    im.save(out, quality=84, method=6)

if __name__ == '__main__':
    N = SRC + 'news/'
    tl = json.load(open(N + 'tutorial_links.json'))
    tuts = json.load(open(N + 'D_tutorials.json'))['tutorials'] + [json.load(open(N + 'old_tut.json'))['cross']]
    only = set(sys.argv[1:])
    for t in tuts:
        if only and t['id'] not in only: continue
        fig = tl['TFIG'].get(t['id'])
        if not fig: print('사진 없음(글자 표지 유지):', t['id']); continue
        make(t, fig[0], ROOT + f"img/cover/{t['id']}.webp"); print('썸네일:', t['id'])

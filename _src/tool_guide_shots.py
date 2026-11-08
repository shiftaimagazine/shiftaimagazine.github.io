# 무료 도구 '사용법' 탭 사진(img/tools/guide/<id>-<번호>.webp)을 만든다(11/5~).
# 실제 도구 화면을 Playwright 로 띄워 단계마다 찍고, 눌러야 할 곳은 빨간 테두리(.tg-hl)로 표시한다. 글은 news/tool_guides.json.
# 실행(저장소 루트, 빌드가 끝난 상태): python3 _src/tool_guide_shots.py [id ...]   → 다시 빌드해야 페이지에 그림 크기가 들어간다.
import io, json, os, sys, time
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tool_thumbs import serve, CC_SAMPLE, HIDE

SRC = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(SRC.rstrip('/')) + '/'
OUTD = ROOT + 'img/tools/guide/'
TH = SRC + 'thumbs/'
CSS = HIDE + ' .ttabs,.pdfset,.cvset{display:none!important} .tg-hl{outline:3px solid #ff3b1f!important;outline-offset:4px!important;border-radius:8px}'
VW, MAXW = 620, 1100

def poll(p, sel, word, t=240):
    end = time.time() + t
    while time.time() < end:
        try:
            if word in p.locator(sel).first.inner_text(): return
        except Exception: pass
        time.sleep(0.4)
    raise TimeoutError(f'{sel} ~ {word}')

def hl(p, *sels):
    p.evaluate('()=>document.querySelectorAll(".tg-hl").forEach(e=>e.classList.remove("tg-hl"))')
    for s in sels: p.locator(s).first.evaluate('e=>e.classList.add("tg-hl")')

def box(p, sel):
    return p.locator(sel).first.evaluate('e=>{const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}}')

def cap(p, first, last=None, maxh=None, pad=14):
    a = box(p, first); b = box(p, last) if last else a
    x0, y0 = max(0, min(a['x'], b['x']) - pad), max(0, a['y'] - pad)
    x1 = min(VW, max(a['x'] + a['w'], b['x'] + b['w']) + pad); y1 = b['y'] + b['h'] + pad
    if maxh: y1 = min(y1, y0 + maxh)
    p.wait_for_timeout(150)
    im = Image.open(io.BytesIO(p.screenshot(clip={'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}, full_page=True))).convert('RGB')
    if im.width > MAXW: im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
    return im

T = lambda n: f'#tpTool section.tstep >> nth={n}'

# ---------- 도구별 찍는 방법: 단계 하나 = 이미지 하나 ----------
def g_ai_format(p):
    p.click('#fmSample'); poll(p, '#fmStatus', '카톡')
    hl(p, '#fmIn'); yield cap(p, T(0))
    hl(p, '#tpTool .seg'); yield cap(p, T(1))
    hl(p, '#fmCopy'); yield cap(p, T(2), maxh=760)
    p.check('input[name=fmTo][value=rich]'); poll(p, '#fmStatus', '서식'); hl(p, '#fmRich'); yield cap(p, T(2), maxh=900)
    # 한글 2018 의 'HTML 문서 붙이기' 창(11/5 사용자 PC에서 실제로 뜬 창, thumbs/guide/hwp-paste.png)
    im = Image.open(TH + 'guide/hwp-paste.png').convert('RGB'); yield im

def g_exif(p):
    hl(p, '#exDrop'); yield cap(p, T(0))
    hl(p, '#tpTool .seg'); yield cap(p, T(1))
    p.set_input_files('#exFile', TH + 'exif-sample.jpg'); poll(p, '#exStatus', '1장 처리')
    hl(p, '.exrows'); yield cap(p, T(2), maxh=520)
    hl(p, '.exok'); yield cap(p, T(2), maxh=520)

def g_image(p):
    hl(p, '#irDrop'); yield cap(p, T(0))
    hl(p, '#tpTool section.tstep:nth-of-type(2) .seg'); yield cap(p, T(1), maxh=520)
    p.set_input_files('#irFile', TH + 'guide/책상사진.jpg'); p.wait_for_selector('.irpv canvas'); p.wait_for_timeout(700)
    hl(p, '.irpv'); yield cap(p, T(2), maxh=560)
    hl(p, '#irZip'); yield cap(p, T(2))

def g_pdf_merge(p):
    hl(p, '#tpTool .seg'); yield cap(p, T(0))
    p.set_input_files('#pmFile', [TH + 'guide/지원서.pdf', TH + 'guide/증빙자료.pdf']); poll(p, '#pmStatus', '2개 파일')
    hl(p, '#pmList'); yield cap(p, T(1))
    p.check('input[name=pmJob][value=pick]'); p.set_input_files('#pmFile', TH + 'sample.pdf')
    p.wait_for_selector('.pmpg.done'); p.wait_for_timeout(1200)
    p.locator('.pmpg').nth(0).click(); p.locator('.pmpg').nth(2).click()
    hl(p, '.pmpages'); yield cap(p, T(1), maxh=640)
    hl(p, '#pmGo'); yield cap(p, T(2))

def g_table(p):
    p.click('#tmSample'); poll(p, '#tmStatus', '행')
    hl(p, '#tmIn'); yield cap(p, T(0))
    p.locator('#tmCols button').nth(4).click(); hl(p, '#tmCols'); yield cap(p, T(1))
    p.wait_for_timeout(1200); hl(p, '#tmCopy'); yield cap(p, T(2), maxh=620)

def g_diff(p):
    p.click('#pdSample'); poll(p, '#pdStatus', '바뀐 곳')
    hl(p, '.pdin'); yield cap(p, T(0), maxh=560)
    hl(p, '#tpTool section.tstep:nth-of-type(2) .trow'); yield cap(p, T(1))
    p.wait_for_timeout(1000); hl(p, '#pdOut'); yield cap(p, T(2), maxh=760)
    hl(p, '#pdCopy'); yield cap(p, '#pdCopy >> xpath=..', '#tpTool section.tstep:nth-of-type(3) p.hint')

def g_subs(p):
    p.evaluate('()=>{try{localStorage.removeItem("shift-subs-v1")}catch(e){}}'); p.reload(); p.add_style_tag(content=CSS)
    for k in ('chatgpt:1', 'claude:1', 'gemini:1'): p.click(f'button[data-k="{k}"]')
    hl(p, '#sSvc'); yield cap(p, T(0), maxh=640)
    hl(p, '#sList'); yield cap(p, T(1))
    hl(p, '#sSum'); yield cap(p, T(2), maxh=760)

def g_ai_cost(p):
    p.wait_for_timeout(500); hl(p, '#cPresets'); yield cap(p, T(0))
    hl(p, '.cgrid'); yield cap(p, T(0))
    hl(p, '#cTable'); yield cap(p, T(1), maxh=700)

def g_pdf(p):
    hl(p, '#pDrop'); yield cap(p, T(0))
    p.set_input_files('#pFile', TH + 'sample.pdf'); poll(p, '#pStatus', '다 읽었습니다')
    hl(p, '#pOut'); yield cap(p, T(1), maxh=640)
    hl(p, '#pCopy'); yield cap(p, T(1), maxh=640)

def g_free(p):
    p.add_style_tag(content='.fac:nth-child(n+3){display:none}')
    p.fill('#faQ', '포토샵'); p.dispatch_event('#faQ', 'input'); p.wait_for_timeout(300)
    hl(p, '#faQ'); yield cap(p, '.fafind', '#faCats')
    hl(p, '#faCats'); yield cap(p, '.fafind', '#faCats')
    hl(p, '.fap:not([hidden]) .fac'); yield cap(p, '.fap:not([hidden])', maxh=820)

def g_char(p):
    p.fill('#ccIn', CC_SAMPLE); p.dispatch_event('#ccIn', 'input')
    hl(p, '#ccIn'); yield cap(p, T(0))
    hl(p, '#ccStats'); yield cap(p, T(1))
    p.fill('#ccGoal', '500'); p.dispatch_event('#ccGoal', 'input'); hl(p, '#ccGoal'); yield cap(p, T(2))
    poll(p, '#ccTok', 'o200k'); hl(p, '#ccTok'); yield cap(p, T(3))

def g_heic(p):
    hl(p, '#hDrop'); yield cap(p, T(0))
    hl(p, '#tpTool section.tstep:nth-of-type(2) .seg'); yield cap(p, T(1))
    p.set_input_files('#hFile', TH + 'sample.heic'); poll(p, '#hStatus', '바꿨습니다')
    hl(p, '#hZip'); yield cap(p, T(2))

def g_ocr(p):
    p.set_input_files('#oFile', TH + 'ocr-sample.png'); p.wait_for_timeout(500)
    hl(p, '#oDrop'); yield cap(p, T(0))
    hl(p, '#oRun'); yield cap(p, T(1))
    p.click('#oRun'); poll(p, '#oStatus', '다 읽었습니다')
    hl(p, '#oCopy'); yield cap(p, T(2), maxh=700)

def g_ai_tell(p):
    p.click('#aSample'); hl(p, '#aRun'); yield cap(p, T(0), maxh=520)
    p.click('#aRun'); p.wait_for_selector('#aRes:not([hidden])'); p.wait_for_timeout(300)
    hl(p, '#aLevel'); yield cap(p, '#aRes', maxh=560)
    hl(p, '#aList'); yield cap(p, '#aList', maxh=620)
    hl(p, '#aPrompt'); yield cap(p, T(2))

def g_prompt(p):
    p.click('#pReset'); p.click('button[data-t="report"]')
    hl(p, '#pTpl'); yield cap(p, T(0))
    p.click('#pFill'); p.wait_for_timeout(300); hl(p, '#pFields'); yield cap(p, T(1), maxh=760)
    hl(p, '#pCopy'); yield cap(p, T(2), maxh=700)

def g_redact(p):
    p.click('#rSample'); p.wait_for_timeout(500)
    hl(p, '#rIn'); yield cap(p, T(0), maxh=560)
    hl(p, '#rTypes'); yield cap(p, T(1), maxh=600)
    hl(p, '#rPrev'); yield cap(p, T(2), maxh=700)
    p.fill('#rAi', '[가림1]님, 문의하신 결제 오류는 확인 후 [전화번호1]로 연락드리겠습니다. 환불은 [계좌번호1] 계좌로 진행됩니다.'); p.dispatch_event('#rAi', 'input'); p.wait_for_timeout(300)
    hl(p, '#rAi'); yield cap(p, T(3), maxh=700)

def g_doc(p):
    p.set_input_files('#dtFile', [TH + 'guide/주간업무보고.hwpx', TH + 'guide/신제품출시계획.pptx']); poll(p, '#dtStatus', '다 읽었습니다')
    hl(p, '#dtDrop'); yield cap(p, T(0), maxh=560)
    hl(p, '#tpTool .ochecks'); yield cap(p, T(0), maxh=700)
    p.select_option('#dtPick', p.locator('#dtPick option').nth(1).get_attribute('value')); p.wait_for_timeout(300)
    hl(p, '#dtOut'); yield cap(p, T(1), maxh=680)
    hl(p, '#dtCopy', '#dtAsk'); yield cap(p, T(1), maxh=760)

def g_jpg(p):
    p.set_input_files('#ipFile', [TH + 'guide/책상사진.jpg', TH + 'ocr-sample.png', TH + 'insta-sample.jpg']); poll(p, '#ipStatus', '장')
    p.wait_for_timeout(400); hl(p, '#ipDrop'); yield cap(p, T(0), maxh=600)
    hl(p, '#ipList'); yield cap(p, T(0), maxh=600)
    hl(p, '#tpTool section.tstep:nth-of-type(2) .seg'); yield cap(p, T(1))
    p.click('#ipGo'); poll(p, '#ipHint', '만들었습니다'); hl(p, '#ipOutList'); yield cap(p, T(2))

def g_pj(p):
    p.set_input_files('#pjFile', TH + 'sample.pdf'); p.wait_for_selector('.pmpg.done'); p.wait_for_timeout(1200)
    hl(p, '#pjDrop'); yield cap(p, T(0), maxh=640)
    p.locator('.pmpg').nth(0).click(); p.locator('.pmpg').nth(2).click(); p.wait_for_timeout(200)
    hl(p, '#pjPages'); yield cap(p, T(0), maxh=700)
    hl(p, '#tpTool section.tstep:nth-of-type(2) .seg'); yield cap(p, T(1))
    p.click('#pjGo'); poll(p, '#pjHint', '만들었습니다'); hl(p, '#pjOut'); yield cap(p, T(2))

def g_chart(p):
    p.click('#tcSample'); p.wait_for_timeout(300)
    hl(p, '#tcIn'); yield cap(p, T(0), maxh=620)
    hl(p, '#tcColsW'); yield cap(p, T(0))
    hl(p, '.tcseg'); yield cap(p, T(1), maxh=720)
    p.wait_for_timeout(300); hl(p, '#tcPng', '#tcCopy'); yield cap(p, T(2), maxh=820)

def g_box(p):
    p.evaluate('()=>{try{localStorage.removeItem("shift-promptbox-v1")}catch(e){}}'); p.reload(); p.add_style_tag(content=CSS); p.wait_for_timeout(300)
    p.click('#pbStarter'); p.wait_for_timeout(200)
    p.fill('#pbTitle', '거래처 납기 안내 메일'); p.fill('#pbTag', '메일')
    p.fill('#pbBody', '당신은 [회사명] 영업 담당자입니다. [거래처 이름]에 납기가 [새 납기]로 늦어진다고 알리는 메일을 써 주세요.\n- 사과는 한 번만, 늦어진 까닭은 한 문장으로\n- 300자 이내, 습니다체'); p.dispatch_event('#pbBody', 'input')
    hl(p, '#pbBody', '#pbFound'); yield cap(p, T(0), maxh=640)
    hl(p, '#pbList'); yield cap(p, T(1), maxh=640)
    p.locator('.pbc', has_text='고객 메일').locator('button[data-use]').click(); p.wait_for_timeout(300)
    f = p.locator('#pbFields [data-b]'); f.nth(0).fill('SHIFT 상사'); f.nth(0).dispatch_event('input'); f.nth(1).fill('11월 14일까지'); f.nth(1).dispatch_event('input'); p.wait_for_timeout(200)
    hl(p, '#pbFields'); yield cap(p, T(2), maxh=760)
    hl(p, '#pbCopy'); yield cap(p, '#pbPrev', '#pbCopy')

def g_check(p):
    p.click('#kcSample'); p.wait_for_timeout(300)
    hl(p, '#kcIn'); yield cap(p, T(0))
    hl(p, '#kcSlots'); yield cap(p, '#kcSlots', '#kcMark')
    hl(p, '#kcMark'); yield cap(p, '#kcMark', '#kcList', maxh=760)
    hl(p, '#kcCopy'); yield cap(p, T(2), maxh=760)

def g_doc_compare(p):
    p.click('#dcSample'); poll(p, '#dcStatus', '바뀐 곳')
    hl(p, '.dcin'); yield cap(p, T(0), maxh=640)
    hl(p, '#tpTool section.tstep:nth-of-type(2) .trow'); yield cap(p, T(1))
    hl(p, '#dcListW'); yield cap(p, '#dcStats', '#dcListW', maxh=760)
    p.locator('#dcList button').nth(2).click(); p.wait_for_timeout(600)
    hl(p, '#dcR2'); yield cap(p, '#dcOut', maxh=560)
    hl(p, '#dcCopy >> xpath=..'); yield cap(p, '#dcCopy >> xpath=..', '#tpTool section.tstep:nth-of-type(3) p.hint')

def g_excel_merge(p):
    hl(p, '#tpTool .seg'); yield cap(p, T(0))
    p.click('#xmSample'); poll(p, '#xmSum', '줄')
    hl(p, '#xmList'); yield cap(p, T(1))
    hl(p, '.xmgrid'); yield cap(p, T(2))
    hl(p, '#xmPrev', '#xmGo'); yield cap(p, T(3), maxh=900)

def g_pdf_sign(p):
    hl(p, '#psDrop'); yield cap(p, T(0))
    p.check('input[name=psKind][value=seal]'); p.fill('#psName', '김하늘'); p.dispatch_event('#psName', 'input'); p.wait_for_timeout(700)
    hl(p, '#psSeal'); yield cap(p, T(1), maxh=640)
    p.click('#psSealUse'); p.check('input[name=psKind][value=text]'); p.click('#psTextUse'); p.click('.pstk:nth-child(1) > button:first-child'); p.wait_for_timeout(300)
    hl(p, '#psTrayW'); yield cap(p, '#psTrayW')
    p.set_input_files('#psFile', TH + 'guide/지원서.pdf'); p.wait_for_selector('.pspage.done'); p.wait_for_timeout(800)
    pg = p.locator('.pspage').first; bb = pg.bounding_box()
    pg.click(position={'x': bb['width'] * 0.72, 'y': bb['height'] * 0.82}); p.wait_for_timeout(300)
    p.evaluate('()=>{const s=document.querySelector(".psit.on");if(s)s.scrollIntoView({block:"center"})}'); p.wait_for_timeout(300)
    hl(p, '.psit.on'); yield cap(p, '#psPages', maxh=760)
    hl(p, '#psGo'); yield cap(p, T(3))

G = {'ai-format': g_ai_format, 'exif-remove': g_exif, 'image-resize': g_image, 'pdf-merge': g_pdf_merge, 'table-to-markdown': g_table,
     'prompt-diff': g_diff, 'ai-subscriptions': g_subs, 'ai-cost': g_ai_cost, 'pdf-to-text': g_pdf, 'free-alternatives': g_free,
     'char-count': g_char, 'heic-to-jpg': g_heic, 'ocr': g_ocr, 'ai-tell': g_ai_tell, 'prompt': g_prompt, 'redact': g_redact,
     'doc-to-text': g_doc, 'jpg-to-pdf': g_jpg, 'pdf-to-jpg': g_pj, 'table-to-chart': g_chart, 'prompt-box': g_box, 'prompt-check': g_check,
     'doc-compare': g_doc_compare, 'excel-merge': g_excel_merge, 'pdf-sign': g_pdf_sign}

if __name__ == '__main__':
    guides = {k: v for k, v in json.load(open(SRC + 'news/tool_guides.json')).items() if not k.startswith('_')}
    tools = {t['id']: t for t in json.load(open(SRC + 'news/tools.json'))}
    only = set(sys.argv[1:]); os.makedirs(OUTD, exist_ok=True)
    srv, base = serve(); bad = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for tid, g in guides.items():
            if only and tid not in only: continue
            ctx = b.new_context(viewport={'width': VW, 'height': 1000}, device_scale_factor=2, color_scheme='light', accept_downloads=False)
            p = ctx.new_page(); p.goto(base + tools[tid]['href'] + '#use'); p.add_style_tag(content=CSS); p.wait_for_timeout(400)
            n = 0
            try:
                for im in G[tid](p):
                    n += 1; im.save(OUTD + f'{tid}-{n}.webp', quality=82, method=6)
            except Exception as e: bad.append((tid, n + 1, str(e)[:200]))
            print(tid, f'{n}/{len(g["steps"])}장')
            if n != len(g['steps']): bad.append((tid, '단계 수와 사진 수가 다름', n, len(g['steps'])))
            ctx.close()
        b.close()
    srv.shutdown()
    if bad: print('문제:', *bad, sep='\n'); sys.exit(1)

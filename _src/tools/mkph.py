# Turn captured originals into 16:9 960x540 covers (cover-crop or fit-with-background) and inline figures.
from PIL import Image, ImageStat
import sys, os
B='/tmp/claude-0/-home-claude/c2ff34f4-fd33-5365-97b1-c593f899f6fb/scratchpad/'
G=B+'grab/'; O=B+'site/img/ph/'
W,H=960,540
def border_color(im):
    im=im.convert('RGB'); w,h=im.size
    strips=[im.crop((0,0,w,4)),im.crop((0,h-4,w,h)),im.crop((0,0,4,h)),im.crop((w-4,0,w,h))]
    px=[]
    for s in strips: px+=list(s.getdata())
    px.sort(key=lambda p:sum(p)); return px[len(px)//2]
def cover(im,fx=0.5,fy=0.5):
    im=im.convert('RGB'); w,h=im.size; r=max(W/w,H/h); nw,nh=round(w*r),round(h*r)
    im=im.resize((nw,nh),Image.LANCZOS); x=int((nw-W)*fx); y=int((nh-H)*fy)
    return im.crop((x,y,x+W,y+H))
def fit(im,bg=None,pad=0):
    im=im.convert('RGB'); bg=bg or border_color(im); w,h=im.size
    r=min((W-2*pad)/w,(H-2*pad)/h); nw,nh=round(w*r),round(h*r)
    c=Image.new('RGB',(W,H),bg); c.paste(im.resize((nw,nh),Image.LANCZOS),((W-nw)//2,(H-nh)//2)); return c
def inline(im,maxw=1200):
    im=im.convert('RGB'); w,h=im.size
    if w>maxw: im=im.resize((maxw,round(h*maxw/w)),Image.LANCZOS)
    return im
JOBS=[
 # (source, out, mode, kwargs)
 ('2026-10-23-aisi-mythos5-alignment.webp','aisi.webp','fit',{}),
 ('2026-10-23-openai-offline-training.webp','openai-offline.webp','cover',{}),
 ('shot-whatsapp.png','whatsapp-redact.webp','cover',{}),
 ('pa-head.webp','pa-capitol.webp','cover',{'fy':0.55}),
 ('shot-google.png','google-privacy.webp','cover',{}),
 ('shot-nikon.png','nikon-statement.webp','cover',{}),
 ('2026-10-24-kimi-k3-1-pro.webp','kimi.webp','fit',{}),
 ('2026-10-22-cerebras-trillion-deploy.webp','cerebras.webp','fit',{}),
 ('2026-10-07-claude-haiku-5-5.webp','haiku.webp','cover',{}),
 ('2026-10-23-oracle-partner-1b.webp','oracle.webp','fit',{}),
 ('apollo-c2.webp','apollo-margin.webp','fit',{'bg':(255,255,255)}),
 ('2026-09-27-apricitas-creative-class-jobs.webp','apricitas.webp','cover',{}),
 ('2026-10-19-openai-low-resource-languages.webp','openai-lowres.webp','cover',{}),
 ('arx1-a.webp','arxiv-aitext.webp','fit',{'bg':(255,255,255),'pad':16}),
 ('shot-skin.png','lynchlab.webp','cover',{}),
 ('mit-tower.webp','mit-tower.webp','fit',{'bg':(255,255,255),'pad':8}),
 ('dm-portal.webp','minecraft-portal.webp','cover',{}),
 ('konami-cover.webp','konami-report.webp','fit',{'bg':(236,236,234),'pad':28}),
 ('paris-night.webp','paris-night.webp','cover',{'fx':0.52}),
 ('2026-10-19-naver-cloud-security-self-check.webp','naver-cloud.webp','cover',{}),
 ('2026-10-20-mistral-voxtral-3.webp','voxtral.webp','cover',{}),
 ('2026-10-21-openai-models-google-cloud.webp','openai-gcloud.webp','cover',{}),
 ('2026-10-21-naver-d2sf-traceweave.webp','d2sf.webp','fit',{'bg':(255,255,255)}),
 ('2026-10-22-anthropic-agent-skills-aaif.png','anthropic-skills.webp','cover',{}),
 ('2026-10-22-openai-decisions-api.webp','openai-decisions.webp','cover',{}),
 ('2026-10-22-skt-ax-k2-math.webp','skt.webp','cover',{'fx':0.6}),
 ('2026-10-21-nodejs-security-release.webp','nodejs.webp','cover',{}),
]
INL=[('apollo-c1.webp','apollo-revenue.webp'),('dm-aerial.webp','minecraft-aerial.webp'),('mit-spire.webp','mit-spire.webp')]
for s,o,m,kw in JOBS:
    im=Image.open(G+s); res=cover(im,**kw) if m=='cover' else fit(im,**kw)
    res.save(O+o,'WEBP',quality=82,method=6); print(o, os.path.getsize(O+o)//1024,'KB', im.size)
for s,o in INL:
    im=inline(Image.open(G+s)); im.save(O+o,'WEBP',quality=82,method=6); print(o, os.path.getsize(O+o)//1024,'KB', im.size)

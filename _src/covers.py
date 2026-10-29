# 표지 인포그래픽: covers.js 로 png 를 그린 뒤 1280×720 webp 로 바꾼다(16:9, 공유 이미지로도 선명하게).
#   python3 _src/covers.py              # covers.json 전부
#   python3 _src/covers.py c-grok-family # 하나만
import os, subprocess, sys
from PIL import Image
SRC = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(SRC)
ids = sys.argv[1:]
subprocess.run(['node', os.path.join(SRC, 'covers.js')] + ids, check=True, cwd=SRC)
import json
for c in json.load(open(os.path.join(SRC, 'news/covers.json'))):
    if ids and c['id'] not in ids: continue
    png = os.path.join(OUT, 'img/cover', c['id'] + '.png')
    Image.open(png).convert('RGB').resize((1280, 720), Image.LANCZOS).save(png[:-4] + '.webp', 'WEBP', quality=88, method=6)
    os.remove(png)
    print('webp', c['id'])

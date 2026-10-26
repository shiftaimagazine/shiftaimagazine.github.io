# Extract SHIFTIMG:<id>:<dataurl> payloads from the session log and tool-results files.
import json,re,base64,glob,os,sys
OUT=sys.argv[1]
os.makedirs(OUT,exist_ok=True)
pat=re.compile(r'SHIFTIMG:([A-Za-z0-9._-]+):data:image/(\w+);base64,([A-Za-z0-9+/=]+)')
srcs=['/root/.claude/projects/-home-claude/c2ff34f4-fd33-5365-97b1-c593f899f6fb.jsonl']+glob.glob('/root/.claude/projects/-home-claude/c2ff34f4-fd33-5365-97b1-c593f899f6fb/tool-results/*')
found={}
for s in srcs:
    if os.path.isdir(s): continue
    t=open(s,errors='ignore').read()
    for m in pat.finditer(t):
        i,ext,b=m.groups()
        if len(b)<2000: continue
        found[i]=(ext,b)
for i,(ext,b) in found.items():
    try:
        d=base64.b64decode(b+'='*(-len(b)%4))
    except Exception as e:
        print('bad',i,e); continue
    open(f'{OUT}/{i}.{ext}','wb').write(d)
    print(i,ext,len(d))

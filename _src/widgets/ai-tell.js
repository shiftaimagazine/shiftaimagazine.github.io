// SHIFT AI 무료 도구 — AI 티 검사기.
// 규칙은 SHIFT AI 기사 점검기(_src/humanize/shift_humanize.py)를 일반 글(습니다체·해요체·한다체)에 맞게 옮긴 것입니다.
// 그 점검기의 규칙 일부는 humanize-korean(github.com/epoko77-ai/im-not-ai, MIT)과
// humanizer-kr(github.com/hjongc/humanizer-kr, MIT)에서 가져왔습니다. 글은 어디에도 보내지 않습니다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("aIn")) return;
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let toastT; const toast = msg=>{ const t=document.getElementById("toast"); if(!t) return; t.textContent=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };

// ---------- 규칙 ----------
// sev 1 = 한 번만 나와도 표시, 2 = min 번 이상 나올 때만 표시
const R = [];
const rule = (id,name,sev,rx,fix,min=1,why="")=>R.push({id,name,sev,rx:new RegExp(rx,"g"),fix,min,why});
const END = "(?:습니다|니다|다|어요|아요|해요|예요|이에요|요)";
rule("C-8","'A가 아니라 B' 대구 반복",1,"(?:[가-힣][이가]|것이|게|건)\\s*아니라(?=[,\\s])|것은\\s*아닙니다|것은\\s*아니다|게\\s*아니(?:다|에요|라)",
  "가장 좋은 하나만 남기고, 나머지는 B를 바로 말하는 문장으로 바꿉니다.",2,"사람 글보다 AI 글에서 열 배 넘게 자주 나온다는 분석이 있는, 가장 강한 신호입니다.");
rule("D-8","'핵심은·관건은' 정리 문구",1,"핵심은|관건은|요점은|주목할\\s*(?:점|대목)은|눈여겨볼\\s*(?:점|대목)은|중요한\\s*건",
  "'핵심은 X입니다' 대신 'X가 가장 중요합니다'처럼 바로 말하거나, 그냥 X 이야기를 합니다.");
rule("D-2","의미를 부풀리는 말",1,"시사하는\\s*바|시사(?:합니다|한다|해요)|시사점|주목할\\s*만(?:합니다|하다|해요|한)|눈여겨볼|의미가\\s*(?:큽니다|크다|커요)|의미심장|매우\\s*중요(?:합니다|하다|해요)|중요한\\s*의미를",
  "의미를 선언하지 말고, 그래서 읽는 사람에게 무엇이 달라지는지 사실로 씁니다.");
rule("I-3b","'~인 셈입니다'",1,"셈입니다|셈이(?:죠|다|에요)|인\\s*셈",
  "계산이나 비유로 정리하지 말고 사실 문장으로 끝냅니다.");
rule("META","예고·안내 문장",1,"(?:짚어|살펴|알아|정리해|들여다)\\s*(?:봅니다|보겠습니다|볼까요|보자|보겠다|볼게요|봐요|보면\\s*다음과)|다음과\\s*같(?:습니다|다|아요)",
  "'살펴보겠습니다', '다음과 같습니다' 같은 예고 없이 바로 내용으로 들어갑니다.");
rule("D-1","결산 접속어",1,"(?:^|[\\s.])(?:결론적으로|요약하면|요컨대|종합하면|정리하면|정리하자면|한마디로)(?=[\\s,])",
  "결산 표지를 지우고 결론 문장만 남깁니다.");
rule("D-9","'결국'",1,"(?:^|\\s)결국(?=[\\s,])","'결국'을 빼고 원인과 결과를 구체적으로 잇습니다.");
rule("J-3","대시(—)로 잇기",1,"[—–―]","대시 대신 쉼표나 괄호를 쓰거나 두 문장으로 나눕니다.");
rule("HYPE","과장 광고 문구",1,"혁신적|획기적|게임\\s*체인저|판도를\\s*(?:바꾸|뒤집|흔)|새로운\\s*지평|패러다임|압도적|차원이\\s*다른|전례\\s*없는|역대급|파격적|대격변|지각\\s*변동|혁명적",
  "형용사로 띄우지 말고 숫자나 사례를 씁니다. 근거가 없으면 뺍니다.");
rule("CHAT","챗봇 말투 잔재",1,"물론입니다|좋은\\s*질문|도움이\\s*되(?:셨|었)으면|도움이\\s*되길|도움이\\s*되었기를|추가\\s*질문|궁금한\\s*점이\\s*(?:있으시면|있다면)|요청하신|말씀하신\\s*대로|아래에\\s*정리해\\s*드",
  "대화창에서 복사해 온 말투를 지웁니다.");
rule("A-3","번역투 '~에 있어(서)'",1,"데\\s*있어(?:서)?\\s|에\\s*있어서(?:는|도)?\\s","'~에서' 또는 '~할 때'로 바꿉니다.");
rule("A-8","이중 피동",1,"되어지|되어집니다|되어진|되어져|지게\\s*됩니다|여지게|보여지|쓰여지","'되어진다'는 '된다', '보여진다'는 '보인다'로 씁니다.");
rule("A-7","'가지고 있다' 직역",1,"(?:을|를)\\s*가지고\\s*있(?:습니다|는|다|어요)","'강점을 가지고 있습니다'는 '강점이 있습니다'로 씁니다.");
rule("D-14","사람 글에 드문 은유",1,"잠식|청사진|신호탄|적신호|경고등|뿌리내리|짓누르|움켜쥐|성적표|주춧돌",
  "은유를 사실 문장으로 풉니다('시장을 잠식' → '점유율을 가져감').");
rule("G-2","완곡 겹치기",1,"할\\s*수\\s*있을\\s*것으로\\s*(?:보|예상|전망)|가능성이\\s*있을\\s*수|것으로\\s*보여질","완곡 표현은 하나만 남깁니다.");
rule("MD","마크다운·이모지 잔재",1,"\\*\\*[^*\\n]{1,60}\\*\\*|^#{1,4}\\s|^\\s*[-*]\\s+\\*\\*|[✅🚀✨💡📌🔥👉🎯⭐️📈🧠]",
  "AI 대화창에서 복사할 때 따라온 별표(**), 샵(#), 장식 이모지를 지웁니다.");

rule("C-11","연결어미 뒤 쉼표",2,"(?:하|했|되|됐|있|없|이|았|었|였|겠|않|주|줬|두|봤|썼|받|냈|내|났|들|열|갔|왔|쓰|보)고,|(?:며|지만|면서|아서|어서|해서|여서),",
  "'~했고, ~'의 쉼표를 지웁니다.",3,"연결어미 뒤 쉼표는 사람 글보다 AI 글에 1.5배쯤 많습니다.");
rule("D-8b","'문제는·중요한 것은' 분열문",2,"(?:^|\\s)(?:문제는|중요한\\s*것은|필요한\\s*것은|답은|변수는)(?=\\s)","'문제는 X입니다' 대신 'X가 문제입니다'처럼 씁니다.",2);
rule("D-10","'~하는 이유입니다' 도치",2,"이유(?:입니다|이다|예요|이기도\\s*합니다)[.!]","'그래서 ~합니다'처럼 순서대로 씁니다.",2);
rule("D-12","'과제도 남아 있습니다' 문패",2,"과제도\\s*남|한계도\\s*(?:분명|있)|아쉬운\\s*점도|숙제도\\s*남|넘어야\\s*할\\s*산","문패 문장을 지우고 실제 과제를 첫 문장으로 씁니다.");
rule("D-14b","상투 은유",2,"승부수|출사표|박차를|잰걸음|포문|물꼬|분수령|기폭제|발목을\\s*잡|시금석|날개를\\s*달|닻을\\s*올|불씨|불을\\s*지피|칼을\\s*빼|첫발","은유 대신 무슨 일이 일어났는지 그대로 씁니다.",2);
rule("A-2","'~를 통해' 반복",2,"(?:을|를)\\s*통해|(?:을|를)\\s*통한","'~로', '~에서', '~해서'로 바꿉니다.",3);
rule("A-9","'~에 의해' 피동",2,"에\\s*의해|에\\s*의한","하는 쪽을 주어로 올립니다('AI에 의해 만들어진' → 'AI가 만든').",2);
rule("A-10","'~할 수 있습니다' 반복",2,"수\\s*있(?:습니다|다|어요)[.!?]","일부만 '~하면 됩니다', '~해도 됩니다'처럼 바꿔 리듬을 깹니다.",4);
rule("A-20","'~되고 있습니다' 반복",2,"(?:되|지)고\\s*있(?:습니다|다|어요)","일부는 '~됐습니다', '늘었습니다'처럼 단순한 시제로 씁니다.",3);
rule("A-21","'단순한 X를 넘어 Y'",2,"단순(?:한|히)\\s*[^.?!]{0,25}(?:을|를)\\s*넘어","'X만이 아니라 Y도'로 풀거나 넘어-구를 지웁니다.");
rule("A-6","'~을 바탕으로·기반' 반복",2,"(?:을|를)\\s*바탕으로|에\\s*기반(?:해|하여|한|을)|기반으로","'~로', '~를 써서'로 바꿉니다.",3);
rule("A-19","이중 조사 '~에서의·으로의'",2,"(?:에서의|에로의|으로의|에의|으로부터의|과의|와의)\\s","조사를 풀어 씁니다('한국에서의 출시' → '한국 출시').",2);
rule("A-15","'이는 ~를 보여 줍니다'",2,"(?:이번|이는|이것은)[^.?!]{0,40}(?:보여\\s*줍니다|보여줍니다|보여준다|의미합니다|의미한다|말해\\s*줍니다|드러냅니다|방증)","무엇이 무엇을 보여 주는지 말하지 말고 사실을 바로 씁니다.");
rule("G-1","'~것으로 보입니다' 추측 반복",2,"(?:것으로|로)\\s*(?:보입니다|보인다|보여요|풀이됩니다|분석됩니다|전망됩니다|관측됩니다|예상됩니다|예상된다|전망된다)","유보는 그대로 두되 끝맺음을 바꾸고, 근거가 있으면 출처를 붙입니다.",2);
rule("H-4","'즉' 남발",2,"(?:^|\\s)즉(?=[\\s,])","'즉'을 빼거나 한 번만 씁니다.",3);
rule("H-1","문장 첫머리 접속사 남발",2,"(?:^|[.?!]\\s+)(?:또한|더불어|아울러|나아가|이와\\s*함께|한편|이에\\s*따라|이를\\s*위해)(?=[\\s,])","접속사를 빼도 뜻이 통하면 뺍니다.",4);
rule("I-7","막연한 권위",2,"업계에서는|전문가들은|일각에서는|많은\\s*전문가|라는\\s*(?:분석|평가|관측|지적)(?:입니다|이\\s*나옵니다|이다)","누가 그렇게 말했는지 밝히거나, 직접 서술로 바꿉니다.");
rule("HYPE2","띄우는 형용사",2,"강력한|놀라운|완벽한|탁월한|폭발적|엄청난|다양한|효과적(?:으로|인)","형용사 대신 숫자나 사례로 보여 줍니다.",3);
rule("B-x","굳이 쓴 영어(인사이트·임팩트)",2,"인사이트|임팩트|니즈|밸류|어프로치|퍼포먼스|딜리버리|시너지","읽는 사람이 쓰는 한국어로 바꿉니다.",2);
rule("COLON","콜론(:)으로 잇기",2,"[가-힣)](?<!예)(?<!참고)(?<!주의)(?<!보기)\\s*:\\s+[가-힣]","콜론 대신 서술어로 이어 씁니다('가격: 월 2만 원' → '가격은 월 2만 원입니다').",2);
rule("D-11","끝의 '앞으로·향후'",2,"(?:^|[.?!]\\s+)(?:향후|앞으로(?:는)?|중장기적으로)(?=\\s)(?!\\s*\\d)","시간어를 빼거나 실제 시점으로 바꿉니다.");

const ADVICE = {
  FRAG:["명사로 끊는 조각 문장","서술어를 붙여 문장으로 끝냅니다('CVE 2건, 버그 4개.' → '결함은 CVE 2건, 버그 4개입니다.')."],
  SHORT:["짧은 단정문이 줄줄이 이어짐","짧은 문장 둘을 이어 한 문장으로 만들어 리듬을 바꿉니다."],
  "E-2":["같은 끝맺음이 연달아 반복","같은 어미가 이어지는 문장 중 하나를 '~이고', '~인데'로 옆 문장과 잇거나 끝맺음을 바꿉니다."],
  "E-1":["문장 길이가 너무 고름","이웃한 두 문장을 이어 긴 문장 하나를 만들어 리듬을 섞습니다. 사람 글에는 긴 문장과 짧은 문장이 섞여 있습니다."],
  "I-4":["문단마다 '~해야 합니다'로 끝남","당위 문장은 하나만 남기고, 나머지는 문단 앞이나 중간으로 옮깁니다."],
  MORAL:["마지막 문장이 교훈·다짐으로 닫힘","교훈 대신 남은 사실(날짜, 조건, 아직 모르는 것)로 끝냅니다."],
  REPEAT:["같은 숫자를 여러 번 되풀이","같은 숫자·사실은 한두 번이면 충분합니다. 나머지 자리에는 새 사실을 씁니다."],
  "B-1":["같은 영어 병기를 반복","영어 병기는 처음 한 번만 합니다."],
  START:["문장 첫머리가 같은 말로 반복","같은 말로 시작하는 문장 중 몇 개는 주어나 순서를 바꿉니다."],
  MIX:["말투가 섞임","한 글 안에서는 습니다체·해요체·한다체 중 하나로 맞춥니다(인용은 그대로)."],
};

// ---------- 글 쪼개기 ----------
const QP = {"‘":"’","“":"”","'":"'",'"':'"',"「":"」","『":"』"};
function mask(s){ const o=s.split(""); let i=0;
  while(i<s.length){ const c=s[i]; if(QP[c]){ const j=s.indexOf(QP[c],i+1); if(j>i && j-i<300 && !s.slice(i,j).includes("\n")){ for(let k=i+1;k<j;k++) o[k]="○"; i=j+1; continue; } } i++; }
  return o.join(""); }
function sentences(text, masked){
  const out=[]; const rx=/[^.?!…\n]+(?:[.?!…]+["'’”)\]]*|\n|$)/g; let m;
  while((m=rx.exec(masked))){ const raw=text.slice(m.index, m.index+m[0].length); const t=raw.trim(); if(t.replace(/[\s.?!…]/g,"").length) out.push({start:m.index+raw.indexOf(t), end:m.index+raw.indexOf(t)+t.length, s:t, m:masked.slice(m.index+raw.indexOf(t), m.index+raw.indexOf(t)+t.length), dot:/[.]["'’”)\]]*$/.test(t)}); if(!m[0].length) rx.lastIndex++; }
  return out; }
const tailOf = sm=>sm.replace(/\([^()]*\)\s*[.?!]?$/,"").replace(/[\s.?!…’”"')\]]+$/,"");
function endType(sm){ const t=tailOf(sm); if(/(?:습니다|니다|니까|십시오|세요)$/.test(t)) return "합니다"; if(/요$/.test(t)) return "해요"; if(/다$/.test(t)) return "한다"; return ""; }

// ---------- 검사 ----------
function scan(text){
  const masked = mask(text), F = [], marks = [];
  const add = (id,name,sev,hits,fix,why="")=>{ F.push({id,name,sev,hits,fix,why}); };
  for(const r of R){
    const hits=[]; r.rx.lastIndex=0; let m;
    const pat = new RegExp(r.rx.source, "gm");
    while((m=pat.exec(masked))){ if(!m[0].length){ pat.lastIndex++; continue; } let a=m.index, b=m.index+m[0].length; const lead=m[0].match(/^[\s.]+/); if(lead) a+=lead[0].length; hits.push({a,b}); }
    if(hits.length >= r.min) add(r.id, r.name, r.sev, hits, r.fix, r.why);
  }
  const S = sentences(text, masked);
  // 명사 조각 문장(마침표로 끝나는 문장만)
  const frag = S.filter(x=>x.dot && /[가-힣]$/.test(tailOf(x.m)) && !/[다요까죠니]$/.test(tailOf(x.m)) && tailOf(x.m).length>1);
  if(frag.length >= 2) add("FRAG", ADVICE.FRAG[0], 1, frag.map(x=>({a:x.start,b:x.end})), ADVICE.FRAG[1], "명사로 툭 끊는 문장이 이어지면 요약문·광고 문구처럼 읽힙니다.");
  // 짧은 단정문 연속
  let run=[];
  const flush=()=>{ if(run.length>=3) add("SHORT", `${ADVICE.SHORT[0]} (${run.length}개)`, run.length>=4?1:2, [{a:run[0].start,b:run[run.length-1].end}], ADVICE.SHORT[1], "탁탁 끊는 리듬은 AI 글에서 자주 보입니다."); run=[]; };
  for(const x of S){ if(x.dot && x.s.replace(/\s/g,"").length < 22) run.push(x); else flush(); } flush();
  // 같은 끝맺음 4번 이상 연속
  const ends = S.map(x=>{ const t=tailOf(x.m).split(/\s/).pop()||""; return t.slice(-3); });
  for(let i=0;i<S.length;){ let j=i; while(j+1<S.length && ends[j+1] && ends[j+1]===ends[i]) j++; if(j-i+1>=4) add("E-2", `${ADVICE["E-2"][0]} (…${ends[i]} ${j-i+1}번)`, 2, [{a:S[i].start,b:S[j].end}], ADVICE["E-2"][1]); i=j+1; }
  // 문장 길이가 고름
  if(S.length>=10 && !S.some(x=>x.s.length>=100)) add("E-1", ADVICE["E-1"][0], 2, [], ADVICE["E-1"][1], "사람 글은 천 문장에 100자 넘는 문장이 90개 안팎인데, AI 글은 10개도 안 된다는 분석이 있습니다.");
  // 문장 첫머리 반복
  const firsts = {}; S.forEach(x=>{ const w=(x.s.match(/^[^\s,]+/)||[""])[0]; if(w.length>=2) (firsts[w]=firsts[w]||[]).push(x); });
  for(const [w,xs] of Object.entries(firsts)) if(xs.length>=3 && xs.length/S.length>=0.2) add("START", `${ADVICE.START[0]} ('${w}' ${xs.length}번)`, 2, xs.map(x=>({a:x.start,b:x.start+w.length})), ADVICE.START[1]);
  // 문단 끝 당위
  const paras = text.split(/\n\s*\n/); let pos=0; const deon=[];
  const DEON = /(?:해야|야)\s*(?:합니다|한다|해요)|필요(?:가\s*있습니다|합니다|하다|해요)|바람직(?:합니다|하다)|좋겠습니다/;
  for(const p of paras){ const ms=sentences(p, mask(p)); if(ms.length){ const l=ms[ms.length-1]; if(DEON.test(l.m)) deon.push({a:pos+l.start,b:pos+l.end}); } pos += p.length + (text.slice(pos+p.length).match(/^\n\s*\n/)||[""])[0].length; }
  if(deon.length>=2) add("I-4", ADVICE["I-4"][0], 2, deon, ADVICE["I-4"][1]);
  // 마지막 문장 교훈
  const MORAL = /편이\s*(?:좋|낫)|(?:해야|야)\s*(?:합니다|한다)|지켜볼|주목됩니다|기대됩니다|중요합니다|중요하다|잊지\s*마|기억하세요|명심|달려\s*있(?:습니다|다)|시작입니다|준비해야|뒤처지/;
  if(S.length>=4){ const l=S[S.length-1]; if(MORAL.test(l.m)) add("MORAL", ADVICE.MORAL[0], 2, [{a:l.start,b:l.end}], ADVICE.MORAL[1], "AI 글은 끝을 교훈이나 다짐으로 깔끔하게 닫는 경향이 있습니다."); }
  // 같은 숫자 4번 이상
  const nums={}; let nm; const NUM=/\d[\d,.]*\s*(?:%|퍼센트|달러|원|억|만|곳|개국|명|건|배)(?![가-힣])/g;
  while((nm=NUM.exec(masked))){ const k=nm[0].replace(/\s/g,""); (nums[k]=nums[k]||[]).push({a:nm.index,b:nm.index+nm[0].length}); }
  for(const [k,v] of Object.entries(nums)) if(v.length>=4) add("REPEAT", `${ADVICE.REPEAT[0]} (${k} ${v.length}번)`, 2, v, ADVICE.REPEAT[1]);
  // 영어 병기 반복
  const par={}; let pm; const PR=/\(([A-Za-z][A-Za-z0-9 .&+'-]{1,40})\)/g;
  while((pm=PR.exec(text))){ (par[pm[1]]=par[pm[1]]||[]).push({a:pm.index,b:pm.index+pm[0].length}); }
  for(const [k,v] of Object.entries(par)) if(v.length>=2) add("B-1", `${ADVICE["B-1"][0]} (${k})`, 2, v.slice(1), ADVICE["B-1"][1]);
  // 말투 섞임
  const cnt={합니다:0,해요:0,한다:0}; S.forEach(x=>{ const t=endType(x.m); if(t) cnt[t]++; });
  const tot=cnt.합니다+cnt.해요+cnt.한다, kinds=Object.entries(cnt).filter(([,n])=>n>=2 && n/tot>=0.15);
  if(tot>=5 && kinds.length>=2) add("MIX", `${ADVICE.MIX[0]} (${kinds.map(([k,n])=>`${k}체 ${n}`).join(" · ")})`, 2, [], ADVICE.MIX[1]);
  const style = tot ? Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0] : "";
  const s1 = F.filter(f=>f.sev===1).reduce((n,f)=>n+(f.id==="C-8"?f.hits.length-1:f.hits.length||1),0);
  const s2 = F.filter(f=>f.sev===2).length;
  return {F, S, s1, s2, style, chars:text.replace(/\s/g,"").length};
}

// ---------- 보여 주기 ----------
function levelOf(r){
  if(r.s1===0 && r.s2<=1) return ["적음","good","AI가 자주 쓰는 표현이 거의 보이지 않습니다."];
  if(r.s1<=1 && r.s2<=3) return ["조금","fair","몇 군데만 손보면 됩니다."];
  if(r.s1<=4) return ["눈에 띔","warn","읽는 사람이 'AI가 쓴 것 같다'고 느낄 만한 표현이 몇 곳 있습니다."];
  return ["많음","bad","AI가 자주 쓰는 표현이 여러 곳에 몰려 있습니다. 아래 표시된 곳부터 고쳐 보세요."];
}
function highlight(text, F){
  const spans=[];
  F.forEach((f,fi)=>f.hits.forEach(h=>{ if(h.b>h.a) spans.push({a:h.a,b:h.b,fi,sev:f.sev,id:f.id}); }));
  // 짧은 표시(단어)를 먼저, 긴 표시(문장)는 겹치지 않을 때만
  spans.sort((x,y)=>(x.b-x.a)-(y.b-y.a) || x.a-y.a);
  const taken=[]; const keep=[];
  for(const s of spans){ if(taken.some(t=>s.a<t.b && t.a<s.b)) continue; taken.push(s); keep.push(s); }
  keep.sort((x,y)=>x.a-y.a);
  let out="", p=0;
  for(const s of keep){ out+=esc(text.slice(p,s.a)); out+=`<mark class="lv${s.sev}" data-f="${s.fi}" title="${esc(F[s.fi].name)}">${esc(text.slice(s.a,s.b))}</mark>`; p=s.b; }
  return out+esc(text.slice(p));
}
let last = null;
function run(){
  const text = $("aIn").value;
  $("aCount").textContent = `${text.replace(/\s/g,"").length.toLocaleString("ko-KR")}자`;
  if(text.replace(/\s/g,"").length < 20){ $("aRes").hidden=true; last=null; return; }
  const r = scan(text); last = {text, r};
  const [lv, cls, msg] = levelOf(r);
  $("aRes").hidden=false;
  $("aLevel").className = "alevel "+cls;
  $("aLevel").innerHTML = `<b>AI 티 ${lv}</b><span>${msg} 찾은 버릇 ${r.F.length}가지 · 표시 ${r.F.reduce((n,f)=>n+Math.max(1,f.hits.length),0)}곳 · 문장 ${r.S.length}개${r.style?` · 주된 말투 ${r.style}체`:""}</span>`;
  $("aMarked").innerHTML = highlight(text, r.F);
  const order = [...r.F].sort((a,b)=>a.sev-b.sev || b.hits.length-a.hits.length);
  $("aList").innerHTML = order.length ? order.map(f=>{
      const fi = r.F.indexOf(f);
      const ex = f.hits.slice(0,3).map(h=>{ const a=Math.max(0,h.a-18), b=Math.min(text.length,h.b+18); return `<q>${a?"…":""}${esc(text.slice(a,h.a))}<mark class="lv${f.sev}">${esc(text.slice(h.a,h.b))}</mark>${esc(text.slice(h.b,b))}${b<text.length?"…":""}</q>`; }).join("");
      return `<details class="arule lv${f.sev}" data-f="${fi}"${f.sev===1?" open":""}><summary><span class="sv">${f.sev===1?"꼭 고칠 것":"많으면 고칠 것"}</span><b>${esc(f.name)}</b>${f.hits.length?`<em>${f.hits.length}곳</em>`:""}</summary>
        <p class="fx">${esc(f.fix)}</p>${f.why?`<p class="why">${esc(f.why)}</p>`:""}${ex?`<div class="ex">${ex}</div>`:""}</details>`; }).join("")
    : `<p class="none">찾은 버릇이 없습니다. 그래도 사실이 맞는지, 읽는 사람에게 필요한 내용인지는 직접 확인하세요.</p>`;
}
let tm; $("aIn").addEventListener("input", ()=>{ clearTimeout(tm); tm=setTimeout(run, 350); });
$("aRun").addEventListener("click", run);
$("aMarked").addEventListener("click", e=>{ const m=e.target.closest("mark[data-f]"); if(!m) return; const d=document.querySelector(`#aList details[data-f="${m.dataset.f}"]`); if(d){ d.open=true; d.scrollIntoView({behavior:"smooth",block:"center"}); d.classList.add("flash"); setTimeout(()=>d.classList.remove("flash"),900); } });

const SAMPLE = "AI 에이전트 시대가 본격적으로 열리고 있습니다. 핵심은 속도가 아니라 신뢰입니다. 이번 발표는 업계에 시사하는 바가 큽니다 — 단순한 기능 추가를 넘어 일하는 방식 자체를 바꾸는 혁신적인 변화이기 때문입니다.\n\n결국 중요한 것은 사람입니다. 기업들은 새로운 도구를 적극적으로 도입하고 있고, 직원들은 이를 통해 업무 효율을 높이고 있으며, 경영진은 이를 통해 비용을 줄이고 있습니다. 다양한 활용법을 살펴보겠습니다. 첫째, 반복 업무. 둘째, 문서 작성. 셋째, 데이터 분석.\n\n앞으로 AI를 잘 쓰는 조직과 그렇지 못한 조직의 격차는 더욱 벌어질 것으로 보입니다. 지금 바로 준비해야 합니다.";
$("aSample").addEventListener("click", ()=>{ $("aIn").value = SAMPLE; run(); });
$("aClear").addEventListener("click", ()=>{ $("aIn").value = ""; run(); $("aIn").focus(); });

async function copy(text, done){
  try{ await navigator.clipboard.writeText(text); toast(done); }
  catch(_){ const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast(done); }catch(__){ toast("길게 눌러 복사해 주세요"); } ta.remove(); }
}
$("aPrompt").addEventListener("click", ()=>{
  if(!last) return toast("먼저 글을 넣어 주세요");
  const {text, r} = last;
  const tone = r.style ? `${r.style}체` : "원래 말투";
  const lines = r.F.slice(0,12).map(f=>{ const ex=f.hits.slice(0,2).map(h=>`"${text.slice(h.a,h.b).slice(0,60)}"`).join(", "); return `- ${f.name}${ex?`: ${ex}`:""} → ${f.fix}`; });
  const p = `아래 글을 사람이 쓴 것처럼 자연스럽게 다듬어 주세요.\n\n지킬 것\n1) 사실, 숫자, 날짜, 이름, 따옴표 안의 인용은 한 글자도 바꾸지 마세요.\n2) 원문에 없는 내용, 경험담, 감탄사, 이모지를 새로 넣지 마세요.\n3) 말투는 ${tone}로 맞추고, 주장의 세기(추측·단정)는 그대로 두세요.\n4) 많이 고치지 말고, 아래에 표시된 곳 위주로 고쳐 주세요.\n\n고칠 곳\n${lines.length?lines.join("\n"):"- (자동 검사에서 찾은 곳 없음) 어색한 문장만 고쳐 주세요."}\n\n결과는 고친 글 전체를 먼저 주고, 그 아래에 고친 곳을 '원래 → 고친 문장' 목록으로 보여 주세요.\n\n글:\n${text}`;
  copy(p, "고쳐 달라는 프롬프트로 복사했습니다");
});
run();
})();

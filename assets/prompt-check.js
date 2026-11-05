// SHIFT AI 무료 도구 — 프롬프트 점검기. 정해 둔 낱말·문장 모양으로 빠진 칸·흐린 말·남은 빈칸·개인정보를 찾는다. 글은 이 브라우저 안에서만 검사한다.
// 근거: 앤트로픽 프롬프트 작성 모범 사례(분명하게·맥락·할 것을 말하기·긴 자료는 위에·XML 태그·역할·예시), 환각 줄이기('모른다'고 해도 된다고 허락).
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("kcIn")) return;
let toastT; const toast = m=>{ const t=$("toast"); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2000); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ---------- 일곱 칸 ----------
const TASK = /(해\s*줘|해\s*주세요|해\s*주십시오|해\s*줄래|해\s*봐|하세요|하십시오|해라|하라\b|만들어|작성|정리|요약|번역|써\s*(줘|주세요|봐)|알려\s*(줘|주세요)|추천|비교|분석|검토|고쳐|바꿔|뽑아|찾아|설명해|짜\s*(줘|주세요)|계산|평가|분류|다듬어|골라|제안|please|write|summari[sz]e|translate|explain|list|create)/i;
const SLOTS = [
  {k:"role", name:"역할", why:"누구처럼 답할지", re:/(당신은|너는|넌\s|네가|당신이|역할|입장에서|처럼\s*(행동|답|생각|말|써)|(전문가|담당자|선생님|교사|코치|편집자|변호사|세무사|노무사|마케터|개발자|컨설턴트|면접관|기획자|디자이너|분석가|비서|에디터|작가|번역가|강사|매니저|팀장|과외)(로서|으로서|라고|이라고|입니다|예요|이에요|처럼|가 되어|이 되어)|act as|you are)/i,
    add:"역할: 당신은 [어떤 일을 오래 해 온 사람, 예: 10년 차 인사 담당자]입니다.", tip:"한 문장이라도 역할을 정하면 말투와 관점이 그 사람에 맞춰집니다."},
  {k:"ctx", name:"맥락", why:"왜·누구에게 쓰는지", re:/(목적|위해서?|용도|대상은|대상:|독자|읽을 사람|받는 사람|보는 사람|배경|상황|에게\s*(보낼|보내|보고|발표|설명|제출|전달|올릴)|에\s*(낼|제출할|올릴|보낼|발표할)|(회의|발표|면접|보고|공모전|제안)(에서|용|자료|때)|하려고|하는 중|할 예정|입장이|처음 보는|모르는 사람)/,
    add:"### 맥락\n이 결과는 [누가 읽는지, 예: 숫자보다 결론을 먼저 보는 팀장님]에게 [어디에 쓰는지, 예: 다음 주 회의 자료]로 씁니다.", tip:"왜 필요한지, 누가 읽을지 한 줄만 적어도 답이 내 상황에 맞춰집니다. 앤트로픽도 지시의 이유를 함께 설명하라고 권합니다."},
  {k:"input", name:"자료", why:"AI가 읽을 글·숫자", re:/((아래|다음|밑|위)(의|에|에 있는)?\s*(글|내용|자료|메일|표|문서|보고서|녹취|기사|코드|목록|데이터|원고|답변|지원서|이력서|자기소개서|계약서|공고|기획서|제안서|회의록|대본|댓글|리뷰|문의|설문|결과|숫자|파일|링크|사진|이미지|PDF|엑셀|시트|문장|초안)|첨부|붙여\s*(넣|놓)|원문|"""|```|<[a-zA-Z가-힣_]+>|^-{3,}$|^={3,}$|^[^\n:：]{1,15}[:：]\s*\n\s*\S)/m,
    add:"### 자료\n[여기에 요약·정리할 글이나 표를 붙여 넣기]", tip:"무엇을 보고 하라는지 자료가 함께 있어야 AI가 짐작으로 채우지 않습니다."},
  {k:"task", name:"할 일", why:"무엇을 해 달라는지", re:TASK, add:"", tip:"무엇을 해 달라는지 '정리해 주세요'처럼 동사로 분명히 적으세요."},
  {k:"rules", name:"조건", why:"길이·말투·지킬 것", re:/(\d+\s*(자|줄|개|문장|단어|쪽|장|분|초|가지|단계|항목|%|명|번)|이내|이하|이상|넘지|안 넘|말투|어조|톤으로|톤은|존댓말|반말|해요체|습니다체|쉬운 말|전문 용어|빼고|제외|포함해|반드시|꼭\s|지켜|하지\s*마|금지|쓰지\s*마)/,
    add:"### 꼭 지킬 것\n- 길이: [예: 5줄 이내, 300자 이내]\n- 말투: [예: 습니다체, 거래처에 보내는 정중한 말투]", tip:"길이와 말투를 정하면 너무 길거나 딴 말투로 답하는 일이 줄어듭니다."},
  {k:"format", name:"답 형식", why:"어떤 모양으로 받을지", re:/(표로|표 형식|표 한|표\(|목록으로|목록 형식|글머리|번호를?\s*붙|번호로|불릿|마크다운|json|csv|형식|양식|소제목|문단으로|단계별|순서대로|한 줄로|한 문장으로|두 줄|세 줄|\d+\s*줄로|요약본|템플릿|형태로|모양으로|메일 형식|보고서 형식|목록|체크리스트)/i,
    add:"### 답 형식\n[예: 표(항목 · 내용 · 기한) 1개와 세 줄 요약]", tip:"표·목록·몇 줄처럼 받을 모양을 정하면 다시 물어보는 일이 줄어듭니다."},
  {k:"check", name:"확인", why:"답하기 전 점검", re:/(모르면|모르는\s*(것|건|내용)|확실하지|불확실|추측|근거|출처|확인 필요|확인해|검토해|다시 확인|사실만|지어내지|만들어내지|없는 내용|틀린|오류|스스로 점검|답하기 전에|먼저 질문|먼저 물어|질문해)/,
    add:"### 답하기 전에 확인할 것\n확실하지 않은 내용은 지어내지 말고 '확인 필요'라고 적어 주세요. 꼭 필요한 정보가 빠져 있으면 답하기 전에 먼저 질문해 주세요.", tip:"모르면 모른다고 해도 된다고 적어 두면 지어낸 답이 줄어듭니다. 앤트로픽의 환각 줄이기 안내가 첫 번째로 꼽는 방법입니다."},
];
// ---------- 흐린 말 ----------
const VAGUE = [
  [/잘\s*(?=(써|정리|만들|해|요약|작성|다듬|부탁|고쳐|짜|뽑아|골라))/g, "'잘'", "무엇이 잘한 것인지 적으세요. 예: '팀장님이 1분 안에 읽을 수 있게'"],
  [/적당(히|한|하게)/g, "'적당히'", "길이·개수를 숫자로 적으세요. 예: '5줄', '3개'"],
  [/대충|대략적으로/g, "'대충'", "어느 정도까지인지 적으세요. 예: '핵심 3가지만'"],
  [/알아서/g, "'알아서'", "AI에게 맡길 범위를 정하세요. 예: '제목은 맡기고 길이는 300자'"],
  [/간단(하게|히|한)|짧게|짧은/g, "'간단하게·짧게'", "몇 줄·몇 자인지 적으세요. 예: '3줄로', '200자 이내'"],
  [/자세(하게|히|한)|상세(하게|히|한)|길게/g, "'자세하게·길게'", "무엇을 얼마나 자세히인지 적으세요. 예: '항목마다 두세 문장, 예시 하나씩'"],
  [/깔끔(하게|한)|예쁘게|보기\s*좋게|멋지게|멋있게|세련(되게|된)|고급스럽게|있어\s*보이게/g, "'깔끔하게'", "모양을 구체적으로 적으세요. 예: '소제목 3개와 표 1개'"],
  [/자연스럽게|자연스러운/g, "'자연스럽게'", "누구에게 하는 말인지와 말투를 적으세요. 예: '거래처 담당자에게 보내는 습니다체'"],
  [/전문적(으로|인)|프로처럼/g, "'전문적으로'", "누가 읽는지와 용어 수준을 적으세요. 예: '업계 실무자가 읽음, 용어 풀이 없이'"],
  [/최대한|가능한\s*한|최대로/g, "'최대한'", "한도를 숫자로 적으세요. 예: '10개까지'"],
  [/(많이|여러\s*개|몇\s*개|몇\s*가지|다양하게)/g, "'많이·몇 개'", "개수를 숫자로 적으세요. 예: '아이디어 5개'"],
  [/(좋은|괜찮은)\s*(?=(제목|문구|이름|글|아이디어|문장|카피|예시|표현|방법))|좋게/g, "'좋은'", "무엇이 좋은지 기준을 적으세요. 예: '클릭하고 싶은 20자 이내 제목'"],
  [/(^|\s)좀(?=\s)/g, "'좀'", "'좀'은 빼도 됩니다. 정도가 필요하면 숫자로 적으세요."],
];
const BLANKS = /\[[^\[\]\n]{0,40}\](?!\()|[O○◯]{2,}|[X×]{2,}|ㅇㅇ|_{3,}|\?{3,}/g;
const PII = [
  [/\b\d{6}\s*-\s*[1-8]\d{6}\b/g, "주민·외국인등록번호"],
  [/\b01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "휴대폰 번호"],
  [/\b0(2|[3-6][1-5])[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "전화번호"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "이메일 주소"],
  [/\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g, "카드번호로 보이는 숫자"],
];
const NEG = /[^.\n!?]*?(하지\s*마(세요|라|시오)?|하지마|말아\s*(줘|주세요)|금지|쓰지\s*마|넣지\s*마|빼지\s*마|안\s*돼|절대\s*(쓰|넣|하)지)[^.\n!?]*/g;
const isLinkish = (s, i)=>/^\[\d+\]$|^\[[xX ✓]\]$/.test(s);

function check(s){
  const t = s.trim(), res = {slots:{}, marks:[], items:[]};
  if(!t) return res;
  SLOTS.forEach(sl=>res.slots[sl.k] = sl.re.test(t));
  if(!res.slots.input && t.length > 400 && t.split("\n").length >= 6) res.slots.input = true;   // 긴 글이 함께 붙어 있으면 자료로 본다
  const add = (lv, h, d)=>res.items.push({lv, h, d});
  // 너무 짧음
  if(t.length < 25) add("fix", "프롬프트가 아주 짧습니다", "AI가 모자란 부분을 짐작으로 채웁니다. 아래 고친 틀의 빈칸을 채워 두세 줄로 늘려 보세요.");
  if(!res.slots.task) add("fix", "할 일이 안 보입니다", SLOTS[3].tip);
  const needInput = /(요약|정리|번역|검토|고쳐|다듬|분석|비교|뽑아)/.test(t) && !res.slots.input;
  if(needInput) add("fix", "자료가 안 보입니다", "요약·정리·번역할 글을 프롬프트 안에 붙여 넣었는지 확인하세요. 파일을 함께 올렸다면 이 표시는 넘어가도 됩니다.");
  SLOTS.forEach(sl=>{ if(!res.slots[sl.k] && !["task","input"].includes(sl.k)) add("tip", `${sl.name}이 안 보입니다 — ${sl.why}`, sl.tip); });
  // 흐린 말
  const vg = {};
  VAGUE.forEach(([re, name, fix])=>{ re.lastIndex = 0; let m; while((m = re.exec(t))){ const off = m[1] && name==="'좀'" ? m[1].length : 0; res.marks.push({a:m.index+off, b:m.index+m[0].length, k:"v", tip:fix}); vg[name] = vg[name] || {fix, n:0}; vg[name].n++; if(!m[0].length) re.lastIndex++; } });
  Object.entries(vg).forEach(([name, x])=>add("fix", `흐린 말 ${name}${x.n>1?` ${x.n}번`:""}`, x.fix));
  // 남은 빈칸
  let bl = 0; BLANKS.lastIndex = 0; let m;
  while((m = BLANKS.exec(t))){ if(isLinkish(m[0])) continue; res.marks.push({a:m.index, b:m.index+m[0].length, k:"b", tip:"아직 채우지 않은 자리"}); bl++; }
  if(bl) add("fix", `채우지 않은 자리 ${bl}곳`, "[ ]·OOO·___ 자리가 남아 있습니다. 내 내용으로 바꾼 뒤 보내세요. 자주 쓰는 틀이라면 내 프롬프트함에 저장해 두면 빈칸만 채워 씁니다.");
  // 개인정보
  const pf = new Set();
  PII.forEach(([re, name])=>{ re.lastIndex = 0; let q; while((q = re.exec(t))){ res.marks.push({a:q.index, b:q.index+q[0].length, k:"p", tip:name}); pf.add(name); } });
  if(pf.size) add("fix", `개인정보가 보입니다: ${[...pf].join(", ")}`, "AI에 보내기 전에 개인정보 자동 가리기로 가리세요. 가린 값은 AI 답을 받은 뒤 되돌릴 수 있습니다.");
  // 하지 말라는 말만
  NEG.lastIndex = 0; let ng = 0;
  while((m = NEG.exec(t))){ if(ng >= 3) break; const a = m.index + (m[0].length - m[0].trimStart().length); res.marks.push({a, b:m.index+m[0].length, k:"n", tip:"대신 무엇을 할지도 적기"}); ng++; }
  if(ng) add("tip", "하지 말라는 말이 있습니다", "하지 말 것과 함께 대신 할 것을 적으면 더 잘 따릅니다. 예: '마크다운 쓰지 마' → '문단으로 이어지는 글로 써 주세요'. 앤트로픽 안내도 '하지 말 것' 대신 '할 것'을 말하라고 권합니다.");
  // 할 일이 너무 많이 섞임
  const verbs = (t.match(new RegExp(TASK.source, "gi"))||[]).length, numbered = /^\s*(\d+[.)]|[-•·*])\s/m.test(t);
  if(verbs >= 5 && !numbered) add("tip", `할 일이 ${verbs}개쯤 한데 섞여 있습니다`, "할 일을 1. 2. 3.처럼 번호로 나누면 빠뜨리지 않고 순서대로 답합니다. 일이 서로 다르면 두 번에 나눠 물어보세요.");
  // 긴 글인데 줄 구분 없음
  if(t.length > 700 && (t.match(/\n/g)||[]).length < 3) add("tip", "긴 글이 한 덩어리입니다", "자료와 요청을 줄을 바꿔 나누세요. 앤트로픽은 <자료>…</자료>처럼 태그로 감싸 구분하는 방법도 권합니다.");
  // 긴 자료 + 질문이 맨 앞
  if(t.length > 2000){ const head = t.slice(0, t.length*0.2), tail = t.slice(-t.length*0.25); if(TASK.test(head) && !TASK.test(tail)) add("tip", "긴 자료 앞에만 요청이 있습니다", "긴 자료는 위에, 질문과 요청은 맨 아래에 두세요. 앤트로픽은 이렇게 하면 답의 질이 좋아진다고 안내합니다(여러 문서를 넣을 때 특히)."); }
  // 최신 정보 요청
  if(/(최신|요즘|최근|올해|이번\s*(주|달)|오늘)/.test(t) && !res.slots.input) add("tip", "최근 정보를 묻고 있습니다", "AI는 학습한 뒤의 소식을 모를 수 있습니다. 날짜와 자료(기사·공식 발표)를 함께 붙이거나, 검색이 되는 기능을 켜고 물어보세요.");
  res.items.sort((a,b)=>(a.lv==='fix'?0:1)-(b.lv==='fix'?0:1));   // 꼭 고칠 것을 먼저
  return res;
}
// ---------- 고친 틀 ----------
function rewrite(t, r){
  if(!t.trim()) return "";
  const has = r.slots, out = [];
  if(!has.role) out.push(SLOTS[0].add);
  if(!has.ctx) out.push(SLOTS[1].add);
  const needInput = !has.input && /(요약|정리|번역|검토|고쳐|다듬|분석|비교|뽑아)/.test(t);
  if(needInput) out.push(SLOTS[2].add);
  out.push((out.length ? "### 할 일\n" : "") + t.trim());
  if(!has.rules || r.items.some(x=>/흐린 말 '(간단|자세|적당|많이)/.test(x.h))) out.push(SLOTS[4].add);
  if(!has.format) out.push(SLOTS[5].add);
  if(!has.check) out.push(SLOTS[6].add);
  return out.join("\n\n");
}
function markHtml(t, marks){
  marks = marks.filter(m=>m.b > m.a).sort((x,y)=>x.a-y.a || y.b-x.b);
  let out = "", p = 0;
  for(const m of marks){ if(m.a < p) continue; out += esc(t.slice(p, m.a)) + `<mark class="kc-${m.k}" title="${esc(m.tip)}">${esc(t.slice(m.a, m.b))}</mark>`; p = m.b; }
  return out + esc(t.slice(p));
}
// ---------- 화면 ----------
let res = null;
function render(){
  const t = $("kcIn").value, tt = t.trim();
  res = check(t);
  $("kcMeta").textContent = tt ? `${tt.length.toLocaleString()}자` : "";
  const n = SLOTS.filter(s=>res.slots[s.k]).length, fixes = res.items.filter(x=>x.lv==="fix").length;
  $("kcStatus").textContent = tt ? `일곱 칸 중 ${n}칸이 보입니다 · 꼭 고칠 곳 ${fixes}개` : "";
  $("kcSlots").innerHTML = tt ? SLOTS.map(s=>`<span class="kcs ${res.slots[s.k]?"on":"off"}" title="${esc(s.why)}">${res.slots[s.k]?"✓":"–"} ${esc(s.name)}</span>`).join("") : `<p class="hint">프롬프트를 넣으면 일곱 칸 가운데 무엇이 들어 있는지 바로 보여 줍니다.</p>`;
  $("kcMark").hidden = !tt || !res.marks.length; $("kcMark").innerHTML = tt ? markHtml(t, res.marks) : "";
  $("kcList").innerHTML = tt ? (res.items.length ? res.items.map(x=>`<li class="${x.lv}"><b>${x.lv==="fix"?"꼭 고칠 것":"해 보면 좋은 것"} · ${esc(x.h)}</b><span>${esc(x.d)}</span></li>`).join("")
    : `<li class="good"><b>눈에 띄는 문제가 없습니다</b><span>일곱 칸이 보이고 흐린 말도 없습니다. 그래도 AI 답이 기대와 다르면 원하는 답의 예시를 하나 붙여 보세요.</span></li>`) : "";
  $("kcOut").value = rewrite(t, res);
  ["kcCopy","kcAsk","kcBox"].forEach(id=>$(id).disabled = !tt);
}
const copy = (t, msg)=>(navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast(msg || "복사했습니다"), ()=>toast("복사하지 못했습니다. 길게 눌러 복사해 주세요"));
const SAMPLE = "이 보고서 간단하게 잘 요약해줘. 너무 길게 쓰지 마.\n\n[보고서 붙여 넣기]";
$("kcIn").addEventListener("input", render);
$("kcSample").addEventListener("click", ()=>{ $("kcIn").value = SAMPLE; render(); });
$("kcClear").addEventListener("click", ()=>{ $("kcIn").value = ""; render(); });
$("kcCopy").addEventListener("click", ()=>{ const t = $("kcOut").value.trim(); if(t) copy(t, "고친 틀을 복사했습니다. [ ] 자리를 채워 쓰세요"); });
$("kcAsk").addEventListener("click", ()=>{ const t = $("kcIn").value.trim(); if(!t || !res) return;
  const found = res.items.map(x=>`- ${x.h}`).join("\n") || "- 눈에 띄는 문제 없음";
  copy(`아래 <프롬프트>를 더 좋은 답이 나오게 고쳐 주세요.\n\n점검 도구가 찾은 점:\n${found}\n\n순서:\n1. 고치는 데 꼭 필요한데 빠진 정보(목적, 읽는 사람, 길이, 답 형식 등)가 있으면 먼저 저에게 질문해 주세요. 한 번에 최대 3개까지만 묻습니다.\n2. 제 답을 받은 뒤 고친 프롬프트를 코드 블록 하나로 주세요.\n3. 무엇을 왜 바꿨는지 세 줄 이내로 알려 주세요.\n\n원래 뜻과 요청 범위는 바꾸지 마세요.\n\n<프롬프트>\n${t}\n</프롬프트>`, "AI에게 보낼 부탁을 복사했습니다"); });
$("kcBox").addEventListener("click", ()=>{ const t = $("kcOut").value.trim(); if(!t) return;
  const title = ($("kcIn").value.split("\n").find(l=>l.trim()) || "점검한 프롬프트").trim().slice(0, 40);
  if(typeof window.SHIFT_PBOX_ADD==="function") window.SHIFT_PBOX_ADD(title, t, "점검기", "/tools/prompt-check/");
  else toast("저장 기능을 불러오지 못했습니다. 새로 고침해 주세요"); });
// 내 프롬프트함에서 '점검기로'를 눌러 왔으면 그 글을 넣어 둔다
try{ const s = sessionStorage.getItem("shift-pcheck-in"); if(s){ sessionStorage.removeItem("shift-pcheck-in"); $("kcIn").value = s; } }catch(_){}
render();
})();

// SHIFT AI 무료 도구 — 프롬프트 만들기. 일곱 칸(역할·맥락·자료·할 일·조건·답 형식·확인)을 묶어 프롬프트를 만든다. 글은 이 브라우저에만 임시 저장한다.
(function(){
"use strict";
const $ = id=>document.getElementById(id);
if(!$("pOut")) return;
let toastT; const toast = msg=>{ const t=document.getElementById("toast"); if(!t) return; t.textContent=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1800); };
const esc = s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KEY = "shift-prompt-draft-v1";

const FIELDS = [
  {k:"role", label:"역할", tag:"role", head:"역할", ask:"누구처럼 답하게 할까요?", ph:"예: 10년 차 인사 담당자, 초등학생을 가르치는 과학 선생님"},
  {k:"ctx", label:"맥락", tag:"context", head:"맥락", ask:"지금 어떤 상황이고, 왜 필요한가요?", ph:"예: 다음 주 팀장 회의에 올릴 자료입니다. 팀장님은 숫자보다 결론을 먼저 봅니다."},
  {k:"input", label:"자료", tag:"input", head:"자료", ask:"AI가 읽어야 할 글·숫자·메모를 붙여 넣으세요", ph:"예: 회의 녹취록, 고객 문의 메일, 엑셀에서 복사한 표", rows:5},
  {k:"task", label:"할 일", tag:"task", head:"할 일", ask:"무엇을 해 달라고 할까요? (꼭 채우세요)", ph:"예: 이 녹취록에서 결정된 일과 할 일을 뽑아 주세요.", need:true},
  {k:"rules", label:"조건", tag:"constraints", head:"꼭 지킬 것", ask:"지킬 것, 하지 말 것", ph:"예: 녹취록에 없는 내용은 쓰지 마세요. 사람 이름은 그대로 두세요."},
  {k:"format", label:"답 형식", tag:"output_format", head:"답 형식", ask:"어떤 모양으로 받을까요?", ph:"예: 표(할 일 · 담당자 · 기한) 한 개와 세 줄 요약"},
  {k:"check", label:"확인", tag:"verification", head:"답하기 전에 확인할 것", ask:"답을 내기 전에 AI가 스스로 점검할 것", ph:"예: 표의 담당자와 기한이 녹취록에 실제로 나오는지 한 번 더 확인하세요."},
];
const OPTS = [
  {k:"noinvent", label:"모르면 지어내지 말고 '모름'이라고 하게", text:"확실하지 않은 내용은 지어내지 말고 '확인 필요'라고 표시하세요."},
  {k:"askfirst", label:"정보가 모자라면 먼저 질문하게", text:"이 일을 하는 데 꼭 필요한 정보가 빠져 있으면, 답하기 전에 먼저 질문해 주세요."},
  {k:"source", label:"출처·근거를 붙이게", text:"사실이나 숫자에는 근거(자료의 어느 부분인지, 또는 출처 링크)를 붙여 주세요."},
  {k:"plain", label:"쉬운 말로", text:"전문 용어는 처음 나올 때 쉬운 말로 풀어 주세요."},
  {k:"korean", label:"한국어 존댓말로", text:"답은 한국어 존댓말(습니다체)로 써 주세요."},
];
const T = {
  free:{name:"직접 쓰기"},
  mail:{name:"곤란한 메일 답장", role:"회사에서 대외 연락을 오래 맡아 온 담당자", ctx:"거래처에서 납기 지연에 항의하는 메일이 왔습니다. 관계는 지키되 우리 쪽 사정도 분명히 알려야 합니다.", input:"[받은 메일 붙여 넣기]\n[우리 쪽 사정: 원인, 새 납기, 줄 수 있는 것]", task:"이 메일에 보낼 답장 초안을 써 주세요.", rules:"사과는 한 번만 하고, 지킬 수 없는 약속은 하지 마세요. 상대 회사 이름과 날짜는 그대로 쓰세요.", format:"제목 한 줄, 본문 8~12줄. 말투가 다른 두 가지(정중하게 / 단호하게)로.", check:"새 납기와 보상 내용이 제가 준 사정과 일치하는지 확인하세요."},
  meeting:{name:"회의록 → 할 일", role:"회의록을 정리하는 프로젝트 매니저", ctx:"팀 주간 회의 녹취를 정리해 회의에 없던 사람에게도 보낼 예정입니다.", input:"[회의 녹취록 또는 메모 붙여 넣기]", task:"결정된 것, 할 일, 아직 정하지 못한 것을 나눠 정리해 주세요.", rules:"녹취록에 없는 내용은 쓰지 마세요. 누가 말했는지 불분명하면 '담당 미정'으로 두세요.", format:"할 일은 표(할 일 · 담당자 · 기한), 나머지는 글머리표 목록", check:"표의 담당자와 기한이 녹취록에 실제로 나오는지 확인하세요."},
  report:{name:"긴 자료 요약", role:"바쁜 임원에게 보고서를 요약해 올리는 기획팀 직원", ctx:"20쪽짜리 자료를 읽을 시간이 없는 팀장님께 보고해야 합니다.", input:"[요약할 글이나 보고서 붙여 넣기]", task:"이 자료를 결론부터 요약해 주세요.", rules:"숫자는 원문 그대로 쓰고, 원문에 없는 해석은 '의견'이라고 따로 표시하세요.", format:"결론 한 문장, 근거 세 줄, 확인이 필요한 점 두 줄", check:"요약에 쓴 숫자가 원문에 있는지 하나씩 대조하세요."},
  plan:{name:"기획안 초안", role:"신규 사업 기획을 많이 써 본 기획자", ctx:"사내 공모전에 낼 아이디어입니다. 심사위원은 실행 가능성과 비용을 중요하게 봅니다.", input:"[아이디어 메모, 대상 고객, 예산 한도]", task:"이 아이디어로 한 장짜리 기획안 초안을 써 주세요.", rules:"근거 없는 시장 규모 숫자는 넣지 말고, 넣어야 할 자리는 [확인 필요]로 비워 두세요.", format:"문제, 해결책, 대상 고객, 실행 단계, 비용, 위험 순서의 소제목", check:"제가 준 예산 한도를 넘는 계획이 없는지 확인하세요."},
  excel:{name:"엑셀·시트 수식", role:"엑셀과 구글 시트를 잘 아는 데이터 담당자", ctx:"매달 같은 계산을 손으로 하고 있어서 수식으로 바꾸고 싶습니다.", input:"[열 이름과 예시 데이터 3~5줄을 복사해 붙여 넣기]", task:"[원하는 결과, 예: 부서별 이번 달 합계]를 구하는 수식을 만들어 주세요.", rules:"엑셀과 구글 시트에서 함수가 다르면 둘 다 알려 주세요.", format:"수식, 넣을 칸, 수식이 하는 일을 한 줄씩", check:"예시 데이터로 계산했을 때 나오는 값을 함께 적어 주세요."},
  resume:{name:"이력서·자기소개서 검토", role:"[지원 직무] 채용을 오래 맡아 온 담당자", ctx:"[회사·직무]에 지원하려고 합니다. 서류에서 떨어지는 이유를 미리 알고 싶습니다.", input:"[채용 공고 원문]\n[내 이력서 또는 자기소개서]", task:"채용 담당자 눈으로 읽고 떨어질 만한 이유부터 짚어 주세요.", rules:"칭찬은 빼고, 고칠 문장은 원문을 그대로 인용해 주세요. 없는 경력을 지어내지 마세요.", format:"탈락 이유 3개, 고칠 문장과 고친 예시 표", check:"고친 예시에 원래 이력서에 없는 경험이 들어가지 않았는지 확인하세요."},
  sns:{name:"블로그·SNS 글", role:"직장인 독자가 많은 블로그를 운영하는 에디터", ctx:"[주제]에 대한 글을 쓰려고 합니다. 독자는 처음 접하는 사람이 많습니다.", input:"[내가 정리한 메모·자료]", task:"이 메모로 글 초안을 써 주세요.", rules:"과장 표현과 이모지는 쓰지 말고, 메모에 없는 사실은 넣지 마세요.", format:"제목 후보 3개, 본문 800자 안팎", check:"글에 쓴 숫자와 이름이 메모와 같은지 확인하세요."},
  study:{name:"공부(과외 선생님)", role:"학생이 스스로 답을 찾게 돕는 과외 선생님", ctx:"[과목·단원]을 공부하고 있는데 [어디서] 막혔습니다.", input:"[문제나 교재 내용]", task:"정답을 바로 알려 주지 말고, 질문을 하나씩 던져서 제가 스스로 풀게 도와주세요.", rules:"한 번에 질문은 하나만 하고, 제가 답하면 맞았는지 알려 준 뒤 다음으로 넘어가세요.", format:"짧은 질문 한 개씩", check:"설명에 쓴 공식이나 사실이 교과 내용과 맞는지 확인하세요."},
  code:{name:"코딩 맡기기(클로드 코드)", role:"이 저장소를 처음 보는 꼼꼼한 개발자", ctx:"[프로젝트 설명]. 지금 [문제 상황]이 생깁니다.", input:"[관련 파일 경로, 오류 메시지]", task:"원인을 찾아 고치고, 고친 내용을 설명해 주세요.", rules:"관련 없는 파일은 고치지 말고, 새 라이브러리를 설치하기 전에는 먼저 물어보세요.", format:"원인 한 줄, 바꾼 파일 목록, 확인 방법", check:"테스트를 돌려 통과하는지 확인하고 결과를 보여 주세요."},
  polish:{name:"번역·글 다듬기", role:"한국어와 영어를 모두 잘 쓰는 편집자", ctx:"[누구]에게 보낼 글입니다.", input:"[다듬을 글]", task:"뜻은 바꾸지 말고 자연스럽게 다듬어 주세요.", rules:"사실·숫자·이름은 그대로 두고, 원문에 없는 내용은 넣지 마세요.", format:"다듬은 글 전체, 그 아래에 '원래 → 고친 문장' 목록", check:"숫자와 고유명사가 원문과 같은지 확인하세요."},
};

// ---------- 화면 만들기 ----------
$("pTpl").innerHTML = Object.entries(T).map(([k,t])=>`<button type="button" data-t="${k}" aria-pressed="${k==="free"}">${esc(t.name)}</button>`).join("");
$("pFields").innerHTML = FIELDS.map((f,i)=>`<label class="pf${f.need?" need":""}"><span><b>${i+1}. ${f.label}</b>${f.need?"<em>필수</em>":""}<small>${esc(f.ask)}</small></span>
  <textarea id="pf-${f.k}" rows="${f.rows||2}" placeholder="${esc(f.ph)}"></textarea></label>`).join("");
$("pOpts").innerHTML = OPTS.map(o=>`<label><input type="checkbox" data-o="${o.k}"> ${esc(o.label)}</label>`).join("");
let tpl = "free";

function values(){ const v={}; FIELDS.forEach(f=>v[f.k]=$("pf-"+f.k).value.trim()); return v; }
function opts(){ return [...document.querySelectorAll("#pOpts input:checked")].map(x=>OPTS.find(o=>o.k===x.dataset.o)); }
function build(){
  const v = values(), os = opts(), tagged = document.querySelector('input[name=pfmt]:checked').value==="tag";
  const extra = os.map(o=>o.text).join("\n");
  const parts = [];
  if(tagged){
    if(v.role) parts.push(`당신은 ${v.role}입니다.`);
    for(const f of FIELDS){ if(f.k==="role") continue; let t=v[f.k]; if(f.k==="rules" && extra) t = [t, extra].filter(Boolean).join("\n"); if(t) parts.push(`<${f.tag}>\n${t}\n</${f.tag}>`); }
  }else{
    if(v.role) parts.push(`역할: 당신은 ${v.role}입니다.`);
    for(const f of FIELDS){ if(f.k==="role") continue; let t=v[f.k]; if(f.k==="rules" && extra) t=[t, extra].filter(Boolean).join("\n"); if(t) parts.push(`[${f.head}]\n${t}`); }
  }
  return parts.join("\n\n");
}
function advice(v){
  const a = [];
  a.push(v.task ? ["ok","할 일이 있습니다."] : ["no","'할 일'을 채워 주세요. 무엇을 해 달라는지 동사로 쓰면 됩니다."]);
  if(v.task && v.task.length < 12) a.push(["mid","할 일이 짧습니다. 무엇을, 어느 범위까지 할지 한 문장 더 적어 보세요."]);
  a.push(v.ctx ? ["ok","맥락이 있습니다."] : ["mid","맥락(왜 필요한지, 누가 볼지)을 한 줄만 적어도 답이 훨씬 맞춤형이 됩니다."]);
  a.push(v.format ? ["ok","답 형식이 정해져 있습니다."] : ["mid","답 형식(표, 세 줄, 몇 자)을 정하면 다시 물어보는 일이 줄어듭니다."]);
  if(/\[[^\]]{1,40}\]/.test(Object.values(v).join(" "))) a.push(["no","[ ] 괄호로 된 자리가 남아 있습니다. 내 내용으로 바꿔 주세요."]);
  if(v.input && v.input.length > 30000) a.push(["mid","자료가 아주 깁니다. 대화창 한 번에 다 들어가지 않을 수 있으니 나눠 넣는 것도 생각해 보세요."]);
  return a;
}
const tokEst = s=>{ const ko=(s.match(/[가-힣]/g)||[]).length, rest=s.replace(/[가-힣\s]/g,"").length, words=(s.replace(/[가-힣]/g," ").match(/[A-Za-z0-9]+/g)||[]).length; return Math.round(ko/1.7 + words*1.3 + rest*0.15); };
function render(){
  const out = build(), v = values();
  $("pOut").value = out;
  $("pMeta").textContent = out ? `${out.length.toLocaleString("ko-KR")}자 · 약 ${tokEst(out).toLocaleString("ko-KR")}토큰` : "";
  $("pAdvice").innerHTML = advice(v).map(([k,t])=>`<li class="${k}">${esc(t)}</li>`).join("");
  save();
}
function save(){ try{ const d={tpl, fmt:document.querySelector('input[name=pfmt]:checked').value, v:values(), o:opts().map(o=>o.k)}; localStorage.setItem(KEY, JSON.stringify(d)); }catch(_){} }
function load(){ try{ const d=JSON.parse(localStorage.getItem(KEY)||"null"); if(!d) return;
  FIELDS.forEach(f=>{ if(d.v && typeof d.v[f.k]==="string") $("pf-"+f.k).value=d.v[f.k]; });
  (d.o||[]).forEach(k=>{ const x=document.querySelector(`#pOpts input[data-o="${k}"]`); if(x) x.checked=true; });
  if(d.fmt){ const r=document.querySelector(`input[name=pfmt][value="${d.fmt}"]`); if(r) r.checked=true; }
  if(d.tpl && T[d.tpl]) setTpl(d.tpl, false);
}catch(_){} }
function setTpl(k, fill){
  tpl = k; const t = T[k];
  document.querySelectorAll("#pTpl button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.t===k));
  FIELDS.forEach(f=>{ const el=$("pf-"+f.k); el.placeholder = t[f.k] || f.ph; if(fill) el.value = t[f.k] || ""; });
  $("pFill").hidden = k==="free";
}
$("pTpl").addEventListener("click", e=>{ const b=e.target.closest("button[data-t]"); if(!b) return;
  const empty = FIELDS.every(f=>!$("pf-"+f.k).value.trim());
  setTpl(b.dataset.t, empty && b.dataset.t!=="free"); render();
  if(!empty && b.dataset.t!=="free") toast("쓰던 내용은 그대로 두었습니다. 예시로 채우려면 '예시로 채우기'를 누르세요");
});
$("pFill").addEventListener("click", ()=>{ setTpl(tpl, true); render(); toast("예시로 채웠습니다. [ ] 자리를 내 내용으로 바꾸세요"); });
$("pReset").addEventListener("click", ()=>{ FIELDS.forEach(f=>$("pf-"+f.k).value=""); document.querySelectorAll("#pOpts input").forEach(x=>x.checked=false); setTpl("free", false); render(); });
document.addEventListener("input", e=>{ if(e.target.closest("#pFields")) render(); });
document.addEventListener("change", e=>{ if(e.target.closest("#pOpts") || e.target.name==="pfmt") render(); });
$("pCopy").addEventListener("click", async ()=>{
  const t=$("pOut").value.trim(); if(!t) return toast("먼저 칸을 채워 주세요");
  try{ await navigator.clipboard.writeText(t); toast("복사했습니다. 챗GPT·클로드·제미나이에 붙여 넣으세요"); }
  catch(_){ $("pOut").select(); try{ document.execCommand("copy"); toast("복사했습니다"); }catch(__){ toast("길게 눌러 복사해 주세요"); } }
});
load(); render();
})();

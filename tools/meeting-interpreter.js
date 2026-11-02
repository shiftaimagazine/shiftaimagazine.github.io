/* SHIFT AI 회의 통역창 — 페이지 안에 있던 스크립트를 따로 뺀 파일(보안 점검 11/2: CSP 로 페이지 안 스크립트를 막기 위해). */
(function(){
"use strict";
var $=function(id){ return document.getElementById(id); };
var store={
  get:function(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } },
  set:function(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
function el(t,c,x){ var e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e; }
function msg(t,info){ var m=$("msg"); if(!t){ m.hidden=true; return; } m.textContent=t; m.className="msg"+(info?" info":""); m.hidden=false; }
function status(on,t){ $("status").dataset.on=String(on); $("statusText").textContent=t; }

/* ---------- environment checks ---------- */
var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
var chromeVer=(function(){ var m=navigator.userAgent.match(/Chrome\/(\d+)/); return m?+m[1]:0; })();
function envProblem(){
  if(!SR||!navigator.mediaDevices||!navigator.mediaDevices.getDisplayMedia) return "크롬에서 열어 주세요. 이 브라우저는 소리 받아 적기를 지원하지 않습니다.";
  if(/Android|iPhone|iPad/i.test(navigator.userAgent)) return "휴대폰에서는 쓸 수 없습니다. PC의 크롬에서 열어 주세요.";
  if(chromeVer && chromeVer<138) return "크롬이 오래된 버전("+chromeVer+")입니다. 주소창에 chrome://settings/help 를 입력해 업데이트한 뒤 다시 열어 주세요.";
  if(!("Translator" in self)) return "이 크롬에서는 내장 번역을 쓸 수 없습니다. 크롬을 최신 버전으로 업데이트해 주세요.";
  return "";
}
var problem=envProblem();
if(problem) msg(problem);

/* ---------- text size ---------- */
var size=+store.get("cap.size", 22); if(!(size>=14&&size<=48)) size=22;
function applySize(){ document.documentElement.style.setProperty("--size", size+"px"); store.set("cap.size", String(size)); }
applySize();
$("smaller").onclick=function(){ size=Math.max(14,size-2); applySize(); pip(); };
$("bigger").onclick=function(){ size=Math.min(48,size+2); applySize(); pip(); };

/* ---------- language ---------- */
var LANGS={ en:{rec:"en-US",name:"영어"}, zh:{rec:"zh-CN",name:"중국어"}, ja:{rec:"ja-JP",name:"일본어"}, fr:{rec:"fr-FR",name:"프랑스어"} };
var lang=store.get("cap.lang","en"); if(!LANGS[lang]) lang="en";
$("lang").value=lang;
function cjk(){ return lang==="zh"||lang==="ja"; }
$("lang").onchange=function(){
  lang=this.value; store.set("cap.lang", lang);
  flush();
  if(running){ getTranslator(); try{ rec&&rec.abort(); }catch(e){} }  /* onend restarts with the new language */
};

/* ---------- translation ---------- */
var translators={}, trLoading={};
function getTranslator(){
  var l=lang;
  if(translators[l]) return Promise.resolve(translators[l]);
  if(trLoading[l]) return trLoading[l];
  trLoading[l]=self.Translator.create({ sourceLanguage:l, targetLanguage:"ko", monitor:function(m){
    m.addEventListener("downloadprogress", function(e){ status(running, LANGS[l].name+" 번역 준비 중 "+Math.round((e.loaded||0)*100)+"%"); });
  }}).then(function(t){ translators[l]=t; if(running) status(true,"듣는 중"); return t; })
    .catch(function(){ trLoading[l]=null; msg(LANGS[l].name+" 번역 기능을 준비하지 못했습니다. 인터넷 연결을 확인하고 크롬을 업데이트한 뒤 다시 시도해 주세요."); return null; });
  return trLoading[l];
}

/* Clean up raw speech-recognition text so the translator sees proper sentences. */
var FIX=[
  [/\bgonna\b/gi,"going to"],[/\bwanna\b/gi,"want to"],[/\bgotta\b/gi,"have to"],[/\bkinda\b/gi,"kind of"],[/\bsorta\b/gi,"sort of"],
  [/\b(um+|uh+|erm|hmm+|mm+)\b[,.]?\s*/gi,""],[/\b(you know|i mean),?\s+/gi,""],[/\blike,\s+/gi,""],
  [/\b(\w+)( \1\b)+/gi,"$1"],[/\bi\b/g,"I"],[/\bi'(m|ll|ve|d)\b/g,"I'$1"]
];
var QWORDS=/^(what|why|how|when|where|who|which|whose|is|are|am|was|were|do|does|did|can|could|would|will|should|shall|may|might|have|has|had|isn't|aren't|don't|doesn't|didn't|can't|couldn't|won't|wouldn't|shouldn't)\b/i;
function tidy(t){
  t=String(t).replace(/\s+/g," ").trim();
  if(lang!=="en"){
    if(!t) return "";
    if(cjk()){ t=t.replace(/(\S)\s+(?=[^\x00-\x7F])/g,"$1"); if(!/[。？！.?!]$/.test(t)) t+= lang==="ja"&&/(か|の)$/.test(t)?"？":"。"; }
    else{ t=t.replace(/\b(euh+|heu+|ben|bah)\b[,.]?\s*/gi,"").trim(); if(!t) return ""; if(!/[.?!]$/.test(t)) t+="."; t=t.charAt(0).toUpperCase()+t.slice(1); }
    return t;
  }
  FIX.forEach(function(f){ t=t.replace(f[0],f[1]); });
  t=t.replace(/\s+([,.?!])/g,"$1").replace(/\s+/g," ").trim();
  if(!t) return "";
  if(!/[.?!]$/.test(t)){
    var lastS=t.split(/[.?!]\s+/).pop().replace(/^(so|and|but|okay|ok|well|also|then|now|right|yeah|alright),?\s+/i,"");
    t+= QWORDS.test(lastS)?"?":".";
  }
  return t.replace(/(^|[.?!]\s+)([a-z])/g, function(m,p,c){ return p+c.toUpperCase(); });
}
/* Split a long utterance into sentences; translate each separately for quality, show as one block. */
function sentences(t){
  var parts=t.match(/[^.?!。？！]+[.?!。？！]+["')」』”]?/g);
  return parts?parts.map(function(s){ return s.trim(); }).filter(Boolean):[t];
}
function translate(t){
  return getTranslator().then(function(tr){
    if(!tr) return "";
    return Promise.all(sentences(t).map(function(s){ return tr.translate(s).catch(function(){ return ""; }); }))
      .then(function(a){ return a.filter(Boolean).join(" "); });
  });
}

/* ---------- caption lines ---------- */
var lines=[];
function nearBottom(){ var f=$("feed"); return f.scrollHeight-f.scrollTop-f.clientHeight<100; }
function toBottom(){ var f=$("feed"); f.scrollTop=f.scrollHeight; }
function paint(l){
  var stick=nearBottom();
  l.el.textContent="";
  l.el.append(el("span","ko"+(l.ko?"":" wait"), l.ko||"번역 중…"));
  var en=el("span","en",l.en); en.lang=l.lang; l.el.append(en);
  if(stick) toBottom();
}
function commit(raw){
  var en=tidy(raw); if(!en) return;
  $("guide").hidden=true; $("clearBtn").hidden=false;
  var l={en:en, ko:"", lang:lang, el:el("div","line")};
  lines.push(l); if(lines.length>400) lines.shift().el.remove();
  $("lines").append(l.el); paint(l);
  translate(en).then(function(ko){ l.ko=ko||"(번역하지 못했어요)"; paint(l); pip(); });
  pip();
}

/* Recognition often finalizes mid-sentence on short pauses. Hold short fragments briefly so they join the next piece. */
var buf="", flushTimer=null;
function words(t){ return cjk() ? Math.round(t.replace(/\s/g,"").length/2) : t.trim().split(/\s+/).filter(Boolean).length; }
function pushFinal(t){
  t=t.trim(); if(!t) return;
  buf = buf ? buf+(cjk()?"":" ")+t : t;
  clearTimeout(flushTimer);
  var ended=/[.?!。？！]$/.test(buf);
  if((ended && words(buf)>=4) || words(buf)>=28) flush();
  else flushTimer=setTimeout(flush, words(buf)<4?1600:900);
}
function flush(){ clearTimeout(flushTimer); flushTimer=null; if(buf){ var b=buf; buf=""; commit(b); } showInterim(""); }

var interimText="", iTimer=null, iSeq=0;
function showInterim(t){
  var full=((buf?buf+(cjk()?"":" "):"")+t).trim();
  interimText=full;
  var box=$("interim");
  if(!full){ box.hidden=true; $("iKo").textContent=""; pip(); return; }
  var stick=nearBottom();
  box.hidden=false; $("iEn").textContent=full;
  if(stick) toBottom();
  if(!iTimer){
    iTimer=setTimeout(function(){
      iTimer=null; var src=interimText, seq=++iSeq; if(!src) return;
      translate(tidy(src)).then(function(ko){ if(seq===iSeq && interimText){ $("iKo").textContent=ko; pip(); } });
    }, 300);
  }
  pip();
}

/* ---------- listening ---------- */
var running=false, stream=null, track=null, rec=null, restartT=null, fails=0;
function startRec(){
  if(!running||!track||track.readyState!=="live") return;
  var r=new SR();
  r.lang=LANGS[lang].rec; r.continuous=true; r.interimResults=true; r.maxAlternatives=1;
  r.onresult=function(e){
    fails=0;
    var interim="";
    for(var i=e.resultIndex;i<e.results.length;i++){
      var res=e.results[i];
      if(res.isFinal) pushFinal(res[0].transcript); else interim+=res[0].transcript;
    }
    showInterim(interim);
  };
  r.onerror=function(e){
    if(e.error==="no-speech"||e.error==="aborted") return;
    if(e.error==="network"){ fails++; if(fails>2) msg("음성 인식 서버에 연결되지 않습니다. 인터넷 연결을 확인해 주세요. 계속 다시 시도하고 있습니다."); }
    else if(e.error==="not-allowed"||e.error==="service-not-allowed"){ msg("크롬이 음성 인식을 막았습니다. 크롬에서 이 파일을 열었는지 확인해 주세요."); stop(); }
    else if(e.error==="language-not-supported"){ msg(LANGS[lang].name+" 음성 인식을 쓸 수 없습니다. 크롬을 업데이트해 주세요."); stop(); }
  };
  r.onend=function(){ if(running){ clearTimeout(restartT); restartT=setTimeout(startRec, fails?1000:120); } };
  rec=r;
  try{ r.start(track); }
  catch(err){ msg("이 크롬은 공유한 소리를 받아 적지 못합니다. 크롬을 최신 버전으로 업데이트해 주세요 (주소창에 chrome://settings/help)."); stop(); }
}
function start(){
  problem=envProblem();
  if(problem){ msg(problem); return; }
  msg("");
  getTranslator();
  navigator.mediaDevices.getDisplayMedia({
    video:true,
    audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},
    systemAudio:"include", selfBrowserSurface:"exclude", monitorTypeSurfaces:"include", surfaceSwitching:"include"
  }).then(function(s){
    var a=s.getAudioTracks()[0];
    if(!a){ s.getTracks().forEach(function(t){ t.stop(); }); msg("소리가 공유되지 않았습니다. 다시 듣기 시작을 누르고, 공유 창 아래쪽 '시스템 오디오도 공유'를 켜 주세요."); return; }
    stream=s; track=a; running=true; fails=0;
    s.getVideoTracks().forEach(function(v){ v.enabled=false; v.addEventListener("ended", stop); });
    a.addEventListener("ended", stop);
    var b=$("startBtn"); b.textContent="멈추기"; b.className="btn stop";
    status(true, translators[lang]?"듣는 중":"번역 준비 중");
    startRec();
  }).catch(function(e){
    if(e&&e.name==="NotAllowedError") msg("공유를 취소했습니다. 다시 듣기 시작을 눌러 주세요.", true);
    else msg("화면 공유를 시작하지 못했습니다. 크롬을 최신 버전으로 업데이트해 주세요.");
  });
}
function stop(){
  running=false; clearTimeout(restartT);
  try{ rec&&rec.abort(); }catch(e){}
  rec=null; flush();
  if(stream) stream.getTracks().forEach(function(t){ t.stop(); });
  stream=null; track=null;
  var b=$("startBtn"); b.textContent="듣기 시작"; b.className="btn primary";
  status(false,"멈춤"); pip();
}
$("startBtn").onclick=function(){ running?stop():start(); };
$("clearBtn").onclick=function(){ lines.forEach(function(l){ l.el.remove(); }); lines=[]; $("clearBtn").hidden=true; if(!running) $("guide").hidden=false; pip(); };

/* ---------- floating captions (always on top) ---------- */
var pipWin=null;
if("documentPictureInPicture" in window) $("pipBtn").hidden=false;
$("pipBtn").onclick=function(){
  if(pipWin){ pipWin.close(); return; }
  window.documentPictureInPicture.requestWindow({width:520,height:200}).then(function(w){
    pipWin=w;
    var cs=getComputedStyle(document.documentElement), bs=getComputedStyle(document.body);
    var st=w.document.createElement("style");
    st.textContent="body{margin:0;padding:12px 16px;font-family:"+bs.fontFamily+";background:"+bs.backgroundColor+";color:"+bs.color+";height:100vh;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:10px}"+
      ".k{font-weight:600;line-height:1.35}.e{opacity:.6;margin-top:2px}.i .k{color:"+cs.getPropertyValue("--live")+"}.w{opacity:.6}";
    w.document.head.append(st);
    w.addEventListener("pagehide", function(){ pipWin=null; $("pipBtn").textContent="떠 있는 자막"; });
    $("pipBtn").textContent="떠 있는 자막 닫기";
    pip();
  }).catch(function(){ msg("떠 있는 자막 창을 열지 못했습니다."); });
};
function pip(){
  if(!pipWin) return;
  var d=pipWin.document, b=d.body; b.textContent="";
  var k=Math.max(16,size-2)+"px", e=Math.round(Math.max(16,size-2)*.6)+"px";
  function row(ko,en,cls){ var r=d.createElement("div"); if(cls) r.className=cls;
    var a=d.createElement("div"); a.className="k"; a.style.fontSize=k; a.textContent=ko||"…";
    var c=d.createElement("div"); c.className="e"; c.style.fontSize=e; c.textContent=en; r.append(a,c); b.append(r); }
  var last=lines.slice(interimText?-1:-2);
  if(!last.length&&!interimText){ var w=d.createElement("div"); w.className="w"; w.textContent=running?LANGS[lang].name+"가 들리면 여기에 뜹니다":"본 창에서 듣기 시작을 눌러 주세요"; b.append(w); return; }
  last.forEach(function(l){ row(l.ko,l.en); });
  if(interimText) row($("iKo").textContent, interimText, "i");
}
window.addEventListener("beforeunload", function(){ if(running) stop(); });
})();

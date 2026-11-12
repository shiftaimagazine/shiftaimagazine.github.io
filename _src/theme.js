// 낮·밤 화면(11/3~): 저장된 선택을 그리기 전에 먼저 적용한다(깜빡임 방지). 선택이 없으면 기기 설정을 따른다.
(function(){ var d=document.documentElement, t=null; try{ t=localStorage.getItem("shift-theme"); }catch(e){}
  if(t==="dark"||t==="light") d.setAttribute("data-theme",t);
  var dark = t ? t==="dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  var m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", dark?"#141518":"#FFFFFF"); })();
// 무료 도구 사용법·도구 탭(11/5~): 처음 온 도구는 '사용법', 한 번 '도구 쓰기'를 고른 도구는 바로 도구. 주소 끝 #guide·#use 가 우선. 그리기 전에 정해 깜빡이지 않게.
(function(){ var p=location.pathname; if(!/^\/tools\/[^\/]+\/$/.test(p)) return; var h=location.hash, v=null;
  if(h==="#guide") v="guide"; else if(h==="#use") v="tool"; else { try{ v=localStorage.getItem("shift-tg:"+p); }catch(e){} }
  document.documentElement.setAttribute("data-tpane", v==="tool" ? "tool" : "guide"); })();
// 글꼴(11/12 속도): 구글 폰트 CSS 는 media=print 로 받아 두었다가(build.py FONTS, id=gfont) 받아지는 순간 화면에 적용한다. 그 전까지는 기기 글꼴로 보인다(display=swap 과 같은 흐름). 미리 그리기(prerender)는 바깥 요청을 막아서 이 값이 바뀌지 않는다.
(function(){ function on(l){ if(l && l.id==="gfont" && l.media!=="all") l.media="all"; }
  document.addEventListener("load", function(e){ on(e.target); }, true); })();   // 이 줄이 링크보다 먼저 실행되므로 load 를 놓치지 않는다. 못 받으면(막힘·오류) 기기 글꼴 그대로.

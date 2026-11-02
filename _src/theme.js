// 낮·밤 화면(11/3~): 저장된 선택을 그리기 전에 먼저 적용한다(깜빡임 방지). 선택이 없으면 기기 설정을 따른다.
(function(){ var d=document.documentElement, t=null; try{ t=localStorage.getItem("shift-theme"); }catch(e){}
  if(t==="dark"||t==="light") d.setAttribute("data-theme",t);
  var dark = t ? t==="dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  var m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", dark?"#121315":"#ffffff"); })();

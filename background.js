(function(){
'use strict';
function byId(id){return document.getElementById(id);}
function hideLoading(){var e=byId('loading-tip');if(e)e.style.display='none';}
window.addEventListener('load',function(){setTimeout(hideLoading,900);});
var fs=byId('fullscreen-btn');
if(fs){fs.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var el=document.documentElement,p;if(!document.fullscreenElement){p=(el.requestFullscreen?el.requestFullscreen():Promise.resolve());Promise.resolve(p).then(function(){if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(function(){});}).catch(function(){});}else if(document.exitFullscreen)document.exitFullscreen().catch(function(){});},{passive:false});}
if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
 window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js?v=45').then(function(r){if(r&&r.update)r.update();}).catch(function(){});});
}

if ('serviceWorker' in navigator) {
 var reloadingForWorker=false;
 navigator.serviceWorker.addEventListener('controllerchange',function(){
   if(reloadingForWorker)return;
   reloadingForWorker=true;
   setTimeout(function(){ location.reload(); },120);
 });
}

})();

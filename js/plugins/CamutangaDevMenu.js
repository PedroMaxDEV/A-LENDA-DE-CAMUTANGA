/*:
 * @plugindesc [v2.5 DEV] Menu de testes do Mundo Vivo: clima, desastres, vegetação e diagnóstico do herói.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * ESTE ARQUIVO É SÓ PARA DESENVOLVIMENTO.
 * Para esconder o menu, vá até o FINAL deste arquivo e comente:
 *
 *   // // CamutangaDevMenu.install(); // V3: oculto no lançamento; F9 abre o menu DEV.
if (typeof document !== "undefined") document.addEventListener("keydown", function(e){
    if (e.key === "F9") {
        e.preventDefault();
        CamutangaDevMenu.install();
        var r=document.getElementById("camutanga-dev-root");
        if(r){ r.style.display = (r.style.display === "none" ? "block" : "block"); var p=document.getElementById("camutanga-dev-panel"); if(p)p.style.display="block"; }
    }
});
 *
 * Nada dos sistemas de clima/desastres depende deste menu.
 */
(function(){
'use strict';
window.CamutangaDevMenu=window.CamutangaDevMenu||{};
var D=window.CamutangaDevMenu;
D.VERSION='2.5.0';

D.install=function(){
    if(typeof document==='undefined'||document.getElementById('camutanga-dev-root'))return;
    var root=document.createElement('div');root.id='camutanga-dev-root';
    var toggle=document.createElement('button');toggle.id='camutanga-dev-toggle';toggle.textContent='⚙ DEV';
    var panel=document.createElement('div');panel.id='camutanga-dev-panel';panel.style.display='none';
    panel.innerHTML='\
      <div class="cd-title">CAMUTANGA DEV 2.5</div>\
      <div id="camutanga-dev-status" class="cd-status">carregando...</div>\
      <div class="cd-sub">CLIMA</div>\
      <div class="cd-grid"><button data-act="weather" data-val="auto">Automático</button><button data-act="weather" data-val="clear">☀ Sol</button><button data-act="weather" data-val="cloudy">☁ Nublado</button><button data-act="weather" data-val="rain">🌧 Chuva</button><button data-act="weather" data-val="storm">⛈ Tempestade</button><button data-act="weather" data-val="fog">🌫 Neblina</button></div>\
      <div class="cd-sub">DESASTRES</div>\
      <div class="cd-grid"><button data-act="disaster" data-val="storm">⚡ Temporal</button><button data-act="disaster" data-val="flood">🌊 Enchente</button><button data-act="disaster" data-val="wind">💨 Vendaval</button><button data-act="disaster" data-val="landslide">🪨 Deslizamento</button><button data-act="disaster" data-val="drought">☀ Seca</button><button data-act="disaster" data-val="quake">〰 Terremoto</button><button data-act="clearDisaster">✓ Encerrar</button><button data-act="sfx" data-val="thunder">🔊 Trovão</button></div>\
      <div class="cd-sub">MUNDO</div>\
      <div class="cd-grid"><button data-act="resources">+ Recursos perto</button><button data-act="regen">♻ Regerar vegetação</button><button data-act="hour">+1 hora</button><button data-act="time" data-val="6">06:00</button><button data-act="time" data-val="12">12:00</button><button data-act="time" data-val="18">18:00</button><button data-act="time" data-val="23">23:00</button><button data-act="energy">⚡ Energia</button></div>\
      <div class="cd-sub">TESTES</div>\
      <div class="cd-grid"><button data-act="items">Dar ferramentas</button><button data-act="hero">Diagnóstico herói</button><button data-act="sfx" data-val="wind">Som vento</button><button data-act="sfx" data-val="quake">Som terremoto</button></div>\
      <div class="cd-note">Depois dos testes, comente apenas <b>CamutangaDevMenu.install();</b> no fim deste arquivo.</div>';
    root.appendChild(toggle);root.appendChild(panel);document.body.appendChild(root);

    var style=document.createElement('style');style.textContent='\
      #camutanga-dev-root{position:fixed;z-index:999999;top:8px;right:8px;font-family:Arial,sans-serif;user-select:none;pointer-events:auto}\
      #camutanga-dev-toggle{padding:7px 11px;border:1px solid rgba(255,211,112,.8);border-radius:9px;background:rgba(26,22,17,.90);color:#ffd370;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,.45);cursor:pointer}\
      #camutanga-dev-panel{margin-top:7px;width:300px;padding:10px;border:1px solid rgba(255,211,112,.55);border-radius:10px;background:rgba(18,20,18,.95);box-shadow:0 8px 30px rgba(0,0,0,.6);backdrop-filter:blur(5px);max-height:82vh;overflow:auto}\
      .cd-title{font-size:13px;font-weight:900;letter-spacing:1px;color:#ffd370;margin-bottom:5px}.cd-status{font-size:10px;color:#bfe5c5;background:rgba(255,255,255,.05);padding:5px 6px;border-radius:5px;line-height:1.25}.cd-sub{font-size:11px;opacity:.78;margin:8px 0 4px}.cd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.cd-grid button{min-height:31px;border:1px solid rgba(255,255,255,.16);border-radius:6px;background:#28332b;color:#fff;font-size:11px;cursor:pointer}.cd-grid button:hover{background:#3c4b40}.cd-note{font-size:10px;opacity:.58;margin-top:9px;line-height:1.3}\
      @media(max-width:760px){#camutanga-dev-root{top:72px;right:4px;transform:scale(.82);transform-origin:top right}#camutanga-dev-panel{width:260px}}';document.head.appendChild(style);

    toggle.onclick=function(ev){ev.preventDefault();ev.stopPropagation();panel.style.display=panel.style.display==='none'?'block':'none';D.refreshStatus();};
    panel.addEventListener('mousedown',function(e){e.stopPropagation();});panel.addEventListener('touchstart',function(e){e.stopPropagation();},{passive:true});
    panel.addEventListener('click',function(e){
        var b=e.target;if(!b||b.tagName!=='BUTTON')return;e.preventDefault();e.stopPropagation();
        if(!window.Camutanga||!Camutanga.World)return;var W=Camutanga.World,act=b.getAttribute('data-act'),val=b.getAttribute('data-val');
        if(act==='weather')W.forceWeather(val);
        else if(act==='disaster')W.startDisaster(val);
        else if(act==='clearDisaster')W.clearDisaster(false);
        else if(act==='time')W.setTime(Number(val),0);
        else if(act==='hour')W.advanceHours(1);
        else if(act==='resources')W.spawnResourceBurst();
        else if(act==='regen'&&W.resetGeneratedVegetation)W.resetGeneratedVegetation();
        else if(act==='sfx'&&W.playWorldSfx)W.playWorldSfx(val);
        else if(act==='energy'){var s=Camutanga.state();s.stamina=s.maxStamina;if(Camutanga.toast)Camutanga.toast('Energia restaurada.',80);}
        else if(act==='hero'){
            var info=Camutanga.Hero&&Camutanga.Hero.debugInfo?Camutanga.Hero.debugInfo():{found:false};
            if(Camutanga.toast)Camutanga.toast(info.found?('Herói: visível='+info.visible+' opacidade='+info.opacity+' x='+Math.round(info.x)+' y='+Math.round(info.y)):'Sprite do jogador não encontrado!',220);
        }else if(act==='items'){
            if(window.$gameParty&&window.$dataItems){[41,42,43,44,57,58].forEach(function(id){if($dataItems[id]&&!$gameParty.hasItem($dataItems[id]))$gameParty.gainItem($dataItems[id],1);});if(Camutanga.toast)Camutanga.toast('Vara, isca, enxada, regador, machado e picareta adicionados.',150);}
        }
        D.refreshStatus();
    });
    setInterval(D.refreshStatus,1200);
};

D.refreshStatus=function(){
    var el=document.getElementById('camutanga-dev-status');if(!el||!window.Camutanga||!Camutanga.World)return;
    var W=Camutanga.World,d=W.activeDisaster?W.activeDisaster():null,h=Camutanga.Hero&&Camutanga.Hero.debugInfo?Camutanga.Hero.debugInfo():null;
    var clock=Camutanga.gameClock?Camutanga.gameClock():{hour:0,minute:0};
    var ph=Number(clock.hour)<10?'0'+Number(clock.hour):String(clock.hour),pm=Number(clock.minute)<10?'0'+Number(clock.minute):String(clock.minute);
    el.textContent='Mapa '+(window.$gameMap?$gameMap.mapId():'-')+' · '+ph+':'+pm+' · '+(Camutanga.weatherText?Camutanga.weatherText():'')+' · Herói '+(h&&h.found?(h.visible?'OK':'OCULTO'):'?')+(d?' · '+(W.DISASTER_NAMES[d.type]||d.type):'');
};
})();

// ============================================================================
// MENU DE TESTE: para sumir, coloque // no começo da próxima linha e salve.
// ============================================================================
// CamutangaDevMenu.install(); // V3: oculto no lançamento; F9 abre o menu DEV.
if (typeof document !== "undefined") document.addEventListener("keydown", function(e){
    if (e.key === "F9") {
        e.preventDefault();
        CamutangaDevMenu.install();
        var r=document.getElementById("camutanga-dev-root");
        if(r){ r.style.display = (r.style.display === "none" ? "block" : "block"); var p=document.getElementById("camutanga-dev-panel"); if(p)p.style.display="block"; }
    }
});

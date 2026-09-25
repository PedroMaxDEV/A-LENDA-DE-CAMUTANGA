/*:
 * @plugindesc [v2.4 DEV] Menu de testes de clima/desastres. Remova/comente a linha final para esconder.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * IMPORTANTE:
 * No final deste arquivo existe a linha:
 *   CamutangaDevMenu.install();
 *
 * Para esconder o menu de testes no lançamento, coloque // no começo dela:
 *   // CamutangaDevMenu.install();
 *
 * O restante do código pode continuar no projeto sem afetar o jogo.
 */
(function(){
    'use strict';
    window.CamutangaDevMenu=window.CamutangaDevMenu||{};
    var D=window.CamutangaDevMenu;

    D.install=function(){
        if(typeof document==='undefined'||document.getElementById('camutanga-dev-root'))return;
        var root=document.createElement('div');root.id='camutanga-dev-root';
        var toggle=document.createElement('button');toggle.id='camutanga-dev-toggle';toggle.textContent='DEV';root.appendChild(toggle);
        var panel=document.createElement('div');panel.id='camutanga-dev-panel';panel.style.display='none';
        panel.innerHTML='\
            <div class="cd-title">TESTES DO MUNDO</div>\
            <div class="cd-sub">Clima</div>\
            <div class="cd-grid">\
              <button data-act="weather" data-val="clear">☀ Sol</button>\
              <button data-act="weather" data-val="cloudy">☁ Nublado</button>\
              <button data-act="weather" data-val="rain">🌧 Chuva</button>\
              <button data-act="weather" data-val="storm">⛈ Tempestade</button>\
              <button data-act="weather" data-val="fog">🌫 Neblina</button>\
              <button data-act="weather" data-val="auto">AUTO</button>\
            </div>\
            <div class="cd-sub">Desastres</div>\
            <div class="cd-grid">\
              <button data-act="disaster" data-val="storm">⚡ Temporal</button>\
              <button data-act="disaster" data-val="flood">🌊 Enchente</button>\
              <button data-act="disaster" data-val="wind">💨 Vendaval</button>\
              <button data-act="disaster" data-val="landslide">⛰ Deslizamento</button>\
              <button data-act="disaster" data-val="drought">☀ Seca</button>\
              <button data-act="clearDisaster">✕ Limpar</button>\
            </div>\
            <div class="cd-sub">Tempo / mundo</div>\
            <div class="cd-grid">\
              <button data-act="time" data-val="6">🌅 06:00</button>\
              <button data-act="time" data-val="12">☀ 12:00</button>\
              <button data-act="time" data-val="18">🌇 18:00</button>\
              <button data-act="time" data-val="22">🌙 22:00</button>\
              <button data-act="hour">+1 hora</button>\
              <button data-act="resources">🌲 Recursos</button>\
              <button data-act="energy">⚡ Energia</button>\
              <button data-act="items">🎒 Itens teste</button>\
            </div>\
            <div class="cd-note">Use só para testes. O save registra recursos e clima.</div>';
        root.appendChild(panel);document.body.appendChild(root);

        var style=document.createElement('style');style.id='camutanga-dev-style';
        style.textContent='\
          #camutanga-dev-root{position:fixed;right:10px;top:180px;z-index:2147483000;font-family:Arial,sans-serif;color:#fff;pointer-events:auto}\
          #camutanga-dev-toggle{width:48px;height:36px;border:1px solid rgba(255,211,112,.8);border-radius:9px;background:rgba(26,22,17,.88);color:#ffd370;font-weight:800;box-shadow:0 3px 12px rgba(0,0,0,.45);cursor:pointer}\
          #camutanga-dev-panel{margin-top:7px;width:276px;padding:10px;border:1px solid rgba(255,211,112,.55);border-radius:10px;background:rgba(18,20,18,.94);box-shadow:0 8px 30px rgba(0,0,0,.6);backdrop-filter:blur(5px)}\
          .cd-title{font-size:13px;font-weight:900;letter-spacing:1px;color:#ffd370;margin-bottom:7px}.cd-sub{font-size:11px;opacity:.78;margin:8px 0 4px}.cd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.cd-grid button{min-height:31px;border:1px solid rgba(255,255,255,.16);border-radius:6px;background:#28332b;color:#fff;font-size:11px;cursor:pointer}.cd-grid button:hover{background:#3c4b40}.cd-note{font-size:10px;opacity:.55;margin-top:9px;line-height:1.25}\
          @media(max-width:760px){#camutanga-dev-root{top:80px;right:5px;transform:scale(.86);transform-origin:top right}#camutanga-dev-panel{width:240px}}';
        document.head.appendChild(style);

        toggle.onclick=function(ev){ev.preventDefault();ev.stopPropagation();panel.style.display=panel.style.display==='none'?'block':'none';};
        panel.addEventListener('mousedown',function(e){e.stopPropagation();});
        panel.addEventListener('touchstart',function(e){e.stopPropagation();},{passive:true});
        panel.addEventListener('click',function(e){
            var b=e.target;if(!b||b.tagName!=='BUTTON')return;e.preventDefault();e.stopPropagation();
            if(!window.Camutanga||!Camutanga.World)return;
            var W=Camutanga.World,act=b.getAttribute('data-act'),val=b.getAttribute('data-val');
            if(act==='weather')W.forceWeather(val);
            else if(act==='disaster')W.startDisaster(val);
            else if(act==='clearDisaster')W.clearDisaster(false);
            else if(act==='time')W.setTime(Number(val),0);
            else if(act==='hour')W.advanceHours(1);
            else if(act==='resources')W.spawnResourceBurst();
            else if(act==='energy'){
                var s=Camutanga.state();s.stamina=s.maxStamina;if(Camutanga.toast)Camutanga.toast('Energia restaurada para testes.',90);
            }else if(act==='items'){
                if(window.$gameParty&&window.$dataItems){[42,57,58,59,64,66,67,68,69,74,75,77].forEach(function(id){if($dataItems[id])$gameParty.gainItem($dataItems[id],id===42?10:3);});if(Camutanga.toast)Camutanga.toast('Itens de teste adicionados.',120);}
            }
        });
    };
})();

// ============================================================================
// MENU DE TESTE: para sumir, coloque // no começo da próxima linha e salve.
// ============================================================================
CamutangaDevMenu.install();

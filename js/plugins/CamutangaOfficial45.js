/*:
 * @plugindesc Camutanga V4.5 - Geografia oficial: cena1 -> cena2 -> Rua Santa Cruz, passagens livres, mapa correto e rio oficial.
 * @author OpenAI + projeto A Lenda de Camutanga
 *
 * @help
 * Patch de correção estrutural baseado nos mapas reais do projeto original.
 * - Nova Vida começa em cena1 (Mapa 13), passa por cena2 (Mapa 12) e chega à Rua Santa Cruz (Mapa 2).
 * - O ônibus/lotação é animado SOBRE os mapas reais, sem tela HTML de introdução.
 * - Barreiras de missão deixam de ter colisão, mas sensores, switches, diálogos e missões continuam ativos.
 * - O mapa usa somente áreas reais e respeita o rio: direita do Casarão -> lado direito -> frente da Base.
 * - Mantém o autosave da V4.4.
 */
(function(){
'use strict';
window.Camutanga=window.Camutanga||{};
var C=window.Camutanga;
var O=C.Official45=C.Official45||{};
O.VERSION='4.5.0'; O.BUILD='45';
O.START_MAP=13; O.ROAD2_MAP=12; O.CITY_MAP=2;
O.CITY_X=1; O.CITY_Y=14;
O._road=null; O._lastMap=0;

function relaunch(){return C.Relaunch40&&C.Relaunch40.state?C.Relaunch40.state():null;}
function life(){return C.state?C.state():null;}
function isJourney(){var s=relaunch();return !!(s&&s.newJourney);}
function introData(){var s=relaunch();if(!s)return null;if(!s._official45)s._official45={stage:0,done:false,migrated:false};return s._official45;}
function introActive(){var d=introData();return !!(isJourney()&&d&&!d.done&&($gameMap&&($gameMap.mapId()===13||$gameMap.mapId()===12)));}
function toast(t,f){try{if(C.toast)C.toast(t,f||180);}catch(e){}}
function se(name,vol,pitch){try{AudioManager.playSe({name:name,volume:vol||60,pitch:pitch||100,pan:0});}catch(e){}}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

// -------------------------------------------------------------------------
// 1) NOVA VIDA: sequência correta cena1 -> cena2 -> Rua Santa Cruz.
// -------------------------------------------------------------------------
if(C.Relaunch40){
  C.Relaunch40.ARRIVAL_MAP=13;
  C.Relaunch40.ARRIVAL_X=0;
  C.Relaunch40.ARRIVAL_Y=16;
  C.Relaunch40.CITY_ENTRY_MAP=2;
  // Mata definitivamente a antiga tela HTML da chegada.
  C.Relaunch40.openArrival=function(){};
}

Scene_Title.prototype.commandCamutangaFree=function(){
  DataManager.setupNewGame();
  if(C.Relaunch40&&C.Relaunch40.resetNewJourney)C.Relaunch40.resetNewJourney();
  var s=relaunch();if(s){s.introSeen=true;s.chapter=0;s._official45={stage:1,done:false,migrated:true};}
  try{$gameParty._gold=0;$gameParty.gainGold(120);}catch(e){}
  try{
    if($dataItems[168])$gameParty.gainItem($dataItems[168],1);
    if($dataItems[170])$gameParty.gainItem($dataItems[170],1);
  }catch(e){}
  try{if($gameVariables)$gameVariables.setValue(3,8*60+10);}catch(e){}
  try{if($gameSwitches){$gameSwitches.setValue(26,true);$gameSwitches.setValue(91,false);$gameSwitches.setValue(84,false);}}catch(e){}
  try{var a=$gameActors.actor(1);if(a&&a.setName)a.setName('Jhon');}catch(e){}
  try{if(C.Social35&&C.Social35.state){var ss=C.Social35.state();ss.nameChosen=false;ss.playerName='';}}catch(e){}
  $gamePlayer.setTransparent(true);
  $gamePlayer.reserveTransfer(13,0,16,6,0);
  this._commandWindow.close();this.fadeOutAll();SceneManager.goto(Scene_Map);
};

// O nome só é pedido DEPOIS da viagem, quando o jogador chega à Rua Santa Cruz.
if(C.Social35&&C.Social35.ensureName){
  var _ensureName45=C.Social35.ensureName;
  C.Social35.ensureName=function(){
    var d=introData();
    if(isJourney()&&d&&!d.done)return;
    return _ensureName45.apply(this,arguments);
  };
}

// Durante a viagem nova, os eventos antigos de carroça/cangaceiro ficam inativos.
// A campanha História Original não é tocada.
var _findPage45=Game_Event.prototype.findProperPageIndex;
Game_Event.prototype.findProperPageIndex=function(){
  try{if(introActive())return -1;}catch(e){}
  return _findPage45.call(this);
};

var _canMove45=Game_Player.prototype.canMove;
Game_Player.prototype.canMove=function(){if(O._road||introActive())return false;return _canMove45.call(this);};

O.cleanupRoad=function(){
  var r=O._road;if(!r)return;
  try{if(r.sprite&&r.sprite.parent)r.sprite.parent.removeChild(r.sprite);}catch(e){}
  try{if(r.label&&r.label.parent)r.label.parent.removeChild(r.label);}catch(e){}
  try{if(r.bars){r.bars.forEach(function(x){if(x&&x.parent)x.parent.removeChild(x);});}}catch(e){}
  O._road=null;
};

O.makeBar=function(y,h){var sp=new Sprite(new Bitmap(Graphics.boxWidth,h));sp.bitmap.fillRect(0,0,Graphics.boxWidth,h,'rgba(5,8,6,.76)');sp.x=0;sp.y=y;return sp;};
O.startRoad=function(scene,mapId){
  if(!scene||O._road)return;
  var d=introData();if(!d||d.done)return;
  try{$gamePlayer.setTransparent(true);}catch(e){}
  var bus=new Sprite(ImageManager.loadBitmap('img/pictures/CamutangaUI/','Bus43'));
  bus.anchor.x=.5;bus.anchor.y=1;bus.scale.x=.68;bus.scale.y=.68;
  bus.x=-150;
  var py=0;try{py=$gamePlayer.screenY();}catch(e){}
  bus.y=clamp((py||Graphics.boxHeight*.53)+54,Graphics.boxHeight*.42,Graphics.boxHeight-92);
  var lab=new Sprite(new Bitmap(Graphics.boxWidth,54));lab.x=0;lab.y=Graphics.boxHeight-78;
  lab.bitmap.fontSize=17;lab.bitmap.textColor='#f6e9b5';lab.bitmap.outlineColor='rgba(0,0,0,.9)';lab.bitmap.outlineWidth=4;
  lab.bitmap.drawText(mapId===13?'ESTRADA PARA CAMUTANGA':'A CIDADE ESTÁ LOGO ADIANTE',0,8,Graphics.boxWidth,34,'center');
  var top=O.makeBar(0,32),bot=O.makeBar(Graphics.boxHeight-34,34);
  scene.addChild(bus);scene.addChild(lab);scene.addChild(top);scene.addChild(bot);
  O._road={scene:scene,sprite:bus,label:lab,bars:[top,bot],mapId:mapId,t:0,phase:0};
  if(mapId===13)se('Camutanga_BusArrive',50,94);
};
O.finishRoadMap=function(mapId){
  var d=introData();O.cleanupRoad();
  if(!d)return;
  if(mapId===13){
    d.stage=2;
    $gamePlayer.reserveTransfer(12,9,19,6,1);
  }else if(mapId===12){
    d.stage=3;d.done=true;
    $gamePlayer.reserveTransfer(2,O.CITY_X,O.CITY_Y,6,1);
  }
};
O.updateRoad=function(){
  var r=O._road;if(!r)return;
  r.t++;
  var W=Graphics.boxWidth;
  if(r.mapId===13){
    r.sprite.x=-140+(W+310)*Math.min(1,r.t/210);
    r.sprite.y+=Math.sin(r.t*.24)*.18;
    if(r.t>=220)O.finishRoadMap(13);
  }else{
    var u=Math.min(1,r.t/230),ease=1-Math.pow(1-u,2);
    r.sprite.x=-140+(W*.72+220)*ease;
    r.sprite.y+=Math.sin(r.t*.22)*.16;
    if(r.t===150){r.label.bitmap.clear();r.label.bitmap.drawText('RUA SANTA CRUZ • CAMUTANGA',0,8,Graphics.boxWidth,34,'center');}
    if(r.t>=245)O.finishRoadMap(12);
  }
};

var _sceneStart45=Scene_Map.prototype.start;
Scene_Map.prototype.start=function(){
  _sceneStart45.call(this);
  O._lastMap=$gameMap?$gameMap.mapId():0;
  var d=introData();
  if(isJourney()&&d&&!d.done&&(O._lastMap===13||O._lastMap===12)){
    var self=this;setTimeout(function(){if(SceneManager._scene===self)O.startRoad(self,O._lastMap);},180);
  }else if(isJourney()&&d&&d.done&&O._lastMap===2){
    try{$gamePlayer.setTransparent(false);}catch(e){}
    if(!d.arrivalNotice){
      d.arrivalNotice=true;
      setTimeout(function(){toast('CHEGADA A CAMUTANGA • Conheça a Rua Santa Cruz e converse com os moradores.',300);if(C.Social35&&C.Social35.ensureName)C.Social35.ensureName();if(C.Release44&&C.Release44.scheduleAutosave)C.Release44.scheduleAutosave('chegada oficial',80);},420);
    }
  }
  setTimeout(function(){O.applyPassageFixes();O.installOfficialMap();},280);
};
var _sceneUpdate45=Scene_Map.prototype.update;
Scene_Map.prototype.update=function(){_sceneUpdate45.call(this);O.updateRoad();};
var _sceneTerminate45=Scene_Map.prototype.terminate;
Scene_Map.prototype.terminate=function(){O.cleanupRoad();_sceneTerminate45.call(this);};

// Migração gentil: saves V4.4 que ainda estavam no capítulo 0/Trevo podem refazer a chegada correta uma vez.
O.migrateOldJourney=function(){
  var s=relaunch();if(!s||!s.newJourney)return;
  var d=introData();if(d.migrated)return;d.migrated=true;
  if(Number(s.chapter||0)===0&&$gameMap&&$gameMap.mapId()===7){
    d.done=false;d.stage=1;s.introSeen=true;$gamePlayer.setTransparent(true);$gamePlayer.reserveTransfer(13,0,16,6,1);toast('Rota de chegada corrigida: cena1 → cena2 → Rua Santa Cruz.',220);
  }
};

// -------------------------------------------------------------------------
// 2) PASSAGENS OFICIAIS: missão continua, parede invisível não.
// -------------------------------------------------------------------------
O.fixedBarrierIds={
  2:{1:1,2:1,3:1,4:1,13:1,133:1,134:1,135:1},
  7:{14:1,15:1,16:1,17:1,18:1,19:1,45:1,46:1,47:1,48:1,
     98:1,99:1,100:1,101:1,102:1,103:1,116:1,117:1,118:1,119:1,120:1,121:1,122:1,
     124:1,125:1,126:1,127:1,128:1,129:1,130:1,131:1,132:1,133:1,134:1,135:1,136:1,137:1,138:1,139:1,140:1,141:1,142:1,143:1,144:1,145:1,146:1}
};
O.missionGateSwitches={36:1,43:1,52:1,59:1,75:1,78:1,79:1,80:1,81:1};
O.isMissionPassageEvent=function(ev){
  try{
    var mid=$gameMap.mapId(),eid=ev.eventId();
    if(O.fixedBarrierIds[mid]&&O.fixedBarrierIds[mid][eid])return true;
    var p=ev.page&&ev.page();if(!p)return false;
    var im=p.image||{},cond=p.conditions||{};
    // As linhas de fogo eram usadas como portões de missão. Mantemos o evento/visual,
    // mas a chama nunca bloqueia a caminhada.
    if(im.characterName==='!Flame'&&cond.switch1Valid&&O.missionGateSwitches[Number(cond.switch1Id||0)])return true;
    return false;
  }catch(e){return false;}
};
var _eventThrough45=Game_Event.prototype.isThrough;
Game_Event.prototype.isThrough=function(){if(O.isMissionPassageEvent(this))return true;return _eventThrough45.call(this);};

// Para as mensagens que eram APENAS "área bloqueada", não inicia o texto.
var _eventStart45=Game_Event.prototype.start;
Game_Event.prototype.start=function(){
  try{
    if(O.isMissionPassageEvent(this)){
      var p=this.page&&this.page(),txt='';
      (p&&p.list||[]).forEach(function(c){if(c&&(c.code===401||c.code===108||c.code===408))txt+=' '+String((c.parameters||[])[0]||'');});
      if(/bloquead|complete as miss|completar uma miss|precisa completar uma miss/i.test(txt))return;
    }
  }catch(e){}
  return _eventStart45.call(this);
};
O.applyPassageFixes=function(){
  try{($gameMap.events? $gameMap.events():[]).forEach(function(ev){if(O.isMissionPassageEvent(ev))ev._through=true;});}catch(e){}
};

// -------------------------------------------------------------------------
// 3) MAPA OFICIAL: somente lugares reais + rio correto.
// -------------------------------------------------------------------------
O.MAP={
  2:{name:'Rua Santa Cruz',x:31,y:63,tag:'RUA PRINCIPAL',tip:'Comércio, hospedagem, bar, cantina, peixaria e acesso ao Trevo.'},
  7:{name:'Trevo',x:33,y:75,tag:'LIGAÇÃO',tip:'Conecta Rua Santa Cruz à Praça, Igreja e Base do jogador.'},
  11:{name:'Praça da Bíblia',x:47,y:67,tag:'PRAÇA',tip:'Eventos, moradores e atividades da cidade.'},
  8:{name:'Igreja / Cemitério',x:59,y:54,tag:'HISTÓRIA',tip:'Igreja, cemitério e acesso à Pedro Albuquerque Uchôa.'},
  14:{name:'Pedro Albuquerque Uchôa',x:69,y:43,tag:'RUA HISTÓRICA',tip:'Eixo que liga a Igreja ao Casarão.'},
  3:{name:'Casarão',x:80,y:24,tag:'ZONA RURAL',tip:'Casarão antigo. O rio passa pelo lado direito desta região.'},
  15:{name:'Caminho da Pedra',x:49,y:31,tag:'ZONA RURAL',tip:'Caminho entre o Casarão, Pedra da Caveira e Vila.'},
  9:{name:'Pedra da Caveira',x:39,y:35,tag:'LENDA',tip:'Área ligada à lenda e ao interior da Pedra.'},
  16:{name:'Vila',x:17,y:23,tag:'VILAREJO',tip:'Vila distante ligada à zona rural.'},
  26:{name:'Floresta',x:22,y:47,tag:'EXPLORAÇÃO',tip:'Madeira, ervas, coleta e caminho para a Caverna de Lava.'},
  25:{name:'Caverna de Lava',x:20,y:34,tag:'EXPLORAÇÃO',tip:'Mineração e desafios subterrâneos.'},
  5:{name:'Base do jogador',x:55,y:91,tag:'PROPRIEDADE',tip:'Sua base. O rio passa em frente à propriedade.'}
};
O.PARENT={4:3,6:5,10:9,17:2,18:2,19:2,20:2,21:2,22:7,23:2,24:2,27:8,28:8,12:2,13:2};
O.LINKS=[[2,7],[7,11],[7,8],[7,5],[8,14],[14,3],[3,15],[3,9],[15,16],[2,26],[26,25]];
O.mapIdForDisplay=function(id){return O.MAP[id]?id:(O.PARENT[id]||id);};
O.closeMap=function(){var e=document.getElementById('cmt45-map');if(e)e.remove();document.body.classList.remove('camutanga-ui-open');};
O.targetMap=function(){
  try{var t=C.Release43&&C.Release43.objectiveTarget?Number(C.Release43.objectiveTarget()||0):0;return O.mapIdForDisplay(t);}catch(e){return 0;}
};
O.storyTargets=function(){try{return (C.Release43&&C.Release43.storyTargets?C.Release43.storyTargets():[]).map(O.mapIdForDisplay);}catch(e){return[];}};
O.svg=function(){
  var s='<svg viewBox="0 0 100 100" preserveAspectRatio="none">';
  // Rio oficial: direita do Casarão -> desce pelo lado direito -> passa na frente da Base -> segue reto.
  s+='<path d="M91 12 C96 25 94 42 94 61 C94 74 87 82 72 84 L6 84" fill="none" stroke="#6a99a7" stroke-width="6" stroke-linecap="round" opacity=".85"/>';
  s+='<path d="M91 12 C96 25 94 42 94 61 C94 74 87 82 72 84 L6 84" fill="none" stroke="#b7dde0" stroke-width="2" stroke-linecap="round" opacity=".8"/>';
  O.LINKS.forEach(function(l){var a=O.MAP[l[0]],b=O.MAP[l[1]];if(!a||!b)return;s+='<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#7b5a32" stroke-width="4" stroke-linecap="round"/><line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#e0c67e" stroke-width="1.4" stroke-linecap="round"/>';});
  // Estrada de chegada: cena1/cena2 chegam à Rua Santa Cruz.
  var r=O.MAP[2];s+='<path d="M2 63 L'+r.x+' '+r.y+'" stroke="#7b5a32" stroke-width="4"/><path d="M2 63 L'+r.x+' '+r.y+'" stroke="#e0c67e" stroke-width="1.4"/>';
  s+='</svg>';return s;
};
O.openMap=function(){
  O.closeMap();document.body.classList.add('camutanga-ui-open');
  var raw=$gameMap?$gameMap.mapId():0,cur=O.mapIdForDisplay(raw),target=O.targetMap(),stories=O.storyTargets();
  var root=document.createElement('div');root.id='cmt45-map';
  var nodes='';Object.keys(O.MAP).forEach(function(k){var id=Number(k),p=O.MAP[id],cl=(id===cur?' current':'')+(id===target?' target':'')+(stories.indexOf(id)>=0?' story':'');nodes+='<button class="pt'+cl+'" data-id="'+id+'" style="left:'+p.x+'%;top:'+p.y+'%"><i></i><b>'+p.name+'</b></button>';});
  root.innerHTML='<div class="book"><header><div><small>MAPA DE CAMUTANGA • ROTAS REAIS DO JOGO</small><h1>Ruas históricas e zona rural</h1></div><button id="cmt45-close">FECHAR ×</button></header><main><section class="world"><div class="paper"></div>'+O.svg()+nodes+'<div class="street s1">R. SANTA CRUZ</div><div class="street s2">R. PEDRO DE ALBUQUERQUE UCHÔA</div><div class="street s3">R. JOAQUIM NABUCO</div><div class="river">RIO</div><div class="arrival">← CENA 1 / CENA 2 • ESTRADA DE CHEGADA</div><div class="legend"><span class="you"></span> Você <span class="goal"></span> Objetivo <span class="storyc"></span> A Lenda</div></section><aside><small>LOCAL ATUAL</small><h2>'+((O.MAP[cur]&&O.MAP[cur].name)||'Camutanga')+'</h2><p id="cmt45-info">'+((O.MAP[cur]&&O.MAP[cur].tip)||'Explore Camutanga.')+'</p><div class="note"><b>Curso do rio</b><br>Desce à direita do Casarão, contorna a lateral e passa em frente à Base do jogador.</div></aside></main></div>';
  var css=document.createElement('style');css.textContent=''
  +'#cmt45-map{position:fixed;inset:0;z-index:2147483400;background:rgba(5,8,6,.95);display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;font-family:Arial,sans-serif;color:#332816}'
  +'#cmt45-map .book{width:min(1180px,98vw);height:min(730px,97vh);display:grid;grid-template-rows:auto 1fr;background:#ead7a5;border:2px solid #8d6c35;border-radius:20px;overflow:hidden;box-shadow:0 24px 90px #000c}'
  +'#cmt45-map header{display:flex;align-items:center;padding:14px 18px;background:#1e3025;color:#fff;border-bottom:3px solid #c89d42}#cmt45-map header small{letter-spacing:2.5px;color:#e8c86a}#cmt45-map h1{margin:3px 0 0;font-size:27px}#cmt45-close{margin-left:auto;min-height:48px;border:0;border-radius:12px;padding:0 18px;background:#e0b94d;font-weight:900;color:#1b1609}'
  +'#cmt45-map main{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 285px}.world{position:relative;overflow:hidden;background:linear-gradient(145deg,#ead8ab,#d6bd82)}.paper{position:absolute;inset:0;background:radial-gradient(circle at 25% 25%,#fff5,transparent 34%),repeating-linear-gradient(0deg,#5c42200b 0 1px,transparent 1px 7px)}.world svg{position:absolute;inset:3%;width:94%;height:94%}'
  +'.pt{position:absolute;transform:translate(-50%,-50%);border:0;background:transparent;display:flex;flex-direction:column;align-items:center;gap:3px;color:#332816;cursor:pointer;max-width:128px}.pt i{width:28px;height:28px;border-radius:50%;background:#426147;border:3px solid #f5e5b7;box-shadow:0 3px 9px #0005}.pt b{font-size:10px;line-height:1.08;background:#f4e5b9e8;padding:3px 5px;border-radius:6px;box-shadow:0 1px 4px #0003}.pt.current i{background:#2e79bb;box-shadow:0 0 0 5px #2e79bb44}.pt.target i{background:#d7a31e;animation:c45p .8s infinite alternate}.pt.story:not(.target) i{background:#a8453e}'
  +'.street{position:absolute;font-size:9px;font-weight:900;letter-spacing:1px;color:#6b4d28;background:#ecd9a5bd;padding:2px 5px;border-radius:4px;pointer-events:none}.s1{left:12%;top:66%}.s2{left:66%;top:34%;transform:rotate(-53deg)}.s3{left:49%;top:56%;transform:rotate(-55deg)}.river{position:absolute;right:4%;top:48%;font-size:9px;font-weight:900;color:#416f7e;transform:rotate(90deg)}.arrival{position:absolute;left:2%;top:57%;font-size:8px;font-weight:900;color:#71542d}.legend{position:absolute;left:12px;bottom:10px;background:#f5e6bddd;padding:7px 9px;border-radius:8px;font-size:10px;display:flex;align-items:center;gap:6px}.legend span{width:9px;height:9px;border-radius:50%}.you{background:#2e79bb}.goal{background:#d7a31e}.storyc{background:#a8453e}'
  +'#cmt45-map aside{padding:24px;background:#f7ebc9;border-left:1px solid #b8a06d;overflow:auto}#cmt45-map aside small{letter-spacing:2px;color:#8b6729;font-weight:900}#cmt45-map aside h2{font-size:26px;margin:7px 0 12px}#cmt45-map aside p{line-height:1.55;color:#4e412c}.note{margin-top:20px;padding:12px;border-radius:10px;background:#d7e1d1;color:#405043;font-size:12px;line-height:1.45}@keyframes c45p{to{transform:scale(1.2)}}'
  +'@media(max-width:760px){#cmt45-map{padding:4px}#cmt45-map .book{height:99vh}#cmt45-map header{padding:8px 10px}#cmt45-map h1{font-size:18px}#cmt45-map header small{font-size:7px}#cmt45-close{min-height:42px;padding:0 10px}#cmt45-map main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 135px}#cmt45-map aside{padding:9px 12px;border-left:0;border-top:1px solid #b8a06d}#cmt45-map aside h2{font-size:18px;margin:2px 0}.note{display:none}.pt i{width:23px;height:23px}.pt b{font-size:7px;max-width:72px}.street{font-size:6px}.arrival{font-size:6px}.legend{font-size:7px;left:4px;bottom:4px;padding:4px 6px}}';
  root.appendChild(css);document.body.appendChild(root);
  root.querySelector('#cmt45-close').onclick=O.closeMap;
  root.querySelectorAll('.pt').forEach(function(btn){btn.onclick=function(){var p=O.MAP[Number(btn.dataset.id)],inf=root.querySelector('#cmt45-info');if(inf&&p)inf.innerHTML='<b>'+p.name+'</b><br><small>'+p.tag+'</small><br><br>'+p.tip+(Number(btn.dataset.id)===target?'<br><br><b>📍 Objetivo atual nesta região.</b>':'');};});
};
O.installOfficialMap=function(){
  if(C.Release44){C.Release44.openMap=O.openMap;C.Release44.closeMap=O.closeMap;}
};
O.installOfficialMap();
// Desliga os minimapas antigos que eram recriados periodicamente pelas V4.2/V4.3.
if(C.Release42){
  C.Release42.openMap=O.openMap;C.Release42.closeMap=O.closeMap;
  C.Release42.ensureMini=function(){var e=document.getElementById('cmt42-mini');if(e)e.remove();};
  C.Release42.ensureMapButton=function(){var e=document.getElementById('cmt42-map-btn');if(e)e.remove();};
}
if(C.Release43){
  C.Release43.openMap=O.openMap;C.Release43.closeMap=O.closeMap;
  C.Release43.ensureMini=function(){['cmt43-mini','cmt42-mini'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove();});};
  C.Release43.ensureMapButton=function(){['cmt43-map-btn','cmt42-map-btn'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove();});};
}

// Ajusta o minimapa da V4.4 para usar o nome da área real e não a topologia antiga.
if(C.Release44&&C.Release44.ensureMini){
  C.Release44.ensureMini=function(){
    ['cmt42-mini','cmt43-mini','cmt44-mini','cmt45-mini','cmt42-map-btn','cmt43-map-btn','cmt44-map-btn'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove();});
    if(!(SceneManager._scene instanceof Scene_Map))return;
    var raw=$gameMap?$gameMap.mapId():0,cur=O.mapIdForDisplay(raw),p=O.MAP[cur];if(!p)return;
    var target=O.targetMap(),tp=O.MAP[target];
    var b=document.createElement('button');b.id='cmt45-mini';b.innerHTML='<span style="display:block;font-size:8px;letter-spacing:2px;color:#e2c466">MAPA</span><b style="display:block;font-size:12px">'+p.name+'</b><em style="display:block;font-size:8px;font-style:normal;opacity:.75">'+(tp?'Objetivo → '+tp.name:'M = abrir mapa')+'</em>';
    b.style.cssText='position:fixed;right:max(8px,env(safe-area-inset-right));top:max(112px,env(safe-area-inset-top));z-index:8800;width:164px;min-height:58px;text-align:left;padding:8px 10px;border:1px solid #b99745;border-radius:12px;background:rgba(22,34,26,.90);color:#fff;box-shadow:0 4px 16px #0007;font-family:Arial,sans-serif;cursor:pointer';b.onclick=O.openMap;document.body.appendChild(b);
  };
}

// -------------------------------------------------------------------------
// 4) Inicialização/migração e diagnóstico.
// -------------------------------------------------------------------------
var _mapStart45b=Scene_Map.prototype.start;
Scene_Map.prototype.start=function(){_mapStart45b.call(this);setTimeout(function(){O.migrateOldJourney();O.applyPassageFixes();if(C.Release44&&C.Release44.ensureMini)C.Release44.ensureMini();},500);};
O.debug=function(){return {build:45,map:$gameMap?$gameMap.mapId():0,displayMap:O.mapIdForDisplay($gameMap?$gameMap.mapId():0),intro:introData(),barriersFixed:Object.keys(O.fixedBarrierIds).length};};

})();

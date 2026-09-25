/*:
 * @plugindesc Camutanga V4.3 - Correcao Total / Relancamento
 * @author OpenAI
 * @help
 * Build 43. Patch cumulativo de polimento: abertura in-game, mundo livre sem
 * barreiras, mapa/minimapa funcional, pesca, hotbar/itens na mao, lojas,
 * clima global e correcoes de spawn.
 */
(function(){
'use strict';
var C = window.Camutanga = window.Camutanga || {};
var R43 = C.Release43 = C.Release43 || {};
R43.VERSION = 43;

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function itemById(id){ return window.$dataItems && $dataItems[id]; }
function activeItemId(){
  try {
    var life = C.state ? C.state() : null;
    if (life && Number(life.activeItemId||0)>0) return Number(life.activeItemId);
    var st = C.V3 && C.V3.state ? C.V3.state() : null;
    if (st && st.hotbar) return Number(st.hotbar[Number(st.hotIndex||0)]||0);
  } catch(e){}
  return 0;
}
function hasItem(id){ var it=itemById(id); return !!(it && $gameParty && $gameParty.numItems(it)>0); }
function toast(t){ try { if(C.V3&&C.V3.toast) C.V3.toast(t); else if($gameMessage) $gameMessage.add(t); } catch(e){} }

// ---------------------------------------------------------------------------
// 1) MUNDO: clima/iluminacao em TODOS os mapas + limpeza urbana de vegetacao
// ---------------------------------------------------------------------------
var URBAN = {2:true,7:true,8:true,11:true,14:true,16:true,17:true,18:true,19:true,20:true,21:true,22:true,23:true,24:true,27:true,28:true};

if (C.World) {
  var W = C.World;
  var _wEnsure = W.ensureNodes;
  W.ensureNodes = function(mid){
    mid = Number(mid || ($gameMap ? $gameMap.mapId() : 0));
    if (URBAN[mid]) {
      try {
        var st = W.state && W.state();
        if (st && st.nodes && !st._r43UrbanPurge) st._r43UrbanPurge = {};
        if (st && st.nodes && (!st._r43UrbanPurge || !st._r43UrbanPurge[mid])) {
          st.nodes[mid] = [];
          st._r43UrbanPurge = st._r43UrbanPurge || {};
          st._r43UrbanPurge[mid] = true;
        }
      } catch(e){}
      return [];
    }
    return _wEnsure ? _wEnsure.apply(this, arguments) : [];
  };

  // V4.3: hora sempre vence tints antigos de eventos, inclusive interiores.
  R43.refreshEnvironment = function(force){
    try {
      if (!SceneManager._scene || !(SceneManager._scene instanceof Scene_Map)) return;
      if (W.applyEnvironment) W.applyEnvironment(!!force);
    } catch(e){}
  };
}

var _gmSetup43 = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId){
  _gmSetup43.call(this,mapId);
  try {
    if (C.World) {
      var st=C.World.state&&C.World.state();
      if(st) st._lastVisualKey='__r43_force__';
      if(C.World.ensureNodes) C.World.ensureNodes(mapId);
    }
  } catch(e){}
};

var _smUpdate43 = Scene_Map.prototype.update;
Scene_Map.prototype.update = function(){
  _smUpdate43.call(this);
  if ((Graphics.frameCount % 45)===0) R43.refreshEnvironment(true);
  R43.enforceLegacyHudHidden(this);
  R43.updateArrival(this);
};

// ---------------------------------------------------------------------------
// 2) SPAWNS SEGUROS: lixo/achados/NPC em tile acessivel, nunca dentro de parede
// ---------------------------------------------------------------------------
R43.reachableCache = null;
R43.reachableMapId = 0;
R43.buildReachable = function(){
  if (!$gameMap || !$gamePlayer) return {};
  var mid=$gameMap.mapId();
  if(R43.reachableCache && R43.reachableMapId===mid) return R43.reachableCache;
  var w=$gameMap.width(), h=$gameMap.height();
  var sx=$gamePlayer.x, sy=$gamePlayer.y;
  var q=[[sx,sy]], qi=0, seen={}; seen[sx+','+sy]=true;
  var cap=Math.min(w*h,12000);
  while(qi<q.length && qi<cap){
    var p=q[qi++], x=p[0], y=p[1];
    var dirs=[[2,0,1],[4,-1,0],[6,1,0],[8,0,-1]];
    for(var i=0;i<dirs.length;i++){
      var d=dirs[i][0], nx=$gameMap.roundXWithDirection(x,d), ny=$gameMap.roundYWithDirection(y,d);
      var k=nx+','+ny;
      if(seen[k]) continue;
      if($gameMap.isValid(nx,ny) && $gameMap.isPassable(x,y,d)){
        seen[k]=true; q.push([nx,ny]);
      }
    }
  }
  R43.reachableCache=seen; R43.reachableMapId=mid;
  return seen;
};

var _gmSetupReach43 = Game_Map.prototype.setup;
Game_Map.prototype.setup = function(mapId){
  R43.reachableCache=null; R43.reachableMapId=0;
  _gmSetupReach43.call(this,mapId);
};

if (C.City) {
  var City=C.City;
  City.validTile = function(x,y){
    try {
      if(!$gameMap || !$gameMap.isValid(x,y)) return false;
      var seen=R43.buildReachable();
      if(!seen[x+','+y]) return false;
      if($gamePlayer && Math.abs($gamePlayer.x-x)+Math.abs($gamePlayer.y-y)<2) return false;
      if($gameMap.eventsXy && $gameMap.eventsXy(x,y).length) return false;
      if($gameMap.regionId && $gameMap.regionId(x,y)===20) return false;
      var ok=false;
      [2,4,6,8].forEach(function(d){ if($gameMap.isPassable(x,y,d)) ok=true; });
      if(!ok) return false;
      if(C.Release42 && C.Release42.isWater && C.Release42.isWater(x,y)) return false;
      return true;
    } catch(e){ return false; }
  };
  City.pickTile = function(){
    if(!$gameMap || !$gamePlayer) return null;
    var w=$gameMap.width(),h=$gameMap.height();
    for(var i=0;i<90;i++){
      var r=5+Math.floor(Math.random()*13);
      var x=clamp($gamePlayer.x + Math.floor(Math.random()*(r*2+1))-r,0,w-1);
      var y=clamp($gamePlayer.y + Math.floor(Math.random()*(r*2+1))-r,0,h-1);
      if(City.validTile(x,y)) return {x:x,y:y};
    }
    for(var dy=-5;dy<=5;dy++) for(var dx=-5;dx<=5;dx++){
      var xx=$gamePlayer.x+dx, yy=$gamePlayer.y+dy;
      if(City.validTile(xx,yy)) return {x:xx,y:yy};
    }
    return ($gamePlayer ? {x:$gamePlayer.x,y:$gamePlayer.y} : {x:1,y:1});
  };
}

// ---------------------------------------------------------------------------
// 3) BARREIRAS: so desliga bloqueadores, nunca as missoes/cutscenes
// ---------------------------------------------------------------------------
R43.pageText = function(page){
  if(!page || !page.list) return '';
  var s='';
  for(var i=0;i<page.list.length;i++){
    var c=page.list[i];
    if(c && (c.code===401 || c.code===101)) s += ' '+String((c.parameters&&c.parameters[c.code===401?0:4])||'');
  }
  return s.toLowerCase();
};
R43.isBarrierPage = function(page){
  var t=R43.pageText(page);
  return /(essa\s+(parte|area|área).*bloquead|temporariamente\s+bloq|complete\s+(as\s+)?miss(ao|ão|oes|ões).*pass)/i.test(t);
};
R43.freeRoamOn = function(){
  try {
    if(C.FreeRoam && C.FreeRoam.enabled) return !!C.FreeRoam.enabled();
    if(C.Relaunch40 && C.Relaunch40.state) return C.Relaunch40.state().mode!=='story';
  }catch(e){}
  return true;
};
var _geRefresh43=Game_Event.prototype.refresh;
Game_Event.prototype.refresh=function(){
  _geRefresh43.call(this);
  try {
    if(R43.freeRoamOn() && R43.isBarrierPage(this.page())){
      this._through=true; this._priorityType=0; this._trigger=0;
    }
  }catch(e){}
};
var _geStart43=Game_Event.prototype.start;
Game_Event.prototype.start=function(){
  try { if(R43.freeRoamOn() && R43.isBarrierPage(this.page())) return; } catch(e){}
  _geStart43.call(this);
};
var _geNormal43=Game_Event.prototype.isNormalPriority;
Game_Event.prototype.isNormalPriority=function(){
  try { if(R43.freeRoamOn() && R43.isBarrierPage(this.page())) return false; } catch(e){}
  return _geNormal43.call(this);
};

// ---------------------------------------------------------------------------
// 4) ITEM ATIVO SEMPRE NA MAO
// ---------------------------------------------------------------------------
if (C.Hero) {
  var H=C.Hero;
  var _held43=H.updateHeldOnCharacterSprite;
  H.updateHeldOnCharacterSprite=function(sp){
    if(_held43) _held43.apply(this,arguments);
    try {
      if(!sp || !sp._character || sp._character!==$gamePlayer) return;
      var pose=($gamePlayer._cmtPose||'').toLowerCase();
      var action=/axe|pick|hoe|water|fish|attack|collect/.test(pose);
      if(action) return; // Motion26 cuida da ferramenta durante golpe.
      var id=activeItemId();
      if(!id || !hasItem(id)) { if(sp._camutangaHeldSprite) sp._camutangaHeldSprite.visible=false; return; }
      var it=itemById(id); if(!it) return;
      if(H.applyHeldBitmap) H.applyHeldBitmap(sp,hs,it);
      var hs=sp._camutangaHeldSprite; if(!hs) return;
      hs.visible=true;
      var d=$gamePlayer.direction();
      var walk=$gamePlayer.isMoving ? $gamePlayer.isMoving() : false;
      var bob=walk ? Math.round(Math.sin(Graphics.frameCount*0.45)*2) : 0;
      if(d===2){ hs.x=13; hs.y=-24+bob; hs.rotation=0.10; }
      else if(d===8){ hs.x=-13; hs.y=-25+bob; hs.rotation=-0.10; }
      else if(d===4){ hs.x=-18; hs.y=-22+bob; hs.rotation=-0.28; }
      else { hs.x=18; hs.y=-22+bob; hs.rotation=0.28; }
      hs.opacity=255;
      if(hs.scale){ hs.scale.x=0.72; hs.scale.y=0.72; }
    } catch(e){}
  };
}


// Mantem o item realmente sincronizado com o slot selecionado.
if (C.V3) {
  var _selectHot43=C.V3.selectHot;
  C.V3.selectHot=function(i){
    var out=_selectHot43 ? _selectHot43.apply(this,arguments) : undefined;
    try { var st=C.V3.state(), id=Number(st.hotbar[st.hotIndex]||0); if(C.state)C.state().activeItemId=id; } catch(e){}
    return out;
  };
  var _setHot43=C.V3.setHotSlot;
  C.V3.setHotSlot=function(i,id){
    var out=_setHot43 ? _setHot43.apply(this,arguments) : undefined;
    try { var st=C.V3.state(); if(Number(st.hotIndex)===Number(i) && C.state)C.state().activeItemId=Number(id||0); } catch(e){}
    return out;
  };
}

// ---------------------------------------------------------------------------
// 5) INTRO IN-GAME: onibus entra no proprio mapa, sem tela placeholder
// ---------------------------------------------------------------------------
R43.arrival = null;
R43.playSe=function(name,vol,pitch){ try{AudioManager.playSe({name:name,volume:vol||80,pitch:pitch||100,pan:0});}catch(e){} };
R43.startArrival = function(){
  if(R43.arrival || !$gameMap || $gameMap.mapId()!==7) return;
  try { if(C.Social35&&C.Social35.state&&!C.Social35.state().nameChosen) return; } catch(e){}
  try { if(C.Relaunch40) C.Relaunch40._introOpen=true; } catch(e){}
  var sc=SceneManager._scene; if(!sc || !(sc instanceof Scene_Map)) return;
  var spr=new Sprite(ImageManager.loadBitmap('img/pictures/CamutangaUI/','Bus43'));
  spr.anchor.x=0.5; spr.anchor.y=1;
  spr.x=-150; spr.y=Math.round(Graphics.height*0.63); spr.z=9998;
  var parent=(sc._spriteset&&sc._spriteset._tilemap)?sc._spriteset._tilemap:sc;
  parent.addChild(spr);
  R43.arrival={sprite:spr,phase:0,t:0,scene:sc,spoken:false};
  $gamePlayer._cmt43HideVisual=true;
  R43.playSe('Camutanga_BusArrive',80,100);
};
R43.finishArrival=function(){
  var a=R43.arrival;
  if(a && a.sprite && a.sprite.parent) a.sprite.parent.removeChild(a.sprite);
  if(a && a.sprite) a.sprite.destroy({children:true,texture:false,baseTexture:false});
  R43.arrival=null;
  if($gamePlayer) $gamePlayer._cmt43HideVisual=false;
  try{
    if(C.Relaunch40 && C.Relaunch40.state){
      var st=C.Relaunch40.state(); st.introSeen=true; st._arrivalSeen43=true;
      C.Relaunch40._introOpen=false;
      if(C.Relaunch40.refreshObjective) C.Relaunch40.refreshObjective();
    }
  }catch(e){}
  toast('Nova vida em Camutanga • explore a cidade e conheça seus moradores.');
};
R43.updateArrival=function(sc){
  var a=R43.arrival; if(!a) return;
  if(a.scene!==sc){ R43.finishArrival(); return; }
  a.t++;
  if(a.phase===0){
    a.sprite.x += 7;
    if(a.sprite.x>=Math.round(Graphics.width*0.43)){ a.sprite.x=Math.round(Graphics.width*0.43); a.phase=1; a.t=0; }
  } else if(a.phase===1){
    if(a.t===20){ $gamePlayer._cmt43HideVisual=false; }
    if(a.t===36 && !a.spoken){
      a.spoken=true;
      var nm=($gameActors.actor(1)&&$gameActors.actor(1).name())||'Você';
      if($gameMessage){
        $gameMessage.setFaceImage('',0);
        $gameMessage.add('O ônibus para na entrada de Camutanga.');
        $gameMessage.add(nm + ' desce com pouca bagagem e uma vontade enorme de recomeçar.');
        $gameMessage.add('Primeiro objetivo: conheça a cidade e descubra onde passar a noite.');
      }
    }
    if(a.t>55 && (!$gameMessage || !$gameMessage.isBusy())) { a.phase=2; a.t=0; }
  } else if(a.phase===2){
    a.sprite.x += 8;
    if(a.sprite.x>Graphics.width+170) R43.finishArrival();
  }
};

var _gpCanMove43=Game_Player.prototype.canMove;
Game_Player.prototype.canMove=function(){ if(R43.arrival) return false; return _gpCanMove43.call(this); };
var _scStart43=Scene_Map.prototype.start;
Scene_Map.prototype.start=function(){
  _scStart43.call(this);
  try{
    var rel=C.Relaunch40, st=rel&&rel.state&&rel.state();
    if(st && st.newJourney && !st.introSeen && $gameMap.mapId()===7){
      setTimeout(function(){ try{ if(C.Social35&&C.Social35.state&&!C.Social35.state().nameChosen)return; }catch(e){} if(!R43.arrival) R43.startArrival(); },420);
    }
  }catch(e){}
};
if(C.Relaunch40){
  C.Relaunch40.openArrival=function(){ R43.startArrival(); };
}

var _scUpdateChar43=Sprite_Character.prototype.update;
Sprite_Character.prototype.update=function(){
  _scUpdateChar43.call(this);
  try{ if(this._character===$gamePlayer && $gamePlayer._cmt43HideVisual) this.visible=false; }catch(e){}
};

// ---------------------------------------------------------------------------
// 6) NOME: overlay mobile robusto
// ---------------------------------------------------------------------------
if(C.Social35){
  var S=C.Social35;
  S.openNameOverlay=function(force){
    if(S._nameOpen) return;
    var actor=$gameActors && $gameActors.actor(1); if(!actor) return;
    if(!force && actor.name() && actor.name()!=='JHON' && actor.name()!=='Max') return;
    S._nameOpen=true;
    var root=document.createElement('div'); root.id='cmt43-name';
    root.style.cssText='position:fixed;inset:0;z-index:999999;background:rgba(7,12,9,.88);display:flex;align-items:center;justify-content:center;padding:max(18px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));box-sizing:border-box;font-family:Arial,sans-serif;';
    root.innerHTML='<div style="width:min(620px,96vw);background:#111c16;border:2px solid #e4bc50;border-radius:24px;padding:26px;box-shadow:0 18px 70px #000a;color:#fff">'+
      '<div style="font-size:12px;letter-spacing:4px;color:#e4bc50;margin-bottom:10px">NOVA VIDA EM CAMUTANGA</div><div style="font-size:30px;font-weight:800;margin-bottom:8px">Como vão te chamar por aqui?</div><div style="opacity:.76;margin-bottom:18px;line-height:1.45">Esse nome aparece na cidade, no HUD e nos diálogos. Você poderá alterar depois.</div>'+ 
      '<input id="cmt43-name-input" maxlength="14" autocomplete="off" autocapitalize="words" inputmode="text" enterkeyhint="done" style="width:100%;height:64px;box-sizing:border-box;border:2px solid #53685b;border-radius:14px;background:#07100b;color:white;padding:0 18px;font-size:24px;outline:none">'+
      '<div style="display:flex;gap:12px;margin-top:18px"><button id="cmt43-name-ok" style="flex:1;min-height:62px;border:0;border-radius:14px;background:#e4bc50;color:#1c1809;font-size:18px;font-weight:800">CONFIRMAR</button><button id="cmt43-name-random" style="min-width:150px;border:1px solid #66766b;border-radius:14px;background:#1c2a21;color:#fff;font-size:16px">SUGERIR</button></div></div>';
    document.body.appendChild(root);
    var input=root.querySelector('#cmt43-name-input'); input.value=actor.name()==='JHON'?'':actor.name();
    var done=false;
    function finish(){ if(done)return; var v=String(input.value||'').trim(); if(!v)return; done=true; actor.setName(v.substring(0,14)); try{if(S.applyName)S.applyName(v);}catch(e){} root.remove(); S._nameOpen=false; setTimeout(function(){ try{if(C.Relaunch40&&C.Relaunch40.openArrival)C.Relaunch40.openArrival();}catch(e){} },120); }
    function bindTap(el,fn){ el.addEventListener('click',fn); el.addEventListener('pointerup',function(e){e.preventDefault();fn();}); }
    bindTap(root.querySelector('#cmt43-name-ok'),finish);
    var names=['Bento','Rita','Zeca','Luzia','João','Maria','Chico','Nina','Damião','Cecília'];
    bindTap(root.querySelector('#cmt43-name-random'),function(){ input.value=names[Math.floor(Math.random()*names.length)]; input.focus(); });
    input.addEventListener('keydown',function(e){if(e.key==='Enter')finish();});
    root.addEventListener('touchmove',function(e){ if(e.target!==input)e.preventDefault(); },{passive:false});
    setTimeout(function(){input.focus();},120);
  };
}

// Titulo mais confortavel no touch: botoes altos, janela larga e centralizada.
if (window.Window_TitleCommand) {
  Window_TitleCommand.prototype.windowWidth=function(){ return Math.min(600,Graphics.boxWidth-36); };
  var _titleItemHeight43=Window_TitleCommand.prototype.itemHeight;
  Window_TitleCommand.prototype.itemHeight=function(){ return (window.innerWidth<900 || ('ontouchstart' in window)) ? 66 : Math.max(48,_titleItemHeight43.call(this)); };
  Window_TitleCommand.prototype.updatePlacement=function(){ this.x=(Graphics.boxWidth-this.width)/2; this.y=Graphics.boxHeight-this.height-44; };
}

// ---------------------------------------------------------------------------
// 7) MAPA E MINIMAPA FUNCIONAIS
// ---------------------------------------------------------------------------
R43.MAP_POINTS = {
  16:{name:'Vila',x:18.8,y:38.9,icon:'⌂',tip:'Moradores, pequenos trabalhos e vida de bairro.'},
  26:{name:'Floresta',x:32.5,y:33.3,icon:'♣',tip:'Madeira, ervas, cogumelos e coleta.'},
  9:{name:'Pedra da Caveira',x:35.6,y:52.2,icon:'◆',tip:'Mistérios da lenda e exploração.'},
  25:{name:'Caverna',x:40.6,y:46.7,icon:'⬟',tip:'Mineração, geodos e minérios raros.'},
  3:{name:'Casarão e Lago',x:84.0,y:28.5,icon:'⌂',tip:'Casarão antigo e lago de pesca especial.'},
  14:{name:'Pedro A. Uchôa',x:70.0,y:55.6,icon:'●',tip:'Rua histórica e moradores.'},
  8:{name:'Igreja / Cemitério',x:58.5,y:65.5,icon:'✚',tip:'Igreja, cemitério e histórias antigas.'},
  27:{name:'Igreja',x:60.0,y:71.1,icon:'✚',tip:'Interior da igreja.'},
  2:{name:'Rua Santa Cruz',x:41.3,y:74.4,icon:'═',tip:'Comércio, hospedagem e serviços.'},
  11:{name:'Praça da Bíblia',x:49.4,y:74.4,icon:'★',tip:'Eventos, moradores e atividades.'},
  7:{name:'Trevo',x:53.1,y:81.7,icon:'⇧',tip:'Entrada de Camutanga.'},
  5:{name:'Fazenda',x:53.1,y:91.1,icon:'⌂',tip:'Sua propriedade e cultivo.'},
  23:{name:'Hospedagem',x:44.5,y:73.0,icon:'☾',tip:'Lugar para dormir no começo.'}
};
R43.storyTargets=function(){
  var out=[]; if(!$gameSwitches)return out;
  function sw(id){return !!$gameSwitches.value(id);} function add(id){if(out.indexOf(id)<0)out.push(id);}
  // Missoes originais: apenas marcadores; nenhum switch e alterado aqui.
  if(sw(39) && !sw(43)) add(24);                 // ratos / casa abandonada
  if(sw(41) && !sw(43)) add(25);                 // pedras / caverna
  if(sw(42) && !sw(43)) add(2);                  // ferreiro / Santa Cruz
  if(sw(58) && !sw(59)) {add(8);add(11);}        // cemiterio
  if((sw(64)||sw(70)||sw(72)||sw(74)) && !sw(75)) add(27); // igreja / investigacao
  if(sw(69)) add(9);                              // lobo / Pedra da Caveira
  if(sw(10) || sw(83) || sw(97) || sw(98) || sw(99) || sw(100)) add(3); // Casarao
  if(sw(35) && !sw(36)) add(7);                  // missao com tempo
  return out;
};
R43.objectiveTarget = function(){
  try{
    if(C.Relaunch40 && C.Relaunch40.targetMap){ var m=C.Relaunch40.targetMap(); if(m) return m; }
    var st=C.City&&C.City.state&&C.City.state();
    if(st && st.delivery && st.delivery.mapId) return st.delivery.mapId;
    var story=R43.storyTargets(); if(story.length)return story[0];
  }catch(e){}
  return 0;
};
R43.closeMap=function(){ var el=document.getElementById('cmt43-map'); if(el)el.remove(); };
R43.openMap=function(){
  R43.closeMap();
  var cur=$gameMap?$gameMap.mapId():0, tar=R43.objectiveTarget();
  var root=document.createElement('div'); root.id='cmt43-map';
  root.style.cssText='position:fixed;inset:0;z-index:999998;background:rgba(5,8,7,.93);display:flex;align-items:center;justify-content:center;padding:clamp(10px,2vw,24px);box-sizing:border-box;font-family:Arial,sans-serif;color:#fff';
  var pins='', storyTargets=R43.storyTargets();
  Object.keys(R43.MAP_POINTS).forEach(function(k){ var p=R43.MAP_POINTS[k], id=Number(k), cls=(id===cur?' current':'')+(id===tar?' quest':'')+(storyTargets.indexOf(id)>=0?' mission':''); pins+='<button class="cmt43-pin'+cls+'" data-map="'+id+'" style="left:'+p.x+'%;top:'+p.y+'%" title="'+p.name+'"><span>'+p.icon+'</span></button>'; });
  root.innerHTML='<div style="width:min(1180px,96vw);height:min(760px,93vh);background:#151b15;border:2px solid #c9a542;border-radius:22px;overflow:hidden;box-shadow:0 20px 80px #000;display:grid;grid-template-rows:auto 1fr auto">'+
    '<div style="padding:14px 18px;display:flex;align-items:center;gap:14px;border-bottom:1px solid #49503f"><div><b style="font-size:24px">MAPA DE CAMUTANGA</b><div style="opacity:.7;font-size:13px">● você &nbsp; ◆ objetivo &nbsp; vermelho = missão da Lenda &nbsp; toque nos locais</div></div><button id="cmt43-map-close" style="margin-left:auto;min-width:110px;min-height:46px;border:0;border-radius:12px;background:#e1b94c;font-weight:800">FECHAR</button></div>'+ 
    '<div style="min-height:0;display:grid;grid-template-columns:minmax(0,1fr) clamp(190px,25vw,310px)"><div id="cmt43-map-img" style="position:relative;overflow:hidden;background:#e6d3a4"><img src="img/pictures/CamutangaUI/CamutangaMap43.png?v=43" style="width:100%;height:100%;object-fit:contain;display:block">'+pins+'</div><div id="cmt43-map-info" style="padding:20px;background:#101611;overflow:auto"><div style="color:#e4bc50;letter-spacing:2px;font-size:12px">LOCAL ATUAL</div><div style="font-size:26px;font-weight:800;margin:8px 0 12px">'+((R43.MAP_POINTS[cur]&&R43.MAP_POINTS[cur].name)||($gameMap.displayName&&$gameMap.displayName())||'Camutanga')+'</div><div style="opacity:.78;line-height:1.5">Selecione um ponto no mapa para descobrir o que fazer naquela região.</div></div></div>'+ 
    '<div style="padding:10px 16px;border-top:1px solid #49503f;opacity:.8;font-size:13px">M no PC • MAPA no celular • o marcador dourado indica seu próximo objetivo.</div></div>';
  document.body.appendChild(root);
  var css=document.createElement('style'); css.textContent='.cmt43-pin{position:absolute;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;border:2px solid #f4ead2;background:#26372b;color:#fff;font-weight:900;box-shadow:0 2px 8px #0008;z-index:3}.cmt43-pin.current{background:#2d83ff;box-shadow:0 0 0 5px #2d83ff44,0 2px 8px #000}.cmt43-pin.quest{background:#e9b92f;color:#231b00;animation:cmt43pulse 1s infinite alternate}.cmt43-pin.mission{box-shadow:0 0 0 5px rgba(224,83,69,.42),0 2px 8px #000;border-color:#ff8b73}@keyframes cmt43pulse{to{transform:translate(-50%,-50%) scale(1.18)}}@media(max-width:760px){#cmt43-map>div{height:96vh!important}#cmt43-map>div>div:nth-child(2){grid-template-columns:1fr!important;grid-template-rows:minmax(0,1fr) 150px}#cmt43-map-info{padding:12px!important}.cmt43-pin{width:30px;height:30px}}'; root.appendChild(css);
  function close(){R43.closeMap();}
  root.querySelector('#cmt43-map-close').onclick=close;
  root.querySelectorAll('.cmt43-pin').forEach(function(btn){ btn.onclick=function(){ var p=R43.MAP_POINTS[Number(btn.dataset.map)]; var info=root.querySelector('#cmt43-map-info'); info.innerHTML='<div style="color:#e4bc50;letter-spacing:2px;font-size:12px">'+(Number(btn.dataset.map)===tar?'OBJETIVO / ':'')+'REGIÃO</div><div style="font-size:25px;font-weight:800;margin:8px 0">'+p.name+'</div><div style="line-height:1.55;opacity:.85">'+p.tip+'</div>'; }; });
};
R43.ensureMini=function(){
  var old42=document.getElementById('cmt42-mini');if(old42)old42.remove();
  var old42b=document.getElementById('cmt42-map-btn');if(old42b)old42b.remove();
  var sc=SceneManager._scene; if(!sc || !(sc instanceof Scene_Map)) return;
  var old=document.getElementById('cmt43-mini'); if(old)old.remove();
  var cur=$gameMap?$gameMap.mapId():0,p=R43.MAP_POINTS[cur]; if(!p)return;
  var mini=document.createElement('button'); mini.id='cmt43-mini'; mini.title='Abrir mapa';
  mini.style.cssText='position:fixed;right:max(8px,env(safe-area-inset-right));top:112px;z-index:9000;width:158px;height:92px;border:1px solid #dac06b;border-radius:13px;overflow:hidden;padding:0;background:#101610;box-shadow:0 4px 16px #0008;cursor:pointer';
  var tar=R43.objectiveTarget(),tp=R43.MAP_POINTS[tar];
  mini.innerHTML='<img src="img/pictures/CamutangaUI/CamutangaMap43.png?v=43" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62"><span style="position:absolute;left:'+p.x+'%;top:'+p.y+'%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;background:#3f99ff;border:2px solid white;box-shadow:0 0 8px #2b8cff"></span>'+(tp?'<span style="position:absolute;left:'+tp.x+'%;top:'+tp.y+'%;transform:translate(-50%,-50%) rotate(45deg);width:10px;height:10px;background:#ffcf3c;border:1px solid #fff"></span>':'');
  mini.onclick=function(e){e.preventDefault();R43.openMap();};
  document.body.appendChild(mini);
  if(window.innerWidth<760){ mini.style.width='116px'; mini.style.height='68px'; mini.style.top='116px'; }
};

var _scMapStartMini43=Scene_Map.prototype.start;
Scene_Map.prototype.start=function(){ _scMapStartMini43.call(this); setTimeout(function(){R43.ensureMini();R43.ensureMapButton();},200); };
var _scMapTerminate43=Scene_Map.prototype.terminate;
Scene_Map.prototype.terminate=function(){ var m=document.getElementById('cmt43-mini');if(m)m.remove();var b=document.getElementById('cmt43-map-btn');if(b)b.remove();var b42=document.getElementById('cmt42-map-btn');if(b42)b42.remove();R43.closeMap();_scMapTerminate43.call(this); };
var _sceneMapUpdateKey43=Scene_Map.prototype.update;
Scene_Map.prototype.update=function(){ _sceneMapUpdateKey43.call(this); if(Input.isTriggered && Input.isTriggered('cmtMap43'))R43.openMap(); };
Input.keyMapper[77]='cmtMap43';

// Mobile MAPA button if existing mobile controls present.
R43.ensureMapButton=function(){
  var old42=document.getElementById('cmt42-map-btn');if(old42)old42.remove();
  if(!(SceneManager._scene instanceof Scene_Map))return;
  if(document.getElementById('cmt43-map-btn'))return;
  var b=document.createElement('button');b.id='cmt43-map-btn';b.textContent='MAPA';
  b.style.cssText='position:fixed;right:max(8px,env(safe-area-inset-right));top:66px;z-index:9100;min-width:74px;height:42px;border:1px solid #dbc56e;border-radius:12px;background:#15241acc;color:white;font-weight:800;display:none';
  b.onclick=function(){R43.openMap();};document.body.appendChild(b);
  function fit(){b.style.display=(window.innerWidth<900?'block':'none');} fit();window.addEventListener('resize',fit);
};
setTimeout(R43.ensureMapButton,500);

// ---------------------------------------------------------------------------
// 8) PESCA: lago do casarao + lixo/tesouro real + espera/fisgada preservada
// ---------------------------------------------------------------------------
if(C.Release42){
  var R=C.Release42;
  // Desativa visual antigo do mapa/minimapa, mantendo apenas o sistema V4.3.
  R.closeMap=function(){ var e=document.getElementById('cmt42-map');if(e)e.remove();R._mapOpen=false; };
  R.ensureMini=function(){ var e=document.getElementById('cmt42-mini');if(e)e.remove(); };
  R.ensureMapButton=function(){ var e=document.getElementById('cmt42-map-btn');if(e)e.remove(); };
  var _water42=R.isWater;
  R.isWater=function(x,y){
    try{
      var mid=$gameMap.mapId();
      var ids=$gameMap.layeredTiles(x,y)||[];
      if(mid===3){ for(var i=0;i<ids.length;i++){var id=ids[i]; if((id>=2048&&id<3072)||(id>=5504&&id<5760)||(id>=6944&&id<7168))return true;} }
    }catch(e){}
    return _water42 ? _water42.apply(this,arguments) : false;
  };
  C.isWaterTile=R.isWater;
  if(window.Scene_CamutangaFishing && Scene_CamutangaFishing.prototype){
    var FP=Scene_CamutangaFishing.prototype;
    FP.success=function(){
      this._phase='result'; this._done='result'; this._timer=0;
      try{ if(this._bar&&this._bar.bitmap)this._bar.bitmap.clear(); }catch(e){}
      var r=Math.random();
      if(r<0.10){
        var junk=[556,556,557,557,558][Math.floor(Math.random()*5)], ji=itemById(junk);
        if(ji)$gameParty.gainItem(ji,1);
        this._resultText='VEIO LIXO NA LINHA!  '+(ji?ji.name:'Objeto velho');
        if(this._fishVisual)this._fishVisual.visible=false;
        R43.playSe('Camutanga_CityCoin',35,86);
        if(this.refreshFishingUI)this.refreshFishingUI();
        return;
      }
      if(r<0.14){
        var tr=[559,122,119][Math.floor(Math.random()*3)], ti=itemById(tr);
        if(ti)$gameParty.gainItem(ti,1);
        this._resultText='TESOURO NA LINHA!  '+(ti?ti.name:'Achado raro');
        if(this._fishVisual)this._fishVisual.visible=false;
        R43.playSe('Camutanga_CityCoin',55,120);
        if(this.refreshFishingUI)this.refreshFishingUI();
        return;
      }
      var f=this.pickFish ? this.pickFish() : {id:23,weight:1,quality:1}, it=itemById(f.id);
      if(it)$gameParty.gainItem(it,1);
      var st=C.state ? C.state() : null;
      if(st){
        st.collections=st.collections||{}; st.collections.fish=st.collections.fish||{};
        var k=String(f.id),o=st.collections.fish[k]||{count:0,bestWeight:0,bestQuality:0};
        o.count++;o.bestWeight=Math.max(Number(o.bestWeight||0),Number(f.weight||0));o.bestQuality=Math.max(Number(o.bestQuality||0),Number(f.quality||1));st.collections.fish[k]=o;
        if(st.daily)st.daily.fish=Number(st.daily.fish||0)+1;
        if(st.totals)st.totals.fish=Number(st.totals.fish||0)+1;
      }
      if(C.gainSkillXp)C.gainSkillXp('fishing',18+Number(f.quality||1)*4);
      if(C.updateQuest)C.updateQuest('fish',1);
      var stars='';for(var si=0;si<Number(f.quality||1);si++)stars+='★';
      this._resultText='CAPTURA!  '+(it?it.name:'Peixe')+'  '+stars+' • '+Number(f.weight||0).toFixed(2)+' kg';
      if(this._fishVisual)this._fishVisual.visible=true;
      try{SoundManager.playRecovery();}catch(e){}
      if(this.refreshFishingUI)this.refreshFishingUI();
    };
  }
}

// ---------------------------------------------------------------------------
// 9) HUD: garante que nenhuma HUD/legenda antiga fique atras da hotbar nova
// ---------------------------------------------------------------------------
R43.enforceLegacyHudHidden=function(sc){
  if(!sc || !sc._spriteset)return;
  var names=['_camutangaPolishHUD','_camutangaHUD26','_v3Hotbar','_camutangaHUD','_hudField','_chronoHud','_toolHud','_itemHud'];
  for(var i=0;i<names.length;i++){ var o=sc[names[i]] || sc._spriteset[names[i]]; if(o && o!==sc._cmtUX41HUD) o.visible=false; }
};

// ---------------------------------------------------------------------------
// 10) LOJA NOVA: cards + comprar/vender + quantidade, PC e touch
// ---------------------------------------------------------------------------
function Scene_CamutangaShop43(){ this.initialize.apply(this,arguments); }
Scene_CamutangaShop43.prototype=Object.create(Scene_MenuBase.prototype); Scene_CamutangaShop43.prototype.constructor=Scene_CamutangaShop43;
Scene_CamutangaShop43.prototype.initialize=function(){ Scene_MenuBase.prototype.initialize.call(this); this._goods=[];this._purchaseOnly=false;this._mode='buy';this._sel=0;this._qty=1;this._page=0;this._dom=null; };
Scene_CamutangaShop43.prototype.prepare=function(goods,purchaseOnly){this._goods=goods||[];this._purchaseOnly=!!purchaseOnly;};
Scene_CamutangaShop43.prototype.create=function(){ Scene_MenuBase.prototype.create.call(this); this.createDom(); };
Scene_CamutangaShop43.prototype.terminate=function(){this.removeDom();Scene_MenuBase.prototype.terminate.call(this);};
Scene_CamutangaShop43.prototype.removeDom=function(){if(this._dom&&this._dom.parentNode)this._dom.parentNode.removeChild(this._dom);this._dom=null;};
Scene_CamutangaShop43.prototype.items=function(){
  var arr=[];
  if(this._mode==='buy'){
    for(var i=0;i<this._goods.length;i++){ var g=this._goods[i], data=(g[0]===0?$dataItems:g[0]===1?$dataWeapons:$dataArmors), it=data&&data[g[1]]; if(!it)continue; var pr=g[2]===0?it.price:g[3]; arr.push({item:it,price:pr}); }
  }else{
    var all=$gameParty.allItems(); for(var j=0;j<all.length;j++){var it2=all[j];if($gameParty.numItems(it2)>0 && it2.price>0)arr.push({item:it2,price:Math.max(1,Math.floor(it2.price/2))});}
  }
  return arr;
};
Scene_CamutangaShop43.prototype.createDom=function(){
  var self=this,root=document.createElement('div');this._dom=root;root.id='cmt43-shop';
  root.style.cssText='position:fixed;inset:0;z-index:999997;background:rgba(7,10,8,.92);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:Arial,sans-serif;color:white';document.body.appendChild(root);
  this.render();
};
Scene_CamutangaShop43.prototype.render=function(){
  if(!this._dom)return; var self=this, arr=this.items(), per=(window.innerWidth<760?6:10), pages=Math.max(1,Math.ceil(arr.length/per));this._page=clamp(this._page,0,pages-1);this._sel=clamp(this._sel,0,Math.max(0,arr.length-1));
  var start=this._page*per,end=Math.min(arr.length,start+per),cards='';
  for(var i=start;i<end;i++){var e=arr[i],it=e.item,icon=it.iconIndex||0,sx=(icon%16)*32,sy=Math.floor(icon/16)*32;cards+='<button class="cmt43-product'+(i===this._sel?' on':'')+'" data-i="'+i+'"><span class="ico" style="background-position:-'+sx+'px -'+sy+'px"></span><span class="nm">'+it.name+'</span><span class="pr">'+e.price+' C</span><span class="have">Você: '+$gameParty.numItems(it)+'</span></button>';}
  var sel=arr[this._sel], desc=sel?String(sel.item.description||'Sem descrição.'):'Nenhum item disponível.';
  this._dom.innerHTML='<div class="box"><header><div><small>COMÉRCIO DE CAMUTANGA</small><h1>'+(this._mode==='buy'?'Comprar':'Vender')+'</h1></div><div class="money">Carteira<br><b>'+$gameParty.gold()+' C</b></div><button id="cmt43-shop-close">×</button></header><nav><button id="cmt43-buy" class="'+(this._mode==='buy'?'on':'')+'">COMPRAR</button>'+(!this._purchaseOnly?'<button id="cmt43-sell" class="'+(this._mode==='sell'?'on':'')+'">VENDER</button>':'')+'</nav><main><section class="products">'+cards+'</section><aside><div class="desc">'+desc+'</div><div class="qty"><button id="cmt43-minus">−</button><b>'+this._qty+'</b><button id="cmt43-plus">+</button></div><button id="cmt43-confirm">'+(this._mode==='buy'?'COMPRAR':'VENDER')+(sel?' • '+(sel.price*this._qty)+' C':'')+'</button><div class="pager"><button id="cmt43-prev">◀</button><span>'+(this._page+1)+' / '+pages+'</span><button id="cmt43-next">▶</button></div></aside></main></div><style>#cmt43-shop .box{width:min(1100px,97vw);height:min(720px,95vh);background:#121b14;border:2px solid #c9a848;border-radius:22px;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr;box-shadow:0 20px 70px #000}#cmt43-shop header{display:flex;align-items:center;gap:16px;padding:15px 18px;border-bottom:1px solid #3a463b}#cmt43-shop h1{margin:2px 0 0;font-size:28px}#cmt43-shop small{letter-spacing:3px;color:#e4bd51}.money{margin-left:auto;text-align:right}.money b{color:#e4bd51;font-size:22px}#cmt43-shop-close{width:48px;height:48px;border:0;border-radius:12px;background:#27352a;color:#fff;font-size:28px}#cmt43-shop nav{display:flex;gap:8px;padding:10px 16px}#cmt43-shop nav button{min-height:44px;padding:0 22px;border:1px solid #536351;border-radius:11px;background:#1c281e;color:#fff;font-weight:800}#cmt43-shop nav .on{background:#e1b94b;color:#211900}#cmt43-shop main{min-height:0;display:grid;grid-template-columns:1fr 300px;gap:12px;padding:0 16px 16px}.products{overflow:auto;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-content:start}.cmt43-product{min-height:128px;border:1px solid #465746;border-radius:14px;background:#19231b;color:#fff;padding:10px;display:flex;flex-direction:column;align-items:center;gap:5px}.cmt43-product.on{border:2px solid #e5be52;background:#253222}.ico{width:42px;height:42px;background-image:url(img/system/IconSet.png);background-repeat:no-repeat;image-rendering:pixelated;transform:scale(1.15);transform-origin:center}.nm{font-weight:800;font-size:13px}.pr{color:#e5c059}.have{opacity:.65;font-size:11px}aside{background:#0d140f;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:13px}.desc{line-height:1.45;min-height:82px}.qty{display:grid;grid-template-columns:52px 1fr 52px;gap:8px;align-items:center;text-align:center}.qty button,.pager button{height:48px;border:0;border-radius:10px;background:#29362b;color:white;font-size:24px}.qty b{font-size:24px}#cmt43-confirm{min-height:58px;border:0;border-radius:12px;background:#e2ba4d;color:#1f1905;font-weight:900;font-size:16px}.pager{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:12px}@media(max-width:760px){#cmt43-shop{padding:5px!important}#cmt43-shop .box{height:98vh}#cmt43-shop header{padding:8px 10px}#cmt43-shop h1{font-size:21px}#cmt43-shop main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;padding:0 8px 8px}.products{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.cmt43-product{min-height:88px;padding:5px}.ico{transform:scale(.95)}aside{padding:8px;display:grid;grid-template-columns:1fr 142px;gap:7px}.desc{grid-column:1/2;grid-row:1/3;min-height:0;font-size:12px}.qty{grid-column:2}.qty button{height:42px}#cmt43-confirm{grid-column:2;min-height:44px;font-size:12px}.pager{display:none}#cmt43-shop nav{padding:6px 9px}}</style>';
  function q(s){return self._dom.querySelector(s);} q('#cmt43-shop-close').onclick=function(){SceneManager.pop();}; q('#cmt43-buy').onclick=function(){self._mode='buy';self._sel=0;self._page=0;self._qty=1;self.render();}; var sb=q('#cmt43-sell');if(sb)sb.onclick=function(){self._mode='sell';self._sel=0;self._page=0;self._qty=1;self.render();};
  self._dom.querySelectorAll('.cmt43-product').forEach(function(b){b.onclick=function(){self._sel=Number(b.dataset.i);self._qty=1;self.render();};});
  q('#cmt43-minus').onclick=function(){self._qty=Math.max(1,self._qty-1);self.render();};q('#cmt43-plus').onclick=function(){self._qty=Math.min(99,self._qty+1);self.render();};q('#cmt43-prev').onclick=function(){self._page=Math.max(0,self._page-1);self._sel=self._page*per;self.render();};q('#cmt43-next').onclick=function(){self._page=Math.min(pages-1,self._page+1);self._sel=self._page*per;self.render();};
  q('#cmt43-confirm').onclick=function(){self.transact();};
};
Scene_CamutangaShop43.prototype.transact=function(){ var arr=this.items(),e=arr[this._sel];if(!e)return;var it=e.item,q=this._qty,p=e.price*q;if(this._mode==='buy'){var max=Math.floor($gameParty.gold()/Math.max(1,e.price));q=Math.min(q,max,$gameParty.maxItems(it)-$gameParty.numItems(it));if(q<=0){SoundManager.playBuzzer();return;}$gameParty.loseGold(e.price*q);$gameParty.gainItem(it,q);}else{q=Math.min(q,$gameParty.numItems(it));if(q<=0){SoundManager.playBuzzer();return;}$gameParty.loseItem(it,q);$gameParty.gainGold(e.price*q);}SoundManager.playShop();this._qty=1;this.render();};
Scene_CamutangaShop43.prototype.update=function(){
  Scene_MenuBase.prototype.update.call(this);
  if(Input.isTriggered('cancel')){SceneManager.pop();return;}
  var arr=this.items(); if(!arr.length)return;
  var cols=(window.innerWidth<760?2:5),changed=false;
  if(Input.isTriggered('left')){this._sel=Math.max(0,this._sel-1);changed=true;}
  if(Input.isTriggered('right')){this._sel=Math.min(arr.length-1,this._sel+1);changed=true;}
  if(Input.isTriggered('up')){this._sel=Math.max(0,this._sel-cols);changed=true;}
  if(Input.isTriggered('down')){this._sel=Math.min(arr.length-1,this._sel+cols);changed=true;}
  if(Input.isTriggered('pageup')){this._qty=Math.max(1,this._qty-1);changed=true;}
  if(Input.isTriggered('pagedown')){this._qty=Math.min(99,this._qty+1);changed=true;}
  if(Input.isTriggered('ok')){this.transact();return;}
  if(changed){var per=(window.innerWidth<760?6:10);this._page=Math.floor(this._sel/per);this.render();try{SoundManager.playCursor();}catch(e){}}
};
window.Scene_CamutangaShop43=Scene_CamutangaShop43;
window.Scene_Shop=Scene_CamutangaShop43;

// ---------------------------------------------------------------------------
// 11) DIALOGOS / AMBIENTACAO HISTORICA
// ---------------------------------------------------------------------------
if(C.Social35){
  var SS=C.Social35;
  SS._r43ExtraLines=[
    'Meu avô dizia que Camutanga guarda mais história do que parece.',
    'Hoje a praça deve ficar movimentada depois que o sol baixar.',
    'Se for para o Casarão, repara no lago. Tem peixe que não aparece em outro lugar.',
    'Quando a chuva aperta, muita coisa diferente aparece pelas estradas de terra.',
    'A velha Pedra da Caveira ainda rende conversa nas noites sem lua.',
    'Antigamente notícia corria de boca em boca. Aqui ainda corre assim.',
    'Quem aprende a conhecer o tempo sabe quando plantar e quando pescar.',
    'A feira é onde se compra de tudo e se descobre ainda mais.',
    'Cuidado com a caverna. Minério bom costuma ficar onde a pedra é mais dura.',
    'Se encontrar um objeto antigo, guarde. Algumas peças contam pedaços da cidade.'
  ];
  if(SS.randomLine){
    var _randomLine43=SS.randomLine;
    SS.randomLine=function(){ if(Math.random()<0.32)return SS._r43ExtraLines[Math.floor(Math.random()*SS._r43ExtraLines.length)]; return _randomLine43.apply(this,arguments); };
  }
}

// Troca qualquer som de moto antigo por charrete, coerente com a epoca.
var _audioSe43=AudioManager.playSe;
AudioManager.playSe=function(se){ if(se && se.name==='Camutanga_CityMoto') se={name:'Camutanga_Carriage',volume:se.volume,pitch:se.pitch,pan:se.pan}; return _audioSe43.call(this,se); };

// Refresh mini after objective/map changes.
setInterval(function(){ try{ var onMap=SceneManager._scene instanceof Scene_Map; if(onMap && !document.getElementById('cmt43-map')){R43.ensureMini();R43.ensureMapButton();} else if(!onMap){['cmt42-mini','cmt42-map-btn','cmt43-mini','cmt43-map-btn'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});} }catch(e){} },1200);

console.log('[Camutanga] Release 43 carregado');
})();

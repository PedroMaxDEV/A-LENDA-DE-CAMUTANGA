/*:
 * @plugindesc Camutanga V4.4 - Passagens livres, ferramentas visiveis, mapa limpo e autosave
 * @author OpenAI + projeto Camutanga
 * @help
 * Build 44. Patch cumulativo sobre a V4.3.
 * - libera rotas sem desligar missoes;
 * - item/ferramenta selecionado permanece na mao;
 * - INTERAGIR usa a ferramenta quando nao ha evento na frente;
 * - nova chegada no Trevo, perto da rota para Rua Santa Cruz;
 * - mapa/minimapa redesenhados;
 * - autosave no slot 20, com Continuar Auto no titulo.
 */
(function(){
'use strict';
var C=window.Camutanga=window.Camutanga||{};
var R44=C.Release44=C.Release44||{};
R44.VERSION='4.4.0';
R44.BUILD=44;
R44.AUTOSAVE_SLOT=20;

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function note(item,key){try{return C.noteTag?C.noteTag(item,key):null;}catch(e){return null;}}
function item(id){return window.$dataItems&&$dataItems[Number(id||0)];}
function life(){try{return C.state?C.state():null;}catch(e){return null;}}
function v3(){try{return C.V3&&C.V3.state?C.V3.state():null;}catch(e){return null;}}
function activeItemId(){
  try{
    var vs=v3();
    // Quando a hotbar existe, o slot selecionado é a única fonte de verdade.
    // Selecionar um slot vazio realmente deixa as mãos vazias.
    if(vs&&Array.isArray(vs.hotbar)){
      return Number(vs.hotbar[Number(vs.hotIndex||0)]||0);
    }
    var ls=life();
    return ls?Number(ls.activeItemId||0):0;
  }catch(e){return 0;}
}
function activeItem(){return item(activeItemId());}
function hasItem(it){try{return !!(it&&$gameParty&&$gameParty.numItems(it)>0);}catch(e){return false;}}
function touch(){return (C.touchDevice&&C.touchDevice())||('ontouchstart' in window)||(navigator.maxTouchPoints||0)>0;}
function playSe(name,vol,pitch){try{AudioManager.playSe({name:name,volume:vol||65,pitch:pitch||100,pan:0});}catch(e){}}
function toast(t,f){try{if(C.toast)C.toast(t,f||120);}catch(e){}}

// -------------------------------------------------------------------------
// 1. NOVA VIDA: começa no Trevo de verdade, perto da saída para Santa Cruz.
// -------------------------------------------------------------------------
if(C.Relaunch40){
  C.Relaunch40.ARRIVAL_MAP=7;
  C.Relaunch40.ARRIVAL_X=8;
  C.Relaunch40.ARRIVAL_Y=32;
}

// Ônibus rural desenhado no próprio jogo (Bitmap), sem tela HTML externa.
R44.busFrames=[];
R44.makeBusFrame=function(frame){
  if(R44.busFrames[frame])return R44.busFrames[frame];
  var b=new Bitmap(176,74),ctx=b._context;
  function r(x,y,w,h,c){b.fillRect(x,y,w,h,c);}
  // sombra
  r(10,60,156,8,'rgba(0,0,0,.22)');
  // carroceria antiga
  r(8,17,142,39,'#b9852e');r(14,11,112,11,'#d8aa46');r(18,14,126,4,'#efcf77');
  r(14,22,130,8,'#825a24');r(18,24,25,18,'#9fd1d0');r(47,24,25,18,'#9fd1d0');r(76,24,25,18,'#9fd1d0');r(105,24,25,18,'#9fd1d0');
  r(133,25,13,31,'#5f452a');r(136,28,7,23,'#c5a27a');
  r(18,45,128,8,'#734f21');r(22,48,119,4,'#d5a643');
  // para-choques/farol
  r(148,43,18,7,'#5b4a37');r(156,34,8,6,'#f1d778');r(5,47,10,5,'#5b4a37');
  // placa lateral
  r(57,12,60,9,'#f0d879');
  b.textColor='#3a2a18';b.fontSize=12;b.fontBold=true;b.drawText('CAMUTANGA',58,9,58,16,'center');
  // rodas animadas
  var wob=(frame%2)?1:0;
  [[39,56],[125,56]].forEach(function(p){
    r(p[0]-10,p[1]-2,20,20,'#2b2925');r(p[0]-6,p[1]+2,12,12,'#6f6a5e');r(p[0]-2+wob,p[1]+6,4,4,'#262522');
  });
  // poeira pequena
  if(frame===1){r(0,54,7,4,'rgba(208,181,127,.65)');r(2,48,4,3,'rgba(208,181,127,.45)');}
  if(frame===2){r(0,58,10,3,'rgba(208,181,127,.55)');}
  if(b._baseTexture&&window.PIXI&&PIXI.SCALE_MODES)b._baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;
  if(b._setDirty)b._setDirty();
  R44.busFrames[frame]=b;return b;
};
R44.arrival=null;
R44.startArrival=function(){
  if(R44.arrival||!$gameMap||$gameMap.mapId()!==7)return;
  try{if(C.Social35&&C.Social35.state&&!C.Social35.state().nameChosen)return;}catch(e){}
  var sc=SceneManager._scene;if(!sc||!(sc instanceof Scene_Map))return;
  try{if(C.Relaunch40)C.Relaunch40._introOpen=true;}catch(e){}
  var spr=new Sprite(R44.makeBusFrame(0));spr.anchor.x=.5;spr.anchor.y=1;spr.z=9998;
  spr.x=Graphics.width+130;spr.y=Math.round(($gamePlayer.screenY?$gamePlayer.screenY():Graphics.height*.55)+12);
  var parent=(sc._spriteset&&sc._spriteset._tilemap)?sc._spriteset._tilemap:sc;parent.addChild(spr);
  $gamePlayer._cmt43HideVisual=true;
  R44.arrival={sprite:spr,scene:sc,phase:0,t:0,spoken:false,stopX:Math.round(($gamePlayer.screenX?$gamePlayer.screenX():Graphics.width*.38)+86)};
  playSe('Camutanga_BusArrive',72,95);
};
R44.finishArrival=function(){
  var a=R44.arrival;
  if(a&&a.sprite&&a.sprite.parent)a.sprite.parent.removeChild(a.sprite);
  if(a&&a.sprite)a.sprite.destroy({children:true,texture:false,baseTexture:false});
  R44.arrival=null;if($gamePlayer)$gamePlayer._cmt43HideVisual=false;
  try{
    if(C.Relaunch40&&C.Relaunch40.state){
      var s=C.Relaunch40.state();s.introSeen=true;s._arrivalSeen44=true;C.Relaunch40._introOpen=false;
      if(C.Relaunch40.refreshObjective)C.Relaunch40.refreshObjective(true);
    }
  }catch(e){}
  toast('Objetivo: siga pela estrada até a Rua Santa Cruz.',220);
  R44.scheduleAutosave('chegada',60);
};
R44.updateArrival=function(sc){
  var a=R44.arrival;if(!a)return;if(a.scene!==sc){R44.finishArrival();return;}a.t++;
  if(a.sprite)a.sprite.bitmap=R44.makeBusFrame(Math.floor(a.t/7)%3);
  if(a.phase===0){a.sprite.x-=7;if(a.sprite.x<=a.stopX){a.sprite.x=a.stopX;a.phase=1;a.t=0;}}
  else if(a.phase===1){
    if(a.t===15){$gamePlayer._cmt43HideVisual=false;try{$gamePlayer.setDirection(4);}catch(e){}}
    if(a.t===30&&!a.spoken){
      a.spoken=true;var nm=($gameActors.actor(1)&&$gameActors.actor(1).name())||'Você';
      if($gameMessage){
        $gameMessage.add('A velha lotação para no Trevo de Camutanga.');
        $gameMessage.add(nm+' desce com pouca bagagem. A Rua Santa Cruz fica logo adiante.');
        $gameMessage.add('Conheça a cidade, converse com os moradores e descubra onde passar a primeira noite.');
      }
    }
    if(a.t>54&&(!$gameMessage||!$gameMessage.isBusy())){a.phase=2;a.t=0;}
  }else{
    a.sprite.x-=8;if(a.sprite.x<-150)R44.finishArrival();
  }
};
if(C.Release43){
  C.Release43.startArrival=R44.startArrival;
  C.Release43.updateArrival=R44.updateArrival;
  C.Release43.finishArrival=R44.finishArrival;
  if(C.Relaunch40)C.Relaunch40.openArrival=R44.startArrival;
}

// -------------------------------------------------------------------------
// 2. ITEM/FERRAMENTA SEMPRE NA MÃO + animação ao usar/interagir.
// -------------------------------------------------------------------------
R44.toolPose=function(it){
  if(!it)return '';
  var t=String(note(it,'lifeTool')||'').toLowerCase();
  if(t==='axe')return 'axe';
  if(t==='pickaxe')return 'pickaxe';
  if(t==='hoe')return 'hoe';
  if(t==='watering')return 'water';
  if(t==='fishing')return 'fish';
  return '';
};
R44.animateSelectedTool=function(){
  var it=activeItem();if(!it||!hasItem(it)||!C.setHeroPose)return false;
  var p=R44.toolPose(it);if(!p)return false;
  if(p==='fish'){
    try{if(C.canFish&&C.canFish())return false;}catch(e){}
    // Em terra apenas mostra um pequeno preparo, sem iniciar pesca.
    C.setHeroPose('fish',24);return true;
  }
  C.setHeroPose(p,p==='water'?38:46);
  return true;
};

if(C.Hero){
  var H=C.Hero;
  H.updateHeldOnCharacterSprite=function(owner,pose,dir){
    if(!owner||!owner._character||owner._character!==$gamePlayer)return;
    var sp=H.ensureHeldSprite?H.ensureHeldSprite(owner):null;if(!sp)return;
    var it=activeItem();
    // Durante uma pose de ferramenta, se o slot estiver vazio usa o item padrão da pose.
    if((!it||!hasItem(it))&&H.actionItemId){var fid=H.actionItemId(pose);it=item(fid);}
    if(!it||!hasItem(it)){sp.visible=false;return;}
    if(H.applyHeldBitmap)H.applyHeldBitmap(owner,sp,it);
    sp.visible=true;sp.opacity=255;
    var action=/^(axe|pickaxe|hoe|water|fish|attack|gather)$/.test(String(pose||''));
    var total=Number($gamePlayer._camutangaHeroPoseTotal||1),rem=Number($gamePlayer._camutangaHeroPoseTimer||0),t=clamp((total-rem)/Math.max(1,total),0,1);
    var side=dir===4?-1:dir===6?1:1;
    var moving=$gamePlayer.isMoving&&$gamePlayer.isMoving(),bob=moving?Math.round(Math.sin(Graphics.frameCount*.45)*2):0;
    sp.scale.x=sp.scale.y=.72;
    if(action&&(pose==='axe'||pose==='pickaxe'||pose==='hoe'||pose==='attack')){
      sp.x=side*(11+Math.sin(t*Math.PI)*18);sp.y=-43+Math.sin(t*Math.PI)*19;sp.rotation=(-1.05+2.15*t)*side;sp.scale.x=sp.scale.y=.80;
    }else if(action&&pose==='water'){
      sp.x=side*23;sp.y=-28;sp.rotation=side*(.30+.48*Math.sin(t*Math.PI));sp.scale.x=sp.scale.y=.76;
    }else if(action&&pose==='fish'){
      sp.x=side*25;sp.y=-39-(t<.36?Math.sin((t/.36)*Math.PI)*8:0);sp.rotation=side*(.48-(t<.36?.78*Math.sin((t/.36)*Math.PI):0));sp.scale.x=sp.scale.y=.74;
    }else{
      // Pose equipada permanente.
      if(dir===4){sp.x=-18;sp.y=-24+bob;sp.rotation=-.30;}
      else if(dir===6){sp.x=18;sp.y=-24+bob;sp.rotation=.30;}
      else if(dir===8){sp.x=14;sp.y=-28+bob;sp.rotation=-.12;}
      else{sp.x=17;sp.y=-23+bob;sp.rotation=.12;}
    }
  };
}

// A hotbar manda também no item ativo usado pelos sistemas antigos.
if(C.V3&&C.V3.selectHot){
  var _selectHot44=C.V3.selectHot;
  C.V3.selectHot=function(i){
    var r=_selectHot44.apply(this,arguments),vs=v3(),id=vs&&vs.hotbar?Number(vs.hotbar[Number(vs.hotIndex||0)]||0):0;
    var ls=life();if(ls)ls.activeItemId=id;
    return r;
  };
}
if(C.V3&&C.V3.setHotSlot){
  var _setHotSlot44=C.V3.setHotSlot;
  C.V3.setHotSlot=function(i,id){var r=_setHotSlot44.apply(this,arguments);var ls=life();if(ls)ls.activeItemId=activeItemId();return r;};
}

// AÇÃO/USAR sempre anima a ferramenta; a lógica contextual existente continua.
if(C.lifeAction){
  var _lifeAction44=C.lifeAction;
  C.lifeAction=function(){
    try{R44.animateSelectedTool();}catch(e){}
    return _lifeAction44.apply(C,arguments);
  };
}
// INTERAGIR: primeiro respeita NPC/porta/evento. Se nada foi acionado, usa a ferramenta ativa.
var _triggerButton44=Game_Player.prototype.triggerButtonAction;
Game_Player.prototype.triggerButtonAction=function(){
  var handled=_triggerButton44.call(this);if(handled)return true;
  try{
    if(Input.isTriggered('ok')&&activeItem()&&R44.toolPose(activeItem())){
      if(C.lifeAction)C.lifeAction();return true;
    }
  }catch(e){}
  return handled;
};

// -------------------------------------------------------------------------
// 3. MAPA LIMPO: esquema simples inspirado nas ruas históricas enviadas.
// -------------------------------------------------------------------------
R44.POINTS={
  16:{name:'Vila',x:16,y:20,mark:'V',tip:'Moradores e pequenos serviços.'},
  26:{name:'Floresta',x:27,y:25,mark:'F',tip:'Madeira, ervas e coleta.'},
  9:{name:'Pedra da Caveira',x:35,y:38,mark:'P',tip:'Mistérios da Lenda e exploração.'},
  25:{name:'Caverna',x:45,y:24,mark:'C',tip:'Mineração, geodos e cristais.'},
  3:{name:'Casarão e Lago',x:82,y:20,mark:'L',tip:'Casarão antigo e lago especial de pesca.'},
  14:{name:'Pedro A. Uchôa',x:72,y:43,mark:'R',tip:'Rua histórica e acesso à zona rural.'},
  8:{name:'Igreja / Cemitério',x:61,y:55,mark:'I',tip:'Igreja, cemitério e histórias antigas.'},
  2:{name:'Rua Santa Cruz',x:34,y:64,mark:'S',tip:'Comércio, hospedagem e serviços.'},
  23:{name:'Hospedagem',x:25,y:59,mark:'H',tip:'Seu primeiro abrigo ao chegar.'},
  11:{name:'Praça da Bíblia',x:49,y:61,mark:'★',tip:'Eventos, moradores e atividades.'},
  7:{name:'Trevo',x:51,y:79,mark:'T',tip:'Entrada principal de Camutanga.'},
  5:{name:'Fazenda',x:51,y:93,mark:'⌂',tip:'Sua futura propriedade.'}
};
R44.LINKS=[[16,26],[26,9],[9,25],[9,11],[11,2],[11,8],[8,14],[14,3],[7,2],[7,11],[7,8],[7,5]];
R44.targetMap=function(){try{return C.Release43&&C.Release43.objectiveTarget?Number(C.Release43.objectiveTarget()||0):0;}catch(e){return 0;}};
R44.storyTargets=function(){try{return C.Release43&&C.Release43.storyTargets?C.Release43.storyTargets():[];}catch(e){return [];}};
R44.closeMap=function(){var e=document.getElementById('cmt44-map');if(e)e.remove();document.body.classList.remove('camutanga-ui-open');};
R44.mapSvg=function(){
  var s='<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">';
  // rio decorativo
  s+='<path d="M2 73 C20 69,29 75,45 72 S74 68,98 73" fill="none" stroke="#7aa5a1" stroke-width="5" opacity=".45"/>';
  // estradas
  R44.LINKS.forEach(function(l){var a=R44.POINTS[l[0]],b=R44.POINTS[l[1]];if(!a||!b)return;s+='<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#8a6f46" stroke-width="3.2" stroke-linecap="round"/>';s+='<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" stroke="#dcc58b" stroke-width="1.25" stroke-linecap="round"/>';});
  s+='</svg>';return s;
};
R44.openMap=function(){
  R44.closeMap();document.body.classList.add('camutanga-ui-open');
  var cur=$gameMap?$gameMap.mapId():0,target=R44.targetMap(),missions=R44.storyTargets();
  var root=document.createElement('div');root.id='cmt44-map';
  var nodes='';Object.keys(R44.POINTS).forEach(function(k){var id=Number(k),p=R44.POINTS[id],cls=(id===cur?' current':'')+(id===target?' target':'')+(missions.indexOf(id)>=0?' mission':'');nodes+='<button class="node'+cls+'" data-id="'+id+'" style="left:'+p.x+'%;top:'+p.y+'%"><span>'+p.mark+'</span><b>'+p.name+'</b></button>';});
  var obj='Explore Camutanga no seu ritmo.';try{var o=C.Relaunch40&&C.Relaunch40.objective&&C.Relaunch40.objective();if(o)obj=o.title+' — '+o.progress;}catch(e){}
  root.innerHTML='<div class="sheet"><header><div><small>CAMUTANGA • MAPA DE VIAGEM</small><h1>Ruas e caminhos</h1></div><button id="cmt44-close">FECHAR ×</button></header><main><section class="map"><div class="paper"></div>'+R44.mapSvg()+nodes+'<div class="legend"><i class="you"></i> Você <i class="goal"></i> Objetivo <i class="story"></i> Lenda</div></section><aside><small>AGORA</small><h2>'+((R44.POINTS[cur]&&R44.POINTS[cur].name)||'Camutanga')+'</h2><p id="cmt44-info">'+obj+'</p><div class="tip">Toque em um local para ver o que existe por lá. O mapa indica regiões, não teletransporta você.</div></aside></main></div>';
  var css=document.createElement('style');css.textContent=''
  +'#cmt44-map{position:fixed;inset:0;z-index:2147483300;background:rgba(6,9,7,.94);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;font-family:Arial,sans-serif;color:#342b1d}'
  +'#cmt44-map .sheet{width:min(1160px,97vw);height:min(730px,96vh);display:grid;grid-template-rows:auto 1fr;background:#efe0b7;border:2px solid #8c713e;border-radius:22px;overflow:hidden;box-shadow:0 24px 90px #000b}'
  +'#cmt44-map header{display:flex;align-items:center;padding:14px 18px;background:#26352a;color:#fff;border-bottom:3px solid #b48b43}#cmt44-map h1{margin:2px 0 0;font-size:28px}#cmt44-map header small{letter-spacing:3px;color:#e8ca78}#cmt44-close{margin-left:auto;min-height:48px;padding:0 18px;border:0;border-radius:12px;background:#e2bd58;color:#221a08;font-weight:900}'
  +'#cmt44-map main{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 270px}.map{position:relative;overflow:hidden;background:linear-gradient(#e9d7aa,#dac393)}.paper{position:absolute;inset:0;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.45),transparent 35%),repeating-linear-gradient(0deg,rgba(83,60,31,.025) 0 1px,transparent 1px 6px)}.map svg{position:absolute;inset:4%;width:92%;height:92%;overflow:visible}'
  +'.node{position:absolute;transform:translate(-50%,-50%);border:0;background:transparent;color:#382b18;display:flex;flex-direction:column;align-items:center;gap:3px;max-width:112px;cursor:pointer}.node span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#485c43;color:#fff;border:3px solid #f5e8c5;box-shadow:0 3px 9px #0005;font-weight:900}.node b{font-size:11px;line-height:1.05;padding:3px 5px;background:#f5e8c5d9;border-radius:6px;box-shadow:0 1px 3px #0003}.node.current span{background:#3179ba;box-shadow:0 0 0 5px #3179ba44,0 3px 9px #0005}.node.target span{background:#d9a721;color:#2a2007;animation:cmt44pulse 1s infinite alternate}.node.mission:not(.target) span{background:#9b493e}.legend{position:absolute;left:16px;bottom:12px;background:#f6eacbd9;padding:7px 10px;border-radius:9px;font-size:11px;display:flex;gap:10px;align-items:center}.legend i{width:10px;height:10px;border-radius:50%;display:inline-block}.legend .you{background:#3179ba}.legend .goal{background:#d9a721}.legend .story{background:#9b493e}'
  +'#cmt44-map aside{padding:24px;background:#f8edcf;border-left:1px solid #bda878;overflow:auto}#cmt44-map aside small{letter-spacing:2px;color:#8d6b2f;font-weight:800}#cmt44-map aside h2{font-size:27px;margin:7px 0 12px}#cmt44-map aside p{line-height:1.55;color:#4f4432}.tip{margin-top:22px;padding:12px;border-radius:10px;background:#dfcfaa;color:#5c4d34;font-size:12px;line-height:1.4}@keyframes cmt44pulse{to{transform:scale(1.16)}}'
  +'@media(max-width:760px){#cmt44-map{padding:5px}#cmt44-map .sheet{height:98vh}#cmt44-map header{padding:9px 10px}#cmt44-map h1{font-size:20px}#cmt44-map header small{font-size:8px}#cmt44-close{min-height:42px;padding:0 10px}#cmt44-map main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) 150px}#cmt44-map aside{border-left:0;border-top:1px solid #bda878;padding:10px 14px}#cmt44-map aside h2{font-size:19px;margin:3px 0}.tip{display:none}.node span{width:29px;height:29px}.node b{font-size:8px;max-width:76px}.legend{font-size:8px;left:6px;bottom:5px;padding:5px 7px;gap:5px}}';
  root.appendChild(css);document.body.appendChild(root);
  root.querySelector('#cmt44-close').onclick=R44.closeMap;
  root.querySelectorAll('.node').forEach(function(btn){btn.onclick=function(){var p=R44.POINTS[Number(btn.dataset.id)];var inf=root.querySelector('#cmt44-info');inf.innerHTML='<b>'+p.name+'</b><br>'+p.tip+(Number(btn.dataset.id)===target?'<br><br><b>Próximo objetivo aqui.</b>':'');};});
};
R44.ensureMini=function(){
  ['cmt42-mini','cmt43-mini','cmt42-map-btn','cmt43-map-btn','cmt44-mini','cmt44-map-btn'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove();});
  if(!(SceneManager._scene instanceof Scene_Map))return;
  var cur=$gameMap?$gameMap.mapId():0,p=R44.POINTS[cur],target=R44.targetMap(),tp=R44.POINTS[target];if(!p)return;
  var mini=document.createElement('button');mini.id='cmt44-mini';mini.innerHTML='<span class="lab">MAPA</span><b>'+p.name+'</b>'+(tp?'<em>Objetivo → '+tp.name+'</em>':'<em>Explore os arredores</em>');
  mini.style.cssText='position:fixed;right:max(8px,env(safe-area-inset-right));top:116px;z-index:9000;width:176px;min-height:70px;text-align:left;padding:9px 11px;border:1px solid #caa952;border-radius:13px;background:rgba(25,38,29,.88);color:#fff;box-shadow:0 4px 16px #0007;font-family:Arial,sans-serif;cursor:pointer';
  var st=document.createElement('style');st.textContent='#cmt44-mini .lab{display:block;color:#e7c663;font-size:8px;letter-spacing:2px}#cmt44-mini b{display:block;font-size:13px;margin:2px 0}#cmt44-mini em{display:block;font-size:9px;opacity:.74;font-style:normal;line-height:1.2}@media(max-width:760px){#cmt44-mini{width:126px;min-height:58px;top:118px;padding:7px 8px}#cmt44-mini b{font-size:10px}#cmt44-mini em{font-size:7px}}';mini.appendChild(st);mini.onclick=function(e){e.preventDefault();R44.openMap();};document.body.appendChild(mini);
  var b=document.createElement('button');b.id='cmt44-map-btn';b.textContent='MAPA';b.style.cssText='position:fixed;right:max(8px,env(safe-area-inset-right));top:66px;z-index:9100;min-width:74px;height:42px;border:1px solid #dbc56e;border-radius:12px;background:#15241acc;color:white;font-weight:800;display:'+(touch()?'block':'none');b.onclick=R44.openMap;document.body.appendChild(b);
};
if(C.Release43){C.Release43.openMap=R44.openMap;C.Release43.closeMap=R44.closeMap;C.Release43.ensureMini=R44.ensureMini;C.Release43.ensureMapButton=function(){};}
Input.keyMapper[77]='cmtMap44';

// -------------------------------------------------------------------------
// 4. AUTOSAVE: slot 20, transferências e marcos importantes.
// -------------------------------------------------------------------------
R44._saveDue=0;R44._lastSaveFrame=-99999;R44._saveReason='';
R44.showSave=function(text){
  var e=document.getElementById('cmt44-save');if(!e){e=document.createElement('div');e.id='cmt44-save';e.style.cssText='position:fixed;left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));z-index:9300;padding:7px 11px;border-radius:10px;background:rgba(18,30,22,.84);color:#f1df9a;font:700 10px Arial,sans-serif;letter-spacing:1px;pointer-events:none;opacity:0;transition:opacity .18s';document.body.appendChild(e);}e.textContent=text;e.style.opacity='1';clearTimeout(R44._saveTimer);R44._saveTimer=setTimeout(function(){e.style.opacity='0';},1300);
};
R44.scheduleAutosave=function(reason,delay){
  if(!$gameSystem||!$gameParty)return;R44._saveReason=reason||'progresso';R44._saveDue=Graphics.frameCount+Math.max(1,Number(delay||25));
};
R44.autosave=function(){
  if(!DataManager||!DataManager.saveGame||!$gameSystem||!$gameMap)return false;
  if(Graphics.frameCount-R44._lastSaveFrame<180)return false;
  try{
    R44._lastSaveFrame=Graphics.frameCount;R44.showSave('SALVANDO…');
    var ret=DataManager.saveGame(R44.AUTOSAVE_SLOT);
    if(ret&&typeof ret.then==='function')ret.then(function(){R44.showSave('SALVO ✓');}).catch(function(){R44.showSave('AUTOSAVE FALHOU');});
    else R44.showSave(ret===false?'AUTOSAVE FALHOU':'SALVO ✓');
    return ret!==false;
  }catch(e){R44.showSave('AUTOSAVE FALHOU');return false;}
};
var _performTransfer44=Game_Player.prototype.performTransfer;
Game_Player.prototype.performTransfer=function(){var was=this.isTransferring&&this.isTransferring();_performTransfer44.call(this);if(was)R44.scheduleAutosave('mudança de área',70);};
if(C.Relaunch40){
  if(C.Relaunch40.setChapter){var _setChapter44=C.Relaunch40.setChapter;C.Relaunch40.setChapter=function(ch){var before=this.state?this.state().chapter:0;var r=_setChapter44.apply(this,arguments);if(ch>before)R44.scheduleAutosave('objetivo',45);return r;};}
  if(C.Relaunch40.buyFarm){var _buyFarm44=C.Relaunch40.buyFarm;C.Relaunch40.buyFarm=function(){var r=_buyFarm44.apply(this,arguments);R44.scheduleAutosave('fazenda',40);return r;};}
}
if(C.advanceToMorning){var _morning44=C.advanceToMorning;C.advanceToMorning=function(){var r=_morning44.apply(C,arguments);R44.scheduleAutosave('novo dia',45);return r;};}

// Título: acesso rápido ao autosave, sem apagar os saves manuais.
Window_TitleCommand.prototype.makeCommandList=function(){
  this.addCommand('Nova Vida em Camutanga','camutangaFree');
  this.addCommand('A Lenda — História Original','newGame');
  var auto=false;try{auto=DataManager.isThisGameFile(R44.AUTOSAVE_SLOT);}catch(e){}
  this.addCommand('Continuar Auto','cmtAutoContinue',auto);
  this.addCommand(TextManager.continue_,'continue',this.isContinueEnabled());
  this.addCommand(TextManager.options,'options');
};
var _titleCreate44=Scene_Title.prototype.createCommandWindow;
Scene_Title.prototype.createCommandWindow=function(){_titleCreate44.call(this);this._commandWindow.setHandler('cmtAutoContinue',this.commandCamutangaAutoContinue.bind(this));};
Scene_Title.prototype.commandCamutangaAutoContinue=function(){
  try{
    if(DataManager.loadGame(R44.AUTOSAVE_SLOT)){
      SoundManager.playLoad();this.fadeOutAll();if(this.reloadMapIfUpdated)this.reloadMapIfUpdated();SceneManager.goto(Scene_Map);$gameSystem.onAfterLoad();return;
    }
  }catch(e){}
  SoundManager.playBuzzer();this._commandWindow.activate();
};

// -------------------------------------------------------------------------
// 5. PASSAGENS: gatilhos invisíveis de missão continuam funcionando, mas
//    nunca viram uma parede. Barreiras puras de texto são ignoradas.
// -------------------------------------------------------------------------
R44.isInvisibleFloorTrigger=function(ev){
  try{
    var page=ev&&ev.page&&ev.page(); if(!page)return false;
    var im=page.image||{};
    return Number(page.trigger||0)===1 && Number(page.priorityType||0)===1 && !im.characterName && Number(im.tileId||0)===0;
  }catch(e){return false;}
};
R44.isPureBarrier=function(ev){
  try{
    var page=ev&&ev.page&&ev.page();if(!page)return false;
    var txt='';
    (page.list||[]).forEach(function(c){if(c&&(c.code===401||c.code===108||c.code===408))txt+=' '+String((c.parameters||[])[0]||'');});
    txt=txt.toLowerCase();
    return /bloquead|temporariamente bloq|complete as miss|completar uma miss|precisa completar uma miss/.test(txt);
  }catch(e){return false;}
};
var _setupPage44=Game_Event.prototype.setupPageSettings;
Game_Event.prototype.setupPageSettings=function(){
  _setupPage44.call(this);
  // Player Touch invisível é um sensor de chão, não uma parede.
  if(R44.isInvisibleFloorTrigger(this))this._priorityType=0;
  // Páginas cujo único propósito era barrar rota ficam atravessáveis.
  if(R44.isPureBarrier(this)){this._priorityType=0;this._through=true;}
};
var _eventStartBarrier44=Game_Event.prototype.start;
Game_Event.prototype.start=function(){
  if(R44.isPureBarrier(this))return;
  return _eventStartBarrier44.call(this);
};

// -------------------------------------------------------------------------
// 6. Ciclo do mapa: atualização do minimapa, tecla M e autosave pendente.
// -------------------------------------------------------------------------
var _sceneStart44=Scene_Map.prototype.start;
Scene_Map.prototype.start=function(){_sceneStart44.call(this);setTimeout(function(){R44.ensureMini();},260);};
var _sceneUpdate44=Scene_Map.prototype.update;
Scene_Map.prototype.update=function(){
  _sceneUpdate44.call(this);
  if(Input.isTriggered&&Input.isTriggered('cmtMap44'))R44.openMap();
  if(R44._saveDue&&Graphics.frameCount>=R44._saveDue&&!($gameMap&&$gameMap.isEventRunning&&$gameMap.isEventRunning())){R44._saveDue=0;R44.autosave();}
};
var _sceneTerm44=Scene_Map.prototype.terminate;
Scene_Map.prototype.terminate=function(){['cmt44-mini','cmt44-map-btn'].forEach(function(id){var e=document.getElementById(id);if(e)e.remove();});R44.closeMap();_sceneTerm44.call(this);};

// Salva também ao ocultar a aba/app, quando possível.
document.addEventListener('visibilitychange',function(){if(document.hidden&&SceneManager._scene instanceof Scene_Map)R44.autosave();});

// Diagnóstico simples para o DEV menu/console.
R44.debug=function(){return {build:R44.BUILD,map:$gameMap?$gameMap.mapId():0,item:activeItemId(),tool:R44.toolPose(activeItem()),autosaveSlot:R44.AUTOSAVE_SLOT};};

})();

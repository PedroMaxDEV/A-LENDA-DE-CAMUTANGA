/*:
 * @plugindesc [v3.5 FIX] Camutanga Cidade Viva - população dinâmica, empregos, feira, vendedores, reputação, moto-táxi, coleta urbana e minigames.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Complementa Camutanga V3/V3.1 sem substituir os mapas originais.
 *
 * PC:
 *   K = abrir painel CIDADE
 *   F / AÇÃO = interagir com cidadãos e atividades
 *   ENTER / Z = também interage quando não há evento original na frente
 *
 * Celular:
 *   Botão CIDADE no alto da tela
 *   AÇÃO para conversar/interagir
 *
 * O sistema é salvo dentro do save normal do RPG Maker.
 */
(function(){
'use strict';

window.Camutanga=window.Camutanga||{};
var C=window.Camutanga;
var City=C.City=C.City||{};
City.VERSION='3.5.0';

// -----------------------------------------------------------------------------
// Configuração geral
// -----------------------------------------------------------------------------
City.CITY_MAPS=[2,7,8,11,14,16];
City.MAP_PROFILES={
  2:{name:'Rua Santa Cruz',density:15,lamps:7},
  7:{name:'Trevo',density:10,lamps:5},
  8:{name:'Igreja',density:11,lamps:6},
  11:{name:'Praça da Bíblia',density:21,lamps:8},
  14:{name:'Pedro Albuquerque Uchôa',density:13,lamps:6},
  16:{name:'Vila',density:15,lamps:6}
};
City.TRAVEL=[
  {mapId:2,name:'Rua Santa Cruz',x:30,y:16,cost:24},
  {mapId:7,name:'Trevo',x:26,y:48,cost:28},
  {mapId:11,name:'Praça',x:25,y:48,cost:30},
  {mapId:8,name:'Igreja',x:49,y:29,cost:34},
  {mapId:14,name:'Pedro A. Uchôa',x:22,y:53,cost:38},
  {mapId:16,name:'Vila',x:43,y:33,cost:42},
  {mapId:5,name:'Minha Base',x:24,y:3,cost:36}
];
City.LEVELS=[0,20,55,105,175,270,390];
City.LEVEL_NAMES=['Recém-chegado','Conhecido','Vizinho','Parceiro da Cidade','Querido em Camutanga','Figura da Cidade','Lenda Local'];
City.SPRITES=['People1','People2','People3','People4'];
City.NAMES=['Ana','Beto','Carla','Damião','Eliane','Fábio','Graça','Hugo','Iara','João','Lúcia','Márcio','Nina','Otávio','Rita','Sérgio','Tânia','Val','Zeca','Cida','Naldo','Bia','Rômulo','Lena'];
City.ROLES=['morador','trabalhador','estudante','aposentado','visitante','comerciante'];

Input.keyMapper[75]='cityMenu'; // K

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function day(){return C.dayKey?C.dayKey():0;}
function clock(){return C.gameClock?C.gameClock():{day:1,hour:10,minute:0,raw:0};}
function isTouch(){return C.touchDevice?C.touchDevice():(('ontouchstart' in window)||(navigator.maxTouchPoints||0)>0);}
function toast(t,f){if(C.toast)C.toast(t,f||150);}
function item(id){return window.$dataItems?$dataItems[Number(id||0)]:null;}
function have(id,n){var it=item(id);return !!(it&&$gameParty&&$gameParty.numItems(it)>=(n||1));}
function gain(id,n){var it=item(id);if(it&&$gameParty)$gameParty.gainItem(it,n||1);}
function lose(id,n){var it=item(id);if(it&&$gameParty)$gameParty.loseItem(it,n||1);}
function gold(){return $gameParty?$gameParty.gold():0;}
function giveGold(n){if($gameParty)$gameParty.gainGold(Math.max(0,Math.floor(n||0)));}
function spendGold(n){if($gameParty)$gameParty.loseGold(Math.max(0,Math.floor(n||0)));}
function rand01(seed){var x=Math.sin(Number(seed||1)*12.9898+78.233)*43758.5453123;return x-Math.floor(x);}
function hash(a,b,c){return Math.floor(rand01((a+1)*9187+(b+3)*131+(c+7)*37)*1000000);}
function playSE(name,vol,pitch){try{AudioManager.playSe({name:name,volume:vol||70,pitch:pitch||100,pan:0});}catch(e){}}
function cityMap(mid){return City.CITY_MAPS.indexOf(Number(mid||0))>=0;}
function mapName(mid){var p=City.MAP_PROFILES[mid];return p?p.name:'Camutanga';}

City.defaultState=function(){return{
  version:City.VERSION,day:-1,reputation:0,level:0,jobs:[],jobCounter:1,
  talked:{},visited:{},collected:{},dailyGiftDay:-1,streetGameDay:-1,
  vendorPurchases:0,trashTotal:0,secretsTotal:0,jobsDone:0,rides:0,
  greetedDay:-1,notifiedDay:-1,medalGiven:false,firstCityTutorial:false,benchUse:{}
};};
City.state=function(){
  if(!$gameSystem)return City.defaultState();
  if(!$gameSystem._camutangaCidadeViva)$gameSystem._camutangaCidadeViva=City.defaultState();
  var s=$gameSystem._camutangaCidadeViva,d=City.defaultState(),k;
  for(k in d)if(s[k]==null)s[k]=d[k];
  if(!s.talked)s.talked={};if(!s.visited)s.visited={};if(!s.collected)s.collected={};if(!s.benchUse)s.benchUse={};if(!Array.isArray(s.jobs))s.jobs=[];
  return s;
};
City.level=function(){
  var r=City.state().reputation,l=0;
  for(var i=0;i<City.LEVELS.length;i++)if(r>=City.LEVELS[i])l=i;
  City.state().level=l;return l;
};
City.levelName=function(){return City.LEVEL_NAMES[City.level()]||City.LEVEL_NAMES[0];};
City.discount=function(){return Math.min(.18,City.level()*.03);};
City.addReputation=function(n,reason){
  n=Math.max(0,Math.floor(n||0));if(!n)return;
  var s=City.state(),before=City.level();s.reputation+=n;var after=City.level();
  if(after>before){toast('REPUTAÇÃO: '+City.LEVEL_NAMES[after]+'! Novos descontos e favores liberados.',260);playSE('Camutanga_CityCheer',70,105);}
  else if(reason)toast('+'+n+' reputação • '+reason,100);
  if(after>=4&&!s.medalGiven&&item(160)){s.medalGiven=true;gain(160,1);toast('Você recebeu a Medalha de Camutanga!',220);}
};

// -----------------------------------------------------------------------------
// Calendário urbano e acontecimentos
// -----------------------------------------------------------------------------
City.todayEvent=function(){
  var dk=day(),h=clock().hour;
  if(C.V3&&C.V3.festivalForDay){
    var f=C.V3.festivalForDay(dk);
    if(f){
      if(f.id==='feira')return{id:'feira',name:'Feira Livre',mapId:11,start:7,end:19,desc:'Barracas, movimento e preços especiais na praça.',bonus:10};
      if(f.id==='pesca')return{id:'pesca',name:'Torneio de Pesca',mapId:2,start:6,end:18,desc:'Pescadores e curiosos circulam pela cidade.',bonus:6};
      if(f.id==='mutirao')return{id:'mutirao',name:'Mutirão Comunitário',mapId:0,start:7,end:18,desc:'Limpar as ruas rende reputação em dobro.',bonus:5};
      if(f.id==='lenda')return{id:'lenda',name:'Noite das Lendas',mapId:11,start:18,end:24,desc:'Moradores contam histórias e brilhos estranhos aparecem.',bonus:8};
    }
  }
  var wd=(dk+1)%7;
  if(wd===6)return{id:'igreja',name:'Manhã de Domingo',mapId:8,start:7,end:12,desc:'A região da igreja recebe mais moradores pela manhã.',bonus:8};
  if(wd===5)return{id:'futebol',name:'Futebol na Praça',mapId:11,start:14,end:20,desc:'A praça vira ponto de encontro para uma pelada e desafios.',bonus:9};
  if(wd===4)return{id:'comida',name:'Comida de Rua',mapId:11,start:17,end:23,desc:'Barracas de comida e mais movimento no começo da noite.',bonus:8};
  if(wd===3)return{id:'musica',name:'Música na Praça',mapId:11,start:18,end:22,desc:'Um músico local anima a praça no fim do dia.',bonus:6};
  if(wd===2)return{id:'feirinha',name:'Feirinha de Bairro',mapId:2,start:8,end:17,desc:'Produtos e sementes aparecem na Rua Santa Cruz.',bonus:5};
  return{id:'rotina',name:'Dia de Movimento',mapId:0,start:7,end:20,desc:'Moradores trabalham, passeiam e resolvem suas coisas pela cidade.',bonus:2};
};
City.eventActiveHere=function(){var e=City.todayEvent(),m=$gameMap?$gameMap.mapId():0,h=clock().hour;return h>=e.start&&h<e.end&&(e.mapId===0||e.mapId===m);};

// -----------------------------------------------------------------------------
// Empregos e tarefas da cidade
// -----------------------------------------------------------------------------
City.jobTemplates=function(){return[
 {type:'cleanup',title:'Ruas Limpas',desc:'Recolha {n} resíduos espalhados pelas ruas.',min:5,max:9,reward:180,rep:5},
 {type:'social',title:'Conhecer os Vizinhos',desc:'Converse com {n} moradores diferentes hoje.',min:4,max:7,reward:150,rep:4},
 {type:'visit',title:'Volta por Camutanga',desc:'Passe por {n} regiões diferentes da cidade.',min:3,max:5,reward:170,rep:4},
 {type:'resource',title:'Material para Reparo',desc:'Entregue {n} unidades de {item}.',reward:240,rep:6},
 {type:'delivery',title:'Entrega Expressa',desc:'Leve uma encomenda até {map}. Procure quem estiver com a placa ENTREGA.',reward:260,rep:7},
 {type:'shopping',title:'Fortalecer o Comércio',desc:'Compre {n} produtos de vendedores de rua.',min:2,max:4,reward:130,rep:3},
 {type:'secrets',title:'Olhos Abertos',desc:'Encontre {n} brilhos/achados escondidos pela cidade.',min:1,max:3,reward:210,rep:5}
];};
City.makeJob=function(index,templateIndex){
  var dk=day(),templates=City.jobTemplates(),pick=templateIndex==null?((hash(dk,index,4)+index)%templates.length):templateIndex,t=templates[pick],j={id:'D'+dk+'J'+index,type:t.type,title:t.title,status:'offered',progress:0,target:1,reward:t.reward+Math.floor(rand01(dk*71+index*19)*90),rep:t.rep,desc:t.desc};
  if(t.min){j.target=t.min+Math.floor(rand01(dk*83+index*31)*(t.max-t.min+1));j.desc=j.desc.replace('{n}',j.target);}
  if(t.type==='resource'){
    var opts=[{id:53,n:6,name:'Madeira'},{id:35,n:8,name:'Pedra'},{id:54,n:7,name:'Fibra Vegetal'},{id:62,n:6,name:'Argila'}],o=opts[hash(dk,index,8)%opts.length];
    j.itemId=o.id;j.target=o.n;j.desc=j.desc.replace('{n}',o.n).replace('{item}',o.name);
  }
  if(t.type==='delivery'){
    var maps=[2,7,8,11,14,16],target=maps[hash(dk,index,14)%maps.length];j.targetMap=target;j.desc=j.desc.replace('{map}',mapName(target));
  }
  return j;
};
City.onNewDay=function(force){
  var s=City.state(),dk=day();if(!force&&s.day===dk)return;
  s.day=dk;s.talked={};s.visited={};s.vendorPurchases=0;s.jobs=[];s.collected={};
  var order=[0,1,2,3,4,5,6];order.sort(function(a,b){return hash(dk,a,73)-hash(dk,b,73);});for(var i=0;i<4;i++)s.jobs.push(City.makeJob(i,order[i]));
  if(C.V3&&C.V3.state&&C.V3.state().calendar)C.V3.state().calendar.cityEvent=City.todayEvent().id;
  City._needsRuntimeRebuild=true;
};
City.activeJobs=function(){return City.state().jobs.filter(function(j){return j.status==='active';});};
City.acceptJob=function(j){
  if(!j||j.status!=='offered')return false;
  if(City.activeJobs().length>=3){toast('Você já está cuidando de 3 tarefas. Termine alguma primeiro.',150);playSE('Camutanga_CityBuzzer',55,100);return false;}
  j.status='active';j.progress=0;if(j.type==='delivery'&&$gameMap&&Number(j.targetMap)===$gameMap.mapId())City._needsRuntimeRebuild=true;toast('TAREFA ACEITA: '+j.title,160);playSE('Camutanga_CityCoin',58,120);return true;
};
City.completeJob=function(j){
  if(!j||j.status!=='active')return false;j.status='done';j.progress=j.target;
  giveGold(j.reward);City.addReputation(j.rep,'serviço para a cidade');City.state().jobsDone++;
  if(C.V3&&C.V3.state){var vs=C.V3.state();if(vs.stats)vs.stats.goldEarned=(vs.stats.goldEarned||0)+j.reward;}
  if(j.type==='delivery')City._needsRuntimeRebuild=true;playSE('Camutanga_CityCheer',72,108);toast('TAREFA CONCLUÍDA: '+j.title+' • +'+j.reward+' Cruzeiros',260);return true;
};
City.progress=function(type,n,extra){
  var jobs=City.state().jobs;n=Number(n||1);
  for(var i=0;i<jobs.length;i++){
    var j=jobs[i];if(j.status!=='active'||j.type!==type)continue;
    if(type==='delivery'&&extra&&Number(extra.mapId||0)!==Number(j.targetMap||0))continue;
    if(type==='resource')continue;
    j.progress=Math.min(j.target,(j.progress||0)+n);if(j.progress>=j.target)City.completeJob(j);
  }
};
City.tryResourceJob=function(j){
  if(!j||j.status!=='active'||j.type!=='resource')return false;
  if(!have(j.itemId,j.target)){toast('Ainda faltam materiais: '+(item(j.itemId)?item(j.itemId).name:'item')+' '+(have(j.itemId,1)?'('+($gameParty.numItems(item(j.itemId)))+'/'+j.target+')':'(0/'+j.target+')'),140);return false;}
  lose(j.itemId,j.target);return City.completeJob(j);
};
City.onEnterMap=function(mid){
  City.onNewDay(false);if(!cityMap(mid))return;var s=City.state(),key=String(mid);
  if(!s.visited[key]){s.visited[key]=true;City.progress('visit',1,{mapId:mid});}
  if(s.notifiedDay!==day()){s.notifiedDay=day();var e=City.todayEvent();toast('BOLETIM DE CAMUTANGA • '+e.name+': '+e.desc,260);}
};

// -----------------------------------------------------------------------------
// Cidadãos dinâmicos
// -----------------------------------------------------------------------------
function Game_CamutangaCitizen(){this.initialize.apply(this,arguments);}
Game_CamutangaCitizen.prototype=Object.create(Game_Character.prototype);
Game_CamutangaCitizen.prototype.constructor=Game_CamutangaCitizen;
Game_CamutangaCitizen.prototype.initialize=function(data){
  Game_Character.prototype.initialize.call(this);this._cityData=data;this._cityBubble='';this._cityBubbleTimer=0;this._cityNextMove=Graphics.frameCount+30+hash(data.id,data.x,data.y)%90;
  this.locate(data.x,data.y);this.setImage(data.sheet,data.index);this.setMoveSpeed(data.role==='worker'?3.1:2.7);this.setMoveFrequency(3);this.setDirection([2,4,6,8][hash(data.id,data.x,7)%4]);this.setWalkAnime(true);this.setStepAnime(false);this.setThrough(false);
};
Game_CamutangaCitizen.prototype.citySay=function(text,time){this._cityBubble=String(text||'');this._cityBubbleTimer=time||150;};
Game_CamutangaCitizen.prototype.update=function(){
  Game_Character.prototype.update.call(this);if(this._cityBubbleTimer>0)this._cityBubbleTimer--;
  if(this.isMoving()||this._locked)return;
  if(Graphics.frameCount>=this._cityNextMove){
    this._cityNextMove=Graphics.frameCount+70+hash(this._cityData.id,Graphics.frameCount,11)%160;
    if(this._cityData.stationary){if(rand01(Graphics.frameCount+this._cityData.id)>.55)this.turnRandom();return;}
    var r=rand01(Graphics.frameCount*3+this._cityData.id*17);if(r<.72)this.moveRandom();else this.turnRandom();
  }
};

function Sprite_CamutangaCitizen(){this.initialize.apply(this,arguments);}
Sprite_CamutangaCitizen.prototype=Object.create(Sprite_Character.prototype);
Sprite_CamutangaCitizen.prototype.constructor=Sprite_CamutangaCitizen;
Sprite_CamutangaCitizen.prototype.initialize=function(ch){
  Sprite_Character.prototype.initialize.call(this,ch);this._cityLastBubble=null;this._cityBadge=new Sprite(new Bitmap(138,44));this._cityBadge.anchor.x=.5;this._cityBadge.x=0;this._cityBadge.y=-58;this.addChild(this._cityBadge);this.refreshCityBadge();
};
Sprite_CamutangaCitizen.prototype.refreshCityBadge=function(){
  var ch=this._character,d=ch._cityData||{},b=this._cityBadge.bitmap;b.clear();var c=b._context;c.save();
  if(ch._cityBubbleTimer>0&&ch._cityBubble){
    roundRect(c,2,2,134,38,10,'rgba(15,21,18,.92)','rgba(255,255,255,.22)',1);c.restore();b._setDirty&&b._setDirty();font(b,12,'#fff',true);b.drawText(ch._cityBubble,8,7,122,25,'center');return;
  }
  var badge='';if(d.role==='agent')badge='QUADRO';else if(d.role==='taxi')badge='MOTO-TÁXI';else if(d.role==='vendorFood'||d.role==='vendorMarket'||d.role==='vendorFish')badge='LOJA';else if(d.role==='recipient')badge='ENTREGA';else if(d.role==='musician')badge='MÚSICA';
  if(badge){roundRect(c,18,8,102,27,10,'rgba(123,79,31,.90)','rgba(247,217,132,.72)',1);c.restore();b._setDirty&&b._setDirty();font(b,10,'#ffe9a6',true);b.drawText(badge,24,12,90,18,'center');}else c.restore();
};
Sprite_CamutangaCitizen.prototype.update=function(){
  Sprite_Character.prototype.update.call(this);var ch=this._character,sig=(ch._cityBubbleTimer>0?ch._cityBubble:'')+'|'+(ch._cityBubbleTimer>0?1:0);
  if(sig!==this._cityLastBubble){this._cityLastBubble=sig;this.refreshCityBadge();}
};

function font(b,size,color,bold){b.fontFace='GameFont';b.fontSize=size;b.textColor=color||'#fff';b.outlineColor='rgba(0,0,0,.78)';b.outlineWidth=3;b.fontBold=!!bold;}
function roundRect(ctx,x,y,w,h,r,fill,stroke,lw){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=lw||1;ctx.strokeStyle=stroke;ctx.stroke();}}
function text(b,t,x,y,w,h,align,size,color,bold){font(b,size||16,color||'#fff',bold);b.drawText(String(t==null?'':t),x,y,w,h||24,align||'left');}
function wrap(textv,max){var words=String(textv||'').split(/\s+/),lines=[],line='';for(var i=0;i<words.length;i++){var t=line?line+' '+words[i]:words[i];if(t.length>max&&line){lines.push(line);line=words[i];}else line=t;}if(line)lines.push(line);return lines;}
function para(b,t,x,y,w,lh,max,color,size){var lines=wrap(t,Math.max(14,Math.floor(w/((size||13)*.56))));if(max)lines=lines.slice(0,max);for(var i=0;i<lines.length;i++)text(b,lines[i],x,y+i*lh,w,lh,'left',size||13,color||'#d7dfda');}
function drawCard(b,x,y,w,h,sel){var c=b._context;c.save();roundRect(c,x,y,w,h,14,sel?'rgba(68,91,61,.97)':'rgba(19,27,24,.94)',sel?'rgba(245,213,112,.92)':'rgba(255,255,255,.12)',sel?2:1);c.restore();b._setDirty&&b._setDirty();}
function drawGauge(b,x,y,w,h,rate){var c=b._context;c.save();roundRect(c,x,y,w,h,h/2,'rgba(0,0,0,.45)','rgba(255,255,255,.12)',1);var fw=Math.floor((w-4)*clamp(rate,0,1));if(fw>1){var g=c.createLinearGradient(x,y,x+w,y);g.addColorStop(0,'#6bb66c');g.addColorStop(1,'#e0c85d');roundRect(c,x+2,y+2,fw,h-4,(h-4)/2,g,null,0);}c.restore();b._setDirty&&b._setDirty();}

City._runtime=null;
City.validTile=function(x,y,used){
  if(!$gameMap||!$gameMap.isValid(x,y))return false;if(x<2||y<2||x>=$gameMap.width()-2||y>=$gameMap.height()-2)return false;
  if($gamePlayer&&Math.abs($gamePlayer.x-x)+Math.abs($gamePlayer.y-y)<5)return false;
  if($gameMap.eventsXy(x,y).length)return false;
  if($gameMap.regionId&&$gameMap.regionId(x,y)===20)return false;
  var pass=0,dirs=[2,4,6,8];dirs.forEach(function(d){if($gameMap.isPassable(x,y,d))pass++;});if(pass<2)return false;
  if(used){for(var i=0;i<used.length;i++)if(Math.abs(used[i].x-x)+Math.abs(used[i].y-y)<2)return false;}
  return true;
};
City.pickTile=function(seed,used){
  if(!$gameMap)return{x:0,y:0};var w=$gameMap.width(),h=$gameMap.height();
  for(var a=0;a<520;a++){var x=2+(hash(seed,a,1)%Math.max(1,w-4)),y=2+(hash(seed,a,2)%Math.max(1,h-4));if(City.validTile(x,y,used))return{x:x,y:y};}
  return{x:Math.max(1,$gamePlayer?$gamePlayer.x:2),y:Math.max(1,$gamePlayer?$gamePlayer.y:2)};
};
City.makeCitizen=function(id,role,used,stationary){
  var mid=$gameMap.mapId(),p=City.pickTile(mid*1000+day()*83+id*47,used);used.push(p);var sp=City.SPRITES[hash(mid,id,3)%City.SPRITES.length],idx=hash(day(),id,5)%8;
  return new Game_CamutangaCitizen({id:id,mapId:mid,x:p.x,y:p.y,role:role||City.ROLES[hash(mid,id,8)%City.ROLES.length],name:City.NAMES[hash(day()+mid,id,9)%City.NAMES.length],sheet:sp,index:idx,stationary:!!stationary});
};
City.timeFactor=function(){var h=clock().hour;if(h<5)return .15;if(h<7)return .38;if(h<9)return .80;if(h<17)return 1;if(h<20)return .82;if(h<23)return .45;return .20;};
City.weatherFactor=function(){var w=C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear';if(w==='storm')return .34;if(w==='rain')return .58;if(w==='fog')return .72;return 1;};
City.prepareRuntime=function(){
  City.onNewDay(false);var mid=$gameMap?$gameMap.mapId():0;City._runtime={mapId:mid,citizens:[],spots:[],lamps:[],decor:[],sprites:[],used:[],lastAmbient:0};if(!cityMap(mid))return;
  var r=City._runtime,p=City.MAP_PROFILES[mid],count=Math.round(p.density*City.timeFactor()*City.weatherFactor());if(isTouch())count=Math.round(count*.78);
  var ev=City.todayEvent();if(City.eventActiveHere())count+=ev.bonus||0;count=clamp(count,3,isTouch()?22:30);
  var i;for(i=0;i<count;i++)r.citizens.push(City.makeCitizen(100+i,null,r.used,false));
  var h=clock().hour;
  if(mid===11&&h>=7&&h<22)r.citizens.push(City.makeCitizen(1,'agent',r.used,true));
  if((mid===7||mid===2)&&h>=6&&h<23)r.citizens.push(City.makeCitizen(2,'taxi',r.used,true));
  if((mid===11||mid===2)&&h>=9&&h<22)r.citizens.push(City.makeCitizen(3,'vendorFood',r.used,true));
  if(mid===11&&City.eventActiveHere()&&(ev.id==='feira'||ev.id==='comida')){r.citizens.push(City.makeCitizen(4,'vendorMarket',r.used,true));r.citizens.push(City.makeCitizen(5,'vendorFood',r.used,true));}
  if(mid===2&&City.eventActiveHere()&&(ev.id==='pesca'||ev.id==='feirinha'))r.citizens.push(City.makeCitizen(6,ev.id==='pesca'?'vendorFish':'vendorMarket',r.used,true));
  if(mid===11&&City.eventActiveHere()&&ev.id==='musica')r.citizens.push(City.makeCitizen(7,'musician',r.used,true));
  // Destinatário de uma entrega ativa.
  var jobs=City.state().jobs;for(i=0;i<jobs.length;i++)if(jobs[i].status==='active'&&jobs[i].type==='delivery'&&Number(jobs[i].targetMap)===mid){var rec=City.makeCitizen(900+i,'recipient',r.used,true);rec._cityData.jobId=jobs[i].id;r.citizens.push(rec);}
  // Resíduos e achados escondidos são persistentes durante o dia.
  var trashN=3+(hash(day(),mid,22)%3);if(ev.id==='mutirao')trashN+=3;
  for(i=0;i<trashN;i++){var key=day()+':'+mid+':trash:'+i;if(City.state().collected[key])continue;var tp=City.pickTile(mid*9000+day()*91+i*73,r.used);r.used.push(tp);r.spots.push({key:key,type:'trash',x:tp.x,y:tp.y,icon:210,label:'LIXO'});}
  var secretN=(ev.id==='lenda'&&h>=18)?3:1+(hash(day(),mid,29)%2);
  for(i=0;i<secretN;i++){var sk=day()+':'+mid+':secret:'+i;if(City.state().collected[sk])continue;var spc=City.pickTile(mid*9500+day()*97+i*79,r.used);r.used.push(spc);r.spots.push({key:sk,type:'secret',x:spc.x,y:spc.y,icon:190,label:'BRILHO'});}
  if(mid===11&&h>=13&&h<22){var fp=City.pickTile(mid*9700+day()*101+3,r.used);r.used.push(fp);r.spots.push({key:'football:'+day(),type:'football',x:fp.x,y:fp.y,icon:189,label:'FUTEBOL'});}
  // Bancos públicos: descanso curto e passagem de tempo.
  var benchN=(mid===11?2:(mid===8||mid===16?1:0));
  for(i=0;i<benchN;i++){var bp=City.pickTile(mid*10100+day()*37+i*41,r.used);r.used.push(bp);var bk=day()+':'+mid+':bench:'+i;r.spots.push({key:bk,type:'bench',x:bp.x,y:bp.y,hidden:true});r.decor.push({type:'bench',x:bp.x,y:bp.y,variant:i});}
  // Feiras e comida de rua mudam visualmente o mapa com barracas geradas por JS.
  if(City.eventActiveHere()&&['feira','comida','feirinha'].indexOf(ev.id)>=0){var stallCount=ev.id==='feira'?5:3;for(i=0;i<stallCount;i++){var stp=City.pickTile(mid*11100+day()*59+i*67,r.used);r.used.push(stp);r.decor.push({type:'stall',x:stp.x,y:stp.y,variant:i});}}
  if(City.eventActiveHere()&&ev.id==='musica'){var mp=City.pickTile(mid*11300+day()*61,r.used);r.used.push(mp);r.decor.push({type:'music',x:mp.x,y:mp.y,variant:0});}
  // Iluminação procedural: postes decorativos nas áreas transitáveis.
  for(i=0;i<p.lamps;i++){var lp=City.pickTile(mid*12000+i*97,r.used);r.used.push(lp);r.lamps.push({x:lp.x,y:lp.y});}
};

function Sprite_CitySpot(){this.initialize.apply(this,arguments);}
Sprite_CitySpot.prototype=Object.create(Sprite.prototype);Sprite_CitySpot.prototype.constructor=Sprite_CitySpot;
Sprite_CitySpot.prototype.initialize=function(data){Sprite.prototype.initialize.call(this);this._data=data;this.bitmap=new Bitmap(62,68);this.anchor.x=.5;this.anchor.y=1;this.z=3;this._drawn=false;this._bob=hash(data.x,data.y,3)%100;};
Sprite_CitySpot.prototype.redraw=function(){var b=this.bitmap;b.clear();var d=this._data,set=ImageManager.loadSystem('IconSet'),c=b._context;c.save();roundRect(c,7,5,48,48,14,d.type==='trash'?'rgba(80,69,51,.88)':d.type==='football'?'rgba(48,91,55,.90)':'rgba(81,59,106,.90)','rgba(255,255,255,.25)',1);c.restore();if(set&&set.isReady&&set.isReady()){var pw=Window_Base._iconWidth||32,ph=Window_Base._iconHeight||32,sx=(d.icon%16)*pw,sy=Math.floor(d.icon/16)*ph;b.blt(set,sx,sy,pw,ph,15,12,32,32);this._drawn=true;}text(b,d.label,2,51,58,14,'center',9,'#fff',true);};
Sprite_CitySpot.prototype.update=function(){Sprite.prototype.update.call(this);if(!this._drawn)this.redraw();var tw=$gameMap.tileWidth(),th=$gameMap.tileHeight();this.x=$gameMap.adjustX(this._data.x)*tw+tw/2;this.y=$gameMap.adjustY(this._data.y)*th+th+Math.sin((Graphics.frameCount+this._bob)/18)*3;this.visible=!City.state().collected[this._data.key];};

function Sprite_CityLamp(){this.initialize.apply(this,arguments);}
Sprite_CityLamp.prototype=Object.create(Sprite.prototype);Sprite_CityLamp.prototype.constructor=Sprite_CityLamp;
Sprite_CityLamp.prototype.initialize=function(data){Sprite.prototype.initialize.call(this);this._data=data;this.bitmap=new Bitmap(150,190);this.anchor.x=.5;this.anchor.y=1;this.z=2;this.redraw();};
Sprite_CityLamp.prototype.redraw=function(){var b=this.bitmap,c=b._context;c.clearRect(0,0,b.width,b.height);var night=(clock().hour>=18||clock().hour<6);if(night){var g=c.createRadialGradient(75,45,5,75,45,70);g.addColorStop(0,'rgba(255,224,132,.42)');g.addColorStop(.35,'rgba(255,211,102,.18)');g.addColorStop(1,'rgba(255,205,80,0)');c.fillStyle=g;c.fillRect(0,0,150,120);}c.fillStyle='rgba(31,34,31,.92)';c.fillRect(72,48,6,130);c.fillRect(58,48,34,5);c.fillStyle=night?'#f4ce69':'#6f7169';c.fillRect(63,51,24,12);b._setDirty&&b._setDirty();};
Sprite_CityLamp.prototype.update=function(){Sprite.prototype.update.call(this);var tw=$gameMap.tileWidth(),th=$gameMap.tileHeight();this.x=$gameMap.adjustX(this._data.x)*tw+tw/2;this.y=$gameMap.adjustY(this._data.y)*th+th;var nk=(clock().hour>=18||clock().hour<6);if(this._night!==nk){this._night=nk;this.redraw();}};

function Sprite_CityDecor(){this.initialize.apply(this,arguments);}
Sprite_CityDecor.prototype=Object.create(Sprite.prototype);Sprite_CityDecor.prototype.constructor=Sprite_CityDecor;
Sprite_CityDecor.prototype.initialize=function(data){Sprite.prototype.initialize.call(this);this._data=data;this.bitmap=new Bitmap(data.type==='stall'?110:90,data.type==='stall'?100:72);this.anchor.x=.5;this.anchor.y=1;this.z=2;this.redraw();};
Sprite_CityDecor.prototype.redraw=function(){var b=this.bitmap,c=b._context,d=this._data;c.clearRect(0,0,b.width,b.height);c.save();if(d.type==='bench'){c.fillStyle='#5b3b25';c.fillRect(14,34,62,10);c.fillRect(18,21,54,10);c.fillRect(20,43,6,23);c.fillRect(64,43,6,23);c.fillStyle='#8a5b31';c.fillRect(18,22,54,4);c.fillRect(14,35,62,4);}else if(d.type==='stall'){var cols=['#c96f4f','#d5a542','#548c7b','#7a69a5','#b45565'],col=cols[d.variant%cols.length];c.fillStyle='rgba(46,31,22,.9)';c.fillRect(15,49,80,35);c.fillStyle='#6c482e';c.fillRect(12,78,86,8);c.fillStyle=col;c.fillRect(8,18,94,24);for(var i=0;i<5;i++){c.fillStyle=i%2===0?'rgba(255,238,190,.9)':col;c.fillRect(8+i*19,18,19,24);}c.fillStyle='#e8cf91';c.fillRect(24,57,12,8);c.fillStyle='#8ebd67';c.fillRect(46,55,12,10);c.fillStyle='#d87950';c.fillRect(68,57,12,8);if(clock().hour>=18){var g=c.createRadialGradient(55,19,3,55,19,43);g.addColorStop(0,'rgba(255,221,120,.30)');g.addColorStop(1,'rgba(255,221,120,0)');c.fillStyle=g;c.fillRect(10,0,90,60);}}else if(d.type==='music'){c.fillStyle='rgba(42,31,25,.9)';c.fillRect(10,48,70,12);c.fillStyle='#b58b4d';c.fillRect(42,16,5,35);c.beginPath();c.arc(55,18,10,0,Math.PI*2);c.fillStyle='#d9bc70';c.fill();c.fillStyle='#efe3b3';c.font='bold 15px sans-serif';c.fillText('♪',29,31);c.fillText('♫',60,38);}c.restore();b._setDirty&&b._setDirty();};
Sprite_CityDecor.prototype.update=function(){Sprite.prototype.update.call(this);var tw=$gameMap.tileWidth(),th=$gameMap.tileHeight();this.x=$gameMap.adjustX(this._data.x)*tw+tw/2;this.y=$gameMap.adjustY(this._data.y)*th+th;};

City.attachRuntime=function(spriteset){
  if(!spriteset||!spriteset._tilemap)return;City.prepareRuntime();var r=City._runtime,i,s;
  for(i=0;i<r.citizens.length;i++){s=new Sprite_CamutangaCitizen(r.citizens[i]);spriteset._tilemap.addChild(s);r.sprites.push(s);}
  for(i=0;i<r.spots.length;i++){if(r.spots[i].hidden)continue;s=new Sprite_CitySpot(r.spots[i]);spriteset._tilemap.addChild(s);r.sprites.push(s);}
  for(i=0;i<r.decor.length;i++){s=new Sprite_CityDecor(r.decor[i]);spriteset._tilemap.addChild(s);r.sprites.push(s);}
  for(i=0;i<r.lamps.length;i++){s=new Sprite_CityLamp(r.lamps[i]);spriteset._tilemap.addChild(s);r.sprites.push(s);}
  City._needsRuntimeRebuild=false;
};
City.rebuildRuntime=function(){var sc=SceneManager._scene,ss=sc&&sc._spriteset;if(!ss||!ss._tilemap)return;var r=City._runtime;if(r&&r.sprites){for(var i=0;i<r.sprites.length;i++){var sp=r.sprites[i];if(sp&&sp.parent)sp.parent.removeChild(sp);}}City.attachRuntime(ss);};

// -----------------------------------------------------------------------------
// Diálogos, vendedores, lixo, segredos e interação
// -----------------------------------------------------------------------------
City.dialogue=function(ch){
  var d=ch._cityData||{},h=clock().hour,w=C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear',ev=City.todayEvent(),arr=[];
  if(w==='rain'||w==='storm')arr.push('Essa chuva mudou o ritmo da cidade hoje.','O rio deve estar diferente com esse tempo.');
  if(h<9)arr.push('Bom dia! A cidade ainda está acordando.','Cedo assim dá para resolver muita coisa.');
  else if(h>=18)arr.push('A noite chegou rápido hoje.','Gosto desse movimento do começo da noite.');
  if(ev.id==='feira')arr.push('A feira está movimentada. Vale a pena passar na praça.');
  if(ev.id==='futebol')arr.push('Hoje tem gente jogando bola na praça.');
  if(ev.id==='musica')arr.push('Mais tarde tem música na praça.');
  if(ev.id==='lenda')arr.push('Hoje o povo está falando de umas luzes estranhas...');
  if($gameMap&&$gameMap.mapId()===2)arr.push('A Rua Santa Cruz sempre tem alguém indo ou voltando das lojas.');
  if($gameMap&&$gameMap.mapId()===11)arr.push('A praça é o melhor lugar para saber o que está acontecendo na cidade.');
  if($gameMap&&$gameMap.mapId()===8)arr.push('Essa região fica bem diferente quando anoitece.');
  if($gameMap&&$gameMap.mapId()===16)arr.push('Na Vila todo mundo acaba sabendo das novidades.');
  arr.push('Se encontrar lixo na rua, pega. O pessoal anda valorizando quem ajuda.','Dá uma olhada no painel CIDADE. Sempre aparece algum serviço.','Tem coisa escondida pelos cantos que muita gente passa sem notar.','A pesca muda bastante com hora, lua e clima.','Ouvi dizer que melhorar as ferramentas economiza muita energia.');
  var prefix=City.level()>=3?'Ô, vizinho! ':'';return prefix+arr[hash(day()+h,d.id||1,17)%arr.length];
};
City.vendorItems=function(type){
  if(type==='market')return[46,48,50,52,108,110,112,114,66,67,68,69];
  if(type==='fish')return[42,55,132,133,134,142];
  return[91,92,95,56,130,131,93,94,145];
};
City.vendorTitle=function(type){return type==='market'?'Feirante':type==='fish'?'Banca de Pesca':'Comida de Rua';};
City.vendorPrice=function(it){var base=Math.max(8,Number(it&&it.price||20)),event=City.todayEvent(),mul=1-City.discount();if(event.id==='feira'||event.id==='comida')mul-=.07;return Math.max(5,Math.round(base*mul));};
City.openVendor=function(type){City._vendorType=type||'food';SceneManager.push(Scene_CamutangaCityVendor);};
City.buyVendorItem=function(it){
  if(!it)return false;var p=City.vendorPrice(it);if(gold()<p){SoundManager.playBuzzer();toast('Faltam Cruzeiros para comprar '+it.name+'.',100);return false;}spendGold(p);gain(it.id,1);City.state().vendorPurchases++;City.progress('shopping',1);playSE('Camutanga_CityCoin',65,110);toast('Comprou '+it.name+' por '+p+' Cruzeiros.',110);return true;
};
City.collectSpot=function(sp){
  if(!sp)return false;var persistent=(sp.type==='trash'||sp.type==='secret');if(persistent&&City.state().collected[sp.key])return false;if(persistent)City.state().collected[sp.key]=true;
  if(sp.type==='trash'){
    var reward=6+hash(day(),sp.x,sp.y)%13;if(City.todayEvent().id==='mutirao')reward*=2;giveGold(reward);City.state().trashTotal++;City.progress('cleanup',1);if(C.V3&&C.V3.gainSkill)C.V3.gainSkill('gathering',4);playSE('Camutanga_CityCoin',45,125);toast('Rua mais limpa! +'+reward+' Cruzeiros',80);return true;
  }
  if(sp.type==='secret'){
    var pool=[55,64,121,136,59,60],id=pool[hash(day(),sp.x,sp.y)%pool.length];gain(id,1);City.state().secretsTotal++;City.progress('secrets',1);City.addReputation(1,'achado devolvido/registrado');playSE('Camutanga_CitySparkle',55,115);toast('ACHADO: '+(item(id)?item(id).name:'objeto curioso'),120);return true;
  }
  if(sp.type==='bench'){var bk=sp.key,raw=clock().raw||0,last=Number(City.state().benchUse[bk]||-99999);if(raw-last<60){toast('Você já descansou aqui há pouco tempo.',70);return true;}City.state().benchUse[bk]=raw;var ls=C.state?C.state():null;if(ls&&ls.stamina!=null){ls.stamina=Math.min(ls.maxStamina||100,ls.stamina+16);}if($gameVariables)$gameVariables.setValue(3,Number($gameVariables.value(3)||0)+15);SoundManager.playRecovery();toast('Você descansou um pouco. +16 energia • 15 min passaram.',110);return true;}
  if(sp.type==='football'){City.openStreetGame();return true;}return false;
};
City.nearestCitizen=function(maxDist){
  var r=City._runtime;
  if(!r||!r.citizens||!$gamePlayer)return null;
  var best=null,bd=999;
  for(var i=0;i<r.citizens.length;i++){var ch=r.citizens[i],d=Math.abs(ch.x-$gamePlayer.x)+Math.abs(ch.y-$gamePlayer.y);if(d<=maxDist&&d<bd){best=ch;bd=d;}}
  return best;
};
City.spotNearPlayer=function(){
  var r=City._runtime;if(!r||!$gamePlayer)return null;var ft=C.frontTile?C.frontTile():{x:$gamePlayer.x,y:$gamePlayer.y};
  for(var i=0;i<r.spots.length;i++){var sp=r.spots[i];if(City.state().collected[sp.key])continue;var d1=Math.abs(sp.x-$gamePlayer.x)+Math.abs(sp.y-$gamePlayer.y),d2=Math.abs(sp.x-ft.x)+Math.abs(sp.y-ft.y);if(d1===0||d2===0)return sp;}return null;
};
City.talk=function(ch){
  if(!ch)return false;var d=ch._cityData||{},role=d.role||'morador';
  if(role==='agent'){ch.citySay('SERVIÇOS DA CIDADE',100);City.openTab();return true;}
  if(role==='taxi'){ch.citySay('PARA ONDE?',90);toast('Abra CIDADE e escolha um destino no MOTO-TÁXI.',150);City.openTab();return true;}
  if(role==='vendorFood'){ch.citySay('CHEGA MAIS!',90);City.openVendor('food');return true;}
  if(role==='vendorMarket'){ch.citySay('OLHA A FEIRA!',90);City.openVendor('market');return true;}
  if(role==='vendorFish'){ch.citySay('ISCA BOA!',90);City.openVendor('fish');return true;}
  if(role==='musician'){ch.citySay('♪ PRAÇA ANIMADA ♪',120);if(gold()>=10&&rand01(Graphics.frameCount+d.id)>.45){spendGold(10);City.addReputation(1,'apoio ao artista local');toast('Você deixou 10 Cruzeiros para o músico.',80);}else toast('A música deixa a praça mais viva.',100);return true;}
  if(role==='recipient'){
    var jobs=City.state().jobs;for(var i=0;i<jobs.length;i++)if(jobs[i].id===d.jobId&&jobs[i].status==='active'){ch.citySay('CHEGOU!',100);City.completeJob(jobs[i]);return true;}return true;
  }
  var key=day()+':'+($gameMap?$gameMap.mapId():0)+':'+d.id;if(!City.state().talked[key]){City.state().talked[key]=true;City.progress('social',1);if(Object.keys(City.state().talked).length%4===0)City.addReputation(1,'boa vizinhança');}
  var msg=City.dialogue(ch);ch.citySay(msg.length>18?msg.slice(0,17)+'…':msg,150);toast((d.name||'Morador')+': '+msg,170);
  if(City.level()>=4&&rand01(day()*99+d.id*7)<.035){var gifts=[55,64,56,66,68],gid=gifts[hash(day(),d.id,31)%gifts.length];gain(gid,1);toast((d.name||'Um morador')+' te deu '+item(gid).name+'.',140);}
  return true;
};
City.interact=function(){
  if(!cityMap($gameMap?$gameMap.mapId():0))return false;var sp=City.spotNearPlayer();if(sp)return City.collectSpot(sp);
  var ch=City.nearestCitizen(1.35);if(ch)return City.talk(ch);return false;
};

// -----------------------------------------------------------------------------
// Moto-táxi / deslocamento rápido
// -----------------------------------------------------------------------------
City.travelCost=function(dest){var base=dest.cost||30,discount=City.level()*2;return Math.max(10,base-discount);};
City.travel=function(dest){
  if(!dest||!$gamePlayer)return false;if(!$gameMap||(!cityMap($gameMap.mapId())&&$gameMap.mapId()!==5)){toast('O moto-táxi atende a área urbana e sua base.',110);return false;}
  var h=clock().hour;if(h<6||h>=23){toast('O moto-táxi funciona das 06h às 23h.',120);return false;}if($gameMap.mapId()===dest.mapId){toast('Você já está nessa região.',80);return false;}
  var cost=City.travelCost(dest);if(gold()<cost){toast('A corrida custa '+cost+' Cruzeiros.',100);SoundManager.playBuzzer();return false;}
  spendGold(cost);City.state().rides++;if($gameVariables)$gameVariables.setValue(3,Number($gameVariables.value(3)||0)+10);playSE('Camutanga_CityMoto',55,100);$gamePlayer.reserveTransfer(dest.mapId,dest.x,dest.y,2,0);SceneManager.pop();toast('Moto-táxi: '+dest.name+' • '+cost+' Cruzeiros',150);return true;
};

// -----------------------------------------------------------------------------
// Atualização do mundo urbano
// -----------------------------------------------------------------------------
City.updateRuntime=function(){
  var r=City._runtime;if(!r||!$gameMap||r.mapId!==$gameMap.mapId())return;
  for(var i=0;i<r.citizens.length;i++)r.citizens[i].update();
  if(Graphics.frameCount%8===0&&$gamePlayer){for(i=0;i<r.spots.length;i++){var sp=r.spots[i];if(!City.state().collected[sp.key]&&sp.type!=='football'&&sp.x===$gamePlayer.x&&sp.y===$gamePlayer.y){City.collectSpot(sp);break;}}}
  // Falas ambientes ocasionais próximas, sem interromper o jogador.
  if(Graphics.frameCount-r.lastAmbient>720&&r.citizens.length&&rand01(Graphics.frameCount+$gameMap.mapId())<.035){r.lastAmbient=Graphics.frameCount;var ch=r.citizens[hash(Graphics.frameCount,$gameMap.mapId(),4)%r.citizens.length];if(ch&&Math.abs(ch.x-$gamePlayer.x)+Math.abs(ch.y-$gamePlayer.y)<8&&['agent','taxi','recipient'].indexOf(ch._cityData.role)<0){var bits=['Bom dia!','Eita, calor!','Vai chover?','Bora pra praça?','Hoje tá movimentado.','Até mais!'];ch.citySay(bits[hash(Graphics.frameCount,ch._cityData.id,6)%bits.length],85);}}
  // Sinos da igreja ao meio-dia e 18h, uma vez por minuto-chave.
  var t=clock();if($gameMap.mapId()===8&&(t.hour===12||t.hour===18)&&t.minute<2){var key=day()+':'+t.hour;if(City._lastBell!==key){City._lastBell=key;playSE('Camutanga_CityBell',48,100);}}
};

var _Spriteset_Map_createCharacters=Spriteset_Map.prototype.createCharacters;
Spriteset_Map.prototype.createCharacters=function(){_Spriteset_Map_createCharacters.call(this);City.attachRuntime(this);};
var _Game_Map_setup=Game_Map.prototype.setup;
Game_Map.prototype.setup=function(mapId){_Game_Map_setup.call(this,mapId);City._runtime=null;};
var _Scene_Map_start=Scene_Map.prototype.start;
Scene_Map.prototype.start=function(){_Scene_Map_start.call(this);City.onEnterMap($gameMap.mapId());City.ensureMobileButton();var s=City.state();if(!s.firstCityTutorial&&cityMap($gameMap.mapId())){s.firstCityTutorial=true;toast('CIDADE VIVA: converse, recolha achados, aceite serviços e acompanhe os eventos no painel CIDADE.',300);}};
var _Scene_Map_update=Scene_Map.prototype.update;
Scene_Map.prototype.update=function(){_Scene_Map_update.call(this);City.onNewDay(false);if(City._needsRuntimeRebuild&&cityMap($gameMap?$gameMap.mapId():0))City.rebuildRuntime();City.updateRuntime();if(Input.isTriggered('cityMenu'))City.openTab();};

// Interação no botão A/Enter quando não há evento original na frente.
var _Game_Player_triggerButtonAction=Game_Player.prototype.triggerButtonAction;
Game_Player.prototype.triggerButtonAction=function(){
  if(Input.isTriggered('ok')&&cityMap($gameMap?$gameMap.mapId():0)){
    var ft=C.frontTile?C.frontTile():null,hasOriginal=ft&&$gameMap.eventsXy(ft.x,ft.y).some(function(e){return e&&e.isNormalPriority&&e.isNormalPriority();});
    if(!hasOriginal&&City.interact())return true;
  }
  return _Game_Player_triggerButtonAction.call(this);
};
if(C.lifeAction){var _lifeAction= C.lifeAction;C.lifeAction=function(){if(City.interact())return;return _lifeAction.apply(C,arguments);};}

// -----------------------------------------------------------------------------
// Tela de vendedor ambulante
// -----------------------------------------------------------------------------
function Scene_CamutangaCityVendor(){this.initialize.apply(this,arguments);}
Scene_CamutangaCityVendor.prototype=Object.create(Scene_Base.prototype);Scene_CamutangaCityVendor.prototype.constructor=Scene_CamutangaCityVendor;
Scene_CamutangaCityVendor.prototype.initialize=function(){Scene_Base.prototype.initialize.call(this);this._selected=0;this._hits=[];this._type=City._vendorType||'food';};
Scene_CamutangaCityVendor.prototype.create=function(){Scene_Base.prototype.create.call(this);this._bg=new Sprite(SceneManager.backgroundBitmap());this._bg.opacity=150;this.addChild(this._bg);this._ui=new Sprite(new Bitmap(Graphics.boxWidth,Graphics.boxHeight));this.addChild(this._ui);this.refresh();};
Scene_CamutangaCityVendor.prototype.items=function(){return City.vendorItems(this._type).map(function(id){return item(id);}).filter(Boolean);};
Scene_CamutangaCityVendor.prototype.refresh=function(){
  var b=this._ui.bitmap;b.clear();this._hits=[];var W=Graphics.boxWidth,H=Graphics.boxHeight,c=b._context;c.save();c.fillStyle='rgba(9,15,13,.78)';c.fillRect(0,0,W,H);c.restore();
  text(b,City.vendorTitle(this._type).toUpperCase(),40,34,W-80,42,'center',30,'#f0d887',true);text(b,'Reputação reduz os preços dos vendedores de rua.',40,82,W-80,24,'center',13,'#c7d0c9');
  var arr=this.items(),cols=4,gap=18,x=42,y=140,w=Math.floor((W-84-gap*(cols-1))/cols),h=170;
  for(var i=0;i<arr.length;i++){var it=arr[i],row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap);if(yy+h>H-68)break;drawCard(b,xx,yy,w,h,i===this._selected);var set=ImageManager.loadSystem('IconSet');if(set&&set.isReady&&set.isReady()){var pw=32,ph=32,sx=(it.iconIndex%16)*pw,sy=Math.floor(it.iconIndex/16)*ph;b.blt(set,sx,sy,pw,ph,xx+18,yy+22,48,48);}text(b,it.name,xx+78,yy+24,w-96,24,'left',16,'#f5f0df',true);var p=City.vendorPrice(it);text(b,p+' Cruzeiros',xx+78,yy+54,w-96,20,'left',13,gold()>=p?'#efd16f':'#db8275',true);para(b,it.description||'Produto local.',xx+18,yy+88,w-36,20,2,'#c8d2cb',12);text(b,'COMPRAR',xx+16,yy+h-33,w-32,20,'center',11,'#9fd394',true);this._hits.push({index:i,rect:{x:xx,y:yy,w:w,h:h}});}
  text(b,'ESC / X para voltar • Toque no produto para comprar',40,H-44,W-80,22,'center',12,'#a9b4ad');
};
Scene_CamutangaCityVendor.prototype.update=function(){Scene_Base.prototype.update.call(this);if(Input.isTriggered('cancel')){SoundManager.playCancel();SceneManager.pop();return;}var arr=this.items();if(Input.isRepeated('left'))this._selected=(this._selected+arr.length-1)%arr.length;if(Input.isRepeated('right'))this._selected=(this._selected+1)%arr.length;if(Input.isRepeated('up'))this._selected=(this._selected+arr.length-4)%arr.length;if(Input.isRepeated('down'))this._selected=(this._selected+4)%arr.length;if(Input.isTriggered('ok')){City.buyVendorItem(arr[this._selected]);this.refresh();}if(TouchInput.isTriggered()){var x=TouchInput.x,y=TouchInput.y;for(var i=0;i<this._hits.length;i++){var r=this._hits[i].rect;if(x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h){this._selected=this._hits[i].index;City.buyVendorItem(arr[this._selected]);this.refresh();break;}}}};
window.Scene_CamutangaCityVendor=Scene_CamutangaCityVendor;

// -----------------------------------------------------------------------------
// Minigame: embaixadinha/desafio de tempo na praça
// -----------------------------------------------------------------------------
City.openStreetGame=function(){SceneManager.push(Scene_CamutangaStreetGame);};
function Scene_CamutangaStreetGame(){this.initialize.apply(this,arguments);}
Scene_CamutangaStreetGame.prototype=Object.create(Scene_Base.prototype);Scene_CamutangaStreetGame.prototype.constructor=Scene_CamutangaStreetGame;
Scene_CamutangaStreetGame.prototype.initialize=function(){Scene_Base.prototype.initialize.call(this);this._round=0;this._score=0;this._pos=.08;this._dir=1;this._target=.25+rand01(day()*53+7)*.5;this._done=false;this._wait=0;};
Scene_CamutangaStreetGame.prototype.create=function(){Scene_Base.prototype.create.call(this);this._bg=new Sprite(SceneManager.backgroundBitmap());this._bg.opacity=145;this.addChild(this._bg);this._ui=new Sprite(new Bitmap(Graphics.boxWidth,Graphics.boxHeight));this.addChild(this._ui);playSE('Camutanga_CityWhistle',62,105);this.refresh();};
Scene_CamutangaStreetGame.prototype.refresh=function(){
  var b=this._ui.bitmap;b.clear();var W=Graphics.boxWidth,H=Graphics.boxHeight,c=b._context;c.save();c.fillStyle='rgba(8,14,11,.72)';c.fillRect(0,0,W,H);c.restore();text(b,'EMBAIXADINHA NA PRAÇA',30,70,W-60,44,'center',32,'#f0d887',true);text(b,this._done?'RESULTADO':'Aperte A / ENTER ou toque quando o marcador estiver na faixa verde.',30,126,W-60,28,'center',15,'#d4ddd7');
  var x=160,y=270,w=W-320,h=52;c=b._context;c.save();roundRect(c,x,y,w,h,25,'rgba(12,20,17,.95)','rgba(255,255,255,.18)',2);var tz=x+this._target*w-w*.09;roundRect(c,tz,y+6,w*.18,h-12,19,'rgba(76,151,75,.88)','rgba(180,241,151,.8)',1);c.fillStyle='#f0d166';c.fillRect(x+this._pos*w-5,y-15,10,h+30);c.restore();b._setDirty&&b._setDirty();
  text(b,'Rodada '+Math.min(5,this._round+1)+' / 5',x,y+86,w/2,26,'left',17,'#f4e7bf',true);text(b,'Pontos '+this._score,x+w/2,y+86,w/2,26,'right',17,'#f4e7bf',true);
  if(this._done){var reward=Math.max(12,Math.floor(this._score*.42));text(b,'PLACAR: '+this._score,x,y+152,w,38,'center',28,'#fff',true);text(b,'Toque ou aperte ENTER para voltar.',x,y+206,w,24,'center',13,'#b9c4bd');text(b,'Primeira partida do dia rende recompensa completa.',x,y+236,w,22,'center',11,'#8f9b94');}
};
Scene_CamutangaStreetGame.prototype.hit=function(){if(this._done){SceneManager.pop();return;}var dist=Math.abs(this._pos-this._target),pts=Math.max(0,Math.round(100-dist*240));if(dist<.09)pts+=35;this._score+=pts;this._round++;playSE(dist<.09?'Camutanga_CityCheer':'Camutanga_CityKick',dist<.09?60:50,dist<.09?112:100);if(this._round>=5){this.finish();return;}this._target=.22+rand01(day()*71+this._round*33+Graphics.frameCount)*.56;this._pos=.05;this._dir=1;this.refresh();};
Scene_CamutangaStreetGame.prototype.finish=function(){this._done=true;var s=City.state(),full=s.streetGameDay!==day(),reward=Math.max(10,Math.floor(this._score*(full?0.42:0.10)));if(full){s.streetGameDay=day();City.addReputation(this._score>=450?4:this._score>=330?3:2,'atividade da praça');}giveGold(reward);toast('Embaixadinha: '+this._score+' pontos • +'+reward+' Cruzeiros',170);this.refresh();};
Scene_CamutangaStreetGame.prototype.update=function(){Scene_Base.prototype.update.call(this);if(Input.isTriggered('cancel')){SceneManager.pop();return;}if(!this._done){this._pos+=.014*this._dir;if(this._pos>=.99){this._pos=.99;this._dir=-1;}if(this._pos<=.01){this._pos=.01;this._dir=1;}if(Graphics.frameCount%2===0)this.refresh();}if(Input.isTriggered('ok')||TouchInput.isTriggered())this.hit();};
window.Scene_CamutangaStreetGame=Scene_CamutangaStreetGame;

// -----------------------------------------------------------------------------
// Painel CIDADE dentro da interface v2.6/v3
// -----------------------------------------------------------------------------
City.ensureTab=function(){if(!C.UI26||!C.UI26.tabs)return;var found=false;for(var i=0;i<C.UI26.tabs.length;i++)if(C.UI26.tabs[i].id==='city')found=true;if(!found)C.UI26.tabs.push({id:'city',label:'CIDADE'});};
City.ensureTab();
City.openTab=function(){
  City.ensureTab();var S=window.Scene_CamutangaInventory26;if(!S)return;SceneManager.push(S);setTimeout(function(){var sc=SceneManager._scene;if(sc&&sc instanceof S){for(var i=0;i<C.UI26.tabs.length;i++)if(C.UI26.tabs[i].id==='city'){sc._tab=i;sc._selected=0;sc._needsRefresh=true;break;}}},0);
};
City.citySummary=function(){var s=City.state(),lev=City.level(),next=City.LEVELS[Math.min(lev+1,City.LEVELS.length-1)];return{s:s,lev:lev,next:next};};
City.dailyGift=function(){var s=City.state();if(City.level()<2){toast('O presente diário libera no nível Vizinho.',100);return false;}if(s.dailyGiftDay===day()){toast('Você já pegou o mimo de hoje.',80);return false;}s.dailyGiftDay=day();var pool=[56,64,66,68,55,42,130],id=pool[hash(day(),s.reputation,44)%pool.length];gain(id,1);City.addReputation(1,'presença na cidade');playSE('Camutanga_CityCoin',55,120);toast('Mimo de hoje: '+item(id).name,140);return true;};

if(window.Scene_CamutangaInventory26){
  var P=Scene_CamutangaInventory26.prototype,_refresh=P.refresh,_build=P.buildData,_touch=P.handleTouch,_activate=P.activateSelected;
  P.buildData=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='city'){City.onNewDay(false);this._data=City.state().jobs.slice();return;}_build.call(this);};
  P.refresh=function(){
    var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab!=='city')return _refresh.call(this);
    var b=this._ui.bitmap;if(b.width!==Graphics.boxWidth||b.height!==Graphics.boxHeight){this._ui.bitmap=b=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._background.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);}b.clear();this._hits=[];this.drawBackground();this.buildData();this.drawHeader();this.drawTabs();this.drawCityAlive();
  };
  P.drawCityAlive=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight,s=City.state(),lev=City.level(),ev=City.todayEvent(),x=28,y=142,gap=14;
    // Bloco de reputação.
    var a={x:x,y:y,w:Math.floor(W*.29),h:138};drawCard(b,a.x,a.y,a.w,a.h,false);text(b,'CAMUTANGA VIVA',a.x+16,a.y+14,a.w-32,24,'center',18,'#f2dda1',true);text(b,City.levelName(),a.x+18,a.y+47,a.w-36,28,'center',19,'#fff',true);var lo=City.LEVELS[lev]||0,hi=City.LEVELS[Math.min(lev+1,City.LEVELS.length-1)]||lo,rate=hi===lo?1:(s.reputation-lo)/(hi-lo);drawGauge(b,a.x+28,a.y+84,a.w-56,15,rate);text(b,s.reputation+' reputação • desconto '+Math.round(City.discount()*100)+'%',a.x+14,a.y+106,a.w-28,18,'center',11,'#c8d3cc');
    // Boletim.
    var bx=a.x+a.w+gap,bw=Math.floor(W*.39),bb={x:bx,y:y,w:bw,h:138};drawCard(b,bb.x,bb.y,bb.w,bb.h,false);text(b,'BOLETIM DE HOJE',bb.x+16,bb.y+14,bb.w-32,22,'center',16,'#f2dda1',true);text(b,ev.name,bb.x+18,bb.y+44,bb.w-36,25,'center',18,'#efd16f',true);para(b,ev.desc,bb.x+24,bb.y+76,bb.w-48,20,2,'#ced7d1',12);var forecast=C.V3&&C.V3.forecast?C.V3.forecast(1):'—';text(b,'Amanhã: '+forecast,bb.x+18,bb.y+112,bb.w-36,18,'center',10,'#9fb4a9');
    // Estatísticas urbanas.
    var cx=bb.x+bb.w+gap,cw=W-cx-28,cc={x:cx,y:y,w:cw,h:138};drawCard(b,cc.x,cc.y,cc.w,cc.h,false);text(b,'VIDA NA CIDADE',cc.x+14,cc.y+14,cc.w-28,22,'center',15,'#f2dda1',true);text(b,'Serviços '+s.jobsDone,cc.x+18,cc.y+48,cc.w-36,19,'left',12,'#d5ddd8');text(b,'Limpezas '+s.trashTotal,cc.x+18,cc.y+72,cc.w-36,19,'left',12,'#d5ddd8');text(b,'Achados '+s.secretsTotal,cc.x+18,cc.y+96,cc.w-36,19,'left',12,'#d5ddd8');text(b,'Corridas '+s.rides,cc.x+Math.floor(cc.w*.52),cc.y+48,cc.w*.43,19,'left',12,'#d5ddd8');text(b,'Moradores hoje '+Object.keys(s.talked).length,cc.x+Math.floor(cc.w*.52),cc.y+72,cc.w*.43,19,'left',12,'#d5ddd8');
    // Serviços do dia: quatro cartões.
    var jy=y+154,jw=Math.floor((W-56-gap*3)/4),jh=146;for(var i=0;i<this._data.length;i++){var j=this._data[i],xx=28+i*(jw+gap),sel=i===this._selected;drawCard(b,xx,jy,jw,jh,sel);text(b,j.title,xx+14,jy+12,jw-28,21,'center',14,j.status==='done'?'#8fd291':'#f2dda1',true);para(b,j.desc,xx+16,jy+39,jw-32,18,3,'#cbd5cf',10);var st=j.status==='offered'?'ACEITAR':j.status==='done'?'CONCLUÍDO':j.type==='resource'?'ENTREGAR':'EM ANDAMENTO';var prog=j.status==='active'?' • '+(j.progress||0)+'/'+j.target:'';text(b,st+prog,xx+12,jy+100,jw-24,18,'center',10,j.status==='done'?'#8fd291':'#efd16f',true);text(b,'+'+j.reward+' ¤  •  +'+j.rep+' REP',xx+12,jy+122,jw-24,16,'center',9,'#aebbb2');this._hits.push({kind:'cityJob',index:i,rect:{x:xx,y:jy,w:jw,h:jh}});}
    // Faixa inferior: moto-táxi + atividades.
    var by=jy+jh+14;drawCard(b,28,by,W-56,H-by-28,false);text(b,'MOTO-TÁXI',44,by+12,112,20,'left',13,'#f2dda1',true);var tx=164,tw=112;for(var d=0;d<City.TRAVEL.length;d++){var dest=City.TRAVEL[d],r={x:tx+d*(tw+7),y:by+8,w:tw,h:39};if(r.x+r.w>W-28)break;var ccost=City.travelCost(dest);roundRect(b._context,r.x,r.y,r.w,r.h,10,'rgba(46,57,50,.94)','rgba(255,255,255,.11)',1);b._setDirty&&b._setDirty();text(b,dest.name,r.x+5,r.y+5,r.w-10,15,'center',9,'#e8eee9',true);text(b,ccost+' ¤',r.x+5,r.y+20,r.w-10,13,'center',8,'#efd16f');this._hits.push({kind:'cityTravel',dest:d,rect:r});}
    var gy=by+55;var buttons=[{kind:'cityGift',label:'MIMO DO DIA',desc:City.level()>=2?(s.dailyGiftDay===day()?'JÁ PEGO':'PEGAR'):'NÍVEL VIZINHO'},{kind:'cityGame',label:'EMBAIXADINHA',desc:'MINIGAME DA PRAÇA'},{kind:'cityVendor',label:'COMIDA DE RUA',desc:'LANCHES E CAFÉ'}];
    for(var q=0;q<buttons.length;q++){var bw2=Math.floor((W-84)/3),rx=28+q*(bw2+14),rr={x:rx,y:gy,w:bw2,h:42};roundRect(b._context,rr.x,rr.y,rr.w,rr.h,11,'rgba(53,69,58,.94)','rgba(229,205,117,.35)',1);b._setDirty&&b._setDirty();text(b,buttons[q].label,rr.x+10,rr.y+5,rr.w-20,16,'center',10,'#f3dda0',true);text(b,buttons[q].desc,rr.x+10,rr.y+21,rr.w-20,13,'center',8,'#b9c5bd');this._hits.push({kind:buttons[q].kind,rect:rr});}
  };
  P.handleTouch=function(x,y){
    var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='city'){
      for(var i=this._hits.length-1;i>=0;i--){var h=this._hits[i],r=h.rect;if(!r||x<r.x||y<r.y||x>=r.x+r.w||y>=r.y+r.h)continue;
        if(h.kind==='cityJob'){this._selected=h.index;City.handleJobClick(this._data[h.index]);this._needsRefresh=true;return;}
        if(h.kind==='cityTravel'){City.travel(City.TRAVEL[h.dest]);return;}
        if(h.kind==='cityGift'){City.dailyGift();this._needsRefresh=true;return;}
        if(h.kind==='cityGame'){SceneManager.push(Scene_CamutangaStreetGame);return;}
        if(h.kind==='cityVendor'){City.openVendor('food');return;}
      }
    }
    return _touch.call(this,x,y);
  };
  P.activateSelected=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='city'){City.handleJobClick(this._data[this._selected]);this._needsRefresh=true;return;}return _activate.call(this);};
}
City.handleJobClick=function(j){if(!j)return;if(j.status==='offered'){City.acceptJob(j);return;}if(j.status==='active'&&j.type==='resource'){City.tryResourceJob(j);return;}if(j.status==='active'){toast('Progresso: '+(j.progress||0)+' / '+j.target+' • '+j.title,100);return;}toast('Esse serviço já foi concluído.',70);};

// -----------------------------------------------------------------------------
// Botão CIDADE no celular
// -----------------------------------------------------------------------------
City.ensureMobileButton=function(){
  if(!isTouch())return;var root=document.getElementById('camutanga-mobile-ui');if(!root)return;if(document.getElementById('camutanga-city-btn'))return;
  var b=document.createElement('button');b.id='camutanga-city-btn';b.type='button';b.textContent='CIDADE';b.setAttribute('aria-label','Abrir painel da cidade');b.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();if(SceneManager._scene instanceof Scene_Map)City.openTab();},{passive:false});root.appendChild(b);
};
function injectCss(){if(document.getElementById('camutanga-city-css'))return;var s=document.createElement('style');s.id='camutanga-city-css';s.textContent='#camutanga-city-btn{position:fixed;top:84px;right:142px;height:40px;min-width:76px;border:1px solid rgba(255,235,170,.35);border-radius:12px;background:rgba(18,31,24,.72);color:#f4df9d;font:700 11px GameFont,Arial,sans-serif;pointer-events:auto;opacity:.74;z-index:100003;box-shadow:0 3px 12px rgba(0,0,0,.25)}#camutanga-city-btn:active{transform:scale(.94);opacity:1}body.camutanga-ui-open #camutanga-city-btn{display:none!important}@media (pointer:fine) and (min-width:901px){#camutanga-city-btn{display:none!important}}';document.head.appendChild(s);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){injectCss();setTimeout(City.ensureMobileButton,200);});else{injectCss();setTimeout(City.ensureMobileButton,200);}

})();

/*:
 * @plugindesc [v3.5] Vida Social - nome do jogador, moradores persistentes, amizade, diálogos vivos e acontecimentos aleatórios.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * V3.5 adiciona uma camada social sobre CamutangaCidadeViva.
 *
 * - Na primeira entrada do save, o jogador escolhe o próprio nome.
 * - F7 abre novamente a edição do nome.
 * - Moradores gerados mantêm nomes e personalidades estáveis.
 * - Conversas reagem a hora, clima, mapa, amizade e acontecimentos.
 * - Dois acontecimentos urbanos aleatórios são programados por dia.
 * - Eventos podem gerar frutas, caixas, carteira, ervas, luzes estranhas,
 *   descontos, bônus de pesca, charrete barato e bônus de vizinhança.
 *
 * Tudo é salvo no save normal do RPG Maker MV.
 */
(function(){
'use strict';

window.Camutanga=window.Camutanga||{};
var C=window.Camutanga;
var City=C.City;
if(!City){return;}
var S=C.Social35=C.Social35||{};
S.VERSION='3.5.0';

Input.keyMapper[118]='camutangaRename'; // F7

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function day(){return C.dayKey?C.dayKey():0;}
function clock(){return C.gameClock?C.gameClock():{day:1,hour:10,minute:0,raw:0};}
function weather(){return C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear';}
function mapId(){return $gameMap?$gameMap.mapId():0;}
function toast(t,f){if(C.toast)C.toast(t,f||150);}
function item(id){return window.$dataItems?$dataItems[Number(id||0)]:null;}
function gain(id,n){var it=item(id);if(it&&$gameParty)$gameParty.gainItem(it,n||1);}
function giveGold(n){if($gameParty)$gameParty.gainGold(Math.max(0,Math.floor(n||0)));}
function playSE(name,vol,pitch){try{AudioManager.playSe({name:name,volume:vol||65,pitch:pitch||100,pan:0});}catch(e){}}
function hash(a,b,c){var x=Math.sin((Number(a||0)+1)*12.9898+(Number(b||0)+3)*78.233+(Number(c||0)+7)*37.719)*43758.5453123;return Math.abs(Math.floor((x-Math.floor(x))*1000000));}
function choose(arr,seed){return arr.length?arr[hash(seed,arr.length,17)%arr.length]:'';}
function actor(){try{return $gameActors&&$gameActors.actor(1)?$gameActors.actor(1):($gameParty?$gameParty.leader():null);}catch(e){return null;}}
function playerName(){var a=actor();return a&&a.name?a.name():'Jhon';}
function ordinaryRole(role){return ['agent','taxi','vendorFood','vendorMarket','vendorFish','recipient','musician','eventNpc'].indexOf(role)<0;}

S.defaultState=function(){return{
  version:S.VERSION,nameChosen:false,friendship:{},talkedToday:{},giftToday:{},
  lastDay:-1,dailyEvents:[],eventNotice:{},eventDone:{},conversations:0,
  randomEventsDone:0,kindness:0,lastChoiceDay:-1,lastChoiceNpc:'',
  totalGifts:0,totalFinds:0
};};
S.state=function(){
  if(!$gameSystem)return S.defaultState();
  if(!$gameSystem._camutangaSocial35)$gameSystem._camutangaSocial35=S.defaultState();
  var st=$gameSystem._camutangaSocial35,d=S.defaultState(),k;
  for(k in d)if(st[k]==null)st[k]=d[k];
  if(!st.friendship)st.friendship={};if(!st.talkedToday)st.talkedToday={};if(!st.giftToday)st.giftToday={};
  if(!st.eventNotice)st.eventNotice={};if(!st.eventDone)st.eventDone={};if(!Array.isArray(st.dailyEvents))st.dailyEvents=[];
  return st;
};
S.onNewDay=function(force){
  var st=S.state(),dk=day();if(!force&&st.lastDay===dk)return;
  st.lastDay=dk;st.talkedToday={};st.giftToday={};st.eventNotice={};st.dailyEvents=S.buildDailyEvents(dk);
};

// ---------------------------------------------------------------------------
// Nome do jogador - overlay HTML amigável para teclado e celular
// ---------------------------------------------------------------------------
S._nameOpen=false;
S.cleanName=function(v){
  v=String(v||'').replace(/[<>\\/\r\n\t]/g,' ').replace(/\s+/g,' ').trim();
  if(v.length>16)v=v.slice(0,16);return v;
};
S.applyName=function(v){
  var name=S.cleanName(v)||'Jhon',a=actor();if(a&&a.setName)a.setName(name);
  var st=S.state();st.nameChosen=true;st.playerName=name;
  toast('Bem-vindo a Camutanga, '+name+'!',220);playSE('Camutanga_CityBell',34,118);
  return name;
};
S.removeNameOverlay=function(){
  var el=document.getElementById('camutanga-name-overlay');if(el&&el.parentNode)el.parentNode.removeChild(el);S._nameOpen=false;
  try{Input.clear();TouchInput.clear();}catch(e){}
};
S.openNameOverlay=function(rename){
  if(S._nameOpen||!document||!document.body)return;S._nameOpen=true;
  var current=playerName(),wrap=document.createElement('div');wrap.id='camutanga-name-overlay';
  wrap.innerHTML=''
    +'<div class="camutanga-name-card">'
    +'<div class="camutanga-name-kicker">SEU PERSONAGEM</div>'
    +'<div class="camutanga-name-title">Como querem te chamar em Camutanga?</div>'
    +'<div class="camutanga-name-sub">Esse nome aparece no HUD e nas conversas com os moradores.</div>'
    +'<input id="camutanga-name-input" maxlength="16" autocomplete="off" spellcheck="false" aria-label="Nome do personagem">'
    +'<div class="camutanga-name-count" id="camutanga-name-count">0/16</div>'
    +'<div class="camutanga-name-buttons">'
    +'<button id="camutanga-name-confirm">CONFIRMAR</button>'
    +(rename?'<button id="camutanga-name-cancel" class="secondary">CANCELAR</button>':'<button id="camutanga-name-default" class="secondary">USAR JHON</button>')
    +'</div></div>';
  document.body.appendChild(wrap);
  var input=document.getElementById('camutanga-name-input'),count=document.getElementById('camutanga-name-count');input.value=current==='JHON'?'':current;count.textContent=input.value.length+'/16';
  function done(v){S.applyName(v);S.removeNameOverlay();}
  input.addEventListener('input',function(){var c=S.cleanName(input.value);if(c!==input.value)input.value=c;count.textContent=input.value.length+'/16';});
  input.addEventListener('keydown',function(e){e.stopPropagation();if(e.key==='Enter'){e.preventDefault();done(input.value);}else if(e.key==='Escape'&&rename){e.preventDefault();S.removeNameOverlay();}});
  document.getElementById('camutanga-name-confirm').addEventListener('click',function(e){e.preventDefault();done(input.value);});
  var cbtn=document.getElementById(rename?'camutanga-name-cancel':'camutanga-name-default');if(cbtn)cbtn.addEventListener('click',function(e){e.preventDefault();if(rename)S.removeNameOverlay();else done('Jhon');});
  setTimeout(function(){try{input.focus();input.select();}catch(e){}},80);
};
S.ensureName=function(){var st=S.state();if(!st.nameChosen)setTimeout(function(){if(SceneManager._scene instanceof Scene_Map&&!S._nameOpen)S.openNameOverlay(false);},350);};

function injectCss(){
  if(document.getElementById('camutanga-social35-css'))return;var css=document.createElement('style');css.id='camutanga-social35-css';css.textContent=''
  +'#camutanga-name-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at 50% 30%,rgba(72,100,61,.42),rgba(8,12,10,.90));backdrop-filter:blur(7px);font-family:GameFont,Arial,sans-serif;pointer-events:auto}'
  +'.camutanga-name-card{width:min(620px,92vw);padding:28px;border-radius:24px;background:linear-gradient(145deg,rgba(22,31,26,.98),rgba(39,45,31,.98));border:1px solid rgba(244,217,130,.42);box-shadow:0 28px 80px rgba(0,0,0,.55);text-align:center;color:#fff}'
  +'.camutanga-name-kicker{font-size:12px;letter-spacing:3px;color:#e9c96f}.camutanga-name-title{font-size:clamp(22px,4vw,34px);font-weight:800;margin:10px 0}.camutanga-name-sub{font-size:14px;color:#bdc8c0;line-height:1.45;margin-bottom:20px}'
  +'#camutanga-name-input{box-sizing:border-box;width:100%;height:62px;border-radius:16px;border:2px solid rgba(246,217,122,.58);background:rgba(8,13,10,.82);color:#fff;font:700 27px GameFont,Arial,sans-serif;text-align:center;outline:none;padding:0 18px;box-shadow:inset 0 0 0 2px rgba(255,255,255,.025)}'
  +'#camutanga-name-input:focus{border-color:#f3d66f;box-shadow:0 0 0 4px rgba(243,214,111,.12)}.camutanga-name-count{height:24px;padding-top:6px;color:#87958c;font-size:11px;text-align:right}'
  +'.camutanga-name-buttons{display:flex;gap:12px;margin-top:10px}.camutanga-name-buttons button{flex:1;min-height:50px;border:0;border-radius:14px;background:#d7b84d;color:#17130d;font:800 14px GameFont,Arial,sans-serif;cursor:pointer}.camutanga-name-buttons button.secondary{background:rgba(255,255,255,.08);color:#dbe2dd;border:1px solid rgba(255,255,255,.13)}'
  +'#camutanga-dialogue35{position:fixed;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147482500;width:min(820px,92vw);box-sizing:border-box;border-radius:18px;background:linear-gradient(135deg,rgba(14,22,18,.96),rgba(42,48,32,.96));border:1px solid rgba(238,207,112,.35);box-shadow:0 14px 46px rgba(0,0,0,.46);padding:16px 20px 17px;color:#fff;font-family:GameFont,Arial,sans-serif;pointer-events:none;opacity:0;transition:opacity .18s ease,transform .18s ease}'
  +'#camutanga-dialogue35.show{opacity:1;transform:translateX(-50%) translateY(-5px)}#camutanga-dialogue35 .npc{color:#f0cf72;font-weight:800;font-size:14px;margin-bottom:7px}#camutanga-dialogue35 .line{font-size:15px;line-height:1.45;color:#f5f5ec}#camutanga-dialogue35 .friend{float:right;color:#e7b7b5;font-size:12px}'
  +'#camutanga-event35{position:fixed;left:50%;top:90px;transform:translate(-50%,-12px);z-index:2147482400;width:min(660px,88vw);box-sizing:border-box;padding:12px 18px;border-radius:14px;background:rgba(55,45,24,.94);border:1px solid rgba(247,215,113,.46);box-shadow:0 9px 32px rgba(0,0,0,.38);color:#fff;font-family:GameFont,Arial,sans-serif;text-align:center;pointer-events:none;opacity:0;transition:.2s}#camutanga-event35.show{opacity:1;transform:translate(-50%,0)}#camutanga-event35 b{color:#f2d36f}'
  +'#camutanga-social-choice{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:flex-end;justify-content:center;padding:0 16px max(28px,env(safe-area-inset-bottom));background:rgba(0,0,0,.28);font-family:GameFont,Arial,sans-serif;pointer-events:auto}.social-choice-card{width:min(720px,96vw);padding:18px;border-radius:20px;background:rgba(18,27,22,.98);border:1px solid rgba(241,214,126,.4);box-shadow:0 20px 60px rgba(0,0,0,.55);color:#fff}.social-choice-title{font-weight:800;color:#efd173;margin-bottom:10px}.social-choice-card button{display:block;width:100%;min-height:47px;margin-top:8px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:#fff;font:700 13px GameFont,Arial,sans-serif;text-align:left;padding:0 14px}'
  +'@media(max-width:760px){#camutanga-dialogue35{bottom:118px;padding:13px 16px}#camutanga-event35{top:76px}.camutanga-name-card{padding:20px}.camutanga-name-buttons{flex-direction:column}}';document.head.appendChild(css);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectCss);else injectCss();

S.dialogueCard=function(name,line,points){
  var el=document.getElementById('camutanga-dialogue35');if(!el){el=document.createElement('div');el.id='camutanga-dialogue35';document.body.appendChild(el);}var hearts=S.friendshipLevel(points||0);
  el.innerHTML='<div class="npc">'+escapeHtml(name)+'<span class="friend">'+(hearts>0?('♥ '.repeat(hearts)):'Conhecendo você')+'</span></div><div class="line">'+escapeHtml(line)+'</div>';
  el.classList.add('show');clearTimeout(S._dialogTimer);S._dialogTimer=setTimeout(function(){el.classList.remove('show');},4800);
};
S.eventBanner=function(title,textv){
  var el=document.getElementById('camutanga-event35');if(!el){el=document.createElement('div');el.id='camutanga-event35';document.body.appendChild(el);}el.innerHTML='<b>'+escapeHtml(title)+'</b> • '+escapeHtml(textv);el.classList.add('show');clearTimeout(S._eventTimer);S._eventTimer=setTimeout(function(){el.classList.remove('show');},5200);
};
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

// ---------------------------------------------------------------------------
// Moradores persistentes e amizade
// ---------------------------------------------------------------------------
S.NAMES=['Ana','Beto','Carla','Damião','Eliane','Fábio','Graça','Hugo','Iara','João','Lúcia','Márcio','Nina','Otávio','Rita','Sérgio','Tânia','Val','Zeca','Cida','Naldo','Bia','Rômulo','Lena','Marlene','Severino','Dona Lú','Chico','Nena','Dudu','Lia','Raul','Socorro','Naná','Breno','Jéssica','Edmilson','Rosa','Paulo','Mônica','Gil','Júnior','Dora','Caio','Célia','Léo','Marta','Neto'];
S.PERSONALITIES=['calmo','falante','curioso','trabalhador','brincalhão','reservado'];
S.citizenKey=function(d){return String(d.mapId||mapId())+':'+String(d.id||0)+':'+String(d.name||'morador');};
S.friendship=function(d){return Number(S.state().friendship[S.citizenKey(d)]||0);};
S.addFriendship=function(d,n){if(!d)return 0;var st=S.state(),k=S.citizenKey(d),old=Number(st.friendship[k]||0),v=clamp(old+Number(n||0),0,100);st.friendship[k]=v;if(Math.floor(v/10)>Math.floor(old/10))toast((d.name||'Morador')+' está ficando mais próximo de você. ♥',100);return v;};
S.friendshipLevel=function(v){v=Number(v||0);if(v>=70)return 5;if(v>=45)return 4;if(v>=28)return 3;if(v>=14)return 2;if(v>=5)return 1;return 0;};

var _makeCitizen=City.makeCitizen;
City.makeCitizen=function(id,role,used,stationary){
  var ch=_makeCitizen.call(City,id,role,used,stationary),d=ch&&ch._cityData;if(!d)return ch;
  if(ordinaryRole(d.role)){var mid=d.mapId||mapId();d.name=S.NAMES[hash(mid,id,501)%S.NAMES.length];d.personality=S.PERSONALITIES[hash(mid,id,777)%S.PERSONALITIES.length];d.homeMap=mid;}
  return ch;
};

S.mapLines={
  2:['A Rua Santa Cruz sempre tem alguém indo e voltando.','Aqui você fica sabendo das novidades antes de todo mundo.','Se andar devagar, sempre acha alguma coisa interessante por aqui.'],
  7:['O Trevo parece quieto, mas passa gente o dia inteiro.','Esse caminho já viu cada história...','Quando o vento aperta aqui, é melhor segurar o chapéu.'],
  8:['A região da igreja fica diferente no fim da tarde.','O sino daqui dá para ouvir de longe.','Domingo cedo sempre aparece mais gente por aqui.'],
  11:['A praça é o coração da cidade.','Sempre tem alguma conversa começando por aqui.','Quando tem feira, isso aqui vira outra cidade.'],
  14:['Esse lado da cidade é bom para caminhar sem pressa.','Tem gente que conhece cada canto daqui de olhos fechados.','As melhores histórias aparecem quando a gente para para conversar.'],
  16:['Na Vila todo mundo acaba se conhecendo.','Se você ajudar o pessoal, o povo lembra.','Aqui sempre aparece alguém precisando de uma mão.']
};
S.weatherLines={
 clear:['Hoje o sol veio com vontade.','Dia bom para resolver as coisas na rua.','Com esse tempo dá vontade de andar a cidade toda.'],
 cloudy:['Esse céu está com cara de que vai aprontar.','Nublado assim o calor fica mais suportável.'],
 rain:['Chuva boa muda até o cheiro da rua.','Com essa chuva, os peixes devem estar mais ativos.','Vou esperar diminuir antes de seguir caminho.'],
 storm:['Esse trovão não está brincando hoje.','Temporal assim sempre derruba alguma coisa pelo caminho.'],
 fog:['Essa neblina deixou tudo com cara de história antiga.','Hoje está difícil enxergar até o fim da rua.']
};
S.personalityLines={
 calmo:['Tem dia que o melhor é ir sem pressa.','Uma coisa de cada vez e o dia rende.'],
 falante:['Rapaz, se eu começar a contar as novidades, a tarde acaba!','Você já viu o movimento que deu hoje?'],
 curioso:['Você encontrou alguma coisa diferente por aí?','Ainda quero descobrir o que tem em cada canto dessa cidade.'],
 trabalhador:['Hoje ainda tem serviço demais para terminar.','Trabalho feito cedo deixa a noite livre.'],
 brincalhão:['Se chover mais um pouco eu vou começar a pescar na calçada!','Se achar dinheiro no chão, lembra que eu passei por aqui primeiro!'],
 reservado:['Gosto quando a cidade fica mais silenciosa.','Nem tudo que acontece por aqui precisa virar conversa.']
};
S.friendLines=[
 ['Bom te ver por aqui.','A gente ainda vai se esbarrar muito pela cidade.'],
 ['Ô, '+"{name}"+'! Já está ficando conhecido por aqui.','Você está pegando o jeito da cidade.'],
 ['Chegou, '+"{name}"+'! Como foi seu dia?','Se precisar saber de alguma coisa daqui, pergunta.'],
 ['Você já é de casa, '+"{name}"+'.','O povo comenta que você anda ajudando bastante.'],
 ['Quando você some, o pessoal pergunta por você.','Camutanga ficou mais animada desde que você começou a circular por aí.'],
 ['Você virou parte da história daqui, '+"{name}"+'.','Tem coisa que eu só conto para quem confio de verdade.']
];

S.makeDialogue=function(ch){
  var d=ch._cityData||{},h=clock().hour,w=weather(),fp=S.friendship(d),fl=S.friendshipLevel(fp),seed=day()*10000+(d.mapId||mapId())*131+(d.id||0)*17+Math.floor(clock().minute/10),arr=[];
  if(fl>0){var f=S.friendLines[fl]||S.friendLines[0];arr.push(choose(f,seed+1).replace(/\{name\}/g,playerName()));}
  if(S.weatherLines[w])arr=arr.concat(S.weatherLines[w]);
  if(S.mapLines[mapId()])arr=arr.concat(S.mapLines[mapId()]);
  if(S.personalityLines[d.personality])arr=arr.concat(S.personalityLines[d.personality]);
  if(h<7)arr.push('Você acordou cedo, '+playerName()+'.','A cidade ainda está espreguiçando.');
  else if(h<10)arr.push('Bom dia, '+playerName()+'!','A manhã está começando agora.');
  else if(h>=18&&h<22)arr.push('Boa noite, '+playerName()+'.','O movimento muda completamente depois que escurece.');
  else if(h>=22)arr.push('Está ficando tarde. Tem umas histórias que só acontecem nesse horário...');
  var ae=S.activeEvents();for(var i=0;i<ae.length;i++)arr.push(ae[i].talk);
  var dis=C.World&&C.World.activeDisaster?C.World.activeDisaster():null;if(dis){if(dis.type==='flood')arr.push('A água subiu rápido. Melhor evitar os pontos baixos.');if(dis.type==='quake')arr.push('Depois desse tremor eu vou conferir as paredes de casa.');if(dis.type==='wind')arr.push('O vento está arrancando tudo do lugar.');if(dis.type==='drought')arr.push('Essa seca está castigando as plantações.');}
  if(!arr.length)arr.push('Tudo certo por aí, '+playerName()+'?');
  return choose(arr,seed+fp*23);
};

var _dialogue=City.dialogue;
City.dialogue=function(ch){
  var d=ch&&ch._cityData||{};if(!ordinaryRole(d.role))return _dialogue.call(City,ch);
  var msg=S.makeDialogue(ch);S._lastDialogue={name:d.name||'Morador',text:msg,key:S.citizenKey(d),data:d};return msg;
};

var _talk=City.talk;
City.talk=function(ch){
  if(!ch)return false;var d=ch._cityData||{},role=d.role||'morador';
  if(role==='eventNpc')return S.talkEventNpc(ch);
  var normal=ordinaryRole(role),st=S.state(),k=S.citizenKey(d),daily=day()+':'+k,was=!!st.talkedToday[daily];
  if(normal&&!was){st.talkedToday[daily]=true;st.conversations++;S.addFriendship(d,1);}
  var ok=_talk.call(City,ch);
  if(normal&&S._lastDialogue){S.dialogueCard(S._lastDialogue.name,S._lastDialogue.text,S.friendship(d));if(!was&&st.lastChoiceDay!==day()&&st.conversations%5===0)setTimeout(function(){S.offerSocialChoice(d);},400);S.maybeFriendGift(d,daily);}
  return ok;
};
S.maybeFriendGift=function(d,daily){
  var st=S.state(),fp=S.friendship(d);if(fp<28||st.giftToday[daily])return;if(hash(day(),d.id,909)%100>=Math.min(35,8+S.friendshipLevel(fp)*5))return;
  st.giftToday[daily]=true;var ids=[56,64,66,67,68,69,55,59],id=ids[hash(day(),d.id,910)%ids.length];gain(id,1);st.totalGifts++;playSE('Camutanga_CityCoin',50,118);toast((d.name||'Um morador')+' te deu '+(item(id)?item(id).name:'um presente')+'.',170);
};

S.offerSocialChoice=function(d){
  if(S._nameOpen||document.getElementById('camutanga-social-choice'))return;var st=S.state();st.lastChoiceDay=day();st.lastChoiceNpc=S.citizenKey(d);
  var wrap=document.createElement('div');wrap.id='camutanga-social-choice';var p=d.personality||'calmo';
  var opts=[
    {t:'Perguntar sobre Camutanga',score:(p==='falante'||p==='curioso')?2:1,r:'Sempre tem alguma história nova quando a gente presta atenção.'},
    {t:'Falar sobre trabalho e o dia',score:p==='trabalhador'?2:1,r:'Pois é. Um dia cheio cansa, mas dá aquela sensação boa no fim.'},
    {t:'Fazer uma brincadeira',score:p==='brincalhão'?2:0,r:p==='brincalhão'?'Aí você me quebra! Hahaha!':'Heh... essa foi inesperada.'}
  ];
  var html='<div class="social-choice-card"><div class="social-choice-title">'+escapeHtml(d.name)+' continua a conversa...</div>';
  for(var i=0;i<opts.length;i++)html+='<button data-i="'+i+'">'+escapeHtml(opts[i].t)+'</button>';html+='</div>';wrap.innerHTML=html;document.body.appendChild(wrap);S._choiceOpen=true;
  function close(){S._choiceOpen=false;if(wrap.parentNode)wrap.parentNode.removeChild(wrap);try{Input.clear();TouchInput.clear();}catch(e){}}
  var buttons=wrap.querySelectorAll('button');for(var j=0;j<buttons.length;j++)buttons[j].addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var o=opts[Number(this.getAttribute('data-i'))];if(o.score>0){S.addFriendship(d,o.score);City.addReputation&&City.addReputation(1,'boa conversa');}S.dialogueCard(d.name,o.r,S.friendship(d));close();});
};

// ---------------------------------------------------------------------------
// Acontecimentos aleatórios da cidade
// ---------------------------------------------------------------------------
S.EVENTS=[
 {id:'fruit',name:'Frutas pelo Caminho',maps:[2,7,11,14,16],start:7,end:17,talk:'O vento derrubou umas frutas por aí. Se achar, pode pegar.',desc:'Frutas caíram em pontos da cidade. Procure os marcadores FRUTA.'},
 {id:'wallet',name:'Carteira Perdida',maps:[2,7,11,14,16],start:9,end:19,talk:'Disseram que alguém perdeu uma carteira hoje.',desc:'Uma carteira foi perdida. Encontre-a e ajude a devolver ao dono.'},
 {id:'crate',name:'Carga Espalhada',maps:[2,7,14,16],start:8,end:18,talk:'Uma carroça deixou umas caixas caírem pelo caminho.',desc:'Caixas com materiais ficaram espalhadas. Recolha antes de anoitecer.'},
 {id:'herbs',name:'Ervas Depois do Tempo',maps:[7,8,16],start:6,end:16,talk:'Depois desse tempo apareceram ervas boas nos cantos mais verdes.',desc:'Ervas medicinais brotaram em áreas verdes.'},
 {id:'lights',name:'Luzes Estranhas',maps:[8,11,16],start:19,end:24,talk:'Você viu aquelas luzes ontem? Eu não chego perto não...',desc:'Brilhos estranhos surgem depois que anoitece. Podem esconder algo raro.'},
 {id:'flashfair',name:'Feira Relâmpago',maps:[2,11],start:9,end:18,talk:'Chegou mercadoria barata hoje. Aproveita enquanto ainda tem.',desc:'Vendedores de rua estão com 15% de desconto por algumas horas.'},
 {id:'fishrun',name:'Cardume no Rio',maps:[2],start:6,end:18,talk:'Tem gente dizendo que o rio está cheio de peixe grande hoje.',desc:'A pesca está especialmente boa: peixes maiores e mais qualidade.'},
 {id:'motopromo',name:'Dia da Charrete',maps:[2,7,11,14,16],start:7,end:21,talk:'Hoje os charreteiros combinaram preço mais baixo.',desc:'Corridas de charrete estão pela metade do preço.'},
 {id:'neighbor',name:'Boa Vizinhança',maps:[2,7,8,11,14,16],start:15,end:22,talk:'Hoje o pessoal está numa disposição boa para conversar.',desc:'Conversas rendem amizade extra e presentes aparecem com mais frequência.'},
 {id:'football',name:'Pelada Improvisada',maps:[11],start:14,end:20,talk:'Arrumaram uma pelada na praça. Está valendo até torcida!',desc:'A embaixadinha paga recompensa maior durante o evento.'},
 {id:'music',name:'Som na Praça',maps:[11],start:18,end:23,talk:'Hoje tem música na praça. Está juntando uma turma boa.',desc:'Música e gente na praça: conversar ali rende reputação extra.'},
 {id:'cleanup',name:'Mutirão Espontâneo',maps:[2,7,11,14,16],start:8,end:17,talk:'O pessoal resolveu dar uma geral nas ruas hoje.',desc:'Mais lixo aparece para recolher e a limpeza paga em dobro.'}
];
S.buildDailyEvents=function(dk){
  var arr=[],used={};for(var slot=0;slot<2;slot++){var ix=hash(dk,slot,300)%S.EVENTS.length;while(used[ix])ix=(ix+1)%S.EVENTS.length;used[ix]=true;var base=S.EVENTS[ix],maps=base.maps,map=maps[hash(dk,slot,301)%maps.length],shift=slot===0?0:Math.min(3,Math.max(0,20-base.end));arr.push({id:base.id,name:base.name,mapId:map,start:base.start+shift,end:base.end+shift,talk:base.talk,desc:base.desc,slot:slot,key:dk+':'+slot+':'+base.id});}return arr;
};
S.dailyEvents=function(){S.onNewDay(false);return S.state().dailyEvents||[];};
S.activeEvents=function(){var h=clock().hour,m=mapId(),evs=S.dailyEvents(),out=[];for(var i=0;i<evs.length;i++){var e=evs[i];if(e.mapId===m&&h>=e.start&&h<e.end&&!S.state().eventDone[e.key])out.push(e);}return out;};
S.eventById=function(id){var a=S.activeEvents();for(var i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null;};
S.finishEvent=function(e,msg,reward,rep){if(!e)return;var st=S.state();if(st.eventDone[e.key])return;st.eventDone[e.key]=true;st.randomEventsDone++;if(reward)giveGold(reward);if(rep&&City.addReputation)City.addReputation(rep,'acontecimento da cidade');playSE('Camutanga_CityCheer',62,108);S.eventBanner('ACONTECIMENTO CONCLUÍDO',msg+(reward?' • +'+reward+' Cruzeiros':''));City._needsRuntimeRebuild=true;};
S.notifyActive=function(){var a=S.activeEvents(),st=S.state();for(var i=0;i<a.length;i++){var e=a[i];if(st.eventNotice[e.key])continue;st.eventNotice[e.key]=true;S.eventBanner(e.name,e.desc);playSE('Camutanga_CityBell',28,126);}}

var _prepareRuntime=City.prepareRuntime;
City.prepareRuntime=function(){
  _prepareRuntime.call(City);var r=City._runtime;if(!r||!r.citizens||!r.spots)return;var evs=S.activeEvents();
  for(var z=0;z<evs.length;z++){var e=evs[z],i,p,key;
    if(e.id==='fruit'){for(i=0;i<5;i++){key=e.key+':fruit:'+i;if(S.state().eventDone[key])continue;p=City.pickTile(mapId()*13000+day()*109+i*67,r.used);r.used.push(p);r.spots.push({key:key,type:'socialFruit',x:p.x,y:p.y,icon:[267,266,271,264][i%4],label:'FRUTA',eventKey:e.key});}}
    else if(e.id==='wallet'){key=e.key+':wallet';if(!S.state().eventDone[key]){p=City.pickTile(mapId()*13100+day()*113,r.used);r.used.push(p);r.spots.push({key:key,type:'socialWallet',x:p.x,y:p.y,icon:208,label:'CARTEIRA',eventKey:e.key});}}
    else if(e.id==='crate'){for(i=0;i<3;i++){key=e.key+':crate:'+i;if(S.state().eventDone[key])continue;p=City.pickTile(mapId()*13200+day()*127+i*59,r.used);r.used.push(p);r.spots.push({key:key,type:'socialCrate',x:p.x,y:p.y,icon:176,label:'CAIXA',eventKey:e.key});}}
    else if(e.id==='herbs'){for(i=0;i<4;i++){key=e.key+':herb:'+i;if(S.state().eventDone[key])continue;p=City.pickTile(mapId()*13300+day()*131+i*43,r.used);r.used.push(p);r.spots.push({key:key,type:'socialHerb',x:p.x,y:p.y,icon:192,label:'ERVA',eventKey:e.key});}}
    else if(e.id==='lights'){for(i=0;i<3;i++){key=e.key+':light:'+i;if(S.state().eventDone[key])continue;p=City.pickTile(mapId()*13400+day()*137+i*53,r.used);r.used.push(p);r.spots.push({key:key,type:'socialLight',x:p.x,y:p.y,icon:190,label:'LUZ',eventKey:e.key});}}
    if(e.id==='flashfair'){for(i=0;i<2;i++)r.citizens.push(City.makeCitizen(1800+z*20+i,i===0?'vendorFood':'vendorMarket',r.used,true));}
    if(e.id==='music'){var mc=City.makeCitizen(1860+z,'musician',r.used,true);r.citizens.push(mc);for(i=0;i<3;i++)r.citizens.push(City.makeCitizen(1870+z*10+i,null,r.used,false));}
    if(e.id==='football'){for(i=0;i<4;i++)r.citizens.push(City.makeCitizen(1900+z*10+i,null,r.used,false));}
    if(e.id==='cleanup'){for(i=0;i<4;i++){key=e.key+':cleanup:'+i;if(City.state().collected[key])continue;p=City.pickTile(mapId()*13500+day()*149+i*47,r.used);r.used.push(p);r.spots.push({key:key,type:'trash',x:p.x,y:p.y,icon:210,label:'LIXO'});}}
  }
};

var _collectSpot=City.collectSpot;
City.collectSpot=function(sp){
  if(!sp||String(sp.type).indexOf('social')!==0)return _collectSpot.call(City,sp);
  var st=S.state();if(st.eventDone[sp.key])return false;st.eventDone[sp.key]=true;st.totalFinds++;if(City.state&&City.state().collected)City.state().collected[sp.key]=true;
  var ev=null,evs=S.dailyEvents();for(var i=0;i<evs.length;i++)if(evs[i].key===sp.eventKey)ev=evs[i];
  if(sp.type==='socialFruit'){var ids=[66,67,68,69],id=ids[hash(day(),sp.x,sp.y)%ids.length];gain(id,1);toast('Você pegou '+item(id).name+'.',80);playSE('Camutanga_CitySparkle',45,122);if(S.countEventParts(sp.eventKey,'fruit')>=5)S.finishEvent(ev,'Você aproveitou todas as frutas que caíram.',90,2);}
  else if(sp.type==='socialWallet'){giveGold(35);S.kindnessReward('Você encontrou a carteira e deixou na prefeitura. O dono te agradeceu.',170,5);S.finishEvent(ev,'Carteira devolvida ao dono.',170,5);}
  else if(sp.type==='socialCrate'){var pool=[53,54,61,62,74],rid=pool[hash(day(),sp.x,sp.y)%pool.length];gain(rid,1+hash(sp.x,sp.y,4)%2);toast('Caixa recolhida: '+item(rid).name+'.',90);playSE('Camutanga_CityCoin',42,105);if(S.countEventParts(sp.eventKey,'crate')>=3)S.finishEvent(ev,'As caixas espalhadas foram recolhidas.',130,3);}
  else if(sp.type==='socialHerb'){gain(64,1);toast('Erva Medicinal coletada.',70);playSE('Camutanga_CitySparkle',40,118);if(S.countEventParts(sp.eventKey,'herb')>=4)S.finishEvent(ev,'Você encontrou todas as ervas do dia.',100,2);}
  else if(sp.type==='socialLight'){var id2=(hash(day(),sp.x,sp.y)%4===0)?121:136;gain(id2,1);toast('A luz deixou para trás '+item(id2).name+'.',100);playSE('Camutanga_CitySparkle',55,92);if(S.countEventParts(sp.eventKey,'light')>=3)S.finishEvent(ev,'Você investigou as luzes estranhas.',190,4);}
  return true;
};
S.countEventParts=function(eventKey,kind){var st=S.state().eventDone,n=0,prefix=eventKey+':'+kind+':';for(var k in st)if(st[k]&&k.indexOf(prefix)===0)n++;return n;};
S.kindnessReward=function(msg,reward,rep){S.state().kindness++;toast(msg,190);if(rep&&City.addReputation)City.addReputation(rep,'boa ação');};

// Benefícios reais dos acontecimentos.
var _vendorPrice=City.vendorPrice;City.vendorPrice=function(it){var p=_vendorPrice.call(City,it);if(S.eventById('flashfair'))p=Math.max(1,Math.round(p*.85));return p;};
var _travelCost=City.travelCost;City.travelCost=function(dest){var p=_travelCost.call(City,dest);if(S.eventById('motopromo'))p=Math.max(5,Math.round(p*.5));return p;};
if(window.Scene_CamutangaStreetGame&&Scene_CamutangaStreetGame.prototype.finish){var _streetFinish=Scene_CamutangaStreetGame.prototype.finish;Scene_CamutangaStreetGame.prototype.finish=function(){var before=$gameParty?$gameParty.gold():0;_streetFinish.call(this);if(S.eventById('football')){var bonus=Math.max(20,Math.round(this._score*.16));giveGold(bonus);City.addReputation&&City.addReputation(2,'pelada na praça');toast('Bônus da pelada: +'+bonus+' Cruzeiros!',100);}};}
if(window.Scene_CamutangaFishing&&Scene_CamutangaFishing.prototype.pickFish){var _pickFish=Scene_CamutangaFishing.prototype.pickFish;Scene_CamutangaFishing.prototype.pickFish=function(){var f=_pickFish.call(this);if(f&&S.eventById('fishrun')){f.weight=Number((f.weight*1.18).toFixed(2));f.quality=Math.min(4,Number(f.quality||1)+1);}return f;};}

// Durante boa vizinhança, a primeira conversa de cada NPC rende mais amizade.
var _addFriendship=S.addFriendship;S.addFriendship=function(d,n){if(S.eventById('neighbor'))n=Number(n||0)+1;return _addFriendship.call(S,d,n);};

S.talkEventNpc=function(ch){var d=ch._cityData||{};S.dialogueCard(d.name||'Morador',d.eventText||'Hoje a cidade está diferente.',0);return true;};

// ---------------------------------------------------------------------------
// Movimento social: falas ambientes e detecção de mudança de evento
// ---------------------------------------------------------------------------
S._lastEventSig='';S._lastAmbientFrame=0;
S.update=function(){
  S.onNewDay(false);if(!(SceneManager._scene instanceof Scene_Map)||!City.CITY_MAPS||City.CITY_MAPS.indexOf(mapId())<0)return;
  var a=S.activeEvents(),sig='';for(var i=0;i<a.length;i++)sig+=a[i].key+'|';if(sig!==S._lastEventSig){S._lastEventSig=sig;City._needsRuntimeRebuild=true;S.notifyActive();}
  var r=City._runtime;if(!r||!r.citizens||Graphics.frameCount-S._lastAmbientFrame<420)return;S._lastAmbientFrame=Graphics.frameCount;
  var near=[];for(i=0;i<r.citizens.length;i++){var ch=r.citizens[i],d=ch._cityData||{};if(!ordinaryRole(d.role))continue;if($gamePlayer&&Math.abs(ch.x-$gamePlayer.x)+Math.abs(ch.y-$gamePlayer.y)<=9)near.push(ch);}if(!near.length)return;
  var c1=near[hash(Graphics.frameCount,mapId(),33)%near.length],bits=['Bom dia!','Opa!','Tudo certo?','Até mais!','Hoje tá movimentado.','Passa na praça depois!','Rapaz... que dia!','Olha a chuva!','Bora resolver as coisas.','Depois eu te conto.'];if(c1&&c1.citySay)c1.citySay(choose(bits,Graphics.frameCount+(c1._cityData.id||0)),80);
};

// Acrescenta a agenda aleatória ao boletim sem alterar o ID do evento principal.
var _todayEvent=City.todayEvent;
City.todayEvent=function(){var b=_todayEvent.call(City),copy={},k;for(k in b)copy[k]=b[k];var h=clock().hour,m=mapId(),evs=S.dailyEvents(),next=[];for(var i=0;i<evs.length;i++){var e=evs[i];if(!S.state().eventDone[e.key])next.push((e.mapId===m&&h>=e.start&&h<e.end?'AGORA: ':'')+e.name+' '+e.start+'h-'+e.end+'h');}if(next.length)copy.desc=b.desc+' • '+next.join(' / ');return copy;};

// ---------------------------------------------------------------------------
// Integração com a interface: alterar nome no menu Sistema
// ---------------------------------------------------------------------------
if(window.Scene_CamutangaInventory26){
  var P=Scene_CamutangaInventory26.prototype,_build=P.buildData,_run=P.runSystem;
  P.buildData=function(){_build.call(this);var tab=C.UI26&&C.UI26.tabs&&C.UI26.tabs[this._tab]?C.UI26.tabs[this._tab].id:'';if(tab==='system'){var found=false;for(var i=0;i<this._data.length;i++)if(this._data[i].cmd==='rename35')found=true;if(!found)this._data.splice(1,0,{cmd:'rename35',name:'SEU NOME',desc:'Alterar o nome do personagem. Atual: '+playerName()});this._selected=clamp(this._selected,0,Math.max(0,this._data.length-1));}};
  P.runSystem=function(e){if(e&&e.cmd==='rename35'){S.openNameOverlay(true);return;}return _run.call(this,e);};
}

// Trava movimento enquanto teclado/caixa social está aberta.
var _canMove=Game_Player.prototype.canMove;Game_Player.prototype.canMove=function(){if(S._nameOpen||S._choiceOpen)return false;return _canMove.call(this);};

var _Scene_Map_start35=Scene_Map.prototype.start;Scene_Map.prototype.start=function(){_Scene_Map_start35.call(this);S.onNewDay(false);S.ensureName();setTimeout(S.notifyActive,500);};
var _Scene_Map_update35=Scene_Map.prototype.update;Scene_Map.prototype.update=function(){_Scene_Map_update35.call(this);if(Input.isTriggered('camutangaRename')&&!S._nameOpen)S.openNameOverlay(true);S.update();};

})();

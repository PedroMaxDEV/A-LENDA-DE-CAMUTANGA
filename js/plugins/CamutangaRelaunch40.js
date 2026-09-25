/*:
 * @plugindesc [v4.0] Camutanga Recomeço - nova chegada, jornada até a fazenda, exploração, NPCs modernos e recursos mais vivos.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * V4 reorganiza o modo Vida Livre em uma campanha de vida no interior:
 *  - começa chegando de mudança ao Trevo;
 *  - escolha de nome continua pela camada social;
 *  - objetivos guiados levam de hospedagem temporária até a compra da fazenda;
 *  - NPCs urbanos usam roupas casuais procedurais, sem arquivos extras;
 *  - recursos aparecem no chão e são coletados com feedback/contexto;
 *  - lugares descobertos dão recompensas e entram no progresso;
 *  - eventos e diálogos foram ampliados;
 *  - não altera a campanha original quando o modo História está ativo.
 *
 * Atalhos:
 *   F = ação de vida / coletar / ferramenta
 *   K = Cidade
 *   I/ESC = menu
 *   F6 = renovar cache
 */
(function(){
'use strict';

window.Camutanga=window.Camutanga||{};
var C=window.Camutanga;
var R=C.Relaunch40=C.Relaunch40||{};
R.VERSION='4.0.0';
R.BUILD='40';
R.FARM_PRICE=650;
R.ARRIVAL_MAP=7;
R.ARRIVAL_X=26;
R.ARRIVAL_Y=48;
R.FARM_MAP=5;
R.INN_MAP=23;
R.CITY_ENTRY_MAP=2;
R._introOpen=false;
R._farmOpen=false;
R._innOpen=false;
R._lastMap=0;
R._lastContext='';
R._lastHudSig='';
R._lastAutoPickup=0;
R._lastForageKey='';

function day(){return C.dayKey?C.dayKey():0;}
function clock(){return C.gameClock?C.gameClock():{day:1,hour:8,minute:0,raw:0};}
function life(){return C.state?C.state():null;}
function city(){return C.City&&C.City.state?C.City.state():null;}
function social(){return C.Social35&&C.Social35.state?C.Social35.state():null;}
function actor(){try{return $gameActors&&$gameActors.actor(1)?$gameActors.actor(1):($gameParty?$gameParty.leader():null);}catch(e){return null;}}
function playerName(){var a=actor();return a&&a.name?a.name():'Visitante';}
function toast(t,f){if(C.toast)C.toast(t,f||160);}
function playSE(name,vol,pitch){try{AudioManager.playSe({name:name,volume:vol||60,pitch:pitch||100,pan:0});}catch(e){try{SoundManager.playOk();}catch(_){}}}
function item(id){return window.$dataItems?$dataItems[Number(id||0)]:null;}
function count(id){var it=item(id);return it&&window.$gameParty?$gameParty.numItems(it):0;}
function give(id,n){var it=item(id);if(it&&$gameParty)$gameParty.gainItem(it,Math.max(1,Number(n||1)));}
function loseGold(n){if($gameParty)$gameParty.loseGold(Math.max(0,Math.floor(n||0)));}
function giveGold(n){if($gameParty)$gameParty.gainGold(Math.max(0,Math.floor(n||0)));}
function gold(){return $gameParty?$gameParty.gold():0;}
function isTouch(){return C.touchDevice?C.touchDevice():(('ontouchstart' in window)||(navigator.maxTouchPoints||0)>0);}
function isFree(){var s=life();return !!(s&&s.mode==='free');}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function hash(a,b,c){var x=Math.sin((Number(a||0)+1)*12.9898+(Number(b||0)+3)*78.233+(Number(c||0)+7)*37.719)*43758.5453123;return Math.abs(Math.floor((x-Math.floor(x))*1000000));}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}

R.defaultState=function(){return{
 version:R.VERSION,newJourney:false,legacyImported:false,introSeen:false,chapter:0,
 farmOwned:false,shelterUnlocked:false,freeNights:0,roomPaidDay:-1,
 metPeople:{},jobsBaseline:0,discoveries:{},forageSpawned:{},
 chapterRewards:{},farmBoughtDay:-1,arrivalDay:0,arrivalGold:0,
 locationSeen:{},tips:{},firstWeekDone:false
};};
R.state=function(){
 if(!$gameSystem)return R.defaultState();
 if(!$gameSystem._camutangaRelaunch40){
   var d=R.defaultState(),ls=life();
   if(ls&&ls.starterReceived){d.legacyImported=true;d.introSeen=true;d.chapter=6;d.farmOwned=true;d.shelterUnlocked=true;}
   $gameSystem._camutangaRelaunch40=d;
 }
 var s=$gameSystem._camutangaRelaunch40,d2=R.defaultState(),k;
 for(k in d2)if(s[k]==null)s[k]=d2[k];
 if(!s.metPeople)s.metPeople={};if(!s.discoveries)s.discoveries={};if(!s.forageSpawned)s.forageSpawned={};if(!s.chapterRewards)s.chapterRewards={};if(!s.locationSeen)s.locationSeen={};if(!s.tips)s.tips={};
 return s;
};

R.resetNewJourney=function(){
 var s=R.defaultState();s.newJourney=true;s.arrivalDay=day();s.arrivalGold=120;$gameSystem._camutangaRelaunch40=s;
 var ls=life();if(ls){ls.mode='free';ls.stamina=ls.maxStamina||100;ls.starterReceived=false;ls.activeItemId=0;}
 if(C.V3&&C.V3.state){var v=C.V3.state();v.hotbar=[0,0,0,0,0,0,0,0];v.hotIndex=0;}
};

// ---------------------------------------------------------------------------
// NOVO TÍTULO E COMEÇO: chegada de mudança a Camutanga
// ---------------------------------------------------------------------------
Window_TitleCommand.prototype.makeCommandList=function(){
 this.addCommand('Nova Vida em Camutanga','camutangaFree');
 this.addCommand('A Lenda — História Original','newGame');
 this.addCommand(TextManager.continue_,'continue',this.isContinueEnabled());
 this.addCommand(TextManager.options,'options');
};

Scene_Title.prototype.commandCamutangaFree=function(){
 DataManager.setupNewGame();
 R.resetNewJourney();
 try{$gameParty._gold=0;}catch(e){}
 giveGold(120);give(168,1);give(170,1);
 if($gameVariables)$gameVariables.setValue(3,8*60+10);
 if($gameSwitches){$gameSwitches.setValue(26,true);$gameSwitches.setValue(91,false);}
 var a=actor();if(a&&a.setName)a.setName('Jhon');
 if(C.Social35&&C.Social35.state){var ss=C.Social35.state();ss.nameChosen=false;ss.playerName='';}
 $gamePlayer.reserveTransfer(R.ARRIVAL_MAP,R.ARRIVAL_X,R.ARRIVAL_Y,8,0);
 this._commandWindow.close();this.fadeOutAll();SceneManager.goto(Scene_Map);
};

// ---------------------------------------------------------------------------
// CSS / overlays do relançamento
// ---------------------------------------------------------------------------
R.injectCss=function(){
 if(document.getElementById('camutanga-v40-css'))return;
 var st=document.createElement('style');st.id='camutanga-v40-css';st.textContent=''
 +'#cmt-v40-intro,#cmt-v40-modal{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at 50% 32%,rgba(91,116,62,.38),rgba(6,10,8,.91));backdrop-filter:blur(7px);font-family:GameFont,Arial,sans-serif;color:#fff;pointer-events:auto}'
 +'.cmt40-card{width:min(720px,94vw);box-sizing:border-box;border-radius:26px;padding:26px;background:linear-gradient(145deg,rgba(18,28,22,.985),rgba(47,47,29,.985));border:1px solid rgba(245,210,104,.42);box-shadow:0 28px 90px rgba(0,0,0,.58)}'
 +'.cmt40-kicker{font-size:11px;letter-spacing:3px;color:#e9c968}.cmt40-title{font-size:clamp(24px,4.5vw,38px);font-weight:900;margin:8px 0 12px;color:#fff3c4}.cmt40-copy{font:500 15px/1.6 GameFont,Arial,sans-serif;color:#d6ddd7}.cmt40-copy b{color:#f0cf72}'
 +'.cmt40-scene{height:150px;border-radius:18px;margin:16px 0 18px;position:relative;overflow:hidden;background:linear-gradient(#74a9c4 0 45%,#87ae58 45% 72%,#caa56a 72%);border:1px solid rgba(255,255,255,.12)}'
 +'.cmt40-scene:before{content:"";position:absolute;left:8%;right:8%;bottom:25px;height:40px;background:#d8bc82;transform:skewX(-8deg);box-shadow:0 18px 0 rgba(92,64,37,.28)}'
 +'.cmt40-bus{position:absolute;left:12%;bottom:44px;width:180px;height:66px;border-radius:15px 20px 8px 8px;background:#d89f32;box-shadow:inset 0 -16px rgba(90,52,28,.18),0 8px 16px rgba(0,0,0,.25)}.cmt40-bus:before{content:"CAMUTANGA";position:absolute;left:18px;top:14px;color:#241d13;font:bold 11px Arial}.cmt40-bus:after{content:"";position:absolute;left:24px;right:24px;bottom:-11px;height:22px;background:radial-gradient(circle at 12px 11px,#222 0 10px,transparent 11px),radial-gradient(circle at calc(100% - 12px) 11px,#222 0 10px,transparent 11px)}'
 +'.cmt40-bag{position:absolute;left:50%;bottom:39px;width:34px;height:38px;border-radius:7px;background:#6f4a2a;border:3px solid #3e2a1a}.cmt40-bag:before{content:"";position:absolute;left:8px;top:-12px;width:12px;height:12px;border:3px solid #3e2a1a;border-bottom:0;border-radius:8px 8px 0 0}'
 +'.cmt40-btns{display:flex;gap:12px;margin-top:20px}.cmt40-btns button{flex:1;min-height:52px;border-radius:15px;border:1px solid rgba(255,255,255,.12);background:#d9b64e;color:#17130d;font:900 14px GameFont,Arial,sans-serif;cursor:pointer}.cmt40-btns button.secondary{background:rgba(255,255,255,.08);color:#e3e8e4}'
 +'#cmt-v40-objective{position:fixed;left:max(14px,env(safe-area-inset-left));top:max(116px,env(safe-area-inset-top));z-index:2147481800;width:min(330px,42vw);box-sizing:border-box;padding:13px 14px 12px;border-radius:16px;background:linear-gradient(135deg,rgba(13,22,18,.92),rgba(41,48,31,.91));border:1px solid rgba(239,204,102,.32);box-shadow:0 8px 30px rgba(0,0,0,.30);font-family:GameFont,Arial,sans-serif;color:#fff;pointer-events:auto;transition:.2s}'
 +'#cmt-v40-objective .tag{font-size:9px;letter-spacing:2px;color:#e4c260}#cmt-v40-objective .title{font-size:15px;font-weight:900;margin:5px 0;color:#fff3c7}#cmt-v40-objective .desc{font-size:11px;line-height:1.38;color:#cad4cd}#cmt-v40-objective .prog{margin-top:8px;font-size:10px;color:#ebd786}#cmt-v40-objective.compact .desc,#cmt-v40-objective.compact .prog{display:none}#cmt-v40-objective.compact{width:auto;max-width:260px;opacity:.88}'
 +'#cmt-v40-context{position:fixed;left:50%;bottom:max(104px,calc(env(safe-area-inset-bottom) + 88px));transform:translateX(-50%);z-index:2147481700;max-width:min(560px,84vw);box-sizing:border-box;padding:8px 13px;border-radius:14px;background:rgba(11,18,15,.86);border:1px solid rgba(255,255,255,.14);box-shadow:0 6px 22px rgba(0,0,0,.28);color:#f6e7b1;font:800 11px GameFont,Arial,sans-serif;text-align:center;pointer-events:none;opacity:0;transition:.15s}#cmt-v40-context.show{opacity:1}'
 +'#cmt-v40-location{position:fixed;left:50%;top:92px;transform:translate(-50%,-8px);z-index:2147481650;padding:9px 20px;border-radius:14px;background:rgba(8,14,11,.82);border:1px solid rgba(255,255,255,.12);color:#fff4c7;font:800 14px GameFont,Arial,sans-serif;letter-spacing:1px;opacity:0;pointer-events:none;transition:.25s}#cmt-v40-location.show{opacity:1;transform:translate(-50%,0)}'
 +'@media(max-width:900px),(pointer:coarse){#cmt-v40-objective{top:max(78px,env(safe-area-inset-top));left:max(7px,env(safe-area-inset-left));width:min(292px,48vw);padding:9px 10px;border-radius:12px}#cmt-v40-objective .title{font-size:12px}#cmt-v40-objective .desc{font-size:9px}#cmt-v40-context{bottom:max(88px,calc(env(safe-area-inset-bottom) + 76px));font-size:9px}.cmt40-card{padding:20px}.cmt40-copy{font-size:13px}.cmt40-scene{height:110px}.cmt40-bus{transform:scale(.78);transform-origin:left bottom}}'
 +'body.camutanga-ui-open #cmt-v40-objective,body.camutanga-ui-open #cmt-v40-context{opacity:.12!important;pointer-events:none!important}';
 document.head.appendChild(st);
};
R.injectCss();

R.makeOverlay=function(id,title,kicker,html,buttons){
 var old=document.getElementById(id);if(old&&old.parentNode)old.parentNode.removeChild(old);
 var wrap=document.createElement('div');wrap.id=id;
 var out='<div class="cmt40-card"><div class="cmt40-kicker">'+esc(kicker||'CAMUTANGA')+'</div><div class="cmt40-title">'+esc(title||'')+'</div>'+html+'<div class="cmt40-btns">';
 for(var i=0;i<buttons.length;i++)out+='<button data-i="'+i+'" class="'+(buttons[i].secondary?'secondary':'')+'">'+esc(buttons[i].label)+'</button>';
 out+='</div></div>';wrap.innerHTML=out;document.body.appendChild(wrap);
 for(var j=0;j<buttons.length;j++)(function(btn,idx){wrap.querySelector('[data-i="'+idx+'"]').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(btn.action)btn.action();});})(buttons[j],j);
 return wrap;
};
R.closeOverlay=function(id){var e=document.getElementById(id);if(e&&e.parentNode)e.parentNode.removeChild(e);try{Input.clear();TouchInput.clear();}catch(_){} };

R.openArrival=function(){
 var s=R.state();if(!s.newJourney||s.introSeen||R._introOpen)return;
 if(C.Social35&&C.Social35.state&&!C.Social35.state().nameChosen)return;
 R._introOpen=true;
 var html='<div class="cmt40-scene"><div class="cmt40-bus"></div><div class="cmt40-bag"></div></div><div class="cmt40-copy">Você desceu da lotação com <b>uma mochila, 120 Cruzeiros e nenhum lugar definitivo para morar</b>. A ideia era só recomeçar longe da correria. Agora você precisa conhecer a cidade, arrumar um teto temporário, trabalhar e juntar dinheiro até conseguir seu próprio pedaço de terra.<br><br>Não existe pressa: pesque, converse, explore, faça bicos e descubra Camutanga no seu ritmo.</div>';
 R.makeOverlay('cmt-v40-intro','Uma nova vida começa','CHEGADA A CAMUTANGA',html,[{label:'DESCER E CONHECER A CIDADE',action:function(){s.introSeen=true;R._introOpen=false;R.closeOverlay('cmt-v40-intro');playSE('Camutanga_CityBell',36,112);R.refreshObjective(true);toast('OBJETIVO: siga para a Rua Santa Cruz e conheça o centro.',260);}}]);
};

R.openInn=function(){
 var s=R.state();if(R._innOpen||s.shelterUnlocked||!s.newJourney)return;R._innOpen=true;
 var html='<div class="cmt40-copy">A hospedagem é simples, mas limpa e tranquila. A dona percebe que você acabou de chegar e oferece <b>3 noites sem cobrança</b> para você se organizar.<br><br>Depois disso, cada noite custa <b>35 Cruzeiros</b> até você ter sua própria casa.</div>';
 R.makeOverlay('cmt-v40-modal','Um teto por enquanto','HOSPEDAGEM',html,[{label:'ACEITAR A AJUDA',action:function(){s.shelterUnlocked=true;s.freeNights=3;s.roomPaidDay=day();give(165,1);R._innOpen=false;R.closeOverlay('cmt-v40-modal');R.setChapter(3);playSE('Camutanga_CityCoin',55,110);toast('Hospedagem liberada • 3 noites gratuitas.',220);}}]);
};

R.sleepAtInn=function(){
 var s=R.state();if(!s.shelterUnlocked||s.farmOwned||!$gameMap||$gameMap.mapId()!==R.INN_MAP)return false;
 var price=s.freeNights>0?0:35;if(price>0&&gold()<price){toast('A diária custa 35 Cruzeiros. Faça algum serviço ou venda recursos.',150);SoundManager.playBuzzer();return true;}
 if(price>0)loseGold(price);else s.freeNights=Math.max(0,s.freeNights-1);
 if(C.advanceToMorning)C.advanceToMorning();else if($gameVariables){var raw=Number($gameVariables.value(3)||0),d=Math.floor(raw/1440);$gameVariables.setValue(3,(d+1)*1440+6*60);}
 playSE('Camutanga_CityBell',26,92);toast(price?'Você dormiu na hospedagem • -35 Cruzeiros.':'Você usou uma noite gratuita na hospedagem.',180);return true;
};

R.openFarmPurchase=function(){
 var s=R.state();if(R._farmOpen||s.farmOwned)return;R._farmOpen=true;
 var can=gold()>=R.FARM_PRICE;
 var html='<div class="cmt40-copy">Atrás da porteira existe um terreno abandonado, casa pequena e muito espaço para transformar. O antigo dono deixou algumas ferramentas velhas no depósito.<br><br><b>Preço da propriedade: '+R.FARM_PRICE+' Cruzeiros.</b><br>'+(can?'Você já conseguiu juntar o necessário.':'Você tem '+gold()+' Cruzeiros. Continue fazendo serviços, explorando e vendendo o que encontrar.')+'</div>';
 var buttons=[];
 if(can)buttons.push({label:'COMPRAR A FAZENDA',action:function(){R.buyFarm();}});
 buttons.push({label:'AGORA NÃO',secondary:true,action:function(){R._farmOpen=false;R.closeOverlay('cmt-v40-modal');}});
 R.makeOverlay('cmt-v40-modal','Seu pedaço de terra','FAZENDA À VENDA',html,buttons);
};

R.buyFarm=function(){
 var s=R.state();if(s.farmOwned||gold()<R.FARM_PRICE){SoundManager.playBuzzer();return;}
 loseGold(R.FARM_PRICE);s.farmOwned=true;s.farmBoughtDay=day();give(166,1);give(167,1);
 // Kit da propriedade: suficiente para começar, mas não elimina a progressão.
 [[57,1],[58,1],[43,1],[44,1],[41,1],[46,6],[48,4],[50,4],[42,6]].forEach(function(x){if(count(x[0])<x[1])give(x[0],x[1]-count(x[0]));});
 var ls=life();if(ls){ls.starterReceived=true;ls.activeItemId=57;}
 if(C.V3&&C.V3.state){var v=C.V3.state();v.hotbar=[57,58,43,44,41,46,42,0];v.hotIndex=0;}
 R._farmOpen=false;R.closeOverlay('cmt-v40-modal');R.setChapter(6);playSE('Camutanga_CityCheer',78,106);
 toast('A FAZENDA É SUA! Ferramentas antigas e sementes foram encontradas no depósito.',320);
 if($gamePlayer)$gamePlayer.reserveTransfer(5,24,1,2,0);
};

// ---------------------------------------------------------------------------
// JORNADA / OBJETIVOS
// ---------------------------------------------------------------------------
R.objective=function(){
 var s=R.state(),ls=life()||{},cs=city()||{},vs=C.V3&&C.V3.state?C.V3.state():null,ch=s.chapter;
 if(!s.newJourney)return null;
 if(ch===0)return{tag:'CAPÍTULO 1 • CHEGADA',title:'Conheça o centro',desc:'Saia do Trevo e siga até a Rua Santa Cruz. Seu recomeço começa conhecendo a cidade.',progress:'Destino: Rua Santa Cruz'};
 if(ch===1){var n=Object.keys(s.metPeople).length;return{tag:'CAPÍTULO 1 • CHEGADA',title:'Puxe conversa',desc:'Converse com 3 moradores diferentes. A cidade fica mais fácil quando alguém conhece seu nome.',progress:n+'/3 moradores conhecidos'};}
 if(ch===2)return{tag:'CAPÍTULO 1 • CHEGADA',title:'Um teto por enquanto',desc:'Procure a Hospedagem na Rua Santa Cruz. Você ainda não tem casa para passar a noite.',progress:'Entre na Hospedagem'};
 if(ch===3){var base=Number(s.jobsBaseline||0),done=Math.max(0,Number(cs.jobsDone||0)-base);return{tag:'CAPÍTULO 2 • COMEÇAR DO ZERO',title:'Trabalho honesto',desc:'Faça 2 serviços da cidade. Abra CIDADE, aceite uma tarefa e explore enquanto trabalha.',progress:Math.min(2,done)+'/2 serviços concluídos'};}
 if(ch===4)return{tag:'CAPÍTULO 2 • COMEÇAR DO ZERO',title:'Guarde para o futuro',desc:'Junte '+R.FARM_PRICE+' Cruzeiros. Serviços, pesca, achados e recursos ajudam a levantar o dinheiro.',progress:gold()+'/'+R.FARM_PRICE+' Cruzeiros'};
 if(ch===5)return{tag:'CAPÍTULO 3 • SEU LUGAR',title:'A fazenda abandonada',desc:'Volte ao Trevo e tente entrar na antiga fazenda. Agora você pode negociar a propriedade.',progress:'Procure a porteira da fazenda'};
 if(ch===6){var fish=Number(ls.totals&&ls.totals.fish||0),crops=Number(ls.totals&&ls.totals.crops||0),gath=Number(ls.totals&&ls.totals.gathered||0),craft=Number(vs&&vs.stats&&vs.stats.crafted||0);return{tag:'CAPÍTULO 4 • PRIMEIRA SEMANA',title:'Faça a terra trabalhar',desc:'Pesque 2 peixes, colha 3 produtos, recolha 8 recursos e fabrique pelo menos 1 item.',progress:'Peixes '+Math.min(fish,2)+'/2 • Colheitas '+Math.min(crops,3)+'/3 • Recursos '+Math.min(gath,8)+'/8 • Craft '+Math.min(craft,1)+'/1'};}
 var disc=Object.keys(s.discoveries).length;return{tag:'VIDA EM CAMUTANGA',title:'Construa sua história',desc:'Explore regiões, aumente amizades, melhore ferramentas, complete coleções e acompanhe os acontecimentos da cidade.',progress:'Locais descobertos '+disc+'/'+Object.keys(R.DISCOVERIES).length+' • Reputação '+Number(cs.reputation||0)};
};
R.rewardChapter=function(ch){var s=R.state();if(s.chapterRewards[ch])return;s.chapterRewards[ch]=true;
 if(ch===1){giveGold(25);toast('Chegada ao centro • +25 Cruzeiros.',140);}
 if(ch===2){if(count(41)<1)give(41,1);give(42,5);toast('Um pescador te emprestou uma Vara de Pesca e 5 iscas.',220);}
 if(ch===3){giveGold(70);toast('A dona da hospedagem te indicou alguns serviços • +70 Cruzeiros.',180);}
 if(ch===4){giveGold(120);if(C.City&&C.City.addReputation)C.City.addReputation(5,'primeiros serviços');toast('Você começou a criar nome na cidade • +120 Cruzeiros.',200);}
 if(ch===5)toast('Você já tem como negociar a antiga fazenda no Trevo.',200);
 if(ch===7){s.firstWeekDone=true;give(159,1);giveGold(300);if(C.City&&C.City.addReputation)C.City.addReputation(12,'primeira semana');toast('PRIMEIRA SEMANA CONCLUÍDA • Caixa de Presente + 300 Cruzeiros.',300);}
};
R.setChapter=function(ch){var s=R.state();if(ch<=s.chapter)return;s.chapter=ch;if(ch===3){var cs=city();s.jobsBaseline=cs?Number(cs.jobsDone||0):0;}R.rewardChapter(ch);R.refreshObjective(true);};
R.checkProgress=function(){
 var s=R.state();if(!s.newJourney)return;
 if(s.chapter===0&&$gameMap&&$gameMap.mapId()===R.CITY_ENTRY_MAP)R.setChapter(1);
 if(s.chapter===1&&Object.keys(s.metPeople).length>=3)R.setChapter(2);
 if(s.chapter===2&&s.shelterUnlocked)R.setChapter(3);
 if(s.chapter===3){var cs=city();if(cs&&Number(cs.jobsDone||0)-Number(s.jobsBaseline||0)>=2)R.setChapter(4);}
 if(s.chapter===4&&gold()>=R.FARM_PRICE)R.setChapter(5);
 if(s.chapter===6){var ls=life()||{},v=C.V3&&C.V3.state?C.V3.state():null;if(Number(ls.totals&&ls.totals.fish||0)>=2&&Number(ls.totals&&ls.totals.crops||0)>=3&&Number(ls.totals&&ls.totals.gathered||0)>=8&&Number(v&&v.stats&&v.stats.crafted||0)>=1)R.setChapter(7);}
};

R.ensureHud=function(){
 var el=document.getElementById('cmt-v40-objective');if(!el){el=document.createElement('div');el.id='cmt-v40-objective';el.addEventListener('click',function(){el.classList.toggle('compact');});document.body.appendChild(el);}return el;
};
R.refreshObjective=function(force){
 var el=R.ensureHud(),o=R.objective();if(!o||!isFree()){el.style.display='none';return;}el.style.display='block';var sig=o.tag+'|'+o.title+'|'+o.desc+'|'+o.progress;if(!force&&sig===R._lastHudSig)return;R._lastHudSig=sig;el.innerHTML='<div class="tag">'+esc(o.tag)+'</div><div class="title">'+esc(o.title)+'</div><div class="desc">'+esc(o.desc)+'</div><div class="prog">'+esc(o.progress)+'</div>';
};

R.showLocation=function(name){var el=document.getElementById('cmt-v40-location');if(!el){el=document.createElement('div');el.id='cmt-v40-location';document.body.appendChild(el);}el.textContent=name;el.classList.add('show');clearTimeout(R._locTimer);R._locTimer=setTimeout(function(){el.classList.remove('show');},2200);};

R.MAP_NAMES={2:'Rua Santa Cruz',3:'Casarão Antigo',5:'Sua Fazenda',6:'Casa da Fazenda',7:'Trevo de Camutanga',8:'Região da Igreja',9:'Pedra da Caveira',10:'Interior da Pedra',11:'Praça da Bíblia',14:'Pedro Albuquerque Uchôa',15:'Caminho da Pedra',16:'Vila',17:'Loja de Ferramentas',18:'Barzinho',19:'Cantina',20:'Peixaria',22:'Frutaria',23:'Hospedagem',24:'Casa Abandonada',25:'Caverna de Lava',26:'Floresta de Deterioração',27:'Igreja',28:'Porão da Igreja'};
R.DISCOVERIES={
 2:{name:'Rua Santa Cruz',reward:25},11:{name:'Praça da Bíblia',reward:35},8:{name:'Região da Igreja',reward:30},16:{name:'Vila',reward:35},14:{name:'Pedro Albuquerque Uchôa',reward:35},
 3:{name:'Casarão Antigo',reward:70,item:121},9:{name:'Pedra da Caveira',reward:85,item:136},15:{name:'Caminho da Pedra',reward:55},26:{name:'Floresta de Deterioração',reward:110,item:77},25:{name:'Caverna de Lava',reward:120,item:119},28:{name:'Porão da Igreja',reward:140,item:120}
};
R.discoverMap=function(mid){var s=R.state(),d=R.DISCOVERIES[mid];if(!d||s.discoveries[mid])return;s.discoveries[mid]=true;giveGold(d.reward||0);if(d.item)give(d.item,1);setTimeout(function(){toast('DESCOBERTA: '+d.name+' • +'+d.reward+' Cruzeiros'+(d.item&&item(d.item)?' • '+item(d.item).name:''),260);playSE('Camutanga_CitySparkle',45,112);R.refreshObjective(true);},800);};

// ---------------------------------------------------------------------------
// NPCs procedurais com roupas casuais. Continua usando os cidadãos existentes,
// mas troca somente a imagem por sheets geradas em memória.
// ---------------------------------------------------------------------------
R.NPC_STYLES=[
 {skin:'#8d5a3c',hair:'#251b17',shirt:'#d65c47',pants:'#354f70',shoe:'#2c251f'},
 {skin:'#b8734e',hair:'#3b261a',shirt:'#e8d39a',pants:'#465f45',shoe:'#2d2a25'},
 {skin:'#6e432f',hair:'#171412',shirt:'#4f8fa8',pants:'#56483c',shoe:'#221f1c'},
 {skin:'#c28a68',hair:'#4d2c1d',shirt:'#6f9b58',pants:'#3d4d63',shoe:'#30261f'},
 {skin:'#9a664b',hair:'#1d1715',shirt:'#d9a64c',pants:'#704a3e',shoe:'#2a211c'},
 {skin:'#7b4d36',hair:'#2f201a',shirt:'#b96e91',pants:'#425d6b',shoe:'#211d1a'},
 {skin:'#d09a78',hair:'#6c4127',shirt:'#6d75b8',pants:'#51463b',shoe:'#2d241d'},
 {skin:'#85533b',hair:'#161311',shirt:'#d96f3d',pants:'#304e42',shoe:'#29221e'},
 {skin:'#b97d59',hair:'#2f231c',shirt:'#59a58a',pants:'#524465',shoe:'#27211e'},
 {skin:'#70452f',hair:'#141210',shirt:'#c9873f',pants:'#3c566c',shoe:'#1f1c19'},
 {skin:'#cf9671',hair:'#5a3321',shirt:'#8d6eb0',pants:'#496044',shoe:'#2e251f'},
 {skin:'#945f43',hair:'#332017',shirt:'#4f86c6',pants:'#6b513f',shoe:'#27211d'}
];
R._npcBitmaps={};
R.makeNpcBitmap=function(name){
 if(R._npcBitmaps[name])return R._npcBitmaps[name];
 var idx=Number(String(name).replace(/\D/g,''))||0,sp=R.NPC_STYLES[idx%R.NPC_STYLES.length],b=new Bitmap(144,192),px=2;
 function rect(x,y,w,h,col){b.fillRect(x,y,w,h,col);}
 function frame(ox,oy,dir,pat){
   var step=pat===0?-1:pat===2?1:0,bob=pat===1?0:-1,side=(dir===1?-1:dir===2?1:0),back=dir===3;
   // sombra integrada bem suave
   rect(ox+15,oy+43,18,3,'rgba(0,0,0,.18)');
   // pernas / tênis
   rect(ox+18+step,oy+32+bob,5,10,sp.pants);rect(ox+26-step,oy+32+bob,5,10,sp.pants);
   rect(ox+16+step,oy+41+bob,8,4,sp.shoe);rect(ox+25-step,oy+41+bob,8,4,sp.shoe);
   // tronco casual
   rect(ox+16+side,oy+19+bob,17,16,sp.shirt);rect(ox+13+side,oy+22+bob,4,10,sp.skin);rect(ox+33+side,oy+22+bob,4,10,sp.skin);
   // cabeça
   rect(ox+18+side,oy+8+bob,13,12,sp.skin);rect(ox+17+side,oy+7+bob,15,5,sp.hair);rect(ox+18+side,oy+5+bob,12,4,sp.hair);
   if(!back){var ex=dir===1?19:dir===2?28:21;rect(ox+ex+side,oy+13+bob,2,2,'#1b1715');if(dir===0)rect(ox+27+side,oy+13+bob,2,2,'#1b1715');}
   // detalhes de roupa: gola e bolso/mochila ocasional
   rect(ox+22+side,oy+20+bob,5,2,'rgba(255,255,255,.22)');
   if(idx%4===1)rect(ox+27+side,oy+26+bob,4,4,'rgba(255,255,255,.18)');
   if(idx%5===2&&back)rect(ox+18,oy+20+bob,13,13,'#5a3f2b');
 }
 for(var d=0;d<4;d++)for(var p=0;p<3;p++)frame(p*48,d*48,d,p);
 if(b._setDirty)b._setDirty();R._npcBitmaps[name]=b;return b;
};
if(window.ImageManager){var _loadChar40=ImageManager.loadCharacter;ImageManager.loadCharacter=function(filename,hue){if(/^\$CMT40_/i.test(String(filename||'')))return R.makeNpcBitmap(filename);return _loadChar40.call(this,filename,hue);};}
if(C.City){
 var City=C.City;City.SPRITES=[];for(var si=0;si<R.NPC_STYLES.length;si++)City.SPRITES.push('$CMT40_'+si);
 var _makeCitizen40=City.makeCitizen;City.makeCitizen=function(id,role,used,stationary){var ch=_makeCitizen40.call(City,id,role,used,stationary),d=ch&&ch._cityData;if(!d)return ch;var n=hash(d.mapId||0,id||0,404)%R.NPC_STYLES.length;if(d.role==='taxi')n=9;else if(d.role==='vendorFood')n=4;else if(d.role==='vendorMarket')n=1;else if(d.role==='vendorFish')n=2;else if(d.role==='agent')n=6;else if(d.role==='musician')n=8;d.sheet='$CMT40_'+n;d.index=0;ch.setImage(d.sheet,0);return ch;};
}

// ---------------------------------------------------------------------------
// Diálogos: amplia o repertório e deixa Camutanga menos genérica.
// ---------------------------------------------------------------------------
if(C.Social35){var S=C.Social35;
 function addLines(obj,key,arr){obj[key]=obj[key]||[];for(var i=0;i<arr.length;i++)if(obj[key].indexOf(arr[i])<0)obj[key].push(arr[i]);}
 addLines(S.mapLines,2,['A Rua Santa Cruz é onde você resolve metade da vida sem precisar ir longe.','Se estiver procurando trabalho, sempre aparece alguém precisando de ajuda por aqui.','Quando a feira chega, essa rua muda completamente de cara.']);
 addLines(S.mapLines,7,['Foi por esse Trevo que muita gente chegou e acabou ficando.','Tem uma propriedade antiga ali perto. Dizem que está à venda faz tempo.','De manhã cedo passa gente indo trabalhar e no fim da tarde todo mundo volta por aqui.']);
 addLines(S.mapLines,11,['Senta um pouco na praça que você acaba sabendo das novidades.','Às vezes aparece música, jogo e vendedor diferente aqui sem aviso.','A praça fica outra cidade quando tem evento.']);
 addLines(S.mapLines,16,['Na Vila o povo empresta ferramenta, troca muda e depois cobra em conversa.','Tem gente aqui que sabe onde achar recurso que não aparece no centro.']);
 addLines(S.personalityLines,'trabalhador',['Se topar serviço pequeno, dá para levantar um dinheiro bom sem sair da cidade.','Ferramenta boa custa caro, mas economiza braço e energia.']);
 addLines(S.personalityLines,'curioso',['Já entrou no casarão? Eu não iria sozinho depois que escurece.','Tem canto da floresta que parece diferente depois de chuva forte.']);
 addLines(S.personalityLines,'brincalhão',['Chegou com uma mochila e já quer virar fazendeiro? Gostei da coragem!','Se encontrar ouro no quintal, metade é minha pela informação, viu?']);
 addLines(S.personalityLines,'calmo',['No começo parece que não tem nada para fazer. Depois você percebe que falta hora no dia.','Vai conhecendo um canto por vez. A cidade se abre para quem presta atenção.']);
 // Mais acontecimentos usam a infraestrutura existente (frutas/caixas/luzes/ervas).
 var extras=[
  {id:'mangachuva',name:'Fruta no Chão',maps:[2,7,11,14,16],start:7,end:18,talk:'O vento derrubou manga e caju em alguns cantos.',desc:'Frutas frescas caíram pela cidade. Procure os marcadores FRUTA.'},
  {id:'achados',name:'Caixas de Mudança',maps:[2,7,14],start:8,end:18,talk:'Umas caixas caíram de uma carroça mais cedo.',desc:'Materiais ficaram espalhados pela rua. Quem encontrar pode aproveitar.'},
  {id:'luazinha',name:'Clarões na Noite',maps:[8,11,16],start:20,end:24,talk:'Ontem apareceu um brilho esquisito perto dali...',desc:'Luzes estranhas surgem à noite e deixam pequenos achados.'}
 ];
 for(var ex=0;ex<extras.length;ex++){var found=false;for(var ee=0;ee<S.EVENTS.length;ee++)if(S.EVENTS[ee].id===extras[ex].id)found=true;if(!found)S.EVENTS.push(extras[ex]);}
 // Acrescenta conteúdo físico para os novos eventos.
 var _prep40=C.City&&C.City.prepareRuntime; if(_prep40){C.City.prepareRuntime=function(){_prep40.call(C.City);var r=C.City._runtime;if(!r||!r.spots)return;var evs=S.activeEvents(),i,z,p,key,e;for(z=0;z<evs.length;z++){e=evs[z];if(e.id==='mangachuva'){for(i=0;i<5;i++){key=e.key+':fruit:'+i;if(S.state().eventDone[key])continue;p=C.City.pickTile(($gameMap.mapId()*15100)+day()*73+i*67,r.used);r.used.push(p);r.spots.push({key:key,type:'socialFruit',x:p.x,y:p.y,icon:[267,266,271,264][i%4],label:'FRUTA',eventKey:e.key});}}else if(e.id==='achados'){for(i=0;i<3;i++){key=e.key+':crate:'+i;if(S.state().eventDone[key])continue;p=C.City.pickTile(($gameMap.mapId()*15200)+day()*79+i*71,r.used);r.used.push(p);r.spots.push({key:key,type:'socialCrate',x:p.x,y:p.y,icon:176,label:'CAIXA',eventKey:e.key});}}else if(e.id==='luazinha'){for(i=0;i<3;i++){key=e.key+':light:'+i;if(S.state().eventDone[key])continue;p=C.City.pickTile(($gameMap.mapId()*15300)+day()*83+i*61,r.used);r.used.push(p);r.spots.push({key:key,type:'socialLight',x:p.x,y:p.y,icon:190,label:'LUZ',eventKey:e.key});}}}};}
}

// ---------------------------------------------------------------------------
// Recursos no chão / uso mais claro
// ---------------------------------------------------------------------------
R.spawnForage=function(){
 if(!isFree()||!C.World||!$gameMap||!C.World.isOutdoor||!C.World.isOutdoor())return;
 var mid=$gameMap.mapId(),s=R.state(),key=day()+':'+mid;if(s.forageSpawned[key])return;s.forageSpawned[key]=true;
 var pool=(mid===25)?[35,35,36,61,74,119]:(mid===26)?[53,54,59,64,65,66,67,68]:[54,55,59,64,66,67,68,69,35];
 var n=(mid===26?8:(mid===25?6:4));
 for(var i=0;i<n;i++)for(var t=0;t<60;t++){var x=2+hash(day()+i,t,mid)%Math.max(1,$gameMap.width()-4),y=2+hash(day()+mid,t,i+9)%Math.max(1,$gameMap.height()-4);if(C.World.goodNodeTile&&C.World.goodNodeTile(x,y,mid)&&!C.World.nodeAt(mid,x,y)){C.World.spawnDrop(pool[hash(mid,i,t)%pool.length],x,y,1);break;}}
};
R.autoPickup=function(){
 if(!C.World||!$gameMap||!$gamePlayer||Graphics.frameCount-R._lastAutoPickup<8)return;R._lastAutoPickup=Graphics.frameCount;
 var arr=C.World.dropState?C.World.dropState($gameMap.mapId()):[];for(var i=0;i<arr.length;i++){var d=arr[i];if(d&&!d.collected&&d.tx===$gamePlayer.x&&d.ty===$gamePlayer.y){C.World.collectDrop(d);break;}}
};
R.contextText=function(){
 if(!isFree()||!$gameMap||!$gamePlayer)return'';
 var action=isTouch()?'AÇÃO':'F',p=C.frontTile?C.frontTile():{x:$gamePlayer.x,y:$gamePlayer.y};
 if(C.World){var drops=C.World.dropState?C.World.dropState($gameMap.mapId()):[];for(var i=0;i<drops.length;i++){var dr=drops[i];if(dr&&!dr.collected&&((dr.tx===p.x&&dr.ty===p.y)||(dr.tx===$gamePlayer.x&&dr.ty===$gamePlayer.y))){var it=item(dr.itemId);return action+' • PEGAR '+(it?it.name.toUpperCase():'ITEM');}}
   if(C.World.findStaticTree&&C.World.findStaticTree(p.x,p.y))return action+' • CORTAR ÁRVORE  |  Machado';
   if(C.World.nodeAt){var nd=C.World.nodeAt($gameMap.mapId(),p.x,p.y);if(nd){if(nd.type==='tree')return action+' • CORTAR ÁRVORE  |  '+nd.hp+'/'+nd.maxHp;if(nd.type==='rock')return action+' • QUEBRAR ROCHA  |  '+nd.hp+'/'+nd.maxHp;return action+' • COLETAR VEGETAÇÃO';}}
 }
 if(C.City&&C.City.nearestCitizen&&C.City.CITY_MAPS.indexOf($gameMap.mapId())>=0){var ch=C.City.nearestCitizen(1.35);if(ch&&ch._cityData)return(isTouch()?'AÇÃO':'ENTER')+' • CONVERSAR COM '+String(ch._cityData.name||'MORADOR').toUpperCase();}
 if($gameMap.mapId()===R.INN_MAP&&R.state().shelterUnlocked&&!R.state().farmOwned)return action+' • DESCANSAR NA HOSPEDAGEM';
 return'';
};
R.updateContext=function(){var el=document.getElementById('cmt-v40-context');if(!el){el=document.createElement('div');el.id='cmt-v40-context';document.body.appendChild(el);}var t=R.contextText();if(t!==R._lastContext){R._lastContext=t;el.textContent=t;}if(t)el.classList.add('show');else el.classList.remove('show');};

// ---------------------------------------------------------------------------
// Crafting extra: faz recurso básico ter utilidade desde o primeiro dia.
// ---------------------------------------------------------------------------
if(C.V3&&C.V3.recipes){var V=C.V3;
 function recipeExists(id){for(var i=0;i<V.recipes.length;i++)if(V.recipes[i].id===id)return true;return false;}
 var more=[
  {id:'campfire40',name:'Fogueira de Quintal',out:161,qty:1,need:[[53,4],[59,3],[35,2]],station:'Oficina',desc:'Descanso e calor na propriedade.'},
  {id:'restbench40',name:'Banco de Madeira',out:162,qty:1,need:[[149,4],[53,2]],station:'Oficina',desc:'Um canto simples para recuperar energia.'},
  {id:'baitbundle40',name:'Isca Caseira',out:169,qty:4,need:[[55,2],[54,2]],station:'Oficina',desc:'Transforma minhoca e fibra em iscas para pesca.'},
  {id:'repair40',name:'Kit de Reparo',out:100,qty:1,need:[[149,2],[96,1],[150,1]],station:'Oficina',desc:'Material útil para serviços e futuras melhorias.'}
 ];
 for(var mr=0;mr<more.length;mr++)if(!recipeExists(more[mr].id))V.recipes.unshift(more[mr]);
 var _objBmp40=V.objectBitmap;V.objectBitmap=function(type){if(type!=='campfire'&&type!=='restbench')return _objBmp40.call(V,type);if(V.objectBitmapCache&&V.objectBitmapCache[type])return V.objectBitmapCache[type];var b=new Bitmap(48,58);function r(x,y,w,h,c){b.fillRect(x,y,w,h,c);}r(7,50,34,4,'rgba(0,0,0,.2)');if(type==='campfire'){r(14,42,22,5,'#6f4829');r(18,37,14,5,'#8e5b30');r(21,23,8,18,'#f1aa34');r(18,29,14,11,'#e45a2c');r(23,18,5,12,'#ffd65f');}else{r(6,30,36,7,'#9b6537');r(8,24,32,6,'#b77a43');r(10,37,5,16,'#55341f');r(33,37,5,16,'#55341f');}if(b._setDirty)b._setDirty();if(V.objectBitmapCache)V.objectBitmapCache[type]=b;return b;};
 var _interactPlaced40=V.interactPlaced;V.interactPlaced=function(){if(!$gameMap)return false;var p=C.frontTile(),o=V.objectAt&&V.objectAt($gameMap.mapId(),p.x,p.y);if(o&&o.type==='campfire'){var ls=life();if(ls){ls.stamina=Math.min(ls.maxStamina||100,Number(ls.stamina||0)+10);}if($gameVariables)$gameVariables.setValue(3,Number($gameVariables.value(3)||0)+10);playSE('Camutanga_Craft',35,90);toast('Você descansou junto à fogueira • +10 energia • 10 min.',100);return true;}if(o&&o.type==='restbench'){var ls2=life();if(ls2){ls2.stamina=Math.min(ls2.maxStamina||100,Number(ls2.stamina||0)+14);}if($gameVariables)$gameVariables.setValue(3,Number($gameVariables.value(3)||0)+15);toast('Uma pausa rápida • +14 energia • 15 min.',100);return true;}return _interactPlaced40.call(V);};
}

// ---------------------------------------------------------------------------
// Bloqueio temático da fazenda até a compra (somente NOVA VIDA).
// ---------------------------------------------------------------------------
function transferOfEvent(ev){try{var pg=ev&&ev.page?ev.page():null,list=pg&&pg.list?pg.list:[];for(var i=0;i<list.length;i++){var c=list[i];if(c&&c.code===201){var p=c.parameters;if(p[0]===0)return{mapId:Number(p[1]||0),x:Number(p[2]||0),y:Number(p[3]||0)};if($gameVariables)return{mapId:Number($gameVariables.value(Number(p[1]||0))||0),x:Number($gameVariables.value(Number(p[2]||0))||0),y:Number($gameVariables.value(Number(p[3]||0))||0)};}}}catch(e){}return null;}
var _eventStart40=Game_Event.prototype.start;Game_Event.prototype.start=function(){var s=R.state();if(isFree()&&s.newJourney&&!s.farmOwned){var d=transferOfEvent(this);if(d&&d.mapId===R.FARM_MAP){if(s.chapter>=5)R.openFarmPurchase();else toast('A propriedade está à venda. Primeiro arrume um teto, trabalhe e junte dinheiro.',190);return;}}return _eventStart40.call(this);};

// Hospedagem funciona no menu e também pelo botão de ação.
if(window.Scene_CamutangaInventory26){var _runSystem40=Scene_CamutangaInventory26.prototype.runSystem;Scene_CamutangaInventory26.prototype.runSystem=function(e){if(e&&e.cmd==='sleep'&&R.sleepAtInn())return;return _runSystem40.call(this,e);};}
if(C.lifeAction){var _lifeAction40=C.lifeAction;C.lifeAction=function(){if(isFree()&&R.state().newJourney&&!R.state().farmOwned&&$gameMap&&$gameMap.mapId()===R.INN_MAP&&R.state().shelterUnlocked){R.sleepAtInn();return;}return _lifeAction40.call(C);};}

// Conversas contam para a jornada inicial.
if(C.City&&C.City.talk){var _talk40=C.City.talk;C.City.talk=function(ch){var ok=_talk40.call(C.City,ch),s=R.state(),d=ch&&ch._cityData||{};if(ok&&s.newJourney&&s.chapter===1&&['agent','taxi','vendorFood','vendorMarket','vendorFish','recipient','musician','eventNpc'].indexOf(d.role)<0){var key=(d.mapId||($gameMap?$gameMap.mapId():0))+':'+(d.id||0)+':'+(d.name||'');s.metPeople[key]=true;R.checkProgress();R.refreshObjective(true);}return ok;};}
if(C.City&&C.City.completeJob){var _completeJob40=C.City.completeJob;C.City.completeJob=function(j){var r=_completeJob40.call(C.City,j);R.checkProgress();R.refreshObjective(true);return r;};}

// ---------------------------------------------------------------------------
// Ciclo de mapas / atualização principal
// ---------------------------------------------------------------------------
R.onMapStart=function(){
 if(!$gameMap)return;var mid=$gameMap.mapId();R._lastMap=mid;
 if(isFree()){R.showLocation(R.MAP_NAMES[mid]||($dataMap&&$dataMap.displayName)||'Camutanga');R.discoverMap(mid);R.spawnForage();R.checkProgress();
   var s=R.state();if(s.newJourney&&mid===R.INN_MAP&&s.chapter===2&&!s.shelterUnlocked)setTimeout(function(){if(!(C.Social35&&C.Social35._nameOpen))R.openInn();},550);
   setTimeout(function(){R.openArrival();},650);
 }
 R.refreshObjective(true);R.updateContext();
};
var _sceneStart40=Scene_Map.prototype.start;Scene_Map.prototype.start=function(){_sceneStart40.call(this);R.onMapStart();};
var _sceneUpdate40=Scene_Map.prototype.update;Scene_Map.prototype.update=function(){_sceneUpdate40.call(this);if(!isFree())return;if(Graphics.frameCount%15===0){R.checkProgress();R.refreshObjective(false);R.updateContext();}R.autoPickup();if(R.state().newJourney&&!R.state().introSeen&&!R._introOpen&&Graphics.frameCount%30===0)R.openArrival();};

// Movimento fica travado durante modais V4.
var _canMove40=Game_Player.prototype.canMove;Game_Player.prototype.canMove=function(){if(R._introOpen||R._farmOpen||R._innOpen)return false;return _canMove40.call(this);};



// ---------------------------------------------------------------------------
// V4.0 POLIMENTO: progressão, recursos claros e fazenda realmente conquistada
// ---------------------------------------------------------------------------
R.RESOURCE_HELP={
  35:'Pedra: usada em construções, forno, caminhos e encomendas.',
  36:'Ferro: refine em barras para melhorar ferramentas e construções.',
  53:'Madeira: base de baús, cercas, móveis e construções.',
  54:'Fibra: usada em corda, isca caseira e receitas de oficina.',
  55:'Minhoca: serve como isca para pesca.',
  59:'Galho: útil em fogueira, reparos e crafting simples.',
  60:'Seiva: material raro para receitas e melhorias.',
  61:'Carvão: combustível para forno e refino.',
  62:'Argila: material de construção e serviços da cidade.',
  64:'Erva Medicinal: pode ser consumida para recuperar energia.',
  65:'Cogumelo: alimento/coleta; guarde para cozinha e pedidos.',
  66:'Caju: alimento e ingrediente regional.',
  67:'Manga: alimento, venda e receitas.',
  68:'Acerola: alimento, venda e receitas.',
  69:'Coco: recupera energia e entra em receitas.',
  74:'Cobre: material de melhoria e refino.',
  75:'Ouro: minério raro para melhorias avançadas.',
  76:'Madeira Nobre: construção e upgrades avançados.',
  77:'Cristal: gema rara para venda, coleção e receitas.',
  96:'Barra de Ferro: upgrade de ferramentas e construções.',
  119:'Geodo: use pela mochila para abrir e revelar um mineral.',
  120:'Fóssil: item raro de exploração e coleção.',
  121:'Moeda Antiga: achado histórico; vale guardar para coleções/eventos.',
  122:'Mapa do Tesouro: deixe ativo e use AÇÃO em área externa.',
  123:'Pérola: tesouro raro encontrado na pesca.',
  136:'Quartzo: gema de crafting e coleção.',
  149:'Tábua: componente de móveis e estruturas.',
  150:'Corda: componente de ferramentas, pesca e construções.'
};
R.resourceHelp=function(id){return R.RESOURCE_HELP[Number(id||0)]||'Recurso de Camutanga: guarde para crafting, encomendas, venda ou melhorias.';};

// A fazenda passa a ser um destino conquistado, não um atalho que quebra a introdução.
if(C.City&&C.City.travel){
 var _travel40=C.City.travel;
 C.City.travel=function(dest){
   var s=R.state();
   if(s.newJourney&&!s.farmOwned&&dest&&Number(dest.mapId)===R.FARM_MAP){toast('Você ainda não comprou a antiga fazenda. Vá até a porteira no Trevo quando juntar '+R.FARM_PRICE+' Cruzeiros.',180);try{SoundManager.playBuzzer();}catch(e){}return false;}
   return _travel40.call(C.City,dest);
 };
 for(var ti=0;ti<C.City.TRAVEL.length;ti++)if(Number(C.City.TRAVEL[ti].mapId)===R.FARM_MAP)C.City.TRAVEL[ti].name='Fazenda';
}

// Recursos podem ser colocados de volta no chão. Isto torna a mochila e o mundo
// físico coerentes: tocar no recurso no inventário = soltar 1 unidade à frente.
if(C.useInventoryItem){
 var _useInv40=C.useInventoryItem;
 C.useInventoryItem=function(it){
   var resource=it&&C.noteTag?C.noteTag(it,'resource'):null;
   if(it&&resource!==null&&resource!==false&&$gameParty&&$gameParty.hasItem(it)){
     if(!$gameMap||!$gamePlayer||!C.World||!C.World.spawnDrop){toast('Este recurso precisa ser usado durante a exploração.',110);return true;}
     var p=C.frontTile?C.frontTile():{x:$gamePlayer.x,y:$gamePlayer.y};
     var blocked=($gameMap.eventsXy&&$gameMap.eventsXy(p.x,p.y).length)||(C.World.nodeAt&&C.World.nodeAt($gameMap.mapId(),p.x,p.y));
     if(blocked||!$gameMap.isValid(p.x,p.y)){toast('Não há espaço para colocar isso aqui.',100);try{SoundManager.playBuzzer();}catch(e){}return true;}
     $gameParty.loseItem(it,1);C.World.spawnDrop(it.id,p.x,p.y,1);if(C.setHeroPose)C.setHeroPose('gather',28);if(C.showHeldItem)C.showHeldItem(it.id,55);toast(it.name+' colocado no chão. '+R.resourceHelp(it.id),180);try{SoundManager.playCursor();}catch(e){}return true;
   }
   return _useInv40.call(C,it);
 };
}

// O botão da mochila explica a ação para recursos físicos.
if(window.Scene_CamutangaInventory26){
 var _actionLabel40b=Scene_CamutangaInventory26.prototype.actionLabel;
 Scene_CamutangaInventory26.prototype.actionLabel=function(it){if(it&&C.noteTag&&C.noteTag(it,'resource')!==null)return 'COLOCAR 1 NO CHÃO';return _actionLabel40b.call(this,it);};
}

// Ao pegar um recurso pela primeira vez, ensina para que ele serve sem abrir tutorial enorme.
if(C.World&&C.World.collectDrop){
 var _collectDrop40=C.World.collectDrop;
 C.World.collectDrop=function(drop){
   var id=drop?Number(drop.itemId||0):0,it=item(id),s=R.state(),first=!!(it&&!s.tips['resource:'+id]);
   var ok=_collectDrop40.call(C.World,drop);
   if(ok&&first){s.tips['resource:'+id]=true;setTimeout(function(){toast(R.resourceHelp(id),210);},300);}
   return ok;
 };
}

R.MAP_TIPS={
  2:'Centro: serviços, comércio, hospedagem e gente para conhecer.',
  7:'Trevo: acesso à antiga fazenda e rotas da cidade.',
  8:'Igreja: movimento aos domingos e pistas para quem gosta de mistério.',
  9:'Pedra da Caveira: explore com atenção; há materiais e segredos raros.',
  11:'Praça: eventos, feira, futebol, música e encontros.',
  14:'Pedro Albuquerque Uchôa: moradores, coletas e serviços urbanos.',
  16:'Vila: recursos, conversas e acontecimentos de bairro.',
  25:'Caverna de Lava: mineração difícil, geodos e minérios valiosos.',
  26:'Floresta: madeira, ervas, cogumelos e achados após a chuva.',
  28:'Porão: região de exploração ligada aos mistérios da cidade.'
};
var _discoverMap40=R.discoverMap;
R.discoverMap=function(mid){var before=!!R.state().discoveries[mid];_discoverMap40.call(R,mid);if(!before&&R.MAP_TIPS[mid])setTimeout(function(){toast(R.MAP_TIPS[mid],230);},1500);};

// Entrada da hospedagem também ganha população leve e contexto, sem transformar
// o interior em multidão.
if(C.City&&C.City.CITY_MAPS&&C.City.CITY_MAPS.indexOf(R.INN_MAP)<0){
 C.City.CITY_MAPS.push(R.INN_MAP);
 C.City.MAP_PROFILES[R.INN_MAP]={name:'Hospedagem',density:3,lamps:0};
}

// Atualiza texto global de versão.
C.version='4.0.0';

})();

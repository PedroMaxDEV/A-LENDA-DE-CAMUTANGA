/*:
 * @plugindesc [v3.0] Camutanga Mundo Vivo - crafting, cozinha, hotbar, economia, calendário, conquistas, armazenamento, relacionamentos e ambience.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Este plugin complementa CamutangaLife/World/UI26 e foi feito para PC e celular.
 * Não depende de WindowLayer para as novas interfaces.
 *
 * Teclas PC:
 *  1-8: hotbar
 *  C: oficina
 *  B: baú (na base)
 *  J: diário
 */
(function(){
'use strict';
window.Camutanga=window.Camutanga||{};
var C=window.Camutanga;
var V=C.V3=C.V3||{};
V.VERSION='3.0.0';
V.BASE_MAPS=[5,6];
V.OUTDOOR_MAPS=(C.World&&C.World.OUTDOOR_MAPS)||[2,5,7,8,9,11,14,15,16,25,26];

Input.keyMapper[49]='hot1';Input.keyMapper[50]='hot2';Input.keyMapper[51]='hot3';Input.keyMapper[52]='hot4';
Input.keyMapper[53]='hot5';Input.keyMapper[54]='hot6';Input.keyMapper[55]='hot7';Input.keyMapper[56]='hot8';
Input.keyMapper[67]='v3craft'; // C
Input.keyMapper[66]='v3chest'; // B
Input.keyMapper[74]='v3journal'; // J

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function pad(n){return n<10?'0'+n:String(n);}
function note(item,tag){return C.noteTag?C.noteTag(item,tag):null;}
function day(){return C.dayKey?C.dayKey():0;}
function clock(){return C.gameClock?C.gameClock():{day:1,hour:6,minute:0,raw:0};}
function item(id){return window.$dataItems?$dataItems[Number(id||0)]:null;}
function count(id){var it=item(id);return it&&window.$gameParty?$gameParty.numItems(it):0;}
function has(id,n){return count(id)>=(n||1);}
function gain(id,n){var it=item(id);if(it&&window.$gameParty)$gameParty.gainItem(it,n||1);}
function lose(id,n){var it=item(id);if(it&&window.$gameParty)$gameParty.loseItem(it,n||1);}
function rand(seed){var x=Math.sin(seed*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
function isOutdoor(){return window.$gameMap&&V.OUTDOOR_MAPS.indexOf($gameMap.mapId())>=0;}
function toast(t,f){if(C.toast)C.toast(t,f||150);}

V.defaultState=function(){return{
 version:V.VERSION,hotbar:[57,58,43,44,41,42,46,56],hotIndex:0,storage:{},stats:{steps:0,crafted:0,cooked:0,wood:0,rocks:0,fish:0,crops:0,days:0,disasters:0,goldEarned:0,itemsPicked:0},
 achievements:{},relationships:{},talkedToday:{},economy:{day:-1,mults:{}},calendar:{lastDay:-1,event:null,dailyMessage:false},
 buffs:{},fertilized:{},placed:{sprinklers:[],scarecrows:[]},treasure:{},tutorial:{welcome:false,hotbar:false,craft:false},autosaveDay:-1
};};
V.state=function(){
 if(!$gameSystem)return V.defaultState();
 if(!$gameSystem._camutangaV3)$gameSystem._camutangaV3=V.defaultState();
 var s=$gameSystem._camutangaV3,d=V.defaultState(),k;
 for(k in d)if(s[k]==null)s[k]=d[k];
 if(!Array.isArray(s.hotbar))s.hotbar=d.hotbar.slice();while(s.hotbar.length<8)s.hotbar.push(0);
 ['stats','achievements','relationships','talkedToday','economy','calendar','buffs','fertilized','placed','treasure','tutorial'].forEach(function(x){if(!s[x])s[x]=d[x];});
 if(!s.storage)s.storage={};
 return s;
};

// ---------------------------------------------------------------------------
// Calendário, estação climática, lua e economia diária
// ---------------------------------------------------------------------------
V.monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
V.weekNames=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
V.calendarInfo=function(){
 var dk=day(),dayNo=dk+1,month=Math.floor((dayNo-1)/28)%12,dom=((dayNo-1)%28)+1,year=Math.floor((dayNo-1)/(28*12))+1;
 var wet=[0,1,2,3,4,5,11].indexOf(month)>=0;
 return{dayKey:dk,day:dayNo,dayOfMonth:dom,month:month,monthName:V.monthNames[month],year:year,weekDay:V.weekNames[(dayNo-1)%7],season:wet?'Tempo das Chuvas':'Tempo Seco',wet:wet};
};
V.moonInfo=function(){
 var phase=((day()+1)%28)/28,idx=Math.floor(phase*8)%8,names=['Nova','Crescente fina','Quarto crescente','Gibosa crescente','Cheia','Gibosa minguante','Quarto minguante','Minguante fina'];
 return{name:names[idx],index:idx,phase:phase,full:idx===4,newMoon:idx===0};
};
V.temperature=function(){
 var cal=V.calendarInfo(),h=clock().hour,base=cal.wet?27:31;if(h<6)base-=5;else if(h<10)base-=2;else if(h>=12&&h<16)base+=3;else if(h>=18)base-=2;
 var w=C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear';if(w==='rain')base-=3;if(w==='storm')base-=5;if(w==='fog')base-=2;
 return Math.round(base+Math.sin((day()+3)*1.71)*2);
};
V.festivalForDay=function(dk){
 var n=(dk+1)%28;if(n===7)return{id:'feira',name:'Feira Livre',desc:'Produtos e colheitas valem mais hoje.'};
 if(n===14)return{id:'pesca',name:'Torneio de Pesca',desc:'Peixes rendem bônus e capturas raras ficam mais comuns.'};
 if(n===21)return{id:'mutirao',name:'Mutirão Comunitário',desc:'Coleta e madeira rendem experiência extra.'};
 if(n===0)return{id:'lenda',name:'Noite das Lendas',desc:'À noite, fenômenos raros podem acontecer.'};
 return null;
};
V.refreshEconomy=function(force){
 var s=V.state(),dk=day();if(!force&&s.economy.day===dk)return;
 s.economy.day=dk;s.economy.mults={fish:.85+rand(dk*17+1)*.45,crop:.88+rand(dk*17+2)*.32,resource:.90+rand(dk*17+3)*.28,food:.95+rand(dk*17+4)*.24};
 var fest=V.festivalForDay(dk);if(fest&&fest.id==='feira'){s.economy.mults.crop*=1.18;s.economy.mults.food*=1.12;}if(fest&&fest.id==='pesca')s.economy.mults.fish*=1.22;
};
V.priceMultiplier=function(it){
 V.refreshEconomy(false);if(!it)return 1;var key='resource';
 if(note(it,'fish')!==null||[23,24,25,26,70,71,72,73,124,125,126,127].indexOf(it.id)>=0)key='fish';
 else if(note(it,'crop')!==null)key='crop';else if(note(it,'stamina')!==null)key='food';
 return Number(V.state().economy.mults[key]||1);
};
V.forecast=function(offset){
 offset=Number(offset||0);var d=day()+offset;if(C.World&&C.World.weatherForDay)return C.World.WEATHER_NAMES[C.World.weatherForDay(d)]||C.World.weatherForDay(d);return 'Ensolarado';
};

// ---------------------------------------------------------------------------
// Progressão adicional, conquistas e estatísticas
// ---------------------------------------------------------------------------
V.skillName=function(k){var names={woodcutting:'Lenhador',mining:'Mineração',cooking:'Culinária',crafting:'Artesanato'};return names[k]|| (C.skillName?C.skillName(k):k);};
V.ensureSkills=function(){var s=C.state?C.state():null;if(!s)return;['woodcutting','mining','cooking','crafting'].forEach(function(k){if(!s.skills[k])s.skills[k]={level:1,xp:0};});};
V.gainSkill=function(k,xp){V.ensureSkills();var s=C.state(),sk=s.skills[k];sk.xp+=Math.max(0,Math.floor(xp||0));var leveled=false;while(sk.xp>=90+sk.level*55){sk.xp-=90+sk.level*55;sk.level++;leveled=true;}if(leveled){s.maxStamina+=1;s.stamina=Math.min(s.maxStamina,s.stamina+8);toast(V.skillName(k)+' chegou ao nível '+sk.level+'! Energia máxima +1',220);if(window.SoundManager)SoundManager.playRecovery();}};
V.achievementDefs={
 firstFish:{name:'Primeira Fisgada',desc:'Pesque seu primeiro peixe.'},wood25:{name:'Lenhador',desc:'Derrube 25 árvores.'},rock25:{name:'Pedra por Pedra',desc:'Quebre 25 rochas.'},craft10:{name:'Mãos à Obra',desc:'Construa 10 itens.'},cook10:{name:'Cozinha de Casa',desc:'Prepare 10 receitas.'},rich:{name:'Vida Boa',desc:'Tenha 10.000 Cruzeiros.'},week:{name:'Uma Semana em Camutanga',desc:'Viva 7 dias.'},month:{name:'Um Mês de Histórias',desc:'Viva 28 dias.'},collector:{name:'Colecionador',desc:'Descubra 8 espécies de peixe.'},survivor:{name:'Sobrevivente',desc:'Presencie um desastre natural.'}
};
V.unlock=function(id){var s=V.state();if(s.achievements[id])return;s.achievements[id]=true;var d=V.achievementDefs[id];if(d){toast('CONQUISTA: '+d.name,260);if(window.SoundManager)SoundManager.playRecovery();}};
V.checkAchievements=function(){var s=V.state(),life=C.state?C.state():null;if(s.stats.fish>=1)V.unlock('firstFish');if(s.stats.wood>=25)V.unlock('wood25');if(s.stats.rocks>=25)V.unlock('rock25');if(s.stats.crafted>=10)V.unlock('craft10');if(s.stats.cooked>=10)V.unlock('cook10');if(window.$gameParty&&$gameParty.gold()>=10000)V.unlock('rich');if(day()>=6)V.unlock('week');if(day()>=27)V.unlock('month');if(life&&life.collections&&life.collections.fish&&Object.keys(life.collections.fish).length>=8)V.unlock('collector');if(s.stats.disasters>=1)V.unlock('survivor');};

// ---------------------------------------------------------------------------
// Crafting e cozinha
// ---------------------------------------------------------------------------
V.recipes=[
 {id:'plank',name:'Tábua',out:149,qty:2,need:[[53,2]],station:'Oficina',desc:'Transforma madeira em tábuas.'},
 {id:'rope',name:'Corda',out:150,qty:1,need:[[54,3]],station:'Oficina',desc:'Fibra torcida para construção e pesca.'},
 {id:'charcoal',name:'Carvão Vegetal',out:148,qty:2,need:[[53,3]],station:'Forno',desc:'Combustível artesanal.'},
 {id:'copperbar',name:'Barra de Cobre',out:97,qty:1,need:[[74,3],[148,1]],station:'Forno',desc:'Metal refinado.'},
 {id:'ironbar',name:'Barra de Ferro',out:96,qty:1,need:[[36,3],[148,1]],station:'Forno',desc:'Metal refinado.'},
 {id:'goldbar',name:'Barra de Ouro',out:98,qty:1,need:[[75,3],[148,2]],station:'Forno',desc:'Metal avançado.'},
 {id:'treatedwood',name:'Madeira Tratada',out:99,qty:1,need:[[53,3],[60,1]],station:'Oficina',desc:'Material resistente.'},
 {id:'chest',name:'Baú de Madeira',out:80,qty:1,need:[[149,12],[150,2]],station:'Oficina',desc:'Aumenta sua capacidade de armazenamento.'},
 {id:'scarecrow',name:'Espantalho',out:84,qty:1,need:[[53,8],[54,6],[59,2]],station:'Oficina',desc:'Protege a área cultivada.'},
 {id:'sprinkler',name:'Irrigador Simples',out:83,qty:1,need:[[96,3],[97,2],[62,4]],station:'Oficina',desc:'Irriga algumas plantações ao amanhecer.'},
 {id:'fert',name:'Adubo Orgânico',out:118,qty:2,need:[[54,4],[64,2],[62,1]],station:'Oficina',desc:'Melhora a produtividade das plantas.'},
 {id:'ironaxe',name:'Machado de Ferro',out:104,qty:1,need:[[57,1],[96,4],[99,2]],station:'Oficina',desc:'Corta árvores com muito mais eficiência.'},
 {id:'ironpick',name:'Picareta de Ferro',out:103,qty:1,need:[[58,1],[96,5],[99,1]],station:'Oficina',desc:'Quebra rochas mais rápido.'},
 {id:'ironhoe',name:'Enxada de Ferro',out:105,qty:1,need:[[43,1],[96,3],[99,1]],station:'Oficina',desc:'Reduz o gasto no cultivo.'},
 {id:'ironwater',name:'Regador de Ferro',out:106,qty:1,need:[[44,1],[96,3],[97,2]],station:'Oficina',desc:'Ferramenta de cultivo melhorada.'},
 {id:'rod2',name:'Vara Reforçada',out:107,qty:1,need:[[41,1],[96,2],[150,4],[99,2]],station:'Oficina',desc:'Aumenta a chance de peixes raros.'},
 {id:'sprinkler2',name:'Irrigador Melhorado',out:151,qty:1,need:[[83,1],[98,2],[96,4],[77,1]],station:'Oficina',desc:'Irriga uma área bem maior.'},
 {id:'goldaxe',name:'Machado Dourado',out:154,qty:1,need:[[104,1],[98,5],[135,1]],station:'Oficina',desc:'Ferramenta avançada.'},
 {id:'goldpick',name:'Picareta Dourada',out:155,qty:1,need:[[103,1],[98,6],[77,1]],station:'Oficina',desc:'Ferramenta avançada.'},
 {id:'rod3',name:'Vara de Mestre',out:153,qty:1,need:[[107,1],[98,3],[123,1],[77,1]],station:'Oficina',desc:'Feita para capturas lendárias.'}
];
V.cooking=[
 {id:'cuscuz',name:'Cuscuz',out:91,qty:1,need:[[45,2],[130,1]],desc:'Refeição simples e energética.'},
 {id:'tapioca',name:'Tapioca',out:92,qty:1,need:[[51,2],[146,1]],desc:'Leve e rápida.'},
 {id:'fishgrill',name:'Peixe Assado',out:93,qty:1,need:[[23,1],[148,1]],altFish:true,desc:'Qualquer peixe comum pode virar uma boa refeição.'},
 {id:'corncake',name:'Bolo de Milho',out:94,qty:1,need:[[45,2],[88,1],[89,1]],desc:'Receita caseira.'},
 {id:'cajuice',name:'Suco de Caju',out:95,qty:1,need:[[66,2],[130,1]],desc:'Bebida refrescante.'},
 {id:'mangajam',name:'Compota de Manga',out:143,qty:1,need:[[67,3],[147,1]],desc:'Produto de alto valor.'},
 {id:'broth',name:'Caldo de Peixe',out:145,qty:1,need:[[70,1],[111,1],[115,1]],desc:'Recupera muita energia.'},
 {id:'flour',name:'Farinha de Mandioca',out:146,qty:2,need:[[51,3]],desc:'Ingrediente para outras receitas.'},
 {id:'sugar',name:'Açúcar Mascavo',out:147,qty:2,need:[[117,3]],desc:'Ingrediente produzido da cana.'}
];
V.recipeCan=function(r){if(!r)return false;if(r.altFish){var fishIds=[23,24,25,26,70,71,72,73,124,125,126,127];if(!fishIds.some(function(id){return has(id,1);} ))return false;return has(148,1);}return r.need.every(function(n){return has(n[0],n[1]);});};
V.recipeNeedsText=function(r){if(r&&r.altFish)return 'Qualquer peixe x1 • Carvão Vegetal '+count(148)+'/1';return r.need.map(function(n){var it=item(n[0]);return (it?it.name:'Item '+n[0])+' '+count(n[0])+'/'+n[1];}).join(' • ');};
V.craft=function(r,cook){if(!r||!V.recipeCan(r)){if(window.SoundManager)SoundManager.playBuzzer();toast('Faltam materiais.',100);return false;}if(r.altFish){var fishIds=[23,24,25,26,70,71,72,73,125,126],fid=fishIds.filter(function(id){return has(id,1);})[0];lose(fid,1);lose(148,1);}else r.need.forEach(function(n){lose(n[0],n[1]);});gain(r.out,r.qty||1);var s=V.state();if(cook){s.stats.cooked++;V.gainSkill('cooking',18);}else{s.stats.crafted++;V.gainSkill('crafting',16);}V.checkAchievements();if(C.showHeldItem)C.showHeldItem(r.out,100);if(window.AudioManager)AudioManager.playSe({name:'Camutanga_Craft',volume:72,pitch:cook?115:100,pan:0});else if(window.SoundManager)SoundManager.playOk();toast((cook?'Preparado: ':'Construído: ')+item(r.out).name+(r.qty>1?' x'+r.qty:''),160);return true;};

// ---------------------------------------------------------------------------
// Hotbar e itens ativos
// ---------------------------------------------------------------------------
V.setHotSlot=function(i,id){var s=V.state();i=clamp(Number(i||0),0,7);s.hotbar[i]=Number(id||0);s.hotIndex=i;if(id&&item(id)){C.state().activeItemId=id;toast('Ativo: '+item(id).name,70);}};
V.selectHot=function(i){var s=V.state();i=clamp(i,0,7);s.hotIndex=i;var id=s.hotbar[i];if(id&&item(id)){C.state().activeItemId=id;toast('Ativo: '+item(id).name,60);if(window.SoundManager)SoundManager.playCursor();}else{toast('Slot vazio. Abra a mochila e selecione um item.',90);}};
V.assignActiveToHot=function(i){var it=C.activeItem?C.activeItem():null;if(!it)return;V.setHotSlot(i,it.id);toast(it.name+' colocado no slot '+(i+1),100);};

// ---------------------------------------------------------------------------
// Baú persistente
// ---------------------------------------------------------------------------
V.storageCount=function(id){return Number(V.state().storage[String(id)]||0);};
V.storagePut=function(id,n){n=Math.min(count(id),Math.max(1,Number(n||1)));if(n<=0)return false;lose(id,n);var s=V.state(),k=String(id);s.storage[k]=V.storageCount(id)+n;toast('Guardado: '+item(id).name+' x'+n,80);return true;};
V.storageTake=function(id,n){n=Math.min(V.storageCount(id),Math.max(1,Number(n||1)));if(n<=0)return false;var s=V.state(),k=String(id);s.storage[k]-=n;if(s.storage[k]<=0)delete s.storage[k];gain(id,n);toast('Retirado: '+item(id).name+' x'+n,80);return true;};
V.canOpenStorage=function(){return window.$gameMap&&V.BASE_MAPS.indexOf($gameMap.mapId())>=0;};

// ---------------------------------------------------------------------------
// Ferramentas, recursos e agricultura melhorada
// ---------------------------------------------------------------------------
V.toolTier=function(type){var best=0;if(!$gameParty)return best;$gameParty.items().forEach(function(it){if(note(it,'lifeTool')!==null&&String(note(it,'lifeTool')).toLowerCase()===String(type).toLowerCase()){var t=Number(note(it,'toolTier')||1);if(t>best)best=t;}});return best;};
V.toolDamage=function(type){var t=V.toolTier(type);return t>=3?5:t>=2?3:1;};
V.toolCost=function(type,base){var t=V.toolTier(type);return Math.max(1,base-(t>=2?1:0)-(t>=3?1:0));};
if(C.World){
 var W=C.World;W.nodeHp=function(type){return type==='tree'?22:type==='rock'?18:4;};W.STATIC_TREE_HP=26;
 var _destroyNode=W.destroyNode;W.destroyNode=function(node){if(node&&node.type==='tree'){V.state().stats.wood++;V.gainSkill('woodcutting',24);}if(node&&node.type==='rock'){V.state().stats.rocks++;V.gainSkill('mining',22);}var r=_destroyNode.call(W,node);V.checkAchievements();return r;};
 var _destroyStatic=W.destroyStaticTree;W.destroyStaticTree=function(rec){V.state().stats.wood++;V.gainSkill('woodcutting',28);var r=_destroyStatic.call(W,rec);V.checkAchievements();return r;};
 W.tryStaticTreeAction=function(){if(!$gameMap||!W.isOutdoor())return false;var p=C.frontTile(),info=W.findStaticTree(p.x,p.y);if(!info)return false;var r=W.staticTreeRecord(info);if(!r.alive)return false;if(V.toolTier('axe')<1){if(window.SoundManager)SoundManager.playBuzzer();toast('Essa árvore precisa de um Machado.',100);return true;}if(C.spendStamina&&!C.spendStamina(V.toolCost('axe',3)))return true;if(C.setHeroPose)C.setHeroPose('axe',54);var dmg=V.toolDamage('axe');r.hp=Math.max(0,Number(r.hp||r.maxHp)-dmg);W.playWorldSfx('woodHit');if($gameScreen)$gameScreen.startShake(1,5,8);if(r.hp<=0)W.destroyStaticTree(r);else toast('Árvore: '+r.hp+'/'+r.maxHp+'  •  dano '+dmg,55);return true;};
 W.tryResourceAction=function(){if(!$gameMap||!W.isOutdoor())return false;var p=C.frontTile(),si=W.findStaticTree?p&&W.findStaticTree(p.x,p.y):null;if(si)return W.tryStaticTreeAction();W.ensureNodes($gameMap.mapId());var node=W.nodeAt($gameMap.mapId(),p.x,p.y);if(!node)return false;var need=W.requiredTool(node.type),tier=need?V.toolTier(need):1;if(need&&tier<1){if(window.SoundManager)SoundManager.playBuzzer();toast(need==='axe'?'Você precisa de um Machado.':'Você precisa de uma Picareta.',100);return true;}var cost=node.type==='bush'?1:V.toolCost(need,3);if(C.spendStamina&&!C.spendStamina(cost))return true;if(C.setHeroPose)C.setHeroPose(W.poseForNode(node.type),54);var dmg=node.type==='bush'?1:V.toolDamage(need);node.shake=24;node.hp=Math.max(0,Number(node.hp||1)-dmg);W.playWorldSfx(node.type==='rock'?'rockHit':'woodHit');if(node.hp<=0)W.destroyNode(node);else toast((node.type==='tree'?'Toc! ':node.type==='rock'?'CLANG! ':'')+node.hp+'/'+node.maxHp+'  •  dano '+dmg,52);return true;};
 // Mineração passa a dropar geodos/gemas raras.
 var _nodeDrops=W.nodeDrops;W.nodeDrops=function(node){var a=_nodeDrops.call(W,node)||[];if(node&&node.type==='rock'){var r=Math.random();if(r<.12)a.push(119);if(r<.055)a.push(136);if(r<.018)a.push(137+Math.floor(Math.random()*3));}if(node&&node.type==='tree'&&Math.random()<.035)a.push(135);return a;};
 var _collectDrop=W.collectDrop;W.collectDrop=function(d){var before=d&&!d.collected;var r=_collectDrop.call(W,d);if(before){V.state().stats.itemsPicked++;V.checkAchievements();}return r;};
 var _startDis=W.startDisaster;W.startDisaster=function(type,dur){V.state().stats.disasters++;V.unlock('survivor');return _startDis.call(W,type,dur);};
}

// Fertilizante: use como item ativo olhando para uma plantação existente.
var _tryFarm=C.tryFarm;
C.tryFarm=function(){
 if($gameMap&&$gameMap.mapId()===5){var pos=C.frontTile(),mp=C.plotMap?C.plotMap(5):null,pl=mp?mp[C.plotKey(pos.x,pos.y)]:null,it=C.activeItem?C.activeItem():null,ft=it?Number(note(it,'fertilizer')||0):0;
   if(pl&&ft>0&&$gameParty.hasItem(it)){if(pl.fertilizer){toast('Essa plantação já recebeu adubo.',80);return true;}lose(it.id,1);pl.fertilizer=ft;if(C.setHeroPose)C.setHeroPose('gather',36);V.gainSkill('farming',4);toast('Plantação adubada! Chance maior de colheita extra.',120);C.refreshPlotSprites&&C.refreshPlotSprites();return true;}
 }
 return _tryFarm.call(C);
};
// A colheita original é simples; aumentamos o rendimento depois que o item entra na mochila observando plot fertilizado via wrapper de gainItem.
var _Game_Party_gainItem=Game_Party.prototype.gainItem;
Game_Party.prototype.gainItem=function(it,amount,includeEquip){_Game_Party_gainItem.call(this,it,amount,includeEquip);if(it&&amount>0&&note(it,'crop')!==null)V.state().stats.crops+=amount;if(it&&amount>0&&(note(it,'fish')!==null||[23,24,25,26,70,71,72,73,124,125,126,127].indexOf(it.id)>=0)){V.state().stats.fish+=amount;V.checkAchievements();}};

// ---------------------------------------------------------------------------
// Dia novo: eventos, irrigadores, mensagens e pequenos presentes
// ---------------------------------------------------------------------------
V.onNewDay=function(){
 var s=V.state(),dk=day();if(s.calendar.lastDay===dk)return;s.calendar.lastDay=dk;s.stats.days=Math.max(s.stats.days,dk+1);s.talkedToday={};V.refreshEconomy(true);V.ensureSkills();
 var fest=V.festivalForDay(dk);s.calendar.event=fest;
 // Irrigadores: qualquer irrigador possuído já dá um benefício simples na base.
 if(count(83)>0||count(151)>0){var plots=C.state?C.state().plots:null,mp=plots&&plots['5'];if(mp){var keys=Object.keys(mp),max=count(151)>0?keys.length:Math.min(keys.length,8);for(var i=0;i<max;i++)if(mp[keys[i]])mp[keys[i]].wateredDay=dk;}}
 // Evento aleatório leve e útil.
 var r=rand(dk*991+31);if(r<.10){gain(159,1);toast('Uma Caixa de Presente apareceu na sua mochila. Alguém lembrou de você.',220);}else if(r>.90){gain(55,4);toast('Choveu durante a madrugada perto do rio. Você encontrou algumas minhocas.',180);}else if(fest){toast('HOJE: '+fest.name+' — '+fest.desc,260);}else{var msgs=['Dia novo, escolhas novas. Veja a previsão e monte seu plano.','A cidade acordou. O quadro de pedidos foi renovado.','O mundo muda com clima, horário e suas escolhas. Explore sem pressa.'];toast(msgs[dk%msgs.length],180);}
 V.checkAchievements();
};

// Caixa de presente.
var _useInventory=C.useInventoryItem;
C.useInventoryItem=function(it){if(it&&it.id===159&&$gameParty.hasItem(it)){lose(159,1);var pool=[42,55,64,66,67,74,76,119,130,132],id=pool[Math.floor(Math.random()*pool.length)];gain(id,1+Math.floor(Math.random()*3));toast('A caixa tinha '+item(id).name+'!',160);if(C.showHeldItem)C.showHeldItem(id,100);return true;}if(it&&note(it,'fertilizer')!==null){C.state().activeItemId=it.id;toast('Adubo ativo: use olhando para uma plantação.',90);return true;}var ok=_useInventory.call(C,it);if(ok&&it){var s=V.state(),idx=s.hotbar.indexOf(it.id);if(idx<0){s.hotbar[s.hotIndex]=it.id;} }return ok;};

// ---------------------------------------------------------------------------
// Relacionamentos: cada evento com nome não técnico pode ganhar familiaridade.
// ---------------------------------------------------------------------------
V.eventIsNpc=function(ev){if(!ev||!ev.event)return false;var n=String(ev.event().name||'').trim();if(!n||/^EV\d+/i.test(n)||/porta|bau|baú|teleporte|transfer|evento|chest|door/i.test(n))return false;return true;};
V.talkTo=function(ev){if(!V.eventIsNpc(ev))return;var s=V.state(),name=String(ev.event().name),key=$gameMap.mapId()+':'+ev.eventId(),today=String(day());if(!s.relationships[key])s.relationships[key]={name:name,hearts:0,xp:0,talks:0};var r=s.relationships[key];r.talks++;var mark=today+':'+key;if(!s.talkedToday[mark]){s.talkedToday[mark]=true;r.xp+=4;if(r.xp>=20+(r.hearts*10)&&r.hearts<10){r.xp=0;r.hearts++;toast('Amizade com '+name+' aumentou ♥ '+r.hearts,140);}}};
var _Game_Player_startMapEvent=Game_Player.prototype.startMapEvent;
Game_Player.prototype.startMapEvent=function(x,y,triggers,normal){if($gameMap&&!$gameMap.isEventRunning()){var evs=$gameMap.eventsXy(x,y);for(var i=0;i<evs.length;i++)if(evs[i].isTriggerIn&&evs[i].isTriggerIn(triggers)&&evs[i].isNormalPriority()===normal)V.talkTo(evs[i]);}_Game_Player_startMapEvent.call(this,x,y,triggers,normal);};

// Estatística de passos.
var _increaseSteps=Game_Party.prototype.increaseSteps;
Game_Party.prototype.increaseSteps=function(){_increaseSteps.call(this);if(window.$gameSystem)V.state().stats.steps++;};

// ---------------------------------------------------------------------------
// Ambiente visual adicional: luz noturna, vaga-lumes, borboletas e poeira.
// ---------------------------------------------------------------------------
function Sprite_V3Ambience(){this.initialize.apply(this,arguments);}
Sprite_V3Ambience.prototype=Object.create(Sprite.prototype);Sprite_V3Ambience.prototype.constructor=Sprite_V3Ambience;
Sprite_V3Ambience.prototype.initialize=function(){Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._particles=[];this._mode='';for(var i=0;i<28;i++){var p=new Sprite(new Bitmap(5,5));p.anchor.x=p.anchor.y=.5;p._seed=i*37+11;p.x=Math.random()*Graphics.boxWidth;p.y=Math.random()*Graphics.boxHeight;p.visible=false;this.addChild(p);this._particles.push(p);}this._tick=0;};
Sprite_V3Ambience.prototype.update=function(){Sprite.prototype.update.call(this);this._tick++;if(!$gameMap||!isOutdoor()){this.visible=false;return;}this.visible=true;var h=clock().hour,w=C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear',m=(h>=19||h<5)?'night':(w==='wind'?'wind':(h>=6&&h<17?'day':'dusk'));if(m!==this._mode){this._mode=m;this.redrawParticles(m);}for(var i=0;i<this._particles.length;i++){var p=this._particles[i];if(!p.visible)continue;if(m==='night'){p.alpha=.38+.58*(.5+.5*Math.sin((Graphics.frameCount+p._seed)*.08));p.x+=Math.sin((Graphics.frameCount+p._seed)*.013)*.16;p.y+=Math.cos((Graphics.frameCount+p._seed)*.017)*.10;}else if(m==='day'){p.x+=.22+((p._seed%5)*.02);p.y+=Math.sin((Graphics.frameCount+p._seed)*.04)*.15;if(p.x>Graphics.boxWidth+10)p.x=-10;}else if(m==='wind'){p.x+=2.4+(p._seed%4)*.25;p.y+=.3;if(p.x>Graphics.boxWidth+15){p.x=-15;p.y=Math.random()*Graphics.boxHeight;}}}this.redrawShade(h,w);};
Sprite_V3Ambience.prototype.redrawParticles=function(m){for(var i=0;i<this._particles.length;i++){var p=this._particles[i],b=p.bitmap;b.clear();if(m==='night'){b.fillRect(1,1,3,3,'rgba(255,235,116,.95)');p.visible=i<18;}else if(m==='day'){b.fillRect(0,1,5,3,i%2?'rgba(255,188,105,.60)':'rgba(173,211,115,.60)');p.visible=i<10;}else if(m==='wind'){b.fillRect(0,1,5,2,'rgba(215,181,111,.55)');p.visible=i<22;}else p.visible=false;}};
Sprite_V3Ambience.prototype.redrawShade=function(h,w){if(this._tick%10!==0)return;var b=this.bitmap;b.clear();if(h>=19||h<5){var a=h>=22||h<4?.28:.19;b.fillRect(0,0,b.width,b.height,'rgba(12,22,42,'+a+')');}else if(h>=17){b.fillRect(0,0,b.width,b.height,'rgba(232,132,62,.065)');}if(V.calendarInfo().wet)b.fillRect(0,0,b.width,b.height,'rgba(40,95,60,.018)');else b.fillRect(0,0,b.width,b.height,'rgba(196,140,55,.025)');if(w==='fog')b.fillRect(0,0,b.width,b.height,'rgba(225,230,220,.055)');};

// Hotbar Sprite.
function Sprite_V3Hotbar(){this.initialize.apply(this,arguments);}
Sprite_V3Hotbar.prototype=Object.create(Sprite.prototype);Sprite_V3Hotbar.prototype.constructor=Sprite_V3Hotbar;
Sprite_V3Hotbar.prototype.initialize=function(){Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._sig='';this._rects=[];this.refresh();};
Sprite_V3Hotbar.prototype.update=function(){Sprite.prototype.update.call(this);if(!$gameParty)return;var s=V.state(),sig=[s.hotIndex,s.hotbar.join(','),Graphics.boxWidth,Graphics.boxHeight].concat(s.hotbar.map(function(id){return count(id);})).join('|');if(sig!==this._sig){this._sig=sig;this.refresh();}};
function rr(ctx,x,y,w,h,r,fill,stroke,lw){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}}
function dirty(b){if(b&&b._setDirty)b._setDirty();}
function txt(b,t,x,y,w,h,align,size,col,bold){b.fontFace='GameFont';b.fontSize=size||16;b.textColor=col||'#fff';b.outlineColor='rgba(0,0,0,.8)';b.outlineWidth=3;b.fontBold=!!bold;b.drawText(String(t==null?'':t),x,y,w,h||24,align||'left');}
function icon(b,idx,x,y,sz){var set=ImageManager.loadSystem('IconSet');if(!set||!set.isReady||!set.isReady())return;var pw=Window_Base._iconWidth||32,ph=Window_Base._iconHeight||32,sx=(idx%16)*pw,sy=Math.floor(idx/16)*ph;b.blt(set,sx,sy,pw,ph,x,y,sz,sz);}
Sprite_V3Hotbar.prototype.refresh=function(){var b=this.bitmap;if(b.width!==Graphics.boxWidth||b.height!==Graphics.boxHeight)this.bitmap=b=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);b.clear();this._rects=[];var s=V.state(),slot=50,gap=5,total=8*slot+7*gap,x=Math.floor((Graphics.boxWidth-total)/2),y=Graphics.boxHeight-(C.touchDevice&&C.touchDevice()?86:62),ctx=b._context;ctx.save();rr(ctx,x-8,y-7,total+16,slot+14,15,'rgba(12,18,15,.70)','rgba(255,255,255,.10)',1);ctx.restore();for(var i=0;i<8;i++){var xx=x+i*(slot+gap),sel=i===s.hotIndex;ctx.save();rr(ctx,xx,y,slot,slot,10,sel?'rgba(185,136,52,.92)':'rgba(25,34,29,.92)',sel?'rgba(255,235,170,.95)':'rgba(255,255,255,.12)',sel?2:1);ctx.restore();var it=item(s.hotbar[i]);if(it){icon(b,it.iconIndex,xx+8,y+7,34);var n=count(it.id);if(n>1)txt(b,n,xx+27,y+29,18,15,'right',10,'#fff',true);}txt(b,i+1,xx+3,y+1,12,14,'left',9,sel?'#20150f':'#d3ddd5',true);this._rects.push({x:xx,y:y,w:slot,h:slot,index:i});}dirty(b);};
Sprite_V3Hotbar.prototype.hit=function(x,y){for(var i=0;i<this._rects.length;i++){var r=this._rects[i];if(x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h)return r.index;}return -1;};

var _Spriteset_Map_createUpperLayer=Spriteset_Map.prototype.createUpperLayer;
Spriteset_Map.prototype.createUpperLayer=function(){_Spriteset_Map_createUpperLayer.call(this);this._v3Ambience=new Sprite_V3Ambience();this.addChild(this._v3Ambience);};
var _Scene_Map_createAllWindows=Scene_Map.prototype.createAllWindows;
Scene_Map.prototype.createAllWindows=function(){_Scene_Map_createAllWindows.call(this);this._v3Hotbar=new Sprite_V3Hotbar();this.addChild(this._v3Hotbar);};

// ---------------------------------------------------------------------------
// Extensão da central v2.6: Oficina, Cozinha, Baú e Diário
// ---------------------------------------------------------------------------
function menuScene(){return window.Scene_CamutangaInventory26;}
function ensureTabs(){if(!C.UI26||!C.UI26.tabs)return;var ids=C.UI26.tabs.map(function(t){return t.id;});[['craft','OFICINA'],['cook','COZINHA'],['storage','BAÚ'],['journal','DIÁRIO']].forEach(function(x){if(ids.indexOf(x[0])<0)C.UI26.tabs.push({id:x[0],label:x[1]});});}
ensureTabs();
if(menuScene()){
 var P=menuScene().prototype,_refresh=P.refresh,_build=P.buildData,_activate=P.activateSelected,_touch=P.handleTouch;
 P.refresh=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(['craft','cook','storage','journal'].indexOf(tab)<0)return _refresh.call(this);var b=this._ui.bitmap;if(b.width!==Graphics.boxWidth||b.height!==Graphics.boxHeight){this._ui.bitmap=b=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._background.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);}b.clear();this._hits=[];this.drawBackground();this.buildData();this.drawHeader();this.drawTabs();if(tab==='craft')this.drawV3Recipes(false);else if(tab==='cook')this.drawV3Recipes(true);else if(tab==='storage')this.drawV3Storage();else this.drawV3Journal();};
 P.buildData=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='craft'){this._data=V.recipes.slice();return;}if(tab==='cook'){this._data=V.cooking.slice();return;}if(tab==='storage'){this._data=[];return;}if(tab==='journal'){this._data=[];return;}_build.call(this);};
 function card(b,x,y,w,h,sel){var c=b._context;c.save();rr(c,x,y,w,h,14,sel?'rgba(70,93,61,.97)':'rgba(20,28,25,.92)',sel?'rgba(243,211,111,.92)':'rgba(255,255,255,.12)',sel?2:1);c.restore();dirty(b);}
 function para(b,text,x,y,w,lineH,max,col,size){var words=String(text||'').split(/\s+/),line='',lines=[],chars=Math.max(14,Math.floor(w/((size||14)*.55)));words.forEach(function(wd){var t=line?line+' '+wd:wd;if(t.length>chars&&line){lines.push(line);line=wd;}else line=t;});if(line)lines.push(line);if(max)lines=lines.slice(0,max);for(var i=0;i<lines.length;i++)txt(b,lines[i],x,y+i*lineH,w,lineH,'left',size||14,col||'#d8dfda');}
 P.drawV3Recipes=function(cook){var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight,data=this._data,cols=6,gap=9,x=22,y=140,w=Math.floor((W-44-gap*(cols-1))/cols),h=118;for(var i=0;i<data.length;i++){var r=data[i],row=Math.floor(i/cols),col=i%cols,yy=y+row*(h+gap);if(yy+h>H-32)break;var xx=x+col*(w+gap),ok=V.recipeCan(r),out=item(r.out);card(b,xx,yy,w,h,i===this._selected);if(out)icon(b,out.iconIndex,xx+12,yy+12,38);txt(b,r.name,xx+56,yy+10,w-66,20,'left',13,ok?'#f2dda1':'#a2aaa5',true);txt(b,(cook?'COZINHA':'OFICINA')+' • '+(r.qty||1)+'x',xx+56,yy+31,w-66,15,'left',9,'#aebbb2');para(b,V.recipeNeedsText(r),xx+12,yy+55,w-24,16,2,ok?'#8fd08b':'#e08b7d',10);txt(b,ok?'FAZER':'FALTAM ITENS',xx+10,yy+h-25,w-20,16,'center',9,ok?'#f0d16f':'#a66c63',true);this._hits.push({kind:'v3recipe',index:i,cook:cook,rect:{x:xx,y:yy,w:w,h:h}});}txt(b,cook?'Receitas recuperam energia e podem ser vendidas por bom valor.':'Ferramentas melhoradas gastam menos energia e causam mais dano.',28,H-29,W-56,18,'center',10,'#aebbb2');};
 P.drawV3Storage=function(){var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight;if(!V.canOpenStorage()){txt(b,'BAÚ DA BASE',36,164,W-72,40,'center',28,'#f2dda1',true);para(b,'O armazenamento fica disponível quando você estiver na Base do Jogador ou dentro da casa.',W/2-260,230,520,28,4,'#d7dfda',17);return;}var inv=$gameParty.items().filter(function(it){return it&&$gameParty.numItems(it)>0;}),stored=Object.keys(V.state().storage).map(Number).filter(function(id){return V.storageCount(id)>0&&item(id);});txt(b,'MOCHILA',34,142,W/2-50,25,'center',17,'#f2dda1',true);txt(b,'BAÚ',W/2+16,142,W/2-50,25,'center',17,'#f2dda1',true);var cols=4,cellW=Math.floor((W/2-54)/cols),cellH=90,maxRows=5;for(var i=0;i<Math.min(inv.length,cols*maxRows);i++){var it=inv[i],cx=26+(i%cols)*cellW,cy=176+Math.floor(i/cols)*cellH;card(b,cx,cy,cellW-8,cellH-8,false);icon(b,it.iconIndex,cx+10,cy+12,36);txt(b,it.name,cx+52,cy+10,cellW-66,22,'left',12,'#f0eee3',true);txt(b,'x'+count(it.id),cx+52,cy+34,cellW-66,18,'left',11,'#b9c5bd');txt(b,'GUARDAR',cx+8,cy+60,cellW-24,16,'center',9,'#d9c653',true);this._hits.push({kind:'v3put',id:it.id,rect:{x:cx,y:cy,w:cellW-8,h:cellH-8}});}for(var j=0;j<Math.min(stored.length,cols*maxRows);j++){var id=stored[j],sit=item(id),sx=W/2+18+(j%cols)*cellW,sy=176+Math.floor(j/cols)*cellH;card(b,sx,sy,cellW-8,cellH-8,false);icon(b,sit.iconIndex,sx+10,sy+12,36);txt(b,sit.name,sx+52,sy+10,cellW-66,22,'left',12,'#f0eee3',true);txt(b,'x'+V.storageCount(id),sx+52,sy+34,cellW-66,18,'left',11,'#b9c5bd');txt(b,'RETIRAR',sx+8,sy+60,cellW-24,16,'center',9,'#d9c653',true);this._hits.push({kind:'v3take',id:id,rect:{x:sx,y:sy,w:cellW-8,h:cellH-8}});}txt(b,'Toque: move 1 item • toque segurando SHIFT no PC: move 5',36,H-40,W-72,20,'center',11,'#9eaaa3');};
 P.drawV3Journal=function(){var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight,cal=V.calendarInfo(),moon=V.moonInfo(),s=V.state(),fest=V.festivalForDay(day());var boxes=[{x:30,y:150,w:W*.31-36,h:180},{x:W*.31+10,y:150,w:W*.34-20,h:180},{x:W*.65+6,y:150,w:W*.35-36,h:180}];boxes.forEach(function(r){card(b,r.x,r.y,r.w,r.h,false);});txt(b,'CALENDÁRIO',boxes[0].x+16,boxes[0].y+18,boxes[0].w-32,24,'center',17,'#f2dda1',true);txt(b,cal.weekDay+' • '+cal.dayOfMonth+' de '+cal.monthName,boxes[0].x+12,boxes[0].y+58,boxes[0].w-24,25,'center',16,'#fff',true);txt(b,cal.season,boxes[0].x+12,boxes[0].y+91,boxes[0].w-24,22,'center',13,'#b9d29f');txt(b,'Lua '+moon.name+' • '+V.temperature()+'°C',boxes[0].x+12,boxes[0].y+122,boxes[0].w-24,22,'center',12,'#cbd5cf');txt(b,'AMANHÃ: '+V.forecast(1),boxes[0].x+12,boxes[0].y+148,boxes[0].w-24,18,'center',10,'#d6c891');
 txt(b,'EVENTO DO DIA',boxes[1].x+16,boxes[1].y+18,boxes[1].w-32,24,'center',17,'#f2dda1',true);txt(b,fest?fest.name:'Dia tranquilo',boxes[1].x+16,boxes[1].y+61,boxes[1].w-32,26,'center',18,fest?'#efd16f':'#d7dfda',true);para(b,fest?fest.desc:'Aproveite para plantar, explorar, pescar, cozinhar ou melhorar suas ferramentas.',boxes[1].x+24,boxes[1].y+100,boxes[1].w-48,22,3,'#cbd5cf',13);
 txt(b,'ESTATÍSTICAS',boxes[2].x+16,boxes[2].y+18,boxes[2].w-32,24,'center',17,'#f2dda1',true);var st=s.stats,stats=['Passos '+st.steps,'Peixes '+st.fish,'Árvores '+st.wood,'Rochas '+st.rocks,'Crafts '+st.crafted,'Receitas '+st.cooked];for(var q=0;q<stats.length;q++)txt(b,stats[q],boxes[2].x+18+(q%2)*(boxes[2].w/2-18),boxes[2].y+58+Math.floor(q/2)*32,boxes[2].w/2-22,20,'left',12,'#d7dfda');
 var y=360;txt(b,'CONQUISTAS',34,y,W*.52,28,'left',18,'#f2dda1',true);var defs=Object.keys(V.achievementDefs);for(var a=0;a<defs.length;a++){var d=V.achievementDefs[defs[a]],ok=!!s.achievements[defs[a]],col=a%2,row=Math.floor(a/2),xx=34+col*(W*.26),yy=y+38+row*38;txt(b,(ok?'★ ':'○ ')+d.name,xx,yy,W*.25,20,'left',11,ok?'#efd16f':'#7f8a83',ok);}
 txt(b,'AMIZADES',W*.56,y,W*.39,28,'left',18,'#f2dda1',true);var rel=Object.keys(s.relationships).map(function(k){return s.relationships[k];}).sort(function(a,b){return b.hearts-a.hearts;}).slice(0,6);if(!rel.length)txt(b,'Converse com personagens da cidade para criar vínculos.',W*.56,y+42,W*.39,24,'left',12,'#aebbb2');for(var rrn=0;rrn<rel.length;rrn++){var r=rel[rrn];txt(b,r.name,W*.56,y+40+rrn*34,W*.20,20,'left',12,'#e7e0cf',true);txt(b,'♥'.repeat(r.hearts)+'♡'.repeat(Math.max(0,5-r.hearts)),W*.76,y+40+rrn*34,W*.18,20,'right',12,'#ef8c85');}
 };
 P.handleTouch=function(x,y){for(var i=this._hits.length-1;i>=0;i--){var h=this._hits[i],r=h.rect;if(!r||x<r.x||y<r.y||x>=r.x+r.w||y>=r.y+r.h)continue;if(h.kind==='v3recipe'){this._selected=h.index;V.craft(this._data[h.index],h.cook);this._needsRefresh=true;return;}if(h.kind==='v3put'){V.storagePut(h.id,1);this._needsRefresh=true;return;}if(h.kind==='v3take'){V.storageTake(h.id,1);this._needsRefresh=true;return;}}_touch.call(this,x,y);};
 P.activateSelected=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='craft'){V.craft(this._data[this._selected],false);this._needsRefresh=true;return;}if(tab==='cook'){V.craft(this._data[this._selected],true);this._needsRefresh=true;return;}return _activate.call(this);};
}

V.openTab=function(id){ensureTabs();var S=menuScene();if(!S)return;SceneManager.push(S);setTimeout(function(){var sc=SceneManager._scene;if(sc&&sc instanceof S){var idx=C.UI26.tabs.map(function(t){return t.id;}).indexOf(id);if(idx>=0){sc._tab=idx;sc._selected=0;sc._needsRefresh=true;}}},0);};

// ---------------------------------------------------------------------------
// Scene map: hotbar, atalhos, autosave e inicialização diária
// ---------------------------------------------------------------------------
var _Scene_Map_start=Scene_Map.prototype.start;
Scene_Map.prototype.start=function(){_Scene_Map_start.call(this);V.ensureSkills();V.onNewDay();V.refreshEconomy(false);var s=V.state();if(!s.tutorial.welcome){s.tutorial.welcome=true;toast('Camutanga Mundo Vivo: explore, pesque, plante, crie itens e viva no seu ritmo.',260);} };
var _Scene_Map_update=Scene_Map.prototype.update;
Scene_Map.prototype.update=function(){_Scene_Map_update.call(this);if(!$gamePlayer||!$gameMap)return;V.onNewDay();for(var i=0;i<8;i++)if(Input.isTriggered('hot'+(i+1)))V.selectHot(i);if(Input.isTriggered('v3craft'))V.openTab('craft');if(Input.isTriggered('v3journal'))V.openTab('journal');if(Input.isTriggered('v3chest')){if(V.canOpenStorage())V.openTab('storage');else toast('O baú principal fica na sua base.',90);}if(TouchInput.isTriggered()&&this._v3Hotbar){var h=this._v3Hotbar.hit(TouchInput.x,TouchInput.y);if(h>=0){V.selectHot(h);if($gameTemp)$gameTemp.clearDestination();}}
 // autosave uma vez por dia depois do início do mapa, no slot 1 se possível.
 var s=V.state();if(s.autosaveDay!==day()&&Graphics.frameCount%300===0){s.autosaveDay=day();try{if(DataManager.saveGame)DataManager.saveGame(1);}catch(e){}}
 V.checkAchievements();};

// Mudança de clima de acordo com época chuvosa/seca: ajusta probabilidades do World.
if(C.World&&C.World.weatherForDay){var W2=C.World,_wf=W2.weatherForDay;W2.weatherForDay=function(d){var st=W2.state(),key=String(d);if(st.weatherByDay&&st.weatherByDay[key])return st.weatherByDay[key];var calDay=d+1,month=Math.floor((calDay-1)/28)%12,wet=[0,1,2,3,4,5,11].indexOf(month)>=0,r=W2.hashRand(d,77),type='clear';if(wet){if(r<.27)type='rain';else if(r<.36)type='storm';else if(r<.48)type='cloudy';else if(r<.56)type='fog';}else{if(r<.05)type='rain';else if(r<.08)type='storm';else if(r<.19)type='cloudy';else if(r<.23)type='fog';}st.weatherByDay[key]=type;return type;};}

// Bônus de pesca por vara, lua, torneio e clima. Intercepta a escolha do peixe se o World expõe o método atual.
if(C.World){var WW=C.World;if(WW.fishPoolForV3==null)WW.fishPoolForV3=true;}
// Amplia a coleção exibida pelo estado quando novos peixes entram.
V.fishIds=[23,24,25,26,70,71,72,73,124,125,126,127];

// Venda dinâmica em lojas: muda temporariamente o preço de venda calculado pela janela ShopSell.
if(window.Scene_Shop){var _sellingPrice=Scene_Shop.prototype.sellingPrice;Scene_Shop.prototype.sellingPrice=function(){var p=_sellingPrice.call(this),it=this._item;return Math.max(1,Math.round(p*V.priceMultiplier(it)));};}

// Cria um pequeno aviso de hotbar no CSS em telas touch e suaviza botões antigos.
function css(){if(document.getElementById('camutanga-v3-css'))return;var s=document.createElement('style');s.id='camutanga-v3-css';s.textContent='body.camutanga-ui-open #camutanga-dev-menu{opacity:.15!important;pointer-events:none!important}@media (pointer:coarse),(max-width:900px){.cl-actions{right:calc(12px + env(safe-area-inset-right,0px))!important;bottom:calc(10px + env(safe-area-inset-bottom,0px))!important;transform:scale(.88);transform-origin:right bottom}.cl-dpad{left:calc(12px + env(safe-area-inset-left,0px))!important;bottom:calc(10px + env(safe-area-inset-bottom,0px))!important;transform:scale(.88);transform-origin:left bottom}.cl-bag{background:rgba(38,70,44,.78)!important;border-color:rgba(230,210,139,.55)!important}}';document.head.appendChild(s);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',css);else css();

// Atualiza versão global.
C.version='3.0.0';
})();

// ============================================================================
// Camutanga V3 - extensões finais (pesca profunda, pedidos, buffs e tesouros)
// ============================================================================
(function(){
'use strict';
var C=window.Camutanga,V=C&&C.V3;if(!C||!V)return;
function note(it,t){return C.noteTag?C.noteTag(it,t):null;}
function item(id){return $dataItems&&$dataItems[id];}
function gain(id,n){if(item(id))$gameParty.gainItem(item(id),n||1);}
function lose(id,n){if(item(id))$gameParty.loseItem(item(id),n||1);}
function count(id){return item(id)?$gameParty.numItems(item(id)):0;}
function toast(t,f){if(C.toast)C.toast(t,f||140);}

// Coleção ampliada na central.
if(window.Scene_CamutangaInventory26&&C.UI26){
 var P=Scene_CamutangaInventory26.prototype,_bd=P.buildData;
 P.buildData=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='collections'){this._data=V.fishIds.map(function(id){return item(id);}).filter(Boolean);return;}_bd.call(this);};
}

// Pedidos diários variáveis e semanais.
var _refreshDaily=C.refreshDaily;
C.refreshDaily=function(force){
 _refreshDaily.call(C,force);var s=C.state(),qs=s.daily&&s.daily.quests;if(!qs)return;
 function add(q){if(!qs.some(function(x){return x.id===q.id;}))qs.push(q);}
 var d=C.dayKey();
 if(d%3===0)add({id:'wood',title:'Madeira para a cidade',desc:'Derrube 2 árvores.',current:0,target:2,reward:135,done:false});
 else if(d%3===1)add({id:'mine',title:'Pedra e minério',desc:'Quebre 3 rochas.',current:0,target:3,reward:150,done:false});
 else add({id:'craft',title:'Mãos à obra',desc:'Produza 2 itens na oficina.',current:0,target:2,reward:170,done:false});
 if((d+1)%7===0)add({id:'weekly',title:'Pedido da semana',desc:'Colete ou produza 12 coisas.',current:0,target:12,reward:480,done:false});
};

// Atualiza pedidos extras quando ações acontecem.
if(C.World){
 var W=C.World,_dn=W.destroyNode;W.destroyNode=function(n){var alive=n&&n.alive,type=n&&n.type,r=_dn.call(W,n);if(alive&&type==='tree'){C.updateQuest&&C.updateQuest('wood',1);C.updateQuest&&C.updateQuest('weekly',1);}if(alive&&type==='rock'){C.updateQuest&&C.updateQuest('mine',1);C.updateQuest&&C.updateQuest('weekly',1);}return r;};
 var _ds=W.destroyStaticTree;W.destroyStaticTree=function(r){var was=r&&r.alive,x=_ds.call(W,r);if(was){C.updateQuest&&C.updateQuest('wood',1);C.updateQuest&&C.updateQuest('weekly',1);}return x;};
}
var _craft=V.craft;V.craft=function(r,cook){var ok=_craft.call(V,r,cook);if(ok){C.updateQuest&&C.updateQuest(cook?'farm':'craft',1);C.updateQuest&&C.updateQuest('weekly',1);}return ok;};

// Pesca: espécie depende de local, hora, clima, lua, torneio e qualidade da vara.
if(window.Scene_CamutangaFishing){
 Scene_CamutangaFishing.prototype.pickFish=function(){
   var lvl=C.state().skills.fishing.level,h=C.gameClock().hour,map=$gameMap?$gameMap.mapId():5,weather=C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear';
   var rod=V.toolTier('fishing'),moon=V.moonInfo(),fest=V.festivalForDay(C.dayKey()),rare=.035+lvl*.004+(rod>=2?.045:0)+(rod>=3?.075:0)+(weather==='rain'||weather==='storm'?.03:0)+(moon.full?.025:0)+(fest&&fest.id==='pesca'?.05:0);
   var r=Math.random(),id=23;
   if(r<rare*.22)id=(Math.random()<.55?127:124);
   else if(r<rare)id=(Math.random()<.5?26:72);
   else if(map===25)id=Math.random()<.55?72:25;
   else if(map===26)id=Math.random()<.35?125:(Math.random()<.55?70:24);
   else if(h>=18||h<6)id=Math.random()<.28?25:(Math.random()<.55?24:125);
   else if(weather==='rain'||weather==='storm')id=Math.random()<.28?71:(Math.random()<.55?70:23);
   else {var pool=[23,23,70,71,73,125,126,24];id=pool[Math.floor(Math.random()*pool.length)];}
   var bases={23:.65,24:1.1,25:1.7,26:4.3,70:.8,71:1.25,72:3.0,73:.22,124:3.6,125:1.15,126:1.4,127:5.1};
   var base=bases[id]||1,weight=base*(.72+Math.random()*.88)*(1+Math.min(.45,lvl*.02)+(rod-1)*.08),quality=1;
   var q=Math.random(),qb=.30+lvl*.014+(rod-1)*.06;if(q<qb)quality=2;if(q<.12+lvl*.009+(rod-1)*.035)quality=3;if(q<.032+lvl*.004+(rod-1)*.018)quality=4;if(q<.008+lvl*.0015+(rod>=3?.012:0))quality=5;
   return{id:id,weight:weight,quality:quality};
 };
 var _succ=Scene_CamutangaFishing.prototype.success;
 Scene_CamutangaFishing.prototype.success=function(){_succ.call(this);var chance=.035+V.toolTier('fishing')*.012;if(Math.random()<chance){var pool=[119,119,123,122,132],id=pool[Math.floor(Math.random()*pool.length)];gain(id,1);toast('A linha trouxe um bônus: '+item(id).name+'!',170);C.showHeldItem&&C.showHeldItem(id,100);}C.updateQuest&&C.updateQuest('weekly',1);};
}

// Geodos, mapas do tesouro e café forte.
var _use=C.useInventoryItem;
C.useInventoryItem=function(it){
 if(it&&it.id===119&&$gameParty.hasItem(it)){lose(119,1);var r=Math.random(),id=r<.48?74:r<.72?36:r<.86?136:r<.93?77:r<.97?137:r<.985?138:139;gain(id,1);toast('Geodo aberto: '+item(id).name+'!',160);C.showHeldItem&&C.showHeldItem(id,90);return true;}
 if(it&&it.id===122&&$gameParty.hasItem(it)){C.state().activeItemId=122;toast('Mapa do Tesouro ativo. Use AÇÃO em uma área externa.',130);return true;}
 var ok=_use.call(C,it);if(ok&&it&&String(note(it,'buff')||'')==='speed'){V.state().buffs.speedUntil=(C.gameClock().raw||0)+180;toast('Café forte: velocidade aumentada por algumas horas.',160);}return ok;
};
var _speed=Game_Player.prototype.realMoveSpeed;Game_Player.prototype.realMoveSpeed=function(){var b=_speed.call(this),u=Number(V.state().buffs.speedUntil||0),now=C.gameClock().raw||0;if(u>now)b+=.28;return b;};

// Mapa do tesouro usa a ação de vida e gera uma pequena recompensa física.
var _life=C.lifeAction;C.lifeAction=function(){var it=C.activeItem?C.activeItem():null;if(it&&it.id===122&&$gameParty.hasItem(it)&&$gameMap&&V.OUTDOOR_MAPS.indexOf($gameMap.mapId())>=0){lose(122,1);var pool=[75,77,120,121,123,135,137,138,139,141],id=pool[Math.floor(Math.random()*pool.length)],p=C.frontTile();if(C.World&&C.World.spawnDrop)C.World.spawnDrop(id,p.x,p.y,1);else gain(id,1);C.setHeroPose&&C.setHeroPose('gather',45);toast('Você encontrou um ponto marcado no mapa! Veja o tesouro no chão.',200);return;}_life.call(C);};

// Lanternas reduzem a camada de escuridão do V3 quando estiverem ativas.
var _amb=window.Sprite_V3Ambience&&Sprite_V3Ambience.prototype.redrawShade;
// Sprite_V3Ambience fica dentro do closure anterior; se não for global, a melhoria já funciona via camada base.

// Redução de custo na chuva se o jogador tiver guarda-chuva.
var _spend=C.spendStamina;C.spendStamina=function(n){var w=C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear';if((w==='rain'||w==='storm')&&count(129)>0)n=Math.max(1,Math.ceil(Number(n||0)*.8));return _spend.call(C,n);};

})();

// ============================================================================
// Camutanga V3 - lojas ampliadas e disponibilidade dos novos itens
// ============================================================================
(function(){
'use strict';
var C=window.Camutanga,V=C&&C.V3;if(!C||!V||!window.Scene_Shop)return;
function addGoods(goods,ids){ids.forEach(function(id){if($dataItems&&$dataItems[id]&&!goods.some(function(g){return g[0]===0&&g[1]===id;}))goods.push([0,id,0,0]);});}
var _prepare=Scene_Shop.prototype.prepare;
Scene_Shop.prototype.prepare=function(goods,purchaseOnly){
 var g=(goods||[]).slice(),mid=$gameMap?$gameMap.mapId():0;
 if(mid===22)addGoods(g,[31,32,33,34,46,48,50,52,108,110,112,114,116,86,118]); // Frutaria
 if(mid===17)addGoods(g,[41,42,43,44,57,58,101,102,129,130,132,133,134]); // Ferramentas
 if(mid===19)addGoods(g,[19,20,21,22,56,88,89,90,91,92,93,94,95,130,131]); // Cantina
 if(mid===20)addGoods(g,[42,55,132,133,134]); // Peixaria
 _prepare.call(this,g,purchaseOnly);
};

// Pacote inicial V3 só uma vez por save: sementes variadas e água.
var _give=C.giveStarterPack;
C.giveStarterPack=function(){var before=C.state().starterReceived;_give.call(C);var s=V.state();if(!s.starterV3){s.starterV3=true;[[108,2],[110,2],[112,2],[114,2],[116,2],[130,3]].forEach(function(p){if($dataItems[p[0]])$gameParty.gainItem($dataItems[p[0]],p[1]);});if(C.toast)C.toast('Você também recebeu sementes regionais e água para começar.',180);}};
})();

// ============================================================================
// Camutanga V3 - cultivo aprofundado (adubo, ferramentas, colheita extra)
// ============================================================================
(function(){
'use strict';
var C=window.Camutanga,V=C&&C.V3;if(!C||!V||!C.plotMap)return;
function note(it,t){return C.noteTag?C.noteTag(it,t):null;}
function toast(t,f){if(C.toast)C.toast(t,f||120);}
C.tryFarm=function(){
 if(!$gameMap||$gameMap.mapId()!==5)return false;
 var pos=C.frontTile(),map=C.plotMap(5),key=C.plotKey(pos.x,pos.y),plot=map[key],dk=C.dayKey(),active=C.activeItem?C.activeItem():null,ft=active?Number(note(active,'fertilizer')||0):0;
 if(plot){
   if(ft>0&&$gameParty.hasItem(active)){
     if(plot.fertilizer){toast('Essa plantação já recebeu adubo.',80);return true;}
     $gameParty.loseItem(active,1);plot.fertilizer=ft;C.setHeroPose&&C.setHeroPose('gather',36);V.gainSkill('farming',5);toast(ft>=2?'Adubo premium aplicado!':'Adubo aplicado!',100);C.refreshPlotSprites&&C.refreshPlotSprites();return true;
   }
   if((plot.growth||0)>=plot.days){
     var harvest=$dataItems[plot.harvestId];if(!harvest)return true;if(!C.spendStamina(1))return true;C.setHeroPose&&C.setHeroPose('gather',40);
     var lvl=C.state().skills.farming.level,chance=Math.min(.72,.12+lvl*.035+(plot.fertilizer||0)*.18+((V.hasPlacedType&&V.hasPlacedType('scarecrow'))?.08:0)),qty=1;
     if(Math.random()<chance)qty++;if(Math.random()<Math.max(0,chance-.48))qty++;
     $gameParty.gainItem(harvest,qty);delete map[key];C.state().daily.crops+=qty;C.state().totals.crops+=qty;C.gainSkillXp('farming',16+qty*4);C.updateQuest('farm',1);C.updateQuest('weekly',1);SoundManager.playRecovery();toast('Colheita: '+harvest.name+' x'+qty+(plot.fertilizer?' • adubada':''),150);C.showHeldItem&&C.showHeldItem(harvest.id,100);C.refreshPlotSprites&&C.refreshPlotSprites();return true;
   }
   if(V.toolTier('watering')<1){toast('Você precisa de um Regador.',90);return true;}
   if(plot.wateredDay===dk){toast('Já foi regada hoje. Crescimento '+(plot.growth||0)+'/'+plot.days,80);return true;}
   if(!C.spendStamina(V.toolCost('watering',1)))return true;C.setHeroPose&&C.setHeroPose('water',46);plot.wateredDay=dk;C.gainSkillXp('farming',3);C.updateQuest('farm',1);SoundManager.playOk();toast('Plantação regada • '+(plot.growth||0)+'/'+plot.days,80);C.refreshPlotSprites&&C.refreshPlotSprites();return true;
 }
 var seed=C.seedData?C.seedData(active):null;if(!seed||!$gameParty.hasItem(active))return false;
 if(V.toolTier('hoe')<1){toast('Você precisa de uma Enxada.',90);return true;}
 if(!$gameMap.isValid(pos.x,pos.y)||!$gameMap.isPassable(pos.x,pos.y,2)||$gameMap.eventsXy(pos.x,pos.y).length){SoundManager.playBuzzer();toast('Escolha um pedaço livre de terra na base.',90);return true;}
 if(!C.spendStamina(V.toolCost('hoe',2)))return true;C.setHeroPose&&C.setHeroPose('hoe',48);$gameParty.loseItem(active,1);
 var cal=V.calendarInfo(),days=Math.max(2,seed.days-(cal.wet&&Math.random()<.22?1:0));map[key]={x:pos.x,y:pos.y,seedId:active.id,harvestId:seed.harvestId,days:days,growth:0,wateredDay:dk,fertilizer:0};C.gainSkillXp('farming',6);C.updateQuest('farm',1);SoundManager.playOk();toast(active.name+' plantadas! '+days+' dias de crescimento.',120);C.refreshPlotSprites&&C.refreshPlotSprites();return true;
};
})();

// ============================================================================
// Camutanga V3 - painel de habilidades ampliado
// ============================================================================
(function(){
'use strict';
var C=window.Camutanga,V=C&&C.V3;if(!C||!V||!window.Scene_CamutangaInventory26||!C.UI26)return;
var P=Scene_CamutangaInventory26.prototype,_bd=P.buildData;
P.buildData=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='skills'){V.ensureSkills();this._data=['fishing','farming','gathering','woodcutting','mining','cooking','crafting'];return;}_bd.call(this);};
function rr(ctx,x,y,w,h,r,fill,stroke,lw){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}}
function txt(b,t,x,y,w,h,align,size,col,bold){b.fontFace='GameFont';b.fontSize=size||16;b.textColor=col||'#fff';b.outlineColor='rgba(0,0,0,.78)';b.outlineWidth=3;b.fontBold=!!bold;b.drawText(String(t),x,y,w,h||22,align||'left');}
P.drawSkills=function(){var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight,s=C.state(),cols=4,gap=14,x=30,y=154,w=Math.floor((W-60-gap*(cols-1))/cols),h=210;var desc={fishing:'Peixes raros, peso e qualidade.',farming:'Colheitas maiores e cultivo eficiente.',gathering:'Mais recursos ao explorar.',woodcutting:'Domínio de árvores e madeira.',mining:'Minérios, geodos e gemas raras.',cooking:'Receitas e refeições melhores.',crafting:'Construções e equipamentos.'};for(var i=0;i<this._data.length;i++){var k=this._data[i],sk=s.skills[k]||{level:1,xp:0},row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap),need=90+sk.level*55;if(['fishing','farming','gathering'].indexOf(k)>=0)need=80+sk.level*45;var c=b._context;c.save();rr(c,xx,yy,w,h,14,i===this._selected?'rgba(70,93,61,.96)':'rgba(20,28,25,.92)',i===this._selected?'rgba(243,211,111,.9)':'rgba(255,255,255,.12)',i===this._selected?2:1);c.restore();txt(b,V.skillName(k).toUpperCase(),xx+14,yy+18,w-28,25,'center',15,'#f2dda1',true);txt(b,'NÍVEL '+sk.level,xx+14,yy+54,w-28,34,'center',24,'#fff',true);c=b._context;c.save();rr(c,xx+24,yy+103,w-48,14,7,'rgba(5,10,9,.65)','rgba(255,255,255,.12)',1);var rate=Math.max(0,Math.min(1,sk.xp/need));rr(c,xx+26,yy+105,(w-52)*rate,10,5,'#78b66e',null);c.restore();txt(b,sk.xp+' / '+need+' XP',xx+18,yy+122,w-36,18,'center',10,'#c8d3cc');txt(b,desc[k]||'',xx+18,yy+153,w-36,38,'center',11,'#cbd5cf');this._hits.push({kind:'item',index:i,rect:{x:xx,y:yy,w:w,h:h}});}txt(b,'Subir habilidades melhora energia, eficiência, raridade e produtividade.',32,H-34,W-64,18,'center',10,'#9eaaa3');};
})();

// ============================================================================
// Camutanga V3 - construções colocáveis na Base do Jogador
// ============================================================================
(function(){
'use strict';
var C=window.Camutanga,V=C&&C.V3;if(!C||!V)return;
function note(it,t){return C.noteTag?C.noteTag(it,t):null;}
function toast(t,f){if(C.toast)C.toast(t,f||120);}
function placed(){var s=V.state();if(!s.placed)s.placed={objects:[]};if(!Array.isArray(s.placed.objects))s.placed.objects=[];return s.placed.objects;}
V.placedObjects=placed;
V.objectAt=function(mapId,x,y){var a=placed();for(var i=0;i<a.length;i++){var o=a[i];if(o.mapId===mapId&&o.x===x&&o.y===y)return o;}return null;};
V.hasPlacedType=function(type){return placed().some(function(o){return o.type===type;});};
V.placeObject=function(it){
 if(!$gameMap||$gameMap.mapId()!==5){toast('Construções devem ser colocadas na sua base.',100);return true;}
 var tag=note(it,'craftObject');if(!tag)return false;var p=C.frontTile();if(V.objectAt(5,p.x,p.y)||$gameMap.eventsXy(p.x,p.y).length||!$gameMap.isValid(p.x,p.y)||!$gameMap.isPassable(p.x,p.y,2)){SoundManager.playBuzzer();toast('Esse espaço está ocupado.',90);return true;}
 if(!$gameParty.hasItem(it)){SoundManager.playBuzzer();return true;}
 $gameParty.loseItem(it,1);var o={id:'p'+Date.now()+'_'+Math.floor(Math.random()*9999),mapId:5,x:p.x,y:p.y,type:String(tag),itemId:it.id};placed().push(o);C.setHeroPose&&C.setHeroPose('gather',42);SoundManager.playOk();toast(it.name+' colocado na propriedade.',130);
 var sc=SceneManager._scene;if(sc&&sc._spriteset&&sc._spriteset.syncV3Placed)sc._spriteset.syncV3Placed(true);return true;
};
V.interactPlaced=function(){if(!$gameMap)return false;var p=C.frontTile(),o=V.objectAt($gameMap.mapId(),p.x,p.y);if(!o)return false;
 if(o.type==='chest'||o.type==='bigChest'){V.openTab('storage');return true;}
 if(o.type==='bench'){V.openTab('craft');return true;}
 if(o.type==='furnace'){V.openTab('craft');toast('O forno permite refinar barras e carvão.',100);return true;}
 if(o.type==='sprinkler'||o.type==='sprinkler2'){toast(o.type==='sprinkler2'?'Irrigador melhorado: rega uma área de 5x5 ao amanhecer.':'Irrigador: rega uma área de 3x3 ao amanhecer.',120);return true;}
 if(o.type==='scarecrow'){toast('Espantalho: aumenta a produtividade das colheitas da base.',100);return true;}
 if(o.type==='fence'){toast('Cerca de madeira. Use Picareta ativa para recolher.',90);return true;}
 return true;};
V.removePlaced=function(){if(!$gameMap||$gameMap.mapId()!==5)return false;var p=C.frontTile(),a=placed(),idx=-1;for(var i=0;i<a.length;i++)if(a[i].mapId===5&&a[i].x===p.x&&a[i].y===p.y){idx=i;break;}if(idx<0)return false;var active=C.activeItem?C.activeItem():null;if(!active||String(note(active,'lifeTool')||'')!=='pickaxe')return false;var o=a[idx],it=$dataItems[o.itemId];a.splice(idx,1);if(it)$gameParty.gainItem(it,1);C.setHeroPose&&C.setHeroPose('pickaxe',46);toast((it?it.name:'Construção')+' recolhido.',90);var sc=SceneManager._scene;if(sc&&sc._spriteset&&sc._spriteset.syncV3Placed)sc._spriteset.syncV3Placed(true);return true;};

// Renderização procedural das construções.
V.objectBitmapCache={};
V.objectBitmap=function(type){if(V.objectBitmapCache[type])return V.objectBitmapCache[type];var b=new Bitmap(48,58),c=b._context;c.imageSmoothingEnabled=false;function r(x,y,w,h,col){b.fillRect(x,y,w,h,col);}r(7,49,34,5,'rgba(0,0,0,.22)');
 if(type==='chest'||type==='bigChest'){var big=type==='bigChest';r(big?4:8,25,big?40:32,26,'#382417');r(big?6:10,27,big?36:28,22,'#8b572e');r(big?6:10,25,big?36:28,7,'#b67a3d');r(22,34,5,7,'#d5b25d');r(7,31,34,2,'#4e311d');}
 else if(type==='bench'){r(6,30,36,7,'#7b4b29');r(9,37,5,16,'#4a2b1b');r(34,37,5,16,'#4a2b1b');r(10,24,28,6,'#aa7040');r(16,20,5,5,'#aeb8b7');r(27,19,10,4,'#7b5030');}
 else if(type==='furnace'){r(8,18,32,35,'#5b5148');r(11,21,26,30,'#897b6c');r(16,34,16,14,'#241a15');r(19,38,10,8,'#e05c2f');r(14,14,20,7,'#6c6258');}
 else if(type==='sprinkler'||type==='sprinkler2'){r(21,23,6,29,'#7d8587');r(type==='sprinkler2'?8:13,20,type==='sprinkler2'?32:22,5,'#aab4b6');r(9,17,5,8,'#6aa9bd');r(34,17,5,8,'#6aa9bd');r(18,49,12,4,'#4d5b5f');}
 else if(type==='scarecrow'){r(22,14,5,39,'#684121');r(10,26,28,5,'#684121');r(16,12,16,13,'#d1aa62');r(13,8,22,6,'#8a5a2e');r(15,30,8,15,'#5d7c86');r(26,30,8,15,'#8a5142');}
 else if(type==='fence'){r(7,25,5,28,'#72502f');r(36,25,5,28,'#72502f');r(9,31,30,6,'#a06e3e');r(9,43,30,6,'#a06e3e');}
 else{r(10,22,28,30,'#86623d');}
 if(b._setDirty)b._setDirty();V.objectBitmapCache[type]=b;return b;};
function Sprite_V3Placed(o){this.initialize.apply(this,arguments);}Sprite_V3Placed.prototype=Object.create(Sprite.prototype);Sprite_V3Placed.prototype.constructor=Sprite_V3Placed;Sprite_V3Placed.prototype.initialize=function(o){Sprite.prototype.initialize.call(this);this._obj=o;this.bitmap=V.objectBitmap(o.type);this.anchor.x=.5;this.anchor.y=1;this.z=5;};Sprite_V3Placed.prototype.update=function(){Sprite.prototype.update.call(this);if(!$gameMap)return;var tw=$gameMap.tileWidth(),th=$gameMap.tileHeight();this.x=Math.round(($gameMap.adjustX(this._obj.x)+.5)*tw);this.y=Math.round(($gameMap.adjustY(this._obj.y)+1)*th);};
Spriteset_Map.prototype.syncV3Placed=function(force){if(!this._tilemap)return;if(!this._v3PlacedSprites)this._v3PlacedSprites=[];if(force){for(var i=0;i<this._v3PlacedSprites.length;i++)this._tilemap.removeChild(this._v3PlacedSprites[i]);this._v3PlacedSprites=[];}if(this._v3PlacedSprites.length)return;var mid=$gameMap.mapId(),a=placed();for(var j=0;j<a.length;j++)if(a[j].mapId===mid){var sp=new Sprite_V3Placed(a[j]);this._tilemap.addChild(sp);this._v3PlacedSprites.push(sp);}};
var _createChars=Spriteset_Map.prototype.createCharacters;Spriteset_Map.prototype.createCharacters=function(){_createChars.call(this);this.syncV3Placed(true);};

// Construções bloqueiam a passagem na base.
var _canPass=Game_CharacterBase.prototype.canPass;Game_CharacterBase.prototype.canPass=function(x,y,d){if(this===$gamePlayer&&$gameMap){var x2=$gameMap.roundXWithDirection(x,d),y2=$gameMap.roundYWithDirection(y,d);if(V.objectAt($gameMap.mapId(),x2,y2))return false;}return _canPass.call(this,x,y,d);};

// Interação/colocação acontece antes das ações de pesca/cultivo.
var _life=C.lifeAction;C.lifeAction=function(){if(V.removePlaced())return;if(V.interactPlaced())return;var it=C.activeItem?C.activeItem():null;if(it&&note(it,'craftObject')!==null&&$gameParty.hasItem(it)){V.placeObject(it);return;}_life.call(C);};

// Irrigação física por área a cada amanhecer.
var _newDay=V.onNewDay;V.onNewDay=function(){var before=V.state().calendar.lastDay;_newDay.call(V);var dk=C.dayKey();if(before===dk)return;var plots=C.state&&C.state().plots&&C.state().plots['5'];if(!plots)return;placed().forEach(function(o){if(o.mapId!==5||(o.type!=='sprinkler'&&o.type!=='sprinkler2'))return;var rad=o.type==='sprinkler2'?2:1;Object.keys(plots).forEach(function(k){var p=plots[k];if(p&&Math.abs(p.x-o.x)<=rad&&Math.abs(p.y-o.y)<=rad)p.wateredDay=dk;});});};

})();

// Receitas adicionais de construção física.
(function(){
'use strict';var C=window.Camutanga,V=C&&C.V3;if(!V)return;
function add(r){if(!V.recipes.some(function(x){return x.id===r.id;}))V.recipes.splice(7,0,r);}
add({id:'bench',name:'Bancada',out:81,qty:1,need:[[149,8],[96,1]],station:'Oficina',desc:'Abre a oficina ao interagir.'});
add({id:'furnace',name:'Forno Artesanal',out:82,qty:1,need:[[35,12],[62,4],[96,2]],station:'Oficina',desc:'Refino de materiais.'});
add({id:'fence',name:'Cerca x4',out:85,qty:4,need:[[53,3]],station:'Oficina',desc:'Organiza a propriedade.'});
add({id:'bigchest',name:'Baú Reforçado',out:152,qty:1,need:[[80,1],[99,8],[96,3]],station:'Oficina',desc:'Armazenamento reforçado.'});
})();

// ============================================================================
// Camutanga V3 - paisagem sonora dinâmica (BGS independente da música)
// ============================================================================
(function(){
'use strict';var C=window.Camutanga,V=C&&C.V3;if(!V)return;
V._ambientName='';
V.updateAmbient=function(force){if(!window.AudioManager||!window.$gameMap||!window.$dataMap)return;var own=$dataMap.bgs&&$dataMap.bgs.name;if(own&&String(own).indexOf('Camutanga_')!==0)return;var name='';if(V.OUTDOOR_MAPS.indexOf($gameMap.mapId())>=0){var d=C.World&&C.World.activeDisaster?C.World.activeDisaster():null,w=C.World&&C.World.effectiveWeather?C.World.effectiveWeather():'clear',h=C.gameClock?C.gameClock().hour:12;if(d&&d.type==='wind')name='Camutanga_WindAmbience';else if(w==='rain'||w==='storm'||(d&&d.type==='flood'))name='Camutanga_RainAmbience';else if(h>=19||h<5)name='Camutanga_NightAmbience';}
 if(!force&&name===V._ambientName)return;V._ambientName=name;if(name)AudioManager.playBgs({name:name,volume:28,pitch:100,pan:0},0);else if(!own)AudioManager.fadeOutBgs(1.2);};
var _start=Scene_Map.prototype.start;Scene_Map.prototype.start=function(){_start.call(this);V.updateAmbient(true);};
var _update=Scene_Map.prototype.update;Scene_Map.prototype.update=function(){_update.call(this);if(Graphics.frameCount%180===0)V.updateAmbient(false);};
})();

// ============================================================================
// Camutanga V3 - paginação do baú para inventários grandes
// ============================================================================
(function(){
'use strict';var C=window.Camutanga,V=C&&C.V3;if(!V||!window.Scene_CamutangaInventory26||!C.UI26)return;
var P=Scene_CamutangaInventory26.prototype;
function rr(ctx,x,y,w,h,r,fill,stroke,lw){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}}
function txt(b,t,x,y,w,h,align,size,col,bold){b.fontFace='GameFont';b.fontSize=size||16;b.textColor=col||'#fff';b.outlineColor='rgba(0,0,0,.78)';b.outlineWidth=3;b.fontBold=!!bold;b.drawText(String(t),x,y,w,h||22,align||'left');}
function icon(b,idx,x,y,sz){var set=ImageManager.loadSystem('IconSet');if(!set||!set.isReady||!set.isReady())return;var pw=Window_Base._iconWidth||32,ph=Window_Base._iconHeight||32;b.blt(set,(idx%16)*pw,Math.floor(idx/16)*ph,pw,ph,x,y,sz,sz);}
function card(b,x,y,w,h){var c=b._context;c.save();rr(c,x,y,w,h,12,'rgba(20,28,25,.92)','rgba(255,255,255,.12)',1);c.restore();if(b._setDirty)b._setDirty();}
P.drawV3Storage=function(){var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight;if(!V.canOpenStorage()){txt(b,'BAÚ DA BASE',36,164,W-72,40,'center',28,'#f2dda1',true);txt(b,'O armazenamento fica disponível na Base do Jogador ou dentro da casa.',W/2-280,230,560,30,'center',16,'#d7dfda');return;}var inv=$gameParty.items().filter(function(it){return it&&$gameParty.numItems(it)>0;}),stored=Object.keys(V.state().storage).map(Number).filter(function(id){return V.storageCount(id)>0&&$dataItems[id];});var per=20,pages=Math.max(1,Math.ceil(Math.max(inv.length,stored.length)/per));this._storagePage=Math.max(0,Math.min(this._storagePage||0,pages-1));var start=this._storagePage*per;txt(b,'MOCHILA',34,142,W/2-50,25,'center',17,'#f2dda1',true);txt(b,'BAÚ',W/2+16,142,W/2-50,25,'center',17,'#f2dda1',true);var cols=4,cellW=Math.floor((W/2-54)/cols),cellH=90;for(var ii=0;ii<per&&start+ii<inv.length;ii++){var it=inv[start+ii],cx=26+(ii%cols)*cellW,cy=176+Math.floor(ii/cols)*cellH;card(b,cx,cy,cellW-8,cellH-8);icon(b,it.iconIndex,cx+10,cy+12,36);txt(b,it.name,cx+52,cy+10,cellW-66,22,'left',12,'#f0eee3',true);txt(b,'x'+$gameParty.numItems(it),cx+52,cy+34,cellW-66,18,'left',11,'#b9c5bd');txt(b,'GUARDAR',cx+8,cy+60,cellW-24,16,'center',9,'#d9c653',true);this._hits.push({kind:'v3put',id:it.id,rect:{x:cx,y:cy,w:cellW-8,h:cellH-8}});}for(var jj=0;jj<per&&start+jj<stored.length;jj++){var id=stored[start+jj],sit=$dataItems[id],sx=W/2+18+(jj%cols)*cellW,sy=176+Math.floor(jj/cols)*cellH;card(b,sx,sy,cellW-8,cellH-8);icon(b,sit.iconIndex,sx+10,sy+12,36);txt(b,sit.name,sx+52,sy+10,cellW-66,22,'left',12,'#f0eee3',true);txt(b,'x'+V.storageCount(id),sx+52,sy+34,cellW-66,18,'left',11,'#b9c5bd');txt(b,'RETIRAR',sx+8,sy+60,cellW-24,16,'center',9,'#d9c653',true);this._hits.push({kind:'v3take',id:id,rect:{x:sx,y:sy,w:cellW-8,h:cellH-8}});}var by=H-45,bw=110;if(pages>1){var pr={x:W/2-bw-18,y:by,w:bw,h:28},nx={x:W/2+18,y:by,w:bw,h:28};card(b,pr.x,pr.y,pr.w,pr.h);card(b,nx.x,nx.y,nx.w,nx.h);txt(b,'◀ ANTERIOR',pr.x,pr.y+3,pr.w,20,'center',10,'#d9c653',true);txt(b,'PRÓXIMA ▶',nx.x,nx.y+3,nx.w,20,'center',10,'#d9c653',true);this._hits.push({kind:'v3storagePrev',rect:pr});this._hits.push({kind:'v3storageNext',rect:nx});txt(b,'PÁGINA '+(this._storagePage+1)+'/'+pages,W/2-70,by+3,140,20,'center',10,'#9eaaa3');}};
var _touch=P.handleTouch;P.handleTouch=function(x,y){for(var i=this._hits.length-1;i>=0;i--){var h=this._hits[i],r=h.rect;if(!r||x<r.x||y<r.y||x>=r.x+r.w||y>=r.y+r.h)continue;if(h.kind==='v3storagePrev'){this._storagePage=Math.max(0,(this._storagePage||0)-1);this._needsRefresh=true;SoundManager.playCursor();return;}if(h.kind==='v3storageNext'){this._storagePage=(this._storagePage||0)+1;this._needsRefresh=true;SoundManager.playCursor();return;}}_touch.call(this,x,y);};
})();

// Navegação de teclado/gamepad nas telas novas.
(function(){
'use strict';var C=window.Camutanga;if(!C||!C.V3||!C.UI26||!window.Scene_CamutangaInventory26)return;
var P=Scene_CamutangaInventory26.prototype,_list=P.updateListKeyboard;
P.updateListKeyboard=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='craft'||tab==='cook'){if(Input.isRepeated('left'))this.moveSelection(-1);else if(Input.isRepeated('right'))this.moveSelection(1);else if(Input.isRepeated('up'))this.moveSelection(-6);else if(Input.isRepeated('down'))this.moveSelection(6);return;}_list.call(this);};
})();

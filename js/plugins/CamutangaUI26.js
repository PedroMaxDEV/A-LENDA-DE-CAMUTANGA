/*:
 * @plugindesc [v2.6] Interface Camutanga - HUD compacto e mochila touch sem janelas do RPG Maker.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Substitui o menu/mochila antigo por uma interface desenhada em Sprite/Bitmap.
 * Foi feita para mouse, teclado e celular e não usa WindowLayer/addWindow.
 *
 * PC:
 *   I / ESC = abrir mochila
 *   Setas/WASD = navegar
 *   Enter/Z = confirmar
 *   Esc/X = voltar
 *
 * Celular:
 *   Toque direto nas abas, itens e botões grandes.
 */
(function(){
'use strict';

window.Camutanga = window.Camutanga || {};
var C = window.Camutanga;
var UI = C.UI26 = C.UI26 || {};
UI.VERSION = '2.6.0';
UI.tabs = [
    {id:'inventory',label:'MOCHILA'},
    {id:'quests',label:'PEDIDOS'},
    {id:'skills',label:'HABILIDADES'},
    {id:'collections',label:'COLEÇÃO'},
    {id:'system',label:'SISTEMA'}
];
UI.filters = [
    {id:'all',label:'TODOS'},
    {id:'tools',label:'FERRAMENTAS'},
    {id:'food',label:'COMIDA'},
    {id:'seeds',label:'SEMENTES'},
    {id:'fish',label:'PEIXES'},
    {id:'resources',label:'RECURSOS'}
];

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function pad(n){return n<10?'0'+n:String(n);}
function rr(ctx,x,y,w,h,r,fill,stroke,lw){
    r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=lw||1;ctx.strokeStyle=stroke;ctx.stroke();}
}
function dirty(b){if(b&&b._setDirty)b._setDirty();}
function font(b,size,color,bold){b.fontFace='GameFont';b.fontSize=size;b.textColor=color||'#fff';b.outlineColor='rgba(0,0,0,.74)';b.outlineWidth=3;b.fontBold=!!bold;}
function drawText(b,t,x,y,w,h,align,size,color,bold){font(b,size||18,color||'#fff',bold);b.drawText(String(t==null?'':t),x,y,w,h||28,align||'left');}
function drawIcon(b,iconIndex,x,y,size){
    size=size||40;var set=ImageManager.loadSystem('IconSet');
    if(!set || !set.isReady || !set.isReady()) return false;
    var pw=Window_Base._iconWidth||32,ph=Window_Base._iconHeight||32;
    var sx=(iconIndex%16)*pw,sy=Math.floor(iconIndex/16)*ph;
    b.blt(set,sx,sy,pw,ph,x,y,size,size);return true;
}
function gauge(b,x,y,w,h,rate,c1,c2){
    var ctx=b._context;ctx.save();rr(ctx,x,y,w,h,h/2,'rgba(5,10,9,.65)','rgba(255,255,255,.14)',1);
    var fw=Math.floor((w-4)*clamp(rate,0,1));if(fw>1){var g=ctx.createLinearGradient(x+2,y,x+w-2,y);g.addColorStop(0,c1);g.addColorStop(1,c2);rr(ctx,x+2,y+2,fw,h-4,(h-4)/2,g,null);}
    ctx.restore();dirty(b);
}
function card(b,x,y,w,h,selected){
    var ctx=b._context;ctx.save();ctx.shadowColor='rgba(0,0,0,.30)';ctx.shadowBlur=8;ctx.shadowOffsetY=2;
    rr(ctx,x,y,w,h,14,selected?'rgba(70,93,61,.96)':'rgba(20,28,25,.91)',selected?'rgba(243,211,111,.90)':'rgba(255,255,255,.12)',selected?2:1);ctx.restore();dirty(b);
}
function pill(b,x,y,w,h,text,active){
    var ctx=b._context;ctx.save();rr(ctx,x,y,w,h,h/2,active?'rgba(196,145,57,.92)':'rgba(38,47,41,.92)',active?'rgba(255,235,170,.65)':'rgba(255,255,255,.12)',1);ctx.restore();dirty(b);
    drawText(b,text,x+8,y+2,w-16,h-4,'center',14,active?'#17130d':'#e8eee9',active);
}
function wrapLines(text,max){
    text=String(text||'').replace(/\r/g,'').replace(/\n/g,' \n ');var words=text.split(/\s+/),lines=[],line='';
    for(var i=0;i<words.length;i++){
        if(words[i]==='\n'){if(line)lines.push(line);line='';continue;}
        var t=line?line+' '+words[i]:words[i];
        if(t.length>max && line){lines.push(line);line=words[i];}else line=t;
    }
    if(line)lines.push(line);return lines;
}
function drawParagraph(b,text,x,y,w,lineH,maxLines,color,size){
    var chars=Math.max(16,Math.floor(w/((size||16)*0.56))),lines=wrapLines(text,chars);if(maxLines)lines=lines.slice(0,maxLines);
    for(var i=0;i<lines.length;i++)drawText(b,lines[i],x,y+i*lineH,w,lineH,'left',size||16,color||'#d9e0db',false);
    return lines.length*lineH;
}
function isTouch(){return C.touchDevice?C.touchDevice():('ontouchstart'in window);}
function pointIn(r,x,y){return r&&x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h;}
function itemCount(item){return $gameParty&&item?$gameParty.numItems(item):0;}
function note(item,tag){return C.noteTag?C.noteTag(item,tag):null;}
function isFish(item){return !!item && (note(item,'fish')!==null || [23,24,25,26,70,71,72,73].indexOf(item.id)>=0);}
function classify(item){
    if(!item)return 'other';
    if(note(item,'lifeTool')!==null || DataManager.isWeapon(item) || DataManager.isArmor(item))return 'tools';
    if(note(item,'cropSeed')!==null)return 'seeds';
    if(isFish(item))return 'fish';
    if(note(item,'resource')!==null || note(item,'artifact')!==null)return 'resources';
    if(note(item,'stamina')!==null || (DataManager.isItem(item)&&item.consumable))return 'food';
    return 'other';
}
function weather(){return C.weatherText?C.weatherText():'Tempo';}
function clock(){return C.gameClock?C.gameClock():{day:1,hour:6,minute:0};}
function state(){return C.state?C.state():{stamina:100,maxStamina:100,skills:{},collections:{fish:{}}};}
function activeItem(){return C.activeItem?C.activeItem():null;}
function canUse(item){return !!item&&itemCount(item)>0;}

// ---------------------------------------------------------------------------
// HUD novo do mapa
// ---------------------------------------------------------------------------
function Sprite_CamutangaHUD26(){this.initialize.apply(this,arguments);}
Sprite_CamutangaHUD26.prototype=Object.create(Sprite.prototype);
Sprite_CamutangaHUD26.prototype.constructor=Sprite_CamutangaHUD26;
Sprite_CamutangaHUD26.prototype.initialize=function(){
    Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._sig='';this._tick=0;this.refresh();
};
Sprite_CamutangaHUD26.prototype.update=function(){
    Sprite.prototype.update.call(this);if(!$gameParty||!$gameSystem)return;this._tick++;
    if(this._tick%5!==0)return;
    var s=state(),a=$gameParty.leader(),t=clock(),it=activeItem();
    var sig=[Graphics.boxWidth,Graphics.boxHeight,s.stamina,s.maxStamina,a?a.hp:0,a?a.mhp:0,t.day,t.hour,t.minute,$gameParty.gold(),it?it.id:0,weather(),isTouch()?1:0].join('|');
    if(sig!==this._sig){this._sig=sig;this.refresh();}
};
Sprite_CamutangaHUD26.prototype.refresh=function(){
    var b=this.bitmap;if(b.width!==Graphics.boxWidth||b.height!==Graphics.boxHeight)this.bitmap=b=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);b.clear();if(!$gameParty)return;
    var s=state(),a=$gameParty.leader(),t=clock(),it=activeItem(),W=Graphics.boxWidth,H=Graphics.boxHeight;
    var ctx=b._context;

    // Personagem + barras, bem menor que os HUDs antigos.
    ctx.save();rr(ctx,14,12,286,72,16,'rgba(16,23,20,.88)','rgba(255,255,255,.13)',1);ctx.restore();dirty(b);
    if(C.Hero&&C.Hero.faceBitmap){try{b.blt(C.Hero.faceBitmap(),0,0,128,128,20,17,62,62);}catch(e){}}
    drawText(b,a?a.name():'JHON',92,17,82,22,'left',17,'#f3dfaa',true);
    drawText(b,'VIDA',92,41,46,17,'left',11,'#cbd5cf');gauge(b,136,44,146,10,a&&a.mhp?a.hp/a.mhp:1,'#d24f49','#ec8d62');
    drawText(b,'ENERGIA',92,60,58,17,'left',11,'#cbd5cf');gauge(b,150,63,132,10,s.maxStamina?s.stamina/s.maxStamina:0,'#55a859','#d9c653');

    // Relógio central.
    var tw=198,tx=Math.floor((W-tw)/2);ctx.save();rr(ctx,tx,12,tw,58,18,'rgba(16,23,20,.86)','rgba(255,255,255,.12)',1);ctx.restore();dirty(b);
    drawText(b,pad(t.hour)+':'+pad(t.minute),tx+12,14,112,31,'left',27,'#fff',true);
    drawText(b,'DIA '+t.day,tx+124,19,62,20,'right',14,'#f0d789',true);drawText(b,weather().toUpperCase(),tx+12,44,174,18,'center',11,'#cbd5cf');

    // Dinheiro no canto direito.
    var rw=208,rx=W-rw-14;ctx.save();rr(ctx,rx,12,rw,58,18,'rgba(16,23,20,.86)','rgba(255,255,255,.12)',1);ctx.restore();dirty(b);
    drawText(b,'CARTEIRA',rx+16,18,82,18,'left',11,'#cbd5cf');drawText(b,String($gameParty.gold()),rx+14,34,122,26,'left',22,'#f0d26c',true);drawText(b,$dataSystem.currencyUnit||'G',rx+139,38,52,20,'right',13,'#cbd5cf');

    // Item ativo: cartão pequeno que também serve de lembrete.
    var aw=isTouch()?172:208,ax=W-aw-14,ay=H-(isTouch()?124:74);ctx.save();rr(ctx,ax,ay,aw,54,15,'rgba(16,23,20,.88)','rgba(255,255,255,.13)',1);ctx.restore();dirty(b);
    if(it){drawIcon(b,it.iconIndex,ax+10,ay+8,38);drawText(b,it.name,ax+55,ay+8,aw-65,20,'left',14,'#f5f0df',true);drawText(b,'ITEM ATIVO',ax+55,ay+29,aw-65,16,'left',10,'#bdc8c0');}
    else{drawText(b,'SEM ITEM ATIVO',ax+12,ay+17,aw-24,20,'center',12,'#bdc8c0');}

    // Atalhos apenas no PC; no celular os botões DOM continuam sendo usados.
    if(!isTouch()){
        var hw=430,hx=Math.floor((W-hw)/2),hy=H-52;ctx.save();rr(ctx,hx,hy,hw,38,13,'rgba(12,18,16,.78)','rgba(255,255,255,.09)',1);ctx.restore();dirty(b);
        drawText(b,'F AÇÃO',hx+10,hy+7,90,20,'center',11,'#d8e0db');drawText(b,'I MOCHILA',hx+110,hy+7,100,20,'center',11,'#d8e0db');drawText(b,'Q/R ITEM',hx+220,hy+7,90,20,'center',11,'#d8e0db');drawText(b,'SHIFT CORRER',hx+315,hy+7,105,20,'center',11,'#d8e0db');
    }
};

var _Scene_Map_createAllWindows26=Scene_Map.prototype.createAllWindows;
Scene_Map.prototype.createAllWindows=function(){
    _Scene_Map_createAllWindows26.call(this);
    if(this._camutangaPolishHUD)this._camutangaPolishHUD.visible=false;
    if(this._camutangaHUD)this._camutangaHUD.visible=false;
    this._camutangaHUD26=new Sprite_CamutangaHUD26();this.addChild(this._camutangaHUD26);
};

// ---------------------------------------------------------------------------
// Mochila / central de jogo - 100% Sprite/Bitmap, sem WindowLayer.
// ---------------------------------------------------------------------------
function Scene_CamutangaInventory26(){this.initialize.apply(this,arguments);}
Scene_CamutangaInventory26.prototype=Object.create(Scene_Base.prototype);
Scene_CamutangaInventory26.prototype.constructor=Scene_CamutangaInventory26;
Scene_CamutangaInventory26.prototype.initialize=function(){
    Scene_Base.prototype.initialize.call(this);this._tab=0;this._filter=0;this._page=0;this._selected=0;this._data=[];this._hits=[];this._tick=0;this._fade=0;this._needsRefresh=true;this._lastSig='';
};
Scene_CamutangaInventory26.prototype.create=function(){
    Scene_Base.prototype.create.call(this);
    this._background=new Sprite();this._background.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this.addChild(this._background);
    this._ui=new Sprite();this._ui.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this.addChild(this._ui);
    this._ui.opacity=0;this.refresh();
};
Scene_CamutangaInventory26.prototype.start=function(){
    Scene_Base.prototype.start.call(this);if(document&&document.body)document.body.classList.add('camutanga-ui-open');
};
Scene_CamutangaInventory26.prototype.terminate=function(){
    if(document&&document.body)document.body.classList.remove('camutanga-ui-open');Scene_Base.prototype.terminate.call(this);
};
Scene_CamutangaInventory26.prototype.update=function(){
    Scene_Base.prototype.update.call(this);this._tick++;if(this._fade<255){this._fade=Math.min(255,this._fade+34);this._ui.opacity=this._fade;}
    this.updateInput();
    var s=state(),it=activeItem(),sig=[this._tab,this._filter,this._page,this._selected,$gameParty?$gameParty.gold():0,s.stamina,s.maxStamina,it?it.id:0,this._tick%30===0?1:0].join('|');
    if(this._needsRefresh||sig!==this._lastSig){this._lastSig=sig;this._needsRefresh=false;this.refresh();}
};
Scene_CamutangaInventory26.prototype.refresh=function(){
    if(!this._ui||!this._ui.bitmap)return;var b=this._ui.bitmap;if(b.width!==Graphics.boxWidth||b.height!==Graphics.boxHeight){this._ui.bitmap=b=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._background.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);}b.clear();this._hits=[];
    this.drawBackground();this.buildData();this.drawHeader();this.drawTabs();
    var tab=UI.tabs[this._tab].id;
    if(tab==='inventory')this.drawInventory();else if(tab==='quests')this.drawQuests();else if(tab==='skills')this.drawSkills();else if(tab==='collections')this.drawCollections();else this.drawSystem();
};
Scene_CamutangaInventory26.prototype.drawBackground=function(){
    var b=this._background.bitmap,ctx=b._context,W=b.width,H=b.height;b.clear();ctx.save();ctx.fillStyle='#111713';ctx.fillRect(0,0,W,H);
    var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'rgba(66,89,56,.42)');g.addColorStop(.48,'rgba(25,34,29,.18)');g.addColorStop(1,'rgba(121,83,37,.26)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // textura discreta sem imagens externas
    ctx.globalAlpha=.13;ctx.fillStyle='#d8c88a';for(var i=0;i<80;i++){var x=(i*173)%W,y=(i*97)%H;ctx.fillRect(x,y,2,2);}ctx.restore();dirty(b);
};
Scene_CamutangaInventory26.prototype.drawHeader=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,t=clock(),s=state(),a=$gameParty.leader();
    drawText(b,'A LENDA DE CAMUTANGA',28,14,350,30,'left',25,'#f2dc9f',true);drawText(b,'Central do jogador',30,43,260,18,'left',12,'#aebbb2');
    var ctx=b._context;ctx.save();rr(ctx,W-452,14,424,48,16,'rgba(14,21,18,.78)','rgba(255,255,255,.10)',1);ctx.restore();dirty(b);
    drawText(b,'DIA '+t.day+'  '+pad(t.hour)+':'+pad(t.minute),W-436,24,160,22,'left',15,'#f1ead7',true);drawText(b,weather(),W-270,24,95,22,'center',12,'#c5d0c9');drawText(b,$gameParty.gold()+' '+($dataSystem.currencyUnit||'G'),W-169,24,126,22,'right',15,'#efd16f',true);
    gauge(b,W-436,49,158,7,s.maxStamina?s.stamina/s.maxStamina:0,'#55a859','#d9c653');
    drawText(b,'ENERGIA '+Math.round(s.stamina)+'/'+s.maxStamina,W-270,45,145,16,'left',10,'#b9c5bd');
    if(a)drawText(b,'HP '+a.hp+'/'+a.mhp,W-127,45,84,16,'right',10,'#b9c5bd');
};
Scene_CamutangaInventory26.prototype.drawTabs=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,x=28,y=78,gap=8,total=W-56,tw=Math.floor((total-gap*(UI.tabs.length-1))/UI.tabs.length);
    for(var i=0;i<UI.tabs.length;i++){var r={x:x+i*(tw+gap),y:y,w:tw,h:48};pill(b,r.x,r.y,r.w,r.h,UI.tabs[i].label,i===this._tab);this._hits.push({kind:'tab',index:i,rect:r});}
};
Scene_CamutangaInventory26.prototype.buildData=function(){
    var tab=UI.tabs[this._tab].id,s=state();
    if(tab==='inventory'){
        var f=UI.filters[this._filter].id,arr=$gameParty.allItems().filter(function(x){return !!x;});
        if(f!=='all')arr=arr.filter(function(it){return classify(it)===f;});
        arr.sort(function(a,b){var ca=classify(a),cb=classify(b);if(ca!==cb)return ca<cb?-1:1;return a.id-b.id;});this._data=arr;
    }else if(tab==='quests')this._data=(s.daily&&s.daily.quests?s.daily.quests:[]).slice();
    else if(tab==='skills')this._data=['fishing','farming','gathering'];
    else if(tab==='collections')this._data=[23,24,25,26,70,71,72,73].map(function(id){return $dataItems[id];}).filter(Boolean);
    else this._data=[
        {cmd:'save',name:'SALVAR JOGO',desc:'Abrir a tela de salvamento.'},
        {cmd:'sleep',name:'DORMIR',desc:'Dormir até 06:00 e recuperar toda a energia.'},
        {cmd:'bgmDown',name:'MÚSICA -',desc:'Diminuir o volume da música.'},
        {cmd:'bgmUp',name:'MÚSICA +',desc:'Aumentar o volume da música.'},
        {cmd:'seDown',name:'EFEITOS -',desc:'Diminuir o volume dos efeitos.'},
        {cmd:'seUp',name:'EFEITOS +',desc:'Aumentar o volume dos efeitos.'},
        {cmd:'fullscreen',name:'TELA CHEIA',desc:'Alternar o modo de tela cheia.'},
        {cmd:'story',name:'A LENDA',desc:'Iniciar a campanha original mantendo o progresso da vida livre.'}
    ];
    this._selected=clamp(this._selected,0,Math.max(0,this._data.length-1));
};
Scene_CamutangaInventory26.prototype.drawInventory=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight;
    var fx=28,fy=140,fg=7,fw=Math.floor((W-56-fg*(UI.filters.length-1))/UI.filters.length);
    for(var i=0;i<UI.filters.length;i++){var fr={x:fx+i*(fw+fg),y:fy,w:fw,h:36};pill(b,fr.x,fr.y,fr.w,fr.h,UI.filters[i].label,i===this._filter);this._hits.push({kind:'filter',index:i,rect:fr});}
    var gridX=28,gridY=190,detailW=isTouch()?390:416,gridW=W-gridX-detailW-42,cols=isTouch()?4:5,gap=10,rows=3,cardW=Math.floor((gridW-gap*(cols-1))/cols),cardH=128,per=cols*rows;
    var pages=Math.max(1,Math.ceil(this._data.length/per));this._page=clamp(this._page,0,pages-1);
    var start=this._page*per,end=Math.min(this._data.length,start+per);
    for(var n=start;n<end;n++){
        var local=n-start,row=Math.floor(local/cols),col=local%cols,x=gridX+col*(cardW+gap),y=gridY+row*(cardH+gap),r={x:x,y:y,w:cardW,h:cardH},it=this._data[n],sel=n===this._selected;
        card(b,x,y,cardW,cardH,sel);drawIcon(b,it.iconIndex,x+Math.floor((cardW-48)/2),y+12,48);
        drawText(b,it.name,x+8,y+67,cardW-16,22,'center',12,sel?'#ffe39a':'#f2f2e8',true);drawText(b,'x'+itemCount(it),x+8,y+94,cardW-16,18,'center',11,'#b9c6be');
        if(activeItem()&&activeItem().id===it.id)drawText(b,'ATIVO',x+8,y+108,cardW-16,16,'center',10,'#f0cf66',true);
        this._hits.push({kind:'item',index:n,rect:r});
    }
    this.drawPageControls(gridX,gridY+rows*(cardH+gap)+2,gridW,pages);
    this.drawItemDetail(W-detailW-28,190,detailW,H-214);
};
Scene_CamutangaInventory26.prototype.drawPageControls=function(x,y,w,pages){
    var b=this._ui.bitmap,btnW=88;var l={x:x,y:y,w:btnW,h:34},r={x:x+w-btnW,y:y,w:btnW,h:34};pill(b,l.x,l.y,l.w,l.h,'◀',false);pill(b,r.x,r.y,r.w,r.h,'▶',false);this._hits.push({kind:'prevPage',rect:l});this._hits.push({kind:'nextPage',rect:r});drawText(b,'PÁGINA '+(this._page+1)+' / '+pages,x+btnW,y+5,w-btnW*2,20,'center',11,'#b8c3bc');
};
Scene_CamutangaInventory26.prototype.drawItemDetail=function(x,y,w,h){
    var b=this._ui.bitmap,it=this._data[this._selected];card(b,x,y,w,h,false);if(!it){drawText(b,'Nenhum item nesta categoria.',x+20,y+40,w-40,30,'center',16,'#c3cec7');return;}
    drawIcon(b,it.iconIndex,x+18,y+18,64);drawText(b,it.name,x+94,y+18,w-112,28,'left',20,'#f2dda1',true);drawText(b,'Quantidade: '+itemCount(it),x+94,y+50,w-112,20,'left',12,'#b9c6be');
    var label=classify(it).toUpperCase();drawText(b,label,x+18,y+96,w-36,18,'left',10,'#d1b760',true);
    drawParagraph(b,it.description||'Item de Camutanga.',x+18,y+122,w-36,21,5,'#d7dfda',14);
    var hint='Selecionar como item ativo.';if(note(it,'stamina')!==null)hint='Recupera '+note(it,'stamina')+' de energia.';else if(note(it,'cropSeed')!==null)hint='Semente: selecione e use a ação de vida para plantar.';else if(note(it,'lifeTool')!==null)hint='Ferramenta: torna-se o item ativo.';else if(DataManager.isWeapon(it)||DataManager.isArmor(it))hint='Equipamento: equipa no personagem.';
    drawParagraph(b,hint,x+18,y+h-116,w-36,18,3,'#aebbb2',12);
    var br={x:x+18,y:y+h-62,w:w-36,h:44};pill(b,br.x,br.y,br.w,br.h,this.actionLabel(it),true);this._hits.push({kind:'use',rect:br});
};
Scene_CamutangaInventory26.prototype.actionLabel=function(it){
    if(!it)return 'SELECIONAR';if(note(it,'stamina')!==null)return 'USAR AGORA';if(note(it,'lifeTool')!==null||note(it,'cropSeed')!==null||note(it,'bait')!==null)return activeItem()&&activeItem().id===it.id?'ITEM ATIVO':'DEIXAR ATIVO';if(DataManager.isWeapon(it)||DataManager.isArmor(it))return 'EQUIPAR';return 'SELECIONAR';
};
Scene_CamutangaInventory26.prototype.drawQuests=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,x=36,y=154,gap=18,w=W-72,h=142;
    if(!this._data.length){drawText(b,'Nenhum pedido hoje.',0,260,W,30,'center',18,'#cad5ce');return;}
    for(var i=0;i<this._data.length;i++){var q=this._data[i],yy=y+i*(h+gap);card(b,x,yy,w,h,i===this._selected);drawText(b,(q.done?'✓ ':'')+q.title,x+22,yy+16,w-44,28,'left',20,q.done?'#89d88f':'#f1dda2',true);drawParagraph(b,q.desc,x+22,yy+48,w-230,22,2,'#d7dfda',14);gauge(b,x+22,yy+101,w-250,14,q.target?q.current/q.target:0,'#5fa35d','#e2c95c');drawText(b,q.current+'/'+q.target,x+w-210,yy+94,80,24,'right',15,'#fff',true);drawText(b,'+'+q.reward+' '+($dataSystem.currencyUnit||'G'),x+w-118,yy+94,96,24,'right',14,'#efd16f',true);this._hits.push({kind:'item',index:i,rect:{x:x,y:yy,w:w,h:h}});}
};
Scene_CamutangaInventory26.prototype.drawSkills=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,x=36,y=164,gap=22,w=Math.floor((W-72-gap*2)/3),h=380,s=state();
    for(var i=0;i<this._data.length;i++){var key=this._data[i],sk=s.skills[key]||{level:1,xp:0},xx=x+i*(w+gap),sel=i===this._selected;card(b,xx,y,w,h,sel);var title=C.skillName?C.skillName(key):key;drawText(b,title.toUpperCase(),xx+18,y+22,w-36,30,'center',22,'#f1dda2',true);drawText(b,'NÍVEL '+sk.level,xx+18,y+74,w-36,44,'center',30,'#fff',true);var need=80+sk.level*45;gauge(b,xx+28,y+140,w-56,16,need?sk.xp/need:0,'#5c8ac7','#d9c653');drawText(b,sk.xp+' / '+need+' XP',xx+20,y+164,w-40,22,'center',12,'#c8d3cc');var desc=key==='fishing'?'Melhora a qualidade dos peixes e sua progressão na pesca.':key==='farming'?'Aumenta sua eficiência com plantio, rega e colheita.':'Melhora sua progressão ao explorar e coletar recursos.';drawParagraph(b,desc,xx+28,y+220,w-56,24,5,'#d7dfda',15);this._hits.push({kind:'item',index:i,rect:{x:xx,y:y,w:w,h:h}});}
};
Scene_CamutangaInventory26.prototype.drawCollections=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight,s=state(),cols=4,gap=16,x=36,y=160,w=Math.floor((W-72-gap*(cols-1))/cols),h=210;
    for(var i=0;i<this._data.length;i++){var it=this._data[i],row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap),f=s.collections&&s.collections.fish?s.collections.fish[String(it.id)]:null,sel=i===this._selected;card(b,xx,yy,w,h,sel);if(f)drawIcon(b,it.iconIndex,xx+Math.floor((w-64)/2),yy+22,64);else{var ctx=b._context;ctx.save();ctx.globalAlpha=.35;rr(ctx,xx+w/2-32,yy+24,64,64,18,'#111',null);ctx.restore();dirty(b);}drawText(b,f?it.name:'???',xx+14,yy+100,w-28,25,'center',17,f?'#f1dda2':'#7f8a83',true);if(f){drawText(b,'Capturados: '+f.count,xx+14,yy+137,w-28,20,'center',12,'#c8d3cc');drawText(b,'Recorde: '+Number(f.bestWeight||0).toFixed(2)+' kg',xx+14,yy+160,w-28,20,'center',12,'#c8d3cc');drawText(b,'★'.repeat(Math.max(0,Number(f.bestQuality||0))),xx+14,yy+181,w-28,18,'center',13,'#efd16f');}else drawText(b,'Ainda não descoberto',xx+14,yy+148,w-28,20,'center',11,'#7f8a83');this._hits.push({kind:'item',index:i,rect:{x:xx,y:yy,w:w,h:h}});}
};
Scene_CamutangaInventory26.prototype.drawSystem=function(){
    var b=this._ui.bitmap,W=Graphics.boxWidth,cols=4,gap=16,x=36,y=164,w=Math.floor((W-72-gap*(cols-1))/cols),h=176;
    for(var i=0;i<this._data.length;i++){var e=this._data[i],row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap),sel=i===this._selected;card(b,xx,yy,w,h,sel);drawText(b,e.name,xx+18,yy+28,w-36,28,'center',18,sel?'#ffe39a':'#f2dda1',true);drawParagraph(b,e.desc,xx+22,yy+72,w-44,21,3,'#cbd5cf',13);if(e.cmd==='bgmDown'||e.cmd==='bgmUp')drawText(b,'Música: '+ConfigManager.bgmVolume+'%',xx+12,yy+140,w-24,20,'center',11,'#efd16f');if(e.cmd==='seDown'||e.cmd==='seUp')drawText(b,'Efeitos: '+ConfigManager.seVolume+'%',xx+12,yy+140,w-24,20,'center',11,'#efd16f');this._hits.push({kind:'system',index:i,rect:{x:xx,y:yy,w:w,h:h}});}
    drawText(b,'ESC / X: fechar  •  Toque em qualquer cartão para executar',36,Graphics.boxHeight-46,W-72,22,'center',11,'#9eaaa3');
};
Scene_CamutangaInventory26.prototype.updateInput=function(){
    if(Input.isTriggered('cancel')||Input.isTriggered('menu')){SoundManager.playCancel();SceneManager.pop();return;}
    if(TouchInput.isTriggered())this.handleTouch(TouchInput.x,TouchInput.y);
    if(TouchInput.wheelY>20){this.changePage(1);}else if(TouchInput.wheelY<-20){this.changePage(-1);}
    if(Input.isTriggered('pageup'))this.changeTab(-1);if(Input.isTriggered('pagedown'))this.changeTab(1);
    var tab=UI.tabs[this._tab].id;if(tab==='inventory')this.updateGridKeyboard();else this.updateListKeyboard();
    if(Input.isTriggered('ok'))this.activateSelected();
};
Scene_CamutangaInventory26.prototype.updateGridKeyboard=function(){
    var cols=isTouch()?4:5;if(Input.isRepeated('left'))this.moveSelection(-1);else if(Input.isRepeated('right'))this.moveSelection(1);else if(Input.isRepeated('up'))this.moveSelection(-cols);else if(Input.isRepeated('down'))this.moveSelection(cols);
};
Scene_CamutangaInventory26.prototype.updateListKeyboard=function(){
    if(Input.isRepeated('left'))this.moveSelection(-1);else if(Input.isRepeated('right'))this.moveSelection(1);else if(Input.isRepeated('up'))this.moveSelection(-1);else if(Input.isRepeated('down'))this.moveSelection(1);
};
Scene_CamutangaInventory26.prototype.moveSelection=function(d){if(!this._data.length)return;var n=clamp(this._selected+d,0,this._data.length-1);if(n!==this._selected){this._selected=n;SoundManager.playCursor();if(UI.tabs[this._tab].id==='inventory'){var per=(isTouch()?4:5)*3;this._page=Math.floor(this._selected/per);}this._needsRefresh=true;}};
Scene_CamutangaInventory26.prototype.changeTab=function(d){var n=(this._tab+d+UI.tabs.length)%UI.tabs.length;if(n!==this._tab){this._tab=n;this._page=0;this._selected=0;SoundManager.playCursor();this._needsRefresh=true;}};
Scene_CamutangaInventory26.prototype.changePage=function(d){if(UI.tabs[this._tab].id!=='inventory')return;var per=(isTouch()?4:5)*3,pages=Math.max(1,Math.ceil(this._data.length/per)),n=clamp(this._page+d,0,pages-1);if(n!==this._page){this._page=n;this._selected=Math.min(this._data.length-1,n*per);SoundManager.playCursor();this._needsRefresh=true;}};
Scene_CamutangaInventory26.prototype.handleTouch=function(x,y){
    for(var i=this._hits.length-1;i>=0;i--){var h=this._hits[i];if(!pointIn(h.rect,x,y))continue;
        if(h.kind==='tab'){this._tab=h.index;this._page=0;this._selected=0;SoundManager.playCursor();}
        else if(h.kind==='filter'){this._filter=h.index;this._page=0;this._selected=0;SoundManager.playCursor();}
        else if(h.kind==='item'){if(this._selected===h.index&&UI.tabs[this._tab].id==='inventory')this.activateSelected();else{this._selected=h.index;SoundManager.playCursor();}}
        else if(h.kind==='use')this.activateSelected();else if(h.kind==='prevPage')this.changePage(-1);else if(h.kind==='nextPage')this.changePage(1);else if(h.kind==='system'){this._selected=h.index;this.activateSelected();}
        this._needsRefresh=true;return;
    }
};
Scene_CamutangaInventory26.prototype.activateSelected=function(){
    var tab=UI.tabs[this._tab].id,e=this._data[this._selected];if(!e)return;
    if(tab==='inventory'){
        if(!canUse(e)){SoundManager.playBuzzer();return;}var ok=C.useInventoryItem?C.useInventoryItem(e):false;if(ok){SoundManager.playOk();this._needsRefresh=true;}else SoundManager.playBuzzer();return;
    }
    if(tab==='system'){this.runSystem(e);return;}
    SoundManager.playOk();
};
Scene_CamutangaInventory26.prototype.runSystem=function(e){
    if(!e)return;var cmd=e.cmd;
    if(cmd==='save'){SoundManager.playOk();SceneManager.push(Scene_Save);return;}
    if(cmd==='sleep'){
        if($gameMap&&($gameMap.mapId()===5||$gameMap.mapId()===6)){if(C.advanceToMorning)C.advanceToMorning();SoundManager.playRecovery();SceneManager.pop();}
        else{SoundManager.playBuzzer();if(C.toast)C.toast('Você só pode dormir na sua base.',180);}return;
    }
    if(cmd==='bgmDown'||cmd==='bgmUp'){ConfigManager.bgmVolume=clamp(ConfigManager.bgmVolume+(cmd==='bgmUp'?10:-10),0,100);ConfigManager.bgsVolume=ConfigManager.bgmVolume;ConfigManager.save();SoundManager.playCursor();this._needsRefresh=true;return;}
    if(cmd==='seDown'||cmd==='seUp'){ConfigManager.seVolume=clamp(ConfigManager.seVolume+(cmd==='seUp'?10:-10),0,100);ConfigManager.meVolume=ConfigManager.seVolume;ConfigManager.save();SoundManager.playCursor();this._needsRefresh=true;return;}
    if(cmd==='fullscreen'){try{if(Graphics._switchFullScreen)Graphics._switchFullScreen();else if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen();}catch(err){}SoundManager.playOk();return;}
    if(cmd==='story'){state().mode='storyOptional';$gamePlayer.reserveTransfer($dataSystem.startMapId,$dataSystem.startX,$dataSystem.startY,2,0);if(C.toast)C.toast('A campanha original foi ativada. Seu progresso foi mantido.',240);SoundManager.playOk();SceneManager.pop();return;}
};

window.Scene_CamutangaInventory26=Scene_CamutangaInventory26;

// Intercepta todas as entradas comuns do menu/item. Isso pega I, ESC e o menu
// do Chrono sem precisar modificar o CamutangaLife antigo.
var _SceneManager_push26=SceneManager.push;
SceneManager.push=function(sceneClass){
    if(sceneClass===window.Scene_CamutangaMenu || sceneClass===Scene_Menu || sceneClass===Scene_Item){return _SceneManager_push26.call(this,Scene_CamutangaInventory26);}
    return _SceneManager_push26.call(this,sceneClass);
};

// ESC no mapa também abre a nova central.
var _Scene_Map_callMenu26=Scene_Map.prototype.callMenu;
Scene_Map.prototype.callMenu=function(){
    SoundManager.playOk();SceneManager.push(Scene_CamutangaInventory26);Window_MenuCommand.initCommandPosition();$gameTemp.clearDestination();this._mapNameWindow&&this._mapNameWindow.hide();this._waitCount=2;
};

// CSS de apoio: esconde os botões do mapa enquanto a mochila está aberta.
function injectCss(){
    if(!document.getElementById('camutanga-ui26-css')){
        var s=document.createElement('style');s.id='camutanga-ui26-css';
        s.textContent='body.camutanga-ui-open #camutanga-mobile-ui{display:none!important} body.camutanga-ui-open #fullscreen-btn{opacity:.18;pointer-events:none} #fullscreen-btn{top:84px!important;width:40px!important;height:40px!important;font-size:20px!important;border-radius:12px!important} @media (pointer:coarse),(max-width:900px){.cl-bag{top:84px!important;right:62px!important;height:40px!important;min-width:72px!important;opacity:.68!important}.cl-actions button,.cl-dpad button{opacity:.66!important}.cl-actions button:active,.cl-dpad button:active,.cl-bag:active{opacity:.96!important;transform:scale(.94)}}';
        document.head.appendChild(s);
    }
    setTimeout(function(){var bag=document.querySelector('.cl-bag');if(bag)bag.textContent='MENU';},20);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectCss);else injectCss();

})();

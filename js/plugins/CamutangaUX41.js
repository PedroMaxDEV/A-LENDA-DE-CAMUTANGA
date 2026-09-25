/*:
 * @plugindesc [v4.1] HUD/UX responsivo para PC e celular. Corrige sobreposicoes, hotbar e central do jogador.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Camutanga UX 4.1
 * - HUD novo e compacto, com auto-fade perto do jogador e durante dialogos.
 * - Hotbar 8x1 no PC e 4x2 no celular para nao bater nos controles touch.
 * - Remove o cartao duplicado de item ativo e a barra de atalhos antiga.
 * - Navegacao da Central do Jogador preparada para todas as abas da V4.
 * - Paginas de pedidos, habilidades, colecao e sistema reorganizadas.
 * - Oficina/cozinha paginadas e maiores no celular.
 * - Controles touch reposicionados, com safe-area, alvos maiores e feedback tatil.
 * - Objetivos e avisos do Recomeço sao reposicionados para nao cobrir o HUD.
 */
(function(){
'use strict';

window.Camutanga = window.Camutanga || {};
var C = window.Camutanga;
var UX = C.UX41 = C.UX41 || {};
UX.VERSION = '4.1.0';
C.version = '4.1.0';

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function pad(n){return Number(n)<10?'0'+Number(n):String(n);}
function isTouch(){return C.touchDevice?C.touchDevice():('ontouchstart' in window || (navigator.maxTouchPoints||0)>0);}
function dirty(b){if(b&&b._setDirty)b._setDirty();}
function rr(ctx,x,y,w,h,r,fill,stroke,lw){
 r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
 if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||1;ctx.stroke();}
}
function styleText(b,size,color,bold){b.fontFace='GameFont';b.fontSize=size||16;b.textColor=color||'#fff';b.outlineColor='rgba(0,0,0,.78)';b.outlineWidth=3;b.fontBold=!!bold;}
function txt(b,t,x,y,w,h,align,size,color,bold){styleText(b,size,color,bold);b.drawText(String(t==null?'':t),x,y,w,h||24,align||'left');}
function icon(b,idx,x,y,size){var set=ImageManager.loadSystem('IconSet');if(!set||!set.isReady||!set.isReady())return false;var pw=Window_Base._iconWidth||32,ph=Window_Base._iconHeight||32,sx=(idx%16)*pw,sy=Math.floor(idx/16)*ph;b.blt(set,sx,sy,pw,ph,x,y,size,size);return true;}
function card(b,x,y,w,h,sel){var c=b._context;c.save();c.shadowColor='rgba(0,0,0,.28)';c.shadowBlur=9;c.shadowOffsetY=2;rr(c,x,y,w,h,14,sel?'rgba(61,83,54,.97)':'rgba(15,24,20,.92)',sel?'rgba(247,214,111,.94)':'rgba(255,255,255,.12)',sel?2:1);c.restore();dirty(b);}
function gauge(b,x,y,w,h,rate,c1,c2){var c=b._context;c.save();rr(c,x,y,w,h,h/2,'rgba(0,0,0,.46)','rgba(255,255,255,.12)',1);var fw=Math.floor((w-4)*clamp(rate||0,0,1));if(fw>1){var g=c.createLinearGradient(x+2,y,x+w-2,y);g.addColorStop(0,c1);g.addColorStop(1,c2);rr(c,x+2,y+2,fw,h-4,(h-4)/2,g,null);}c.restore();dirty(b);}
function pill(b,x,y,w,h,label,active,fontSize){var c=b._context;c.save();rr(c,x,y,w,h,11,active?'rgba(205,158,62,.96)':'rgba(37,49,42,.94)',active?'rgba(255,239,183,.86)':'rgba(255,255,255,.11)',active?2:1);c.restore();dirty(b);txt(b,label,x+5,y+3,w-10,h-6,'center',fontSize||11,active?'#1a1711':'#e5ebe6',active);}
function para(b,text,x,y,w,lineH,maxLines,color,size){var words=String(text||'').replace(/\r/g,'').replace(/\n/g,' \n ').split(/\s+/),lines=[],line='',chars=Math.max(16,Math.floor(w/((size||13)*.56)));for(var i=0;i<words.length;i++){if(words[i]==='\n'){if(line)lines.push(line);line='';continue;}var t=line?line+' '+words[i]:words[i];if(t.length>chars&&line){lines.push(line);line=words[i];}else line=t;}if(line)lines.push(line);if(maxLines)lines=lines.slice(0,maxLines);for(var j=0;j<lines.length;j++)txt(b,lines[j],x,y+j*lineH,w,lineH,'left',size||13,color||'#d7dfda');return lines.length*lineH;}
function life(){return C.state?C.state():{stamina:100,maxStamina:100};}
function clock(){return C.gameClock?C.gameClock():{day:1,hour:6,minute:0};}
function weather(){return C.weatherText?C.weatherText():'Ensolarado';}
function activeItem(){return C.activeItem?C.activeItem():null;}
function v3(){return C.V3&&C.V3.state?C.V3.state():null;}
function item(id){return window.$dataItems&&$dataItems[id];}
function itemCount(it){return window.$gameParty&&it?$gameParty.numItems(it):0;}
function pointIn(r,x,y){return r&&x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h;}
function vibrate(ms){try{if(navigator.vibrate)navigator.vibrate(ms||9);}catch(_){}}

// -------------------------------------------------------------------------
// HUD 4.1 - uma unica camada visual, sem duplicacao de informacao.
// -------------------------------------------------------------------------
function Sprite_CamutangaHUD41(){this.initialize.apply(this,arguments);}
Sprite_CamutangaHUD41.prototype=Object.create(Sprite.prototype);
Sprite_CamutangaHUD41.prototype.constructor=Sprite_CamutangaHUD41;
Sprite_CamutangaHUD41.prototype.initialize=function(){Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._sig='';this._tick=0;this.refresh();};
Sprite_CamutangaHUD41.prototype.update=function(){
 Sprite.prototype.update.call(this);if(!$gameParty||!$gameSystem)return;this._tick++;
 var py=$gamePlayer&&$gamePlayer.screenY?$gamePlayer.screenY():999,busy=$gameMessage&&$gameMessage.isBusy&&$gameMessage.isBusy();
 var target=busy?105:(py<112?180:255);this.opacity+=(target-this.opacity)*.18;
 if(this._tick%5!==0)return;
 var s=life(),a=$gameParty.leader(),t=clock(),cal=C.V3&&C.V3.calendarInfo?C.V3.calendarInfo():null;
 var sig=[Graphics.boxWidth,Graphics.boxHeight,isTouch()?1:0,a?a.name():'',a?a.hp:0,a?a.mhp:0,Math.round(s.stamina||0),s.maxStamina||100,t.day,t.hour,t.minute,weather(),$gameParty.gold(),cal?cal.weekDay:''].join('|');
 if(sig!==this._sig){this._sig=sig;this.refresh();}
};
Sprite_CamutangaHUD41.prototype.refresh=function(){
 var b=this.bitmap,W=Graphics.boxWidth;if(b.width!==W||b.height!==Graphics.boxHeight)this.bitmap=b=new Bitmap(W,Graphics.boxHeight);b.clear();if(!$gameParty)return;
 var a=$gameParty.leader(),s=life(),t=clock(),touch=isTouch(),ctx=b._context,cal=C.V3&&C.V3.calendarInfo?C.V3.calendarInfo():null;
 var leftW=touch?258:318,leftH=touch?58:66,lx=14,ly=12;
 ctx.save();rr(ctx,lx,ly,leftW,leftH,16,'rgba(11,20,16,.91)','rgba(255,255,255,.13)',1);ctx.restore();dirty(b);
 var textX=touch?28:78;
 if(!touch&&C.Hero&&C.Hero.faceBitmap){try{b.blt(C.Hero.faceBitmap(),0,0,128,128,lx+7,ly+7,52,52);}catch(_){}}
 txt(b,a?a.name():'JHON',textX,ly+7,touch?94:116,20,'left',touch?14:16,'#f4dda0',true);
 txt(b,'VIDA',textX,ly+30,42,14,'left',9,'#c6d0c9');gauge(b,textX+43,ly+33,leftW-(textX-lx)-55,8,a&&a.mhp?a.hp/a.mhp:1,'#d34f4c','#ef8b61');
 txt(b,'ENERGIA',textX,ly+46,50,13,'left',9,'#c6d0c9');gauge(b,textX+52,ly+49,leftW-(textX-lx)-64,8,s.maxStamina?s.stamina/s.maxStamina:0,'#58ad5c','#d9c750');

 var cw=touch?172:206,ch=touch?50:58,cx=Math.floor((W-cw)/2);ctx.save();rr(ctx,cx,ly,cw,ch,16,'rgba(11,20,16,.90)','rgba(255,255,255,.12)',1);ctx.restore();dirty(b);
 txt(b,pad(t.hour)+':'+pad(t.minute),cx+9,ly+4,cw-18,26,'center',touch?22:26,'#fff',true);
 txt(b,(cal?cal.weekDay.toUpperCase()+' • ':'')+'DIA '+t.day,cx+8,ly+30,cw-16,16,'center',touch?9:10,'#e9cf76',true);
 if(!touch)txt(b,weather().toUpperCase(),cx+8,ly+43,cw-16,13,'center',9,'#b8c6bd');

 var rw=touch?172:214,rh=touch?50:58,rx=W-rw-14;ctx.save();rr(ctx,rx,ly,rw,rh,16,'rgba(11,20,16,.90)','rgba(255,255,255,.12)',1);ctx.restore();dirty(b);
 txt(b,'CARTEIRA',rx+12,ly+7,rw-24,14,'left',9,'#b9c6be');txt(b,String($gameParty.gold()),rx+11,ly+22,rw-55,25,'left',touch?18:21,'#efd06c',true);txt(b,$dataSystem.currencyUnit||'G',rx+rw-58,ly+25,46,18,'right',10,'#c7d0ca');
 if(touch)txt(b,weather().toUpperCase(),rx+10,ly+39,rw-20,11,'right',8,'#aebbb3');
};

// -------------------------------------------------------------------------
// Hotbar 4.1 - PC 8x1 / celular 4x2. Mantem a mesma hotbar de dados da V3.
// -------------------------------------------------------------------------
function Sprite_CamutangaHotbar41(){this.initialize.apply(this,arguments);}
Sprite_CamutangaHotbar41.prototype=Object.create(Sprite.prototype);
Sprite_CamutangaHotbar41.prototype.constructor=Sprite_CamutangaHotbar41;
Sprite_CamutangaHotbar41.prototype.initialize=function(){Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._rects=[];this._sig='';this._tick=0;this.refresh();};
Sprite_CamutangaHotbar41.prototype.update=function(){
 Sprite.prototype.update.call(this);if(!$gameParty)return;this._tick++;
 var py=$gamePlayer&&$gamePlayer.screenY?$gamePlayer.screenY():0,busy=$gameMessage&&$gameMessage.isBusy&&$gameMessage.isBusy(),target=busy?90:(py>Graphics.boxHeight-115?175:255);this.opacity+=(target-this.opacity)*.18;
 var s=v3();if(!s)return;var parts=[Graphics.boxWidth,Graphics.boxHeight,isTouch()?1:0,s.hotIndex,s.hotbar.join(',')];for(var i=0;i<s.hotbar.length;i++){var it=item(s.hotbar[i]);parts.push(it?itemCount(it):0);}var sig=parts.join('|');if(sig!==this._sig){this._sig=sig;this.refresh();}
};
Sprite_CamutangaHotbar41.prototype.refresh=function(){
 var b=this.bitmap;if(b.width!==Graphics.boxWidth||b.height!==Graphics.boxHeight)this.bitmap=b=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);b.clear();this._rects=[];var s=v3();if(!s)return;
 var touch=isTouch(),slot=touch?46:50,gap=touch?5:6,cols=touch?4:8,rows=touch?2:1,totalW=cols*slot+(cols-1)*gap,totalH=rows*slot+(rows-1)*gap,x=Math.floor((Graphics.boxWidth-totalW)/2),y=Graphics.boxHeight-totalH-(touch?8:10),ctx=b._context;
 ctx.save();rr(ctx,x-8,y-7,totalW+16,totalH+14,15,'rgba(9,16,13,.79)','rgba(255,255,255,.11)',1);ctx.restore();dirty(b);
 var selected=null;
 for(var i=0;i<8;i++){
   var col=i%cols,row=Math.floor(i/cols),xx=x+col*(slot+gap),yy=y+row*(slot+gap),sel=i===s.hotIndex,it=item(s.hotbar[i]);
   ctx.save();rr(ctx,xx,yy,slot,slot,10,sel?'rgba(204,154,59,.96)':'rgba(29,40,34,.94)',sel?'rgba(255,241,187,.95)':'rgba(255,255,255,.12)',sel?2:1);ctx.restore();dirty(b);
   if(it){icon(b,it.iconIndex,xx+7,yy+7,slot-14);var n=itemCount(it);if(n>1)txt(b,n,xx+slot-22,yy+slot-19,18,15,'right',9,'#fff',true);if(sel)selected=it;}
   txt(b,String(i+1),xx+3,yy+1,12,13,'left',8,sel?'#25180d':'#cbd6ce',true);this._rects.push({x:xx,y:yy,w:slot,h:slot,index:i});
 }
 var label=selected?selected.name:'Slot vazio';var lw=Math.min(280,Math.max(116,label.length*9+30)),lx=Math.floor((Graphics.boxWidth-lw)/2),ly=y-28;ctx.save();rr(ctx,lx,ly,lw,22,10,'rgba(10,17,14,.82)','rgba(255,255,255,.08)',1);ctx.restore();dirty(b);txt(b,label,lx+8,ly+2,lw-16,17,'center',10,selected?'#f1dda0':'#9ba79f',true);
};
Sprite_CamutangaHotbar41.prototype.hit=function(x,y){for(var i=0;i<this._rects.length;i++)if(pointIn(this._rects[i],x,y))return this._rects[i].index;return -1;};

var _SM_createAllWindows41=Scene_Map.prototype.createAllWindows;
Scene_Map.prototype.createAllWindows=function(){
 _SM_createAllWindows41.call(this);
 if(this._camutangaHUD26){this._camutangaHUD26.visible=false;this._camutangaHUD26.opacity=0;}
 if(this._camutangaPolishHUD){this._camutangaPolishHUD.visible=false;this._camutangaPolishHUD.opacity=0;}
 if(this._camutangaHUD){this._camutangaHUD.visible=false;this._camutangaHUD.opacity=0;}
 if(this._v3Hotbar){this._v3Hotbar.visible=false;this._v3Hotbar._rects=[];this._v3Hotbar.hit=function(){return -1;};}
 this._camutangaHUD41=new Sprite_CamutangaHUD41();this.addChild(this._camutangaHUD41);
 this._camutangaHotbar41=new Sprite_CamutangaHotbar41();this.addChild(this._camutangaHotbar41);
};

var _SM_update41=Scene_Map.prototype.update;
Scene_Map.prototype.update=function(){
 _SM_update41.call(this);
 if(document&&document.body){var busy=$gameMessage&&$gameMessage.isBusy&&$gameMessage.isBusy();if(UX._dialogueBusy!==!!busy){UX._dialogueBusy=!!busy;document.body.classList.toggle('camutanga-dialogue-busy',UX._dialogueBusy);}}
 if(TouchInput.isTriggered()&&this._camutangaHotbar41&&C.V3&&C.V3.selectHot){var h=this._camutangaHotbar41.hit(TouchInput.x,TouchInput.y);if(h>=0){C.V3.selectHot(h);if($gameTemp)$gameTemp.clearDestination();vibrate(8);}}
};

// -------------------------------------------------------------------------
// Central do jogador: navegacao e paginas responsivas.
// -------------------------------------------------------------------------
if(window.Scene_CamutangaInventory26&&C.UI26){
 var P=Scene_CamutangaInventory26.prototype;
 var _handleTouch41=P.handleTouch,_moveSelection41=P.moveSelection,_changePage41=P.changePage,_updateList41=P.updateListKeyboard;
 var tabLabels={inventory:'MOCHILA',quests:'PEDIDOS',skills:'HABILID.',collections:'COLEÇÃO',craft:'OFICINA',cook:'COZINHA',storage:'BAÚ',journal:'DIÁRIO',city:'CIDADE',system:'AJUSTES'};

 P.drawHeader=function(){
   var b=this._ui.bitmap,W=Graphics.boxWidth,t=clock(),s=life(),a=$gameParty.leader(),touch=isTouch();
   txt(b,'CAMUTANGA',24,10,215,27,'left',24,'#f2dc9f',true);txt(b,'Central do jogador',26,38,220,17,'left',11,'#aebbb2');
   var infoW=touch?500:548,ix=W-infoW-124,ctx=b._context;ctx.save();rr(ctx,ix,12,infoW,46,14,'rgba(13,21,17,.80)','rgba(255,255,255,.10)',1);ctx.restore();dirty(b);
   txt(b,a?a.name():'JHON',ix+12,18,118,19,'left',12,'#f0dda0',true);txt(b,'DIA '+t.day+' • '+pad(t.hour)+':'+pad(t.minute),ix+132,18,150,19,'center',12,'#f4efe0',true);txt(b,weather().toUpperCase(),ix+286,18,104,19,'center',9,'#b9c6be');txt(b,$gameParty.gold()+' '+($dataSystem.currencyUnit||'G'),ix+394,18,infoW-406,19,'right',12,'#efd16f',true);
   gauge(b,ix+12,42,155,7,s.maxStamina?s.stamina/s.maxStamina:0,'#58aa5d','#d7c650');txt(b,'ENERGIA',ix+174,38,62,14,'left',8,'#aebbb2');
   var close={x:W-108,y:12,w:84,h:46};pill(b,close.x,close.y,close.w,close.h,'FECHAR ×',true,10);this._hits.push({kind:'uxClose',rect:close});
 };

 P.drawTabs=function(){
   var b=this._ui.bitmap,W=Graphics.boxWidth,tabs=C.UI26.tabs||[],x=22,y=72,gap=5,total=W-44,tw=Math.floor((total-gap*(tabs.length-1))/Math.max(1,tabs.length));
   for(var i=0;i<tabs.length;i++){var id=tabs[i].id,label=tabLabels[id]||tabs[i].label||id,r={x:x+i*(tw+gap),y:y,w:tw,h:50};pill(b,r.x,r.y,r.w,r.h,label,i===this._tab,tw<105?9:10);this._hits.push({kind:'uxTab',index:i,rect:r});}
 };

 P.drawInventory=function(){
   var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight,touch=isTouch(),filters=C.UI26.filters||[],fx=24,fy=132,fg=6,fw=Math.floor((W-48-fg*(filters.length-1))/filters.length);
   for(var i=0;i<filters.length;i++){var fr={x:fx+i*(fw+fg),y:fy,w:fw,h:34};pill(b,fr.x,fr.y,fr.w,fr.h,filters[i].label,i===this._filter,10);this._hits.push({kind:'filter',index:i,rect:fr});}
   var detailW=touch?356:390,gridX=24,gridY=178,gridW=W-gridX-detailW-36,cols=touch?4:5,gap=9,rows=3,cardH=118,cardW=Math.floor((gridW-gap*(cols-1))/cols),per=cols*rows,pages=Math.max(1,Math.ceil(this._data.length/per));this._page=clamp(this._page,0,pages-1);
   var start=this._page*per,end=Math.min(this._data.length,start+per);
   for(var n=start;n<end;n++){var local=n-start,row=Math.floor(local/cols),col=local%cols,x=gridX+col*(cardW+gap),y=gridY+row*(cardH+gap),r={x:x,y:y,w:cardW,h:cardH},it=this._data[n],sel=n===this._selected;card(b,x,y,cardW,cardH,sel);icon(b,it.iconIndex,x+Math.floor((cardW-44)/2),y+10,44);txt(b,it.name,x+7,y+61,cardW-14,22,'center',11,sel?'#ffe39a':'#f2f2e8',true);txt(b,'x'+itemCount(it),x+7,y+86,cardW-14,17,'center',10,'#b9c6be');if(activeItem()&&activeItem().id===it.id)txt(b,'ATIVO',x+7,y+101,cardW-14,14,'center',8,'#f0cf66',true);this._hits.push({kind:'item',index:n,rect:r});}
   this.drawPageControls(gridX,gridY+rows*(cardH+gap)-1,gridW,pages);
   var dx=W-detailW-24,dh=H-202;card(b,dx,178,detailW,dh,false);var it2=this._data[this._selected];if(!it2){txt(b,'Nenhum item nesta categoria.',dx+18,240,detailW-36,30,'center',15,'#c3cec7');return;}icon(b,it2.iconIndex,dx+18,194,58);txt(b,it2.name,dx+88,193,detailW-106,28,'left',18,'#f2dda1',true);txt(b,'Quantidade: '+itemCount(it2),dx+88,226,detailW-106,18,'left',11,'#b9c6be');txt(b,(C.noteTag&&C.noteTag(it2,'lifeTool')!==null?'FERRAMENTA':'ITEM'),dx+18,264,detailW-36,16,'left',9,'#d1b760',true);para(b,it2.description||'Item de Camutanga.',dx+18,286,detailW-36,20,6,'#d7dfda',13);
   var hint='Selecione para deixar este item pronto para uso.';if(C.noteTag&&C.noteTag(it2,'stamina')!==null)hint='Consumível: recupera energia ao usar.';else if(C.noteTag&&C.noteTag(it2,'cropSeed')!==null)hint='Semente: deixe ativa e use AÇÃO em solo cultivável.';else if(C.noteTag&&C.noteTag(it2,'resource')!==null)hint='Recurso: serve para crafting, serviços e construções.';para(b,hint,dx+18,178+dh-118,detailW-36,18,3,'#aebbb2',11);
   var br={x:dx+18,y:178+dh-64,w:detailW-36,h:48};pill(b,br.x,br.y,br.w,br.h,this.actionLabel(it2),true,11);this._hits.push({kind:'use',rect:br});
 };

 P.drawQuests=function(){
   var b=this._ui.bitmap,W=Graphics.boxWidth;if(!this._data.length){txt(b,'Nenhum pedido hoje.',0,270,W,30,'center',18,'#cad5ce');return;}var cols=2,gap=14,x=28,y=145,w=Math.floor((W-56-gap)/2),h=145;
   for(var i=0;i<this._data.length;i++){var q=this._data[i],row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap);if(yy+h>Graphics.boxHeight-24)break;card(b,xx,yy,w,h,i===this._selected);txt(b,(q.done?'✓ ':'')+q.title,xx+18,yy+13,w-36,26,'left',16,q.done?'#8fd291':'#f1dda2',true);para(b,q.desc,xx+18,yy+43,w-36,19,2,'#d7dfda',12);gauge(b,xx+18,yy+93,w-170,12,q.target?q.current/q.target:0,'#5fa35d','#e2c95c');txt(b,q.current+'/'+q.target,xx+w-142,yy+86,58,22,'right',12,'#fff',true);txt(b,'+'+q.reward+' '+($dataSystem.currencyUnit||'G'),xx+w-80,yy+86,62,22,'right',11,'#efd16f',true);txt(b,q.done?'CONCLUÍDO':'PEDIDO DO DIA',xx+18,yy+118,w-36,17,'left',9,q.done?'#8fd291':'#9faca4',true);this._hits.push({kind:'item',index:i,rect:{x:xx,y:yy,w:w,h:h}});}
 };

 P.drawSkills=function(){
   var b=this._ui.bitmap,W=Graphics.boxWidth,s=life(),cols=4,gap=12,x=24,y=144,w=Math.floor((W-48-gap*(cols-1))/cols),h=224;
   for(var i=0;i<this._data.length;i++){var key=this._data[i],sk=s.skills&&s.skills[key]?s.skills[key]:{level:1,xp:0},row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap),sel=i===this._selected,title=C.skillName?C.skillName(key):key;card(b,xx,yy,w,h,sel);txt(b,String(title).toUpperCase(),xx+14,yy+18,w-28,25,'center',15,'#f1dda2',true);txt(b,'NÍVEL '+sk.level,xx+14,yy+56,w-28,38,'center',25,'#fff',true);var need=80+sk.level*45;gauge(b,xx+24,yy+108,w-48,13,need?sk.xp/need:0,'#5c8ac7','#d9c653');txt(b,sk.xp+' / '+need+' XP',xx+16,yy+128,w-32,18,'center',10,'#c8d3cc');var desc=key==='fishing'?'Peixes melhores, mais controle e raridades.':key==='farming'?'Cultivo, rega e colheitas mais eficientes.':key==='gathering'?'Coleta e exploração de recursos.':key==='woodcutting'?'Mais eficiência ao cortar árvores.':key==='mining'?'Melhor mineração e recursos raros.':key==='cooking'?'Receitas e refeições melhores.':'Produção e construção mais eficientes.';para(b,desc,xx+20,yy+158,w-40,18,3,'#cbd5cf',11);this._hits.push({kind:'item',index:i,rect:{x:xx,y:yy,w:w,h:h}});}
 };

 P.drawCollections=function(){
   var b=this._ui.bitmap,W=Graphics.boxWidth,s=life(),cols=4,gap=11,x=24,y=143,w=Math.floor((W-48-gap*(cols-1))/cols),h=157;
   for(var i=0;i<this._data.length;i++){var it=this._data[i],row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap);if(yy+h>Graphics.boxHeight-18)break;var f=s.collections&&s.collections.fish?s.collections.fish[String(it.id)]:null,sel=i===this._selected;card(b,xx,yy,w,h,sel);if(f)icon(b,it.iconIndex,xx+18,yy+20,48);txt(b,f?it.name:'???',xx+76,yy+17,w-90,24,'left',14,f?'#f1dda2':'#7f8a83',true);if(f){txt(b,'Capturados '+f.count,xx+76,yy+45,w-92,18,'left',10,'#c8d3cc');txt(b,'Recorde '+Number(f.bestWeight||0).toFixed(2)+' kg',xx+18,yy+82,w-36,18,'left',10,'#c8d3cc');txt(b,'★'.repeat(Math.max(0,Number(f.bestQuality||0))),xx+18,yy+109,w-36,22,'left',13,'#efd16f');}else txt(b,'Ainda não descoberto',xx+18,yy+78,w-36,20,'center',10,'#7f8a83');this._hits.push({kind:'item',index:i,rect:{x:xx,y:yy,w:w,h:h}});}
 };

 P.drawSystem=function(){
   var b=this._ui.bitmap,W=Graphics.boxWidth,cols=3,gap=11,x=24,y=143,w=Math.floor((W-48-gap*(cols-1))/cols),h=110;
   for(var i=0;i<this._data.length;i++){var e=this._data[i],row=Math.floor(i/cols),col=i%cols,xx=x+col*(w+gap),yy=y+row*(h+gap);if(yy+h>Graphics.boxHeight-24)break;card(b,xx,yy,w,h,i===this._selected);txt(b,e.name,xx+14,yy+14,w-28,24,'center',14,i===this._selected?'#ffe39a':'#f2dda1',true);para(b,e.desc,xx+18,yy+45,w-36,16,2,'#cbd5cf',10);if(e.cmd==='bgmDown'||e.cmd==='bgmUp')txt(b,'Música '+ConfigManager.bgmVolume+'%',xx+12,yy+82,w-24,16,'center',9,'#efd16f');if(e.cmd==='seDown'||e.cmd==='seUp')txt(b,'Efeitos '+ConfigManager.seVolume+'%',xx+12,yy+82,w-24,16,'center',9,'#efd16f');this._hits.push({kind:'system',index:i,rect:{x:xx,y:yy,w:w,h:h}});}
 };

 // Oficina/cozinha com cards maiores e paginacao.
 P.drawV3Recipes=function(cook){
   var b=this._ui.bitmap,W=Graphics.boxWidth,H=Graphics.boxHeight,data=this._data||[],cols=isTouch()?4:5,rows=3,gap=9,x=24,y=143,w=Math.floor((W-48-gap*(cols-1))/cols),h=142,per=cols*rows,pages=Math.max(1,Math.ceil(data.length/per));this._page=clamp(this._page,0,pages-1);var start=this._page*per,end=Math.min(data.length,start+per),V=C.V3;
   for(var i=start;i<end;i++){var local=i-start,row=Math.floor(local/cols),col=local%cols,xx=x+col*(w+gap),yy=y+row*(h+gap),r=data[i],ok=V.recipeCan(r),out=item(r.out),sel=i===this._selected;card(b,xx,yy,w,h,sel);if(out)icon(b,out.iconIndex,xx+12,yy+12,38);txt(b,r.name,xx+56,yy+10,w-68,20,'left',12,ok?'#f2dda1':'#a2aaa5',true);txt(b,cook?'COZINHA':'OFICINA',xx+56,yy+31,w-68,14,'left',8,'#aebbb2');para(b,V.recipeNeedsText(r),xx+12,yy+57,w-24,15,3,ok?'#90d38c':'#e08b7d',9);txt(b,ok?'TOQUE PARA FAZER':'FALTAM ITENS',xx+10,yy+h-24,w-20,15,'center',8,ok?'#f0d16f':'#a66c63',true);this._hits.push({kind:'v3recipe',index:i,cook:cook,rect:{x:xx,y:yy,w:w,h:h}});}
   this.drawPageControls(x,y+rows*(h+gap)-2,W-48,pages);
 };

 P.changePage=function(d){
   var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;
   if(tab==='craft'||tab==='cook'){var cols=isTouch()?4:5,per=cols*3,pages=Math.max(1,Math.ceil(this._data.length/per)),n=clamp(this._page+d,0,pages-1);if(n!==this._page){this._page=n;this._selected=Math.min(this._data.length-1,n*per);SoundManager.playCursor();this._needsRefresh=true;}return;}
   return _changePage41.call(this,d);
 };
 P.moveSelection=function(d){
   var r=_moveSelection41.call(this,d),tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if((tab==='craft'||tab==='cook')&&this._data.length){var per=(isTouch()?4:5)*3;this._page=Math.floor(this._selected/per);}return r;
 };
 P.updateListKeyboard=function(){var tab=C.UI26.tabs[this._tab]&&C.UI26.tabs[this._tab].id;if(tab==='craft'||tab==='cook'){var cols=isTouch()?4:5;if(Input.isRepeated('left'))this.moveSelection(-1);else if(Input.isRepeated('right'))this.moveSelection(1);else if(Input.isRepeated('up'))this.moveSelection(-cols);else if(Input.isRepeated('down'))this.moveSelection(cols);return;}return _updateList41.call(this);};

 P.handleTouch=function(x,y){
   for(var i=this._hits.length-1;i>=0;i--){var h=this._hits[i];if(!pointIn(h.rect,x,y))continue;if(h.kind==='uxClose'){vibrate(8);SoundManager.playCancel();SceneManager.pop();return;}if(h.kind==='uxTab'){vibrate(7);this._tab=h.index;this._page=0;this._selected=0;SoundManager.playCursor();this._needsRefresh=true;return;}}
   return _handleTouch41.call(this,x,y);
 };
}

// -------------------------------------------------------------------------
// Mobile: ergonomia, safe area, menos sobreposicao e feedback de toque.
// -------------------------------------------------------------------------
UX.injectCss=function(){
 if(document.getElementById('camutanga-ux41-css'))return;
 var st=document.createElement('style');st.id='camutanga-ux41-css';st.textContent=''
 +'#camutanga-mobile-ui button{transition:transform .08s ease,opacity .12s ease,background .12s ease;touch-action:none!important;-webkit-user-select:none!important;user-select:none!important}'
 +'#camutanga-mobile-ui button:active{transform:scale(.91)!important;opacity:1!important}'
 +'body.camutanga-dialogue-busy #cmt-v40-objective{opacity:.10!important;pointer-events:none!important}'
 +'body.camutanga-dialogue-busy .cl-dpad,body.camutanga-dialogue-busy .cl-run,body.camutanga-dialogue-busy .cl-life,body.camutanga-dialogue-busy .cl-item,body.camutanga-dialogue-busy .cl-shield{opacity:.18!important}'
 +'body.camutanga-dialogue-busy .cl-ok{opacity:.92!important}'
 +'#cmt-v40-objective{top:max(92px,calc(env(safe-area-inset-top,0px) + 86px))!important;max-width:330px!important;width:min(330px,34vw)!important}'
 +'#cmt-v40-context{bottom:max(82px,calc(env(safe-area-inset-bottom,0px) + 72px))!important}'
 +'#cmt-v40-location{top:max(82px,calc(env(safe-area-inset-top,0px) + 74px))!important}'
 +'@media (pointer:coarse),(max-width:900px){'
 +'#camutanga-mobile-ui{display:block!important}'
 +'.cl-dpad{left:calc(8px + env(safe-area-inset-left,0px))!important;bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;width:158px!important;height:158px!important;transform:none!important}'
 +'.cl-dpad button{width:56px!important;height:56px!important;border-radius:18px!important;font-size:20px!important;opacity:.63!important;background:rgba(10,18,15,.54)!important}'
 +'.cl-up{left:51px!important;top:0!important}.cl-down{left:51px!important;bottom:0!important}.cl-left{left:0!important;top:51px!important}.cl-right{right:0!important;top:51px!important}'
 +'.cl-actions{right:calc(8px + env(safe-area-inset-right,0px))!important;bottom:calc(8px + env(safe-area-inset-bottom,0px))!important;width:194px!important;height:166px!important;transform:none!important}'
 +'.cl-actions button{opacity:.66!important;border-width:1px!important;box-shadow:0 5px 18px rgba(0,0,0,.25)!important}'
 +'.cl-ok{width:76px!important;height:76px!important;right:0!important;bottom:8px!important;font-size:13px!important;background:rgba(52,121,61,.70)!important;border-color:rgba(199,242,180,.42)!important}'
 +'.cl-life{width:68px!important;height:68px!important;right:78px!important;bottom:80px!important;font-size:10px!important;background:rgba(166,112,46,.72)!important;border-color:rgba(245,209,133,.42)!important}'
 +'.cl-run{width:54px!important;height:54px!important;right:2px!important;top:0!important;font-size:9px!important}'
 +'.cl-item{width:54px!important;height:54px!important;left:8px!important;bottom:11px!important;font-size:9px!important}'
 +'.cl-shield{width:54px!important;height:54px!important;left:58px!important;bottom:0!important;font-size:9px!important}'
 +'.cl-bag{position:fixed!important;top:calc(72px + env(safe-area-inset-top,0px))!important;right:calc(54px + env(safe-area-inset-right,0px))!important;height:38px!important;min-width:70px!important;padding:0 9px!important;border-radius:12px!important;font-size:9px!important;opacity:.78!important;background:rgba(37,78,48,.84)!important;border-color:rgba(235,215,143,.48)!important}'
 +'#camutanga-city-btn{top:calc(72px + env(safe-area-inset-top,0px))!important;right:calc(130px + env(safe-area-inset-right,0px))!important;height:38px!important;min-width:70px!important;font-size:9px!important;opacity:.78!important}'
 +'#fullscreen-btn{top:calc(72px + env(safe-area-inset-top,0px))!important;right:calc(8px + env(safe-area-inset-right,0px))!important;width:38px!important;height:38px!important;border-radius:12px!important;font-size:17px!important;opacity:.74!important}'
 +'#cmt-v40-objective{top:calc(120px + env(safe-area-inset-top,0px))!important;left:calc(7px + env(safe-area-inset-left,0px))!important;width:min(286px,46vw)!important;padding:8px 10px!important;border-radius:12px!important}'
 +'#cmt-v40-objective .tag{font-size:8px!important}#cmt-v40-objective .title{font-size:11px!important;margin:3px 0!important}#cmt-v40-objective .desc{font-size:8px!important;line-height:1.35!important}#cmt-v40-objective .prog{font-size:8px!important;margin-top:5px!important}'
 +'#cmt-v40-context{bottom:calc(124px + env(safe-area-inset-bottom,0px))!important;max-width:52vw!important;font-size:8px!important;padding:6px 10px!important}'
 +'#cmt-v40-location{top:calc(118px + env(safe-area-inset-top,0px))!important;font-size:10px!important;padding:6px 12px!important}'
 +'}'
 +'@media (pointer:coarse) and (max-height:430px){.cl-dpad{transform:scale(.86)!important;transform-origin:left bottom!important}.cl-actions{transform:scale(.86)!important;transform-origin:right bottom!important}#cmt-v40-objective{width:min(245px,42vw)!important}.cl-bag,#camutanga-city-btn,#fullscreen-btn{top:calc(66px + env(safe-area-inset-top,0px))!important}}'
 +'body.camutanga-ui-open #camutanga-mobile-ui,body.camutanga-ui-open #camutanga-city-btn{display:none!important}';
 document.head.appendChild(st);
};

UX.polishMobileControls=function(){
 var root=document.getElementById('camutanga-mobile-ui');if(!root)return;
 var bag=root.querySelector('.cl-bag'),ok=root.querySelector('.cl-ok'),lifeBtn=root.querySelector('.cl-life'),run=root.querySelector('.cl-run'),shield=root.querySelector('.cl-shield'),it=root.querySelector('.cl-item');
 if(bag){bag.textContent='MENU';bag.setAttribute('aria-label','Abrir menu e mochila');}
 if(ok){ok.textContent='INTERAGIR';ok.setAttribute('aria-label','Interagir ou confirmar');}
 if(lifeBtn){lifeBtn.textContent='USAR';lifeBtn.setAttribute('aria-label','Usar ferramenta ou item ativo');}
 if(run){run.textContent='CORRER';run.setAttribute('aria-label','Segure para correr');}
 if(shield){shield.textContent='DEF';shield.setAttribute('aria-label','Defender');}
 if(it){it.textContent='ITEM';it.setAttribute('aria-label','Item de combate');}
 var buttons=root.querySelectorAll('button');for(var i=0;i<buttons.length;i++){if(buttons[i].getAttribute('data-ux41'))continue;buttons[i].setAttribute('data-ux41','1');buttons[i].addEventListener('pointerdown',function(){vibrate(7);},{passive:true});}
};
UX.injectCss();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(UX.polishMobileControls,180);});else setTimeout(UX.polishMobileControls,180);
var _createMobile41=C.createMobileControls;if(_createMobile41)C.createMobileControls=function(){var r=_createMobile41.apply(C,arguments);setTimeout(UX.polishMobileControls,30);return r;};

// Se o objetivo do Recomeço existir no celular, inicia expandido mas permite recolher com toque.
setTimeout(function(){var o=document.getElementById('cmt-v40-objective');if(o&&!o.getAttribute('data-ux41')){o.setAttribute('data-ux41','1');o.title='Toque para recolher/expandir';}},500);

})();

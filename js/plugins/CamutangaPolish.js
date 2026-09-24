/*:
 * @plugindesc [v2.3] Interface visual limpa de Camutanga: HUD moderno, hotbar e acabamento de tela.
 * @author OpenAI + projeto Camutanga
 */
(function(){
'use strict';
window.Camutanga=window.Camutanga||{};
var C=window.Camutanga;

function roundRect(ctx,x,y,w,h,r,fill,stroke){
    r=Math.min(r,w/2,h/2); ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function dirty(b){if(b&&b._setDirty)b._setDirty();}
function textStyle(b,size,color){b.fontFace='GameFont';b.fontSize=size;b.textColor=color||'#ffffff';b.outlineColor='rgba(0,0,0,0.75)';b.outlineWidth=3;}
function gauge(b,x,y,w,h,rate,c1,c2){
    var ctx=b._context;ctx.save();roundRect(ctx,x,y,w,h,h/2,'rgba(0,0,0,0.45)','rgba(255,255,255,0.12)');
    var fw=Math.max(0,Math.floor((w-4)*Math.max(0,Math.min(1,rate))));
    if(fw>1){var g=ctx.createLinearGradient(x+2,y,x+w-2,y);g.addColorStop(0,c1);g.addColorStop(1,c2);roundRect(ctx,x+2,y+2,fw,h-4,(h-4)/2,g,null);}ctx.restore();dirty(b);
}
function card(b,x,y,w,h){var ctx=b._context;ctx.save();ctx.shadowColor='rgba(0,0,0,.40)';ctx.shadowBlur=10;ctx.shadowOffsetY=3;roundRect(ctx,x,y,w,h,12,'rgba(20,25,23,0.84)','rgba(255,255,255,0.16)');ctx.restore();dirty(b);}

function Sprite_CamutangaPolishHUD(){this.initialize.apply(this,arguments);}
Sprite_CamutangaPolishHUD.prototype=Object.create(Sprite.prototype);
Sprite_CamutangaPolishHUD.prototype.constructor=Sprite_CamutangaPolishHUD;
Sprite_CamutangaPolishHUD.prototype.initialize=function(){
    Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._sig='';this._tick=0;this.refresh();
};
Sprite_CamutangaPolishHUD.prototype.update=function(){
    Sprite.prototype.update.call(this); if(!$gameParty||!$gameSystem)return; this._tick++;
    if(this._tick%6!==0)return;
    var s=C.state?C.state():{stamina:0,maxStamina:100};var a=$gameParty.leader();var t=C.gameClock?C.gameClock():{day:1,hour:6,minute:0};var it=C.activeItem?C.activeItem():null;
    var sig=[Graphics.boxWidth,Graphics.boxHeight,s.stamina,s.maxStamina,a?a.hp:0,a?a.mhp:0,t.day,t.hour,t.minute,$gameParty.gold(),it?it.id:0,C.weatherText?C.weatherText():''].join('|');
    if(sig!==this._sig){this._sig=sig;this.refresh();}
};
Sprite_CamutangaPolishHUD.prototype.refresh=function(){
    var b=this.bitmap;if(b.width!==Graphics.boxWidth||b.height!==Graphics.boxHeight)this.bitmap=b=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);b.clear();
    if(!$gameParty)return;
    var s=C.state?C.state():{stamina:0,maxStamina:100};var a=$gameParty.leader();var t=C.gameClock?C.gameClock():{day:1,hour:6,minute:0};var weather=C.weatherText?C.weatherText():'';var it=C.activeItem?C.activeItem():null;
    var pad=function(n){return n<10?'0'+n:String(n);};

    // cartão do personagem
    card(b,16,14,338,92);
    if(C.Hero&&C.Hero.faceBitmap){try{b.blt(C.Hero.faceBitmap(),0,0,128,128,24,20,76,76);}catch(e){}}
    textStyle(b,19,'#f7e7bd');b.drawText(a?a.name():'JHON',108,22,116,24,'left');
    textStyle(b,14,'#d6ded9');b.drawText('VIDA',108,46,46,20,'left');
    gauge(b,154,50,178,13,a&&a.mhp? a.hp/a.mhp:1,'#dc584f','#f18b62');
    textStyle(b,13,'#ffffff');b.drawText(a?(a.hp+'/'+a.mhp):'',250,43,78,20,'right');
    textStyle(b,14,'#d6ded9');b.drawText('ENERGIA',108,70,64,20,'left');
    gauge(b,174,74,158,13,s.maxStamina?s.stamina/s.maxStamina:0,'#67b85e','#d7ca55');
    textStyle(b,13,'#ffffff');b.drawText(Math.round(s.stamina)+'/'+s.maxStamina,250,67,78,20,'right');

    // tempo / dinheiro
    var rw=294,rx=Graphics.boxWidth-rw-16;card(b,rx,14,rw,92);
    textStyle(b,18,'#f7e7bd');b.drawText('Dia '+t.day,rx+18,23,90,24,'left');
    textStyle(b,27,'#ffffff');b.drawText(pad(t.hour)+':'+pad(t.minute),rx+93,17,110,34,'center');
    textStyle(b,14,'#d6ded9');b.drawText(weather,rx+202,25,73,22,'right');
    textStyle(b,14,'#d6ded9');b.drawText('CARTEIRA',rx+18,62,76,22,'left');
    textStyle(b,18,'#f2d26b');b.drawText(String($gameParty.gold())+' '+($dataSystem.currencyUnit||'G'),rx+98,59,177,26,'right');

    // hotbar discreta no PC; celular já tem botões grandes próprios
    var touch=C.touchDevice&&C.touchDevice();
    if(!touch){
        var bw=Math.min(760,Graphics.boxWidth-32),bx=Math.floor((Graphics.boxWidth-bw)/2),by=Graphics.boxHeight-64;card(b,bx,by,bw,50);
        var labels=['Z  Interagir / Atacar','F  Ação de vida','I  Mochila','SHIFT  Correr'];
        textStyle(b,13,'#e8eee9');var cell=Math.floor((bw-170)/labels.length);for(var i=0;i<labels.length;i++)b.drawText(labels[i],bx+14+i*cell,by+13,cell-4,22,'center');
        textStyle(b,13,'#f2d26b');b.drawText(it?it.name:'Sem item',bx+bw-166,by+13,152,22,'right');
    }
};

function Sprite_CamutangaVignette(){this.initialize.apply(this,arguments);}
Sprite_CamutangaVignette.prototype=Object.create(Sprite.prototype);
Sprite_CamutangaVignette.prototype.constructor=Sprite_CamutangaVignette;
Sprite_CamutangaVignette.prototype.initialize=function(){
    Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);var b=this.bitmap,ctx=b._context;
    var cx=b.width/2,cy=b.height/2,r=Math.max(b.width,b.height)*0.72;var g=ctx.createRadialGradient(cx,cy,Math.min(b.width,b.height)*0.34,cx,cy,r);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(0.72,'rgba(0,0,0,0.03)');g.addColorStop(1,'rgba(5,9,7,0.25)');ctx.fillStyle=g;ctx.fillRect(0,0,b.width,b.height);dirty(b);this.opacity=210;
};

var _Scene_Map_createAllWindows=Scene_Map.prototype.createAllWindows;
Scene_Map.prototype.createAllWindows=function(){
    _Scene_Map_createAllWindows.call(this);
    // Esconde o HUD antigo da CamutangaLife. Mantemos o objeto apenas para compatibilidade.
    if(this._camutangaHUD){this._camutangaHUD.hide();this._camutangaHUD.opacity=0;this._camutangaHUD.contentsOpacity=0;}
    this._camutangaPolishHUD=new Sprite_CamutangaPolishHUD();
    this.addChild(this._camutangaPolishHUD);
};

var _Scene_Map_createDisplayObjects=Scene_Map.prototype.createDisplayObjects;
Scene_Map.prototype.createDisplayObjects=function(){
    _Scene_Map_createDisplayObjects.call(this);
    this._camutangaVignette=new Sprite_CamutangaVignette();
    var idx=this._windowLayer?this.getChildIndex(this._windowLayer):this.children.length;
    this.addChildAt(this._camutangaVignette,Math.max(0,idx));
};

// Menu de vida com visual mais leve: transparência e margens menores.
var _Scene_CamutangaMenu=window.Scene_CamutangaMenu;
if(_Scene_CamutangaMenu){
    var _SCM_create=_Scene_CamutangaMenu.prototype.create;
    _Scene_CamutangaMenu.prototype.create=function(){
        _SCM_create.call(this);
        var arr=[this._tabs,this._list,this._detail];
        for(var i=0;i<arr.length;i++)if(arr[i]){arr[i].opacity=218;arr[i].backOpacity=210;}
    };
}

window.Sprite_CamutangaPolishHUD=Sprite_CamutangaPolishHUD;
})();

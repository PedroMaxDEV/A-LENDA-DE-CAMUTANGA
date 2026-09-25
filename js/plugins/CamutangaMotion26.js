/*:
 * @plugindesc [v2.6] Movimento fluido do herói de Camutanga: caminhada, corrida e ferramentas mais naturais.
 * @author OpenAI + projeto Camutanga
 * @help
 * Complementa CamutangaHero. Não exige sprites externos.
 */
(function(){
'use strict';
window.Camutanga=window.Camutanga||{};
var C=window.Camutanga,H=C.Hero;if(!H)return;
H.MOTION_VERSION='2.6.0';

function rect(b,x,y,w,h,c){b.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h),c);}
function line(b,x1,y1,x2,y2,c,w){var ctx=b._context;if(!ctx)return;ctx.save();ctx.imageSmoothingEnabled=false;ctx.strokeStyle=c;ctx.lineWidth=w||2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(Math.round(x1)+.5,Math.round(y1)+.5);ctx.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);ctx.stroke();ctx.restore();if(b._setDirty)b._setDirty();}
function crisp(b){if(b&&b._baseTexture&&window.PIXI&&PIXI.SCALE_MODES)b._baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;return b;}
function phase(frame,count){return (frame%count)/count*Math.PI*2;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

// Guarda o tempo total da pose para que golpes tenham começo, impacto e retorno.
H.pose=function(name,duration){
    if(!$gamePlayer)return;duration=Math.max(1,Number(duration||30));$gamePlayer._camutangaHeroPose=String(name||'idle');$gamePlayer._camutangaHeroPoseTimer=duration;$gamePlayer._camutangaHeroPoseTotal=duration;
};
C.setHeroPose=H.pose;

H.frameIndex=function(ch,pose){
    if(pose==='walk')return Math.floor(Graphics.frameCount/4)%8;
    if(pose==='run')return Math.floor(Graphics.frameCount/3)%8;
    if(pose==='idle')return Math.floor(Graphics.frameCount/18)%4;
    if(ch&&ch._camutangaHeroPoseTotal>0&&ch._camutangaHeroPoseTimer>=0){
        var total=ch._camutangaHeroPoseTotal,done=total-ch._camutangaHeroPoseTimer;return Math.floor(clamp(done/Math.max(1,total),0,.999)*6);
    }
    return Math.floor(Graphics.frameCount/5)%6;
};
H.frameBitmap=function(pose,direction,frame){
    pose=pose||'idle';direction=[2,4,6,8].indexOf(direction)>=0?direction:2;var count=(pose==='walk'||pose==='run')?8:(pose==='idle'?4:6);frame=Math.abs(frame||0)%count;var key='m26:'+pose+':'+direction+':'+frame;
    if(H._cache[key])return H._cache[key];var b=crisp(new Bitmap(H.W,H.H));H.drawFrame(b,pose,direction,frame);H._cache[key]=b;return b;
};

H.drawFrame=function(b,pose,d,f){
    var p=H.palette,side=d===4?-1:d===6?1:0,back=d===8;
    var moving=pose==='walk'||pose==='run',count=moving?8:(pose==='idle'?4:6),ang=phase(f,count),run=pose==='run';
    var stride=moving?Math.sin(ang)*(run?4:3):0,bob=moving?Math.round((1-Math.cos(ang*2))*(run?1.5:1)):((pose==='idle'&&f===2)?1:0);
    var lean=run?side*1:0,arm=Math.round(-stride*.8),headBob=bob;
    var leftLeg=Math.round(stride),rightLeg=-leftLeg;

    // sombra muda de largura ao correr, dando sensação de peso/contato.
    var shadowW=run?(f%2?24:29):26;rect(b,24-shadowW/2,61,shadowW,4,p.shadow);rect(b,16,64,16,2,'rgba(18,12,8,.13)');

    // pernas em oito fases; uma perna encurta quando cruza por trás.
    var lLift=moving&&Math.sin(ang)>0?Math.round(Math.abs(Math.sin(ang))*3):0;
    var rLift=moving&&Math.sin(ang)<0?Math.round(Math.abs(Math.sin(ang))*3):0;
    var lx=16+Math.round(leftLeg*.45),rx=25+Math.round(rightLeg*.45);
    rect(b,lx,45+bob-lLift,7,14-lLift,p.outline);rect(b,lx+1,45+bob-lLift,5,12-lLift,p.jeansDark);
    rect(b,rx,45+bob-rLift,7,14-rLift,p.outline);rect(b,rx+1,45+bob-rLift,5,12-rLift,p.jeans);
    rect(b,lx-2+(leftLeg>0?2:0),57+bob-lLift,10,5,p.boot);rect(b,rx+(rightLeg<0?-2:0),57+bob-rLift,10,5,p.boot);

    // corpo inclina levemente para frente na corrida e respira parado.
    var bx=13+lean,by=27+bob;rect(b,bx,by,22,20,p.outline);rect(b,bx+2,by+1,18,17,p.shirt);rect(b,bx+2,by+14,18,4,p.shirtShade);rect(b,bx+2,by,18,5,p.scarf);rect(b,bx+8,by+15,6,3,p.leather);rect(b,bx+10,by+15,2,3,p.hatLight);

    // cabeça/chapéu acompanha o passo, mas com atraso menor para não parecer bloco duro.
    var hx=15+lean,hy=11+headBob;rect(b,hx,hy,18,18,p.outline);rect(b,hx+2,hy+2,14,15,back?p.hair:p.skin);rect(b,hx+2,hy+1,14,4,p.hair);
    if(!back){if(side===0){rect(b,hx+4,hy+9,2,2,p.hair);rect(b,hx+12,hy+9,2,2,p.hair);rect(b,hx+7,hy+14,5,2,p.skinDark);}else if(side<0){rect(b,hx+3,hy+9,2,2,p.hair);rect(b,hx+5,hy+12,2,2,p.skinLight);}else{rect(b,hx+13,hy+9,2,2,p.hair);rect(b,hx+11,hy+12,2,2,p.skinLight);}}
    var hatY=8+headBob;rect(b,11+lean,hatY,26,5,p.hatDark);rect(b,14+lean,4+headBob,20,7,p.hat);rect(b,17+lean,4+headBob,14,2,p.hatLight);rect(b,10+lean,10+headBob,6,3,p.hatLight);rect(b,32+lean,10+headBob,6,3,p.hatLight);rect(b,17+lean,7+headBob,3,2,p.hatDark);rect(b,28+lean,7+headBob,3,2,p.hatDark);

    var action=['fish','hoe','water','gather','attack','axe','pickaxe'].indexOf(pose)>=0;
    if(!action){
        var la=arm,ra=-arm;if(side!==0){la=Math.round(la*.65);ra=Math.round(ra*.65);}
        rect(b,9+lean,29+bob+Math.max(0,la*.3),6,16,p.outline);rect(b,11+lean,30+bob+Math.max(0,la*.3),4,14,p.skin);
        rect(b,33+lean,29+bob+Math.max(0,ra*.3),6,16,p.outline);rect(b,33+lean,30+bob+Math.max(0,ra*.3),4,14,p.skin);
    }else{
        var actionT=f/5,reach=Math.sin(actionT*Math.PI);
        if(pose==='gather'){
            var crouch=Math.round(reach*6);rect(b,9,34+bob+crouch,7,15-crouch/2,p.outline);rect(b,11,35+bob+crouch,4,12,p.skin);rect(b,32,34+bob+crouch,7,15-crouch/2,p.outline);rect(b,33,35+bob+crouch,4,12,p.skin);
        }else if(pose==='water'){
            var wy=Math.round(reach*4);rect(b,10,31+bob+wy,6,14,p.outline);rect(b,12,32+bob+wy,4,12,p.skin);rect(b,33,31+bob+wy,6,14,p.outline);rect(b,33,32+bob+wy,4,12,p.skin);
            if(f>=2){var wx=side<0?5:39;for(var wi=0;wi<4;wi++)rect(b,wx+(side<0?-wi*2:wi*2),48+wi,2,3,p.water);}
        }else if(pose==='fish'){
            var pull=f>=3?Math.round((f-2)*2):0;rect(b,10,30+bob,6,15,p.outline);rect(b,12,31+bob,4,13,p.skin);rect(b,33,30+bob,6,15,p.outline);rect(b,33,31+bob,4,13,p.skin);
            var sx=side<0?12:36,ex=side<0?2:46;if(side===0){sx=35;ex=46;}line(b,sx,35+bob,ex,14-pull,p.leather,2);line(b,ex,14-pull,ex+(side<0?-4:4),58,p.line,1);rect(b,ex+(side<0?-6:4),57,3,3,p.water);
        }else{
            // mãos acompanham o arco da ferramenta; a ferramenta real é o overlay de item.
            var swing=Math.sin(actionT*Math.PI),handY=Math.round(33-14*(1-actionT)+20*Math.max(0,actionT-.55));var handX=24+(side||1)*Math.round(10*swing);
            rect(b,10,30+bob,6,15,p.outline);line(b,13,34+bob,handX,handY,p.skin,4);rect(b,33,30+bob,6,15,p.outline);line(b,36,34+bob,handX+(side<0?3:-3),handY+2,p.skin,4);
        }
    }
};

// Movimento do item/ferramenta acompanha o arco real da ação em vez de balançar
// com um seno constante, que deixava o boneco robótico.
var _oldUpdateHeld=H.updateHeldOnCharacterSprite;
H.updateHeldOnCharacterSprite=function(sprite,pose,dir){
    _oldUpdateHeld.call(H,sprite,pose,dir);var sp=sprite._camutangaHeldSprite;if(!sp||!sp.visible)return;
    var side=dir===4?-1:dir===6?1:1,total=$gamePlayer._camutangaHeroPoseTotal||1,rem=$gamePlayer._camutangaHeroPoseTimer||0,t=clamp((total-rem)/total,0,1);
    if(pose==='axe'||pose==='pickaxe'||pose==='hoe'||pose==='attack'){
        var a=(-1.05+2.15*t)*side;sp.rotation=a;sp.x=side*(11+Math.sin(t*Math.PI)*17);sp.y=-43+Math.sin(t*Math.PI)*19;sp.scale.x=sp.scale.y=.78;
    }else if(pose==='fish'){
        sp.x=side*24;sp.y=-38-(t<.35?Math.sin((t/.35)*Math.PI)*7:0);sp.rotation=side*(.45+(t<.35?-.75*Math.sin((t/.35)*Math.PI):0));sp.scale.x=sp.scale.y=.72;
    }else if(pose==='water'){
        sp.x=side*23;sp.y=-28;sp.rotation=side*(.35+.45*Math.sin(t*Math.PI));sp.scale.x=sp.scale.y=.74;
    }else if(pose==='gather'){
        sp.y=-24;sp.scale.x=sp.scale.y=.70;
    }
};

})();

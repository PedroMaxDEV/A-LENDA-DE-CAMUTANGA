/*:
 * @plugindesc [v2.4] Herói de Camutanga renderizado por JavaScript. Compatível com MOG/Chrono sem depender do charset original.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * O herói é uma camada própria sobre o personagem do RPG Maker.
 * Isso evita conflitos com MOG_CharPoses, Chrono Engine e charsets antigos.
 *
 * API:
 *   Camutanga.setHeroPose('fish', 90);
 * Poses: idle, walk, run, fish, hoe, water, gather, attack, axe, pickaxe.
 */
(function() {
    'use strict';

    window.Camutanga = window.Camutanga || {};
    var C = window.Camutanga;
    var H = C.Hero = C.Hero || {};

    H.VERSION = '2.4.0';
    H.W = 48;
    H.H = 68;
    H._cache = {};
    H._face = null;

    H.palette = {
        outline:'#20150f', shadow:'rgba(18,12,8,0.26)',
        skin:'#a9633d', skinLight:'#d28a5d', skinDark:'#6f3d2a',
        hair:'#25170f', hat:'#9a5c2e', hatLight:'#d49349', hatDark:'#56321e',
        shirt:'#f1e2bd', shirtShade:'#c9b388', scarf:'#c7483f',
        jeans:'#3b6477', jeansLight:'#557f90', jeansDark:'#263f4b',
        boot:'#4a2b1b', leather:'#704322', metal:'#b8c1c4', water:'#71c9e6', line:'#eee5c8'
    };

    H.pose = function(name, duration) {
        if (!$gamePlayer) return;
        $gamePlayer._camutangaHeroPose = String(name || 'idle');
        $gamePlayer._camutangaHeroPoseTimer = Math.max(1, Number(duration || 30));
    };
    C.setHeroPose = H.pose;

    // Mostra por alguns instantes o item recém-coletado na mão do herói.
    // Se o item tiver <heldPicture:nome_do_arquivo> nas Notas, o plugin tenta usar
    // img/pictures/CamutangaItems/nome_do_arquivo.png. Sem a tag, usa o IconSet.
    H.holdItem = function(itemId, duration) {
        if (!$gamePlayer) return;
        $gamePlayer._camutangaHeldItemId = Number(itemId || 0);
        $gamePlayer._camutangaHeldItemTimer = Math.max(1, Number(duration || 90));
    };
    C.showHeldItem = H.holdItem;

    H.currentPose = function(ch) {
        if (!ch) return 'idle';
        if (ch._camutangaHeroPoseTimer > 0 && ch._camutangaHeroPose) return ch._camutangaHeroPose;
        if (ch.isMoving && ch.isMoving()) return ch.isDashing && ch.isDashing() ? 'run' : 'walk';
        return 'idle';
    };

    var _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        if (this._camutangaHeroPoseTimer > 0) {
            this._camutangaHeroPoseTimer--;
            if (this._camutangaHeroPoseTimer <= 0) this._camutangaHeroPose = null;
        }
        if (this._camutangaHeldItemTimer > 0) {
            this._camutangaHeldItemTimer--;
            if (this._camutangaHeldItemTimer <= 0) this._camutangaHeldItemId = 0;
        }
    };

    function rect(b,x,y,w,h,c){ b.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h),c); }
    function line(b,x1,y1,x2,y2,c,w){
        var ctx=b._context; if(!ctx)return;
        ctx.save(); ctx.imageSmoothingEnabled=false; ctx.strokeStyle=c; ctx.lineWidth=w||2;
        ctx.beginPath(); ctx.moveTo(Math.round(x1)+0.5,Math.round(y1)+0.5); ctx.lineTo(Math.round(x2)+0.5,Math.round(y2)+0.5); ctx.stroke(); ctx.restore();
        if(b._setDirty)b._setDirty();
    }
    function crisp(b){ if(b&&b._baseTexture&&window.PIXI&&PIXI.SCALE_MODES)b._baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST; return b; }

    H.frameIndex = function(ch, pose) {
        if (pose === 'idle') return Math.floor(Graphics.frameCount / 32) % 2;
        if (pose === 'run') return Math.floor(Graphics.frameCount / 5) % 3;
        if (pose === 'walk') return Math.floor(Graphics.frameCount / 9) % 3;
        return Math.floor(Graphics.frameCount / 8) % 3;
    };

    H.frameBitmap = function(pose, direction, frame) {
        pose=pose||'idle'; direction=[2,4,6,8].indexOf(direction)>=0?direction:2; frame=Math.abs(frame||0)%3;
        var key=pose+':'+direction+':'+frame;
        if(H._cache[key]) return H._cache[key];
        var b=crisp(new Bitmap(H.W,H.H));
        H.drawFrame(b,pose,direction,frame);
        H._cache[key]=b; return b;
    };

    H.drawFrame = function(b,pose,d,f) {
        var p=H.palette, side=d===4?-1:d===6?1:0, back=d===8;
        var step=(f===0?-1:f===2?1:0);
        var bob=(pose==='walk'||pose==='run') && f!==1 ? 1 : 0;
        var run=pose==='run'?2:1;

        // sombra de contato
        rect(b,11,61,26,4,p.shadow); rect(b,15,64,18,2,'rgba(18,12,8,0.14)');

        // pernas - ocupam mais tela para o herói não parecer minúsculo
        var ls=(pose==='walk'||pose==='run')?step*run:0;
        rect(b,16+Math.max(0,ls),45+bob,7,14,p.outline);
        rect(b,17+Math.max(0,ls),45+bob,5,12,p.jeansDark);
        rect(b,25+Math.min(0,ls),45+bob,7,14,p.outline);
        rect(b,26+Math.min(0,ls),45+bob,5,12,p.jeans);
        rect(b,14+Math.max(0,ls),57+bob,9,5,p.boot);
        rect(b,25+Math.min(0,ls),57+bob,9,5,p.boot);

        // tronco / cinto / lenço
        rect(b,13,27+bob,22,20,p.outline);
        rect(b,15,28+bob,18,17,p.shirt);
        rect(b,15,41+bob,18,4,p.shirtShade);
        rect(b,15,27+bob,18,5,p.scarf);
        rect(b,21,42+bob,6,3,p.leather);
        rect(b,23,42+bob,2,3,p.hatLight);

        // cabeça
        rect(b,15,11+bob,18,18,p.outline);
        rect(b,17,13+bob,14,15,back?p.hair:p.skin);
        rect(b,17,12+bob,14,4,p.hair);
        if(!back){
            if(side===0){ rect(b,19,20+bob,2,2,p.hair); rect(b,27,20+bob,2,2,p.hair); rect(b,22,25+bob,5,2,p.skinDark); }
            if(side<0){ rect(b,18,20+bob,2,2,p.hair); rect(b,20,23+bob,2,2,p.skinLight); }
            if(side>0){ rect(b,28,20+bob,2,2,p.hair); rect(b,26,23+bob,2,2,p.skinLight); }
        }

        // chapéu de couro estilizado
        rect(b,11,8+bob,26,5,p.hatDark);
        rect(b,14,4+bob,20,7,p.hat);
        rect(b,17,4+bob,14,2,p.hatLight);
        rect(b,10,10+bob,6,3,p.hatLight); rect(b,32,10+bob,6,3,p.hatLight);
        rect(b,17,7+bob,3,2,p.hatDark); rect(b,28,7+bob,3,2,p.hatDark);

        // braços padrão
        if(['fish','hoe','water','gather','attack','axe','pickaxe'].indexOf(pose)<0){
            var arm=(pose==='walk'||pose==='run')?-step*run:0;
            rect(b,9,29+bob+Math.max(0,arm),6,16,p.outline); rect(b,11,30+bob+Math.max(0,arm),4,14,p.skin);
            rect(b,33,29+bob+Math.max(0,-arm),6,16,p.outline); rect(b,33,30+bob+Math.max(0,-arm),4,14,p.skin);
        }

        if(pose==='fish'){
            var sx=side<0?12:36, ex=side<0?3:45; if(side===0){sx=35;ex=45;}
            rect(b,10,30+bob,6,15,p.outline); rect(b,12,31+bob,4,13,p.skin);
            rect(b,33,30+bob,6,15,p.outline); rect(b,33,31+bob,4,13,p.skin);
            var cast=f===0?-5:f===2?4:0;
            line(b,sx,35+bob,ex,12+cast+bob,p.leather,3);
            line(b,ex,12+cast+bob,ex+(side<0?-5:5),58,p.line,1);
            rect(b,ex+(side<0?-7:5),57,3,3,p.water);
        } else if(pose==='hoe' || pose==='axe' || pose==='pickaxe' || pose==='attack'){
            rect(b,10,30+bob,6,15,p.outline); rect(b,12,31+bob,4,13,p.skin);
            rect(b,33,30+bob,6,15,p.outline); rect(b,33,31+bob,4,13,p.skin);
            var tx=side<0?5:43, ty=(f===0?17:f===1?29:48);
            line(b,24,34+bob,tx,ty,p.leather,3);
            if(pose==='hoe') rect(b,tx-5,ty-2,11,4,p.metal);
            else if(pose==='axe') { rect(b,tx-3,ty-5,7,9,p.metal); rect(b,tx+(side<0?-5:3),ty-3,4,6,p.metal); }
            else if(pose==='pickaxe') { rect(b,tx-7,ty-2,15,4,p.metal); }
            else rect(b,tx-2,ty-7,5,12,p.metal);
        } else if(pose==='water'){
            rect(b,10,31+bob,6,14,p.outline); rect(b,12,32+bob,4,12,p.skin);
            rect(b,33,31+bob,6,14,p.outline); rect(b,33,32+bob,4,12,p.skin);
            var wx=side<0?4:35;
            rect(b,wx,39+bob,10,9,'#648b95'); rect(b,wx+(side<0?-7:9),41+bob,8,4,'#648b95');
            for(var i=0;i<4;i++) rect(b,wx+(side<0?-8-i*2:17+i*2),47+bob+i,2,3,p.water);
        } else if(pose==='gather'){
            rect(b,9,36+bob,7,16,p.outline); rect(b,11,37+bob,4,14,p.skin);
            rect(b,32,36+bob,7,16,p.outline); rect(b,33,37+bob,4,14,p.skin);
        }
    };

    H.faceBitmap = function(){
        if(H._face)return H._face;
        var b=crisp(new Bitmap(128,128)),p=H.palette;
        // busto simples e consistente com o sprite
        rect(b,12,96,104,24,'rgba(0,0,0,0.18)');
        rect(b,22,75,84,45,p.outline); rect(b,28,78,72,39,p.shirt); rect(b,28,78,72,12,p.scarf);
        rect(b,35,28,58,55,p.outline); rect(b,40,34,48,45,p.skin); rect(b,40,31,48,13,p.hair);
        rect(b,48,54,6,6,p.hair); rect(b,75,54,6,6,p.hair); rect(b,56,70,20,5,p.skinDark);
        rect(b,25,20,78,16,p.hatDark); rect(b,34,7,60,20,p.hat); rect(b,44,8,40,7,p.hatLight);
        rect(b,23,28,18,9,p.hatLight); rect(b,87,28,18,9,p.hatLight);
        H._face=b; return b;
    };

    // ---------------------------------------------------------------------
    // v2.5: o herói agora usa o PRÓPRIO Sprite_Character do jogador.
    // Isso evita o bug em que uma camada JS separada ficava atrás do tilemap
    // ou era escondida por MOG_CharPoses / Chrono Engine.
    // ---------------------------------------------------------------------
    H.actionItemId = function(pose) {
        if (pose === 'fish') return 41;
        if (pose === 'hoe') return 43;
        if (pose === 'water') return 44;
        if (pose === 'axe') return 57;
        if (pose === 'pickaxe') return 58;
        return 0;
    };

    H.ensureHeldSprite = function(sprite) {
        if (sprite._camutangaHeldSprite) return sprite._camutangaHeldSprite;
        var sp = new Sprite();
        sp.anchor.x = 0.5; sp.anchor.y = 0.5;
        sp.visible = false;
        sp.z = 99;
        sprite.addChild(sp);
        sprite._camutangaHeldSprite = sp;
        sprite._camutangaHeldPictureName = '';
        sprite._camutangaHeldItemId = 0;
        return sp;
    };

    H.applyHeldBitmap = function(owner, sp, item) {
        if (!item) { sp.visible = false; return; }
        var pictureTag = C.noteTag ? C.noteTag(item, 'heldPicture') : null;
        if (pictureTag && pictureTag !== true) {
            var name = String(pictureTag).trim();
            if (owner._camutangaHeldPictureName !== name || owner._camutangaHeldItemId !== item.id) {
                owner._camutangaHeldPictureName = name;
                owner._camutangaHeldItemId = item.id;
                sp.bitmap = ImageManager.loadBitmap('img/pictures/CamutangaItems/', name, 0, true);
                sp.setFrame(0,0,0,0);
                sp.scale.x = 0.70; sp.scale.y = 0.70;
            }
            if (sp.bitmap && sp.bitmap.isReady && sp.bitmap.isReady()) {
                sp.setFrame(0,0,sp.bitmap.width,sp.bitmap.height);
            }
        } else {
            owner._camutangaHeldPictureName = '';
            if (owner._camutangaHeldItemId !== item.id || !sp.bitmap) {
                owner._camutangaHeldItemId = item.id;
                sp.bitmap = ImageManager.loadSystem('IconSet');
            }
            var pw=Window_Base._iconWidth||32, ph=Window_Base._iconHeight||32;
            var sx=item.iconIndex%16*pw, sy=Math.floor(item.iconIndex/16)*ph;
            sp.setFrame(sx,sy,pw,ph);
            sp.scale.x=0.72; sp.scale.y=0.72;
        }
    };

    H.updateHeldOnCharacterSprite = function(sprite, pose, dir) {
        var sp=H.ensureHeldSprite(sprite);
        if (!$gamePlayer || !$dataItems) { sp.visible=false; return; }
        var id=H.actionItemId(pose);
        if (!id && Number($gamePlayer._camutangaHeldItemTimer||0)>0) id=Number($gamePlayer._camutangaHeldItemId||0);
        if (!id || !$dataItems[id]) { sp.visible=false; return; }
        H.applyHeldBitmap(sprite,sp,$dataItems[id]);

        // Ferramenta na mão acompanha a direção e a fase da animação.
        var swing=(pose==='axe'||pose==='pickaxe'||pose==='hoe') ? (Math.sin(Graphics.frameCount/4)*0.42) : 0;
        if(dir===4){sp.x=-22;sp.y=-34;sp.rotation=-0.35-swing;}
        else if(dir===6){sp.x=22;sp.y=-34;sp.rotation=0.35+swing;}
        else if(dir===8){sp.x=15;sp.y=-44;sp.rotation=-0.15+swing;}
        else{sp.x=19;sp.y=-31;sp.rotation=0.12+swing;}
        if(pose==='fish'){sp.x=dir===4?-25:25;sp.y=-37;sp.rotation=dir===4?-0.65:0.65;}
        if(pose==='water'){sp.y=-27;sp.rotation=dir===4?-0.5:0.5;}
        sp.visible=true;
    };

    var _Sprite_Character_update = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        _Sprite_Character_update.call(this);
        if (this._character !== $gamePlayer) return;

        var pose=H.currentPose($gamePlayer);
        var dir=$gamePlayer.direction ? $gamePlayer.direction() : 2;
        var fr=H.frameIndex($gamePlayer,pose);
        var bm=H.frameBitmap(pose,dir,fr);

        // Sobrescreve no fim do update, depois de todos os plugins antigos.
        // Assim MOG_CharPoses pode trocar o charset que quiser: o quadro final
        // do jogador continuará sendo o herói de Camutanga.
        this.bitmap=bm;
        this.setFrame(0,0,H.W,H.H);
        this.anchor.x=0.5; this.anchor.y=1;
        this.visible=true;
        this.opacity=255;
        this.blendMode=0;
        this.scale.x=1; this.scale.y=1;
        this._camutangaJsHeroReady=true;
        H.updateHeldOnCharacterSprite(this,pose,dir);
    };

    // Também neutraliza transparência apenas no sprite visual. A lógica de
    // colisão e eventos do Game_Player permanece intacta.
    var _Sprite_Character_updateVisibility = Sprite_Character.prototype.updateVisibility;
    Sprite_Character.prototype.updateVisibility = function() {
        _Sprite_Character_updateVisibility.call(this);
        if (this._character === $gamePlayer) this.visible = true;
    };

    // Helper de diagnóstico para o menu DEV.
    H.debugInfo = function() {
        var scene=SceneManager._scene,ss=scene&&scene._spriteset,arr=ss&&ss._characterSprites||[];
        for(var i=0;i<arr.length;i++)if(arr[i]._character===$gamePlayer){
            return {found:true,visible:arr[i].visible,opacity:arr[i].opacity,x:arr[i].x,y:arr[i].y,ready:!!arr[i]._camutangaJsHeroReady};
        }
        return {found:false};
    };

    H.VERSION='2.5.0';
})();

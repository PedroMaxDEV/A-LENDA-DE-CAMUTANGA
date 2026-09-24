/*:
 * @plugindesc [v2.2] Personagem principal em pixel art gerado por JavaScript, com poses de caminhada, corrida, pesca, enxada, rega e coleta.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Este plugin não precisa de sprites PNG para o herói principal.
 * O personagem é desenhado em tempo real usando Bitmap/Canvas do RPG Maker MV.
 *
 * API opcional:
 *   Camutanga.setHeroPose('fish', 60);
 * Poses: idle, walk, run, fish, hoe, water, gather, attack.
 */
(function() {
    'use strict';

    window.Camutanga = window.Camutanga || {};
    var C = window.Camutanga;
    var H = C.Hero = C.Hero || {};

    H.VERSION = '2.2.0';
    H.W = 48;
    H.H = 64;
    H.S = 2;
    H._cache = {};
    H._face = null;

    H.palette = {
        outline: '#24180f',
        skin: '#9b5d36',
        skinLight: '#bd7a4e',
        skinDark: '#6e3d25',
        hair: '#21160f',
        hat: '#8a5429',
        hatLight: '#bd7b3b',
        hatDark: '#5a351e',
        shirt: '#eee1c2',
        shirtShade: '#c8b58e',
        scarf: '#b83a32',
        jeans: '#365f78',
        jeansDark: '#243e52',
        boot: '#4d2d1c',
        metal: '#aab5b9',
        wood: '#6c4022',
        water: '#70c7e6',
        line: '#e8e1c4'
    };

    H.pose = function(name, duration) {
        if (!$gamePlayer) return;
        $gamePlayer._camutangaHeroPose = String(name || 'idle');
        $gamePlayer._camutangaHeroPoseTimer = Math.max(1, Number(duration || 30));
    };
    C.setHeroPose = H.pose;

    H.currentPose = function(character) {
        if (!character) return 'idle';
        if (character._camutangaHeroPoseTimer > 0 && character._camutangaHeroPose) return character._camutangaHeroPose;
        if (character.isMoving && character.isMoving()) {
            return character.isDashing && character.isDashing() ? 'run' : 'walk';
        }
        return 'idle';
    };

    var _Game_Player_update = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _Game_Player_update.call(this, sceneActive);
        if (this._camutangaHeroPoseTimer > 0) {
            this._camutangaHeroPoseTimer--;
            if (this._camutangaHeroPoseTimer <= 0) this._camutangaHeroPose = null;
        }
        if (SceneManager._scene instanceof Scene_Map && Input.isTriggered('ok') && !this.isMoving()) {
            // Uma batida curta deixa interações/ataques mais vivos sem alterar a lógica do Chrono Engine.
            if (!$gameMap.isEventRunning()) H.pose('attack', 12);
        }
    };

    function px(b, x, y, w, h, color) {
        b.fillRect(Math.round(x * H.S), Math.round(y * H.S), Math.max(1, Math.round(w * H.S)), Math.max(1, Math.round(h * H.S)), color);
    }

    function line(b, x1, y1, x2, y2, color, width) {
        var ctx = b._context;
        if (!ctx) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, width || 2);
        ctx.imageSmoothingEnabled = false;
        ctx.beginPath();
        ctx.moveTo(x1 * H.S, y1 * H.S);
        ctx.lineTo(x2 * H.S, y2 * H.S);
        ctx.stroke();
        ctx.restore();
        if (b._setDirty) b._setDirty();
    }

    function crisp(b) {
        if (b && b._baseTexture && window.PIXI && PIXI.SCALE_MODES) b._baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return b;
    }

    H.frameBitmap = function(pose, direction, frame) {
        pose = pose || 'idle';
        direction = [2,4,6,8].indexOf(direction) >= 0 ? direction : 2;
        frame = Math.abs(Number(frame || 0)) % 3;
        var key = pose + ':' + direction + ':' + frame;
        if (H._cache[key]) return H._cache[key];
        var b = crisp(new Bitmap(H.W, H.H));
        H.drawFrame(b, pose, direction, frame);
        H._cache[key] = b;
        return b;
    };

    H.drawFrame = function(b, pose, d, f) {
        var p = H.palette;
        var side = d === 4 ? -1 : d === 6 ? 1 : 0;
        var up = d === 8;
        var step = (f === 0 ? -1 : f === 2 ? 1 : 0);
        var bob = (pose === 'walk' || pose === 'run') && f !== 1 ? 1 : 0;
        var y0 = bob;

        // sombra pequena em pixel art
        px(b, 7, 29, 10, 2, 'rgba(0,0,0,0.22)');

        // pernas e botas
        var legSwing = (pose === 'walk' ? step : pose === 'run' ? step * 2 : 0);
        px(b, 9 + Math.max(0,legSwing), 22+y0, 3, 7, p.jeansDark);
        px(b, 13 + Math.min(0,legSwing), 22+y0, 3, 7, p.jeans);
        px(b, 8 + Math.max(0,legSwing), 28+y0, 4, 2, p.boot);
        px(b, 13 + Math.min(0,legSwing), 28+y0, 4, 2, p.boot);

        // tronco
        px(b, 8, 12+y0, 9, 11, p.outline);
        px(b, 9, 12+y0, 7, 10, p.shirt);
        if (!up) px(b, 9, 19+y0, 7, 2, p.shirtShade);
        px(b, 9, 12+y0, 7, 2, p.scarf);

        // pescoço e cabeça
        px(b, 11, 9+y0, 3, 3, p.skinDark);
        px(b, 8, 3+y0, 9, 8, p.outline);
        px(b, 9, 4+y0, 7, 7, up ? p.hair : p.skin);
        if (!up) {
            if (side < 0) { px(b, 9, 7+y0, 1, 1, p.hair); px(b, 10, 8+y0, 1, 1, p.skinLight); }
            else if (side > 0) { px(b, 15, 7+y0, 1, 1, p.hair); px(b, 14, 8+y0, 1, 1, p.skinLight); }
            else { px(b, 10, 7+y0, 1, 1, p.hair); px(b, 14, 7+y0, 1, 1, p.hair); px(b, 12, 9+y0, 2, 1, p.skinDark); }
        }

        // chapéu de couro estilizado (visual regional sem depender de imagem externa)
        px(b, 7, 2+y0, 11, 2, p.hatDark);
        px(b, 8, 0+y0, 9, 3, p.hat);
        px(b, 10, 0+y0, 5, 1, p.hatLight);
        px(b, 7, 3+y0, 2, 1, p.hatLight);
        px(b, 16, 3+y0, 2, 1, p.hatLight);

        // braços padrão
        if (pose !== 'fish' && pose !== 'hoe' && pose !== 'water' && pose !== 'gather' && pose !== 'attack') {
            var arm = (pose === 'walk' || pose === 'run') ? -step : 0;
            px(b, 6, 13+y0+Math.max(0,arm), 2, 7, p.skin);
            px(b, 17, 13+y0+Math.max(0,-arm), 2, 7, p.skin);
        }

        if (pose === 'fish') {
            var cast = f === 0 ? -3 : f === 2 ? 2 : 0;
            var sx = side < 0 ? 6 : 17;
            var ex = side < 0 ? 1 : 23;
            if (side === 0) { sx = 17; ex = 23; }
            px(b, side < 0 ? 6 : 17, 13+y0, 2, 6, p.skin);
            px(b, side < 0 ? 5 : 18, 16+y0, 3, 2, p.skinLight);
            line(b, sx, 15+y0, ex, 4+cast+y0, p.wood, 2);
            line(b, ex, 4+cast+y0, ex + (side < 0 ? -2 : 2), 27, p.line, 1);
            px(b, ex + (side < 0 ? -3 : 2), 27, 2, 1, p.water);
        } else if (pose === 'hoe') {
            var hx = side < 0 ? 4 : 20;
            px(b, 6, 13+y0, 2, 7, p.skin);
            px(b, 17, 13+y0, 2, 7, p.skin);
            line(b, 12, 16+y0, hx, 28-(f*2), p.wood, 2);
            px(b, hx-2, 27-(f*2), 5, 2, p.metal);
        } else if (pose === 'water') {
            var wx = side < 0 ? 3 : 18;
            px(b, 6, 13+y0, 2, 7, p.skin);
            px(b, 17, 13+y0, 2, 7, p.skin);
            px(b, wx, 18+y0, 5, 5, '#648b95');
            px(b, wx + (side < 0 ? -3 : 5), 19+y0, 4, 2, '#648b95');
            for (var i=0;i<3;i++) px(b, wx + (side < 0 ? -4-i : 9+i), 22+y0+i, 1, 2, p.water);
        } else if (pose === 'gather') {
            px(b, 6, 15+y0, 2, 8, p.skin);
            px(b, 17, 15+y0, 2, 8, p.skin);
            px(b, 5, 24+y0, 3, 2, p.skinLight);
            px(b, 17, 24+y0, 3, 2, p.skinLight);
        } else if (pose === 'attack') {
            px(b, 6, 13+y0, 2, 7, p.skin);
            px(b, 17, 13+y0, 2, 7, p.skin);
            var ax = side < 0 ? 2 : 23;
            line(b, 13, 15+y0, ax, 7 + f*3, p.wood, 2);
            px(b, ax-1, 5+f*3, 3, 4, p.metal);
        }
    };

    H.faceBitmap = function() {
        if (H._face) return H._face;
        var b = crisp(new Bitmap(144,144));
        var oldS = H.S;
        H.S = 4;
        // fundo transparente, retrato maior desenhado com a mesma paleta
        px(b, 6, 27, 24, 7, 'rgba(0,0,0,0.18)');
        px(b, 7, 20, 22, 14, H.palette.jeansDark);
        px(b, 8, 17, 20, 10, H.palette.shirt);
        px(b, 9, 17, 18, 3, H.palette.scarf);
        px(b, 11, 8, 14, 12, H.palette.outline);
        px(b, 12, 9, 12, 11, H.palette.skin);
        px(b, 14, 13, 2, 2, H.palette.hair);
        px(b, 21, 13, 2, 2, H.palette.hair);
        px(b, 17, 17, 4, 1, H.palette.skinDark);
        px(b, 10, 6, 16, 3, H.palette.hatDark);
        px(b, 12, 3, 13, 4, H.palette.hat);
        px(b, 15, 3, 7, 1, H.palette.hatLight);
        px(b, 9, 7, 3, 2, H.palette.hatLight);
        px(b, 25, 7, 3, 2, H.palette.hatLight);
        H.S = oldS;
        H._face = b;
        return b;
    };

    H.frameIndex = function(character, pose) {
        if (pose === 'idle') return Math.floor(Graphics.frameCount / 28) % 2 ? 1 : 0;
        if (pose === 'run') return Math.floor(Graphics.frameCount / 5) % 3;
        if (pose === 'fish' || pose === 'hoe' || pose === 'water' || pose === 'gather' || pose === 'attack') return Math.floor(Graphics.frameCount / 7) % 3;
        if (character && character.pattern) return character.pattern();
        return Math.floor(Graphics.frameCount / 10) % 3;
    };

    var _Sprite_Character_updateBitmap = Sprite_Character.prototype.updateBitmap;
    Sprite_Character.prototype.updateBitmap = function() {
        if (this._character === $gamePlayer) {
            var pose = H.currentPose(this._character);
            var dir = this._character.direction();
            var frame = H.frameIndex(this._character, pose);
            this.bitmap = H.frameBitmap(pose, dir, frame);
            this._tileId = 0;
            this._tilesetId = $gameMap.tilesetId();
            this._characterName = '__CAMUTANGA_JS_HERO__';
            this._characterIndex = 0;
            this._isBigCharacter = true;
            return;
        }
        _Sprite_Character_updateBitmap.call(this);
    };

    var _Sprite_Character_updateFrame = Sprite_Character.prototype.updateFrame;
    Sprite_Character.prototype.updateFrame = function() {
        if (this._character === $gamePlayer) {
            this.setFrame(0, 0, H.W, H.H);
            return;
        }
        _Sprite_Character_updateFrame.call(this);
    };

    // Substitui também o retrato do HUD do ator principal quando MOG_ActorHud estiver ativo.
    if (ImageManager.loadAHud) {
        var _ImageManager_loadAHud = ImageManager.loadAHud;
        ImageManager.loadAHud = function(filename) {
            if (filename === 'Face_1') return H.faceBitmap();
            return _ImageManager_loadAHud.call(this, filename);
        };
    }

})();

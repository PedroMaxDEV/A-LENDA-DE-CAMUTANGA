/*:
 * @plugindesc [v3.1] Camutanga Mundo Livre - libera saídas da campanha e neutraliza bloqueios narrativos no modo Vida Livre.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Este plugin só atua quando Camutanga.state().mode === 'free'.
 * - Portais/saídas condicionados por switches da história ficam disponíveis.
 * - Ao usar uma saída, executa apenas a transferência, sem disparar cutscenes.
 * - Autoruns/parallels narrativos ficam suspensos.
 * - Eventos invisíveis/efeitos da campanha deixam de bloquear passagem.
 *
 * F8 alterna rapidamente entre Mundo Livre e Campanha para testes.
 */
(function() {
    'use strict';

    window.Camutanga = window.Camutanga || {};
    var C = window.Camutanga;
    var FR = window.CamutangaFreeRoam = window.CamutangaFreeRoam || {};
    FR.version = '3.1.0';

    function state() {
        try { return C.state ? C.state() : ($gameSystem ? $gameSystem._camutangaLife : null); }
        catch (e) { return null; }
    }

    FR.active = function() {
        var s = state();
        return !!(s && s.mode === 'free');
    };

    FR.setActive = function(enabled) {
        var s = state();
        if (!s) return false;
        s.mode = enabled ? 'free' : 'storyOptional';
        if ($gameMap) $gameMap.requestRefresh();
        if (C.toast) C.toast(enabled ? 'MUNDO LIVRE ATIVADO • saídas e caminhos liberados.' : 'MODO HISTÓRIA ATIVADO • bloqueios da campanha restaurados.', 240);
        try { SoundManager.playOk(); } catch (e) {}
        return true;
    };

    FR.toggle = function() { return FR.setActive(!FR.active()); };

    function pageOf(ev) {
        return ev && ev.page ? ev.page() : null;
    }

    function commandList(page) {
        return page && page.list ? page.list : [];
    }

    function firstTransfer(page) {
        var list = commandList(page);
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].code === 201) return list[i];
        }
        return null;
    }

    function transferDestination(cmd) {
        if (!cmd || !cmd.parameters) return null;
        var p = cmd.parameters;
        if (p[0] === 0) {
            return { mapId:Number(p[1]||0), x:Number(p[2]||0), y:Number(p[3]||0), d:Number(p[4]||0), fade:Number(p[5]||0) };
        }
        if (!$gameVariables) return null;
        return {
            mapId:Number($gameVariables.value(Number(p[1]||0))||0),
            x:Number($gameVariables.value(Number(p[2]||0))||0),
            y:Number($gameVariables.value(Number(p[3]||0))||0),
            d:Number(p[4]||0), fade:Number(p[5]||0)
        };
    }

    function hasCode(page, code) {
        var list = commandList(page);
        for (var i=0;i<list.length;i++) if (list[i] && list[i].code === code) return true;
        return false;
    }

    function hasVisibleGraphic(page) {
        if (!page || !page.image) return false;
        return !!(page.image.characterName || Number(page.image.tileId||0) > 0);
    }

    function isExternalTransfer(page, currentMapId) {
        var cmd = firstTransfer(page), d = transferDestination(cmd);
        return !!(d && d.mapId > 0 && d.mapId !== Number(currentMapId||0));
    }

    function travelPageIndex(ev) {
        if (!ev || !ev.event) return -1;
        var data = ev.event(), pages = data && data.pages ? data.pages : [];
        // A página mais alta continua tendo prioridade, como no RPG Maker.
        // No Mundo Livre ignoramos apenas as condições que travavam a saída.
        for (var i=pages.length-1;i>=0;i--) {
            if (isExternalTransfer(pages[i], ev._mapId)) return i;
        }
        return -1;
    }

    function isInvisibleBlocker(ev, page) {
        if (!page || firstTransfer(page)) return false;
        if (Number(page.priorityType) !== 1) return false;
        if (hasVisibleGraphic(page)) return false;
        var list = commandList(page);
        // Paredes/eventos invisíveis vazios ou usados só para progresso narrativo.
        if (list.length <= 1) return true;
        return hasCode(page, 121) || hasCode(page, 123) || hasCode(page, 205) || hasCode(page, 101) || hasCode(page, 355);
    }

    function isNarrativeAuto(page) {
        if (!page) return false;
        var trig = Number(page.trigger);
        if (trig !== 3 && trig !== 4) return false;
        if (firstTransfer(page)) return true;
        // Paralelos formados somente por Plugin Command/Wait/branches podem ser sistemas antigos
        // de relógio/engine; mantemos esses. Scripts, diálogos, switches, vídeos e rotas são história.
        var list = commandList(page), meaningful = false;
        for (var i=0;i<list.length;i++) {
            var code = Number(list[i] && list[i].code || 0);
            if (code === 0 || code === 111 || code === 411 || code === 412 || code === 230 || code === 356) continue;
            meaningful = true; break;
        }
        return meaningful || trig === 3;
    }

    function shouldPassThrough(ev, page) {
        if (!FR.active() || !page) return false;
        if (isNarrativeAuto(page)) return true;
        if (isInvisibleBlocker(ev, page)) return true;
        // Barreiras visuais antigas da história (fogo, sensores etc.) não seguram o jogador no modo livre.
        if (Number(page.trigger) === 4 && page.image && /^!Flame/i.test(page.image.characterName || '')) return true;
        return false;
    }

    function reserveDirectTransfer(ev, page) {
        var cmd = firstTransfer(page), d = transferDestination(cmd);
        if (!d || d.mapId <= 0 || !$gamePlayer) return false;
        // Não executamos diálogos, switches, vídeos ou rotas da campanha: apenas a viagem.
        $gamePlayer.reserveTransfer(d.mapId, d.x, d.y, d.d, d.fade);
        if ($gameTemp) $gameTemp.clearDestination();
        try { SoundManager.playOk(); } catch (e) {}
        return true;
    }

    // ---------------------------------------------------------------------
    // 1) Saídas bloqueadas por switches/variáveis da campanha.
    // ---------------------------------------------------------------------
    var _Game_Event_findProperPageIndex = Game_Event.prototype.findProperPageIndex;
    Game_Event.prototype.findProperPageIndex = function() {
        if (FR.active()) {
            var idx = travelPageIndex(this);
            if (idx >= 0) return idx;
        }
        return _Game_Event_findProperPageIndex.call(this);
    };

    // Autorun com transferência vira um gatilho de toque em Mundo Livre.
    var _Game_Event_setupPageSettings = Game_Event.prototype.setupPageSettings;
    Game_Event.prototype.setupPageSettings = function() {
        _Game_Event_setupPageSettings.call(this);
        if (!FR.active()) return;
        var p = pageOf(this);
        if (p && firstTransfer(p) && Number(this._trigger) >= 2) this._trigger = 1;
    };

    // Saídas executam SOMENTE Transfer Player no modo livre.
    var _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        if (FR.active()) {
            var p = pageOf(this);
            if (p && isExternalTransfer(p, this._mapId)) {
                if (reserveDirectTransfer(this, p)) return;
            }
            if (p && (isNarrativeAuto(p) || isInvisibleBlocker(this, p))) return;
        }
        _Game_Event_start.call(this);
    };

    // ---------------------------------------------------------------------
    // 2) Cutscenes automáticas antigas não sequestram a Vida Livre.
    // ---------------------------------------------------------------------
    var _Game_Event_checkEventTriggerAuto = Game_Event.prototype.checkEventTriggerAuto;
    Game_Event.prototype.checkEventTriggerAuto = function() {
        if (FR.active() && isNarrativeAuto(pageOf(this))) return;
        _Game_Event_checkEventTriggerAuto.call(this);
    };

    var _Game_Event_updateParallel = Game_Event.prototype.updateParallel;
    Game_Event.prototype.updateParallel = function() {
        if (FR.active() && isNarrativeAuto(pageOf(this))) return;
        _Game_Event_updateParallel.call(this);
    };

    // ---------------------------------------------------------------------
    // 3) Barreiras narrativas deixam de ter colisão no Mundo Livre.
    // ---------------------------------------------------------------------
    var _Game_Event_isThrough = Game_Event.prototype.isThrough;
    Game_Event.prototype.isThrough = function() {
        if (shouldPassThrough(this, pageOf(this))) return true;
        return _Game_Event_isThrough.call(this);
    };

    // Garante atualização instantânea ao entrar num mapa/carregar save.
    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        if (FR.active()) this.requestRefresh();
    };

    // ---------------------------------------------------------------------
    // 4) Atalho de emergência/teste: F8.
    // ---------------------------------------------------------------------
    Input.keyMapper[119] = 'camutangaFreeRoam'; // F8
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (Input.isTriggered('camutangaFreeRoam')) FR.toggle();
    };

    // API útil para o DEV menu e para futuros sistemas.
    FR.travelPageIndex = travelPageIndex;
    FR.firstTransfer = firstTransfer;
})();

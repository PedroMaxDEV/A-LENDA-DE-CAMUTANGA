/*:
 * @plugindesc [v3.3] Camutanga Mundo Livre - remove de verdade barreiras e bloqueios narrativos sem apagar a campanha.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Atua somente no modo Vida Livre (Camutanga.state().mode === 'free').
 *
 * Esta versão trata também eventos antigos que NÃO possuem Transfer Player,
 * como as barreiras "Essa área está temporariamente bloqueada!" do Trevo.
 * O evento continua existindo para a campanha, mas no Vida Livre:
 *   - não bloqueia colisão;
 *   - não empurra o jogador;
 *   - não mostra mensagens de bloqueio;
 *   - não executa autoruns/parallels narrativos;
 *   - saídas condicionadas usam diretamente a página de transferência.
 *
 * F8 alterna Vida Livre / História para testes.
 */
(function() {
    'use strict';

    window.Camutanga = window.Camutanga || {};
    var C = window.Camutanga;
    var FR = window.CamutangaFreeRoam = window.CamutangaFreeRoam || {};
    FR.version = '4.2.0';

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
        if (C.toast) C.toast(enabled ? 'MUNDO LIVRE ATIVADO • todas as barreiras da história foram liberadas.' : 'MODO HISTÓRIA ATIVADO • bloqueios da campanha restaurados.', 260);
        try { SoundManager.playOk(); } catch (e) {}
        return true;
    };

    FR.toggle = function() { return FR.setActive(!FR.active()); };

    function pageOf(ev) {
        return ev && ev.page ? ev.page() : null;
    }

    function pagesOf(ev) {
        try {
            var d = ev && ev.event ? ev.event() : null;
            return d && d.pages ? d.pages : [];
        } catch (e) { return []; }
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

    function pageText(page) {
        var out = [];
        var list = commandList(page);
        for (var i=0;i<list.length;i++) {
            var cmd = list[i];
            if (!cmd) continue;
            // Show Text/scroll text/comments/script strings: suficiente para reconhecer bloqueios legados.
            if (cmd.code === 401 || cmd.code === 405 || cmd.code === 108 || cmd.code === 408 || cmd.code === 355 || cmd.code === 655) {
                var p = cmd.parameters || [];
                for (var j=0;j<p.length;j++) if (typeof p[j] === 'string') out.push(p[j]);
            }
        }
        return out.join(' ').toLowerCase();
    }

    function pageHasBarrierText(page) {
        var t = pageText(page);
        if (!t) return false;
        return /bloquead|bloquad|bloquei|temporariamente\s+blo|complete\s+(suas\s+)?miss|parte\s+do\s+mapa\s+est[aá]\s+blo|[aá]rea\s+est[aá]\s+temporariamente/.test(t);
    }

    function eventHasBarrierPage(ev) {
        var pages = pagesOf(ev);
        for (var i=0;i<pages.length;i++) if (pageHasBarrierText(pages[i])) return true;
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
        var pages = pagesOf(ev);
        for (var i=pages.length-1;i>=0;i--) {
            if (isExternalTransfer(pages[i], ev._mapId)) return i;
        }
        return -1;
    }

    // Algumas barreiras antigas possuem uma segunda página vazia que só seria
    // habilitada por um switch da campanha. No Vida Livre podemos usar essa página.
    function unlockedBarrierPageIndex(ev) {
        var pages = pagesOf(ev);
        var hasBarrier = false;
        for (var b=0;b<pages.length;b++) if (pageHasBarrierText(pages[b])) { hasBarrier = true; break; }
        if (!hasBarrier) return -1;

        for (var i=pages.length-1;i>=0;i--) {
            var p = pages[i];
            if (pageHasBarrierText(p)) continue;
            // Nunca escolhemos uma página narrativa pesada só para "liberar" caminho.
            // Transferência é segura; página vazia/passável também.
            var list = commandList(p);
            var meaningful = false;
            for (var j=0;j<list.length;j++) {
                var code = Number(list[j] && list[j].code || 0);
                if (code !== 0 && code !== 230) { meaningful = true; break; }
            }
            if (firstTransfer(p) || !meaningful || p.through === true) return i;
        }
        return -1;
    }

    function isInvisibleBlocker(ev, page) {
        if (!page || firstTransfer(page)) return false;
        if (Number(page.priorityType) !== 1) return false;
        if (hasVisibleGraphic(page)) return false;
        var list = commandList(page);
        if (list.length <= 1) return true;
        return hasCode(page, 121) || hasCode(page, 123) || hasCode(page, 205) || hasCode(page, 101) || hasCode(page, 355);
    }

    function isNarrativeAuto(page) {
        if (!page) return false;
        var trig = Number(page.trigger);
        if (trig !== 3 && trig !== 4) return false;
        if (firstTransfer(page)) return true;
        var list = commandList(page), meaningful = false;
        for (var i=0;i<list.length;i++) {
            var code = Number(list[i] && list[i].code || 0);
            if (code === 0 || code === 111 || code === 411 || code === 412 || code === 230 || code === 356) continue;
            meaningful = true; break;
        }
        return meaningful || trig === 3;
    }

    function isNarrativeBarrierEvent(ev) {
        return !!(FR.active() && ev && eventHasBarrierPage(ev));
    }

    function shouldPassThrough(ev, page) {
        if (!FR.active() || !page) return false;
        // NOVO 3.3: o evento inteiro é reconhecido como barreira, mesmo quando
        // a página atual é uma página vazia/legada diferente da página da mensagem.
        if (eventHasBarrierPage(ev) && !isExternalTransfer(page, ev._mapId)) return true;
        // V4.2: não tornamos cutscenes/missões passáveis; só barreiras explícitas.
        if (eventHasBarrierPage(ev)) return true;
        if (Number(page.trigger) === 4 && page.image && /^!Flame/i.test(page.image.characterName || '')) return true;
        return false;
    }

    function reserveDirectTransfer(ev, page) {
        var cmd = firstTransfer(page), d = transferDestination(cmd);
        if (!d || d.mapId <= 0 || !$gamePlayer) return false;
        $gamePlayer.reserveTransfer(d.mapId, d.x, d.y, d.d, d.fade);
        if ($gameTemp) $gameTemp.clearDestination();
        try { SoundManager.playOk(); } catch (e) {}
        return true;
    }

    // ---------------------------------------------------------------------
    // 1) Seleção de páginas no Mundo Livre.
    // ---------------------------------------------------------------------
    var _Game_Event_findProperPageIndex = Game_Event.prototype.findProperPageIndex;
    Game_Event.prototype.findProperPageIndex = function() {
        if (FR.active()) {
            // V4.2: preserve missões/cutscenes. Só alteramos eventos que são barreiras explícitas.
            if (eventHasBarrierPage(this)) {
                var travel = travelPageIndex(this);
                if (travel >= 0) return travel;
                var unlocked = unlockedBarrierPageIndex(this);
                if (unlocked >= 0) return unlocked;
            }
        }
        return _Game_Event_findProperPageIndex.call(this);
    };

    var _Game_Event_setupPageSettings = Game_Event.prototype.setupPageSettings;
    Game_Event.prototype.setupPageSettings = function() {
        _Game_Event_setupPageSettings.call(this);
        if (!FR.active()) return;
        var p = pageOf(this);
        if (eventHasBarrierPage(this) && p && firstTransfer(p) && Number(this._trigger) >= 2) this._trigger = 1;
    };

    // ---------------------------------------------------------------------
    // 2) Start/touch: bloqueios legados simplesmente não executam no Vida Livre.
    // ---------------------------------------------------------------------
    var _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        if (FR.active()) {
            var p = pageOf(this);
            if (eventHasBarrierPage(this)) {
                if (p && isExternalTransfer(p, this._mapId)) {
                    if (reserveDirectTransfer(this, p)) return;
                }
                return;
            }
        }
        _Game_Event_start.call(this);
    };

    var _Game_Event_checkEventTriggerTouch = Game_Event.prototype.checkEventTriggerTouch;
    Game_Event.prototype.checkEventTriggerTouch = function(x, y) {
        if (FR.active() && eventHasBarrierPage(this) && !isExternalTransfer(pageOf(this), this._mapId)) return;
        _Game_Event_checkEventTriggerTouch.call(this, x, y);
    };

    // ---------------------------------------------------------------------
    // 3) Cutscenes automáticas antigas não sequestram a Vida Livre.
    // ---------------------------------------------------------------------
    var _Game_Event_checkEventTriggerAuto = Game_Event.prototype.checkEventTriggerAuto;
    Game_Event.prototype.checkEventTriggerAuto = function() {
        if (FR.active() && eventHasBarrierPage(this)) return;
        _Game_Event_checkEventTriggerAuto.call(this);
    };

    var _Game_Event_updateParallel = Game_Event.prototype.updateParallel;
    Game_Event.prototype.updateParallel = function() {
        if (FR.active() && eventHasBarrierPage(this)) return;
        _Game_Event_updateParallel.call(this);
    };

    // ---------------------------------------------------------------------
    // 4) Colisão: TODA barreira narrativa conhecida vira passável no Vida Livre.
    // ---------------------------------------------------------------------
    var _Game_Event_isThrough = Game_Event.prototype.isThrough;
    Game_Event.prototype.isThrough = function() {
        if (shouldPassThrough(this, pageOf(this))) return true;
        return _Game_Event_isThrough.call(this);
    };

    // Alguns plugins consultam normalPriority em vez de isThrough.
    var _Game_Event_isNormalPriority = Game_Event.prototype.isNormalPriority;
    Game_Event.prototype.isNormalPriority = function() {
        if (FR.active() && eventHasBarrierPage(this) && !isExternalTransfer(pageOf(this), this._mapId)) return false;
        return _Game_Event_isNormalPriority.call(this);
    };

    // Se o evento antigo tentava empurrar o jogador ao tocar, bloqueamos a rota também.
    var _Game_Event_forceMoveRoute = Game_Event.prototype.forceMoveRoute;
    Game_Event.prototype.forceMoveRoute = function(moveRoute) {
        if (FR.active() && eventHasBarrierPage(this)) return;
        _Game_Event_forceMoveRoute.call(this, moveRoute);
    };

    // ---------------------------------------------------------------------
    // 5) Atualização imediata ao entrar no mapa ou carregar save.
    // ---------------------------------------------------------------------
    var _Game_Map_setup = Game_Map.prototype.setup;
    Game_Map.prototype.setup = function(mapId) {
        _Game_Map_setup.call(this, mapId);
        if (FR.active()) this.requestRefresh();
    };

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        if (FR.active() && $gameMap) $gameMap.requestRefresh();
    };

    // ---------------------------------------------------------------------
    // 6) Atalho de teste/emergência: F8.
    // ---------------------------------------------------------------------
    Input.keyMapper[119] = 'camutangaFreeRoam'; // F8
    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (Input.isTriggered('camutangaFreeRoam')) FR.toggle();
    };

    // API útil para DEV e diagnóstico.
    FR.travelPageIndex = travelPageIndex;
    FR.firstTransfer = firstTransfer;
    FR.pageHasBarrierText = pageHasBarrierText;
    FR.eventHasBarrierPage = eventHasBarrierPage;
})();

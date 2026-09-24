/*:
 * @plugindesc [v2.2] Camutanga Life - vida livre, energia, pesca, plantio, coleta, inventário moderno e controles mobile.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Controles PC:
 *  - F: ação de vida (pescar / plantar / regar / colher / coletar)
 *  - I: mochila e painel de vida
 *  - Q / R: trocar item ativo
 *  - Enter/Z: ação/ataque padrão do jogo
 *  - Shift: correr
 *
 * No celular os botões virtuais são criados automaticamente.
 */

(function() {
    'use strict';

    var PLUGIN = 'CamutangaLife';
    var STARTER_MAP_ID = 5;
    var STARTER_X = 39;
    var STARTER_Y = 12;
    var OUTDOOR_MAPS = [2,5,7,8,9,11,14,15,16,25,26];
    var FISHING_MAPS = [2,5,7,8,11,14,15,16,26];

    Input.keyMapper[73] = 'lifeMenu';   // I
    Input.keyMapper[70] = 'lifeAction'; // F
    Input.keyMapper[81] = 'lifePrev';   // Q
    Input.keyMapper[82] = 'lifeNext';   // R

    window.Camutanga = window.Camutanga || {};
    var C = window.Camutanga;

    C.version = '2.2.0';
    C.touchDevice = function() {
        return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
    };

    C.defaultState = function() {
        return {
            version: C.version,
            mode: 'story',
            stamina: 100,
            maxStamina: 100,
            activeItemId: 41,
            starterReceived: false,
            skills: {
                fishing: { level: 1, xp: 0 },
                farming: { level: 1, xp: 0 },
                gathering: { level: 1, xp: 0 }
            },
            collections: { fish: {} },
            plots: {},
            gathered: {},
            daily: { dayKey: -1, fish: 0, crops: 0, gathered: 0, quests: [] },
            totals: { fish: 0, crops: 0, gathered: 0 },
            lastDayKey: -1
        };
    };

    C.state = function() {
        if (!$gameSystem) return C.defaultState();
        if (!$gameSystem._camutangaLife) $gameSystem._camutangaLife = C.defaultState();
        var s = $gameSystem._camutangaLife;
        if (!s.skills) s.skills = C.defaultState().skills;
        if (!s.collections) s.collections = { fish: {} };
        if (!s.collections.fish) s.collections.fish = {};
        if (!s.plots) s.plots = {};
        if (!s.gathered) s.gathered = {};
        if (!s.daily) s.daily = C.defaultState().daily;
        if (!s.totals) s.totals = C.defaultState().totals;
        if (s.maxStamina == null) s.maxStamina = 100;
        if (s.stamina == null) s.stamina = s.maxStamina;
        return s;
    };

    C.noteTag = function(item, tag) {
        if (!item || !item.note) return null;
        var re = new RegExp('<' + tag + '(?::([^>]+))?>', 'i');
        var m = item.note.match(re);
        return m ? (m[1] == null ? true : m[1]) : null;
    };

    C.itemByTag = function(tag, value) {
        for (var i = 1; i < $dataItems.length; i++) {
            var it = $dataItems[i];
            if (!it) continue;
            var v = C.noteTag(it, tag);
            if (v !== null && (value == null || String(v).toLowerCase() === String(value).toLowerCase())) return it;
        }
        return null;
    };

    C.dayKey = function() {
        if (!$gameVariables) return 0;
        var raw = Number($gameVariables.value(3) || 0);
        return Math.floor(Math.max(0, raw) / 1440);
    };

    C.gameClock = function() {
        var raw = Number($gameVariables ? ($gameVariables.value(3) || 0) : 0);
        var total = Math.max(0, Math.floor(raw));
        var day = Math.floor(total / 1440) + 1;
        var minuteOfDay = total % 1440;
        var hour = Math.floor(minuteOfDay / 60);
        var minute = minuteOfDay % 60;
        return { day: day, hour: hour, minute: minute, raw: total };
    };

    C.clockText = function() {
        var t = C.gameClock();
        function pad(n) { return n < 10 ? '0' + n : String(n); }
        return 'Dia ' + t.day + '  •  ' + pad(t.hour) + ':' + pad(t.minute);
    };

    C.weatherText = function() {
        if ($gameSwitches && $gameSwitches.value(2)) return 'Chuva';
        var h = C.gameClock().hour;
        if (h >= 18 || h < 6) return 'Noite';
        return 'Ensolarado';
    };

    C.toast = function(text, frames) {
        if (!$gameTemp) return;
        $gameTemp._camutangaToast = { text: String(text), frames: frames || 180 };
    };

    C.spendStamina = function(amount) {
        var s = C.state();
        amount = Math.max(0, Number(amount || 0));
        if (s.stamina < amount) {
            SoundManager.playBuzzer();
            C.toast('Energia insuficiente. Coma algo ou durma na sua base.');
            return false;
        }
        s.stamina = Math.max(0, s.stamina - amount);
        return true;
    };

    C.restoreStamina = function(amount) {
        var s = C.state();
        s.stamina = Math.min(s.maxStamina, s.stamina + Math.max(0, Number(amount || 0)));
    };

    C.gainSkillXp = function(skill, amount) {
        var s = C.state();
        var sk = s.skills[skill];
        if (!sk) return;
        sk.xp += Math.max(0, Math.floor(amount || 0));
        var leveled = false;
        while (sk.xp >= 80 + sk.level * 45) {
            sk.xp -= 80 + sk.level * 45;
            sk.level += 1;
            leveled = true;
        }
        if (leveled) {
            s.maxStamina += 2;
            s.stamina = Math.min(s.maxStamina, s.stamina + 10);
            C.toast('Habilidade aumentou! ' + C.skillName(skill) + ' Nv. ' + sk.level + '  •  Energia máxima +2', 240);
            SoundManager.playRecovery();
        }
    };

    C.skillName = function(skill) {
        if (skill === 'fishing') return 'Pesca';
        if (skill === 'farming') return 'Cultivo';
        if (skill === 'gathering') return 'Coleta';
        return skill;
    };

    C.refreshDaily = function(force) {
        var s = C.state();
        var day = C.dayKey();
        if (!force && s.daily && s.daily.dayKey === day) return;

        // Crescimento de plantações que foram regadas no dia anterior.
        var prev = s.daily ? s.daily.dayKey : day - 1;
        Object.keys(s.plots || {}).forEach(function(mid) {
            var mp = s.plots[mid] || {};
            Object.keys(mp).forEach(function(key) {
                var p = mp[key];
                if (!p) return;
                if (p.wateredDay === prev) p.growth = (p.growth || 0) + 1;
            });
        });

        s.daily = {
            dayKey: day,
            fish: 0,
            crops: 0,
            gathered: 0,
            quests: [
                { id: 'fish', title: 'Pescador do dia', desc: 'Pesque 2 peixes.', current: 0, target: 2, reward: 90, done: false },
                { id: 'gather', title: 'Explorador', desc: 'Encontre 3 recursos explorando.', current: 0, target: 3, reward: 70, done: false },
                { id: 'farm', title: 'Mãos na terra', desc: 'Regue ou colha 3 plantações.', current: 0, target: 3, reward: 80, done: false }
            ]
        };
        s.lastDayKey = day;
        C.toast('Um novo dia começou. Novos pedidos estão disponíveis!', 240);
    };

    C.updateQuest = function(id, add) {
        var s = C.state();
        C.refreshDaily(false);
        var q = s.daily.quests.filter(function(x) { return x.id === id; })[0];
        if (!q || q.done) return;
        q.current = Math.min(q.target, q.current + (add || 1));
        if (q.current >= q.target) {
            q.done = true;
            $gameParty.gainGold(q.reward);
            SoundManager.playRecovery();
            C.toast('Pedido concluído: ' + q.title + '  +' + q.reward + ' ' + ($dataSystem.currencyUnit || 'G'), 240);
        }
    };

    C.giveStarterPack = function() {
        var s = C.state();
        if (s.starterReceived) return;
        var ids = [41,43,44,46,48,50,52,42];
        var qty = [1,1,1,6,4,4,2,8];
        for (var i = 0; i < ids.length; i++) if ($dataItems[ids[i]]) $gameParty.gainItem($dataItems[ids[i]], qty[i]);
        if ($gameParty.gold() < 150) $gameParty.gainGold(150 - $gameParty.gold());
        s.activeItemId = 41;
        s.starterReceived = true;
        C.toast('Kit inicial recebido: vara, enxada, regador, sementes e iscas.', 300);
    };

    C.advanceToMorning = function() {
        var s = C.state();
        var day = C.dayKey();
        var nextRaw = (day + 1) * 1440 + 6 * 60;
        $gameVariables.setValue(3, nextRaw);
        s.stamina = s.maxStamina;
        C.refreshDaily(true);
        if ($gameScreen) {
            $gameScreen.startFadeOut(30);
            setTimeout(function() { if ($gameScreen) $gameScreen.startFadeIn(30); }, 550);
        }
        C.toast('Você descansou. Energia restaurada!', 220);
    };

    C.activeItem = function() {
        return $dataItems[C.state().activeItemId] || null;
    };

    C.cycleActiveItem = function(dir) {
        var all = $gameParty ? $gameParty.items().filter(function(it) {
            return C.noteTag(it, 'cropSeed') !== null || C.noteTag(it, 'lifeTool') !== null || C.noteTag(it, 'bait') !== null;
        }) : [];
        if (!all.length) return;
        var current = C.state().activeItemId;
        var idx = all.map(function(it){return it.id;}).indexOf(current);
        if (idx < 0) idx = 0;
        idx = (idx + dir + all.length) % all.length;
        C.state().activeItemId = all[idx].id;
        C.toast('Item ativo: ' + all[idx].name, 90);
    };

    C.frontTile = function() {
        if (!$gamePlayer || !$gameMap) return { x:0, y:0 };
        var d = $gamePlayer.direction();
        return {
            x: $gameMap.roundXWithDirection($gamePlayer.x, d),
            y: $gameMap.roundYWithDirection($gamePlayer.y, d)
        };
    };

    C.isWaterTile = function(x, y) {
        if (!$gameMap || FISHING_MAPS.indexOf($gameMap.mapId()) < 0) return false;
        for (var z = 0; z < 4; z++) {
            var id = $gameMap.tileId(x, y, z);
            // A1: água animada. Os mapas de lava foram excluídos da lista de pesca.
            if (id >= 2048 && id < 2816) return true;
        }
        return false;
    };

    C.canFish = function() {
        var p = C.frontTile();
        return C.isWaterTile(p.x, p.y);
    };

    C.hasTool = function(tagValue) {
        for (var i = 1; i < $dataItems.length; i++) {
            var it = $dataItems[i];
            if (!it) continue;
            var v = C.noteTag(it, 'lifeTool');
            if (v && String(v).toLowerCase() === String(tagValue).toLowerCase() && $gameParty.hasItem(it)) return true;
        }
        return false;
    };

    C.consumeBait = function() {
        var bait = null;
        var items = $gameParty.items();
        for (var i = 0; i < items.length; i++) {
            if (C.noteTag(items[i], 'bait') !== null) { bait = items[i]; break; }
        }
        if (bait) $gameParty.loseItem(bait, 1);
        return !!bait;
    };

    C.startFishing = function() {
        if (!C.hasTool('fishing')) {
            SoundManager.playBuzzer();
            C.toast('Você precisa de uma Vara de Pesca.');
            return;
        }
        if (!C.spendStamina(4)) return;
        C.consumeBait();
        if (C.setHeroPose) C.setHeroPose('fish', 90);
        SceneManager.push(Scene_CamutangaFishing);
    };

    C.plotMap = function(mapId) {
        var s = C.state();
        var key = String(mapId);
        if (!s.plots[key]) s.plots[key] = {};
        return s.plots[key];
    };

    C.plotKey = function(x,y) { return x + ',' + y; };

    C.seedData = function(item) {
        var tag = C.noteTag(item, 'cropSeed');
        if (!tag || tag === true) return null;
        var parts = String(tag).split(',');
        return { harvestId: Number(parts[0]), days: Number(parts[1] || 4) };
    };

    C.refreshPlotSprites = function() {
        var scene = SceneManager._scene;
        if (scene && scene._spriteset && scene._spriteset.refreshCamutangaPlots) scene._spriteset.refreshCamutangaPlots();
    };

    C.tryFarm = function() {
        if (!$gameMap || $gameMap.mapId() !== STARTER_MAP_ID) return false;
        var pos = C.frontTile();
        var map = C.plotMap($gameMap.mapId());
        var key = C.plotKey(pos.x, pos.y);
        var plot = map[key];
        var day = C.dayKey();

        if (plot) {
            if ((plot.growth || 0) >= plot.days) {
                var harvest = $dataItems[plot.harvestId];
                if (harvest) {
                    if (!C.spendStamina(1)) return true;
                    if (C.setHeroPose) C.setHeroPose('gather', 34);
                    var lvl = C.state().skills.farming.level;
                    var qty = Math.random() < Math.min(0.45, lvl * 0.04) ? 2 : 1;
                    $gameParty.gainItem(harvest, qty);
                    delete map[key];
                    C.state().daily.crops += qty;
                    C.state().totals.crops += qty;
                    C.gainSkillXp('farming', 14 + qty * 3);
                    C.updateQuest('farm', 1);
                    SoundManager.playOk();
                    C.toast('Colheita: ' + harvest.name + (qty > 1 ? ' x' + qty : '') + '!');
                    C.refreshPlotSprites();
                }
                return true;
            }
            if (!C.hasTool('watering')) {
                C.toast('Você precisa do Regador para cuidar da plantação.');
                return true;
            }
            if (plot.wateredDay === day) {
                C.toast('Essa plantação já foi regada hoje. Crescimento: ' + (plot.growth || 0) + '/' + plot.days);
                return true;
            }
            if (!C.spendStamina(1)) return true;
            if (C.setHeroPose) C.setHeroPose('water', 42);
            plot.wateredDay = day;
            C.gainSkillXp('farming', 3);
            C.updateQuest('farm', 1);
            SoundManager.playOk();
            C.toast('Plantação regada. Crescimento: ' + (plot.growth || 0) + '/' + plot.days);
            C.refreshPlotSprites();
            return true;
        }

        var item = C.activeItem();
        var seed = C.seedData(item);
        if (!seed || !$gameParty.hasItem(item)) return false;
        if (!C.hasTool('hoe')) {
            C.toast('Você precisa de uma Enxada para plantar.');
            return true;
        }
        if (!$gameMap.isValid(pos.x,pos.y) || !$gameMap.isPassable(pos.x,pos.y,2) || $gameMap.eventsXy(pos.x,pos.y).length) {
            SoundManager.playBuzzer();
            C.toast('Escolha um pedaço livre de terra na sua base.');
            return true;
        }
        if (!C.spendStamina(2)) return true;
        if (C.setHeroPose) C.setHeroPose('hoe', 42);
        $gameParty.loseItem(item, 1);
        map[key] = {
            x: pos.x, y: pos.y,
            seedId: item.id,
            harvestId: seed.harvestId,
            days: seed.days,
            growth: 0,
            wateredDay: day
        };
        C.gainSkillXp('farming', 5);
        C.updateQuest('farm', 1);
        SoundManager.playOk();
        C.toast(item.name + ' plantadas! Regue todos os dias.');
        C.refreshPlotSprites();
        return true;
    };

    C.tryGather = function() {
        if (!$gameMap || OUTDOOR_MAPS.indexOf($gameMap.mapId()) < 0) return false;
        var p = C.frontTile();
        var day = C.dayKey();
        var s = C.state();
        var dk = String(day);
        if (!s.gathered[dk]) s.gathered[dk] = {};
        var key = $gameMap.mapId() + ':' + p.x + ':' + p.y;
        if (s.gathered[dk][key]) {
            C.toast('Você já procurou recursos aqui hoje.');
            return true;
        }
        if (!C.spendStamina(2)) return true;
        if (C.setHeroPose) C.setHeroPose('gather', 34);
        s.gathered[dk][key] = true;
        var pool;
        if ($gameMap.mapId() === 25) pool = [35,35,36,35];
        else if ($gameMap.mapId() === 26) pool = [53,54,54,55,53];
        else pool = [54,55,35,53,55];
        var chance = $gameMap.mapId() === 26 || $gameMap.mapId() === 25 ? 0.86 : 0.58;
        if (Math.random() <= chance) {
            var id = pool[Math.floor(Math.random() * pool.length)];
            var it = $dataItems[id];
            if (it) {
                $gameParty.gainItem(it, 1);
                s.daily.gathered += 1;
                s.totals.gathered += 1;
                C.gainSkillXp('gathering', 8);
                C.updateQuest('gather', 1);
                SoundManager.playOk();
                C.toast('Você encontrou: ' + it.name + '!');
            }
        } else {
            C.gainSkillXp('gathering', 2);
            C.toast('Nada útil por aqui desta vez.');
        }
        return true;
    };

    C.lifeAction = function() {
        if (!$gamePlayer || !$gameMap || !$gamePlayer.canMove || !$gamePlayer.canMove()) return;
        if ($gameMap.isEventRunning && $gameMap.isEventRunning()) return;
        C.refreshDaily(false);
        if (C.tryFarm()) return;
        if (C.canFish()) { C.startFishing(); return; }
        if (C.tryGather()) return;
        C.toast('Nada especial aqui. Procure água, terra livre ou áreas de coleta.', 100);
    };

    C.useInventoryItem = function(item) {
        if (!item) return false;
        var stam = C.noteTag(item, 'stamina');
        if (stam !== null && stam !== true) {
            if (!$gameParty.hasItem(item)) return false;
            C.restoreStamina(Number(stam));
            if (item.consumable !== false) $gameParty.loseItem(item, 1);
            SoundManager.playRecovery();
            C.toast(item.name + ': +' + stam + ' energia');
            return true;
        }
        if (C.noteTag(item, 'cropSeed') !== null || C.noteTag(item, 'lifeTool') !== null || C.noteTag(item, 'bait') !== null) {
            C.state().activeItemId = item.id;
            SoundManager.playOk();
            C.toast('Item ativo: ' + item.name);
            return true;
        }
        if (DataManager.isWeapon(item) || DataManager.isArmor(item)) {
            var actor = $gameParty.leader();
            if (!actor || !actor.canEquip(item)) return false;
            var slots = actor.equipSlots();
            for (var i = 0; i < slots.length; i++) {
                var ok = DataManager.isWeapon(item) ? slots[i] === 1 : slots[i] === item.etypeId;
                if (ok) { actor.changeEquip(i, item); SoundManager.playEquip(); C.toast('Equipado: ' + item.name); return true; }
            }
            return false;
        }
        if (DataManager.isItem(item) && item.consumable && item.scope === 7) {
            var a = $gameParty.leader();
            if (a && a.canUse(item)) {
                a.useItem(item);
                var action = new Game_Action(a);
                action.setItemObject(item);
                action.apply(a);
                action.applyGlobal();
                SoundManager.playUseItem();
                C.toast('Usou: ' + item.name);
                return true;
            }
        }
        C.state().activeItemId = item.id;
        C.toast('Selecionado: ' + item.name);
        return true;
    };

    // -------------------------------------------------------------------------
    // Título: História original continua intacta; Vida Livre inicia na base.
    // -------------------------------------------------------------------------
    var _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function() {
        this.addCommand('Vida Livre', 'camutangaFree');
        this.addCommand('História Original', 'newGame');
        this.addCommand(TextManager.continue_, 'continue', this.isContinueEnabled());
        this.addCommand(TextManager.options, 'options');
    };

    var _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function() {
        _Scene_Title_createCommandWindow.call(this);
        this._commandWindow.setHandler('camutangaFree', this.commandCamutangaFree.bind(this));
    };

    Scene_Title.prototype.commandCamutangaFree = function() {
        DataManager.setupNewGame();
        C.state().mode = 'free';
        C.state().stamina = C.state().maxStamina;
        $gameVariables.setValue(3, 6 * 60);
        $gameSwitches.setValue(26, true);
        $gameSwitches.setValue(91, false);
        C.giveStarterPack();
        $gamePlayer.reserveTransfer(STARTER_MAP_ID, STARTER_X, STARTER_Y, 2, 0);
        this._commandWindow.close();
        this.fadeOutAll();
        SceneManager.goto(Scene_Map);
    };

    // -------------------------------------------------------------------------
    // HUD
    // -------------------------------------------------------------------------
    function Window_CamutangaHUD() { this.initialize.apply(this, arguments); }
    Window_CamutangaHUD.prototype = Object.create(Window_Base.prototype);
    Window_CamutangaHUD.prototype.constructor = Window_CamutangaHUD;
    Window_CamutangaHUD.prototype.initialize = function() {
        var w = 390, h = 126;
        Window_Base.prototype.initialize.call(this, Graphics.boxWidth - w - 12, 10, w, h);
        this.opacity = 170;
        this._lastSig = '';
        this.refresh();
    };
    Window_CamutangaHUD.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        var s = C.state(), t = C.gameClock(), item = C.activeItem();
        var sig = [s.stamina,s.maxStamina,t.day,t.hour,t.minute,$gameParty.gold(),item?item.id:0,C.weatherText()].join('|');
        if (sig !== this._lastSig) { this._lastSig = sig; this.refresh(); }
    };
    Window_CamutangaHUD.prototype.refresh = function() {
        this.contents.clear();
        var s = C.state();
        this.changeTextColor(this.systemColor());
        this.drawText(C.clockText(), 0, 0, 220, 'left');
        this.resetTextColor();
        this.drawText(C.weatherText(), 220, 0, 130, 'right');
        this.changeTextColor(this.systemColor());
        this.drawText('Energia', 0, 34, 76);
        this.resetTextColor();
        this.drawGauge(80, 42, 180, Math.max(0, s.stamina / s.maxStamina), this.textColor(24), this.textColor(29));
        this.drawText(Math.round(s.stamina) + '/' + s.maxStamina, 266, 34, 90, 'right');
        var it = C.activeItem();
        this.changeTextColor(this.systemColor());
        this.drawText('Ativo:', 0, 68, 54);
        this.resetTextColor();
        if (it) { this.drawIcon(it.iconIndex, 54, 66); this.drawText(it.name, 92, 68, 180); }
        this.drawText($gameParty.gold() + ' ' + ($dataSystem.currencyUnit || 'G'), 260, 68, 96, 'right');
    };

    function Window_CamutangaToast() { this.initialize.apply(this, arguments); }
    Window_CamutangaToast.prototype = Object.create(Window_Base.prototype);
    Window_CamutangaToast.prototype.constructor = Window_CamutangaToast;
    Window_CamutangaToast.prototype.initialize = function() {
        var w = Math.min(760, Graphics.boxWidth - 40);
        Window_Base.prototype.initialize.call(this, Math.floor((Graphics.boxWidth - w)/2), Graphics.boxHeight - 104, w, 70);
        this.opacity = 195;
        this.hide();
        this._lastText = '';
    };
    Window_CamutangaToast.prototype.update = function() {
        Window_Base.prototype.update.call(this);
        if ($gameTemp && $gameTemp._camutangaToast && $gameTemp._camutangaToast.frames > 0) {
            var t = $gameTemp._camutangaToast;
            if (t.text !== this._lastText) {
                this._lastText = t.text;
                this.contents.clear();
                this.drawText(t.text, 0, 0, this.contentsWidth(), 'center');
            }
            t.frames--;
            this.show();
        } else {
            this.hide();
            this._lastText = '';
        }
    };

    var _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this._camutangaHUD = new Window_CamutangaHUD();
        this.addWindow(this._camutangaHUD);
        this._camutangaToast = new Window_CamutangaToast();
        this.addWindow(this._camutangaToast);
    };

    var _Scene_Map_start = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _Scene_Map_start.call(this);
        C.refreshDaily(false);
        if ($gameMap && $gameMap.mapId() === STARTER_MAP_ID) C.giveStarterPack();
    };

    var _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (!$gameSystem || !$gamePlayer) return;
        C.refreshDaily(false);
        if (Input.isTriggered('lifeMenu')) SceneManager.push(Scene_CamutangaMenu);
        if (Input.isTriggered('lifeAction')) C.lifeAction();
        if (Input.isTriggered('lifePrev')) C.cycleActiveItem(-1);
        if (Input.isTriggered('lifeNext')) C.cycleActiveItem(1);
    };

    // -------------------------------------------------------------------------
    // Plantação - desenho sobre o mapa sem alterar o mapa original.
    // -------------------------------------------------------------------------
    function Sprite_CamutangaPlot(plot) { this.initialize.apply(this, arguments); }
    Sprite_CamutangaPlot.prototype = Object.create(Sprite.prototype);
    Sprite_CamutangaPlot.prototype.constructor = Sprite_CamutangaPlot;
    Sprite_CamutangaPlot.prototype.initialize = function(plot) {
        Sprite.prototype.initialize.call(this);
        this._plot = plot;
        this.bitmap = new Bitmap(48,48);
        this.anchor.x = 0;
        this.anchor.y = 1;
        this.z = 3;
        this.redraw();
    };
    Sprite_CamutangaPlot.prototype.redraw = function() {
        var b = this.bitmap, p = this._plot;
        b.clear();
        b.fillRect(2,30,44,14,'rgba(92,58,31,0.78)');
        b.fillRect(5,34,38,3,'rgba(54,34,20,0.90)');
        var ratio = Math.min(1, (p.growth || 0) / Math.max(1,p.days));
        var h = 8 + Math.floor(ratio * 22);
        b.fillRect(22,30-h,4,h,'#4f8f3a');
        b.fillRect(14,22,10,5,'#62ad47');
        b.fillRect(25,17,11,5,'#62ad47');
        if (ratio >= 1) {
            b.fillRect(14,10,8,8,'#e9b83f');
            b.fillRect(29,8,8,8,'#e56f4a');
        } else if (p.wateredDay === C.dayKey()) {
            b.fillRect(4,40,5,3,'#4da4d8');
            b.fillRect(38,39,5,3,'#4da4d8');
        }
    };
    Sprite_CamutangaPlot.prototype.update = function() {
        Sprite.prototype.update.call(this);
        var tw = $gameMap.tileWidth(), th = $gameMap.tileHeight();
        this.x = Math.round($gameMap.adjustX(this._plot.x) * tw);
        this.y = Math.round(($gameMap.adjustY(this._plot.y) + 1) * th);
    };

    Spriteset_Map.prototype.refreshCamutangaPlots = function() {
        if (this._camutangaPlots) {
            for (var i=0;i<this._camutangaPlots.length;i++) this._tilemap.removeChild(this._camutangaPlots[i]);
        }
        this._camutangaPlots = [];
        if (!$gameMap || $gameMap.mapId() !== STARTER_MAP_ID) return;
        var map = C.plotMap($gameMap.mapId());
        var self = this;
        Object.keys(map).forEach(function(k) {
            var sp = new Sprite_CamutangaPlot(map[k]);
            self._camutangaPlots.push(sp);
            self._tilemap.addChild(sp);
        });
    };

    var _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
    Spriteset_Map.prototype.createLowerLayer = function() {
        _Spriteset_Map_createLowerLayer.call(this);
        this.refreshCamutangaPlots();
    };

    // -------------------------------------------------------------------------
    // Menu de vida / inventário.
    // -------------------------------------------------------------------------
    function Window_CamutangaTabs() { this.initialize.apply(this, arguments); }
    Window_CamutangaTabs.prototype = Object.create(Window_HorzCommand.prototype);
    Window_CamutangaTabs.prototype.constructor = Window_CamutangaTabs;
    Window_CamutangaTabs.prototype.windowWidth = function() { return Graphics.boxWidth; };
    Window_CamutangaTabs.prototype.maxCols = function() { return 5; };
    Window_CamutangaTabs.prototype.makeCommandList = function() {
        this.addCommand('Mochila','inventory');
        this.addCommand('Pedidos','quests');
        this.addCommand('Habilidades','skills');
        this.addCommand('Coleções','collections');
        this.addCommand('Sistema','system');
    };

    function Window_CamutangaList() { this.initialize.apply(this, arguments); }
    Window_CamutangaList.prototype = Object.create(Window_Selectable.prototype);
    Window_CamutangaList.prototype.constructor = Window_CamutangaList;
    Window_CamutangaList.prototype.initialize = function(x,y,w,h) {
        Window_Selectable.prototype.initialize.call(this,x,y,w,h);
        this._mode='inventory'; this._data=[]; this._detailWindow=null; this._lastIndex=-2;
        this.refresh();
    };
    Window_CamutangaList.prototype.setMode = function(mode) { this._mode=mode; this.refresh(); this.select(0); this.activate(); };
    Window_CamutangaList.prototype.maxItems = function() { return this._data ? this._data.length : 0; };
    Window_CamutangaList.prototype.item = function() { return this._data[this.index()]; };
    Window_CamutangaList.prototype.setDetailWindow = function(w) { this._detailWindow=w; };
    Window_CamutangaList.prototype.makeData = function() {
        var s=C.state();
        if (this._mode==='inventory') this._data=$gameParty.allItems().filter(function(x){return !!x;});
        else if (this._mode==='quests') this._data=(s.daily.quests||[]).slice();
        else if (this._mode==='skills') this._data=['fishing','farming','gathering'];
        else if (this._mode==='collections') {
            this._data=[23,24,25,26].map(function(id){return $dataItems[id];}).filter(Boolean);
        } else this._data=[
            {cmd:'save',name:'Salvar jogo',desc:'Abra a tela de salvamento.'},
            {cmd:'sleep',name:'Dormir até 06:00',desc:'Disponível na sua base. Recupera toda a energia e inicia um novo dia.'},
            {cmd:'options',name:'Opções',desc:'Volume e outras configurações do RPG Maker.'},
            {cmd:'story',name:'Iniciar a Lenda (opcional)',desc:'Entre na campanha original sem apagar seu progresso de pesca, cultivo e inventário.'},
            {cmd:'controls',name:'Controles',desc:'PC: F ação de vida, I mochila, Q/R item ativo. Celular: use os botões na tela.'}
        ];
    };
    Window_CamutangaList.prototype.refresh = function() {
        this.makeData(); this.createContents(); this.drawAllItems();
        if (this._detailWindow) this._detailWindow.setEntry(this._mode,this.item());
    };
    Window_CamutangaList.prototype.drawItem = function(index) {
        var rect=this.itemRectForText(index), e=this._data[index]; if(!e)return;
        this.resetTextColor();
        if (this._mode==='inventory' || this._mode==='collections') {
            this.drawIcon(e.iconIndex,rect.x,rect.y+2);
            this.drawText(e.name,rect.x+40,rect.y,rect.width-110);
            if(this._mode==='inventory') this.drawText('x'+$gameParty.numItems(e),rect.x+rect.width-66,rect.y,64,'right');
            else {
                var f=C.state().collections.fish[String(e.id)];
                this.drawText(f ? ('x'+f.count) : '—',rect.x+rect.width-70,rect.y,68,'right');
            }
        } else if (this._mode==='quests') {
            this.changeTextColor(e.done ? this.powerUpColor() : this.normalColor());
            this.drawText((e.done?'✓ ':'')+e.title,rect.x,rect.y,rect.width-95);
            this.resetTextColor(); this.drawText(e.current+'/'+e.target,rect.x+rect.width-90,rect.y,88,'right');
        } else if (this._mode==='skills') {
            var sk=C.state().skills[e]; this.drawText(C.skillName(e)+'  Nv. '+sk.level,rect.x,rect.y,rect.width-100);
            this.drawText(sk.xp+' XP',rect.x+rect.width-100,rect.y,96,'right');
        } else this.drawText(e.name,rect.x,rect.y,rect.width);
    };
    Window_CamutangaList.prototype.update = function() {
        Window_Selectable.prototype.update.call(this);
        if(this._lastIndex!==this.index()) { this._lastIndex=this.index(); if(this._detailWindow)this._detailWindow.setEntry(this._mode,this.item()); }
    };

    function Window_CamutangaDetail() { this.initialize.apply(this, arguments); }
    Window_CamutangaDetail.prototype=Object.create(Window_Base.prototype);
    Window_CamutangaDetail.prototype.constructor=Window_CamutangaDetail;
    Window_CamutangaDetail.prototype.initialize=function(x,y,w,h){Window_Base.prototype.initialize.call(this,x,y,w,h);this._mode='';this._entry=null;};
    Window_CamutangaDetail.prototype.setEntry=function(mode,e){this._mode=mode;this._entry=e;this.refresh();};
    Window_CamutangaDetail.prototype.refresh=function(){
        this.contents.clear(); var e=this._entry;if(!e)return; var y=0;
        if(this._mode==='inventory'){
            this.drawIcon(e.iconIndex,0,0); this.changeTextColor(this.systemColor()); this.drawText(e.name,40,0,this.contentsWidth()-40);this.resetTextColor();y=48;
            this.drawTextEx(e.description||'Sem descrição.',0,y); y+=90;
            var seed=C.seedData(e); if(seed)this.drawText('Ação: selecionar semente para plantar na base.',0,y,this.contentsWidth());
            else if(C.noteTag(e,'lifeTool')!==null)this.drawText('Ação: tornar esta ferramenta o item ativo.',0,y,this.contentsWidth());
            else if(C.noteTag(e,'stamina')!==null)this.drawText('Usar: recupera '+C.noteTag(e,'stamina')+' de energia.',0,y,this.contentsWidth());
            else this.drawText('Enter/toque: usar, equipar ou selecionar.',0,y,this.contentsWidth());
        } else if(this._mode==='quests'){
            this.changeTextColor(this.systemColor());this.drawText(e.title,0,0,this.contentsWidth());this.resetTextColor();
            this.drawTextEx(e.desc,0,48);this.drawText('Progresso: '+e.current+'/'+e.target,0,120,this.contentsWidth());this.drawText('Recompensa: '+e.reward+' '+($dataSystem.currencyUnit||'G'),0,160,this.contentsWidth());
        } else if(this._mode==='skills'){
            var sk=C.state().skills[e];this.changeTextColor(this.systemColor());this.drawText(C.skillName(e)+' — Nível '+sk.level,0,0,this.contentsWidth());this.resetTextColor();
            var need=80+sk.level*45;this.drawText('Experiência: '+sk.xp+' / '+need,0,50,this.contentsWidth());
            var txt=e==='fishing'?'Peixes raros ficam mais fáceis e a chance de qualidade aumenta.':e==='farming'?'Melhora a chance de colher unidades extras.':'Aumenta sua progressão ao explorar e encontrar recursos.';
            this.drawTextEx(txt,0,100);
        } else if(this._mode==='collections'){
            var f=C.state().collections.fish[String(e.id)];this.drawIcon(e.iconIndex,0,0);this.changeTextColor(this.systemColor());this.drawText(e.name,40,0,this.contentsWidth()-40);this.resetTextColor();
            if(f){this.drawText('Capturados: '+f.count,0,60,this.contentsWidth());this.drawText('Maior peso: '+f.bestWeight.toFixed(2)+' kg',0,100,this.contentsWidth());this.drawText('Melhor qualidade: '+'★'.repeat(f.bestQuality),0,140,this.contentsWidth());}
            else this.drawText('Ainda não descoberto.',0,70,this.contentsWidth());
        } else {
            this.changeTextColor(this.systemColor());this.drawText(e.name,0,0,this.contentsWidth());this.resetTextColor();this.drawTextEx(e.desc||'',0,55);
            if(e.cmd==='sleep') this.drawText('Local atual: '+($gameMap.mapId()===5||$gameMap.mapId()===6?'Base do jogador':'fora da base'),0,150,this.contentsWidth());
        }
    };

    function Scene_CamutangaMenu(){this.initialize.apply(this,arguments);}
    Scene_CamutangaMenu.prototype=Object.create(Scene_MenuBase.prototype);
    Scene_CamutangaMenu.prototype.constructor=Scene_CamutangaMenu;
    Scene_CamutangaMenu.prototype.initialize=function(){Scene_MenuBase.prototype.initialize.call(this);};
    Scene_CamutangaMenu.prototype.create=function(){
        Scene_MenuBase.prototype.create.call(this);
        this._tabs=new Window_CamutangaTabs(0,0); this._tabs.y=0; this.addWindow(this._tabs);
        var y=this._tabs.height, left=Math.floor(Graphics.boxWidth*0.56), h=Graphics.boxHeight-y;
        this._list=new Window_CamutangaList(0,y,left,h); this.addWindow(this._list);
        this._detail=new Window_CamutangaDetail(left,y,Graphics.boxWidth-left,h); this.addWindow(this._detail);
        this._list.setDetailWindow(this._detail);
        var self=this;
        ['inventory','quests','skills','collections','system'].forEach(function(sym){self._tabs.setHandler(sym,function(){self._list.setMode(sym);self._tabs.deactivate();});});
        this._tabs.setHandler('cancel',this.popScene.bind(this));
        this._list.setHandler('ok',this.onListOk.bind(this));
        this._list.setHandler('cancel',this.onListCancel.bind(this));
        this._tabs.select(0);this._tabs.activate();this._list.deactivate();this._list.setMode('inventory');this._list.deactivate();
    };
    Scene_CamutangaMenu.prototype.onListCancel=function(){this._list.deactivate();this._tabs.activate();};
    Scene_CamutangaMenu.prototype.onListOk=function(){
        var mode=this._list._mode,e=this._list.item();
        if(mode==='inventory') { if(!C.useInventoryItem(e))SoundManager.playBuzzer(); this._list.refresh(); this._list.activate(); return; }
        if(mode==='system' && e){
            if(e.cmd==='save'){SceneManager.push(Scene_Save);return;}
            if(e.cmd==='options'){SceneManager.push(Scene_Options);return;}
            if(e.cmd==='story'){
                C.state().mode='storyOptional';
                $gamePlayer.reserveTransfer($dataSystem.startMapId,$dataSystem.startX,$dataSystem.startY,2,0);
                C.toast('A campanha original foi ativada. Seu progresso de vida livre foi mantido.',240);
                this.popScene();
                return;
            }
            if(e.cmd==='sleep'){
                if($gameMap.mapId()===5||$gameMap.mapId()===6){C.advanceToMorning();this.popScene();}
                else {SoundManager.playBuzzer();C.toast('Você só pode dormir na sua base.');this._list.activate();}
                return;
            }
            if(e.cmd==='controls'){C.toast('PC: F ação de vida • I mochila • Q/R item ativo • Enter ação/ataque',240);this._list.activate();return;}
        }
        this._list.activate();
    };
    window.Scene_CamutangaMenu=Scene_CamutangaMenu;

    // -------------------------------------------------------------------------
    // Minigame de pesca.
    // -------------------------------------------------------------------------
    function Scene_CamutangaFishing(){this.initialize.apply(this,arguments);}
    Scene_CamutangaFishing.prototype=Object.create(Scene_Base.prototype);
    Scene_CamutangaFishing.prototype.constructor=Scene_CamutangaFishing;
    Scene_CamutangaFishing.prototype.initialize=function(){
        Scene_Base.prototype.initialize.call(this);
        this._phase='wait';
        this._timer=0;
        this._biteAt=65+Math.randomInt(95);
        this._biteWindow=0;
        this._fishY=210;
        this._fishV=0;
        this._catchY=235;
        this._catchV=0;
        this._progress=18;
        this._done=false;
        this._resultText='';
    };
    Scene_CamutangaFishing.prototype.create=function(){
        // IMPORTANTE: esta cena não usa Window_Base nem addWindow().
        // Assim a pesca funciona mesmo quando plugins antigos alteram a WindowLayer.
        Scene_Base.prototype.create.call(this);
        this.createBackground();
        this.createFishingSprites();
        if(C.setHeroPose)C.setHeroPose('fish',120);
        this.refreshFishingUI();
        this.drawFishingBar();
    };
    Scene_CamutangaFishing.prototype.createBackground=function(){
        this._backgroundSprite=new Sprite();
        this._backgroundSprite.bitmap=SceneManager.backgroundBitmap();
        this.addChild(this._backgroundSprite);
        this._shade=new Sprite(new Bitmap(Graphics.boxWidth,Graphics.boxHeight));
        this._shade.bitmap.fillRect(0,0,Graphics.boxWidth,Graphics.boxHeight,'rgba(7,13,18,0.70)');
        this.addChild(this._shade);
    };
    Scene_CamutangaFishing.prototype.createFishingSprites=function(){
        this._ui=new Sprite(new Bitmap(Graphics.boxWidth,Graphics.boxHeight));
        this.addChild(this._ui);
        this._bar=new Sprite(new Bitmap(150,350));
        this._bar.x=Math.floor(Graphics.boxWidth*0.68)-75;
        this._bar.y=Math.max(220,Math.floor(Graphics.boxHeight/2)-120);
        this.addChild(this._bar);
        this._hero=new Sprite();
        this._hero.anchor.x=0.5;this._hero.anchor.y=1;
        this._hero.x=Math.floor(Graphics.boxWidth*0.27);
        this._hero.y=Math.floor(Graphics.boxHeight*0.72);
        this._hero.scale.x=3.1;this._hero.scale.y=3.1;
        this.addChild(this._hero);
        this._fishVisual=new Sprite(new Bitmap(70,36));
        var fb=this._fishVisual.bitmap;
        fb.fillRect(8,11,38,15,'#e0b85c');fb.fillRect(2,15,10,7,'#c78b3c');fb.fillRect(44,8,12,21,'#d39d45');
        fb.fillRect(16,14,4,4,'#2d261e');fb.fillRect(55,16,8,5,'#8fb9c8');
        this._fishVisual.anchor.x=0.5;this._fishVisual.anchor.y=0.5;
        this._fishVisual.x=Math.floor(Graphics.boxWidth*0.67);
        this._fishVisual.y=Math.floor(Graphics.boxHeight*0.57);
        this._fishVisual.visible=false;
        this.addChild(this._fishVisual);
    };
    Scene_CamutangaFishing.prototype.updateHeroSprite=function(){
        if(!this._hero)return;
        if(C.Hero&&C.Hero.frameBitmap){
            var frame=Math.floor(this._timer/7)%3;
            this._hero.bitmap=C.Hero.frameBitmap('fish',6,frame);
        }
        this._hero.y=Math.floor(Graphics.boxHeight*0.72)+(Math.floor(this._timer/18)%2);
    };
    Scene_CamutangaFishing.prototype.refreshFishingUI=function(){
        var b=this._ui.bitmap;b.clear();
        var x=55,y=35,w=Graphics.boxWidth-110,h=Graphics.boxHeight-70;
        b.fillRect(x,y,w,h,'rgba(19,28,33,0.90)');
        b.fillRect(x,y,w,6,'#d39b45');
        b.fillRect(x,y+h-6,w,6,'#5b3921');
        b.fontSize=32;b.textColor='#f1ce79';b.outlineColor='rgba(0,0,0,0.75)';b.outlineWidth=5;
        b.drawText('PESCA EM CAMUTANGA',x+20,y+18,w-40,46,'center');
        b.fontSize=21;b.textColor='#ffffff';b.outlineWidth=4;
        var txt=this._phase==='wait'?'Aguarde a fisgada...':this._phase==='bite'?'FISGOU! Aperte AÇÃO / Enter / toque!':this._phase==='reel'?'Mantenha a área verde sobre o peixe.':this._resultText;
        b.drawText(txt,x+20,y+72,w-40,36,'center');
        b.fontSize=17;b.textColor='#dce6df';
        b.drawText('Nível de Pesca '+C.state().skills.fishing.level,x+20,y+116,w-40,30,'center');
        if(this._phase==='wait'){
            b.fontSize=18;b.textColor='#9fd1df';
            b.drawText('O peixe pode fisgar a qualquer momento.',x+45,y+h-105,w-90,30,'center');
            b.drawText('Não aperte antes da hora.',x+45,y+h-72,w-90,30,'center');
        }else if(this._phase==='bite'){
            b.fontSize=27;b.textColor='#ffd75a';
            b.drawText('!',Math.floor(Graphics.boxWidth*0.66),y+148,80,50,'center');
        }else if(this._phase==='reel'){
            b.fontSize=18;b.textColor='#e9f4ef';
            b.drawText('Progresso '+Math.max(0,Math.floor(this._progress))+'%',Math.floor(Graphics.boxWidth*0.55),y+h-75,330,30,'center');
            b.fontSize=15;b.textColor='#a9c5ce';
            b.drawText('Segure para subir • solte para descer',Math.floor(Graphics.boxWidth*0.51),y+h-47,440,26,'center');
        }else if(this._done==='result'){
            b.fontSize=17;b.textColor='#a9c5ce';
            b.drawText('Aperte Enter / AÇÃO / toque para voltar',x+20,y+h-62,w-40,30,'center');
        }
    };
    Scene_CamutangaFishing.prototype.drawFishingBar=function(){
        var b=this._bar.bitmap;b.clear();
        if(this._phase!=='reel')return;
        b.fillRect(49,2,52,322,'rgba(0,0,0,0.62)');
        b.fillRect(55,8,40,310,'rgba(49,104,132,0.92)');
        for(var i=0;i<10;i++)b.fillRect(57,10+i*31,36,1,'rgba(255,255,255,0.10)');
        var fy=Math.max(10,Math.min(286,this._fishY));
        b.fillRect(60,fy,30,22,'#f0c552');
        b.fillRect(84,fy+7,8,8,'#d08734');
        var cy=Math.max(8,Math.min(256,this._catchY));
        b.fillRect(52,cy,46,58,'rgba(99,218,143,0.62)');
        b.fillRect(8,330,134,14,'rgba(0,0,0,0.70)');
        var prog=Math.floor(Math.max(0,Math.min(100,this._progress))*1.30);
        b.fillRect(10,332,prog,10,'#71d36f');
    };
    Scene_CamutangaFishing.prototype.update=function(){
        Scene_Base.prototype.update.call(this);
        this._timer++;
        this.updateHeroSprite();
        if(this._done==='result'){
            this._fishVisual.visible=true;
            this._fishVisual.rotation=Math.sin(this._timer/8)*0.08;
            if((this._timer>18)&&(Input.isTriggered('ok')||Input.isTriggered('cancel')||Input.isTriggered('lifeAction')||TouchInput.isTriggered()))this.popScene();
            return;
        }
        if(this._done)return;
        var pressed=Input.isTriggered('ok')||Input.isTriggered('lifeAction')||TouchInput.isTriggered();
        if(this._phase==='wait'){
            if(this._timer>=this._biteAt){
                this._phase='bite';this._biteWindow=55;this._timer=0;SoundManager.playCursor();
                this._fishVisual.visible=true;this.refreshFishingUI();
            }
        }else if(this._phase==='bite'){
            this._biteWindow--;
            this._fishVisual.y=Math.floor(Graphics.boxHeight*0.57)-Math.abs(Math.sin(this._timer/3))*28;
            if(pressed){this._phase='reel';this._timer=0;this._progress=18;this._fishVisual.visible=false;this.refreshFishingUI();this.drawFishingBar();}
            else if(this._biteWindow<=0){this.fail('O peixe escapou antes da fisgada.');}
        }else if(this._phase==='reel'){
            var hold=Input.isPressed('ok')||Input.isPressed('lifeAction')||TouchInput.isPressed();
            this._catchV+=hold?-0.52:0.38;this._catchV*=0.91;this._catchY+=this._catchV;
            if(this._catchY<8){this._catchY=8;this._catchV=0;}if(this._catchY>256){this._catchY=256;this._catchV=0;}
            if(this._timer%22===0)this._fishV+=(Math.random()*2-1)*(1.8+this._timer/850);
            this._fishV*=0.93;this._fishY+=this._fishV;
            if(this._fishY<10){this._fishY=10;this._fishV=Math.abs(this._fishV)*0.82;}if(this._fishY>286){this._fishY=286;this._fishV=-Math.abs(this._fishV)*0.82;}
            var overlap=(this._fishY+22>=this._catchY)&&(this._fishY<=this._catchY+58);
            var lvl=C.state().skills.fishing.level;
            this._progress+=overlap?(0.40+lvl*0.014):-0.24;
            if(this._progress>=100){this.success();return;}if(this._progress<=0){this.fail('A linha afrouxou e o peixe escapou.');return;}
            if(this._timer%8===0)this.refreshFishingUI();
            this.drawFishingBar();
        }
    };
    Scene_CamutangaFishing.prototype.pickFish=function(){
        var lvl=C.state().skills.fishing.level,h=C.gameClock().hour,r=Math.random();
        var id=23;
        if(r<0.04+Math.min(0.10,lvl*0.006))id=26;
        else if(r<0.22+Math.min(0.14,lvl*0.008))id=25;
        else if((h>=17||h<8)&&r<0.62)id=24;
        var base={23:0.65,24:1.1,25:1.7,26:4.3}[id]||1;
        var weight=base*(0.72+Math.random()*0.85)*(1+Math.min(0.35,lvl*0.018));
        var quality=1;if(Math.random()<0.35+lvl*0.015)quality=2;if(Math.random()<0.13+lvl*0.01)quality=3;if(Math.random()<0.035+lvl*0.005)quality=4;
        return{id:id,weight:weight,quality:quality};
    };
    Scene_CamutangaFishing.prototype.success=function(){
        var f=this.pickFish(),it=$dataItems[f.id];
        if(it)$gameParty.gainItem(it,1);
        var s=C.state(),k=String(f.id),c=s.collections.fish[k]||{count:0,bestWeight:0,bestQuality:0};
        c.count++;c.bestWeight=Math.max(c.bestWeight,f.weight);c.bestQuality=Math.max(c.bestQuality,f.quality);s.collections.fish[k]=c;
        s.daily.fish++;s.totals.fish++;C.gainSkillXp('fishing',18+f.quality*4);C.updateQuest('fish',1);SoundManager.playRecovery();
        var stars='';for(var i=0;i<f.quality;i++)stars+='★';
        this._phase='result';this._done='result';this._timer=0;
        this._resultText='CAPTURA!  '+(it?it.name:'Peixe')+'  '+stars+'  •  '+f.weight.toFixed(2)+' kg';
        this._bar.bitmap.clear();this._fishVisual.visible=true;this.refreshFishingUI();
    };
    Scene_CamutangaFishing.prototype.fail=function(msg){
        this._phase='result';this._done='result';this._timer=0;SoundManager.playBuzzer();
        this._resultText='ESCAPOU!  '+msg;
        this._bar.bitmap.clear();this._fishVisual.visible=false;this.refreshFishingUI();
    };
    window.Scene_CamutangaFishing=Scene_CamutangaFishing;

    // -------------------------------------------------------------------------
    // Controles touch. Não dependem das coordenadas fixas do canvas.
    // -------------------------------------------------------------------------
    C.setVirtualKey=function(symbol,on){Input._currentState[symbol]=!!on;};

    C.createMobileControls=function(){
        if(document.getElementById('camutanga-mobile-ui'))return;
        var root=document.createElement('div');root.id='camutanga-mobile-ui';
        root.innerHTML='\
          <div class="cl-dpad">\
            <button data-key="up" class="cl-up">▲</button>\
            <button data-key="left" class="cl-left">◀</button>\
            <button data-key="right" class="cl-right">▶</button>\
            <button data-key="down" class="cl-down">▼</button>\
          </div>\
          <div class="cl-actions">\
            <button data-key="shift" class="cl-run">RUN</button>\
            <button data-key="d" class="cl-shield">DEF</button>\
            <button data-key="a" class="cl-item">ITEM</button>\
            <button data-key="lifeAction" class="cl-life">AÇÃO</button>\
            <button data-key="ok" class="cl-ok">A</button>\
          </div>\
          <button data-key="lifeMenu" class="cl-bag">MOCHILA</button>';
        document.body.appendChild(root);
        var buttons=root.querySelectorAll('button[data-key]');
        function bind(btn){
            var key=btn.getAttribute('data-key');
            var down=function(e){e.preventDefault();e.stopPropagation();C.setVirtualKey(key,true);};
            var up=function(e){e.preventDefault();e.stopPropagation();C.setVirtualKey(key,false);};
            btn.addEventListener('pointerdown',down,{passive:false});btn.addEventListener('pointerup',up,{passive:false});btn.addEventListener('pointercancel',up,{passive:false});btn.addEventListener('pointerleave',function(e){if(e.buttons===0)up(e);},{passive:false});
        }
        for(var i=0;i<buttons.length;i++)bind(buttons[i]);
    };

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',C.createMobileControls);else setTimeout(C.createMobileControls,0);

})();

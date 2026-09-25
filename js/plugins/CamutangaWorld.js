/*:
 * @plugindesc [v2.4] Mundo Vivo de Camutanga: dia/noite, clima, desastres, recursos derrubáveis, drops visíveis e ferramentas.
 * @author OpenAI + projeto Camutanga
 *
 * @help
 * Este plugin trabalha por cima dos mapas originais. Não precisa redesenhar os mapas.
 *
 * Recursos gerados no mundo:
 *   árvore  -> Machado
 *   pedra   -> Picareta
 *   arbusto -> coleta manual
 *
 * Itens no chão aparecem usando o IconSet e são coletados ao pisar neles
 * ou usando AÇÃO na frente deles.
 *
 * API para testes:
 *   Camutanga.World.forceWeather('rain');
 *   Camutanga.World.startDisaster('flood', 240);
 *   Camutanga.World.clearDisaster();
 *   Camutanga.World.setTime(22, 0);
 */
(function() {
    'use strict';

    window.Camutanga = window.Camutanga || {};
    var C = window.Camutanga;
    var W = C.World = C.World || {};
    W.VERSION = '2.4.0';

    W.OUTDOOR_MAPS = [2,5,7,8,9,11,14,15,16,25,26];
    W.NODE_MAPS = {
        5:  { tree:6, rock:4, bush:5 },
        25: { tree:1, rock:16, bush:2 },
        26: { tree:15, rock:6, bush:8 },
        2:  { tree:2, rock:1, bush:5 },
        7:  { tree:2, rock:1, bush:4 },
        8:  { tree:2, rock:1, bush:4 },
        9:  { tree:1, rock:1, bush:4 },
        11: { tree:2, rock:1, bush:4 },
        14: { tree:2, rock:1, bush:4 },
        15: { tree:2, rock:1, bush:4 },
        16: { tree:2, rock:1, bush:4 }
    };

    W.WEATHER_NAMES = {
        clear:'Ensolarado', cloudy:'Nublado', rain:'Chuva', storm:'Tempestade', fog:'Neblina'
    };
    W.DISASTER_NAMES = {
        storm:'Temporal severo', flood:'Enchente', wind:'Vendaval', landslide:'Deslizamento', drought:'Seca forte'
    };

    W.state = function() {
        var s = C.state ? C.state() : null;
        if (!s) return null;
        if (!s.world) {
            s.world = {
                seed: Math.floor(Math.random() * 999999) + 12345,
                weatherByDay: {},
                forcedWeather: null,
                disaster: null,
                lastWorldDay: -1,
                nodes: {},
                drops: {},
                dropCounter: 1,
                lastWindDropRaw: -99999,
                disasterMarks: {}
            };
        }
        var w=s.world;
        if(!w.weatherByDay)w.weatherByDay={};
        if(!w.nodes)w.nodes={};
        if(!w.drops)w.drops={};
        if(!w.disasterMarks)w.disasterMarks={};
        if(!w.dropCounter)w.dropCounter=1;
        return w;
    };

    W.isOutdoor = function(mapId) {
        mapId = mapId || ($gameMap ? $gameMap.mapId() : 0);
        return W.OUTDOOR_MAPS.indexOf(mapId) >= 0;
    };

    W.hashRand = function(day, salt) {
        var st=W.state();
        var x=((st?st.seed:12345) + (day+31)*1103515245 + (salt||0)*12345) >>> 0;
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        return (x>>>0) / 4294967295;
    };

    W.weatherForDay = function(day) {
        var st=W.state();
        if(!st)return 'clear';
        day=Math.max(0,Number(day||0));
        var key=String(day);
        if(st.weatherByDay[key])return st.weatherByDay[key];
        var r=W.hashRand(day,77), type='clear';
        if(r<0.12)type='fog';
        else if(r<0.31)type='rain';
        else if(r<0.38)type='storm';
        else if(r<0.60)type='cloudy';
        st.weatherByDay[key]=type;
        return type;
    };

    W.currentWeather = function() {
        var st=W.state();
        if(st&&st.forcedWeather)return st.forcedWeather;
        return W.weatherForDay(C.dayKey ? C.dayKey() : 0);
    };

    W.forceWeather = function(type) {
        var st=W.state(); if(!st)return;
        if(type==='auto'||!type)st.forcedWeather=null;
        else st.forcedWeather=String(type);
        W._lastVisualKey='';
        W.applyEnvironment(true);
        if(C.toast)C.toast(type==='auto'?'Clima automático restaurado.':'Clima de teste: '+(W.WEATHER_NAMES[type]||type),160);
    };

    W.setTime = function(hour, minute) {
        if(!$gameVariables)return;
        var day=C.dayKey ? C.dayKey() : 0;
        hour=Math.max(0,Math.min(23,Number(hour||0)));
        minute=Math.max(0,Math.min(59,Number(minute||0)));
        $gameVariables.setValue(3,day*1440+hour*60+minute);
        W._lastVisualKey='';
        W.applyEnvironment(true);
    };

    W.advanceHours = function(hours) {
        if(!$gameVariables)return;
        $gameVariables.setValue(3,Math.max(0,Number($gameVariables.value(3)||0)+Math.floor(Number(hours||1)*60)));
        W._lastVisualKey='';
        W.applyEnvironment(true);
    };

    W.startDisaster = function(type, durationMinutes) {
        var st=W.state(); if(!st)return;
        type=String(type||'storm');
        var raw=C.gameClock ? C.gameClock().raw : Number($gameVariables.value(3)||0);
        var defaults={storm:180,flood:300,wind:210,landslide:300,drought:720};
        st.disaster={type:type,startRaw:raw,endRaw:raw+Number(durationMinutes||defaults[type]||240),id:raw+'-'+type};
        W._lastVisualKey='';
        W.applyDisasterToCurrentMap();
        W.applyEnvironment(true);
        if(C.toast)C.toast('ALERTA: '+(W.DISASTER_NAMES[type]||type)+'!',300);
        if($gameScreen&&type==='storm')$gameScreen.startFlash([255,255,255,190],25);
    };

    W.clearDisaster = function(silent) {
        var st=W.state();if(!st)return;
        if(st.disaster&&!silent&&C.toast)C.toast('O evento extremo terminou.',180);
        st.disaster=null;
        W._lastVisualKey='';
        W.applyEnvironment(true);
    };

    W.activeDisaster = function() {
        var st=W.state();if(!st||!st.disaster)return null;
        var raw=C.gameClock ? C.gameClock().raw : Number($gameVariables.value(3)||0);
        if(raw>=Number(st.disaster.endRaw||0)){W.clearDisaster(false);return null;}
        return st.disaster;
    };

    W.onNewDay = function(day) {
        var st=W.state();if(!st)return;
        if(st.lastWorldDay===day)return;
        st.lastWorldDay=day;
        // Regenera nós derrubados no dia anterior.
        Object.keys(st.nodes).forEach(function(mid){
            (st.nodes[mid]||[]).forEach(function(n){
                if(!n.alive&&Number(n.regrowDay||999999)<=day){
                    n.alive=true;n.hp=n.maxHp;n.fallTimer=0;n.shake=0;
                }
            });
        });
        // Drops antigos desaparecem após a virada do dia.
        Object.keys(st.drops).forEach(function(mid){
            st.drops[mid]=(st.drops[mid]||[]).filter(function(d){return !d.collected&&Number(d.day||day)>=day-1;});
        });
        // Desastres naturais são raros. O menu DEV permite testar quando quiser.
        if(day>=2&&!st.disaster&&W.hashRand(day,909)<0.045){
            var r=W.hashRand(day,910), type=r<0.28?'wind':r<0.52?'storm':r<0.72?'flood':r<0.88?'landslide':'drought';
            W.startDisaster(type);
        }
    };

    // Chuva do dia anterior conta como irrigação para as plantações.
    if(C.refreshDaily){
        var _C_refreshDaily=C.refreshDaily;
        C.refreshDaily=function(force){
            var s=C.state(),day=C.dayKey(),prev=day-1;
            if((force||!s.daily||s.daily.dayKey!==day)&&prev>=0){
                var w=W.weatherForDay(prev);
                if(w==='rain'||w==='storm'){
                    Object.keys(s.plots||{}).forEach(function(mid){
                        var mp=s.plots[mid]||{};
                        Object.keys(mp).forEach(function(k){if(mp[k])mp[k].wateredDay=prev;});
                    });
                }
            }
            return _C_refreshDaily.call(C,force);
        };
    }

    W.toneForHour = function(hour, weather, disaster) {
        var t=[0,0,0,0];
        hour=Number(hour||0);
        if(hour<5)t=[-105,-95,-65,36];
        else if(hour<7)t=[-45,-28,5,12];
        else if(hour<17)t=[0,0,0,0];
        else if(hour<19)t=[14,-12,-32,8];
        else if(hour<21)t=[-45,-38,-30,18];
        else t=[-95,-86,-58,32];
        if(weather==='cloudy'){t[0]-=14;t[1]-=14;t[2]-=10;t[3]+=8;}
        if(weather==='rain'||weather==='storm'){t[0]-=26;t[1]-=22;t[2]-=8;t[3]+=14;}
        if(weather==='fog'){t[0]+=10;t[1]+=12;t[2]+=12;t[3]+=28;}
        if(disaster){
            if(disaster.type==='flood'){t[0]-=18;t[1]-=8;t[2]+=14;t[3]+=8;}
            if(disaster.type==='drought'){t[0]+=24;t[1]+=6;t[2]-=24;t[3]+=4;}
            if(disaster.type==='landslide'){t[0]-=12;t[1]-=10;t[2]-=8;t[3]+=12;}
        }
        return t;
    };

    W.effectiveWeather = function() {
        var d=W.activeDisaster();
        if(d){
            if(d.type==='storm'||d.type==='flood')return 'storm';
            if(d.type==='drought')return 'clear';
        }
        return W.currentWeather();
    };

    W.applyEnvironment = function(force) {
        if(!$gameScreen||!$gameMap)return;
        var outdoors=W.isOutdoor();
        var clock=C.gameClock?C.gameClock():{hour:12,raw:0};
        var d=W.activeDisaster();
        var weather=W.effectiveWeather();
        var key=[outdoors,clock.hour,weather,d?d.type:'none'].join('|');
        if(!force&&W._lastVisualKey===key)return;
        W._lastVisualKey=key;
        if(!outdoors){
            $gameScreen.changeWeather('none',0,20);
            $gameScreen.startTint([0,0,0,0],30);
            return;
        }
        var tone=W.toneForHour(clock.hour,weather,d);
        $gameScreen.startTint(tone,45);
        if(weather==='rain')$gameScreen.changeWeather('rain',5,30);
        else if(weather==='storm')$gameScreen.changeWeather('storm',8,25);
        else $gameScreen.changeWeather('none',0,25);
    };

    C.weatherText = function() {
        var d=W.activeDisaster();
        if(d)return W.DISASTER_NAMES[d.type]||d.type;
        var w=W.currentWeather();
        return W.WEATHER_NAMES[w]||w;
    };

    // ---------------------------------------------------------------------
    // Recursos físicos e drops visíveis
    // ---------------------------------------------------------------------
    W.nodeState = function(mapId) {
        var st=W.state(),key=String(mapId);
        if(!st.nodes[key])st.nodes[key]=[];
        return st.nodes[key];
    };
    W.dropState = function(mapId) {
        var st=W.state(),key=String(mapId);
        if(!st.drops[key])st.drops[key]=[];
        return st.drops[key];
    };

    W.nodeHp = function(type) { return type==='tree'?3:type==='rock'?3:1; };

    W.makeRng = function(seed) {
        var x=seed>>>0;
        return function(){x=(x*1664525+1013904223)>>>0;return x/4294967296;};
    };

    W.goodNodeTile = function(x,y,mapId) {
        if(!$gameMap||!$gameMap.isValid(x,y))return false;
        if(x<2||y<2||x>$gameMap.width()-3||y>$gameMap.height()-3)return false;
        if(C.isWaterTile&&C.isWaterTile(x,y))return false;
        var pass=$gameMap.isPassable(x,y,2)||$gameMap.isPassable(x,y,4)||$gameMap.isPassable(x,y,6)||$gameMap.isPassable(x,y,8);
        if(!pass)return false;
        if($gameMap.eventsXy&&$gameMap.eventsXy(x,y).length)return false;
        if($gamePlayer&&Math.abs($gamePlayer.x-x)+Math.abs($gamePlayer.y-y)<5)return false;
        if(mapId===5&&Math.abs(x-39)+Math.abs(y-12)<9)return false;
        return true;
    };

    W.ensureNodes = function(mapId) {
        mapId=Number(mapId||($gameMap?$gameMap.mapId():0));
        var cfg=W.NODE_MAPS[mapId];if(!cfg||!$gameMap)return;
        var arr=W.nodeState(mapId);
        if(arr.length)return;
        var types=[];
        Object.keys(cfg).forEach(function(type){for(var i=0;i<cfg[type];i++)types.push(type);});
        var rng=W.makeRng((W.state().seed+mapId*9719)>>>0),tries=0,index=0;
        while(index<types.length&&tries<types.length*100){
            tries++;
            var x=2+Math.floor(rng()*Math.max(1,$gameMap.width()-4));
            var y=2+Math.floor(rng()*Math.max(1,$gameMap.height()-4));
            if(!W.goodNodeTile(x,y,mapId))continue;
            var occupied=arr.some(function(n){return n.x===x&&n.y===y;});
            if(occupied)continue;
            var type=types[index++],hp=W.nodeHp(type);
            arr.push({id:'n'+mapId+'_'+index,x:x,y:y,type:type,hp:hp,maxHp:hp,alive:true,regrowDay:0,shake:0,fallTimer:0});
        }
    };

    W.nodeAt = function(mapId,x,y) {
        var arr=W.nodeState(mapId);
        for(var i=0;i<arr.length;i++)if(arr[i].alive&&arr[i].x===x&&arr[i].y===y)return arr[i];
        return null;
    };

    W.spawnDrop = function(itemId,x,y,qty) {
        var st=W.state();if(!st||!$gameMap)return;
        qty=Math.max(1,Number(qty||1));
        var arr=W.dropState($gameMap.mapId());
        for(var i=0;i<qty;i++){
            var id='d'+(st.dropCounter++);
            arr.push({id:id,itemId:Number(itemId),tx:x,ty:y,ox:(Math.random()-0.5)*0.42,oy:(Math.random()-0.5)*0.28,day:C.dayKey(),collected:false});
        }
    };

    W.nodeDrops = function(node) {
        var drops=[];
        if(node.type==='tree'){
            drops.push(53,53);
            if(Math.random()<0.70)drops.push(59);
            if(Math.random()<0.34)drops.push(60);
            if(Math.random()<0.08)drops.push(76);
        }else if(node.type==='rock'){
            drops.push(35,35);
            if(Math.random()<0.40)drops.push(36);
            if(Math.random()<0.24)drops.push(74);
            if(Math.random()<0.09)drops.push(75);
            if(Math.random()<0.045)drops.push(77);
        }else{
            var pool=[54,64,64,65,66,67,68,69,55];
            drops.push(pool[Math.floor(Math.random()*pool.length)]);
            if(Math.random()<0.28)drops.push(pool[Math.floor(Math.random()*pool.length)]);
        }
        return drops;
    };

    W.destroyNode = function(node) {
        node.alive=false;node.hp=0;node.shake=0;node.fallTimer=node.type==='tree'?34:18;
        node.regrowDay=C.dayKey()+(node.type==='tree'?3:node.type==='rock'?2:1);
        var ids=W.nodeDrops(node);
        for(var i=0;i<ids.length;i++)W.spawnDrop(ids[i],node.x,node.y,1);
        if(C.gainSkillXp)C.gainSkillXp('gathering',node.type==='bush'?7:14);
        if(C.updateQuest)C.updateQuest('gather',1);
        if(C.toast)C.toast(node.type==='tree'?'Árvore derrubada! Os materiais caíram no chão.':node.type==='rock'?'Rocha quebrada! Veja os minérios no chão.':'Você limpou o arbusto.',180);
        SoundManager.playOk();
    };

    W.requiredTool = function(type){return type==='tree'?'axe':type==='rock'?'pickaxe':null;};
    W.poseForNode = function(type){return type==='tree'?'axe':type==='rock'?'pickaxe':'gather';};

    W.tryResourceAction = function() {
        if(!$gameMap||!W.isOutdoor())return false;
        W.ensureNodes($gameMap.mapId());
        var p=C.frontTile(),node=W.nodeAt($gameMap.mapId(),p.x,p.y);
        if(!node)return false;
        var need=W.requiredTool(node.type);
        if(need&&(!C.hasTool||!C.hasTool(need))){
            SoundManager.playBuzzer();
            if(C.toast)C.toast(need==='axe'?'Você precisa de um Machado.':'Você precisa de uma Picareta.',150);
            return true;
        }
        var cost=node.type==='bush'?1:3;
        if(C.spendStamina&&!C.spendStamina(cost))return true;
        if(C.setHeroPose)C.setHeroPose(W.poseForNode(node.type),44);
        node.shake=22;
        node.hp=Math.max(0,Number(node.hp||1)-1);
        if(node.hp<=0)W.destroyNode(node);
        else if(C.toast)C.toast((node.type==='tree'?'Toc! ':node.type==='rock'?'Clang! ':'')+'Resistência '+node.hp+'/'+node.maxHp,70);
        return true;
    };

    W.collectDrop = function(drop) {
        if(!drop||drop.collected)return false;
        var it=$dataItems[drop.itemId];if(!it){drop.collected=true;return false;}
        drop.collected=true;
        $gameParty.gainItem(it,1);
        if(C.showHeldItem)C.showHeldItem(it.id,92);
        if(C.setHeroPose)C.setHeroPose('gather',30);
        if(C.toast)C.toast('+ '+it.name,90);
        SoundManager.playCursor();
        var s=C.state();s.daily.gathered=(s.daily.gathered||0)+1;s.totals.gathered=(s.totals.gathered||0)+1;
        if(C.updateQuest)C.updateQuest('gather',1);
        return true;
    };

    W.tryPickup = function() {
        if(!$gameMap)return false;
        var arr=W.dropState($gameMap.mapId()),p=C.frontTile();
        for(var i=0;i<arr.length;i++){
            var d=arr[i];if(!d.collected&&((d.tx===$gamePlayer.x&&d.ty===$gamePlayer.y)||(d.tx===p.x&&d.ty===p.y)))return W.collectDrop(d);
        }
        return false;
    };

    // Substitui a coleta invisível do V2: agora o recurso aparece no chão primeiro.
    if(C.tryGather){
        C.tryGather=function(){
            if(!$gameMap||W.OUTDOOR_MAPS.indexOf($gameMap.mapId())<0)return false;
            var p=C.frontTile(),day=C.dayKey(),s=C.state(),dk=String(day);
            if(!s.gathered[dk])s.gathered[dk]={};
            var key=$gameMap.mapId()+':'+p.x+':'+p.y;
            if(s.gathered[dk][key]){if(C.toast)C.toast('Você já procurou recursos aqui hoje.',90);return true;}
            if(C.spendStamina&&!C.spendStamina(2))return true;
            if(C.setHeroPose)C.setHeroPose('gather',34);
            s.gathered[dk][key]=true;
            var pool=$gameMap.mapId()===25?[35,35,36,61,74]:$gameMap.mapId()===26?[53,54,59,64,65,55,66]:[54,55,35,59,64,66,67,68,69];
            var chance=($gameMap.mapId()===26||$gameMap.mapId()===25)?0.88:0.62;
            if(Math.random()<=chance){
                var id=pool[Math.floor(Math.random()*pool.length)];
                W.spawnDrop(id,p.x,p.y,1);
                if(C.gainSkillXp)C.gainSkillXp('gathering',6);
                if(C.toast)C.toast('Você encontrou algo. Pegue o item que caiu no chão!',120);
            }else{
                if(C.gainSkillXp)C.gainSkillXp('gathering',2);
                if(C.toast)C.toast('Nada útil por aqui desta vez.',90);
            }
            return true;
        };
    }

    W.autoPickup = function() {
        if(!$gameMap||!$gamePlayer)return;
        var arr=W.dropState($gameMap.mapId());
        for(var i=0;i<arr.length;i++){
            var d=arr[i];if(!d.collected&&d.tx===$gamePlayer.x&&d.ty===$gamePlayer.y){W.collectDrop(d);break;}
        }
    };

    // Nós sólidos: o herói não atravessa árvore/pedra/arbusto gerado.
    var _Game_Player_canPass=Game_Player.prototype.canPass;
    Game_Player.prototype.canPass=function(x,y,d){
        if($gameMap&&W.isOutdoor()){
            var x2=$gameMap.roundXWithDirection(x,d),y2=$gameMap.roundYWithDirection(y,d);
            if(W.nodeAt($gameMap.mapId(),x2,y2))return false;
        }
        return _Game_Player_canPass.call(this,x,y,d);
    };

    // Enchente reduz um pouco a velocidade; o resto do jogo continua jogável.
    var _Game_Player_realMoveSpeed=Game_Player.prototype.realMoveSpeed;
    Game_Player.prototype.realMoveSpeed=function(){
        var base=_Game_Player_realMoveSpeed.call(this),dis=W.activeDisaster();
        if(dis&&dis.type==='flood'&&W.isOutdoor())return Math.max(2.5,base-0.55);
        return base;
    };

    if(C.lifeAction){
        var _C_lifeAction=C.lifeAction;
        C.lifeAction=function(){
            if(W.tryPickup())return;
            if(W.tryResourceAction())return;
            return _C_lifeAction.call(C);
        };
    }

    // Kit inicial: adiciona Machado e Picareta se ainda não existirem no inventário.
    W.ensureStarterTools=function(){
        if(!$gameParty||!$dataItems)return;
        [57,58].forEach(function(id){if($dataItems[id]&&!$gameParty.hasItem($dataItems[id]))$gameParty.gainItem($dataItems[id],1);});
    };

    // Pesca ganha mais espécies e reage a horário/clima.
    if(window.Scene_CamutangaFishing){
        Scene_CamutangaFishing.prototype.pickFish=function(){
            var lvl=C.state().skills.fishing.level,h=C.gameClock().hour,weather=W.effectiveWeather(),r=Math.random(),id=23;
            if(weather==='rain'||weather==='storm')r*=0.84;
            if(r<0.025+Math.min(0.07,lvl*0.004))id=26;          // Pirarucu
            else if(r<0.115+Math.min(0.09,lvl*0.006))id=72;     // Surubim
            else if(r<0.25+Math.min(0.12,lvl*0.007))id=25;      // Tucunaré
            else if((h>=17||h<7)&&r<0.48)id=24;                 // Traíra
            else if(r<0.62)id=71;                               // Curimatã
            else if(r<0.82)id=70;                               // Piau
            else if(r<0.94)id=23;                               // Tilápia
            else id=73;                                         // Piaba
            var bases={23:0.65,24:1.1,25:1.7,26:4.3,70:0.72,71:1.05,72:2.4,73:0.18};
            var base=bases[id]||1;
            var weight=base*(0.72+Math.random()*0.85)*(1+Math.min(0.35,lvl*0.018));
            var quality=1;if(Math.random()<0.35+lvl*0.015)quality=2;if(Math.random()<0.13+lvl*0.01)quality=3;if(Math.random()<0.035+lvl*0.005)quality=4;
            return{id:id,weight:weight,quality:quality};
        };
    }

    // ---------------------------------------------------------------------
    // Sprites de recursos e drops (arte em JS)
    // ---------------------------------------------------------------------
    W.nodeBitmapCache={};
    W.nodeBitmap=function(type){
        if(W.nodeBitmapCache[type])return W.nodeBitmapCache[type];
        var b=new Bitmap(72,104);
        if(type==='tree'){
            b.fillRect(30,54,15,46,'#5b351f');b.fillRect(34,54,7,45,'#8a5330');
            b.fillRect(12,31,50,35,'#244d28');b.fillRect(5,38,30,26,'#2e6730');b.fillRect(37,35,30,28,'#327339');
            b.fillRect(18,20,38,30,'#3f823d');b.fillRect(25,13,27,24,'#4c9144');
            b.fillRect(19,25,9,7,'#79a84c');b.fillRect(46,23,8,7,'#79a84c');
        }else if(type==='rock'){
            b.fillRect(11,67,51,29,'rgba(25,20,18,0.18)');
            b.fillRect(13,56,47,34,'#696d70');b.fillRect(19,48,35,38,'#858b8f');b.fillRect(25,43,24,18,'#a9afb1');
            b.fillRect(19,62,10,8,'#5b6063');b.fillRect(42,54,9,7,'#c0c6c8');
        }else{
            b.fillRect(8,74,56,14,'rgba(25,20,18,0.16)');
            b.fillRect(16,55,42,29,'#23572c');b.fillRect(8,64,29,19,'#2f7438');b.fillRect(36,61,29,22,'#3a8440');
            b.fillRect(20,51,12,11,'#55a04a');b.fillRect(46,53,11,10,'#5dac50');
            b.fillRect(30,62,4,4,'#d88642');b.fillRect(49,67,4,4,'#e8b64c');
        }
        if(b._baseTexture&&window.PIXI)b._baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;
        W.nodeBitmapCache[type]=b;return b;
    };

    function Sprite_CamutangaNode(node){this.initialize.apply(this,arguments);}
    Sprite_CamutangaNode.prototype=Object.create(Sprite.prototype);
    Sprite_CamutangaNode.prototype.constructor=Sprite_CamutangaNode;
    Sprite_CamutangaNode.prototype.initialize=function(node){
        Sprite.prototype.initialize.call(this);this._node=node;this.bitmap=W.nodeBitmap(node.type);this.anchor.x=0.5;this.anchor.y=1;this.z=3;this._baseRotation=0;
    };
    Sprite_CamutangaNode.prototype.update=function(){
        Sprite.prototype.update.call(this);var n=this._node;if(!n||!$gameMap){this.visible=false;return;}
        if(!n.alive&&Number(n.fallTimer||0)<=0){this.visible=false;return;}this.visible=true;
        var tw=$gameMap.tileWidth(),th=$gameMap.tileHeight();
        this.x=Math.round($gameMap.adjustX(n.x)*tw+tw/2);this.y=Math.round($gameMap.adjustY(n.y)*th+th);
        if(n.shake>0){n.shake--;this.x+=(n.shake%2?3:-3);} 
        if(!n.alive&&n.fallTimer>0){n.fallTimer--;this.rotation=(34-n.fallTimer)/34*1.18;this.opacity=Math.max(0,255-n.fallTimer<8?(n.fallTimer*32):255);}else{this.rotation=0;this.opacity=255;}
    };

    function Sprite_CamutangaDrop(drop){this.initialize.apply(this,arguments);}
    Sprite_CamutangaDrop.prototype=Object.create(Sprite.prototype);
    Sprite_CamutangaDrop.prototype.constructor=Sprite_CamutangaDrop;
    Sprite_CamutangaDrop.prototype.initialize=function(drop){
        Sprite.prototype.initialize.call(this);this._drop=drop;this.bitmap=ImageManager.loadSystem('IconSet');this.anchor.x=0.5;this.anchor.y=0.72;this.z=5;this.scale.x=0.82;this.scale.y=0.82;
        var it=$dataItems&&$dataItems[drop.itemId],idx=it?it.iconIndex:0,pw=Window_Base._iconWidth||32,ph=Window_Base._iconHeight||32;
        this.setFrame(idx%16*pw,Math.floor(idx/16)*ph,pw,ph);
    };
    Sprite_CamutangaDrop.prototype.update=function(){
        Sprite.prototype.update.call(this);var d=this._drop;if(!d||d.collected||!$gameMap){this.visible=false;return;}this.visible=true;
        var tw=$gameMap.tileWidth(),th=$gameMap.tileHeight();
        this.x=Math.round($gameMap.adjustX(d.tx+d.ox)*tw+tw/2);this.y=Math.round($gameMap.adjustY(d.ty+d.oy)*th+th/2-5+Math.sin(Graphics.frameCount/10+Number(String(d.id).replace(/\D/g,'')))*4);
        this.rotation=Math.sin(Graphics.frameCount/18)*0.07;
    };

    var _Spriteset_Map_createCharacters=Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters=function(){
        _Spriteset_Map_createCharacters.call(this);
        this._camutangaNodeSprites={};this._camutangaDropSprites={};
        W.ensureNodes($gameMap.mapId());
        this.syncCamutangaWorld(true);
    };
    Spriteset_Map.prototype.syncCamutangaWorld=function(force){
        if(!this._tilemap||!$gameMap)return;
        var self=this,nodes=W.nodeState($gameMap.mapId()),drops=W.dropState($gameMap.mapId());
        nodes.forEach(function(n){
            if((n.alive||n.fallTimer>0)&&!self._camutangaNodeSprites[n.id]){
                var sp=new Sprite_CamutangaNode(n);self._camutangaNodeSprites[n.id]=sp;self._tilemap.addChild(sp);
            }
        });
        Object.keys(this._camutangaNodeSprites).forEach(function(id){var sp=self._camutangaNodeSprites[id];if(!sp._node.alive&&Number(sp._node.fallTimer||0)<=0){self._tilemap.removeChild(sp);delete self._camutangaNodeSprites[id];}});
        drops.forEach(function(d){if(!d.collected&&!self._camutangaDropSprites[d.id]){var sp=new Sprite_CamutangaDrop(d);self._camutangaDropSprites[d.id]=sp;self._tilemap.addChild(sp);}});
        Object.keys(this._camutangaDropSprites).forEach(function(id){var sp=self._camutangaDropSprites[id];if(sp._drop.collected){self._tilemap.removeChild(sp);delete self._camutangaDropSprites[id];}});
    };

    // Atmosfera de neblina/vendaval/seca desenhada sem arquivos externos.
    function Sprite_CamutangaAtmosphere(){this.initialize.apply(this,arguments);}
    Sprite_CamutangaAtmosphere.prototype=Object.create(Sprite.prototype);
    Sprite_CamutangaAtmosphere.prototype.constructor=Sprite_CamutangaAtmosphere;
    Sprite_CamutangaAtmosphere.prototype.initialize=function(){
        Sprite.prototype.initialize.call(this);this.bitmap=new Bitmap(Graphics.boxWidth,Graphics.boxHeight);this._mode='';this._particles=[];
        for(var i=0;i<22;i++){var s=new Sprite(new Bitmap(7,4));s.bitmap.fillRect(0,0,7,4,'rgba(206,183,117,0.72)');s.x=Math.random()*Graphics.boxWidth;s.y=Math.random()*Graphics.boxHeight;s._sx=2+Math.random()*4;s._sy=-0.2+Math.random()*0.7;s.visible=false;this._particles.push(s);this.addChild(s);}
    };
    Sprite_CamutangaAtmosphere.prototype.mode=function(){
        if(!W.isOutdoor())return 'none';var d=W.activeDisaster();if(d){if(d.type==='wind')return 'wind';if(d.type==='drought')return 'drought';if(d.type==='flood')return 'flood';}
        return W.currentWeather()==='fog'?'fog':'none';
    };
    Sprite_CamutangaAtmosphere.prototype.redraw=function(mode){
        this.bitmap.clear();
        if(mode==='fog'){this.bitmap.fillRect(0,0,Graphics.boxWidth,Graphics.boxHeight,'rgba(218,225,217,0.17)');for(var y=70;y<Graphics.boxHeight;y+=135)this.bitmap.fillRect(0,y,Graphics.boxWidth,48,'rgba(235,240,233,0.055)');}
        else if(mode==='drought')this.bitmap.fillRect(0,0,Graphics.boxWidth,Graphics.boxHeight,'rgba(205,154,74,0.08)');
        else if(mode==='flood')this.bitmap.fillRect(0,Graphics.boxHeight*0.72,Graphics.boxWidth,Graphics.boxHeight*0.28,'rgba(76,145,178,0.09)');
        for(var i=0;i<this._particles.length;i++)this._particles[i].visible=(mode==='wind'||mode==='drought');
    };
    Sprite_CamutangaAtmosphere.prototype.update=function(){
        Sprite.prototype.update.call(this);var mode=this.mode();if(mode!==this._mode){this._mode=mode;this.redraw(mode);} 
        if(mode==='wind'||mode==='drought')for(var i=0;i<this._particles.length;i++){var p=this._particles[i];p.x+=p._sx*(mode==='wind'?1.8:0.7);p.y+=p._sy;if(p.x>Graphics.boxWidth+15){p.x=-15;p.y=Math.random()*Graphics.boxHeight;}};
        if(mode==='fog')this.opacity=195+Math.sin(Graphics.frameCount/80)*35;else this.opacity=255;
    };

    var _Scene_Map_createDisplayObjects=Scene_Map.prototype.createDisplayObjects;
    Scene_Map.prototype.createDisplayObjects=function(){
        _Scene_Map_createDisplayObjects.call(this);
        this._camutangaAtmosphere=new Sprite_CamutangaAtmosphere();
        var idx=this._windowLayer?this.getChildIndex(this._windowLayer):this.children.length;
        this.addChildAt(this._camutangaAtmosphere,Math.max(0,idx));
    };

    W.applyDisasterToCurrentMap=function(){
        var d=W.activeDisaster();if(!d||!$gameMap||!W.isOutdoor())return;
        var st=W.state(),mark=d.id+':'+$gameMap.mapId();if(st.disasterMarks[mark])return;st.disasterMarks[mark]=true;
        if(d.type==='landslide'){
            var arr=W.nodeState($gameMap.mapId()),rng=W.makeRng((st.seed+$gameMap.mapId()*53+Number(d.startRaw||0))>>>0),made=0;
            for(var tries=0;tries<120&&made<7;tries++){
                var x=2+Math.floor(rng()*Math.max(1,$gameMap.width()-4)),y=2+Math.floor(rng()*Math.max(1,$gameMap.height()-4));
                if(!W.goodNodeTile(x,y,$gameMap.mapId())||W.nodeAt($gameMap.mapId(),x,y))continue;
                arr.push({id:'land_'+d.id+'_'+made,x:x,y:y,type:'rock',hp:2,maxHp:2,alive:true,regrowDay:C.dayKey()+1,shake:0,fallTimer:0});made++;
            }
        }
    };

    W.spawnWindDrop=function(){
        if(!$gamePlayer||!$gameMap)return;
        var ids=[59,59,54,66,67,68],id=ids[Math.floor(Math.random()*ids.length)];
        for(var tries=0;tries<12;tries++){
            var x=$gamePlayer.x-3+Math.floor(Math.random()*7),y=$gamePlayer.y-3+Math.floor(Math.random()*7);
            if(W.goodNodeTile(x,y,$gameMap.mapId())&&!W.nodeAt($gameMap.mapId(),x,y)){W.spawnDrop(id,x,y,1);return;}
        }
    };

    W.spawnResourceBurst=function(){
        if(!$gameMap||!W.isOutdoor())return;
        var arr=W.nodeState($gameMap.mapId()),types=['tree','rock','bush','bush'],made=0;
        for(var r=1;r<=8&&made<6;r++)for(var dx=-r;dx<=r&&made<6;dx++)for(var dy=-r;dy<=r&&made<6;dy++){
            if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;var x=$gamePlayer.x+dx,y=$gamePlayer.y+dy;
            if(W.goodNodeTile(x,y,$gameMap.mapId())&&!W.nodeAt($gameMap.mapId(),x,y)){var type=types[made%types.length],hp=W.nodeHp(type);arr.push({id:'dev_'+Graphics.frameCount+'_'+made,x:x,y:y,type:type,hp:hp,maxHp:hp,alive:true,regrowDay:0,shake:0,fallTimer:0});made++;}
        }
        if(C.toast)C.toast('Recursos de teste gerados perto do jogador.',150);
    };

    var _Scene_Map_start=Scene_Map.prototype.start;
    Scene_Map.prototype.start=function(){
        _Scene_Map_start.call(this);
        W.onNewDay(C.dayKey());W.ensureNodes($gameMap.mapId());W.ensureStarterTools();W.applyDisasterToCurrentMap();W.applyEnvironment(true);
        if(this._spriteset&&this._spriteset.syncCamutangaWorld)this._spriteset.syncCamutangaWorld(true);
    };

    var _Scene_Map_update=Scene_Map.prototype.update;
    Scene_Map.prototype.update=function(){
        _Scene_Map_update.call(this);
        if(!$gameMap||!$gamePlayer)return;
        W.onNewDay(C.dayKey());
        if(Graphics.frameCount%20===0)W.applyEnvironment(false);
        if(Graphics.frameCount%10===0&&this._spriteset&&this._spriteset.syncCamutangaWorld)this._spriteset.syncCamutangaWorld(false);
        W.autoPickup();
        var d=W.activeDisaster();
        if(d&&W.isOutdoor()){
            if(d.type==='storm'&&Math.random()<0.0035&&$gameScreen){$gameScreen.startFlash([255,255,255,170],18);$gameScreen.startShake(3,5,22);}
            if(d.type==='wind'){
                var raw=C.gameClock().raw,st=W.state();if(raw-st.lastWindDropRaw>=22){st.lastWindDropRaw=raw;W.spawnWindDrop();}
            }
        }
    };

    // Exporta classes para debug e extensões futuras.
    window.Sprite_CamutangaNode=Sprite_CamutangaNode;
    window.Sprite_CamutangaDrop=Sprite_CamutangaDrop;
})();

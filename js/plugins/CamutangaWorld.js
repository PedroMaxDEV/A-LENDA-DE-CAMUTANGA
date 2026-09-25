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
    W.VERSION = '2.5.0';

    W.OUTDOOR_MAPS = [2,5,7,8,9,11,14,15,16,25,26];
    // Vegetação procedural mais densa. Ela é persistente por save e volta a crescer.
    W.NODE_MAPS = {
        5:  { tree:18, rock:8, bush:14 },
        25: { tree:4, rock:24, bush:5 },
        26: { tree:36, rock:12, bush:28 },
        2:  { tree:8, rock:3, bush:8 },
        7:  { tree:10, rock:4, bush:10 },
        8:  { tree:7, rock:3, bush:8 },
        9:  { tree:6, rock:5, bush:8 },
        11: { tree:7, rock:3, bush:8 },
        14: { tree:8, rock:4, bush:9 },
        15: { tree:10, rock:5, bush:10 },
        16: { tree:9, rock:4, bush:9 }
    };
    W.NODE_GENERATION_VERSION = 2;

    W.WEATHER_NAMES = {
        clear:'Ensolarado', cloudy:'Nublado', rain:'Chuva', storm:'Tempestade', fog:'Neblina'
    };
    W.DISASTER_NAMES = {
        storm:'Temporal severo', flood:'Enchente', wind:'Vendaval', landslide:'Deslizamento', drought:'Seca forte', quake:'Terremoto'
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
        var defaults={storm:180,flood:300,wind:210,landslide:300,drought:720,quake:90};
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

    W.nodeHp = function(type) { return type==='tree'?12:type==='rock'?10:3; };

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


    // =====================================================================
    // v2.5 — CAMUTANGA SELVAGEM
    // =====================================================================

    // IDs de árvores de 1 tile do Outside_B. Estas deixam de ser mero
    // cenário: podem ser cortadas diretamente no mapa. O ID 182 é o pinheiro
    // muito usado na Base do Jogador. Outros IDs cobrem palmeiras/árvores
    // simples do tileset Outside.
    W.STATIC_TREE_TILE_IDS = {92:1,93:1,104:1,181:1,182:1,197:1,198:1};
    W.STATIC_TREE_HP = 14;
    W.TREE_REGION_ID = 20; // opcional: marque troncos com Região 20 no RPG Maker.

    W.ensureV25State=function(){
        var st=W.state(); if(!st)return null;
        if(!st.nodeVersions)st.nodeVersions={};
        if(!st.staticVegetation)st.staticVegetation={};
        if(!st.disasterCounters)st.disasterCounters={};
        return st;
    };

    // Regera uma camada mais rica de vegetação procedural uma única vez por
    // versão do gerador, inclusive em saves antigos da V2.4.
    var _W_ensureNodes_v24=W.ensureNodes;
    W.ensureNodes=function(mapId){
        mapId=Number(mapId||($gameMap?$gameMap.mapId():0));
        var st=W.ensureV25State();
        if(!st||!W.NODE_MAPS[mapId]||!$gameMap)return _W_ensureNodes_v24.call(W,mapId);
        var key=String(mapId);
        if(Number(st.nodeVersions[key]||0)===W.NODE_GENERATION_VERSION && W.nodeState(mapId).length)return;

        // Preserva apenas formações de desastre; os nós comuns são recriados.
        var arr=W.nodeState(mapId).filter(function(n){return String(n.id||'').indexOf('land_')===0||String(n.id||'').indexOf('quake_')===0;});
        st.nodes[key]=arr;
        var cfg=W.NODE_MAPS[mapId],types=[];
        Object.keys(cfg).forEach(function(type){for(var i=0;i<cfg[type];i++)types.push(type);});
        var rng=W.makeRng((st.seed+mapId*9719+W.NODE_GENERATION_VERSION*731)>>>0),tries=0,index=0;
        while(index<types.length&&tries<types.length*180){
            tries++;
            var x=2+Math.floor(rng()*Math.max(1,$gameMap.width()-4));
            var y=2+Math.floor(rng()*Math.max(1,$gameMap.height()-4));
            if(!W.goodNodeTile(x,y,mapId))continue;
            var tooClose=arr.some(function(n){return n.alive&&Math.abs(n.x-x)+Math.abs(n.y-y)<=1;});
            if(tooClose)continue;
            var type=types[index++],hp=W.nodeHp(type);
            arr.push({id:'n'+mapId+'_v'+W.NODE_GENERATION_VERSION+'_'+index,x:x,y:y,type:type,hp:hp,maxHp:hp,alive:true,regrowDay:0,shake:0,fallTimer:0,variant:Math.floor(rng()*3)});
        }
        st.nodeVersions[key]=W.NODE_GENERATION_VERSION;
    };

    W.resetGeneratedVegetation=function(){
        var st=W.ensureV25State();if(!st||!$gameMap)return;
        var key=String($gameMap.mapId());st.nodeVersions[key]=0;st.nodes[key]=[];W.ensureNodes($gameMap.mapId());
        var scene=SceneManager._scene;if(scene&&scene._spriteset&&scene._spriteset.syncCamutangaWorld)scene._spriteset.syncCamutangaWorld(true);
        if(C.toast)C.toast('Vegetação procedural regenerada.',140);
    };

    W.refreshTilemap=function(){
        var scene=SceneManager._scene,ss=scene&&scene._spriteset;
        if(ss&&ss._tilemap&&ss._tilemap.refresh)ss._tilemap.refresh();
    };

    W.staticVegMap=function(mapId){
        var st=W.ensureV25State(),key=String(mapId);
        if(!st.staticVegetation[key])st.staticVegetation[key]={};
        return st.staticVegetation[key];
    };

    W.mapTile=function(x,y,z){
        if(!$dataMap||!$dataMap.data)return 0;
        var w=$dataMap.width,h=$dataMap.height;
        return Number($dataMap.data[x+y*w+z*w*h]||0);
    };
    W.setMapTile=function(x,y,z,id){
        if(!$dataMap||!$dataMap.data)return;
        var w=$dataMap.width,h=$dataMap.height;
        $dataMap.data[x+y*w+z*w*h]=Number(id||0);
    };

    W.findStaticTree=function(x,y){
        if(!$gameMap||!$dataMap||!$gameMap.isValid(x,y))return null;
        var tilesetId=$gameMap.tilesetId?$gameMap.tilesetId():$dataMap.tilesetId;
        // A identificação automática abaixo foi feita para o tileset Outside.
        for(var z=3;z>=1;z--){
            var id=W.mapTile(x,y,z);
            if(tilesetId===2&&W.STATIC_TREE_TILE_IDS[id])return {x:x,y:y,z:z,tileId:id};
        }
        // Região 20 serve como escape para o usuário marcar qualquer tronco
        // manualmente no RPG Maker, mesmo em outros tilesets.
        if($gameMap.regionId&&$gameMap.regionId(x,y)===W.TREE_REGION_ID){
            for(var zz=3;zz>=1;zz--){var tid=W.mapTile(x,y,zz);if(tid)return{x:x,y:y,z:zz,tileId:tid,region:true};}
        }
        return null;
    };

    W.staticTreeRecord=function(info){
        var mp=W.staticVegMap($gameMap.mapId()),key=info.x+':'+info.y+':'+info.z;
        var r=mp[key];
        if(!r){
            r=mp[key]={x:info.x,y:info.y,z:info.z,originalTileId:info.tileId,hp:W.STATIC_TREE_HP,maxHp:W.STATIC_TREE_HP,alive:true,regrowDay:0};
        }
        return r;
    };

    W.applyStaticVegetation=function(){
        if(!$gameMap||!$dataMap)return;
        var mp=W.staticVegMap($gameMap.mapId()),day=C.dayKey?C.dayKey():0,changed=false;
        Object.keys(mp).forEach(function(k){
            var r=mp[k];
            if(!r)return;
            if(!r.alive&&day>=Number(r.regrowDay||999999)){
                r.alive=true;r.hp=r.maxHp||W.STATIC_TREE_HP;
                W.setMapTile(r.x,r.y,r.z,r.originalTileId);changed=true;
            }else if(!r.alive){
                // No tileset Outside, 180 é um toco. Em outros tilesets apenas
                // removemos o objeto para não colocar uma imagem errada.
                var replacement=($gameMap.tilesetId&&$gameMap.tilesetId()===2)?180:0;
                W.setMapTile(r.x,r.y,r.z,replacement);changed=true;
            }
        });
        if(changed)W.refreshTilemap();
    };

    W.destroyStaticTree=function(r){
        r.alive=false;r.hp=0;r.regrowDay=C.dayKey()+5;
        var replacement=($gameMap.tilesetId&&$gameMap.tilesetId()===2)?180:0;
        W.setMapTile(r.x,r.y,r.z,replacement);W.refreshTilemap();
        var fake={type:'tree',x:r.x,y:r.y};
        var drops=W.nodeDrops(fake);for(var i=0;i<drops.length;i++)W.spawnDrop(drops[i],r.x,r.y,1);
        if(C.gainSkillXp)C.gainSkillXp('gathering',24);
        if(C.toast)C.toast('A árvore do mapa caiu! O toco fica até ela crescer novamente.',180);
        W.playWorldSfx('treeFall');
        if($gameScreen)$gameScreen.startShake(3,5,24);
    };

    W.tryStaticTreeAction=function(){
        if(!$gameMap||!W.isOutdoor())return false;
        var p=C.frontTile(),info=W.findStaticTree(p.x,p.y);if(!info)return false;
        var r=W.staticTreeRecord(info);
        if(!r.alive)return false;
        if(!C.hasTool||!C.hasTool('axe')){SoundManager.playBuzzer();if(C.toast)C.toast('Essa árvore precisa de um Machado.',100);return true;}
        if(C.spendStamina&&!C.spendStamina(3))return true;
        if(C.setHeroPose)C.setHeroPose('axe',48);
        r.hp=Math.max(0,Number(r.hp||r.maxHp)-1);
        W.playWorldSfx('woodHit');
        if($gameScreen)$gameScreen.startShake(1,5,8);
        if(r.hp<=0)W.destroyStaticTree(r);
        else if(C.toast)C.toast('Árvore resistente: '+r.hp+'/'+r.maxHp,55);
        return true;
    };

    var _W_tryResourceAction_v24=W.tryResourceAction;
    W.tryResourceAction=function(){
        if(W.tryStaticTreeAction())return true;
        return _W_tryResourceAction_v24.call(W);
    };

    // Sons procedurais: funcionam sem arquivos externos. Depois o usuário pode
    // baixar OGG/M4A e ativar o modo de áudio customizado no topo desta seção.
    W.USE_CUSTOM_DISASTER_AUDIO=true;
    W.CUSTOM_SE={
        thunder:'Camutanga_Thunder', wind:'Camutanga_WindGust', flood:'Camutanga_Flood',
        landslide:'Camutanga_Landslide', drought:'Camutanga_DryWind', quake:'Camutanga_Quake',
        woodHit:'Camutanga_WoodHit', treeFall:'Camutanga_TreeFall', rockHit:'Camutanga_RockHit'
    };
    W._audioCtx=null;
    W.audioContext=function(){
        try{
            var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
            if(!W._audioCtx)W._audioCtx=new AC();
            if(W._audioCtx.state==='suspended')W._audioCtx.resume();
            return W._audioCtx;
        }catch(e){return null;}
    };
    W.noiseBurst=function(duration,gain,lowpass){
        var ctx=W.audioContext();if(!ctx)return;
        duration=Math.max(.03,Number(duration||.2));
        var len=Math.max(1,Math.floor(ctx.sampleRate*duration)),buf=ctx.createBuffer(1,len,ctx.sampleRate),a=buf.getChannelData(0);
        for(var i=0;i<len;i++)a[i]=(Math.random()*2-1)*(1-i/len);
        var src=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=lowpass||800;
        g.gain.setValueAtTime(Math.max(.001,gain||.05),ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
        src.buffer=buf;src.connect(f);f.connect(g);g.connect(ctx.destination);src.start();
    };
    W.toneBurst=function(freq,duration,gain,type){
        var ctx=W.audioContext();if(!ctx)return;var o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';o.frequency.value=freq||80;
        g.gain.setValueAtTime(Math.max(.001,gain||.04),ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);
        o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration);
    };
    W.playWorldSfx=function(kind){
        if(W.USE_CUSTOM_DISASTER_AUDIO&&W.CUSTOM_SE[kind]&&window.AudioManager){
            AudioManager.playSe({name:W.CUSTOM_SE[kind],volume:82,pitch:100,pan:0});return;
        }
        if(kind==='thunder'){W.noiseBurst(1.25,.18,420);W.toneBurst(46,1.1,.10,'sine');}
        else if(kind==='wind'){W.noiseBurst(.85,.09,1100);}
        else if(kind==='flood'){W.noiseBurst(1.3,.08,700);W.toneBurst(90,.5,.025,'sine');}
        else if(kind==='landslide'){W.noiseBurst(1.2,.14,520);W.toneBurst(58,.8,.07,'triangle');}
        else if(kind==='quake'){W.noiseBurst(1.5,.16,300);W.toneBurst(38,1.4,.11,'sine');}
        else if(kind==='drought'){W.noiseBurst(.9,.045,1600);}
        else if(kind==='woodHit'){W.noiseBurst(.09,.07,520);W.toneBurst(130,.07,.035,'triangle');}
        else if(kind==='treeFall'){W.noiseBurst(.7,.14,420);W.toneBurst(62,.5,.07,'triangle');}
        else if(kind==='rockHit'){W.noiseBurst(.08,.06,1600);W.toneBurst(260,.10,.03,'square');}
    };

    // Ferramentas e recursos agora são bem mais resistentes e têm feedback.
    var _W_tryGeneratedResourceAction_v25=_W_tryResourceAction_v24;
    // O wrapper já chama a função antiga; adicionamos som através da leitura da
    // pose/objeto logo após o dano usando um pequeno hook em destroyNode e ação.
    var _W_destroyNode_v24=W.destroyNode;
    W.destroyNode=function(node){
        _W_destroyNode_v24.call(W,node);
        W.playWorldSfx(node.type==='tree'?'treeFall':node.type==='rock'?'landslide':'woodHit');
        if($gameScreen)$gameScreen.startShake(node.type==='tree'?3:2,5,node.type==='tree'?24:14);
    };

    // Penalidade real da seca: qualquer atividade externa consome +50% energia.
    if(C.spendStamina){
        var _C_spendStamina_v25=C.spendStamina;
        C.spendStamina=function(amount){
            var d=W.activeDisaster();
            if(d&&d.type==='drought'&&W.isOutdoor())amount=Math.ceil(Number(amount||0)*1.5);
            return _C_spendStamina_v25.call(C,amount);
        };
    }

    W.damageRandomTrees=function(amount,count){
        if(!$gameMap)return;var arr=W.nodeState($gameMap.mapId()).filter(function(n){return n.alive&&n.type==='tree';});
        for(var i=0;i<count&&arr.length;i++){
            var idx=Math.floor(Math.random()*arr.length),n=arr.splice(idx,1)[0];n.hp=Math.max(0,n.hp-amount);n.shake=28;
            if(n.hp<=0)W.destroyNode(n);
        }
    };

    W.spawnHazardRock=function(prefix){
        if(!$gameMap||!W.isOutdoor())return false;var arr=W.nodeState($gameMap.mapId());
        for(var tries=0;tries<50;tries++){
            var r=5+Math.floor(Math.random()*9),ang=Math.random()*Math.PI*2;
            var x=Math.round($gamePlayer.x+Math.cos(ang)*r),y=Math.round($gamePlayer.y+Math.sin(ang)*r);
            if(!W.goodNodeTile(x,y,$gameMap.mapId())||W.nodeAt($gameMap.mapId(),x,y))continue;
            var hp=14;arr.push({id:(prefix||'haz_')+Graphics.frameCount+'_'+tries,x:x,y:y,type:'rock',hp:hp,maxHp:hp,alive:true,regrowDay:C.dayKey()+2,shake:22,fallTimer:0,variant:2});return true;
        }
        return false;
    };

    // Versão forte dos desastres: agora cada um altera o mapa/jogabilidade.
    W.applyDisasterToCurrentMap=function(){
        var d=W.activeDisaster();if(!d||!$gameMap||!W.isOutdoor())return;
        var st=W.ensureV25State(),mark='v25:'+d.id+':'+$gameMap.mapId();if(st.disasterMarks[mark])return;st.disasterMarks[mark]=true;
        var i;
        if(d.type==='landslide'){
            for(i=0;i<14;i++)W.spawnHazardRock('land_'+d.id+'_');
            W.playWorldSfx('landslide');if($gameScreen)$gameScreen.startShake(7,7,150);
        }else if(d.type==='quake'){
            for(i=0;i<10;i++)W.spawnHazardRock('quake_'+d.id+'_');
            W.damageRandomTrees(4,6);W.playWorldSfx('quake');if($gameScreen)$gameScreen.startShake(9,8,220);
        }else if(d.type==='wind'){
            W.damageRandomTrees(3,5);for(i=0;i<7;i++)W.spawnWindDrop();W.playWorldSfx('wind');
        }else if(d.type==='flood'){
            for(i=0;i<8;i++)W.spawnWindDrop();W.playWorldSfx('flood');if($gameScreen)$gameScreen.startShake(2,4,70);
        }else if(d.type==='storm'){
            W.damageRandomTrees(2,3);W.playWorldSfx('thunder');if($gameScreen){$gameScreen.startFlash([255,255,255,220],32);$gameScreen.startShake(5,6,60);}
        }else if(d.type==='drought'){
            // Plantações ficam sem irrigação quando a seca começa.
            var s=C.state();Object.keys(s.plots||{}).forEach(function(mid){var mp=s.plots[mid]||{};Object.keys(mp).forEach(function(k){if(mp[k])mp[k].wateredDay=-99999;});});
            // Parte dos arbustos seca até o próximo dia.
            W.nodeState($gameMap.mapId()).forEach(function(n){if(n.type==='bush'&&n.alive&&Math.random()<0.45){n.alive=false;n.regrowDay=C.dayKey()+1;n.fallTimer=12;}});
            W.playWorldSfx('drought');
        }
    };

    var _W_startDisaster_v24=W.startDisaster;
    W.startDisaster=function(type,durationMinutes){
        _W_startDisaster_v24.call(W,type,durationMinutes);
        W.applyDisasterToCurrentMap();
    };

    // Visual mais agressivo para enchente / deslizamento / terremoto / temporal.
    var _Atmo_mode_v24=Sprite_CamutangaAtmosphere.prototype.mode;
    Sprite_CamutangaAtmosphere.prototype.mode=function(){
        if(!W.isOutdoor())return 'none';var d=W.activeDisaster();if(d)return d.type;
        return _Atmo_mode_v24.call(this);
    };
    Sprite_CamutangaAtmosphere.prototype.redraw=function(mode){
        var b=this.bitmap;b.clear();
        if(mode==='fog'){
            b.fillRect(0,0,Graphics.boxWidth,Graphics.boxHeight,'rgba(218,225,217,0.18)');
            for(var y=55;y<Graphics.boxHeight;y+=120)b.fillRect(0,y,Graphics.boxWidth,54,'rgba(235,240,233,0.06)');
        }else if(mode==='drought'){
            b.fillRect(0,0,Graphics.boxWidth,Graphics.boxHeight,'rgba(216,154,56,0.14)');
            for(var h=120;h<Graphics.boxHeight;h+=75)b.fillRect(0,h,Graphics.boxWidth,2,'rgba(255,215,115,0.08)');
        }else if(mode==='flood'){
            var start=Math.floor(Graphics.boxHeight*0.50);
            b.fillRect(0,start,Graphics.boxWidth,Graphics.boxHeight-start,'rgba(42,126,171,0.27)');
            for(var fy=start+8;fy<Graphics.boxHeight;fy+=24)b.fillRect(0,fy,Graphics.boxWidth,3,'rgba(161,225,235,0.16)');
        }else if(mode==='landslide'||mode==='quake'){
            b.fillRect(0,0,Graphics.boxWidth,Graphics.boxHeight,mode==='quake'?'rgba(112,87,62,0.10)':'rgba(132,91,52,0.15)');
        }else if(mode==='storm'){
            b.fillRect(0,0,Graphics.boxWidth,Graphics.boxHeight,'rgba(18,31,42,0.14)');
        }
        var particles=(mode==='wind'||mode==='drought'||mode==='landslide'||mode==='quake');
        for(var i=0;i<this._particles.length;i++){
            var p=this._particles[i];p.visible=particles;
            if(mode==='landslide'||mode==='quake')p.bitmap.fillRect(0,0,7,4,'rgba(151,111,72,0.82)');
            else p.bitmap.fillRect(0,0,7,4,'rgba(206,183,117,0.72)');
        }
    };
    Sprite_CamutangaAtmosphere.prototype.update=function(){
        Sprite.prototype.update.call(this);var mode=this.mode();if(mode!==this._mode){this._mode=mode;this.redraw(mode);}
        if(mode==='wind'||mode==='drought'||mode==='landslide'||mode==='quake'){
            for(var i=0;i<this._particles.length;i++){
                var p=this._particles[i],mul=mode==='wind'?2.5:mode==='quake'?1.6:mode==='landslide'?1.25:0.8;
                p.x+=p._sx*mul;p.y+=p._sy+(mode==='landslide'?1.2:mode==='quake'?0.6:0);
                if(p.x>Graphics.boxWidth+20||p.y>Graphics.boxHeight+20){p.x=-20;p.y=Math.random()*Graphics.boxHeight;}
            }
        }
        if(mode==='fog')this.opacity=195+Math.sin(Graphics.frameCount/75)*40;
        else if(mode==='flood'){this.opacity=225+Math.sin(Graphics.frameCount/25)*25;this.y=Math.sin(Graphics.frameCount/28)*2;}
        else this.opacity=255;
    };

    W.updateDisasterV25=function(){
        var d=W.activeDisaster();if(!d||!W.isOutdoor()||!$gamePlayer)return;
        var st=W.ensureV25State(),key=d.id+':'+$gameMap.mapId(),c=st.disasterCounters[key]||(st.disasterCounters[key]={last:-9999,tick:0});c.tick++;
        if(d.type==='storm'&&c.tick%210===0){
            W.playWorldSfx('thunder');if($gameScreen){$gameScreen.startFlash([255,255,255,235],28);$gameScreen.startShake(5,7,45);}W.damageRandomTrees(2,1);
        }else if(d.type==='wind'&&c.tick%150===0){
            W.playWorldSfx('wind');if($gameScreen)$gameScreen.startShake(2,6,35);W.spawnWindDrop();
            var s=C.state();s.stamina=Math.max(0,Number(s.stamina||0)-1);
        }else if(d.type==='flood'&&c.tick%240===0){
            W.playWorldSfx('flood');var s2=C.state();s2.stamina=Math.max(0,Number(s2.stamina||0)-1);
            if(C.toast&&c.tick%480===0)C.toast('A correnteza está cansando você.',90);
        }else if(d.type==='landslide'&&c.tick%180===0){
            W.playWorldSfx('landslide');if($gameScreen)$gameScreen.startShake(4,6,50);if(Math.random()<0.55)W.spawnHazardRock('slide_live_');
        }else if(d.type==='quake'&&c.tick%55===0){
            W.playWorldSfx('quake');if($gameScreen)$gameScreen.startShake(8,8,55);if(c.tick%165===0)W.spawnHazardRock('quake_live_');
        }else if(d.type==='drought'&&c.tick%300===0){
            W.playWorldSfx('drought');var s3=C.state();s3.stamina=Math.max(0,Number(s3.stamina||0)-1);
        }
    };

    // Faz o impacto de machado/picareta ter som mesmo antes do nó quebrar.
    var _W_tryResourceAction_afterStatic=W.tryResourceAction;
    W.tryResourceAction=function(){
        if(!$gameMap||!W.isOutdoor())return false;
        var p=C.frontTile(),staticInfo=W.findStaticTree(p.x,p.y);
        if(staticInfo)return W.tryStaticTreeAction();
        W.ensureNodes($gameMap.mapId());
        var node=W.nodeAt($gameMap.mapId(),p.x,p.y);
        if(!node)return false;
        var need=W.requiredTool(node.type);
        if(need&&(!C.hasTool||!C.hasTool(need))){SoundManager.playBuzzer();if(C.toast)C.toast(need==='axe'?'Você precisa de um Machado.':'Você precisa de uma Picareta.',120);return true;}
        var cost=node.type==='bush'?1:3;if(C.spendStamina&&!C.spendStamina(cost))return true;
        if(C.setHeroPose)C.setHeroPose(W.poseForNode(node.type),48);
        node.shake=24;node.hp=Math.max(0,Number(node.hp||1)-1);
        W.playWorldSfx(node.type==='rock'?'rockHit':'woodHit');
        if(node.hp<=0)W.destroyNode(node);
        else if(C.toast)C.toast((node.type==='tree'?'Toc! ':node.type==='rock'?'CLANG! ':'')+'Resistência '+node.hp+'/'+node.maxHp,55);
        return true;
    };

    // Atualizações adicionais e aplicação da vegetação estática ao entrar no mapa.
    var _Scene_Map_start_v25=Scene_Map.prototype.start;
    Scene_Map.prototype.start=function(){
        _Scene_Map_start_v25.call(this);W.ensureV25State();W.ensureNodes($gameMap.mapId());W.applyStaticVegetation();W.applyDisasterToCurrentMap();
        if(this._spriteset&&this._spriteset.syncCamutangaWorld)this._spriteset.syncCamutangaWorld(true);
    };
    var _Scene_Map_update_v25=Scene_Map.prototype.update;
    Scene_Map.prototype.update=function(){
        _Scene_Map_update_v25.call(this);W.updateDisasterV25();
    };

    // Regeneração também restaura árvores originais cortadas.
    var _W_onNewDay_v25=W.onNewDay;
    W.onNewDay=function(day){_W_onNewDay_v25.call(W,day);W.applyStaticVegetation();};

    // Exporta classes para debug e extensões futuras.
    window.Sprite_CamutangaNode=Sprite_CamutangaNode;
    window.Sprite_CamutangaDrop=Sprite_CamutangaDrop;
})();

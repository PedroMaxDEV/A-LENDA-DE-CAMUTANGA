/*:
 * @plugindesc [v1.0] Inventário Unificado - Junta todos os itens, armas e armaduras.
 * @author Pedro Max
 *
 * @help
 * ================================
 *       Inventário Unificado
 * ================================
 * - Pressione "Page Up" para abrir o inventário unificado.
 * - Exibe todos os itens, armas e armaduras juntos.
 * - Usa a cena padrão de itens do RPG Maker MV/MZ.
 *
 * ================================
 */

(function() {
    const openKey = 'pageup'; // Tecla para abrir o inventário

    // Verifica se a tecla foi pressionada
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        if (Input.isTriggered(openKey)) {
            SceneManager.push(Scene_UnifiedInventory);
        }
    };

    // Criando a cena de inventário unificado
    function Scene_UnifiedInventory() {
        this.initialize.apply(this, arguments);
    }

    Scene_UnifiedInventory.prototype = Object.create(Scene_Item.prototype);
    Scene_UnifiedInventory.prototype.constructor = Scene_UnifiedInventory;

    // Carrega todos os itens, armas e armaduras
    Scene_UnifiedInventory.prototype.makeItemList = function() {
        this._data = $gameParty.allItems(); // Junta todos os itens
        if (this.includes(null)) {
            this._data.push(null);
        }
    };
})();

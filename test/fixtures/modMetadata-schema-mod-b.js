/*:
 * @plugindesc Fixture - same schema name, different fields (isolation test)
 * @author test
 * @version V1.0.0
 *
 * @define-schema PositionSchema
 * [{"name":"z","type":"number","text":"Z","default":"99"}]
 *
 * @help
 * Schema isolation fixture B
 *
 * @param pos
 * @text 位置
 * @type struct
 * @schema PositionSchema
 */

(function() {})();

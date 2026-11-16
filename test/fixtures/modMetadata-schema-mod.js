/*:
 * @plugindesc Fixture - struct/table schema
 * @author test
 * @version V2.0.0
 *
 * @define-schema PositionSchema
 * [{"name":"x","type":"number","text":"X","default":"0","min":-10,"max":10},{"name":"y","type":"number","text":"Y","default":"0"}]
 *
 * @define-schema NestedNoteSchema
 * [{"name":"label","type":"string","text":"标签","default":"默认"},{"name":"body","type":"note","text":"正文","default":"行1\\n行2"}]
 *
 * @help
 * Schema fixture
 *
 * @param pos
 * @text 位置
 * @type struct
 * @schema PositionSchema
 *
 * @param rows
 * @text 行列表
 * @type table
 * @schema NestedNoteSchema
 */

(function() {})();

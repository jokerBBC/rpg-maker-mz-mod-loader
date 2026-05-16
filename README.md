# RMMZ Mod Loader

> 游戏内模组管理器 v3.13.0

一款功能强大的 RPG Maker MZ 模组管理器，支持在游戏内管理 Mod 的开启/关闭、参数编辑、排序等功能。

***

## ✨ 功能特性

| 功能              | 描述                                           |
| --------------- | -------------------------------------------- |
| 🎮 **游戏内管理**    | 无需开启额外程序或手动修改游戏的plugins.js文件，直接在游戏中管理 Mod    |
| ⚙️ **参数编辑**     | 支持数值、开关、文本、单选、颜色、长文本、数据库引用、struct结构体、table表格 |
| 📦 **拖放安装**     | 支持拖放 .js 文件或整个 mods 文件夹安装                    |
| 🔀 **排序管理**     | 支持拖拽排序和手动输入序号调整加载顺序                          |
| ⏸️ **一键全关**     | 可一次性关闭所有开启的 Mod                              |
| 🛡️ **安全保护**    | 未保存修改提示，防止误操作                                |
| 📊 **元数据显示**    | 显示 @version、@author、@base 等标签信息              |
| 🏷️ **@text别名** | 参数支持 `@text` 中文别名，友好显示                       |
| 📋 **Schema模板** | `@define-schema` 可复用模板系统，struct/table 通用定义   |

***
主界面
![软件主界面](js/mods/docs/img/主界面.png)

参数编辑界面
![软件主界面](js/mods/docs/img/参数界面-一般.png)

参数编辑界面-多层套娃
![软件主界面](js/mods/docs/img/参数界面-多级套娃.png)

参数编辑界面-表格
![软件主界面](js/mods/docs/img/参数界面-表格.png)

安装界面
![软件主界面](js/mods/docs/img/安装.png)

删除模式和排序模式
![软件主界面](js/mods/docs/img/排序与删除.png)


## 📥 安装方式

### 模式1：注入模式（推荐）

修改 `index.html`，在 `main.js` 之前注入 ModLoader：

```html
<body style="background-color: black">
<script type="text/javascript" src="js/libs/pixi.js"></script>
<!-- 注入 ModLoader -->
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
<script type="text/javascript" src="js/main.js"></script>
</body>
```

### 模式2：插件模式

在 RMMZ 插件管理器中将 `ModLoader.js` 添加到插件列表。

> ⚠️ 注意：修改 Mod 开关或排序后，需要 F5 刷新才能生效！

***

## 🎯 使用说明

1. 进入游戏后，点击屏幕左上角的 Mod 管理按钮
2. 在左侧列表中选择 Mod，右侧查看详情
3. 点击开关按钮启用/禁用 Mod
4. 点击齿轮图标编辑 Mod 参数（仅支持带有 ⚙ 标志的 Mod）
5. 修改完成后点击【保存配置】按钮

***

## 📁 项目结构

```
js/mods/
├── ModLoader.js                    # Mod管理器主文件
├── TestMod.js                      # 参数类型测试Mod
├── TestSchemaMod.js                # struct/table 功能测试Mod
├── mydrop.js                       # 实战Mod：怪物掉落物扩展
├── docs/                           # 文档目录
│   ├── README.md                   # 项目说明
│   └── modloader_CHANGELOG.md      # ModLoader更新日志
└── [你的Mod文件].js                # Mod插件
```

***

## 📖 开发资源

| 资源                            | 说明               |
| ----------------------------- | ---------------- |
| `docs/RMMZ_Mod开发规范.md`        | Mod 插件开发规范与流程    |
| `docs/RMMZ_ModLoader_开发规范.md` | ModLoader 自身开发规范 |
| `docs/modloader_CHANGELOG.md` | ModLoader 更新日志   |

***

## 📝 支持的参数类型

| 类型                                          | 说明        | 示例                        |
| ------------------------------------------- | --------- | ------------------------- |
| `number`                                    | 数值（支持滑动条） | `@min 0 @max 100 @step 1` |
| `boolean`                                   | 开关        | `@default true`           |
| `string`                                    | 文本        | `@default Hello`          |
| `select`                                    | 单选下拉      | `@option A @option B`     |
| `color`                                     | 颜色        | `@default #ff0000`        |
| `note`                                      | 长文本       | 多行文本编辑                    |
| `multiline_string`                          | 长文本       | 多行文本编辑                    |
| `actor/skill/item/weapon/armor/enemy/state` | 数据库引用     | 下拉选择                      |
| `struct`                                    | 结构体       | `@schema SchemaName`，折叠面板 |
| `table`                                     | 表格列表      | `@schema SchemaName`，表格编辑 |

### 新增标签

| 标签               | 说明                       | 示例                                                                |
| ---------------- | ------------------------ | ----------------------------------------------------------------- |
| `@text`          | 参数的中文显示名称，覆盖参数名          | `@text 玩家名称`                                                      |
| `@define-schema` | 定义可复用的 struct/table 字段模板 | `@define-schema DropSchema \n [{"name":"id","type":"number"...}]` |
| `@schema`        | 引用已定义的 Schema 模板         | `@schema DropSchema`                                              |

***

## 🆕 V3.13.0 新功能详解

### 一、`@text` 参数别名

#### 原理

ModLoader 在解析 `@param` 时，自动将参数名同时作为显示名。当存在 `@text` 标签时，**覆盖**参数名为指定的中文别名。

#### 使用规范

```javascript
@param damageMultiplier   // 参数名（存储用，建议英文）
@text 伤害倍率             // 显示名（界面展示用，中文）
@type number
@default 2
```

#### 代码演示（Mod 作者侧）

```javascript
// 获取参数：始终使用 @param 后的参数名
const params = PluginManager.parameters('MyMod');
const value = Number(params['damageMultiplier']);  // 注意：这里用英文参数名
```

> 🔔 **提示**：`@text` 只改变管理器中的显示名称，不影响代码中通过 `PluginManager.parameters()` 获取参数值的方式。**代码中必须使用** **`@param`** **后的参数名**。

***

### 二、Schema 模板系统 + struct/table 类型

#### 原理

| 组件               | 作用                                        |
| ---------------- | ----------------------------------------- |
| `@define-schema` | 定义一个**可复用的字段模板**（JSON 数组格式），包含字段名、类型、默认值等 |
| `@schema`        | 在参数中引用已定义的模板名                             |
| `struct` 类型      | 将模板渲染为**折叠式结构体面板**，支持无限层级嵌套               |
| `table` 类型       | 将模板渲染为**可增删行的表格列表编辑器**                    |

**数据存储格式**：

- `struct`：`JSON.stringify({field1: value1, field2: value2, ...})`
- `table`：`JSON.stringify(["JSON.stringify(行1)", "JSON.stringify(行2)", ...])`（双重转义）

**自动默认值**：struct/table 类型即使省略 `@default`，也会从 Schema 定义中自动生成默认 JSON，无需手动设置。table类型省略则表格为空，复杂情况不会生成默认值可以先省略，管理器里操作完保存，从mod\_config.json里抄作业，新增行时自动套用默认值。填写了默认值参数编辑界面会自动填充默认值行数。

#### 使用规范

**步骤1：定义 Schema 模板（写在** **`@help`** **之前）**

```javascript
@define-schema MonsterDropSchema
[{"name":"enemyId","text":"目标怪物","type":"enemy","default":"1"},{"name":"itemId","text":"掉落物品","type":"item","default":"1"},{"name":"dropRate","text":"掉落概率(1/N)","type":"number","default":"1","min":1}]
```

**步骤2：引用模板作为 struct 参数**

```javascript
@param bossConfig
@text Boss配置
@type struct
@schema MonsterDropSchema
@desc 配置单个怪物的掉落信息（折叠面板展示）
```

**步骤3：引用模板作为 table 参数**

```javascript
@param dropList
@text 掉落列表
@type table
@schema MonsterDropSchema
@desc 配置所有怪物的额外掉落（表格列表编辑）
```

#### 代码演示（Mod 作者侧）

**读取 struct 类型参数**：

```javascript
const params = PluginManager.parameters('MyMod');

function parseStruct(paramName) {
    try { return JSON.parse(params[paramName] || '{}'); }
    catch (e) { return {}; }
}

const bossConfig = parseStruct('bossConfig');
console.log(bossConfig.enemyId, bossConfig.itemId, bossConfig.dropRate);
```

**读取 table 类型参数**：

```javascript
function parseTable(paramName) {
    try {
        const arr = JSON.parse(params[paramName] || '[]');
        return arr.map(row => {
            try { return JSON.parse(row); }
            catch (e) { return {}; }
        });
    } catch (e) { return []; }
}

const dropList = parseTable('dropList');
dropList.forEach(drop => {
    console.log(`怪物${drop.enemyId} 掉落物品${drop.itemId} 概率1/${drop.dropRate}`);
});
```

> 🔔 **提示**：struct 和 table 类型的数据是 JSON 字符串，Mod 代码中需要手动 `JSON.parse()` 才能使用。具体可参考 `TestSchemaMod.js` 中的 `parseStructParam()` 和 `parseTableParam()` 辅助函数。

***

### 📂 参考示例 Mod

| 示例 Mod             | 说明                                       |
| ------------------ | ---------------------------------------- |
| `TestSchemaMod.js` | struct/table 完整测试用例，含多层嵌套、多模板引用、@text 别名 |
| `mydrop.js`        | 实战示例：怪物掉落物扩展，使用 table 类型配置掉落列表           |

***

## 📜 开源协议

MIT License - 详见 LICENSE 文件

***

## 📞 联系方式

如有问题或建议，请在项目中提交 Issue。

***

**版本**: v3.13.0 | **更新日期**: 2026-05-16

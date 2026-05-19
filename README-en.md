# RMMZ Mod Loader

> A powerful in-game mod manager and loader for **RPG Maker MZ** (RMMZ) games.

RMMZ Mod Loader allows players and developers to manage their mods directly from within the game UI. It provides a safe, non-destructive way to enable/disable mods, edit plugin parameters in real-time, reorder load priorities, and install mods via drag-and-drop.



---

## ✨ Key Features

- **In-Game UI**: Manage all your mods without minimizing the game or editing `plugins.js` manually.
- **Drag & Drop Install**: Simply drag a `.js` mod file or a `mods` folder into the game window to install.
- **Rich Parameter Editor**: Fully supports all RMMZ parameter types (`number`, `boolean`, `string`, `select`, `color`, `note`, database references like `actor/skill/item`, `struct`, and `table`).
- **Load Order Management**: Reorder mods via drag-and-drop or manual indexing to resolve conflicts.
- **Safe State Engine**: One-click "Disable All Mods" to quickly restore the vanilla game state. Unsaved parameter changes will prompt a warning.
- **Developer Friendly**: Supports `@text` aliases for localized parameter names and `@define-schema` / `@schema` templates for reusable complex structures.

---

## 📥 Installation (For Players)

There are two ways to install the Mod Loader into an RMMZ game:

### Method 1: Injection Mode (Recommended)
This method runs the Mod Loader before the game's core scripts, ensuring maximum compatibility.
1. Open the game's `index.html` file in a text editor.
2. Find the line containing `main.js`.
3. Add the following line **BEFORE** `main.js`:
   html
<script type="text/javascript" src="js/mods/ModLoader.js"></script>
4. Save the file and launch the game.

### Method 2: Plugin Mode
Treat the Mod Loader as a standard RMMZ plugin.
1. Copy the `js/mods` folder into the game's `js` directory.
2. Open the game, enter the title screen, and press `F2` to open the RMMZ Plugin Manager.
3. Add `ModLoader.js` to the plugin list.
4. Save and restart the game.

*(Note: If using Plugin Mode, you must press F5 to refresh the game after changing mod parameters or load orders in the mod menu.)*

---

## 🎮 How to Use

1. Launch the game. You will see a **"Mod 管理按钮" (Mod Management Button)** in the top-left corner of the screen.
2. Click the button to open the Mod Manager interface.
3. **Install Mods**: Drag and drop `.js` mod files directly into the UI.
4. **Enable/Disable**: Toggle the switch next to the mod name.
5. **Edit Parameters**: Select a mod to view and edit its parameters on the right side. Click "Save" to apply.
6. **Reorder**: Drag mods up and down the list to change their loading priority.

---

## ⚠️ Important Note on Data Injection

RMMZ Mod Loader specifically registers **.js plugins** into the game's plugin system. 

If you want a mod to alter the game's database (e.g., changing actor stats, item descriptions, or map data), the `.js` mod itself must include a "data injection" script to overwrite the game's JSON data at runtime. 
*(Example: See the `mydrop.js` mod included in the repository for how data injection works).*

---

## ❓ FAQ / Comparison

### Q: What’s the difference between this and RPGModder?
- **RMMZ Mod Loader** runs **inside the game**. It acts as an in-game UI manager specifically for `.js` plugins and their parameters. It does not replace game files.
- **RPGModder** (by Zorkats) is an **external Windows application** that uses a Virtual File System (VFS) to overlay mods. It is excellent for asset replacement (images, audio) and works for both MV and MZ.

*They can be used together! Use RPGModder to manage image/audio replacements, and this Mod Loader to manage gameplay plugin mods.*

### Q: Does this support RPG Maker MV?
No. This loader is specifically designed for the RPG Maker MZ architecture. For MV, consider tools like Yet Another ModLoader (YAML).

### Q: I want to develop a mod for this loader. How do I start?
You can check the example mods included in this repository (`TestMod.js`, `TestSchemaMod.js`, `mydrop.js`) to see how parameters and data injection are structured. If you need further API details, feel free to open a GitHub Issue!

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

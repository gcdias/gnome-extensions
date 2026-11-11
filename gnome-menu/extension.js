import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {
  Extension,
  gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';

const ITEM_TYPES = new Set([
  'app',
  'appgrid',
  'built_in',
  'recents',
  'separator',
]);

export default class GnomeMenuExtension extends Extension {
  constructor(metadata) {
    super(metadata);

    this._buttons = [];
    this._builtInActions = new Map([
      ['openRecentItems', () => this._openRecentItems()],
      ['showAbout', () => this._showAbout()],
      ['showAppGrid', () => this._showAppGrid()],
    ]);
  }

  enable() {
    let menus;
    try {
      menus = this._loadMenuConfig();
    } catch (error) {
      Main.notifyError(
        _('Unable to load the GNOME Menu configuration'),
        error.message,
      );
      throw error;
    }

    let index = 0;
    for (const [menuName, items] of Object.entries(menus)) {
      const button = new PanelMenu.Button(0.0, menuName, false);
      button.add_child(new St.Label({
        text: menuName,
        y_align: Clutter.ActorAlign.CENTER,
      }));

      for (const [itemId, item] of Object.entries(items)) {
        this._addMenuItem(button, menuName, itemId, item);
      }

      Main.panel.addToStatusArea(
        `${this.uuid}-${index}`,
        button,
        index,
        'left',
      );
      this._buttons.push(button);
      index++;
    }
  }

  disable() {
    for (const button of this._buttons)
      button.destroy();

    this._buttons = [];
  }

  _loadMenuConfig() {
    const configPath = GLib.build_filenamev([this.path, 'menu.json']);
    const [success, contents] = Gio.File.new_for_path(configPath)
      .load_contents(null);
    if (!success)
      throw new Error(`Could not read ${configPath}`);

    const config = JSON.parse(new TextDecoder().decode(contents));
    if (!config || typeof config !== 'object' || Array.isArray(config))
      throw new Error('menu.json must contain an object of menus');

    for (const [menuName, items] of Object.entries(config)) {
      if (!items || typeof items !== 'object' || Array.isArray(items))
        throw new Error(`Menu "${menuName}" must contain an object of items`);

      for (const [itemId, item] of Object.entries(items))
        this._validateItem(menuName, itemId, item);
    }

    return config;
  }

  _validateItem(menuName, itemId, item) {
    const location = `Menu "${menuName}", item "${itemId}"`;
    if (!item || typeof item !== 'object' || Array.isArray(item))
      throw new Error(`${location} must be an object`);

    if (typeof item.type !== 'string' || !ITEM_TYPES.has(item.type))
      throw new Error(`${location} has an unsupported type`);

    if (item.type === 'separator')
      return;

    if (typeof item.label !== 'string' || item.label.length === 0)
      throw new Error(`${location} must have a non-empty label`);

    if (item.icon !== undefined && typeof item.icon !== 'string')
      throw new Error(`${location} icon must be a string`);

    if (item.type === 'built_in') {
      if (typeof item.link !== 'string' ||
          !this._builtInActions.has(item.link)) {
        throw new Error(`${location} has an unknown built-in action`);
      }
    } else if (item.type === 'app') {
      const command = item.command ?? item.link;
      if (typeof command !== 'string' || command.trim().length === 0)
        throw new Error(`${location} must have a command or link`);

      const [success] = GLib.shell_parse_argv(command);
      if (!success)
        throw new Error(`${location} has an invalid command`);
    }
  }

  _addMenuItem(button, menuName, itemId, item) {
    if (item.type === 'separator') {
      button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      return;
    }

    const menuItem = item.icon
      ? new PopupMenu.PopupImageMenuItem(item.label, item.icon)
      : new PopupMenu.PopupMenuItem(item.label);
    menuItem.connect('activate', () => {
      try {
        this._activateItem(item);
      } catch (error) {
        logError(error, `GNOME Menu: failed to activate "${menuName}.${itemId}"`);
        Main.notifyError(
          _('Unable to activate menu item'),
          `${item.label}: ${error.message}`,
        );
      }
    });
    button.menu.addMenuItem(menuItem);
  }

  _activateItem(item) {
    switch (item.type) {
    case 'app':
      this._launchCommand(item.command ?? item.link);
      break;
    case 'appgrid':
      this._showAppGrid();
      break;
    case 'built_in':
      this._builtInActions.get(item.link)();
      break;
    case 'recents':
      this._openRecentItems();
      break;
    default:
      throw new Error(`Unsupported action type: ${item.type}`);
    }
  }

  _launchCommand(command) {
    const [success, argv] = GLib.shell_parse_argv(command);
    if (!success || argv.length === 0)
      throw new Error(`Invalid command: ${command}`);

    Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
  }

  _openRecentItems() {
    Gio.AppInfo.launch_default_for_uri('recent:///', null);
  }

  _showAbout() {
    this._launchCommand('gnome-control-center system');
  }

  _showAppGrid() {
    Main.overview.showApps();
  }
}

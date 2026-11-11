import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
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
]);

export default class GnomeMenuExtension extends Extension {
  
  constructor(metadata) {
    super(metadata);

    this._buttons = [];
    this._menuIcons = [];
    this._interfaceSettings = null;
    this._colorSchemeChangedId = 0;
    this._soupSession = null;
    this._builtInActions = new Map([
      ['openRecentItems', () => this._openRecentItems()],
      ['reloadExtension', () => this._reloadExtension()],
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

    this._interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface',});
    this._colorSchemeChangedId = this._interfaceSettings.connect('changed::color-scheme', this._checkIcons);

    let index = 0;
    for (const [menuName, items] of Object.entries(menus)) {
      const label = menuName.startsWith('&') ? menuName.slice(1) : menuName;
      const button = new PanelMenu.Button(0.0, label, false);
      const labelActor = new St.Label({
        text: label,
        y_align: Clutter.ActorAlign.CENTER,
      });
      button.add_child(labelActor);

      if (menuName.startsWith('&'))
        this._loadMenuIcon(label, button, labelActor);

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
    this._soupSession?.abort();
    this._soupSession = null;

    if (this._colorSchemeChangedId)
      this._interfaceSettings.disconnect(this._colorSchemeChangedId);
    this._interfaceSettings = null;
    this._colorSchemeChangedId = 0;

    for (const button of this._buttons)
      button.destroy();

    this._buttons = [];
    this._menuIcons = [];
  }

  _checkIcons(){
    for (const menuIcon of this._menuIcons) {
      if (!menuIcon.iconFile.query_exists(null))
        continue;
      try {
        this._applyMenuIconForegroundColor(menuIcon);
      } catch (error) {
        logError(
          error,
          `GNOME Menu: unable to load icon for "${menuIcon.label}"`,
        );
      }
    }
  }

  _loadMenuIcon(label, button, labelActor) {
    const iconName = label.normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!iconName)
      return;

    const cacheDirectory = Gio.File.new_for_path(GLib.build_filenamev([
      GLib.get_user_cache_dir(),
      this.uuid,
    ]));
    const iconFile = cacheDirectory.get_child(`${iconName}.svg`);
    const themedIconFile = cacheDirectory.get_child(`${iconName}-menu-color.svg`);
    const menuIcon = {
      label,
      button,
      iconFile,
      themedIconFile,
      labelActor,
      iconActor: null,
    };
    this._menuIcons.push(menuIcon);
    if (iconFile.query_exists(null)) {
      try {
        this._applyMenuIconForegroundColor(menuIcon);
      } catch (error) {
        logError(error, `GNOME Menu: unable to load icon for "${label}"`);
      }
      return;
    }

    const session = this._soupSession ??= new Soup.Session();
    const url = 'https://gcdias.github.io/ubuntu-setup/res/icons/grub-os-symb/' +
      `${encodeURIComponent(iconName)}.svg`;
    const message = Soup.Message.new('GET', url);
    session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null,
      (requestSession, result) => {
        if (this._soupSession !== requestSession)
          return;

        try {
          const contents = requestSession.send_and_read_finish(result);
          if (message.status_code === 404)
            return;
          if (message.status_code !== 200)
            throw new Error(
              `Icon request failed with HTTP ${message.status_code}`,
            );

          if (!cacheDirectory.query_exists(null))
            cacheDirectory.make_directory_with_parents(null);
          iconFile.replace_contents(
            contents.get_data(),
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
          );
          this._applyMenuIconForegroundColor(menuIcon);
        } catch (error) {
          logError(error, `GNOME Menu: unable to load icon for "${label}"`);
        }
      },
    );
  }

  _applyMenuIconForegroundColor(menuIcon) {
    const [success, contents] = menuIcon.iconFile.load_contents(null);
    if (!success)
      throw new Error(`Could not read ${menuIcon.iconFile.get_path()}`);

    const foreground = this._interfaceSettings.get_string('color-scheme') ===
      'prefer-dark' ? '#eee' : '#111';
    const svg = new TextDecoder().decode(contents)
      .replace(/#111\b/gi, foreground);
    menuIcon.themedIconFile.replace_contents(
      new TextEncoder().encode(svg),
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
    this._replaceMenuLabelWithIcon(menuIcon);
  }

  _replaceMenuLabelWithIcon(menuIcon) {
    if (menuIcon.labelActor?.get_parent() === menuIcon.button) {
      menuIcon.button.remove_child(menuIcon.labelActor);
      menuIcon.labelActor.destroy();
      menuIcon.labelActor = null;
    }

    if (menuIcon.iconActor) {
      menuIcon.button.remove_child(menuIcon.iconActor);
      menuIcon.iconActor.destroy();
    }

    menuIcon.iconActor = new St.Icon({
      gicon: new Gio.FileIcon({ file: menuIcon.themedIconFile }),
      icon_size: 24,
      style_class: 'system-status-icon',
    });
    menuIcon.button.add_child(menuIcon.iconActor);
  }

  _loadMenuConfig() {
    const configPath = GLib.build_filenamev([this.path, 'menu.json']);
    const [success, contents] = Gio.File.new_for_path(configPath).load_contents(null);
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

    if (typeof item.label !== 'string' || item.label.length === 0)
      throw new Error(`${location} must have a non-empty label`);

    if (item.icon !== undefined && typeof item.icon !== 'string')
      throw new Error(`${location} icon must be a string`);

    if (item.break !== undefined && typeof item.break !== 'boolean')
      throw new Error(`${location} break must be a boolean`);

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

    if (item.break)
      button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
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

  _reloadExtension() {
    const manager = Main.extensionManager;
    if (!manager.disableExtension(this.uuid))
      throw new Error(_('The extension could not be disabled'));

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
      try {
        if (!manager.enableExtension(this.uuid))
          throw new Error(_('The extension could not be enabled'));
      } catch (error) {
        logError(error, 'GNOME Menu: failed to restart the extension');
        Main.notifyError(
          _('Unable to reload the GNOME Menu extension'),
          error.message,
        );
      }

      return GLib.SOURCE_REMOVE;
    });
  }

  _showAbout() {
    this._launchCommand('gnome-control-center system');
  }

  _showAppGrid() {
    Main.overview.showApps();
  }
}

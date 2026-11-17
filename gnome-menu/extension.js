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
import {
  countDown,
  getBuiltInActions,
  reloadExtension,
} from './builtInActions.js';
import {
  getMenuConfigFile,
  recordMenuConfigError,
} from './menuConfig.js';
import { getWPAConfig } from './wpaConfig.js';

const ITEM_TYPES = new Set([
  'app',
  'built_in',
  'uri',
]);

export default class GnomeMenuExtension extends Extension {
  
  constructor(metadata) {
    super(metadata);

    this._buttons = [];
    this._menuIcons = [];
    this._interfaceSettings = null;
    this._colorSchemeChangedId = 0;
    this._settings = null;
    this._reloadRequestChangedId = 0;
    this._soupSession = null;
    this._builtInActions = getBuiltInActions(this);
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
    this._updateIconColor();
    this._settings = this.getSettings();

    this._reloadRequestChangedId = this._settings.connect(
      'changed::reload-request',
      () => {
        try {
          reloadExtension(this);
        } catch (error) {
          logError(error, 'GNOME Menu: failed to reload the extension');
          Main.notifyError(
            _('Unable to reload the GNOME Menu extension'),
            error.message,
          );
        }
      },
    );

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

    if (this._reloadRequestChangedId)
      this._settings.disconnect(this._reloadRequestChangedId);
    this._settings = null;
    this._reloadRequestChangedId = 0;

    for (const button of this._buttons)
      button.destroy();

    this._buttons = [];
    this._menuIcons = [];
  }

  _updateIconColor(){
    this._iconColor = this._interfaceSettings.get_string('color-scheme') === 'prefer-dark' ? '#eee' : '#111';
  }

  _checkIcons(){
    this._updateIconColor();
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

    const svg = new TextDecoder().decode(contents)
      .replace(/#111\b/gi, this._iconColor);
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

  _getWPAConfig() {
    return getWPAConfig();
  }

  _loadMenuConfig() {
    try {
      return this._readMenuConfig();
    } catch (error) {
      recordMenuConfigError(this.uuid, 'Unable to load menu configuration', error);
      throw error;
    }
  }

  _readMenuConfig() {
    const configFile = getMenuConfigFile(
      this.path,
      this.uuid,
      this.getSettings(),
    );
    const [success, contents] = configFile.load_contents(null);
    if (!success)
      throw new Error(`Could not read ${configFile.get_path()}`);

    const config = JSON.parse(new TextDecoder().decode(contents));
    if (!config || typeof config !== 'object' || Array.isArray(config))
      throw new Error('menu.json must contain an object of menus');

    const validatedMenus = [];
    for (const [menuName, items] of Object.entries(config)) {
      if (!items || typeof items !== 'object' || Array.isArray(items))
        throw new Error(`Menu "${menuName}" must contain an object of items`);

      const validatedItems = [];
      for (const [itemId, item] of Object.entries(items)) {
        const error = this._validateItem(menuName, itemId, item);
        if (error) {
          logError(error, `GNOME Menu: skipping invalid item "${menuName}.${itemId}"`);
          continue;
        }
        validatedItems.push([itemId, item]);
      }
      validatedMenus.push([menuName, Object.fromEntries(validatedItems)]);
    }

    return Object.fromEntries(validatedMenus);
  }

  _validateItem(menuName, itemId, item) {

    const invalid = message => {
      const error = new Error(`Menu "${menuName}", item "${itemId}" ${message}`);
      recordMenuConfigError(this.uuid, 'Invalid menu item', error);
      return error;
    };

    if (!item || typeof item !== 'object' || Array.isArray(item))
      return invalid('must be an object');

    if (typeof item.label !== 'string' || item.label.length === 0)
      return invalid('must have a non-empty label');

    if (item.type){
      if (!ITEM_TYPES.has(item.type))
        return invalid('has an unsupported type');
      if (!item.link || item.link.trim().length === 0)
        return invalid('must have a link');
      if (item.type === 'built_in' && !this._builtInActions.has(item.link))
        return invalid('has an unknown built-in action');
      if (item.type === 'app'){
        const [success] = GLib.shell_parse_argv(item.link);
        if (!success)
          return invalid('has an invalid link');
      }
    }

    if (item.icon && item.icon.length === 0)
      return invalid('icon must be a non-empty string');

    if (item.break && typeof item.break !== 'boolean')
      return invalid('break must be a boolean');

    return null;
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
    let action;

    switch (item.type) {
      case 'app':
        action = () => this._launchCommand(item.command ?? item.link);
        break;
      case 'built_in':
        action = this._builtInActions.get(item.link);
        break;
      case 'uri':
        this._openUriInNautilus(item.link);
        return;
      default:
        console.log(`Unsupported action type: ${item.type}`);
        return;
    }

    if (item.countdown && item.dmsg)
      countDown(item.label, item.dmsg, action, Number(item.countdown));
    else
      action();
  }

  _openUriInNautilus(uri) {
    const target = uri.startsWith('~/')
      ? GLib.build_filenamev([GLib.get_home_dir(), uri.slice(2)])
      : uri;
    Gio.Subprocess.new(['nautilus', target], Gio.SubprocessFlags.NONE);
  }

  _launchCommand(command) {
    const [success, argv] = GLib.shell_parse_argv(command);
    if (!success || argv.length === 0)
      throw new Error(`Invalid command: ${command}`);

    Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
  }

}
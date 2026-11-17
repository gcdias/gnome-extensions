import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {
  getEditableMenuConfigFile,
  getMenuConfigErrorLogFile,
  resetMenuConfigFile,
} from './menuConfig.js';
import { getWPAConfig } from './wpaConfig.js';

export default class GnomeMenuPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const showError = (error, heading = _('Unable to generate WPA configuration')) => {
      console.error(error);
      const dialog = new Adw.MessageDialog({
        transient_for: window,
        modal: true,
        heading,
        body: error.message,
      });
      dialog.add_response('close', _('Close'));
      dialog.present();
    };
    const saveWPAConfig = (file, wpa) => {
      file.replace_contents(
        new TextEncoder().encode(`${JSON.stringify(wpa, null, 2)}\n`),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      );
    };
    const openInTextEditor = file => {
      const textEditor = Gio.AppInfo.get_default_for_type('text/plain', false);
      if (!textEditor)
        throw new Error(_('No default text editor is configured.'));
      if (!textEditor.launch([file], null))
        throw new Error(_('Could not launch the default text editor.'));
    };
    const exportWPAConfig = () => {
      let configFile;
      try {
        const wpa = getWPAConfig();
        const cacheDirectory = Gio.File.new_for_path(GLib.build_filenamev([
          GLib.get_user_cache_dir(),
          this.uuid,
        ]));
        if (!cacheDirectory.query_exists(null))
          cacheDirectory.make_directory_with_parents(null);
        configFile = cacheDirectory.get_child('wpa.json');
        saveWPAConfig(configFile, wpa);
      } catch (error) {
        showError(error);
        return;
      }

      try {
        openInTextEditor(configFile);
      } catch (error) {
        showError(error, _('Unable to open WPA configuration'));
      }
    };
    const editMenuConfig = () => {
      try {
        openInTextEditor(getEditableMenuConfigFile(
          this.path,
          this.uuid,
          settings,
        ));
      } catch (error) {
        showError(error, _('Unable to edit menu.json'));
      }
    };
    const resetMenuConfig = () => {
      try {
        resetMenuConfigFile(this.uuid, settings);
      } catch (error) {
        showError(error, _('Unable to reset menu.json'));
      }
    };
    const viewMenuConfigErrors = () => {
      const logFile = getMenuConfigErrorLogFile(this.uuid);
      if (!logFile.query_exists(null)) {
        showError(
          new Error(_('No menu configuration errors have been logged.')),
          _('No configuration errors'),
        );
        return;
      }

      try {
        openInTextEditor(logFile);
      } catch (error) {
        showError(error, _('Unable to open configuration error log'));
      }
    };
    const reloadMenus = () => {
      const request = settings.get_uint('reload-request');
      const nextRequest = request === 0xffffffff ? 0 : request + 1;
      if (!settings.set_uint('reload-request', nextRequest))
        showError(
          new Error(_('Could not request a menu reload.')),
          _('Unable to reload menus'),
        );
    };
    const page = new Adw.PreferencesPage({
      title: _('Menus'),
      icon_name: 'view-list-symbolic',
    });
    const group = new Adw.PreferencesGroup({
      title: _('Menu configuration'),
      description: _('Reload menus after changing menu.json.'),
    });
    const reloadRow = new Adw.ActionRow({
      title: _('Reload menus'),
      subtitle: _('Reload menu.json and rebuild the menus.'),
    });
    const editRow = new Adw.ActionRow({
      title: _('Edit menu.json'),
      subtitle: _('Open the cached file in the default text editor.'),
    });
    const resetRow = new Adw.ActionRow({
      title: _('Reset menu.json'),
      subtitle: _('Remove the cached file and use the original bundled file after reloading menus.'),
    });
    const errorsRow = new Adw.ActionRow({
      title: _('View configuration errors'),
      subtitle: _('Open the menu configuration error log in the default text editor.'),
    });
    const exportRow = new Adw.ActionRow({
      title: _('Export web apps'),
      subtitle: _('Save wpa.json from desktop launchers to the extension cache directory.'),
    });

    const editButton = new Gtk.Button({
      label: _('Edit…'),
      valign: Gtk.Align.CENTER,
    });
    const reloadButton = new Gtk.Button({
      label: _('Reload'),
      valign: Gtk.Align.CENTER,
    });
    const resetButton = new Gtk.Button({
      label: _('Reset'),
      valign: Gtk.Align.CENTER,
    });
    const errorsButton = new Gtk.Button({
      label: _('View log…'),
      valign: Gtk.Align.CENTER,
    });
    const exportButton = new Gtk.Button({
      label: _('Generate wpa.json…'),
      valign: Gtk.Align.CENTER,
    });

    editButton.connect('clicked', editMenuConfig);
    reloadButton.connect('clicked', reloadMenus);
    resetButton.connect('clicked', resetMenuConfig);
    errorsButton.connect('clicked', viewMenuConfigErrors);
    exportButton.connect('clicked', exportWPAConfig);

    reloadRow.add_suffix(reloadButton);
    editRow.add_suffix(editButton);
    resetRow.add_suffix(resetButton);
    errorsRow.add_suffix(errorsButton);
    group.add(reloadRow);
    group.add(editRow);
    group.add(resetRow);
    group.add(errorsRow);
    exportRow.add_suffix(exportButton);
    group.add(exportRow);
    page.add(group);
    window.add(page);
  }
}

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {
  ExtensionPreferences,
  gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeMenuPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage({
      title: _('Menus'),
      icon_name: 'view-list-symbolic',
    });
    const group = new Adw.PreferencesGroup({
      title: _('Menu configuration'),
      description: _('Reload the extension after changing this setting.'),
    });
    const row = new Adw.ActionRow({
      title: _('Configuration file'),
    });
    const updatePath = () => {
      const path = settings.get_string('menu-file') ||
        GLib.build_filenamev([this.path, 'menu.json']);
      row.subtitle = path;
      resetButton.sensitive = settings.get_string('menu-file') !== '';
    };

    const chooseButton = new Gtk.Button({
      label: _('Choose…'),
      valign: Gtk.Align.CENTER,
    });
    const resetButton = new Gtk.Button({
      label: _('Use bundled file'),
      valign: Gtk.Align.CENTER,
    });
    const filter = new Gtk.FileFilter();
    filter.set_name(_('JSON files'));
    filter.add_mime_type('application/json');
    filter.add_pattern('*.json');

    chooseButton.connect('clicked', () => {
      const chooser = Gtk.FileChooserNative.new(
        _('Select menu.json'),
        window,
        Gtk.FileChooserAction.OPEN,
        _('Select'),
        _('Cancel'),
      );
      chooser.set_local_only(true);
      chooser.add_filter(filter);
      chooser.connect('response', (dialog, response) => {
        if (response === Gtk.ResponseType.ACCEPT) {
          const file = dialog.get_file();
          const path = file?.get_path();
          if (path)
            settings.set_string('menu-file', path);
        }
        dialog.destroy();
      });
      chooser.show();
    });
    resetButton.connect('clicked', () => settings.reset('menu-file'));
    settings.connect('changed::menu-file', updatePath);

    row.add_suffix(chooseButton);
    row.add_suffix(resetButton);
    group.add(row);
    page.add(group);
    window.add(page);
    updatePath();
  }
}

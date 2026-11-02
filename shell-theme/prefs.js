import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeThemeColorPreferences extends ExtensionPreferences {
    
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('Appearance'),
            icon_name: 'applications-graphics-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Wallpaper Accent'),
        });
        page.add(group);

        const enableRow = new Adw.SwitchRow({
            title: _('Enable accent tint'),
            subtitle: _('Set the accent colour from the wallpaper dominant colour.'),
        });
        group.add(enableRow);

        const highlightRow = new Adw.SwitchRow({
            title: _('Use highlight colour'),
            subtitle: _('Use the wallpaper highlight colour instead of the dominant colour.'),
        });
        group.add(highlightRow);

        const saturationRow = new Adw.SpinRow({
            title: _('Saturation'),
            subtitle: _('Adjust the saturation of the accent colour.'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
                page_increment: 10,
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
        });
        group.add(saturationRow);

        const shellHueShiftRow = new Adw.SpinRow({
            title: _('Shell hue shift'),
            subtitle: _('Adjust the hue of the shell colour.'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 360,
                step_increment: 1,
                page_increment: 10,
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
        });
        group.add(shellHueShiftRow);

        const accentHueShiftRow = new Adw.SpinRow({
            title: _('Accent hue shift'),
            subtitle: _('Adjust the hue of the accent colour.'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 360,
                step_increment: 1,
                page_increment: 10,
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
        });
        group.add(accentHueShiftRow);

        settings.bind('enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('highlight-mode', highlightRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('saturation', saturationRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('hue-shell-shift', shellHueShiftRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('hue-accent-shift', accentHueShiftRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
}

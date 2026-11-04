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


        const wallpaperSourceRow = new Adw.ComboRow({
            title: _('Wallpaper source'),
            subtitle: _('Select the source of the wallpaper.'),
            model: Gtk.StringList.new([_('User'), _('Bing')]),
        });
        group.add(wallpaperSourceRow);

        const updateWallpaperSource = () => {
            const selectedSource = settings.get_string('wp-source') === 'bing' ? 1 : 0;
            if (wallpaperSourceRow.selected !== selectedSource)
                wallpaperSourceRow.selected = selectedSource;
        };
        wallpaperSourceRow.selected = settings.get_string('wp-source') === 'bing' ? 1 : 0;
        wallpaperSourceRow.connect('notify::selected', () => {
            settings.set_string('wp-source', wallpaperSourceRow.selected === 1 ? 'bing' : 'user');
        });
        settings.connect('changed::wp-source', updateWallpaperSource);

        const addThemeSourceRow = (key, title, subtitle) => {
            const row = new Adw.ComboRow({
                title,
                subtitle,
                model: Gtk.StringList.new([_('Disable'), _('Hue'), _('Shift')]),
            });
            group.add(row);

            const sources = ['off', 'hue', 'shift'];
            const updateSource = () => {
                const selectedSource = sources.indexOf(settings.get_string(key));
                if (selectedSource >= 0 && row.selected !== selectedSource)
                    row.selected = selectedSource;
            };
            updateSource();
            row.connect('notify::selected', () => {
                if (row.selected < sources.length)
                    settings.set_string(key, sources[row.selected]);
            });
            settings.connect(`changed::${key}`, updateSource);
        };

        addThemeSourceRow(
            'icon-theme-src',
            _('Tint Icon Theme'),
            _('Disable, set to wallpaper hue or shift the hue')
        );

        addThemeSourceRow(
            'accent-color-src',
            _('Tint Accent colour source'),
            _('Choose how the accent colour is selected.')
        );

        addThemeSourceRow(
            'gtk-theme-src',
            _('Tint GTK/Shell Theme'),
            _('Disable, set to wallpaper hue or shift the hue')
        );
        

        const enableRow = new Adw.SwitchRow({
            title: _('Enable theme tint'),
            subtitle: _('Set the theme colour from the wallpaper dominant colour.'),
        });
        group.add(enableRow);
        settings.bind('enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        

        const saturationRow = new Adw.SpinRow({
            title: _('Saturation'),
            subtitle: _('Adjust the saturation of the theme colour.'),
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
        settings.bind('saturation', saturationRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        

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
        settings.bind('hue-shell-shift', shellHueShiftRow, 'value', Gio.SettingsBindFlags.DEFAULT);


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
        settings.bind('hue-accent-shift', accentHueShiftRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        
    }
}

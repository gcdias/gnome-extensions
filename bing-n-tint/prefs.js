import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class BingNTintPreferences extends ExtensionPreferences {
    
    _addSpinRow(group, settings, key, title, subtitle, min, max, step, page){
        const spinRow = new Adw.SpinRow({
            title: _(title),
            subtitle: _(subtitle),
            adjustment: new Gtk.Adjustment({
                lower: min,
                upper: max,
                step_increment: step,
                page_increment: page,
            }),
            climb_rate: 1,
            digits: 0,
            numeric: true,
        });
        group.add(spinRow);
        settings.bind(key, spinRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    _addComboBox(group, settings, key, title, subtitle, kv) {
        const values = Object.values(kv);
        const row = new Adw.ComboRow({
            title: _(title),
            subtitle: _(subtitle),
            model: Gtk.StringList.new(Object.keys(kv)),
        });
        group.add(row);

        const updateSelection = () => {
            const index = values.indexOf(settings.get_string(key));
            if (index >= 0 && row.selected !== index)
                row.selected = index;
        };

        updateSelection();

        row.connect('notify::selected', () => {
            if (row.selected < values.length)
                settings.set_string(key, values[row.selected]);
        });

        settings.connect(`changed::${key}`, updateSelection);
    }

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

        this._addComboBox(group, settings,
            'wp-source',
            'Wallpaper',
            'Select the source of wallpaper',
            { "User" : "user", "Bing": "bing"}
        )

        this._addSpinRow(group, settings,
            'bing-index',
            'Bing Wallpaper Index',
            'Select the index of the Bing wallpaper to use.',
             0, 10, 1, 2
        );
        
        const themeOpts = {
            "Disable": "off",
            "Hue": "hue",
            "Hue-shift": "shift"
        }

        this._addComboBox(group, settings,
            'icon-theme-src',
            'Tint Icon Theme',
            'Disable, set to wallpaper hue or shift the hue',
            themeOpts
        )

        this._addComboBox(group, settings,
            'accent-color-src',
            'Tint Accent colour source',
            'Choose how the accent colour is selected.',
            themeOpts
        )

        this._addComboBox(group, settings,
            'gtk-theme-src',
            'Tint GTK/Shell Theme',
            'Disable, set to wallpaper hue or shift the hue',
            themeOpts
        )

       

        const enableRow = new Adw.SwitchRow({
            title: _('Enable theme tint'),
            subtitle: _('Set the theme colour from the wallpaper dominant colour.'),
        });
        group.add(enableRow);
        settings.bind('enabled', enableRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        

        this._addSpinRow(group, settings,
            'saturation',
            'Saturation',
            'Adjust the saturation of the theme colour.',
            0, 100, 1, 10
        );
        
        this._addSpinRow(group, settings,
            'hue-shell-shift',
            'Shell hue shift',
            'Adjust the hue of the shell colour.',
            0, 360, 1, 10
        )

        this._addSpinRow(group, settings,
            'hue-accent-shift',
            'Accent hue shift',
            'Adjust the hue of the accent colour.',
            0, 360, 1, 10
        )
        

        const debugPage = new Adw.PreferencesPage({
            title: _('Debug'),
            icon_name: 'utilities-terminal-symbolic',
        });
        window.add(debugPage);

        const debugGroup = new Adw.PreferencesGroup({
            title: _('Console output'),
        });
        debugPage.add(debugGroup);

        const debugTextView = new Gtk.TextView({
            editable: false,
            cursor_visible: false,
            monospace: true,
            wrap_mode: Gtk.WrapMode.NONE,
        });
        debugTextView.add_css_class('debug-log');
        const debugTextStyle = new Gtk.CssProvider();
        debugTextStyle.load_from_data('.debug-log { font-family: monospace; font-size: 10px; }', -1);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            debugTextStyle,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
        const debugScroll = new Gtk.ScrolledWindow({
            min_content_height: 300,
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            child: debugTextView,
        });
        debugGroup.add(debugScroll);

        const updateDebugLog = () => {
            debugTextView.buffer.set_text(settings.get_string('debug-log'), -1);
        };
        updateDebugLog();
        settings.connect('changed::debug-log', updateDebugLog);
    }
}

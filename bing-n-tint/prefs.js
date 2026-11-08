import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export default class BingNTintPreferences extends ExtensionPreferences {
    
    _addSwitch(group, settings, key, title, subtitle){
        const switchRow = new Adw.SwitchRow({
            title: _(title),
            subtitle: _(subtitle),
        });
        group.add(switchRow);
        settings.bind(key, switchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        return switchRow;
    }

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
        return spinRow;
    }

    _addComboBox(group, settings, key, title, subtitle, kv, callback) {
        const values = Object.values(kv);
        const row = new Adw.ComboRow({
            title: _(title),
            subtitle: _(subtitle),
            model: Gtk.StringList.new(Object.keys(kv)),
        });
        group.add(row);

        const updateSelection = () => {
            const index = values.indexOf(settings.get_string(key));
            if (row.selected !== index && index >= 0)
                row.selected = index;
        };

        updateSelection();

        row.connect('notify::selected', () => {
            if (row.selected < values.length){
                settings.set_string(key, values[row.selected]);
                if (callback)
                    callback(key, row.selected, values[row.selected]);
            }
        });

        settings.connect(`changed::${key}`, updateSelection);
        return row;
    }

    _promptString(parent, prompt, callback){
        const dialog = new Gtk.Dialog({
            title: _('Prompt'),
            transient_for: parent,
            modal: true,
        });
        const entry = new Gtk.Entry({
            placeholder_text: _(prompt),
            activates_default: true,
        });

        const contentArea = dialog.get_content_area();
        contentArea.set_margin_top(12);
        contentArea.set_margin_bottom(12);
        contentArea.set_margin_start(18);
        contentArea.set_margin_end(18);
        contentArea.append(entry);
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Save'), Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.OK);
        dialog.connect('response', (_dialog, response) => {
            if (callback && response === Gtk.ResponseType.OK)
                callback(entry.text);

            dialog.close();
        });
        dialog.present();
    }


    fillPreferencesWindow(window) {

        const settings = this.getSettings();

        const api_providers = {
            'bing': {desc: 'copyright'},
            'wiki': {prompt: 'Enter your email for accessing wiki POTD', key: 'wiki-key', desc: ''},
            'nasa': {prompt: 'Enter your Nasa API-KEY', key: 'nasa-api-key', desc: 'alt'},
        }

        const page = new Adw.PreferencesPage({
            title: _('Appearance'),
            icon_name: 'applications-graphics-symbolic',
        });
        window.add(page);


        const wpGroup = new Adw.PreferencesGroup({
            title: _('Wallpaper'),
        });
        page.add(wpGroup);

        const wpComboRow = this._addComboBox(wpGroup, settings,
            'wp-source',
            'Wallpaper',
            'Select the source of wallpaper',
            { "Default" : "off", "User": "user", "Bing": "bing", "Picsum": "picsum", "Wikipedia": "wiki", "Nasa": "nasa" },
            (key, index, value) => {
                const api = api_providers[value];
                if (api?.key && !settings.get_string(api.key))
                    this._promptString(window, api.prompt, (name) => settings.set_string(api.key, name));
            }
        )

        this._addSpinRow(wpGroup, settings,
            'bing-index',
            'Bing Wallpaper Index',
            'Select the index of the Bing wallpaper to use.',
             0, 10, 1, 2
        );

        const updateWpSubtitle = () => {
            const metadata = JSON.parse(settings.get_string('wp-metadata'));
            const provider = settings.get_string('wp-source');
            let d, desc;
            desc = metadata && (d = api_providers[provider]) && d.desc ? metadata[d.desc] : null;
            wpComboRow.subtitle = desc || _('No description provided.');
        };
        updateWpSubtitle();
        settings.connect('changed::wp-metadata', updateWpSubtitle);
        
        this._addSwitch(wpGroup, settings,
            'show-status-icon',
            'Show status icon',
            'Show a Bing icon in the top bar to open preferences.'
        );


        const group = new Adw.PreferencesGroup({
            title: _('Tint Options'),
        });
        page.add(group);

        const themeOpts = {
            "Disabled": "off",
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
        );



        this._addSwitch(group, settings,
            'debug-enable',
            'Debug',
            'Enable debug log and options'
        );
        
        const debugPage = new Adw.PreferencesPage({
            title: _('Debug'),
            icon_name: 'utilities-terminal-symbolic',
        });
        let debugPageAdded = false;
        const updateDebugPage = () => {
            const enabled = settings.get_boolean('debug-enable');
            if (enabled === debugPageAdded)
                return;

            if (enabled)
                window.add(debugPage);
            else
                window.remove(debugPage);

            debugPageAdded = enabled;
        };
        updateDebugPage();
        settings.connect('changed::debug-enable', updateDebugPage);

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
        debugTextStyle.load_from_data('.debug-log { font-family: monospace; font-size: 10px; font-weight: 700;}', -1);
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

        const debugOptsGroup = new Adw.PreferencesGroup({
            title: _('Debug options'),
        });
        debugPage.add(debugOptsGroup);

        this._addComboBox(debugOptsGroup, settings,
            'debug-timestamp',
            'Timestamp format',
            'Sets absolute (ISO format) or relative (in ms) timestamp',
            { "Absolute": "abs", "Relative": "rel" }
        )

        this._addComboBox(debugOptsGroup, settings,
            'debug-level',
            'Log level',
            'Sets log level to verbose, info and error',
            { "Verbose": "0", "Info": "1", "Error": "2" }
        )

        const clearDebugLogRow = new Adw.ActionRow({
            title: _('Debug log'),
            subtitle: _('Clear the debug log output.'),
        });
        const clearDebugLogButton = new Gtk.Button({
            label: _('Clear'),
            valign: Gtk.Align.CENTER,
        });
        clearDebugLogButton.connect('clicked', () => {
            settings.set_string('debug-log', '');
        });
        clearDebugLogRow.add_suffix(clearDebugLogButton);
        debugOptsGroup.add(clearDebugLogRow);
    }
}

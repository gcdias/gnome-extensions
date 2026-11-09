import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';

import { Logger as log } from './utils/logger.js';
import { Utils as utils } from './utils/utils.js';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const EXTNAME = 'bing-n-tint';

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

    _loadAuthConfig(){
        let auth_config = utils.loadText(this._cacheDir,'user.cfg');
        if (auth_config && (auth_config = JSON.parse(auth_config)) && (auth_config.auth)){
            if (auth_config.auth.wiki){
                log.i('prefs._loadAuthConfig: found wiki-key');
                this._settings.set_string('wiki-key', auth_config.auth.wiki);
                this._authProviders["Wikipedia"] = 'wiki';
            }
            if (auth_config.auth.nasa){
                log.i('prefs._loadAuthConfig: found nasa-key');
                this._settings.set_string('nasa-key', auth_config.auth.wiki);
                this._authProviders["Nasa"] = 'nasa';
            }
            if (auth_config.auth.wall){
                log.i('prefs._loadAuthConfig: found wall-key');
                this._settings.set_string('wall-key', auth_config.auth.wall);
                this._authProviders["Wallhaven"] = 'wall';
            }
        } else {
            const cfg_file = utils.loadText(this.path,'user.src');
            utils.saveText(this._cacheDir, 'user.cfg', cfg_file);
            log.i('prefs._loadAuthConfig: user config not found. Create new user.cfg in cachedir');
        }
    }

    _connect(connection, callback){
        if (connection && callback){
            callback();
            this._settings.connect(connection, callback);
        }
    }

    fillPreferencesWindow(window) {

        this._settings = this.getSettings();
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);

        this._authProviders = {
            "Default": "off",
            "User": "user",
            "Bing": "bing",
            "Picsum": "picsum"
        }

        this._loadAuthConfig();

        this._wpPage = new Adw.PreferencesPage({
            title: _('Appearance'),
            icon_name: 'applications-graphics-symbolic',
        });
        window.add(this._wpPage);


        this._wpGroup = new Adw.PreferencesGroup({
            title: _('Wallpaper'),
        });
        this._wpPage.add(this._wpGroup);

        const wpComboRow = this._addComboBox(this._wpGroup, this._settings,
            'wp-source',
            'Wallpaper',
            'Select the source of wallpaper',
            this._authProviders
        )
        this._connect('changed::wp-metadata', () => {
            const desc = this._settings.get_string('wp-desc');
            wpComboRow.subtitle = desc || _('No description provided.');
        })

        /*
        this._addSpinRow(this._wpGroup, this._settings,
            'wp-index',
            'Bing Wallpaper Index',
            'Select the index of the Bing wallpaper to use.',
             0, 10, 1, 2
        );
        */
        
        this._addSwitch(this._wpGroup, this._settings,
            'show-status-icon',
            'Show status icon',
            'Show a Bing icon in the top bar to open preferences.'
        );


        const group = new Adw.PreferencesGroup({
            title: _('Tint Options'),
        });
        this._wpPage.add(group);

        const themeOpts = {
            "Disabled": "off",
            "Hue": "hue",
            "Hue-shift": "shift"
        }

        this._addComboBox(group, this._settings,
            'icon-theme-src',
            'Tint Icon Theme',
            'Disable, set to wallpaper hue or shift the hue',
            themeOpts
        )

        this._addComboBox(group, this._settings,
            'accent-color-src',
            'Tint Accent colour source',
            'Choose how the accent colour is selected.',
            themeOpts
        )

        this._addComboBox(group, this._settings,
            'gtk-theme-src',
            'Tint GTK/Shell Theme',
            'Disable, set to wallpaper hue or shift the hue',
            themeOpts
        )
        
        this._addComboBox(group, this._settings,
            'ptyxis-theme-src',
            'Tint Terminal/Ptyxis Theme',
            'Disable, set to wallpaper hue or shift the hue',
            themeOpts
        )

        this._addSpinRow(group, this._settings,
            'saturation',
            'Saturation',
            'Adjust the saturation of the theme colour.',
            0, 100, 1, 10
        );
        
        this._addSpinRow(group, this._settings,
            'hue-shell-shift',
            'Shell hue shift',
            'Adjust the hue of the shell colour.',
            0, 360, 1, 10
        )

        this._addSpinRow(group, this._settings,
            'hue-accent-shift',
            'Accent hue shift',
            'Adjust the hue of the accent colour.',
            0, 360, 1, 10
        );



        this._addSwitch(group, this._settings,
            'debug-enable',
            'Debug',
            'Enable debug log and options'
        );
        
        const debugPage = new Adw.PreferencesPage({
            title: _('Debug'),
            icon_name: 'utilities-terminal-symbolic',
        });

        let debugPageAdded = false;
        this._connect('changed::debug-enable', () => {
            const enabled = this._settings.get_boolean('debug-enable');
            if (enabled === debugPageAdded)
                return;

            if (enabled)
                window.add(debugPage);
            else
                window.remove(debugPage);

            debugPageAdded = enabled;
        });
        
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
        this._connect('changed::debug-log',() => debugTextView.buffer.set_text(this._settings.get_string('debug-log'), -1));

        const debugOptsGroup = new Adw.PreferencesGroup({
            title: _('Debug options'),
        });
        debugPage.add(debugOptsGroup);

        this._addComboBox(debugOptsGroup, this._settings,
            'debug-timestamp',
            'Timestamp format',
            'Sets absolute (ISO format) or relative (in ms) timestamp',
            { "Absolute": "abs", "Relative": "rel" }
        )

        this._addComboBox(debugOptsGroup, this._settings,
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
            this._settings.set_string('debug-log', '');
        });
        clearDebugLogRow.add_suffix(clearDebugLogButton);
        debugOptsGroup.add(clearDebugLogRow);
    }
}

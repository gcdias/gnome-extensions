import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/* TODO: other picture-of-the-day API include:
/ -NASA APOD: https://github.com/nasa/apod-api (requires AUTH-KEY)
/ -Wikipedia: https://en.wikipedia.org/w/api.php?action=query&generator=images&titles=Template:POTD/2026-11-07&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*
/   -JSON: {
  "batchcomplete": "",
  "query": {
    "pages": {
      "44507575": {
        "pageid": 44507575,
        "ns": 6,
        "title": "File:Grüngelbes Gallertkäppchen Leotia lubrica.JPG",
        "imagerepository": "shared",
        "imageinfo": [
          {
            "url": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Gr%C3%BCngelbes_Gallertk%C3%A4ppchen_Leotia_lubrica.JPG?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original",
            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Gr%C3%BCngelbes_Gallertk%C3%A4ppchen_Leotia_lubrica.JPG",
            "descriptionshorturl": "https://commons.wikimedia.org/w/index.php?curid=35657775",
            "extmetadata": {
              "DateTime": {
                "value": "2014-09-26 07:15:05",
                "source": "mediawiki-metadata",
                "hidden": ""
              },   
    ...
*/

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
            if (row.selected !== index && index >= 0)
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


        const wpGroup = new Adw.PreferencesGroup({
            title: _('Wallpaper'),
        });
        page.add(wpGroup);

        this._addComboBox(wpGroup, settings,
            'wp-source',
            'Wallpaper',
            'Select the source of wallpaper',
            { "Default" : "off", "User": "user", "Bing": "bing", "Picsum": "picsum" }
        )

        const bingIndexRow = this._addSpinRow(wpGroup, settings,
            'bing-index',
            'Bing Wallpaper Index',
            'Select the index of the Bing wallpaper to use.',
             0, 10, 1, 2
        );
        const updateBingIndexSubtitle = () => {
            const metadata = settings.get_string('bing-metadata');
            const copyright = metadata ? JSON.parse(metadata).copyright : null;
            bingIndexRow.subtitle = copyright || _('Select the index of the Bing wallpaper to use.');
        };
        updateBingIndexSubtitle();
        settings.connect('changed::bing-metadata', updateBingIndexSubtitle);
        
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

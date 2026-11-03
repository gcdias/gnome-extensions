// https://gjs-docs.gnome.org/gjs/

import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf'; 
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const extname = 'bing-n-tint';


Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');
const loop = new GLib.MainLoop(null, false);

const gnomeDesktop = {
    settings: new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}),
    yaruNames: [
        'Yaru-red',
        'Yaru',
        'Yaru-yellow',
        'Yaru-olive',
        'Yaru-olive',
        'Yaru-prussiangreen',
        'Yaru-prussiangreen',
        'Yaru-blue',
        'Yaru-blue',
        'Yaru-purple',
        'Yaru-magenta',
        'Yaru-magenta'
    ],
    isDarkMode: function() {
        return gnomeDesktop.settings.get_string('color-scheme') === 'prefer-dark';
    },
    getThemeName: function(hue) {
        const l = gnomeDesktop.yaruNames.length;
        hue = ((hue + 180/l + 360) % 360).toFixed(0); // Normalize hue to [0, 360) middle point
        const index = Math.floor((hue / 360) * l % l);
        const dark = gnomeDesktop.isDarkMode();
        const name = gnomeDesktop.yaruNames[index] + (dark ? '-dark' : '');
        console.log(`Yaru theme: ${name} (hue: ${hue}, index: ${index})`);
        return name;
    },
    getColorName: function(hue) {
        const l = gnomeDesktop.yaruNames.length;
        hue = ((hue + 180/l + 360) % 360).toFixed(0); // Normalize hue to [0, 360) middle point
        const index = Math.floor((hue / 360) * l % l);
        let name = gnomeDesktop.yaruNames[index].replaceAll('-dark', '').replaceAll('Yaru', '').replaceAll('-', '');
        if (!name || name === '')
            name = 'orange'; // fallback to orange if accentName is empty
        console.log(`Yaru accent: ${name} (hue: ${hue}, index: ${index})`);
        return name;
    }
}

async function download(url, callback) {
    const session = new Soup.Session();
    const msg = Soup.Message.new('GET', url);
    const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
    if (msg.get_status() !== Soup.Status.OK)
        throw new Error(`HTTP ${msg.get_status()}: ${msg.get_reason_phrase()}`);
    if (callback)
        callback(bytes);
}

const wallpaper = {
    settings: new Gio.Settings({schema_id: 'org.gnome.desktop.background'}),
    getPath: function() {
        // "none" means no image, only a solid/gradient color
        if (wallpaper.settings.get_string('picture-options') === 'none')
            return null;
        // GNOME 42+ has separate keys for light and dark mode
        const dark = gnomeDesktop.isDarkMode();
        const uri = wallpaper.settings.get_string(dark ? 'picture-uri-dark' : 'picture-uri');
        let path = uri ? Gio.File.new_for_uri(uri).get_path() : null;   // null if not a local file
        if (path && path.endsWith('.xml')) {
            const [ok, bytes] = GLib.file_get_contents(path);
            if (!ok)
                return null;
            const match = new TextDecoder().decode(bytes).match(/<file[^>]*>\s*([^<\s]+)\s*<\/file>/);
            if (!match)
                return null;
            path = match[1];
        }
        return path;
    },
    getAverageColor: function() {
        let path = wallpaper.getPath();
        if (!path)
            return null;
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 64, 64, true);
        const one = pixbuf.scale_simple(1, 1, GdkPixbuf.InterpType.HYPER);
        const [r, g, b] = one.get_pixels();
        return {r, g, b};
    },
    getScreenResolution: function() {
        const mon = Gdk.Display.get_default()?.get_primary_monitor();
        const g = mon?.get_geometry();
        const s = mon?.get_scale_factor();
        console.log(`Screen resolution: ${g?.width}x${g?.height}, scale: ${s}`);
        return g && s ? [g.width * s, g.height * s] : [1920, 1080];
    },
    getBingWallpaper: function(callback) {
        const [width, height] = wallpaper.getScreenResolution();
        const url = `https://bing.biturl.top/?resolution=${width}x${height}&format=json&index=0&mkt=en-US`;
        download(url, (bytes) => {
            const json = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            const uri = json.url;
            download(uri, (bytes) => {
                const path = GLib.build_filenamev([GLib.get_user_cache_dir(), extname, 'bing-wallpaper.jpg']);
                GLib.mkdir_with_parents(GLib.build_filenamev([GLib.get_user_cache_dir(), extname]), 0o755);
                GLib.file_set_contents(path, bytes.get_data());
                const dark = gnomeDesktop.isDarkMode();
                wallpaper.settings.set_string(dark ? 'picture-uri-dark' : 'picture-uri', `file://${path}`);
                if (callback)
                    callback();
            });
        });
    }
}

const color = {
    rgbToHex: (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''),
    rgbToHsl: function(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b);
        let min = Math.min(r, g, b);
        let d = max - min;
        let h;
        if (d === 0) h = 0;
        else if (max === r) h = (g - b) / d % 6;
        else if (max === g) h = (b - r) / d + 2;
        else if (max === b) h = (r - g) / d + 4;
        let l = (min + max) / 2;
        let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
        return [Math.round(h * 60), s, l];
    },
    hslToRgb: function(h, s, l) {
        let c = (1 - Math.abs(2 * l - 1)) * s;
        let hp = h / 60.0;
        let x = c * (1 - Math.abs((hp % 2) - 1));
        let rgb1;
        if (isNaN(h)) rgb1 = [0, 0, 0];
        else if (hp <= 1) rgb1 = [c, x, 0];
        else if (hp <= 2) rgb1 = [x, c, 0];
        else if (hp <= 3) rgb1 = [0, c, x];
        else if (hp <= 4) rgb1 = [0, x, c];
        else if (hp <= 5) rgb1 = [x, 0, c];
        else if (hp <= 6) rgb1 = [c, 0, x];
        let m = l - c * 0.5;
        return [
            Math.round(255 * (rgb1[0] + m)),
            Math.round(255 * (rgb1[1] + m)),
            Math.round(255 * (rgb1[2] + m))];
    },
    normHue: function(h, round = true) {
        const hue = ((h % 360) + 360) % 360;
        return round ? Math.round(hue) : hue;
    },
    rgb2hsl: function(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        const l = (max + min) / 2;
        if (!d)
            return [0, 0, l];
        const h = max === r ? (g - b) / d % 6
                : max === g ? (b - r) / d + 2
                : (r - g) / d + 4;
        const s = d / (1 - Math.abs(2 * l - 1));
        return [Math.round(h * 60), s, l];
    },
    hsl2rgb: function(h, s, l) {
        const invalidHue = isNaN(h);
        const a = invalidHue ? 0 : s * Math.min(l, 1 - l);
        const hue = invalidHue ? 0 : color.normHue(h, false) / 30;
        const channel = n => {
            const k = (n + hue) % 12;
            return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        return [channel(0), channel(8), channel(4)];
    }
}

export default class ShellTheme extends Extension {

    enable() {
        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        this._settings = this.getSettings();
        this._ids = [
            [wallpaper.settings, wallpaper.settings.connect('changed', () => this._update())],
            [gnomeDesktop.settings, gnomeDesktop.settings.connect('changed::color-scheme', () => this._update())],
            [this._settings, this._settings.connect('changed::saturation', () => this._update())],
            [this._settings, this._settings.connect('changed::hue-shell-shift', () => this._update())],
            [this._settings, this._settings.connect('changed::hue-accent-shift', () => this._update())],
            [this._settings, this._settings.connect('changed::wp-source', () => this._loadWallpaper())],
            [this._settings, this._settings.connect('changed::icon-theme-src', () => this._update())],
            [this._settings, this._settings.connect('changed::gtk-theme-src', () => this._update())],
            [this._settings, this._settings.connect('changed::accent-color-src', () => this._update())],
        ];
        this._originalThemeSettings = {
            'icon-theme': gnomeDesktop.settings.get_string('icon-theme'),
            'gtk-theme': gnomeDesktop.settings.get_string('gtk-theme'),
            'accent-color': gnomeDesktop.settings.get_string('accent-color'),
        };
        this._lastThemeSettings = {};
        this._loadWallpaper();
    }

    _loadWallpaper() {
        if (this._settings.get_string('wp-source') === 'bing')
            wallpaper.getBingWallpaper(() => this._update());
        else
            this._update();
    }

    disable() {
        if (this._customStylesheet)
            this._theme.unload_stylesheet(this._customStylesheet);
        this._ids.forEach(([obj, id]) => obj.disconnect(id));
        this._ids = null;
        this._customStylesheet = null;
        this._theme = null;
        this._settings = null;
        this._originalThemeSettings = null;
        this._lastThemeSettings = null;
    }

    _applyThemeSetting(setting, sourceKey, hue, shift, getName) {
        const source = this._settings.get_string(sourceKey);
        if (source === 'user') {
            this._restoreUserThemeSetting(setting, sourceKey);
            return;
        }

        const value = getName(hue + (source === 'shift' ? shift : 0));
        gnomeDesktop.settings.set_string(setting, value);
        this._lastThemeSettings[setting] = value;
    }

    _restoreUserThemeSetting(setting, sourceKey) {
        if (this._settings.get_string(sourceKey) !== 'user')
            return;

        const lastValue = this._lastThemeSettings[setting];
        if (lastValue !== undefined &&
            gnomeDesktop.settings.get_string(setting) === lastValue)
            gnomeDesktop.settings.set_string(setting, this._originalThemeSettings[setting]);
        delete this._lastThemeSettings[setting];
    }

    _update() {
        // debug with journalctl -f -o cat /usr/bin/gnome-shell
        let wpColor = wallpaper.getAverageColor();
        if (!wpColor) {
            this._restoreUserThemeSetting('icon-theme', 'icon-theme-src');
            this._restoreUserThemeSetting('gtk-theme', 'gtk-theme-src');
            this._restoreUserThemeSetting('accent-color', 'accent-color-src');
            return;
        }

        const [h, s, l] = color.rgb2hsl(wpColor.r, wpColor.g, wpColor.b);    
        const hue_shell_shift = this._settings.get_int('hue-shell-shift');
        const hue_accent_shift = this._settings.get_int('hue-accent-shift');
        const sat = this._settings.get_int('saturation')/100;

        this._applyThemeSetting('icon-theme', 'icon-theme-src', h, hue_shell_shift, gnomeDesktop.getThemeName);
        this._applyThemeSetting('gtk-theme', 'gtk-theme-src', h, hue_shell_shift, gnomeDesktop.getThemeName);
        this._applyThemeSetting('accent-color', 'accent-color-src', h, hue_accent_shift, gnomeDesktop.getColorName);
        const yaruThemeName = gnomeDesktop.settings.get_string('icon-theme');
        const accentName = gnomeDesktop.settings.get_string('accent-color');

        let accentHex = color.hsl2rgb(h + hue_accent_shift, sat, 0.5);
        accentHex = color.rgbToHex(accentHex[0], accentHex[1], accentHex[2]);

        console.log(`avg-in: rgb(${wpColor.r}, ${wpColor.g}, ${wpColor.b}) hue: ${h}, bkShift: ${hue_shell_shift}, acShift: ${hue_accent_shift}, shell: ${yaruThemeName}, accent: ${accentName}, accentHex: ${accentHex}`);      

        const stylesheetPath = GLib.build_filenamev([this.path, 'stylesheet.css']);
        const [success, contents] = Gio.File.new_for_path(stylesheetPath).load_contents(null);
        if (!success)
            throw new Error('Gnome Theme Color: could not read stylesheet.css');


        const stylesheet = new TextDecoder().decode(contents).replaceAll('-st-accent-color', accentHex);
        const cacheDirectory = GLib.build_filenamev([GLib.get_user_cache_dir(), extname]);
        GLib.mkdir_with_parents(cacheDirectory, 0o755);

        if (this._customStylesheet)
            this._theme.unload_stylesheet(this._customStylesheet);

        this._customStylesheetPath = GLib.build_filenamev([cacheDirectory, 'theme-color.css']);
        GLib.file_set_contents(this._customStylesheetPath, stylesheet);

        this._customStylesheet = Gio.File.new_for_path(this._customStylesheetPath);
        this._theme.load_stylesheet(this._customStylesheet);

    }
}
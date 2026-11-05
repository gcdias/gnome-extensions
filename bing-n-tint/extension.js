// https://gjs-docs.gnome.org/gjs/

import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk?version=4.0';
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
        const monitors = Gdk.Display.get_default()?.get_monitors();
        const mon = monitors?.get_item(0);
        const g = mon?.get_geometry();
        const s = mon?.get_scale_factor();
        console.log(`Screen resolution: ${g?.width}x${g?.height}, scale: ${s}`);
        return g && s ? [g.width * s, g.height * s] : [1920, 1080];
    },

    getBingWallpaper: async function(index = 0) {
        const [width, height] = wallpaper.getScreenResolution();
        const url = `https://bing.biturl.top/?resolution=${width}x${height}&format=json&index=${index}&mkt=en-US`;
        const metadata = await utils.download(url);
        const {url: imageUrl} = JSON.parse(new TextDecoder().decode(metadata.get_data()));
        const bytes = await utils.download(imageUrl);
        const cacheDirectory = GLib.build_filenamev([GLib.get_user_cache_dir(), extname]);
        const path = GLib.build_filenamev([cacheDirectory, 'bing-wallpaper.jpg']);
        GLib.mkdir_with_parents(cacheDirectory, 0o755);
        GLib.file_set_contents(path, bytes.get_data());
        const dark = gnomeDesktop.isDarkMode();
        wallpaper.settings.set_string(dark ? 'picture-uri-dark' : 'picture-uri', `file://${path}`);
    }
}

const utils = {
    rgbToHex: (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''),
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
        return [utils.normHue(h * 60, true), s, l];
    },
    hsl2rgb: function(h, s, l) {
        const invalidHue = isNaN(h);
        const a = invalidHue ? 0 : s * Math.min(l, 1 - l);
        const hue = invalidHue ? 0 : utils.normHue(h, false) / 30;
        const channel = n => {
            const k = (n + hue) % 12;
            return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        return [channel(0), channel(8), channel(4)];
    },
    download: async function (url) {
        const session = new Soup.Session();
        const msg = Soup.Message.new('GET', url);
        const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
        if (msg.get_status() !== Soup.Status.OK)
            throw new Error(`HTTP ${msg.get_status()}: ${msg.get_reason_phrase()}`);
        return bytes;
    },
    pct: function(value) {
        return (value * 100).toFixed(0) + '%';
    }
}

export default class BingNTint extends Extension {

    _loadWallpaper() {
        if (this._settings.get_string('wp-source') === 'bing'){
            wallpaper.getBingWallpaper(this._bingIndex)
                .then(() => {
                    console.log(`Bing wallpaper loaded successfully at index ${this._bingIndex}, updating theme settings...`);
                    this._lastBingDownloadTime = Date.now();
                    this._update();
                })
                .catch(error => {
                    console.error(`Failed to load Bing wallpaper: ${error}`);
                });
            }
    }

    _applyThemeSetting(setting, sourceKey, hue, shift, getName) {
        const source = this._settings.get_string(sourceKey);
        if (source === 'user') {
            this._restoreUserThemeSetting(setting, sourceKey);
            return;
        }

        const value = getName(hue + (source === 'shift' ? shift : 0));
        gnomeDesktop.settings.set_string(setting, value);
        console.log(`Set ${setting} to ${value} (source: ${source}, hue: ${hue}, shift: ${shift})`);
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

    _decodeCss(filename) {
        const filePath = GLib.build_filenamev([this.path, filename]);
        const [success, contents] = Gio.File.new_for_path(filePath).load_contents(null);
        if (!success)
            throw new Error(`Gnome Theme Color: could not read ${filename}`);
        return new TextDecoder().decode(contents);
    }

    _loadExtensionFile(fname) {
        const filePath = GLib.build_filenamev([this.path, fname]);
        const [success, contents] = Gio.File.new_for_path(filePath).load_contents(null);
        if (!success)
            throw new Error(`Gnome Theme Color: could not read ${fname}`);
        return new TextDecoder().decode(contents);
    }

    _saveFile(dir, fname, contents) {
        GLib.mkdir_with_parents(dir, 0o755);
        const path = GLib.build_filenamev([dir, fname]);
        const [success, bytesWritten] = GLib.file_set_contents(path, contents);
        if (!success)
            throw new Error(`Gnome Theme Color: could not write ${path}`);
        return [path, bytesWritten];
    }

    enable() {
        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        this._settings = this.getSettings();
        this._bingIndex = 0;
        this._prefersDark = gnomeDesktop.isDarkMode();

        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), extname]);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);

        this._customStylesheet = null;

        this._ids = [
            [wallpaper.settings, wallpaper.settings.connect('changed', () => this._update())],
            [gnomeDesktop.settings, gnomeDesktop.settings.connect('changed::color-scheme', () => this._update())],
            [this._settings, this._settings.connect('changed::saturation',       () => this._update())],
            [this._settings, this._settings.connect('changed::hue-shell-shift',  () => this._update())],
            [this._settings, this._settings.connect('changed::hue-accent-shift', () => this._update())],
            [this._settings, this._settings.connect('changed::wp-source',        () => this._loadWallpaper())],
            [this._settings, this._settings.connect('changed::icon-theme-src',   () => this._update())],
            [this._settings, this._settings.connect('changed::gtk-theme-src',    () => this._update())],
            [this._settings, this._settings.connect('changed::accent-color-src', () => this._update())],
        ];
        this._originalThemeSettings = {
            'icon-theme':   gnomeDesktop.settings.get_string('icon-theme'),
            'gtk-theme':    gnomeDesktop.settings.get_string('gtk-theme'),
            'accent-color': gnomeDesktop.settings.get_string('accent-color'),
        };
        this._lastThemeSettings = {};
        this._update();
        this._loadWallpaper();
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

    _applyPalette(css, palette) {
        for (const [key, value] of Object.entries(palette)) {
            css = css.replaceAll(key, value);
        }
        return css;
    }

    _update() {
        // debug with journalctl -f -o cat /usr/bin/gnome-shell
        let wpColor = wallpaper.getAverageColor();
        if (!wpColor) {
            this._restoreUserThemeSetting('icon-theme',   'icon-theme-src');
            this._restoreUserThemeSetting('gtk-theme',    'gtk-theme-src');
            this._restoreUserThemeSetting('accent-color', 'accent-color-src');
            return;
        }

        const [h, s, l] = utils.rgb2hsl(wpColor.r, wpColor.g, wpColor.b);    
        const hue_shell_shift  = this._settings.get_int('hue-shell-shift');
        const hue_accent_shift = this._settings.get_int('hue-accent-shift');
        const sat = this._settings.get_int('saturation')/100;

        this._applyThemeSetting('icon-theme',   'icon-theme-src',   h, hue_accent_shift, gnomeDesktop.getThemeName);
        this._applyThemeSetting('accent-color', 'accent-color-src', h, hue_accent_shift, gnomeDesktop.getColorName);
        this._applyThemeSetting('gtk-theme',    'gtk-theme-src',    h, hue_shell_shift,  gnomeDesktop.getThemeName);

        let baseColorHex = utils.hsl2rgb(h + hue_shell_shift, sat, 0.5);
        baseColorHex = utils.rgbToHex(baseColorHex[0], baseColorHex[1], baseColorHex[2]);
        let cssSat = [ utils.pct(0.2 + sat * 0.8), utils.pct(sat * 0.4), utils.pct(sat * 0.2) ];
        let gtkSat = sat / 5;

        console.log(`avg-in: rgb(${wpColor.r}, ${wpColor.g}, ${wpColor.b}) hue: ${h}, sat: ${sat}, bkShift: ${hue_shell_shift}, acShift: ${hue_accent_shift}, accentHex: ${baseColorHex}`);

        const cssPalette = {
            "-st-accent-color": baseColorHex,
            "-st-sat0": cssSat[0],
            "-st-sat1": cssSat[1],
            "-st-sat2": cssSat[2]
        }

        const stylesheet = this._applyPalette(this._decodeCss('stylesheet.src'), cssPalette);

        if (this._customStylesheet)
            this._theme.unload_stylesheet(this._customStylesheet);
        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        const customStylesheetPath = GLib.build_filenamev([this._cacheDir, 'theme-color.css']);
        GLib.file_set_contents(customStylesheetPath, stylesheet);
        this._customStylesheet = Gio.File.new_for_path(customStylesheetPath);
        this._theme.load_stylesheet(this._customStylesheet);

        const gtkcss = this._applyPalette(this._decodeCss('gtk.css'), { '@base_color': baseColorHex, '@base-sat': gtkSat });
        const gtkCssDirectory = GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-4.0']);
        const gtkCssPath = GLib.build_filenamev([gtkCssDirectory, 'gtk.css']);
        GLib.mkdir_with_parents(gtkCssDirectory, 0o755);
        GLib.file_set_contents(gtkCssPath, gtkcss);
        console.log(`GTK CSS written to ${gtkCssPath}`);
    }
}
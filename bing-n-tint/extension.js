// https://gjs-docs.gnome.org/gjs/

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf'; 
import Gdk from 'gi://Gdk?version=4.0';
import Soup from 'gi://Soup?version=3.0';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const EXTNAME = 'bing-n-tint';
const DEBUG_LOG_MAX_LINES = 200;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let debugSettings = null;

function formatTimestamp(date) {
    const pad = (value, length = 2) => String(value).padStart(length, '0');
    return `${MONTHS[date.getUTCMonth()]}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}.${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

function log(...args) {

    const message = args.map(String).join(' ');
    
    if (message === 'RESET'){
        debugSettings.set_string('debug-log', '');
        return;
    }

    const timestamp = new Date().toISOString();
    console.log(`${timestamp} ${message}`);

    if (debugSettings) {
        const lines = debugSettings.get_string('debug-log').split('\n').filter(Boolean);
        lines.push(`${timestamp} ${message}`);
        debugSettings.set_string('debug-log', lines.slice(-DEBUG_LOG_MAX_LINES).join('\n'));
    }
}

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

const gnome = {
    
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

    accentColors: [
        'red',
        'orange',
        'yellow',
        'green',
        'teal',
        'blue',
        'purple',
        'pink'
    ],  

    isDarkMode: function() {
        log('FN gnome.isDarkMode()');
        const out = gnome.settings.get_string('color-scheme') === 'prefer-dark';
        log(`>> Dark mode: ${out}`);
        return out;
    },

    getIndex: function(hue, arrayLength) {
        log(`FN gnome.getIndex(hue:${hue}, arrLen:${arrayLength})`);
        // Normalize hue to [0, 360) to middle point
        hue = utils.normHue(hue + 180/arrayLength);
        const index = Math.floor((hue / 360) * arrayLength % arrayLength);
        const out = Math.max(0, index % arrayLength);
        log(`>> Index: ${out}`);
        return out;
    },
    
    getThemeName: function(hue) {
        log(`FN gnome.getThemeName(hue:${hue})`);
        const index = gnome.getIndex(hue, gnome.yaruNames.length);
        const name = gnome.yaruNames[index] + (gnome.isDarkMode() ? '-dark' : '');
        log(`>> getThemeName: ${name} (index: ${index})`);
        return name;
    },

    getColorName: function(hue) {
        log(`FN gnome.getColorName(hue:${hue})`);
        const index = gnome.getIndex(hue, gnome.accentColors.length);
        const name = gnome.accentColors[index];
        log(`>> getColorName: ${name} (index: ${index})`);
        return name;
    },
}

const wallpaper = {

    settings: new Gio.Settings({schema_id: 'org.gnome.desktop.background'}),

    getPath: function() {
        log('FN wallpaper.getPath()');
        // "none" means no image, only a solid/gradient color
        if (wallpaper.settings.get_string('picture-options') === 'none')
            return null;
        // GNOME 42+ has separate keys for light and dark mode
        const dark = gnome.isDarkMode();
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
        log(`>> Wallpaper path: ${path}`);
        return path;
    },

    getAverageColor: function() {
        log('FN wallpaper.getAverageColor()');
        let path = wallpaper.getPath();
        if (!path)
            return null;
        const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 64, 64, true);
        const one = pixbuf.scale_simple(1, 1, GdkPixbuf.InterpType.HYPER);
        const [r, g, b] = one.get_pixels();
        log(`>> Average color: rgb(${r}, ${g}, ${b})`);
        return {r, g, b};
    },

    getScreenResolution: function() {
        log('FN wallpaper.getScreenResolution()');
        const monitors = Gdk.Display.get_default()?.get_monitors();
        const mon = monitors?.get_item(0);
        const g = mon?.get_geometry();
        const s = mon?.get_scale_factor();
        log(`Screen resolution: ${g?.width}x${g?.height}, scale: ${s}`);
        const out = g && s ? [g.width * s, g.height * s] : [1920, 1080];
        log(`>> Output resolution: ${out[0]}x${out[1]}`);
        return out;
    },

    getBingWallpaper: async function(index = 0) {
        log(`FN wallpaper.getBingWallpaper(index:${index})`);
        const [width, height] = wallpaper.getScreenResolution();
        const url = `https://bing.biturl.top/?resolution=${width}x${height}&format=json&index=${index}&mkt=en-US`;
        log(`>> Fetching Bing wallpaper metadata from ${url}...`);
        const metadata = await utils.download(url);
        const {url: imageUrl} = JSON.parse(new TextDecoder().decode(metadata.get_data()));
        const bytes = await utils.download(imageUrl);
        const cacheDirectory = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        const path = GLib.build_filenamev([cacheDirectory, 'bing-wallpaper.jpg']);
        GLib.mkdir_with_parents(cacheDirectory, 0o755);
        GLib.file_set_contents(path, bytes.get_data());
        log(`>> Bing wallpaper downloaded to ${path}`);
        const dark = gnome.isDarkMode();
        wallpaper.settings.set_string(dark ? 'picture-uri-dark' : 'picture-uri', `file://${path}`);
    }
}

const utils = {
    rgbToHex: (r, g, b) => {
        log(`FN utils.rgbToHex(r:${r}, g:${g}, b:${b})`);
        const out = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        log(`>> Hex color: ${out}`);
        return out;
    },
    hexToRgb: (hex) => {
        log(`FN utils.hexToRgb(hex:${hex})`);
        const [r, g, b] = hex.slice(1).match(/../g).map(x => parseInt(x, 16));
        log(`>> RGB color: rgb(${r}, ${g}, ${b})`);
        return [r, g, b];
    },
    normHue: function(h, round = true) {
        log(`FN utils.normHue(hue:${h}, round? ${round})`);
        const hue = ((h % 360) + 360) % 360;
        const out = round ? Math.round(hue) : hue;
        log(`>> Normalized hue: ${out}`);
        return out;
    },
    rgb2hsl: function(r, g, b) {
        log(`FN utils.rgb2hsl(r:${r}, g:${g}, b:${b})`);
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
        const out = [utils.normHue(h * 60, true), s.toFixed(2), l.toFixed(2)];
        log(`>> HSL color: hsl(${out[0]}, ${out[1]}, ${out[2]})`);
        return out;
    },
    hsl2rgb: function(h, s, l) {
        log(`FN utils.hsl2rgb(h:${h}, s:${s}, l:${l})`);
        const invalidHue = isNaN(h);
        const a = invalidHue ? 0 : s * Math.min(l, 1 - l);
        const hue = invalidHue ? 0 : utils.normHue(h, false) / 30;
        const channel = n => {
            const k = (n + hue) % 12;
            return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        const out = [channel(0), channel(8), channel(4)];
        log(`>> RGB color: rgb(${out[0]}, ${out[1]}, ${out[2]})`);
        return out;
    },
    download: async function (url) {
        log(`FN utils.download(url:${url}`);
        const session = new Soup.Session();
        const msg = Soup.Message.new('GET', url);
        const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
        if (msg.get_status() !== Soup.Status.OK)
            throw new Error(`HTTP ${msg.get_status()}: ${msg.get_reason_phrase()}`);
        return bytes;
    },
    pct: function(value) {
        log(`FN utils.pct(value:${value})`);
        const out = (value * 100).toFixed(0) + '%';
        log(`>> ${out}`);
        return out;
    }
}

export default class BingNTint extends Extension {

    _applyPalette(css, palette) {
        log(`FN BingNTint._applyPalette(<css>, palette:${palette})`);
        for (const [key, value] of Object.entries(palette)) {
            css = css.replaceAll(key, value);
        }
        return css;
    }

    _applyThemeSetting(setting, sourceKey, hue, shift, getName) {
        log(`FN BingNTint._applyThemeSetting(setting:${setting}, sourceKey:${sourceKey}, hue:${hue}, shift:${shift}, <fn>})`);
        const source = this._settings.get_string(sourceKey);
        if (source === 'user') {
            this._restoreUserThemeSetting(setting, sourceKey);
            return;
        }
        const value = getName(hue + (source === 'shift' ? shift : 0));
        gnome.settings.set_string(setting, value);
        this._lastThemeSettings[setting] = value;
    }

    _restoreUserThemeSetting(setting, sourceKey) {
        log(`FN BingNTint._restoreUserThemeSetting(setting:${setting}, sourceKey:${sourceKey})`);
        if (this._settings.get_string(sourceKey) !== 'user')
            return;

        const lastValue = this._lastThemeSettings[setting];
        if (lastValue !== undefined &&
            gnome.settings.get_string(setting) === lastValue)
            gnome.settings.set_string(setting, this._originalThemeSettings[setting]);
        delete this._lastThemeSettings[setting];
    }

    _decodeCss(filename) {
        log(`FN BingNTint._decodeCss(filename:${filename})`);
        const filePath = GLib.build_filenamev([this.path, filename]);
        const [success, contents] = Gio.File.new_for_path(filePath).load_contents(null);
        if (!success)
            throw new Error(`Gnome Theme Color: could not read ${filename}`);
        const out = new TextDecoder().decode(contents)
        log (`>> (${out.length} chars)`);
        return out;
    }

    _loadWallpaper() {
        log('FN BingNTint._loadWallpaper()');
        this._bingIndex = this._settings.get_int('bing-index');
        if (this._settings.get_string('wp-source') === 'bing'){
            wallpaper.getBingWallpaper(this._bingIndex)
                .then(result => {
                    log(`Bing wallpaper loaded successfully at index ${this._bingIndex}, updating theme settings...`);
                    this._lastBingDownloadTime = Date.now();
                    this._update();
                })
                .catch(error => {
                    log(`ERR: BingNTint._loadWallpaper.catch ${error}`);
                });
            }
    }
    

    enable() {
        this._settings = this.getSettings();
        debugSettings = this._settings;
        log('RESET');
        log('INIT BingNTint.enable()');
        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        this._bingIndex = 0;
        this._prefersDark = gnome.isDarkMode();

        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);

        this._customStylesheet = null;

        this._ids = [
            [wallpaper.settings, wallpaper.settings.connect('changed', (...args) => {
                log('INFO BingNTint.enable.wallpaperChanged -> _update()');
                this._update();
            })],
            [gnome.settings, gnome.settings.connect('changed::color-scheme', (...args) => {
                log('INFO BingNTint.enable.colorSchemeChanged -> _update()');
                this._update();
            })],
            [this._settings, this._settings.connect('changed::wp-source', (...args) => {
                log('INFO BingNTint.enable.wallpaperSourceChanged -> _loadWallpaper()');
                this._loadWallpaper();
            })],
            [this._settings, this._settings.connect('changed::bing-index', (...args) => {
                log('INFO BingNTint.enable.bingIndexChanged -> _loadWallpaper()');
                this._loadWallpaper();
            })],
            [this._settings, this._settings.connect('changed::icon-theme-src', (...args) => {
                log('INFO BingNTint.enable.iconThemeSourceChanged -> _update()');
                this._update();
            })],
            [this._settings, this._settings.connect('changed::gtk-theme-src', (...args) => {
                log('INFO BingNTint.enable.gtkThemeSourceChanged -> _update()');
                this._update();
            })],
            [this._settings, this._settings.connect('changed::accent-color-src', (...args) => {
                log('INFO BingNTint.enable.accentColorSourceChanged -> _update()');
                this._update();
            })],
            [this._settings, this._settings.connect('changed::saturation', (...args) => {
                log('INFO BingNTint.enable.saturationChanged -> _update()');
                this._update();
            })],
            [this._settings, this._settings.connect('changed::hue-shell-shift', (...args) => {
                log('INFO BingNTint.enable.shellHueShiftChanged -> _update()');
                this._update();
            })],
            [this._settings, this._settings.connect('changed::hue-accent-shift', (...args) => {
                log('INFO BingNTint.enable.accentHueShiftChanged -> _update()');
                this._update();
            })],
        ];
        this._originalThemeSettings = {
            'icon-theme':   gnome.settings.get_string('icon-theme'),
            'gtk-theme':    gnome.settings.get_string('gtk-theme'),
            'accent-color': gnome.settings.get_string('accent-color'),
        };
        this._lastThemeSettings = {};
        this._update();
        this._loadWallpaper();
    }
    
    disable() {
        log('FN BingNTint.disable()');
        if (this._customStylesheet)
            this._theme.unload_stylesheet(this._customStylesheet);
        this._ids.forEach(([obj, id]) => {
            obj.disconnect(id);
        });
        this._ids = null;
        this._customStylesheet = null;
        this._theme = null;
        this._settings = null;
        this._originalThemeSettings = null;
        this._lastThemeSettings = null;
        debugSettings = null;
    }

    _update() {
        log('FN BingNTint._update()');
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

        this._applyThemeSetting('icon-theme',   'icon-theme-src',   h, hue_accent_shift, gnome.getThemeName);
        this._applyThemeSetting('accent-color', 'accent-color-src', h, hue_accent_shift, gnome.getColorName);
        this._applyThemeSetting('gtk-theme',    'gtk-theme-src',    h, hue_shell_shift,  gnome.getThemeName);

        let baseColorHex = utils.hsl2rgb(h + hue_shell_shift, sat, 0.5);
        baseColorHex = utils.rgbToHex(baseColorHex[0], baseColorHex[1], baseColorHex[2]);
        let cssSat = [ utils.pct(0.2 + sat * 0.8), utils.pct(sat * 0.4), utils.pct(sat * 0.2) ];
        let gtkSat = sat / 5;

        log(`avg-in: rgb(${wpColor.r}, ${wpColor.g}, ${wpColor.b}) hue: ${h}, sat: ${sat}, bkShift: ${hue_shell_shift}, acShift: ${hue_accent_shift}, accentHex: ${baseColorHex}`);

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
        log(`Custom Stylesheet written to ${customStylesheetPath}`);

        const gtkcss = this._applyPalette(this._decodeCss('gtk.css'), { '@base_color': baseColorHex, '@base-sat': gtkSat });
        const gtkCssDirectory = GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-4.0']);
        const gtkCssPath = GLib.build_filenamev([gtkCssDirectory, 'gtk.css']);
        GLib.mkdir_with_parents(gtkCssDirectory, 0o755);
        GLib.file_set_contents(gtkCssPath, gtkcss);
        log(`GTK CSS written to ${gtkCssPath}`);
    }
}
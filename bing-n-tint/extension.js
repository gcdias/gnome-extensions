// https://gjs-docs.gnome.org/gjs/

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf'; 
import Soup from 'gi://Soup?version=3.0';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

const EXTNAME = 'bing-n-tint';

const log = {
    IND: 0,
    IND_STEP: 2,
    IND_CHAR: '.',
    MAX: 200,
    settings: null,
    timestamp: 'rel',
    timestamp_ind: 8,
    timestamp_str: "",
    level: 1,
    levels: {
        'fun': 0,
        'ret': 0,
        'INF': 1,
        'ERR': 2
    },

    _getTimeStamp: function(){
        if (log.timestamp === 'rel'){
            const dif = Date.now() - log.starttime;
            return `+${String(log.timestamp_str + dif).slice(-8)}ms`;
        } else {
            return new Date().toISOString;
        }
    },

    _post: function(tag, ...args){
        const message = args ? args.map(String).join(' ') : '';
        const timestamp = log._getTimeStamp();
        const line = `${timestamp}:${log.IND_CHAR.repeat(log.IND)}${tag}: ${message}` 
        console.log(line);
        if (log.settings) {
            const lines = log.settings.get_string('debug-log').split('\n').filter(Boolean);
            lines.push(line);
            log.settings.set_string('debug-log', lines.slice(-log.MAX).join('\n'));
        }
    },
    updateSettings: function(settings){
        log.settings = settings;
        log.level = parseInt(settings.get_string('debug-level'));
        log.timestamp = settings.get_string('debug-timestamp');
    },
    init: function(settings) {
        if (settings){
            log.updateSettings(settings);
            log.IND = 0;
            log.timestamp_str = ' '.repeat(log.timestamp_ind);
            const d = new Date();
            log.starttime = Date.now();
            log.settings.set_string('debug-log',`START: ${d.toISOString()}`);
        }
    },
    dismiss: function(){
        log.IND = 0;
        log.settings = null;
    },
    s: function(args) {
        if (log.level < 1){
            log._post("fun", args);
            log.IND += log.IND_STEP;
        }
    },
    r: function(args) {
        if (log.level < 1){
            log.IND = Math.max(0, log.IND - log.IND_STEP);
            log._post("ret", args);
        }
    },
    i: function(args) {
        if (log.level < 2)
            log._post("INF", args);
    },
    e: function(args) {
        if (log.level < 3)
            log._post("ERR",args);
    }
}

const gnome = {
    
    settings: new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}),
    
    colors: {
        'Yaru-red': 'red',
        'Yaru': 'orange',
        'Yaru-yellow': 'yellow',
        'Yaru-olive': 'green',
        'Yaru-prussiangreen': 'teal',
        'Yaru-blue': 'blue',
        'Yaru-purple': 'purple',
        'Yaru-magenta': 'pink'
    },

    tune: [ 0, 1, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7 ],

    isDarkMode: function() {
        log.s('gnome.isDarkMode()');
        const out = gnome.settings.get_string('color-scheme') === 'prefer-dark';
        log.r(`Dark mode: ${out}`);
        return out;
    },

    getColor: function(hue){
        log.s(`gnome.getColor(hue:${hue})`);
        const len = gnome.tune.length;
        const colors = Object.entries(gnome.colors);
        const i = Math.max(0, Math.floor(utils.normHue(hue + 180 / len) / 360 * len) % len);
        const index = gnome.tune[i];
        const out = colors[index];
        log.r(`Color: ${out} (index: ${index})`);
        return out;
    },
    
    getThemeName: function(hue, prefersDark=true) {
        log.s(`gnome.getThemeName(hue:${hue})`);
        const name = gnome.getColor(hue)[0] + (prefersDark ? '-dark' : '');
        log.r(`getThemeName: ${name}`);
        return name;
    },

    getColorName: function(hue) {
        log.s(`gnome.getColorName(hue:${hue})`);
        const name = gnome.getColor(hue)[1];
        log.r(`getColorName: ${name}`);
        return name;
    },
}

const wallpaper = {

    settings: new Gio.Settings({schema_id: 'org.gnome.desktop.background'}),

    getPath: function(prefersDark=true) {
        log.s(`wallpaper.getPath(prefersDark:${prefersDark})`);
        let path = null;
        
        // "none" means no image, only a solid/gradient color
        if (wallpaper.settings.get_string('picture-options') !== 'none'){
            
            // GNOME 42+ has separate keys for light and dark mode
            const uri = wallpaper.settings.get_string(prefersDark ? 'picture-uri-dark' : 'picture-uri');
            path = uri ? Gio.File.new_for_uri(uri).get_path() : null;   // null if not a local file
            
            // Test for day-night or other xml config wallpaper and get first file occurence
            if (path && path.endsWith('.xml')) {
                const [ok, bytes] = GLib.file_get_contents(path);
                const match = ok ? new TextDecoder().decode(bytes).match(/<file[^>]*>\s*([^<\s]+)\s*<\/file>/) : null;
                path = match ? match[1] : null;
            }
        }
        log.r(`Wallpaper path: ${path ? path : 'null'}`);
        return path;
    },

    getAverageColor: function(prefersDark=true) {
        log.s(`wallpaper.getAverageColor(prefersDark:${prefersDark})`);
        let path = wallpaper.getPath(prefersDark);
        let [r, g, b] = [ 0, 0, 0 ];
        if (path){
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 64, 64, true);
            const one = pixbuf.scale_simple(1, 1, GdkPixbuf.InterpType.HYPER);
            [r, g, b] = one.get_pixels();
        }
        log.r(`Average color: rgb(${r}, ${g}, ${b})`);
        return {r, g, b};
    },

    getScreenResolution: function() {
        log.s('wallpaper.getScreenResolution()');
        const monitor = Main.layoutManager.primaryMonitor;
        const scale = monitor?.geometry_scale ?? 1;
        log.i(`geometry: [ ${monitor?.width}, ${monitor?.height} ], scale: ${scale}`);
        const h = monitor ? Math.round(monitor.height * scale) : 1080;
        const out = h <= 768 ? "1366x768" : h <= 1080 ? "1920x1080" : "UHD";
        log.r(out);
        return out;
    },

    getLangTag: function(){
        log.s('wallpaper.getLangTag()');
        const locale = GLib.get_language_names()[0];
        const languageTag = locale.split(/[.@]/, 1)[0].replace(/_/g, '-');
        log.r(languageTag);
        return languageTag;
    },

    getBingWallpaper: async function(index = 0, prefersDark=true) {
        log.s(`wallpaper.getBingWallpaper(index:${index})`);
        const res = wallpaper.getScreenResolution();
        const tag = wallpaper.getLangTag();
        const url = `https://bing.biturl.top/?resolution=${res}&format=json&index=${index}&mkt=${tag}`;
        log.i(`Fetching Bing wallpaper metadata from ${url}...`);
        const metadata = await utils.download(url);
        const metadataContents = new TextDecoder().decode(metadata.get_data());
        const {url: imageUrl, copyright: cr} = JSON.parse(metadataContents);
        wallpaper.url = imageUrl;
        wallpaper.copyright = cr;
        log.i(`imgUrl: ${wallpaper.url}, desc: ${wallpaper.copyright}`);
        const bytes = await utils.download(imageUrl);
        const cacheDirectory = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        const path = GLib.build_filenamev([cacheDirectory, 'bing-wallpaper.jpg']);
        GLib.mkdir_with_parents(cacheDirectory, 0o755);
        GLib.file_set_contents(path, bytes.get_data());
        log.r(`Bing wallpaper downloaded to ${path}`);
        wallpaper.settings.set_string(prefersDark ? 'picture-uri-dark' : 'picture-uri', `file://${path}`);
        return metadataContents;
    }
}

const utils = {
    rgbToHex: (r, g, b) => {
        log.s(`utils.rgbToHex(r:${r}, g:${g}, b:${b})`);
        const out = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        log.r(`Hex color: ${out}`);
        return out;
    },
    hexToRgb: (hex) => {
        log.s(`utils.hexToRgb(hex:${hex})`);
        const [r, g, b] = hex.slice(1).match(/../g).map(x => parseInt(x, 16));
        log.r(`RGB color: rgb(${r}, ${g}, ${b})`);
        return [r, g, b];
    },
    normHue: function(h, round = true) {
        log.s(`utils.normHue(hue:${h}, round? ${round})`);
        const hue = ((h % 360) + 360) % 360;
        const out = round ? Math.round(hue) : hue;
        log.r(`Normalized hue: ${out}`);
        return out;
    },
    rgb2hsl: function(r, g, b) {
        log.s(`utils.rgb2hsl(r:${r}, g:${g}, b:${b})`);
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
        log.r(`HSL color: hsl(${out[0]}, ${out[1]}, ${out[2]})`);
        return out;
    },
    hsl2rgb: function(h, s, l) {
        log.s(`utils.hsl2rgb(h:${h}, s:${s}, l:${l})`);
        const invalidHue = isNaN(h);
        const a = invalidHue ? 0 : s * Math.min(l, 1 - l);
        const hue = invalidHue ? 0 : utils.normHue(h, false) / 30;
        const channel = n => {
            const k = (n + hue) % 12;
            return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        const out = [channel(0), channel(8), channel(4)];
        log.r(`RGB color: rgb(${out[0]}, ${out[1]}, ${out[2]})`);
        return out;
    },
    download: async function (url) {
        log.s(`utils.download(url:${url}`);
        const session = new Soup.Session();
        const msg = Soup.Message.new('GET', url);
        const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
        if (msg.get_status() !== Soup.Status.OK){
            const err = `HTTP ${msg.get_status()}: ${msg.get_reason_phrase()}`;
            log.e(err);
            throw new Error(err);
        }
        log.r(`end download`);
        return bytes;
    },
    pct: function(value) {
        log.s(`utils.pct(value:${value})`);
        const out = (value * 100).toFixed(0) + '%';
        log.r(`${out}`);
        return out;
    },
    funcName: function(fun){
        var ret = fun.toString();
        ret = ret.substr('function '.length);
        ret = ret.substr(0, ret.indexOf('('));
        return ret;
    }
}

export default class BingNTint extends Extension {

    _loadWallpaper(id) {
        log.s(`BingNTint._loadWallpaper(${id ? id : ''})`);
        this._bingIndex = this._settings.get_int('bing-index');
        if (this._settings.get_string('wp-source') === 'bing'){
            wallpaper.getBingWallpaper(this._bingIndex, this._prefersDark)
                .then((result) => {
                    if(result){
                        this._bingMetadata = JSON.parse(result);
                        this._settings.set_string('bing-metadata', result);
                        log.i(`Bing wallpaper index ${this._bingIndex}: ${this._bingMetadata.url}`);
                    }
                    this._lastBingDownloadTime = Date.now();
                    this._update();
                })
                .catch(error => {
                    log.e(`BingNTint._loadWallpaper.catch ${error}`);
                });
        } else {
            this._update();
        }
        log.r('end _loadWallpaper');
    }

    _connect(setting, fn, id){
        const callback = () => fn.call(this, `settings changed -> ${utils.funcName(fn)}`);
        log.i(`_connect: changed${id}`)
        return [setting, setting.connect(`changed${id ? "::" + id : ''}`, callback)];
    }
    
    _connectId(setting, fn, ...ids){
        if (ids.length > 0){
            for (const id of ids)
                this._ids.push(this._connect(setting, fn, id));
        } else {
            this._ids.push(this._connect(setting, fn));
        }
    }

    _applyPalette(css, palette) {
        log.s(`BingNTint._applyPalette(<css>, palette:${palette})`);
        for (const [key, value] of Object.entries(palette)) {
            css = css.replaceAll(key, value);
        }
        log.r(`done`);
        return css;
    }

    _decodeCss(filename) {
        log.s(`BingNTint._decodeCss(filename:${filename})`);
        const filePath = GLib.build_filenamev([this.path, filename]);
        const [success, contents] = Gio.File.new_for_path(filePath).load_contents(null);
        if (!success){
            log.e(`Gnome Theme Color: could not read ${filename}`)
            log.r();
            throw new Error(`Gnome Theme Color: could not read ${filename}`);
        }
        const out = new TextDecoder().decode(contents)
        log.r(`(${out.length} chars)`);
        return out;
    }


    _applyTheme(setting, key, hue, prefersDark, fn) {
        log.s(`BingNTint._applyTheme(setting:${setting}, key:${key}, hue:${hue}, prefersDark:${prefersDark}, <fn>`);
        const source = this._settings.get_string(key);
        if (source === 'user') {
            this._restoreTheme(setting, key);
            log.r(`restored ${key} to ${source}`);
            return;
        }
        const value = fn(hue, prefersDark);
        gnome.settings.set_string(setting, value);
        this._lastThemeSettings[setting] = value;
        log.r(`set ${setting} to ${value}`);
    }
    
    _restoreTheme(setting, key) {
        log.s(`BingNTint._restoreTheme(setting:${setting}, sourceKey:${key})`);
        if (this._settings.get_string(key) !== 'user'){
            log.r(`no restore to ${key}`);
            return;
        }

        const lastValue = this._lastThemeSettings[setting];
        if (lastValue !== undefined &&
            gnome.settings.get_string(setting) === lastValue)
            gnome.settings.set_string(setting, this._originalThemeSettings[setting]);
        delete this._lastThemeSettings[setting];
        log.r(`restored to ${key}`);
    }

    _logUpdate(){
        log.updateSettings(this._settings);
    }

    _createStatusIcon() {
        const iconPath = GLib.build_filenamev([this.path, 'bing-symbolic.svg']);
        const icon = new St.Icon({
            gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) }),
            style_class: 'system-status-icon',
        });
        this._statusIcon = new PanelMenu.Button(0.0, 'Bing-n-Tint');
        this._statusIcon.add_child(icon);
        const preferencesItem = new PopupMenu.PopupMenuItem('Config');
        preferencesItem.connect('activate', () => this.openPreferences());
        this._statusIcon.menu.addMenuItem(preferencesItem);
        Main.panel.addToStatusArea('bing-n-tint', this._statusIcon);
        this._updateStatusIcon();
    }

    _updateStatusIcon() {
        this._statusIcon.visible = this._settings.get_boolean('show-status-icon');
    }

    enable() {
        this._settings = this.getSettings();
        this._updateSettingsList = [ "icon-theme-src", "gtk-theme-src", "accent-theme-src", "saturation", "hue-shell-shift", "hue-accent-shift" ];
        log.init(this._settings);
        log.s('BingNTint.enable()');
        
        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        
        this._bingIndex = 0;
        this._customStylesheet = null;

        this._prefersDark = gnome.isDarkMode();
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);

        this._ids = [];
        this._createStatusIcon();
        this._connectId(this._settings, this._updateStatusIcon, "show-status-icon");
        this._connectId(wallpaper.settings, this._update);
        this._connectId(gnome.settings, this._update, "color-scheme");
        this._connectId(this._settings, this._loadWallpaper, "wp-source", "bing-index");
        this._connectId(this._settings, this._update, "icon-theme-src", "gtk-theme-src", "accent-theme-src", "saturation", "hue-shell-shift", "hue-accent-shift");
        this._connectId(this._settings, this._logUpdate, "debug-timestamp", "debug-level");
        
        this._originalThemeSettings = {
            'icon-theme':   gnome.settings.get_string('icon-theme'),
            'gtk-theme':    gnome.settings.get_string('gtk-theme'),
            'accent-color': gnome.settings.get_string('accent-color'),
        };
        this._lastThemeSettings = {};
        const bingMetadata = this._settings.get_string('bing-metadata');
        this._bingMetadata = bingMetadata ? JSON.parse(bingMetadata) : null;

        this._update();
        this._loadWallpaper(); 
        log.r('done');
    }
    
    disable() {
        log.s('BingNTint.disable()');
        this._statusIcon.destroy();
        this._statusIcon = null;
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
        log.r('done');
        log.dismiss();
    }

    _update(id) {
        log.s(`BingNTint._update(${id ? id : ''})`);
        this._prefersDark = gnome.isDarkMode();

        let wpColor = wallpaper.getAverageColor(this._prefersDark);
        if (!wpColor) {
            this._restoreTheme('icon-theme',   'icon-theme-src');
            this._restoreTheme('gtk-theme',    'gtk-theme-src');
            this._restoreTheme('accent-color', 'accent-color-src');
            log.r('restored default theme user');
            return;
        }

        const [h, s, l] = utils.rgb2hsl(wpColor.r, wpColor.g, wpColor.b);    
        
        const accent_shift = this._settings.get_string("accent-color-src") === 'shift' ? this._settings.get_int('hue-accent-shift') : 0;
        const shell_shift  = this._settings.get_string("gtk-theme-src") === 'shift' ? this._settings.get_int('hue-shell-shift') : 0;
        
        const sat = this._settings.get_int('saturation') / 100;

        this._applyTheme('icon-theme','icon-theme-src', h + accent_shift, this._prefersDark, gnome.getThemeName);
        this._applyTheme('accent-color','accent-color-src', h + accent_shift, this._prefersDark, gnome.getColorName);
        this._applyTheme('gtk-theme','gtk-theme-src', h + shell_shift, this._prefersDark, gnome.getThemeName);

        let baseColorHex = utils.hsl2rgb(h + shell_shift, sat, 0.5);
        baseColorHex = utils.rgbToHex(baseColorHex[0], baseColorHex[1], baseColorHex[2]);
        let cssSat = [ utils.pct(0.2 + sat * 0.8), utils.pct(sat * 0.4), utils.pct(sat * 0.2) ];
        let gtkSat = sat / 5;

        log.i(`avg-in: rgb(${wpColor.r}, ${wpColor.g}, ${wpColor.b}) hue: ${h}, sat: ${sat}, bkShift: ${shell_shift}, acShift: ${accent_shift}, accentHex: ${baseColorHex}`);

        const cssPalette = {
            "-st-accent-color": baseColorHex,
            "-st-sat0": cssSat[0],
            "-st-sat1": cssSat[1],
            "-st-sat2": cssSat[2]
        }

        const stylesheet = this._applyPalette(this._decodeCss('stylesheet.src'), cssPalette);

        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        if (this._customStylesheet) {
            this._theme.unload_stylesheet(this._customStylesheet);
            if (theme !== this._theme)
                theme.unload_stylesheet(this._customStylesheet);
        }
        this._theme = theme;
        const customStylesheetPath = GLib.build_filenamev([this._cacheDir, 'theme-color.css']);
        GLib.file_set_contents(customStylesheetPath, stylesheet);
        this._customStylesheet = Gio.File.new_for_path(customStylesheetPath);
        this._theme.load_stylesheet(this._customStylesheet);
        log.i(`Custom Stylesheet written to ${customStylesheetPath}`);

        const gtkcss = this._applyPalette(this._decodeCss('gtk.css'), { '@base_color': baseColorHex, '@base-sat': gtkSat });
        const gtkCssDirectory = GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-4.0']);
        const gtkCssPath = GLib.build_filenamev([gtkCssDirectory, 'gtk.css']);
        GLib.mkdir_with_parents(gtkCssDirectory, 0o755);
        GLib.file_set_contents(gtkCssPath, gtkcss);
        log.i(`GTK CSS written to ${gtkCssPath}`);
        log.r('end _update');
    }
}
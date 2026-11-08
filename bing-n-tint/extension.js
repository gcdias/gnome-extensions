// https://gjs-docs.gnome.org/gjs/

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf'; 
import Soup from 'gi://Soup?version=3.0';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

const EXTNAME = 'bing-n-tint';

const log = {
    
    IND: 0,
    IND_STEP: 2,
    IND_CHAR: '.',
    TIME_IND: 8,
    TIME_STR: '',
    MAX: 200,
    START: 0,

    settings: null,
    timestamp: 'rel',
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
            return `+${String(log.TIME_STR + dif).slice(-8)}ms`;
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
            log.TIME_STR = ' '.repeat(log.TIME_IND);
            const d = new Date();
            log.START = d.getMilliseconds();
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
    
    COLORS: {
        'Yaru-red': 'red',
        'Yaru': 'orange',
        'Yaru-yellow': 'yellow',
        'Yaru-olive': 'green',
        'Yaru-prussiangreen': 'teal',
        'Yaru-blue': 'blue',
        'Yaru-purple': 'purple',
        'Yaru-magenta': 'pink'
    },

    CIDX: [ 0, 1, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7 ],

    connect: function(fn){
        return [gnome.settings, gnome.settings.connect('changed::color-scheme', () => {
            gnome.prefersDark = gnome.settings.get_string('color-scheme') === 'prefer-dark';
            fn();
        })];
    },
    isDarkMode: function() {
        log.s('gnome.isDarkMode()');
        gnome.prefersDark = gnome.settings.get_string('color-scheme') === 'prefer-dark';
        log.r(`Dark mode: ${gnome.prefersDark}`);
        return gnome.prefersDark;
    },
    
    setTheme: function(setting, hue){
        log.s(`gnome.setTheme(setting:${setting}, hue:${hue}`);
        const value = gnome.getThemeName(hue);
        gnome.settings.set_string(setting, value);
        log.r(`set ${setting} to ${value}`);
        return value;
    },
    setColor: function(setting, hue){
        log.s(`gnome.setColor(setting:${setting}, hue:${hue}`);
        const value = gnome.getColorName(hue);
        gnome.settings.set_string(setting, value);
        log.r(`set ${setting} to ${value}`);
        return value;
    },

    getDefaultSettings: function(){
        return {
            'icon-theme':   gnome.settings.get_string('icon-theme'),
            'gtk-theme':    gnome.settings.get_string('gtk-theme'),
            'accent-color': gnome.settings.get_string('accent-color'),
        };
    },
    getColor: function(hue){
        log.s(`gnome.getColor(hue:${hue})`);
        const len = gnome.CIDX.length;
        const colors = Object.entries(gnome.COLORS);
        const i = Math.max(0, Math.floor(utils.normHue(hue + 180 / len) / 360 * len) % len);
        const index = gnome.CIDX[i];
        const out = colors[index];
        log.r(`Color: ${out} (index: ${index})`);
        return out;
    },
    
    getThemeName: function(hue) {
        log.s(`gnome.getThemeName(hue:${hue})`);
        const name = gnome.getColor(hue)[0] + (gnome.prefersDark ? '-dark' : '');
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
    prefersDark: true,
    wpUriKey: 'picture-uri-dark',
    width: 1920,
    height: 1080,
    
    init: function(prefersDark, cacheDir){
        wallpaper.setPrefersDark(prefersDark);
        wallpaper.updateResolution();
        wallpaper.cacheDir = cacheDir;
    },
    
    updateResolution: function(){
        log.s('wallpaper.updateResolution()');
        const monitor = Main.layoutManager.primaryMonitor;
        const scale = monitor?.geometry_scale ?? 1;
        log.i(`geometry: [ ${monitor?.width}, ${monitor?.height} ], scale: ${scale}`);
        [ wallpaper.width, wallpaper.height ] = monitor ? 
            [ Math.round(monitor.width * scale), Math.round(monitor.height * scale) ] : 
            [ 1920, 1080 ];
        log.r(`res: ${wallpaper.width} x ${wallpaper.height}`);
    },

    setPrefersDark: function(prefersDark){
        wallpaper.prefersDark = prefersDark;
        // GNOME 42+ has separate keys for light and dark mode
        wallpaper.wpUriKey = prefersDark ? 'picture-uri-dark' : 'picture-uri';
    },
    
    getBackgroundUri: function(){
        return wallpaper.settings.get_string(wallpaper.wpUriKey);
    },

    setBackground: function(filePath){
        wallpaper.settings.set_string(wallpaper.wpUriKey, `file://${filePath}`);
    },

    getPath: function() {
        log.s(`wallpaper.getPath()`);
        let path = null;
        // "none" means no image, only a solid/gradient color
        if (wallpaper.settings.get_string('picture-options') !== 'none'){
            const uri = wallpaper.getBackgroundUri();
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

    getAverageColor: function() {
        log.s(`wallpaper.getAverageColor()`);
        let path = wallpaper.getPath();
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

    getBingWallpaper: async function(index = 0) {
        log.s(`wallpaper.getBingWallpaper(index:${index})`);
        const res = wallpaper.height <= 768 ? "1366x768" : wallpaper.height <= 1080 ? "1920x1080" : "UHD";
        const lang = utils.getLangTag();
        const url = `https://bing.biturl.top/?resolution=${res}&format=json&index=${index}&mkt=${lang}`;
        log.i(`Fetching Bing wallpaper metadata from ${url}...`);
        const metadata = await utils.download(url);
        const metaStr = new TextDecoder().decode(metadata.get_data());
        const {url: imageUrl, copyright: cr} = JSON.parse(metaStr);
        wallpaper.url = imageUrl;
        wallpaper.copyright = cr;
        log.i(`imgUrl: ${wallpaper.url}, desc: ${wallpaper.copyright}`);
        const bytes = await utils.download(imageUrl);
        //const cacheDirectory = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        //const path = GLib.build_filenamev([cacheDirectory, 'bing-wallpaper.jpg']);
        //GLib.mkdir_with_parents(cacheDirectory, 0o755);
        const path = GLib.build_filenamev([wallpaper.cacheDir, 'bing-wallpaper.jpg']);
        GLib.file_set_contents(path, bytes.get_data());
        log.r(`Bing wallpaper downloaded to ${path}`);
        wallpaper.setBackground(path);
        return metaStr;
    }
}

const BING = {
    url: '',
    lastUpdated: 0,
    metadata: '',
    index: 0,
    lang: 'en-US',
    res: '1920x1080',
    init: function(width=wallpaper.width, height=wallpaper.height){
        this.res = height <= 768 ? "1366x768" : height <= 1080 ? "1920x1080" : "UHD";
        this.lang = utils.getLangTag();
    },
    download: async function(index=0){
        log.s(`bingWallpaper.download(index:${index})`);
        BING.index = index;
        const metaUrl = `https://bing.biturl.top/?resolution=${this.res}&format=json&index=${index}&mkt=${this.lang}`;
        const metadata = await utils.download(metaUrl);
        const metaStr = new TextDecoder().decode(metadata.get_data());
        this.metadata = JSON.parse(metaStr);
        this.url = this.metadata.url;
        log.i(`imgUrl: ${this.url}, desc: ${this.metadata.copyright}`);
        const bytes = await utils.download(this.url);
        this.lastUpdated = Date.now();
        const path = GLib.build_filenamev([wallpaper.cacheDir, 'bing-wallpaper.jpg']);
        GLib.file_set_contents(path, bytes.get_data());
        log.r(`Bing wallpaper downloaded to ${path}`);
        wallpaper.setBackground(path);
        return this.metadata;
    }
}

const PICSUM = {
    url: 'https://picsum.photos/',
    lastUpdated: 0,
    metadata: '',
    index: 0,
    lang: 'en-US',
    res: '1920/1080',
    init: function(width=wallpaper.width, height=wallpaper.height){
        this.res = `${width}/${height}`;
        this.lang = utils.getLangTag();
    },
    download: async function(){
        log.s(`picsum.download()`);
        this.url = `https://picsum.photos/${this.res}`;
        log.i(`url: ${this.url}`);
        const bytes = await utils.download(this.url);
        this.lastUpdated = Date.now();
        const path = GLib.build_filenamev([wallpaper.cacheDir, 'picsum-wallpaper.jpg']);
        GLib.file_set_contents(path, bytes.get_data());
        log.r(`Picsum wallpaper downloaded to ${path}`);
        wallpaper.setBackground(path);
        return {};
    }
}

const WIKI = {
    url: '',
    lastUpdated: 0,
    metadata: '',
    userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0', //'potd-script/1.0 (you@example.com)'
    download: async function(){
        log.s(`wikiPOTD.download()`);
        const dt = new Date().toISOString().slice(0, 10);
        const metaUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=images&titles=Template:POTD/${dt}&prop=imageinfo&iiprop=url&format=json&origin=*`
        const meta = await utils.download(metaUrl, WIKI.userAgent);
        WIKI.metadata = new TextDecoder().decode(meta.get_data());
        let url;
        if (WIKI.metadata && (WIKI.metadata = JSON.parse(WIKI.metadata)) && (url = utils.findFirst(WIKI.metadata,'url'))){
            const bytes = await utils.download(url, WIKI.userAgent);
            this.lastUpdated = Date.now();
            const path = GLib.build_filenamev([wallpaper.cacheDir, 'wiki-wallpaper.jpg']);
            GLib.file_set_contents(path, bytes.get_data());
            log.r(`Wiki POTD wallpaper downloaded to ${path}`);
            wallpaper.setBackground(path);
        }
        return WIKI.metadata;
    }
}

const NASA = {
    url: '',
    lastUpdated: 0,
    metadata: '',
    api_key: '',
    init: function(api_key){
        NASA.api_key = api_key
    },
    download: async function(){
        log.s(`NASA.download()`);
        if (!NASA.api_key){
            log.r('No API_KEY set for NASA, aborting...');
            return undefined;
        }
        const today = new Date().toISOString().slice(0, 10);
        const metaUrl = `https://science.nasa.gov/wp-json/wp/v2/apod-basic/?api_key=${NASA.api_key}&date=${today}`
        const meta = await utils.download(metaUrl);
        NASA.metadata = new TextDecoder().decode(meta.get_data());
        if (NASA.metadata && (NASA.metadata = JSON.parse(NASA.metadata))){
            if (Array.isArray(NASA.metadata))
                NASA.metadata = NASA.metadata[0];
            log.i(`NASA metadata: ${NASA.metadata}`);
            let url = NASA.metadata.hdurl;
            const bytes = await utils.download(url);
            this.lastUpdated = Date.now();
            const path = GLib.build_filenamev([wallpaper.cacheDir, 'nasa-wallpaper.jpg']);
            GLib.file_set_contents(path, bytes.get_data());
            log.r(`Nasa wallpaper downloaded to ${path}`);
            wallpaper.setBackground(path);
        }
        return NASA.metadata;
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
    download: async function (url, userAgent) {
        log.s(`utils.download(url:${url}`);
        const session = new Soup.Session();
        if (userAgent)
            session.userAgent = userAgent;
        const msg = Soup.Message.new('GET', url);
        const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
        if (msg.get_status() !== Soup.Status.OK){
            const err = `HTTP ${msg.get_status()}: ${msg.get_reason_phrase()}`;
            log.e(err);
            //throw new Error(err);
        }
        log.r(`end download`);
        return bytes;
    },
    loadText: function(dir, filename){
        const path = GLib.build_filenamev([dir, filename]);
        const [ok, contents] = Gio.File.new_for_path(path).load_contents(null);
        if (!ok){
            return null;
        }
        return new TextDecoder().decode(contents);
    },
    getLangTag: function(){
        log.s('utils.getLangTag()');
        const locale = GLib.get_language_names()[0];
        const languageTag = locale.split(/[.@]/, 1)[0].replace(/_/g, '-');
        log.r(languageTag);
        return languageTag;
    },
    pct: function(value) {
        log.s(`utils.pct(value:${value})`);
        const out = (value * 100).toFixed(0) + '%';
        log.r(`${out}`);
        return out;
    },
    findFirst(obj, key) {
        if (obj === null || typeof obj !== 'object') return undefined;

        if (Object.hasOwn(obj, key)) return obj[key];

        for (const child of Object.values(obj)) {
            const found = utils.findFirst(child, key);
            if (found !== undefined) return found;
        }
        return undefined;
    },
    funcName: function(fun){
        var ret = fun.toString();
        ret = ret.substr('function '.length);
        ret = ret.substr(0, ret.indexOf('('));
        return ret;
    }
}

export default class BingNTint extends Extension {

    
    _saveMetadataAndUpdate(metadata){
        this._settings.set_string('wp-metadata', JSON.stringify(metadata));
        this._update();
    }

    _loadWallpaper() {
        log.s(`BingNTint._loadWallpaper()`);
        const src = this._settings.get_string('wp-source');
        log.i(`from source: ${src}`);
        if (src === 'bing'){
            this._bingIndex = this._settings.get_int('bing-index');
            BING.init();
            BING.download(this._bingIndex)
                .then(meta => this._saveMetadataAndUpdate(meta))
                .catch(error => log.e(`BingNTint._loadWallpaper.catch (bing) ${error}`));
        } else if (src === 'picsum'){
            PICSUM.init();
            PICSUM.download()
                .then(meta => this._saveMetadataAndUpdate(meta))
                .catch(error => log.e(`BingNTint._loadWallpaper.catch (picsum) ${error}`));
        } else if (src === 'wiki'){
            WIKI.download()
                .then(meta => this._saveMetadataAndUpdate(meta))
                .catch(error => log.e(`BingNTint._loadWallpaper.catch (wiki) ${error}`));
        } else if (src === 'nasa'){
            NASA.init(this._settings.get_string('nasa-api-key'));
            NASA.download()
                .then(meta => this._saveMetadataAndUpdate(meta))
                .catch(error => log.e(`BingNTint._loadWallpaper.catch (nasa) ${error}`));
        } else {
            this._update();
        }
        log.r('end _loadWallpaper');
    }

    _newBingWallpaper(meta){
        if(meta){
            this._bingMetadata = JSON.parse(meta);
            this._settings.set_string('wp-metadata', meta);
            log.i(`Bing wallpaper index ${this._bingIndex}: ${this._bingMetadata.url}`);
        }
        this._lastWpDownloadTime = Date.now();
        this._update();
    }

    _apply(key, mode, fn, hue){
        this._lastSettings[key] = mode !== 'user' ? fn(key, hue) : this._defaultSettings[key];
    }

    _unloadStylesheet(){
        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        if (this._customStylesheet) {
            this._theme.unload_stylesheet(this._customStylesheet);
            if (theme !== this._theme)
                theme.unload_stylesheet(this._customStylesheet);
        }
        this._theme = theme;
    }

    _loadStylesheet(stylesheet){
        const path = GLib.build_filenamev([this._cacheDir, 'theme-color.css']);
        GLib.file_set_contents(path, stylesheet);
        this._customStylesheet = Gio.File.new_for_path(path);
        this._theme.load_stylesheet(this._customStylesheet);
        log.i(`Custom Stylesheet written to ${path}`);
    }

    _loadGtkCss(gtkcss){
        const gtkCssDirectory = GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-4.0']);
        const gtkCssPath = GLib.build_filenamev([gtkCssDirectory, 'gtk.css']);
        GLib.mkdir_with_parents(gtkCssDirectory, 0o755);
        GLib.file_set_contents(gtkCssPath, gtkcss);
        log.i(`GTK CSS written to ${gtkCssPath}`);
    }

    _connect(setting, fn, id){
        const callback = () => fn.call(this);
        const c = `changed${id ? "::" + id : ''}`
        log.i(`_connect: ${c}`)
        return [setting, setting.connect(c, callback)];
    }
    
    _connectId(setting, fn, ...ids){
        if (ids.length > 0){
            for (const id of ids)
                this._ids.push(this._connect(setting, fn, id));
        } else {
            this._ids.push(this._connect(setting, fn));
        }
    }

    _setPalette(css, palette) {
        log.s(`BingNTint._applyPalette(<css>, palette:${palette})`);
        let c = `${css}`;
        for (const [key, value] of Object.entries(palette)) {
            c = c.replaceAll(key, value);
        }
        log.r(`done`);
        return c;
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

    _nextWallpaper() {
        const src = this._settings.get_string('wp-source');
        if (src === 'bing'){
            this._bingIndex = this._settings.get_int('bing-index') + 1 % 7;
            this._settings.set_int('bing-index', this._bingIndex);
        } else if (src === 'picsum'){
            this._loadWallpaper();
        }
    }

    _createStatusIcon() {
        const iconPath = GLib.build_filenamev([this.path, 'bing-symbolic.svg']);
        const icon = new St.Icon({
            gicon: new Gio.FileIcon({ file: Gio.File.new_for_path(iconPath) }),
            style_class: 'system-status-icon',
        });
        this._statusIcon = new PanelMenu.Button(0.0, 'Bing-n-Tint');
        this._statusIcon.add_child(icon);
        const preferencesItem = new PopupMenu.PopupMenuItem('Preferences');
        preferencesItem.connect('activate', () => this.openPreferences());
        this._statusIcon.menu.addMenuItem(preferencesItem);
        const nextItem = new PopupMenu.PopupMenuItem('Next Wallpaper');
        nextItem.connect('activate', () => this._nextWallpaper());
        this._statusIcon.menu.addMenuItem(nextItem);
        Main.panel.addToStatusArea('bing-n-tint', this._statusIcon);
        this._updateStatusIcon();
    }

    _updateStatusIcon() {
        this._statusIcon.visible = this._settings.get_boolean('show-status-icon');
    }

    _logUpdate(){
        log.updateSettings(this._settings);
    }




    enable() {
        this._settings = this.getSettings();
        log.init(this._settings);
        log.s('BingNTint.enable()');
        this._createStatusIcon();
        
        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        
        this._bingIndex = 0;
        this._customStylesheet = null;
        this._defaultSettings = gnome.getDefaultSettings();
        this._lastSettings = {};

        this._prefersDark = gnome.isDarkMode();
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);
        
        wallpaper.init(this._prefersDark, this._cacheDir);

        this._ids = [
            [wallpaper.settings, wallpaper.settings.connect('changed',           () => this._update())],
            [gnome.settings, gnome.settings.connect('changed::color-scheme',     () => this._update())],
            [this._settings, this._settings.connect('changed::wp-source',        () => this._loadWallpaper())],
            [this._settings, this._settings.connect('changed::bing-index',       () => this._loadWallpaper())],
            [this._settings, this._settings.connect('changed::icon-theme-src',   () => this._update())],
            [this._settings, this._settings.connect('changed::gtk-theme-src',    () => this._update())],
            [this._settings, this._settings.connect('changed::accent-color-src', () => this._update())],
            [this._settings, this._settings.connect('changed::saturation',       () => this._update())],
            [this._settings, this._settings.connect('changed::hue-shell-shift',  () => this._update())],
            [this._settings, this._settings.connect('changed::hue-accent-shift', () => this._update())],
            [this._settings, this._settings.connect('changed::debug-timestamp',  () => this._logUpdate())],
            [this._settings, this._settings.connect('changed::debug-level',      () => this._logUpdate())],
            [this._settings, this._settings.connect('changed::show-status-icon', () => this._updateStatusIcon())],
            
        ];
        
        const bingMetadata = this._settings.get_string('wp-metadata');
        this._bingMetadata = bingMetadata ? JSON.parse(bingMetadata) : null;

        this._update();
        this._loadWallpaper(); 
        log.r('end enable()');
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
        this._defaultSettings = null;
        this._lastSettings = null;
        log.r('end disable()');
        log.dismiss();
    }

    _update(id) {
        log.s(`BingNTint._update(${id ? id : ''})`);
        this._prefersDark = gnome.isDarkMode();

        const config = {
            iconMode:    this._settings.get_string('icon-theme-src'),
            accentMode:  this._settings.get_string('accent-color-src'),
            gtkMode:     this._settings.get_string('gtk-theme-src'),
            accentShift: this._settings.get_string('hue-accent-shift'),
            shellShift:  this._settings.get_string('hue-shell-shift'),
        }

        const avgRGB = wallpaper.getAverageColor(this._prefersDark);
        
        const [h, s, l] = utils.rgb2hsl(avgRGB.r, avgRGB.g, avgRGB.b);  
        const hue_accent = config.accentMode === 'shift' ? h + config.accentShift : h;
        const hue_shell  = config.gtkMode    === 'shift' ? h + config.shellShift  : h;       
        const sat = this._settings.get_int('saturation') / 100;

        this._apply('icon-theme',   config.iconMode,   gnome.setTheme, hue_accent);
        this._apply('gtk-theme',    config.gtkMode,    gnome.setTheme, hue_shell);
        this._apply('accent-color', config.accentMode, gnome.setColor, hue_accent);
        
        //this._applyTheme('icon-theme','icon-theme-src', hue_accent, gnome.getThemeName);
        //this._applyTheme('accent-color','accent-color-src', hue_accent, gnome.getColorName);
        //this._applyTheme('gtk-theme','gtk-theme-src', hue_shell, gnome.getThemeName);

        let hex = utils.hsl2rgb(hue_shell, sat, 0.5);
        hex = utils.rgbToHex(hex[0], hex[1], hex[2]);
        let cssSat = [ utils.pct(0.2 + sat * 0.8), utils.pct(sat * 0.4), utils.pct(sat * 0.2), utils.pct(0.6) ];
        let gtkSat = sat / 5;

        log.i(`avg-in: rgb(${avgRGB.r}, ${avgRGB.g}, ${avgRGB.b}) hue: ${h}, sat: ${sat}, hueShell: ${hue_shell}, hueAccent: ${hue_accent}, accentHex: ${hex}`);

        const styleSheetPalette = {
            '-st-accent-color': hex,
            '-st-sat0': cssSat[0],
            '-st-sat1': cssSat[1],
            '-st-sat2': cssSat[2],
            '-st-w6'  : cssSat[3]
        }

        const gtkPalette = {
            '@base_color': hex,
            '@base-sat'  : gtkSat
        }

        const stylesheet = this._setPalette(this._decodeCss('stylesheet.src'), styleSheetPalette);
        this._unloadStylesheet();
        this._loadStylesheet(stylesheet);

        const gtkcss = this._setPalette(this._decodeCss('gtk.css'), gtkPalette);
        this._loadGtkCss(gtkcss);
        log.r('end _update()');
    }
}

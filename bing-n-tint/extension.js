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
import { Logger as log } from './utils/logger.js';
import { Utils as utils } from './utils/utils.js';

import { Bing } from './wp/bing.js';
import { Picsum } from './wp/picsum.js';
import { Wiki } from './wp/wiki.js';
import { Nasa } from './wp/nasa.js';


Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

const EXTNAME = 'bing-n-tint';

const IGnome = {
    
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
        return [IGnome.settings, IGnome.settings.connect('changed::color-scheme', () => {
            IGnome.prefersDark = IGnome.settings.get_string('color-scheme') === 'prefer-dark';
            fn();
        })];
    },
    isDarkMode: function() {
        log.s('gnome.isDarkMode()');
        IGnome.prefersDark = IGnome.settings.get_string('color-scheme') === 'prefer-dark';
        log.r(`Dark mode: ${IGnome.prefersDark}`);
        return IGnome.prefersDark;
    },
    
    setTheme: function(setting, hue){
        log.s(`gnome.setTheme(setting:${setting}, hue:${hue}`);
        const value = IGnome.getThemeName(hue);
        IGnome.settings.set_string(setting, value);
        log.r(`set ${setting} to ${value}`);
        return value;
    },
    setColor: function(setting, hue){
        log.s(`gnome.setColor(setting:${setting}, hue:${hue}`);
        const value = IGnome.getColorName(hue);
        IGnome.settings.set_string(setting, value);
        log.r(`set ${setting} to ${value}`);
        return value;
    },

    getDefaultSettings: function(){
        return {
            'icon-theme':   IGnome.settings.get_string('icon-theme'),
            'gtk-theme':    IGnome.settings.get_string('gtk-theme'),
            'accent-color': IGnome.settings.get_string('accent-color'),
        };
    },
    getColor: function(hue){
        log.s(`gnome.getColor(hue:${hue})`);
        const len = IGnome.CIDX.length;
        const colors = Object.entries(IGnome.COLORS);
        const i = Math.max(0, Math.floor(utils.normHue(hue + 180 / len) / 360 * len) % len);
        const index = IGnome.CIDX[i];
        const out = colors[index];
        log.r(`Color: ${out} (index: ${index})`);
        return out;
    },
    
    getThemeName: function(hue) {
        log.s(`gnome.getThemeName(hue:${hue})`);
        const name = IGnome.getColor(hue)[0] + (IGnome.prefersDark ? '-dark' : '');
        log.r(`getThemeName: ${name}`);
        return name;
    },

    getColorName: function(hue) {
        log.s(`gnome.getColorName(hue:${hue})`);
        const name = IGnome.getColor(hue)[1];
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

}

const BING   = new Bing(wallpaper);
const PICSUM = new Picsum(wallpaper);
const WIKI   = new Wiki(wallpaper);
const NASA   = new Nasa(wallpaper);

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
            this._bingIndex = this._settings.get_int('wp-index');
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
        log.i(`Custom Stylesheet written to ${path} and loaded`);
    }

    _replace(css, palette) {
        log.s(`BingNTint._applyPalette(<css>, palette:${palette})`);
        let c = `${css}`;
        for (const [key, value] of Object.entries(palette)) {
            c = c.replaceAll(key, value);
        }
        log.r(`done`);
        return c;
    }

    _nextWallpaper() {
        const src = this._settings.get_string('wp-source');
        if (src === 'bing'){
            this._bingIndex = this._settings.get_int('wp-index') + 1 % 7;
            this._settings.set_int('wp-index', this._bingIndex);
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

    _loadAuthConfig(){
        let auth_config = utils.loadText(this._cacheDir,'user.cfg');
        if (auth_config && (auth_config = JSON.parse(auth_config))){
            const wiki_auth = auth_config.auth?.wiki;
            const nasa_auth = auth_config.auth?.nasa;
            log.i(`found auth-config: wiki=${wiki_auth}, nasa=${nasa_auth}`);
            this._settings.set_string('wiki-key', wiki_auth);
            this._settings.set_string('nasa-api-key', nasa_auth);
        } else {
            const cfg_file = utils.loadText(this.path,'user.src');
            utils.saveText(this._cacheDir, 'user.cfg', cfg_file);
        }
    }


    enable() {
        this._settings = this.getSettings();
        log.init(this._settings);
        log.s('BingNTint.enable()');
        this._createStatusIcon();
        
        this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        
        this._bingIndex = 0;
        this._customStylesheet = null;
        this._defaultSettings = IGnome.getDefaultSettings();
        this._lastSettings = {};

        this._prefersDark = IGnome.isDarkMode();
        this._cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), EXTNAME]);
        GLib.mkdir_with_parents(this._cacheDir, 0o755);
        this._gtkDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-4.0']);
        GLib.mkdir_with_parents(this._gtkDir, 0o755);

        this._loadAuthConfig();


        wallpaper.init(this._prefersDark, this._cacheDir);

        this._ids = [
            [wallpaper.settings, wallpaper.settings.connect('changed',           () => this._update())],
            [IGnome.settings, IGnome.settings.connect('changed::color-scheme',     () => this._update())],
            [this._settings, this._settings.connect('changed::wp-source',        () => this._loadWallpaper())],
            [this._settings, this._settings.connect('changed::wp-index',       () => this._loadWallpaper())],
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
        this._prefersDark = IGnome.isDarkMode();

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

        this._apply('icon-theme',   config.iconMode,   IGnome.setTheme, hue_accent);
        this._apply('gtk-theme',    config.gtkMode,    IGnome.setTheme, hue_shell);
        this._apply('accent-color', config.accentMode, IGnome.setColor, hue_accent);
        
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

        const stylesheet = this._replace(utils.loadText(this.path,'stylesheet.src'), styleSheetPalette);
        this._unloadStylesheet();
        this._loadStylesheet(stylesheet);

        const gtkcss = this._replace(utils.loadText(this.path,'gtk.css'), gtkPalette);
        utils.saveText(this._gtkDir, 'gtk.css', gtkcss);
        log.r('end _update()');
    }
}

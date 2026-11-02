import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const extname = 'shell-theme';

//const ifaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});

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
        const name = gnomeDesktop.yaruNames[index].replaceAll('-dark', '').replaceAll('Yaru', '').replaceAll('-', '');
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
        return [h * 60, s, l];
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
        ];
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
    }

    _update() {
        // debug with journalctl -f -o cat /usr/bin/gnome-shell
        let wpColor = wallpaper.getWallpaperAverageColor();
        if (!wpColor)
            return;
        console.log(`avg-in: rgb(${wpColor.r}, ${wpColor.g}, ${wpColor.b})`);

        const [h, s, l] = color.rgbToHsl(wpColor.r, wpColor.g, wpColor.b);    
        const hue_shell_shift = this._settings.get_int('hue-shell-shift');
        const hue_accent_shift = this._settings.get_int('hue-accent-shift');
        const sat = this._settings.get_int('saturation')/100;

        //const rgbShell = color.hslToRgb((h + hue_shell_shift + 360) % 360, sat, 0.5);
        //gnomeDesktop.settings.set_string('gtk-theme', `base_color:#${color.rgbToHex(rgbShell[0], rgbShell[1], rgbShell[2]).substring(1)}`);

        //const rgbAccent = color.hslToRgb((h + hue_accent_shift + 360) % 360, sat, 0.5);
        //gnomeDesktop.settings.set_string('accent-color', color.rgbToHex(rgbAccent[0], rgbAccent[1], rgbAccent[2]));

        const yaruThemeName = gnomeDesktop.getThemeName(h + hue_shell_shift);
        gnomeDesktop.settings.set_string('icon-theme', yaruThemeName);
        gnomeDesktop.settings.set_string('gtk-theme', yaruThemeName);

        const accentName = this.getColorName(h + hue_accent_shift);
        gnomeDesktop.settings.set_string('accent-color', accentName);

        //[wpColor.r, wpColor.g, wpColor.b] = color.hslToRgb(h, this._settings.get_int('saturation') / 100, 0.5);
        //const accentHex = color.rgbToHex(wpColor.r, wpColor.g, wpColor.b);
        //console.log(`avg-out: rgb(${wpColor.r}, ${wpColor.g}, ${wpColor.b}), hue: ${h}, accent: ${accentHex}`);
        
        
        //gnomeDesktop.settings.set_string('gtk-theme', yaruThemeName);
        

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
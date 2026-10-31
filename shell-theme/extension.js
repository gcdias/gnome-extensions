import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const extname = 'shell-theme';
const INTERFACE_SCHEMA = 'org.gnome.desktop.interface'

const bgSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
const ifaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

function getWallpaperPath() {
    // GNOME 42+ has separate keys for light and dark mode
    const dark = ifaceSettings.get_string('color-scheme') === 'prefer-dark';
    const uri = bgSettings.get_string(dark ? 'picture-uri-dark' : 'picture-uri');

    if (!uri)
        return null;

    return Gio.File.new_for_uri(uri).get_path();   // null if not a local file
}

function rgbToHsl(r, g, b) {
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
}

function hslToRgb(h, s, l) {
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

export function getWallpaperAverageColor() {
    // "none" means no image, only a solid/gradient color
    if (bgSettings.get_string('picture-options') === 'none')
        return null;

    let path = getWallpaperPath();
    if (!path)
        return null;

    // Dynamic/timed wallpapers are XML files, so pull out the first image
    if (path.endsWith('.xml')) {
        const [ok, bytes] = GLib.file_get_contents(path);
        if (!ok)
            return null;
        const match = new TextDecoder().decode(bytes).match(/<file[^>]*>\s*([^<\s]+)\s*<\/file>/);
        if (!match)
            return null;
        path = match[1];
    }

    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, 64, 64, true);
    const one = pixbuf.scale_simple(1, 1, GdkPixbuf.InterpType.HYPER);
    const [r, g, b] = one.get_pixels();
    return {r, g, b};
}

function getYaruThemeName(hue) {
    const yaruNames = [
        'Yaru-red',
        'Yaru',
        'Yaru-yellow',
        'Yaru-olive',
        'Yaru-prussiangreen',
        'Yaru-blue',
        'Yaru-purple',
        'Yaru-magenta'
    ];
    const index = Math.floor((hue / 360) * yaruNames.length) % yaruNames.length;
    return yaruNames[index];
}

export default class ShellTheme extends Extension {
enable() {
    this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme()
    this._settings = this.getSettings();
    this._ids = [
        [bgSettings, bgSettings.connect('changed::picture-uri', () => this._update())],
        [bgSettings, bgSettings.connect('changed::picture-uri-dark', () => this._update())],
        [ifaceSettings, ifaceSettings.connect('changed::color-scheme', () => this._update())],
        [this._settings, this._settings.connect('changed::saturation', () => this._update())],
    ];
    this._update();
}

disable() {
    this._ids.forEach(([obj, id]) => obj.disconnect(id));
    this._ids = null;
    this._theme = null;
    this._settings = null;
}

_update() {
    let color = getWallpaperAverageColor();
    if (color){
        console.log(`avg-in: rgb(${color.r}, ${color.g}, ${color.b})`);
        let [h, s, l] = rgbToHsl(color.r, color.g, color.b);
        const yaruThemeName = getYaruThemeName(h);
        [color.r, color.g, color.b] = hslToRgb(h, this._settings.get_int('saturation') / 100, 0.5);
        const accentHex = rgbToHex(color.r, color.g, color.b);
        console.log(`avg-out: rgb(${color.r}, ${color.g}, ${color.b}), hue: ${h}, accent: ${accentHex}, theme: ${yaruThemeName}`);
        
        const stylesheetPath = GLib.build_filenamev([this.path, 'stylesheet.css']);
        const [success, contents] = Gio.File.new_for_path(stylesheetPath).load_contents(null);
        if (!success)
            throw new Error('Gnome Theme Color: could not read stylesheet.css');

        const stylesheet = new TextDecoder().decode(contents).replaceAll('-st-accent-color', accentHex);
        const cacheDirectory = GLib.build_filenamev([GLib.get_user_cache_dir(), extname]);
        GLib.mkdir_with_parents(cacheDirectory, 0o755);

        this._customStylesheetPath = GLib.build_filenamev([cacheDirectory, 'theme-color.css']);
        GLib.file_set_contents(this._customStylesheetPath, stylesheet);

        this._customStylesheet = Gio.File.new_for_path(this._customStylesheetPath);
        this._theme.load_stylesheet(this._customStylesheet);
        let interfaceSettings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        interfaceSettings.set_string('icon-theme', yaruThemeName);
        interfaceSettings.set_string('gtk-theme', yaruThemeName);
    }
}
}
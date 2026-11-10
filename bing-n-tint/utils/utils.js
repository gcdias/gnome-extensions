import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import { Logger as log } from './logger.js';

export class Utils {
    
    static rgbToHex(r, g, b) {
        log.s(`utils.rgbToHex(r:${r}, g:${g}, b:${b})`);
        const out = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        log.r(`Hex color: ${out}`);
        return out;
    }

    static hexToRgb(hex) {
        log.s(`utils.hexToRgb(hex:${hex})`);
        const [r, g, b] = hex.slice(1).match(/../g).map(x => parseInt(x, 16));
        log.r(`RGB color: rgb(${r}, ${g}, ${b})`);
        return [r, g, b];
    }

    static normHue(h, round = true) {
        log.s(`utils.normHue(hue:${h}, round? ${round})`);
        const hue = ((h % 360) + 360) % 360;
        const out = round ? Math.round(hue) : hue;
        log.r(`Normalized hue: ${out}`);
        return out;
    }

    static rgb2hsl(r, g, b) {
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
        const out = [Utils.normHue(h * 60, true), s.toFixed(2), l.toFixed(2)];
        log.r(`HSL color: hsl(${out[0]}, ${out[1]}, ${out[2]})`);
        return out;
    }

    static hsl2rgb(h, s, l) {
        log.s(`utils.hsl2rgb(h:${h}, s:${s}, l:${l})`);
        const invalidHue = isNaN(h);
        const a = invalidHue ? 0 : s * Math.min(l, 1 - l);
        const hue = invalidHue ? 0 : Utils.normHue(h, false) / 30;
        const channel = n => {
            const k = (n + hue) % 12;
            return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        const out = [channel(0), channel(8), channel(4)];
        log.r(`RGB color: rgb(${out[0]}, ${out[1]}, ${out[2]})`);
        return out;
    }

    static async download(url, userAgent) {
        log.s(`utils.download(url:${url}`);
        const session = new Soup.Session();
        if (userAgent)
            session.userAgent = userAgent;
        const msg = Soup.Message.new('GET', url);
        const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
        if (msg.get_status() !== Soup.Status.OK) {
            const err = `HTTP ${msg.get_status()}: ${msg.get_reason_phrase()}`;
            log.e(err);
        }
        log.r('end download');
        return bytes;
    }

    static loadText(dir, filename) {
        log.s(`Utils.loadText(dir:${dir}, filename:${filename})`);
        const path = GLib.build_filenamev([dir, filename]);
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(null))
            return null;
        const [ok, contents] = file.load_contents(null);
        if (ok && contents){
            const out = new TextDecoder().decode(contents);
            log.r(`read ${out.length} chars`);
            return out;
        }
        log.r(`could not read ok:${ok} contents:${contents}`);
        return null;  
    }

    static saveText(dir, filename, contents){
        log.s(`Utils.saveText(dir:${dir}, filename:${filename}, contents:(${contents.length} chars))`);
        const path = GLib.build_filenamev([dir, filename]);
        GLib.file_set_contents(path, contents);
        log.r('done')
    }

    static getLangTag() {
        log.s('utils.getLangTag()');
        const locale = GLib.get_language_names()[0];
        const languageTag = locale.split(/[.@]/, 1)[0].replace(/_/g, '-');
        log.r(languageTag);
        return languageTag;
    }

    static pct(value) {
        log.s(`utils.pct(value:${value})`);
        const out = (value * 100).toFixed(0) + '%';
        log.r(`${out}`);
        return out;
    }

    static findFirst(obj, key) {
        if (obj === null || typeof obj !== 'object')
            return undefined;
        if (Object.hasOwn(obj, key))
            return obj[key];
        for (const child of Object.values(obj)) {
            const found = Utils.findFirst(child, key);
            if (found !== undefined)
                return found;
        }
        return undefined;
    }

    static funcName(fun) {
        var ret = fun.toString();
        ret = ret.substr('function '.length);
        ret = ret.substr(0, ret.indexOf('('));
        return ret;
    }
}

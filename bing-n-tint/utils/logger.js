export class Logger {
    static IND = 0;
    static IND_STEP = 2;
    static IND_CHAR = '.';
    static TIME_IND = 8;
    static TIME_STR = '';
    static MAX = 200;
    static START = 0;

    static settings = null;
    static timestamp = 'rel';
    static level = 1;
    static levels = {
        'fun': 0,
        'ret': 0,
        'INF': 1,
        'ERR': 2
    };

    static _getTimeStamp() {
        if (Logger.timestamp === 'rel') {
            const dif = Date.now() - Logger.starttime;
            return `+${String(Logger.TIME_STR + dif).slice(-8)}ms`;
        } else {
            return new Date().toISOString;
        }
    }

    static _post(tag, ...args) {
        const message = args ? args.map(String).join(' ') : '';
        const timestamp = Logger._getTimeStamp();
        const line = `${timestamp}:${Logger.IND_CHAR.repeat(Logger.IND)}${tag}: ${message}`;
        console.log(line);
        if (Logger.settings) {
            const lines = Logger.settings.get_string('debug-log').split('\n').filter(Boolean);
            lines.push(line);
            Logger.settings.set_string('debug-log', lines.slice(-Logger.MAX).join('\n'));
        }
    }

    static updateSettings(settings) {
        Logger.settings = settings;
        Logger.level = parseInt(settings.get_string('debug-level'));
        Logger.timestamp = settings.get_string('debug-timestamp');
    }

    static init(settings) {
        if (settings) {
            Logger.updateSettings(settings);
            Logger.IND = 0;
            Logger.TIME_STR = ' '.repeat(Logger.TIME_IND);
            const d = new Date();
            Logger.START = d.getMilliseconds();
            Logger.starttime = Date.now();
            Logger.settings.set_string('debug-log', `START: ${d.toISOString()}`);
        }
    }

    static dismiss() {
        Logger.IND = 0;
        Logger.settings = null;
    }

    static s(args) {
        if (Logger.level < 1) {
            Logger._post('fun', args);
            Logger.IND += Logger.IND_STEP;
        }
    }

    static r(args) {
        if (Logger.level < 1) {
            Logger.IND = Math.max(0, Logger.IND - Logger.IND_STEP);
            Logger._post('ret', args);
        }
    }

    static i(args) {
        if (Logger.level < 2)
            Logger._post('INF', args);
    }

    static e(args) {
        if (Logger.level < 3)
            Logger._post('ERR', args);
    }
}

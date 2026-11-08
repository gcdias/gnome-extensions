import GLib from 'gi://GLib';

import { Logger as log } from '../utils/logger.js';
import { Utils as utils } from '../utils/utils.js';

export class WpEngine {
    constructor(wallpaper, filename) {
        this.wallpaper = wallpaper;
        this.filename = filename;
        this.url = '';
        this.lastUpdated = 0;
        this.metadata = '';
    }

    async _download(url, userAgent) {
        return utils.download(url, userAgent);
    }

    _saveWallpaper(bytes) {
        this.lastUpdated = Date.now();
        const path = GLib.build_filenamev([this.wallpaper.cacheDir, this.filename]);
        GLib.file_set_contents(path, bytes.get_data());
        this.wallpaper.setBackground(path);
        return path;
    }

    _logDownloaded(path, message) {
        log.r(`${message} ${path}`);
    }
}

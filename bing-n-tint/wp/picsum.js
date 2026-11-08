import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';

export class Picsum extends WpEngine {
    constructor(wallpaper, utils) {
        super(wallpaper, utils, 'picsum-wallpaper.jpg');
        this.url = 'https://picsum.photos/';
        this.index = 0;
        this.lang = 'en-US';
        this.res = '1920/1080';
    }

    init(width = this.wallpaper.width, height = this.wallpaper.height) {
        this.res = `${width}/${height}`;
        this.lang = this.utils.getLangTag();
    }

    async download() {
        log.s('picsum.download()');
        this.url = `https://picsum.photos/${this.res}`;
        log.i(`url: ${this.url}`);
        const bytes = await this._download(this.url);
        const path = this._saveWallpaper(bytes);
        this._logDownloaded(path, 'Picsum wallpaper downloaded to');
        return {};
    }
}

import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';
import { Utils as utils } from '../utils/utils.js';

export class Bing extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'bing-wallpaper.jpg');
        this.index = 0;
        this.IDX_MAX = 7;
        this.lang = 'en-US';
        this.res = '1920x1080';
        this.id = 'bing';
    }

    init(settings) {
        this._settings = settings;
        this.res = this.wallpaper.width <= 768 ? '1366x768' : this.wallpaper.height <= 1080 ? '1920x1080' : 'UHD';
        this.lang = utils.getLangTag();
    }

    next(){
        this.index = (this.index + 1) % this.IDX_MAX;
        log.i(`${this._id}: index ${this.index}`);
    }

    async download() {
        log.s(`Bing.download()`);
        const metaUrl = `https://bing.biturl.top/?resolution=${this.res}&format=json&index=${this.index}&mkt=${this.lang}`;
        const metadata = await this._download(metaUrl);
        const metaStr = new TextDecoder().decode(metadata.get_data());
        this.metadata = JSON.parse(metaStr);
        this.url = this.metadata.url;
        this.desc = this.metadata?.copyright || "No description provided.";
        log.i(`imgUrl: ${this.url}, desc: ${this.desc}`);
        const bytes = await this._download(this.url);
        const path = this._saveWallpaper(bytes);
        this._settings.set_string('wp-metadata', metaStr);
        this._settings.set_string('wp-desc', this.desc);
        log.r(`Bing wallpaper downloaded to ${path}`);
        return this.metadata;
    }

}

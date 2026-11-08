import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';
import { Utils as utils } from '../utils/utils.js';

export class Bing extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'bing-wallpaper.jpg');
        this.index = 0;
        this.lang = 'en-US';
        this.res = '1920x1080';
    }

    init(width = this.wallpaper.width, height = this.wallpaper.height) {
        this.res = height <= 768 ? '1366x768' : height <= 1080 ? '1920x1080' : 'UHD';
        this.lang = utils.getLangTag();
    }

    async download(index = 0) {
        log.s(`bingWallpaper.download(index:${index})`);
        this.index = index;
        const metaUrl = `https://bing.biturl.top/?resolution=${this.res}&format=json&index=${index}&mkt=${this.lang}`;
        const metadata = await this._download(metaUrl);
        const metaStr = new TextDecoder().decode(metadata.get_data());
        this.metadata = JSON.parse(metaStr);
        this.url = this.metadata.url;
        log.i(`imgUrl: ${this.url}, desc: ${this.metadata.copyright}`);
        const bytes = await this._download(this.url);
        const path = this._saveWallpaper(bytes);
        this._logDownloaded(path, 'Bing wallpaper downloaded to');
        return this.metadata;
    }
}

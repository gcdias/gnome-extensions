import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';
import { Utils as utils } from '../utils/utils.js';

export class Wiki extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'wiki-wallpaper.jpg');
        this.userAgent = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0';
        this.date = new Date().toISOString().slice(0, 10);
        this.index = 0;
        this.IDX_MAX = 7;
        this.id = 'wiki';
    }

    init(settings) {
        this._settings = settings;
        this.api_key = settings.get_string('wiki-key');
    }

    next(){
        this.index = (this.index + 1) % this.IDX_MAX;
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - this.index);
        this.date = date.toISOString().slice(0, 10);
    }

    async download() {
        log.s('wiki.download()');
        const metaUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=images&titles=Template:POTD/${this.date}&prop=imageinfo&iiprop=url&format=json&origin=*`;
        const meta = await this._download(metaUrl, this.userAgent);
        const metaStr = new TextDecoder().decode(meta.get_data());
        let url;
        if (metaStr && (this.metadata = JSON.parse(metaStr)) && (url = utils.findFirst(this.metadata, 'url'))) {
            this.url = url;
            this.desc = utils.findFirst(this.metadata, 'title')?.replaceAll('File:','') || 'No description available.';
            const bytes = await this._download(url, this.userAgent);
            const path = this._saveWallpaper(bytes);
            this._settings.set_string('wp-metadata', metaStr);
            this._settings.set_string('wp-desc', this.desc);
            log.r(`Wikipedia wallpaper downloaded to ${path}`);
        }
        return this.metadata;
    }
}

import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';

export class Wiki extends WpEngine {
    constructor(wallpaper, utils) {
        super(wallpaper, utils, 'wiki-wallpaper.jpg');
        this.userAgent = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0';
    }

    async download() {
        log.s('wikiPOTD.download()');
        const date = new Date().toISOString().slice(0, 10);
        const metaUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=images&titles=Template:POTD/${date}&prop=imageinfo&iiprop=url&format=json&origin=*`;
        const meta = await this._download(metaUrl, this.userAgent);
        this.metadata = new TextDecoder().decode(meta.get_data());
        let url;
        if (this.metadata && (this.metadata = JSON.parse(this.metadata)) && (url = this.utils.findFirst(this.metadata, 'url'))) {
            this.url = url;
            const bytes = await this._download(url, this.userAgent);
            const path = this._saveWallpaper(bytes);
            this._logDownloaded(path, 'Wiki POTD wallpaper downloaded to');
        }
        return this.metadata;
    }
}

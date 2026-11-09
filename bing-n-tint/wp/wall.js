import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';
import { Utils as utils } from '../utils/utils.js';

export class Wall extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'wall-wallpaper.jpg');
        this.index = 0;
        this.lang = 'en-US';
        this.res = '1920x1080';
        this.desc = "No description provided.";
    }

    init(settings) {
        this._settings = settings;
        this.api_key = settings.get_string('wall-key');
    }

    async download(index = 0, query = '+nature+autumn') {
        log.s(`Wall.download(index:${index})`);
        this.index = index;
        const metaUrl = `https://wallhaven.cc/api/v1/search?apikey=${this.api_key}&q=page=1&per_page=1` + query ? `&q=${query}` : '';
        const metadata = await this._download(metaUrl);
        const metaStr = new TextDecoder().decode(metadata.get_data());
        this.metadata = JSON.parse(metaStr);
        this.metadata = this.metadata?.data[index];
        if (this.metadata && (this.url = this.metadata.url)){
            const bytes = await this._download(this.url);
            const path = this._saveWallpaper(bytes);
            this._settings.set_string('wp-metadata', metaStr);
            this._settings.set_string('wp-desc', this.desc);
            log.r(`Wallhaven wallpaper downloaded to ${path}`);    
        } else {
            log.r('No metadata url found');
        }
        return this.metadata;
    }

    getDesc() {
        return "No description provided.";
    }
}

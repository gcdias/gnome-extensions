import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';
import { Utils as utils } from '../utils/utils.js';

export class Wall extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'wall-wallpaper.jpg');
        this.index = 0;
        this.IDX_MAX = 7;
        this.lang = 'en-US';
        this.res = '1920x1080';
        this.desc = "No description provided.";
        this.id = 'wall';
    }

    init(settings) {
        this._settings = settings;
        this.api_key = settings.get_string('wall-key');
    }

    next(){
        this.index = (this.index + 1) % this.IDX_MAX;
    }

    async download(query = '+nature+autumn') {
        log.s(`Wall.download()`);
        log.i(`WallHaven index:${this.index}, query:${query}`);
        query = query ? `&q=${query}` : '';
        const metaUrl = `https://wallhaven.cc/api/v1/search?apikey=${this.api_key}&q=page=1&per_page=1${query}`;
        const metadata = await this._download(metaUrl);
        const metaStr = new TextDecoder().decode(metadata.get_data());
        this.metadata = JSON.parse(metaStr);
        this.metadata = this.metadata && this.metadata.data && this.metadata.data.length < this.index ? this.metadata.data[this.index] : null;
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

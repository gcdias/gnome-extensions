import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';

export class Nasa extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'nasa-wallpaper.jpg');
        this.api_key = '';
        this.index = 0;
        this.date = new Date().toISOString().slice(0, 10);
        this.IDX_MAX = 7;
        this.id = 'nasa';
    }

    init(settings) {
        this._settings = settings;
        this.api_key = settings.get_string('nasa-key');
    }

    next(){
        this.index = (this.index + 1) % this.IDX_MAX;
        const date = new Date();
        date.setUTCDate(date.getUTCDate() - this.index);
        this.date = date.toISOString().slice(0, 10);
    }

    async download() {
        log.s('NASA.download()');
        if (!this.api_key) {
            log.r('No API_KEY set for NASA, aborting...');
            return undefined;
        }
        const metaUrl = `https://science.nasa.gov/wp-json/wp/v2/apod-basic/?api_key=${this.api_key}&date=${this.date}`;
        const meta = await this._download(metaUrl);
        const metaStr = new TextDecoder().decode(meta.get_data());
        if (metaStr && (this.metadata = JSON.parse(metaStr))) {
            if (Array.isArray(this.metadata)){
                this.index = this.index % this.metadata.length;
                this.metadata = this.metadata[this.index];
            }
            log.i(`NASA metadata: ${this.metadata} at index ${this.index}`);
            this.url = this.metadata.hdurl;
            this.desc = this.metadata.alt || "No description provided.";
            const bytes = await this._download(this.url);
            const path = this._saveWallpaper(bytes);
            this._settings.set_string('wp-metadata', metaStr);
            this._settings.set_string('wp-desc', this.desc);
            log.r(`Nasa wallpaper downloaded to ${path}`);
        
        }
        return this.metadata;
    }
}

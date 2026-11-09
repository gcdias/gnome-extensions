import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';

export class Nasa extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'nasa-wallpaper.jpg');
        this.api_key = '';
    }

    init(settings) {
        this._settings = settings;
        this.api_key = settings.get_string('nasa-key');
    }

    async download() {
        log.s('NASA.download()');
        if (!this.api_key) {
            log.r('No API_KEY set for NASA, aborting...');
            return undefined;
        }
        const today = new Date().toISOString().slice(0, 10);
        const metaUrl = `https://science.nasa.gov/wp-json/wp/v2/apod-basic/?api_key=${this.api_key}&date=${today}`;
        const meta = await this._download(metaUrl);
        const metaStr = new TextDecoder().decode(meta.get_data());
        if (metaStr && (this.metadata = JSON.parse(metaStr))) {
            if (Array.isArray(this.metadata))
                this.metadata = this.metadata[0];
            log.i(`NASA metadata: ${this.metadata}`);
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

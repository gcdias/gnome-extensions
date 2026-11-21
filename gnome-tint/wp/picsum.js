import { WpEngine } from './wp-engine.js';
import { Logger as log } from '../utils/logger.js';
import { Utils as utils } from '../utils/utils.js';

export class Picsum extends WpEngine {
    constructor(wallpaper) {
        super(wallpaper, 'picsum-wallpaper.jpg');
        this.url = 'https://picsum.photos/';
        this.index = 0;
        this.res = '1920/1080';
        this.desc = "No description provided.";
        this.id = 'picsum';
    }

    init(settings) {
        this._settings = settings;
        this.res = `${this.wallpaper.width}/${this.wallpaper.height}`;
        this.lang = utils.getLangTag();
    }

    next(){
        this.index++;
    }

    async download() {
        log.s('picsum.download()');
        this.url = `https://picsum.photos/${this.res}`;
        log.i(`url: ${this.url}`);
        const bytes = await this._download(this.url);
        const path = this._saveWallpaper(bytes);
        log.r(`PicSum wallpaper downloaded to ${path}`);
        return {};
    }

}

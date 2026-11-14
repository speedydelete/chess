
import {loadImage, EMPTY_SQUARE, Position} from './base.js';


export class PositionRenderingOptions {

    pieceSize: number = 96;

    lightSquareColor: string = '#f0d9b5';
    darkSquareColor: string = '#b58863';

}


const DEVICE_PIXEL_RATIO = window.devicePixelRatio ?? 1;

export class RenderedPosition extends Position {

    ctx: CanvasRenderingContext2D;
    options: PositionRenderingOptions;

    constructor(data: ConstructorParameters<typeof Position>[0], ctx: CanvasRenderingContext2D, options: PositionRenderingOptions) {
        super(data);
        this.ctx = ctx;
        this.options = options;
    }

    async render() {
        let ctx = this.ctx;
        let canvas = ctx.canvas;
        let options = this.options;
        let canvasHeight = canvas.getBoundingClientRect().height * DEVICE_PIXEL_RATIO;
        let pieceSize = canvasHeight / this.height;
        let canvasWidth = pieceSize * this.width;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        canvas.style.width = (canvasWidth / DEVICE_PIXEL_RATIO) + 'px';
        canvas.style.height = (canvasHeight / DEVICE_PIXEL_RATIO) + 'px';
        console.log(`rendering at canvasWidth = ${canvasWidth}, canvasHeight = ${canvasHeight}, pieceSize = ${pieceSize}`);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? options.lightSquareColor : options.darkSquareColor;
                ctx.fillRect(x * pieceSize, y * pieceSize, pieceSize, pieceSize);
                let square = this.get([x, y]);
                if (square !== EMPTY_SQUARE) {
                    let image = square.piece.images[square.player];
                    if (typeof image === 'string') {
                        image = await loadImage(image);
                    }
                    ctx.drawImage(image, x * pieceSize, y * pieceSize, pieceSize, pieceSize);
                }
            }
        }
    }

}


export class Game {

}


import {loadImage, EMPTY_SQUARE, Position} from './base.js';


export class PositionRenderingOptions {

    pieceSize: number = 32;

    lightSquareColor: string = '#f0d9b5';
    darkSquareColor: string = '#b58863';

}


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
        let options = this.options;
        let pieceSize = options.pieceSize;
        ctx.canvas.width = this.width * pieceSize;
        ctx.canvas.height = this.height * pieceSize;
        let parity = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                ctx.fillStyle = parity === 0 ? options.lightSquareColor : options.darkSquareColor;
                ctx.fillRect(x * pieceSize, y * pieceSize, pieceSize, pieceSize);
                let square = this.get([x, y]);
                if (square !== EMPTY_SQUARE) {
                    let image = square.piece.images[square.player];
                    if (typeof image === 'string') {
                        image = await loadImage(image);
                    }
                    ctx.drawImage(image, x * pieceSize, y * pieceSize, pieceSize, pieceSize);
                }
                parity = (parity + 1) % 2;
            }
        }
    }

}


export class Game {

}

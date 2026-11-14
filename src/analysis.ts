
import {query, CHESS} from './base.js';
import {PositionRenderingOptions, RenderedPosition} from './game.js';


let canvas = query('#board', 'canvas');
let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
let options = new PositionRenderingOptions();
let pos = new RenderedPosition(CHESS.startPos, ctx, options);

pos.render();

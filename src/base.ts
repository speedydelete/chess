
export function query(query: string): HTMLElement;
export function query<T extends keyof HTMLElementTagNameMap>(query: string, type: T): HTMLElementTagNameMap[T];
export function query(query: string, type?: string): HTMLElement {
    let out = document.querySelector(query);
    if (!out) {
        throw new Error(`Missing query: '${query}'`);
    }
    if (out.tagName.toLowerCase() !== type) {
        throw new Error(`Query '${query}' is not of type '${type}'`);
    }
    return out as HTMLElement;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
    let out = document.createElement('img');
    out.src = url;
    await out.decode();
    return out;
}


export type CoordLike = Iterable<number>;

const LETTERS = `abcdefghijklmnopqrstuvwxyz`;

export function getCoordLetterString(value: number): string {
    let out = '';
    while (value > 0) {
        out = LETTERS[value % 26] + out;
        value /= 26;
    }
    return out;
}

export class Coord {

    readonly x: number;
    readonly y: number;

    constructor(x: number, y: number);
    constructor(value: CoordLike);
    constructor(x: CoordLike | number, y?: number) {
        // casts to Number here hopefully improve performance
        if (typeof x === 'number') {
            this.x = Number(x);
            this.y = Number(y);
        } else {
            [x, y] = Array.from(x);
            this.x = Number(x);
            this.y = Number(y);
        }
    }

    toString(): string {
        return getCoordLetterString(this.x) + String(this.y);
    }

    *[Symbol.iterator](): Generator<number> {
        yield this.x;
        yield this.y;
    }

    eq([x, y]: CoordLike): boolean {
        return this.x === x && this.y === y;
    }

    add([x, y]: CoordLike): Coord {
        return new Coord(this.x + x, this.y + y);
    }

    sub([x, y]: CoordLike): Coord {
        return new Coord(this.x - x, this.y - y);
    }

    abs(): Coord {
        return new Coord(Math.abs(this.x), Math.abs(this.y));
    }

    flipX(): Coord {
        return new Coord(-this.x, this.y);
    }

    flipY(): Coord {
        return new Coord(this.x, -this.y);
    }

}


export class Board<T> {

    width: number;
    height: number;
    data: T[];

    constructor(data: Board<T> | {width: number, height: number, data: T[]}) {
        this.width = data.width;
        this.height = data.height;
        this.data = data.data.slice();
    }

    isInBounds([x, y]: CoordLike): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;  
    }

    get([x, y]: CoordLike): T {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            throw new Error(`Out of bounds get: (${x}, ${y})`);
        }
        return this.data[y * this.width + x];
    }

    set([x, y]: CoordLike, value: T) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            throw new Error(`Out of bounds set: (${x}, ${y})`);
        }
        this.data[y * this.width + x] = value;
    }
    
    eq(other: Board<T>): boolean {
        return true
            && this.width === other.width
            && this.height === other.height
            && this.data.every((x, i) => x === other.data[i])
        ;
    }

    *coords(): Generator<Coord> {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                yield new Coord(x, y);
            }
        }
    }

    *values(): Generator<T> {
        for (let square of this.data) {
            if (square !== EMPTY_SQUARE) {
                yield square;
            }
        }
    }

    *entries(): Generator<[Coord, T]> {
        let i = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                yield [new Coord(x, y), this.data[i]];
                i++;
            }
        }
    }

}


// returns the captured pieces
export type MoveRunFunc = (out: Position, enPassantTargets: Coord[]) => FilledSquare[];

export type MoveToStringFunc = (emoji: false | number) => string;

export interface BaseMove {
    // if true, the move must be a capture
    // if false, the move must not be a capture
    forceCapture: boolean | undefined;
    forceFirstMove: boolean | undefined;
    eq(other: Move): boolean;
    ensureValid(): boolean;
    run: MoveRunFunc;
    toString: MoveToStringFunc;
}


export class SimpleMove implements BaseMove {

    readonly pos: Position;
    readonly piece: Piece;
    readonly from: Coord;
    readonly to: Coord;

    readonly isCapture: boolean;

    forceCapture: boolean | undefined = undefined;
    forceFirstMove: boolean | undefined = undefined;

    constructor(pos: Position, piece: Piece, from: Coord, to: Coord) {
        this.pos = pos;
        this.piece = piece;
        this.from = from;
        this.to = to;
        this.isCapture = this.pos.get(this.to) !== EMPTY_SQUARE || this.pos.enPassantTargets.some(x => x.eq(this.to));
    }

    eq(other: Move): boolean {
        if (!(other instanceof SimpleMove)) {
            return false;
        }
        return true
            && this.pos === other.pos
            && this.piece === other.piece
            && this.from.eq(other.from)
            && this.to.eq(other.to)
            && this.isCapture === other.isCapture
            && this.forceCapture === other.forceCapture
            && this.forceFirstMove === other.forceFirstMove 
        ;
    }

    ensureValid(): boolean {
        if (this.forceCapture !== undefined) {
            if (this.forceCapture !== this.isCapture) {
                return false;
            }
        }
        if (this.forceFirstMove !== undefined) {
            if (this.forceFirstMove !== this.pos.hasNotMoved.get(this.from)) {
                return false;
            }
        }
        return true;
    }

    run(out: Position) {
        out.set(this.from, EMPTY_SQUARE);
        let prev = out.get(this.to);
        if (prev != EMPTY_SQUARE) {
            out.set(this.to, EMPTY_SQUARE);
            return [prev];
        } else {
            return [];
        }
    };

    toString(emoji: false | number) {
        let out = this.piece.symbol;
        if (emoji !== false && this.piece.emojis !== undefined) {
            out = this.piece.emojis[emoji];
        }
        let xAmbiguous = false;
        let yAmbiguous = false;
        for (let other of this.pos.getLegalMoves()) {
            if (!(other instanceof SimpleMove)) {
                continue;
            }
            if (this.piece === other.piece && this.isCapture === other.isCapture && this.to.eq(other.to)) {
                if (this.from.x === other.from.x) {
                    xAmbiguous = true;
                }
                if (this.from.y === other.from.y) {
                    yAmbiguous = true;
                }
            }
        }
        if (xAmbiguous || (this.piece.symbol === '' && this.isCapture)) {
            out += getCoordLetterString(this.from.x);
        }
        if (yAmbiguous) {
            out += this.from.y;
        }
        if (this.isCapture) {
            out += 'x';
        }
        out += this.to.toString();
        return out;
    };

}


export class ComplexMove implements BaseMove {

    readonly run: MoveRunFunc;
    readonly ensureValid: () => boolean;
    readonly toString: MoveToStringFunc;

    forceCapture: boolean | undefined = undefined;
    forceFirstMove: boolean | undefined = undefined;

    constructor(run: MoveRunFunc, ensureValid: () => boolean, toString: MoveToStringFunc) {
        this.run = run;
        this.ensureValid = ensureValid;
        this.toString = toString;
    }

    eq(other: Move): boolean {
        return true
            && other instanceof ComplexMove
            && this.run === other.run
            && this.ensureValid === other.ensureValid
            && this.toString === other.toString
            && this.forceCapture === other.forceCapture
            && this.forceFirstMove === other.forceFirstMove 
        ;
    }

}


export type Move = SimpleMove | ComplexMove;


export type PieceFunc = (this: Piece, pos: Position, player: number, from: Coord) => Move[];

export interface Piece {
    name: string;
    getMoves: PieceFunc;
    symbol: string;
    images: (HTMLImageElement | string)[];
    emojis?: string[];
}


export class GameRules {

    players: number;
    playerOrder: number[];
    pieces: Piece[] = [];
    startPos: Position;

    enPassantCapturablePieces: Piece[];
    enPassantCapturingPieces: Piece[];

    checkmatePieces: Piece[];
    nFoldRepetitionRule: number | undefined = 3;
    halfmoveCounterOverridePieces: Piece[];
    nMoveRule: number | undefined = 50;

    insufficientMaterialChecker: ((pos: Position) => boolean) | undefined = undefined;

    constructor(players: number, pieces: Piece[], width: number, height: number, data: Square[]) {
        this.players = players;
        this.playerOrder = [];
        for (let i = 0; i < players; i++) {
            this.playerOrder.push(i);
        }
        this.pieces = pieces;
        this.playerOrder = [];
        let hasCastled: boolean[] = [];
        for (let i = 0; i < players; i++) {
            hasCastled.push(false);
        }
        this.startPos = new Position({
            width,
            height,
            data,
            gameRules: this,
            currentPlayer: 0,
            hasNotMoved: new Board({width, height, data: data.map(x => x !== EMPTY_SQUARE)}),
            enPassantTargets: [],
            hasCastled,
            halfmoveCounter: 0,
            prevPositions: [],
        });
        let defaultPawns = pieces.filter(piece => piece == PIECES.pawn);
        this.enPassantCapturablePieces = defaultPawns.slice();
        this.enPassantCapturingPieces = defaultPawns.slice();
        this.checkmatePieces = pieces.filter(piece => piece === PIECES.king);
        this.halfmoveCounterOverridePieces = defaultPawns.slice();
    }

}


export type GameResult = 
    | {type: 'checkmate', player: number}
    | {type: 'stalemate', player: number}
    | {type: 'insufficient-material'}
    | {type: 'nfold-repetition'}
    | {type: 'n-move-rule'}
;


export interface FilledSquare {
    readonly player: number;
    readonly piece: Piece;
}

export function square(player: number, piece: Piece): FilledSquare {
    return {player, piece};
}

export const EMPTY_SQUARE = Symbol();
export type EmptySquare = typeof EMPTY_SQUARE;

export type Square = FilledSquare | EmptySquare;

export function squaresAreEqual(x: Square, y: Square): boolean {
    if (typeof x === 'symbol') {
        return typeof y === 'symbol';
    } else {
        return typeof y !== 'symbol' && x.player === y.player && x.piece === y.piece;
    }
}

export function copySquare<T extends Square>(square: T): T {
    if (typeof square === 'symbol') {
        return EMPTY_SQUARE as T;
    } else {
        return {player: square.player, piece: square.piece} as T;
    }
}


export class Position extends Board<Square> {

    readonly gameRules: GameRules;

    currentPlayer: number;

    hasNotMoved: Board<boolean>;
    enPassantTargets: Coord[];
    hasCastled: boolean[];
    halfmoveCounter: number;
    prevPositions: Position[];

    constructor(data: Position | {
        width: number,
        height: number,
        data: Square[],
        gameRules: GameRules,
        currentPlayer: number,
        hasNotMoved: Board<boolean>,
        enPassantTargets: Coord[],
        hasCastled: boolean[],
        halfmoveCounter: number,
        prevPositions: Position[],
    }) {
        // this is required because the board constructor
        // does not copy the values, just calls .slice() on the array
        data.data = data.data.map(copySquare);
        super(data);
        this.gameRules = data.gameRules;
        this.currentPlayer = data.currentPlayer;
        this.hasNotMoved = new Board(data.hasNotMoved);
        this.enPassantTargets = data.enPassantTargets.slice();
        this.hasCastled = structuredClone(data.hasCastled);
        this.halfmoveCounter = data.halfmoveCounter;
        this.prevPositions = data.prevPositions.slice();
    }

    eq(other: Position): boolean {
        return true
            && this.width === other.width
            && this.height === other.height
            && this.data.every((x, i) => squaresAreEqual(x, other.data[i]))
            && this.gameRules === other.gameRules
            && this.currentPlayer === other.currentPlayer
            && this.hasNotMoved.eq(other.hasNotMoved)
            && this.enPassantTargets.length === other.enPassantTargets.length
            && this.enPassantTargets.every((x, i) => x.eq(other.enPassantTargets[i]))
            && this.hasCastled.length === other.hasCastled.length
            && this.hasCastled.every((x, i) => x === other.hasCastled[i])
        ;
    }

    *filledSquares(): Generator<FilledSquare> {
        let i = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let square = this.data[i];
                i++;
                if (square !== EMPTY_SQUARE) {
                    yield square;
                }
            }
        }
    }

    *filledEntries(): Generator<[Coord, FilledSquare]> {
        let i = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let square = this.data[i];
                i++;
                if (square !== EMPTY_SQUARE) {
                    yield [new Coord(x, y), square];
                }
            }
        }
    }

    getPlayerPieceCounts(player: number): Map<Piece, number> {
        let out = new Map();
        for (let square of this.filledSquares()) {
            if (square.player === player) {
                out.set(square.piece, out.get(square.piece) ?? 0);
            }
        }
        return out;
    }

    getNumberOfPieceForPlayer(player: number, piece: Piece): number {
        let out = 0;
        for (let square of this.filledSquares()) {
            if (square.player === player && square.piece === piece) {
                out++;
            }
        }
        return out;
    }

    addCapturedPieces(pieces: FilledSquare[]): void {

    }

    makeMove(move: Move): Position {
        let out = new Position(this);
        out.enPassantTargets = [];
        out.addCapturedPieces(move.run(out, this.enPassantTargets));
        out.currentPlayer = (out.currentPlayer + 1) % this.gameRules.players;
        return out;
    }

    private cachedLegalMovesPlusOnesThatLeaveMeInCheck: Move[] | undefined = undefined;

    getLegalMovesPlusOnesThatLeaveMeInCheck(): Move[] {
        if (this.cachedLegalMovesPlusOnesThatLeaveMeInCheck !== undefined) {
            return this.cachedLegalMovesPlusOnesThatLeaveMeInCheck;
        }
        let out: Move[] = [];
        for (let [coord, square] of this.filledEntries()) {
            for (let move of square.piece.getMoves(this, this.currentPlayer, coord)) {
                if (!move.ensureValid()) {
                    continue;
                }
                if (out.some(x => x.eq(move))) {
                    continue;
                }
                out.push(move);
            }
        }
        return out;
    }

    playerIsInCheck(player: number): boolean {
        let counts: number[] = [];
        for (let piece of this.gameRules.checkmatePieces) {
            counts.push(this.getNumberOfPieceForPlayer(player, piece));
        }
        for (let move of this.getLegalMovesPlusOnesThatLeaveMeInCheck()) {
            let after = this.makeMove(move);
            for (let [i, piece] of this.gameRules.checkmatePieces.entries()) {
                if (counts[i] != after.getNumberOfPieceForPlayer(player, piece)) {
                    return true;
                }
            }
        }
        return false;
    }

    private cachedLegalMoves: Move[] | undefined = undefined;

    getLegalMoves(): Move[] {
        if (this.cachedLegalMoves !== undefined) {
            return this.cachedLegalMoves;
        }
        let out: Move[] = [];
        for (let move of this.getLegalMovesPlusOnesThatLeaveMeInCheck()) {
            let after = this.makeMove(move);
            if (after.playerIsInCheck(this.currentPlayer)) {
                continue;
            }
            out.push(move);
        }
        return out;
    }

    checkForGameEnding(): false | GameResult {
        if (this.getLegalMoves().length === 0) {
            if (this.playerIsInCheck(this.currentPlayer)) {
                return {type: 'checkmate', player: this.currentPlayer};
            } else {
                return {type: 'stalemate', player: this.currentPlayer};
            }
        }
        if (this.gameRules.insufficientMaterialChecker && this.gameRules.insufficientMaterialChecker(this)) {
            return {type: 'insufficient-material'};
        }
        if (this.gameRules.nFoldRepetitionRule !== undefined) {
            let count = 0;
            for (let i = 0; i < this.prevPositions.length; i++) {
                if (this.eq(this.prevPositions[i])) {
                    count++;
                    if (count >= this.gameRules.nFoldRepetitionRule) {
                        return {type: 'nfold-repetition'};
                    }
                }
            }
        }
        if (this.gameRules.nMoveRule !== undefined) {
            if (this.halfmoveCounter >= this.gameRules.nMoveRule * 2) {
                return {type: 'n-move-rule'};
            }
        }
        return false;
    }

}


export namespace pieces {

    export function leaper(moves: CoordLike[]): PieceFunc {
        return function(this: Piece, pos: Position, player: number, from: Coord): Move[] {
            let out: SimpleMove[] = [];
            for (let value of moves) {
                if (player === 1) {
                    value = (new Coord(value)).flipY();
                }
                let to = from.add(value);
                if (!pos.isInBounds(to)) {
                    continue;
                }
                let move = new SimpleMove(pos, this, from, to);
                if (!out.some(x => x.eq(move))) {
                    out.push(move);
                }
            }
            return out;
        };
    }

    export function rider(moves: CoordLike[], limit: number): PieceFunc {
        return function(pos: Position, player: number, from: Coord): Move[] {
            let out: Move[] = [];
            for (let change of moves) {
                let to = from.add(change);
                let i = 0;
                while (pos.isInBounds(to) && i < limit) {
                    let move = new SimpleMove(pos, this, from, to);
                    if (!out.some(x => x.eq(move))) {
                        out.push(move);
                    }
                    if (pos.get(to) !== EMPTY_SQUARE) {
                        break;
                    }
                    to = to.add(change);
                    i++;
                }
            }
            return out;
        };
    }

    export function composite(data: PieceFunc[]): PieceFunc {
        return function(pos: Position, player: number, from: Coord): Move[] {
            let out: Move[] = [];
            for (let func of data) {
                for (let move of func.call(this, pos, player, from)) {
                    if (!out.some(x => x.eq(move))) {
                        out.push(move);
                    }
                }
            }
            return out;
        }
    }

    export function onlyCapture(func: PieceFunc): PieceFunc {
        return function(pos: Position, player: number, from: Coord): Move[] {
            let out = func.call(this, pos, player, from);
            for (let move of out) {
                move.forceCapture = true;
            }
            return out;
        }
    }

    export function onlyNotCapture(func: PieceFunc): PieceFunc {
        return function(pos: Position, player: number, from: Coord): Move[] {
            let out = func.call(this, pos, player, from);
            for (let move of out) {
                move.forceCapture = false;
            }
            return out;
        }
    }

    export function onlyFirstMove(func: PieceFunc): PieceFunc {
        return function(pos: Position, player: number, from: Coord): Move[] {
            let out = func.call(this, pos, player, from);
            for (let move of out) {
                move.forceFirstMove = true;
            }
            return out;
        }
    }

    export function onlyNotFirstMove(func: PieceFunc): PieceFunc {
        return function(pos: Position, player: number, from: Coord): Move[] {
            let out = func.call(this, pos, player, from);
            for (let move of out) {
                move.forceFirstMove = false;
            }
            return out;
        }
    }

    export const pawn: Piece = {
        name: 'pawn',
        getMoves: composite([
            onlyCapture(leaper([[-1, -1], [1, -1]])),
            onlyNotCapture(leaper([[0, -2]])),
            onlyFirstMove(onlyNotCapture(leaper([[0, -2]]))),
        ]),
        symbol: '',
        images: [
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_plt45.svg',    
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_pdt45.svg',
        ],
        emojis: ['♙', '♟\ufe0e'],
    };

    export const knight: Piece = {
        name: 'knight',
        getMoves: leaper([
            [-2, -1],
            [-2, 1],
            [2, -1],
            [2, 1],
            [-1, -2],
            [-1, 2],
            [1, -2],
            [1, 2],
        ]),
        symbol: 'N',
        images: [
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_nlt45.svg',
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_ndt45.svg',
        ],
        emojis: ['♘', '♞'],
    };

    export const bishop: Piece = {
        name: 'bishop',
        getMoves: rider([
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
        ], Infinity),
        symbol: 'B',
        images: [
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_blt45.svg',
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_bdt45.svg',
        ],
        emojis: ['♗', '♝'],
    };

    export const rook: Piece = {
        name: 'rook',
        getMoves: rider([
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
        ], Infinity),
        symbol: 'R',
        images: [
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_rlt45.svg',
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_rdt45.svg',
        ],
        emojis: ['♖', '♜'],
    };

    export const queen: Piece = {
        name: 'queen',
        getMoves: rider([
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
        ], Infinity),
        symbol: 'Q',
        images: [
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_qlt45.svg',
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_qdt45.svg',
        ],
        emojis: ['♕', '♛'],
    };

    export const king: Piece = {
        name: 'king',
        getMoves: leaper([
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
        ]),
        symbol: 'K',
        images: [
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_klt45.svg',
            'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Chess_kdt45.svg',
        ],
        emojis: ['♔', '♚'],
    };

}

import PIECES = pieces;


export const CHESS = new GameRules(
    2,
    [pieces.pawn, pieces.knight, pieces.bishop, pieces.rook, pieces.queen, pieces.king],
    8,
    8,
    [
        square(1, pieces.rook), square(1, pieces.knight), square(1, pieces.bishop), square(1, pieces.queen), square(1, pieces.king), square(1, pieces.bishop), square(1, pieces.knight), square(1, pieces.rook),
        square(1, pieces.pawn), square(1, pieces.pawn), square(1, pieces.pawn), square(1, pieces.pawn), square(1, pieces.pawn), square(1, pieces.pawn), square(1, pieces.pawn), square(1, pieces.pawn),
        EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE,
        EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE,
        EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE,
        EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE, EMPTY_SQUARE,
        square(0, pieces.pawn), square(0, pieces.pawn), square(0, pieces.pawn), square(0, pieces.pawn), square(0, pieces.pawn), square(0, pieces.pawn), square(0, pieces.pawn), square(0, pieces.pawn),
        square(0, pieces.rook), square(0, pieces.knight), square(0, pieces.bishop), square(0, pieces.queen), square(0, pieces.king), square(0, pieces.bishop), square(0, pieces.knight), square(0, pieces.rook),
    ],
);

CHESS.insufficientMaterialChecker = function(pos: Position): boolean {
    let winning = pos.getPlayerPieceCounts(0);
    let losing = pos.getPlayerPieceCounts(1);
    // switch winning and losing if required
    if (winning.size < losing.size) {
        winning = losing;
        let temp = winning;
        winning = losing;
        losing = temp;
    }
    // king vs king
    if (winning.size === 1 && losing.size === 1) {
        return true;
    }
    // king and knight vs king
    if (winning.size === 2 && losing.size === 1 && winning.get(pieces.knight) === 1) {
        return true;
    }
    // king and bishop vs king
    if (winning.size === 2 && losing.size === 1 && winning.get(pieces.bishop) === 1) {
        return true;
    }
    // king and bishop vs king and bishop with bishops on the same color
    if (winning.size === 2 && losing.size === 2 && winning.get(pieces.bishop) === 1 && losing.get(pieces.bishop) === 1) {
        let [[a, _], [b, _2]] = Array.from(pos.entries()).filter(x => typeof x[1] !== 'symbol' && x[1].piece === pieces.bishop);
        let aColor = (a.y * pos.width + a.x) % 2;
        let bColor = (b.y * pos.width + b.x) % 2;
        if (aColor === bColor) {
            return true;
        }
    }
    // king and two knights vs king (USCF but not FIDE)
    if (winning.size === 3 && losing.size === 1 && winning.get(pieces.knight) === 2) {
        return true;
    }
    // nothing found
    return false;
};


export function createOnlyCapturePiece(data: Piece[]) {

}

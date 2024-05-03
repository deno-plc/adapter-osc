/**
 * @license GPL-3.0-or-later
 *
 * @Deno-PLC / Adapter-OSC
 *
 * Copyright (C) 2024 Hans Schallmoser
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export type OSCArg = string | number | boolean | Uint8Array;
export type OSCArgs = readonly OSCArg[];

/**
 * Stores an array of Uint8Arrays
 */
class VariableUint8Array extends Array<Uint8Array> {
    public pack() {
        const length = this.reduce((prev, curr) => prev + curr.length, 0);
        const res = new Uint8Array(length);
        let i = 0;
        for (const arr of this) {
            for (const item of arr) {
                res[i] = item;
                i++;
            }
        }
        return res;
    }
}

/**
 * Might be thrown during {@link encodeOSC} and {@link decodeOSC} if the supplied data is invalid.
 * `.desc` contains the supplied params (addr, args for encodeOSC / data for decodeOSC)
 */
export class OSCProtocolError extends Error {
    constructor(
        readonly desc: {
            message: string;
            addr?: string;
            args?: readonly OSCArg[];
            packet?: Uint8Array;
        },
    ) {
        super(desc.message);
    }
}

/**
 * Parses an OSC packet. Might throw {@link OSCProtocolError} if the supplied data is invalid
 */
export function decodeOSC(data: Uint8Array): [string, OSCArgs] {
    if (data.length % 4 !== 0) {
        throw new OSCProtocolError({
            message: `data.length % 4 !== 0`,
            packet: data,
        });
    }
    if (data.length < 8) {
        throw new OSCProtocolError({
            message: `data.length < 8`,
            packet: data,
        });
    }

    let pos = -1;
    function consumeToken() {
        pos++;
        return data[pos] ?? 0;
    }

    function oscMemcpy(view: Uint8Array) {
        for (let i = view.length - 1; i >= 0; i--) {
            view[i] = consumeToken();
        }
    }

    function* oscStringGen() {
        let terminated = false;
        while (!terminated) { // break on \0
            for (let i = 0; i < 4; i++) {
                const token = consumeToken();
                if (token === 0) {
                    terminated = true;
                } else {
                    yield token;
                }
            }
        }
    }
    function oscString() {
        return new TextDecoder().decode(new Uint8Array(oscStringGen()));
    }

    function oscBlob() {
        const size = oscInt();
        const view = new Uint8Array(size);
        oscMemcpy(view);
        for (let i = 0; i < pad(size); i++) {
            consumeToken();
        }
        return view;
    }

    function oscInt() {
        const view = new ArrayBuffer(4);
        oscMemcpy(new Uint8Array(view));
        return new Int32Array(view)[0]!;
    }

    function oscFloat() {
        const view = new ArrayBuffer(4);
        oscMemcpy(new Uint8Array(view));
        return new Float32Array(view)[0]!;
    }

    function oscDouble() {
        const view = new ArrayBuffer(8);
        oscMemcpy(new Uint8Array(view));
        return new Float64Array(view)[0]!;
    }

    const addr = oscString();

    if (addr.charAt(0) !== "/") {
        throw new OSCProtocolError({
            message: `addr[0] != '/'`,
            packet: data,
        });
    }

    const typeTag = [...oscString()];

    if (typeTag.shift() !== ",") {
        throw new OSCProtocolError({
            message: `missing type tag`,
            packet: data,
        });
    }

    function* argsGen() {
        for (const argType of typeTag) {
            switch (argType) {
                case "s":
                    yield oscString();
                    break;
                case "i":
                    yield oscInt();
                    break;
                case "b":
                    yield oscBlob();
                    break;
                case "f":
                    yield oscFloat();
                    break;
                case "d":
                    yield oscDouble();
                    break;
                case "T":
                    yield true;
                    break;
                case "F":
                    yield false;
                    break;
            }
        }
    }

    const args = [...argsGen()];
    return [addr, args] as const;
}

/**
 * Generate an OSC packet. Might throw {@link OSCProtocolError} if the supplied data is invalid
 */
export function encodeOSC(addr: string, args: OSCArgs = []): Uint8Array {
    if (addr.charAt(0) !== "/") {
        throw new OSCProtocolError({
            message: `addr[0] != '/'`,
            args,
            addr,
        });
    }
    const data = new VariableUint8Array();

    function oscString(str: string) {
        const data = new VariableUint8Array();
        const content = new TextEncoder().encode(str);
        if (content.includes(0)) {
            throw new OSCProtocolError({
                message: `string '${str}' contains illegal characters (\\0)`,
                args,
                addr,
            });
        }
        data.push(content);
        data.push(new Uint8Array(pad(content.length, 1)));
        return ["s", data.pack()] as const;
    }
    function oscInt(int: number) {
        const buf = new ArrayBuffer(4);
        new Int32Array(buf)[0] = int;
        return ["i", new Uint8Array(buf).reverse()] as const;
    }
    function oscFloat(int: number) {
        const buf = new ArrayBuffer(4);
        new Float32Array(buf)[0] = int;
        return ["f", new Uint8Array(buf).reverse()] as const;
    }
    // function oscDouble(int: number) {
    //     const buf = new ArrayBuffer(8);
    //     new Float64Array(buf)[0] = int;
    //     return ["d", new Uint8Array(buf)] as const;
    // }

    function* argsGen() {
        for (const arg of args) {
            if (typeof arg === "string") {
                yield oscString(arg);
            } else if (arg === true) {
                yield ["T", new Uint8Array(0)] as const;
            } else if (arg === false) {
                yield ["F", new Uint8Array(0)] as const;
            } else if (typeof arg === "number") {
                if (isInt(arg)) {
                    yield oscInt(arg);
                } else {
                    yield oscFloat(arg);
                }
            }
        }
    }

    const typeTag = [","];

    const argData = [...argsGen()];

    for (const [type] of argData) {
        typeTag.push(type);
    }

    data.push(oscString(addr)[1]);
    data.push(oscString(typeTag.join(""))[1]);

    for (const [, arg] of argData) {
        data.push(arg);
    }

    return data.pack();
}

function isInt(num: number) {
    return Math.round(num) === num;
}

/**
 * computes the necessary padding to align at 4byte
 */
export function pad(content: number, minPad = 0): number {
    return (4 - ((content + minPad) % 4)) % 4 + minPad;
}

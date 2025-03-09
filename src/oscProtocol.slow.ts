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

import { OSCProtocolError } from "./oscProtocol.ts";

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
 * Parses an OSC packet. Might throw {@link OSCProtocolError} if the supplied data is invalid
 */
export function decodeOSCSlow(data: Uint8Array): [addr: string, args: OSCArgs] {
    if (data.length % 4 !== 0) {
        throw new OSCProtocolError({
            message: `data.length % 4 !== 0`,
            packet: data,
        });
    }
    if (data.length < 8) {
        throw new OSCProtocolError({
            message: `Packet too short (length < 8)`,
            packet: data,
        });
    }

    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

    let pos = 0;
    function consumeToken() {
        const val = data[pos];
        pos++;
        return val;
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
        for (let i = 0; i < size; i++) {
            view[i] = consumeToken();
        }
        for (let i = 0; i < pad(size); i++) {
            consumeToken();
        }
        return view;
    }

    function oscInt() {
        const val = dv.getInt32(pos, false);
        pos += 4;
        return val;
    }

    function oscFloat() {
        const val = dv.getFloat32(pos, false);
        pos += 4;
        return val;
    }

    function oscDouble() {
        const val = dv.getFloat64(pos, false);
        pos += 8;
        return val;
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

export interface OSCSlowEncoderOptions {
    f64?: boolean;
}

/**
 * Generate an OSC packet. Might throw {@link OSCProtocolError} if the supplied data is invalid
 */
export function encodeOSCSlow(
    addr: string,
    args: OSCArgs = [],
    opt?: OSCSlowEncoderOptions,
): Uint8Array {
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
        const buf = new Uint8Array(4);
        const dv = new DataView(buf.buffer);
        dv.setInt32(0, int, false);
        return ["i", buf] as const;
    }
    function oscFloat(int: number) {
        const buf = new Uint8Array(4);
        const dv = new DataView(buf.buffer);
        dv.setFloat32(0, int, false);
        return ["f", buf] as const;
    }
    function oscDouble(int: number) {
        const buf = new Uint8Array(8);
        const dv = new DataView(buf.buffer);
        dv.setFloat64(0, int, false);
        return ["d", buf] as const;
    }

    function oscBlob(blob: Uint8Array) {
        const buf = new Uint8Array(4 + blob.length + pad(blob.length));
        const dv = new DataView(buf.buffer);
        dv.setInt32(0, blob.length, false);
        buf.set(blob, 4);
        return ["b", buf] as const;
    }

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
                } else if (opt?.f64) {
                    yield oscDouble(arg);
                } else {
                    yield oscFloat(arg);
                }
            } else if (arg instanceof Uint8Array) {
                yield oscBlob(arg);
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

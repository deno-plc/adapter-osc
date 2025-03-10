/**
 * @license GPL-3.0-or-later
 *
 * @Deno-PLC / Adapter-OSC
 *
 * Copyright (C) 2024 - 2025 Hans Schallmoser
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

import { assert } from "@std/assert/assert";
import { ASCII } from "./ascii.ts";

/**
 * An OSC argument. Can be a string, number, boolean or a binary blob.
 */
export type OSCArg = string | number | boolean | Uint8Array;

/**
 * An array of OSC arguments
 */
export type OSCArgs = readonly OSCArg[];

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
        super(`${desc.message} (addr: ${desc.addr})`);
    }
}

/**
 * Parses an OSC packet. Might throw {@link OSCProtocolError} if the supplied data is invalid
 */
export function decodeOSC(data: Uint8Array): [addr: string, args: OSCArgs] {
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

    const td = new TextDecoder();
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const addr_end = data.indexOf(ASCII.NULL);
    const addr = td.decode(
        new Uint8Array(data.buffer, data.byteOffset, addr_end),
    );
    let offset = align4(addr_end + 1);

    const tt_offset = offset;
    const tt_end = data.indexOf(ASCII.NULL, tt_offset);
    offset = align4(tt_end + 1);

    if (data[tt_offset] !== ASCII.COMMA) {
        throw new OSCProtocolError({
            message: `invalid type tag`,
            packet: data,
            addr,
        });
    }

    const args: OSCArg[] = Array(tt_end - tt_offset - 1);

    for (let i = 0, ti = tt_offset + 1; ti < tt_end; (i++, ti++)) {
        switch (data[ti]) {
            case ASCII.s: {
                const end = data.indexOf(ASCII.NULL, offset);
                args[i] = td.decode(
                    new Uint8Array(
                        data.buffer,
                        data.byteOffset + offset,
                        end - offset,
                    ),
                );
                offset = align4(end + 1);
                break;
            }
            case ASCII.i:
                args[i] = dv.getInt32(offset, false);
                offset += 4;
                break;
            case ASCII.b: {
                const len = dv.getInt32(offset, false);
                offset += 4;
                args[i] = data.slice(offset, offset + len);
                offset += align4(len);
                break;
            }
            case ASCII.f:
                args[i] = dv.getFloat32(offset, false);
                offset += 4;
                break;
            case ASCII.d:
                args[i] = dv.getFloat64(offset, false);
                offset += 8;
                break;
            case ASCII.T:
                args[i] = true;
                break;
            case ASCII.F:
                args[i] = false;
                break;
        }
    }

    return [addr, args] as const;
}

export interface OSCEncoderOptions {
    /**
     * The number of bytes to add to the packet size. This is required for multibyte UTF-8 characters.
     */
    oversize?: number;

    /**
     * Use double precision floating point numbers (64-bit) instead of single precision (32-bit) for numbers
     */
    f64?: boolean;
}

/**
 * Generate an OSC packet. Might throw {@link OSCProtocolError} if the supplied data is invalid. This will throw an error if any string contains non-ASCII (multi-byte) characters.
 */
export function encodeOSC(
    addr: string,
    args: OSCArgs = [],
    options?: OSCEncoderOptions,
): Uint8Array {
    const te = new TextEncoder();
    const tt = new Uint8Array(args.length);

    let packet_size = align4(addr.length + 1) + align4(tt.length + 2);

    for (let i = 0; i < args.length; i++) {
        if (args[i] === true) {
            tt[i] = ASCII.T;
        } else if (args[i] === false) {
            tt[i] = ASCII.F;
        } else if (typeof args[i] === "string") {
            tt[i] = ASCII.s;
            const len = (args[i] as string).length;
            packet_size += align4(len + 1);
        } else if (typeof args[i] === "number") {
            if (isInt(args[i] as number)) {
                tt[i] = ASCII.i;
                packet_size += 4;
            } else if (options?.f64) {
                tt[i] = ASCII.d;
                packet_size += 8;
            } else {
                tt[i] = ASCII.f;
                packet_size += 4;
            }
        } else if (args[i] instanceof Uint8Array) {
            tt[i] = ASCII.b;
            const len = (args[i] as Uint8Array).length;
            packet_size += align4(len) + 4;
        }
    }

    const packet = new Uint8Array(packet_size + (options?.oversize ?? 0));
    const dv = new DataView(packet.buffer);

    let offset = align4(te.encodeInto(addr, packet).written + 1);

    packet[offset] = ASCII.COMMA;
    packet.set(tt, offset + 1);
    offset = align4(offset + tt.length + 2);

    for (let i = 0; i < args.length; i++) {
        switch (tt[i]) {
            case ASCII.s: {
                // we known that packet has an byteOffset of 0
                const { written } = te.encodeInto(
                    args[i] as string,
                    new Uint8Array(packet.buffer, offset),
                );
                offset += align4(written + 1);
                break;
            }
            case ASCII.i: {
                dv.setInt32(offset, args[i] as number, false);
                offset += 4;
                break;
            }
            case ASCII.f: {
                dv.setFloat32(offset, args[i] as number, false);
                offset += 4;
                break;
            }
            case ASCII.d: {
                dv.setFloat64(offset, args[i] as number, false);
                offset += 8;
                break;
            }
            case ASCII.b: {
                const blob = args[i] as Uint8Array;
                dv.setInt32(offset, blob.length, false);
                offset += 4;
                packet.set(blob, offset);
                offset += align4(blob.length);
                break;
            }
        }
    }

    if (offset > packet.byteLength) {
        throw new OSCProtocolError({
            message:
                `more ${offset} bytes written than expected (${packet.byteLength})`,
            args,
            addr,
        });
    }

    return new Uint8Array(packet.buffer, 0, offset);
}

/**
 * Same as {@link encodeOSC}, but handles UTF-8 multibyte characters without any configuration. Might throw {@link OSCProtocolError} if the supplied data is invalid.
 */
export function encodeOSC_UTF8(
    addr: string,
    args: OSCArgs = [],
    options?: OSCEncoderOptions,
): Uint8Array {
    const te = new TextEncoder();
    const tt = new Uint8Array(args.length);

    const addr_enc = te.encode(addr);

    const tt_start = align4(addr_enc.length + 1);
    const tt_end_offset = align4(tt_start + tt.length + 2);

    let packet_size = tt_end_offset;

    const str_args: Uint8Array[] = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === true) {
            tt[i] = ASCII.T;
        } else if (args[i] === false) {
            tt[i] = ASCII.F;
        } else if (typeof args[i] === "string") {
            tt[i] = ASCII.s;
            const enc = te.encode(args[i] as string);
            str_args.push(enc);
            packet_size += align4(enc.length + 1);
        } else if (typeof args[i] === "number") {
            if (isInt(args[i] as number)) {
                tt[i] = ASCII.i;
                packet_size += 4;
            } else if (options?.f64) {
                tt[i] = ASCII.d;
                packet_size += 8;
            } else {
                tt[i] = ASCII.f;
                packet_size += 4;
            }
        } else if (args[i] instanceof Uint8Array) {
            tt[i] = ASCII.b;
            const len = (args[i] as Uint8Array).length;
            packet_size += align4(len) + 4;
        }
    }

    const packet = new Uint8Array(packet_size);
    const dv = new DataView(packet.buffer);

    packet.set(addr_enc, 0);
    packet[tt_start] = ASCII.COMMA;
    packet.set(tt, tt_start + 1);

    let offset = tt_end_offset;

    for (let i = 0; i < args.length; i++) {
        switch (tt[i]) {
            case ASCII.s: {
                const str = str_args.shift()!;
                packet.set(str, offset);
                offset += align4(str.length + 1);
                break;
            }
            case ASCII.i: {
                dv.setInt32(offset, args[i] as number, false);
                offset += 4;
                break;
            }
            case ASCII.f: {
                dv.setFloat32(offset, args[i] as number, false);
                offset += 4;
                break;
            }
            case ASCII.d: {
                dv.setFloat64(offset, args[i] as number, false);
                offset += 8;
                break;
            }
            case ASCII.b: {
                const blob = args[i] as Uint8Array;
                dv.setInt32(offset, blob.length, false);
                offset += 4;
                packet.set(blob, offset);
                offset += align4(blob.length);
                break;
            }
        }
    }

    assert(offset === packet_size);

    return new Uint8Array(packet.buffer, 0, offset);
}

function isInt(num: number) {
    return Math.round(num) === num;
}

/**
 * Aligns a number to the next multiple of 4
 */
export function align4(x: number): number {
    return ((x | 0) + 3) & -4;
}

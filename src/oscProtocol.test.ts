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

import { assert, assertEquals } from "@std/assert";
import {
    align4,
    decodeOSC,
    encodeOSC,
    encodeOSC_UTF8,
    type OSCArgs,
} from "./oscProtocol.ts";
import { decodeOSCSlow, encodeOSCSlow, pad } from "./oscProtocol.slow.ts";

Deno.test("padding (slow)", () => {
    // minPad 0
    assertEquals(pad(0), 0);
    assertEquals(pad(1), 3);
    assertEquals(pad(2), 2);
    assertEquals(pad(3), 1);
    assertEquals(pad(4), 0);
    assertEquals(pad(5), 3);

    // minPad 1
    assertEquals(pad(0, 1), 4);
    assertEquals(pad(1, 1), 3);
    assertEquals(pad(2, 1), 2);
    assertEquals(pad(3, 1), 1);
    assertEquals(pad(4, 1), 4);
    assertEquals(pad(5, 1), 3);
});

Deno.test("align4", () => {
    for (let x = 0; x < 100; x++) {
        const aligned = align4(x);
        assert((aligned & 0b11) === 0, "not aligned at 4");
        assert(aligned >= x);
        assert(aligned < x + 4);
    }
});

const testPackets: [addr: string, args: OSCArgs][] = [
    ["/foo/bar/1", []],
    ["/foo/bar/2", ["baz", 123, true]],
    ["/foo/bar/3", ["baz2", 2.5, true]],
    ["/foo/bar", ["baz", new Uint8Array([1, 2, 3, 4, 5])]],
];
const encodedPackets: Uint8Array[] = testPackets.map(([addr, args]) =>
    encodeOSCSlow(addr, args)
);

Deno.test("encode equals", () => {
    for (const [addr, args] of testPackets) {
        assertEquals(encodeOSC(addr, args), encodeOSCSlow(addr, args));
    }
});

Deno.test("encode equals (f64)", () => {
    for (const [addr, args] of testPackets) {
        const o = {
            f64: true,
        };
        assertEquals(encodeOSC(addr, args, o), encodeOSCSlow(addr, args, o));
        assertEquals(
            encodeOSC_UTF8(addr, args, o),
            encodeOSCSlow(addr, args, o),
        );
    }
});

Deno.test("encode equals (UTF-8)", () => {
    for (const [addr, args] of testPackets) {
        assertEquals(encodeOSC_UTF8(addr, args), encodeOSCSlow(addr, args));
    }
});

Deno.test("decode equals", () => {
    for (const packet of encodedPackets) {
        assertEquals(decodeOSC(packet), decodeOSCSlow(packet));
    }
});

Deno.test("encode/decode equals (slow)", () => {
    for (const [addr, args] of testPackets) {
        const [addr2, args2] = decodeOSCSlow(encodeOSCSlow(addr, args));
        assertEquals(addr2, addr);
        assertEquals(args2, args);
    }
});

Deno.test("encode/decode equals", () => {
    for (const [addr, args] of testPackets) {
        const [addr2, args2] = decodeOSC(encodeOSC(addr, args));
        assertEquals(addr2, addr);
        assertEquals(args2, args);
    }
});

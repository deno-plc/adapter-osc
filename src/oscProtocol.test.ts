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

import { assertEquals } from "@std/assert";
import { decodeOSC, encodeOSC, type OSCArgs, pad } from "./oscProtocol.ts";

Deno.test("osc padding", () => {
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

function encodeDecode(addr: string, args: OSCArgs) {
    const [addr2, args2] = decodeOSC(encodeOSC(addr, args));
    assertEquals(addr, addr2);
    assertEquals(args, args2);
}

Deno.test("osc encode/decode equals", () => {
    encodeDecode("/abc", []);
});

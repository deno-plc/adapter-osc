/**
 * @license GPL-3.0-or-later
 *
 * @Deno-PLC / Adapter-OSC
 *
 * Copyright (C) 2025 Hans Schallmoser
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

import { decodeOSCSlow, encodeOSCSlow } from "./oscProtocol.slow.ts";
import { decodeOSC, encodeOSC, encodeOSC_UTF8 } from "./oscProtocol.ts";

const sampleAddr =
    "/foo/bar/40d9dee8-5f94-414a-a5cf-8f072eebaa7a/bd1ed185-71d8-47a3-864b-384a565737e5";
const sampleArgs = [
    1,
    true,
    "bd1ed185-71d8-47a3-864b-384a565737e5",
    5.5,
    new Uint8Array([1, 2, 3, 4, 5]),
];
const sampleMessage = encodeOSCSlow(sampleAddr, sampleArgs);

Deno.bench({
    name: "decode (slow)",
    group: "decode",
}, () => {
    decodeOSCSlow(sampleMessage);
});

Deno.bench({
    name: "decode (default)",
    baseline: true,
    group: "decode",
}, () => {
    decodeOSC(sampleMessage);
});

Deno.bench({
    name: "encode (slow)",
    group: "encode",
}, () => {
    encodeOSCSlow(sampleAddr, sampleArgs);
});

Deno.bench({
    name: "encode (default)",
    baseline: true,
    group: "encode",
}, () => {
    encodeOSC(sampleAddr, sampleArgs);
});

Deno.bench({
    name: "encode UTF-8 (default)",
    group: "encode",
}, () => {
    encodeOSC_UTF8(sampleAddr, sampleArgs);
});

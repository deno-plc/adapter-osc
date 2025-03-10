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

export {
    decodeOSC,
    encodeOSC,
    encodeOSC_UTF8,
    OSCProtocolError,
} from "./src/oscProtocol.ts";
export type { OSCArg, OSCArgs, OSCEncoderOptions } from "./src/oscProtocol.ts";

import type {
    TCPAdapterCallback,
    TCPAdapterSession,
} from "@deno-plc/adapter-tcp";
import { decodeOSC, type OSCArgs } from "./src/oscProtocol.ts";
import { encodeSLIP, SLIPDecoder } from "@deno-plc/slip";
import { encodeOSC } from "./src/oscProtocol.ts";

/**
 * OSC-over-TCP with SLIP framing
 */
export abstract class TCPOSCAdapter implements TCPAdapterSession {
    constructor(send: TCPAdapterCallback) {
        this.#send_socket = send;
        this.#slip_handler.max_carry_oversize = 200;
    }
    #send_socket: TCPAdapterCallback;
    readonly #slip_handler = new SLIPDecoder();

    recv(data: Uint8Array): void {
        for (const packet of this.#slip_handler.decode(data)) {
            const [addr, args] = decodeOSC(packet);
            this.on_packet(addr, args);
        }
    }

    protected abstract on_packet(addr: string, args: OSCArgs): void;

    send(addr: string, args: OSCArgs = []) {
        this.#send_socket(encodeSLIP(encodeOSC(addr, args)));
    }

    abstract destroy(): void;
}

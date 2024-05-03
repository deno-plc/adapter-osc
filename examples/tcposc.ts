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

import { TCPOSCAdapter } from "../mod.ts";
import type { OSCArgs } from "../mod.ts";

import { TCPAdapter, type TCPAdapterCallback } from "@deno-plc/adapter-tcp";

interface MyDeviceAdapterOptions {
    host: string;
    port: number;
    verbose?: boolean;
}

class MyDeviceAdapter extends TCPAdapter {
    constructor(options: MyDeviceAdapterOptions) {
        super({
            sessionFactory: (cb) => new MyDeviceAdapterSession(this, cb),
            ...options,
        });
    }
}

// Step 1: Let your session extends TCPOSCAdapter
class MyDeviceAdapterSession extends TCPOSCAdapter {
    constructor(readonly adapter: MyDeviceAdapter, send: TCPAdapterCallback) {
        // Step 2: pass over the tcp write callback
        super(send);

        setTimeout(() => {
            // Step 4: Use `.send(addr, args)`
            super.send("/foo/bar", [5, true]);
        });
    }
    // Step 3: implement the `on_packet` method to receive packets
    on_packet(addr: string, args: OSCArgs): void {
        console.log(
            `[Client] [RX] ${addr}=${args.map(($) => $.toString()).join(",")}`,
        );
    }
    destroy(): void {
        // nothing to cleanup
    }
}

const _adapter = new MyDeviceAdapter({
    host: "127.0.0.1",
    port: 1234,
    verbose: true,
});

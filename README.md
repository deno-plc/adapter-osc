# [Deno-PLC](https://github.com/deno-plc) / [Adapter-OSC](https://jsr.io/@deno-plc/adapter-osc)

TypeScript implementation of
[OSC (Open Sound Control)](https://en.wikipedia.org/wiki/Open_Sound_Control)

## Installation

[Use JSR: ![JSR](https://jsr.io/badges/@deno-plc/adapter-osc)](https://jsr.io/@deno-plc/adapter-osc)

## Usage

### Encoder

```ts
import { encodeOSC } from "@deno-plc/adapter-osc";

const packet = encodeOSC("/foo/bar", [5, true]);
```

This might thro an OSCProtocolError if the supplied data is invalid

### Decoder

```ts
import { decodeOSC } from "@deno-plc/adapter-osc";

const [address, args] = decodeOSC(packet);
```

This might thro an OSCProtocolError if the supplied data is invalid

### OSC over TCP

This package has support for OSC-over-TCP (=OSC packets are transmitted
[SLIP (Serial Line Internet Protocol)](https://en.wikipedia.org/wiki/Serial_Line_Internet_Protocol)
encoded over a TCP socket) usable in conjunction with
[adapter-tcp](https://jsr.io/@deno-plc/adapter-tcp). For usage instructions see
[`examples/tcposc.ts`](examples/tcposc.ts)

### Supported data types

- string (s) (`string`)
- int32 (i) (`number`)
- blob (b) (`Uint8Array`)
- float32 (f) (`number`)
- float64 (d) (`number`)
- boolean (T,F) (`boolean`)

## License (GPL-3.0-or-later)

(C) 2024 Hans Schallmoser

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
this program. If not, see https://www.gnu.org/licenses/.

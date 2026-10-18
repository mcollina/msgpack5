This file provides guidance to AI coding agents like Claude Code (claude.ai/code), Cursor AI, Codex, Gemini CLI, GitHub Copilot, and other AI coding assistants when working with code in this repository.

# Development commands

- Install dependencies: `npm install` (the repository has no lockfile).
- Run lint and the complete Tape suite: `npm test`.
- Run lint only: `./node_modules/.bin/standard`.
- Run one test file: `node test/streams.js` (replace the path with any `test/*.js` file). This emits raw TAP and does not run lint.
- Benchmark throughput: `npm run bench` (head-to-head vs `msgpackr`, `msgpack-lite`, `@msgpack/msgpack`, and JSON), `npm run bench:stream` (streaming decoder), and `npm run bench:ab` (A/B two checkouts via `AB_OLD`/`AB_NEW`). The comparison libraries are devDependencies, and `benchmarks/` is linted by `standard` as part of `npm test`.

CI runs `npm test` on Node.js 22, 24, and 26 on macOS, Windows, and Ubuntu. `@platformatic/dynamic-buffer` requires Node.js >= 22.19.0, so older releases are not supported.

# Architecture

- `index.js` is the CommonJS entry point and instance factory. Each `msgpack()` call creates private encoder and decoder extension registries, installs the timestamp codec, builds bound `encode`/`decode` functions, and exposes stream constructors plus the LevelUP encoding metadata.
- `lib/encoder.js` recursively dispatches JavaScript values to MessagePack wire families, writing them into a single growable `Writer` buffer (instead of allocating a `Buffer`/`DynamicBuffer` per value), and returns a `Buffer` subarray view over the used bytes at the public boundary (the writer is per-`encode()` and discarded, so the view is the sole reference — no copy). String bytes are written with the internal `Buffer#utf8Write` fast path (the writer buffer is always a real `Buffer`). Maps and plain objects take separate paths; options such as `forceFloat64`, `sortKeys`, `compatibilityMode`, and `preferMap` alter wire-format decisions.
- `lib/decoder.js` is an iterative, frame-stack parser. `tryDecode` uses an explicit frame stack (allocated lazily on the first container frame) instead of recursion; scalar helpers (`decodeSigned`, `decodeExt`, `decodeUnsignedInt`, `decodeFloat`) return the value directly, and `decode()` sets `context.value` only when a top value completes. Public `decode()` operates directly on a plain `Buffer` when one is supplied (skipping `DynamicBuffer` indirection) and sets `context.fast` so string decode uses the internal `Buffer#utf8Slice` (unavailable on `DynamicBuffer`). For the non-streaming path, map results are built directly (object or `Map`, with `protoAction` deferred until the end) rather than staged in a `pairs` array; the streaming path (`tryDecodeIncremental`/`completeIncrementalValue`) still stages values in a `pairs` array and builds the map with `buildMap`. It consumes exactly one value and turns incomplete input into `IncompleteBufferError`.
- `lib/streams.js` depends on that decoder contract: it accumulates chunks, retains incomplete frames, and repeatedly decodes concatenated frames. The exported constructors rely on being called as `pack.encoder()` / `pack.decoder()` so `this` is the msgpack instance. `wrap: true` is required when stream values may be `null`.
- Extension encoders produce a buffer whose first byte is the signed extension type and whose remaining bytes are payload. `register()` adds this byte automatically; callers of the lower-level `registerEncoder()` must add it themselves and pair it with `registerDecoder()`. The built-in `lib/codecs/DateCodec.js` uses reserved type `-1`; `disableTimestampEncoding` disables only Date encoding, not decoding.
- Map decoding produces a plain object only when every key is a string and `preferMap` is false; otherwise it produces a `Map`. The `protoAction` handling applies during the plain-object path.

# Test organization

Tests are Tape files grouped primarily by MessagePack wire type and size boundary. For encoder/decoder changes, preserve exact-byte assertions and cover both sides of affected boundaries; use the focused suites for extensions, timestamps, maps, prototype handling, and streaming when those cross-cutting paths change. `spec.md` is the checked-in MessagePack specification used by this implementation.

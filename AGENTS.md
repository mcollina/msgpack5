This file provides guidance to AI coding agents like Claude Code (claude.ai/code), Cursor AI, Codex, Gemini CLI, GitHub Copilot, and other AI coding assistants when working with code in this repository.

# Development commands

- Install dependencies: `npm install` (the repository has no lockfile).
- Run lint and the complete Tape suite: `npm test`.
- Run lint only: `./node_modules/.bin/standard`.
- Run one test file: `node test/streams.js` (replace the path with any `test/*.js` file). This emits raw TAP and does not run lint.
- Build both tracked browser bundles: `npm run build`. This runs Browserify for `dist/msgpack5.js`, then UglifyJS for `dist/msgpack5.min.js`.
- Build only the unminified browser bundle: `npm run browserify`; minify the existing bundle: `npm run dist`.

CI runs `npm test` on Node.js 10, 12, 14, 16, 18, 20, 22, 24, and 26. Node.js 10–14 run on Linux and Windows only because they do not provide binaries for current arm64 macOS runners; newer versions also run on macOS. Keep runtime code compatible with Node.js 10 unless the support matrix is intentionally changed.

# Architecture

- `index.js` is the CommonJS entry point and instance factory. Each `msgpack()` call creates private encoder and decoder extension registries, installs the timestamp codec, builds bound `encode`/`decode` functions, and exposes stream constructors plus the LevelUP encoding metadata.
- `lib/encoder.js` recursively dispatches JavaScript values to MessagePack wire families and returns a sliced `Buffer` at the public boundary. Maps and plain objects take separate paths; options such as `forceFloat64`, `sortKeys`, `compatibilityMode`, and `preferMap` alter wire-format decisions.
- `lib/decoder.js` is a recursive parser whose internal operations return `[value, consumedByteCount]` or `null` for incomplete input. Public `decode()` converts input to a `bl` BufferList, consumes exactly one value, and turns incomplete input into `IncompleteBufferError`.
- `lib/streams.js` depends on that decoder contract: it accumulates chunks, retains incomplete frames, and repeatedly decodes concatenated frames. The exported constructors rely on being called as `pack.encoder()` / `pack.decoder()` so `this` is the msgpack instance. `wrap: true` is required when stream values may be `null`.
- Extension encoders produce a buffer whose first byte is the signed extension type and whose remaining bytes are payload. `register()` adds this byte automatically; callers of the lower-level `registerEncoder()` must add it themselves and pair it with `registerDecoder()`. The built-in `lib/codecs/DateCodec.js` uses reserved type `-1`; `disableTimestampEncoding` disables only Date encoding, not decoding.
- Map decoding produces a plain object only when every key is a string and `preferMap` is false; otherwise it produces a `Map`. The `protoAction` handling applies during the plain-object path.
- `dist/` contains generated, committed standalone browser artifacts, not source. Regenerate both files with `npm run build` when source behavior exposed in the browser bundle changes.

# Test organization

Tests are Tape files grouped primarily by MessagePack wire type and size boundary. For encoder/decoder changes, preserve exact-byte assertions and cover both sides of affected boundaries; use the focused suites for extensions, timestamps, maps, prototype handling, and streaming when those cross-cutting paths change. `spec.md` is the checked-in MessagePack specification used by this implementation.

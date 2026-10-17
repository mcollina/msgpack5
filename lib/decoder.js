'use strict'

const { DynamicBuffer } = require('@platformatic/dynamic-buffer')
const IncompleteBufferError = require('./helpers.js').IncompleteBufferError
const toBufferList = require('./helpers.js').toBufferList

const SIZES = {
  0xc4: 2,
  0xc5: 3,
  0xc6: 5,
  0xc7: 3,
  0xc8: 4,
  0xc9: 6,
  0xca: 5,
  0xcb: 9,
  0xcc: 2,
  0xcd: 3,
  0xce: 5,
  0xcf: 9,
  0xd0: 2,
  0xd1: 3,
  0xd2: 5,
  0xd3: 9,
  0xd4: 3,
  0xd5: 4,
  0xd6: 6,
  0xd7: 10,
  0xd8: 18,
  0xd9: 2,
  0xda: 3,
  0xdb: 5,
  0xdc: 3,
  0xdd: 5,
  0xde: 3,
  0xdf: 5
}

// The property name is looked up often while building plain objects, so it is
// hoisted to a module-scope constant instead of a per-map local binding.
const PROTO = '__proto__'

// DynamicBuffer does not expose the variable-length readUIntBE, so read it
// through the fixed-width accessors when possible to avoid a temporary slice.
function readUIntBE (buf, offset, length) {
  if (length === 1) return buf.readUInt8(offset)
  if (length === 2) return buf.readUInt16BE(offset)
  if (length === 4) return buf.readUInt32BE(offset)
  return buf.slice(offset, offset + length).readUIntBE(0, length)
}

module.exports = function buildDecode (decodingTypes, options) {
  const maxDepth = options.maxDepth === undefined ? 100 : options.maxDepth
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new TypeError('maxDepth must be a non-negative integer')
  }

  // `value` is a single reusable slot. `tryDecode` and its helpers write the
  // decoded value here and return the number of consumed bytes, so we never
  // allocate a `[value, consumed]` array per value. Each caller must read the
  // slot immediately after the call, before invoking `tryDecode` again.
  const context = { decodingTypes, options, maxDepth, decode, value: undefined }
  return decode

  function decode (buf, decodeState) {
    const isDynamic = DynamicBuffer.isDynamicBuffer(buf)

    // Fast path: a plain Buffer can be read directly with the native
    // accessors. Wrapping it in a DynamicBuffer would route every single-byte
    // read through findInitialBuffer()/scratch-buffer indirection, which is
    // several times slower. We only need the DynamicBuffer wrapper (a) for the
    // streaming decodeState path that consumes chunks, and (b) for non-Buffer
    // inputs that must be coerced.
    if (!isDynamic && !Buffer.isBuffer(buf)) {
      buf = toBufferList(buf)
    }

    // Flag whether `buf` is a real Buffer so the hot string path can use the
    // internal utf8Slice fast path (which is not available on DynamicBuffer)
    // without a per-string Buffer.isBuffer check.
    context.fast = Buffer.isBuffer(buf)

    let value
    let completed = false
    try {
      if (decodeState) {
        // Streaming: the state machine returns the fully-decoded top value.
        const done = tryDecodeIncremental(buf, decodeState, context)
        if (done) {
          value = done[0]
          completed = true
        }
      } else {
        const consumed = tryDecode(buf, 0, context, 0)
        if (consumed) {
          if (isDynamic) buf.consume(consumed)
          value = context.value
          completed = true
        }
      }
    } catch (err) {
      if (decodeState) decodeState.stack.length = 0
      throw err
    }

    // Handle worst case ASAP and keep code flat. Throwing outside the try keeps
    // the streaming state machine intact on an incomplete frame.
    if (!completed) throw new IncompleteBufferError()

    return value
  }
}

function tryDecodeIncremental (buf, state, context) {
  while (buf.length > 0) {
    const container = decodeContainerHeader(buf)
    let value

    if (container === null) return null

    if (container) {
      const depth = state.stack.length + 1
      if (depth > context.maxDepth) {
        throw new Error('Maximum decode depth exceeded')
      }
      checkCollectionLength(
        container.type,
        container.length,
        container.type === 'map' ? context.options.maxMapLength : context.options.maxArrayLength
      )

      buf.consume(container.headerLength)

      const itemCount = container.type === 'map'
        ? 2 * container.length
        : container.length

      if (itemCount > 0) {
        state.stack.push({
          type: container.type,
          length: container.length,
          itemCount,
          result: []
        })
        continue
      }

      value = container.type === 'map'
        ? buildMap([], 0, context)
        : []
    } else {
      const consumed = tryDecode(buf, 0, context, state.stack.length)
      if (!consumed) return null

      buf.consume(consumed)
      value = context.value
    }

    const completed = completeIncrementalValue(state, value, context)
    if (completed) return completed
  }

  return null
}

function completeIncrementalValue (state, value, context) {
  while (state.stack.length > 0) {
    const frame = state.stack[state.stack.length - 1]
    frame.result.push(value)

    if (frame.result.length < frame.itemCount) return null

    state.stack.pop()
    value = frame.type === 'map'
      ? buildMap(frame.result, frame.length, context)
      : frame.result
  }

  return [value]
}

function decodeContainerHeader (buf) {
  const first = buf.readUInt8(0)

  if ((first & 0xf0) === 0x80) {
    return { type: 'map', length: first & 0x0f, headerLength: 1 }
  }
  if ((first & 0xf0) === 0x90) {
    return { type: 'array', length: first & 0x0f, headerLength: 1 }
  }

  let headerLength
  if (first === 0xdc || first === 0xde) headerLength = 3
  if (first === 0xdd || first === 0xdf) headerLength = 5
  if (!headerLength) return false
  if (buf.length < headerLength) return null

  return {
    type: first === 0xdc || first === 0xdd ? 'array' : 'map',
    length: readUIntBE(buf, 1, headerLength - 1),
    headerLength
  }
}

function checkCollectionLength (type, length, maxLength) {
  if (maxLength !== undefined && length > maxLength) {
    throw new RangeError(type + ' length ' + length + ' exceeds configured limit of ' + maxLength)
  }
}

// `allString` may be omitted to fall back to scanning the keys (the streaming
// path reuses this for the empty-map shortcut and when frames complete).
function buildMap (result, length, context, allString) {
  if (allString === undefined) {
    allString = !context.options.preferMap
    if (allString) {
      for (let i = 0; i < 2 * length; i += 2) {
        if (typeof result[i] !== 'string') {
          allString = false
          break
        }
      }
    }
  }

  if (allString) {
    const object = {}
    for (let i = 0; i < 2 * length; i += 2) {
      const key = result[i]
      const val = result[i + 1]

      if (key === PROTO) {
        if (context.options.protoAction === 'error') {
          throw new SyntaxError('Object contains forbidden prototype property')
        }

        if (context.options.protoAction === 'remove') {
          continue
        }
      }

      object[key] = val
    }
    return object
  } else {
    const mapping = new Map()
    for (let i = 0; i < 2 * length; i += 2) {
      mapping.set(result[i], result[i + 1])
    }
    return mapping
  }
}

// Iterative, non-recursive decode of a single value starting at `initialOffset`.
// Nested arrays and maps are handled with an explicit frame stack instead of
// recursion, which removes per-value function-call overhead on the hot path and
// the deep call stack for nested data. Collection frames accumulate child values
// into a flat array; an array frame's array is the result, a map frame's array
// is the [k0,v0,k1,v1,...] pairs handed to buildMap(), which applies
// preferMap/protoAction exactly as the recursive path did.
function tryDecode (buf, initialOffset, context, depth) {
  if (buf.length <= initialOffset) return 0

  const bufLength = buf.length
  const maxDepth = context.maxDepth
  const maxArrayLength = context.options.maxArrayLength
  const maxMapLength = context.options.maxMapLength
  const preferMap = context.options.preferMap
  const protoAction = context.options.protoAction

  let offset = initialOffset
  let stack = null
  let value

  while (true) {
    if (offset >= bufLength) return 0

    const first = buf.readUInt8(offset)

    if (first < 0x80) { // positive fixint
      value = first
      offset += 1
    } else if ((first & 0xe0) === 0xa0) { // fixstr up to 31 bytes
      const length = first & 0x1f
      if (offset + 1 + length > bufLength) return 0
      value = context.fast
        ? buf.utf8Slice(offset + 1, offset + 1 + length)
        : buf.toString('utf8', offset + 1, offset + 1 + length)
      offset += 1 + length
    } else if (first === 0xc0) { value = null; offset += 1 } else if (first === 0xc2) { value = false; offset += 1 } else if (first === 0xc3) { value = true; offset += 1 } else if (first === 0xc1) { throw new Error('0xc1 is a reserved MessagePack byte') } else if ((first & 0xf0) === 0x80) { // fixmap
      const length = first & 0x0f
      if (depth + (stack === null ? 0 : stack.length) + 1 > maxDepth) throw new Error('Maximum decode depth exceeded')
      checkCollectionLength('map', length, maxMapLength)
      offset += 1
      const expected = 2 * length
      if (expected > 0) {
        if (stack === null) stack = []
        if (preferMap) {
          stack.push({ isMap: true, preferMap: true, index: 0, expected, mapping: new Map(), pendingKey: null })
        } else {
          stack.push({ isMap: true, preferMap: false, index: 0, expected, object: {}, map: null, protoValues: null, protoAction, pendingKey: null })
        }
        continue
      }
      value = buildMap([], 0, context)
    } else if ((first & 0xf0) === 0x90) { // fixarray
      const length = first & 0x0f
      if (depth + (stack === null ? 0 : stack.length) + 1 > maxDepth) throw new Error('Maximum decode depth exceeded')
      checkCollectionLength('array', length, maxArrayLength)
      offset += 1
      if (length > 0) {
        if (stack === null) stack = []
        stack.push({ isMap: false, expected: length, result: [] })
        continue
      }
      value = []
    } else {
      const size = SIZES[first]
      if (size === undefined) {
        if (first >= 0xe0) {
          value = first - 0x100 // 5 bits negative ints
          offset += 1
        } else {
          throw new Error('not implemented yet')
        }
      } else if (bufLength < offset + size) {
        return 0
      } else if (first >= 0xc4 && first <= 0xc6) { // bin8/16/32
        const length = readUIntBE(buf, offset + 1, size - 1)
        const payload = offset + size
        if (payload + length > bufLength) return 0
        value = buf.slice(payload, payload + length)
        offset = payload + length
      } else if (first >= 0xc7 && first <= 0xc9) { // ext8/16/32
        const length = readUIntBE(buf, offset + 1, size - 2)
        const type = buf.readInt8(offset + size - 1)
        const payload = offset + size
        if (payload + length > bufLength) return 0
        value = decodeExt(buf, payload, type, length, context)
        offset = payload + length
      } else if (first >= 0xca && first <= 0xcb) { // float32/64
        value = decodeFloat(buf, offset + 1, size - 1)
        offset += size
      } else if (first >= 0xcc && first <= 0xcf) { // uint8/16/32/64
        value = decodeUnsignedInt(buf, offset + 1, size - 1)
        offset += size
      } else if (first >= 0xd0 && first <= 0xd3) { // int8/16/32/64
        value = decodeSigned(buf, offset + 1, size - 1)
        offset += size
      } else if (first >= 0xd4 && first <= 0xd8) { // fixext1/2/4/8/16
        const type = buf.readInt8(offset + 1)
        value = decodeExt(buf, offset + 2, type, size - 2, context)
        offset += size
      } else if (first >= 0xd9 && first <= 0xdb) { // str8/16/32
        const length = readUIntBE(buf, offset + 1, size - 1)
        const payload = offset + size
        if (payload + length > bufLength) return 0
        value = context.fast
          ? buf.utf8Slice(payload, payload + length)
          : buf.toString('utf8', payload, payload + length)
        offset = payload + length
      } else if (first >= 0xdc && first <= 0xdd) { // array16/32
        const length = readUIntBE(buf, offset + 1, size - 1)
        if (depth + (stack === null ? 0 : stack.length) + 1 > maxDepth) throw new Error('Maximum decode depth exceeded')
        checkCollectionLength('array', length, maxArrayLength)
        offset += size
        if (length > 0) {
          if (stack === null) stack = []
          stack.push({ isMap: false, expected: length, result: [] })
          continue
        }
        value = []
      } else if (first >= 0xde && first <= 0xdf) { // map16/32
        const length = readUIntBE(buf, offset + 1, size - 1)
        if (depth + (stack === null ? 0 : stack.length) + 1 > maxDepth) throw new Error('Maximum decode depth exceeded')
        checkCollectionLength('map', length, maxMapLength)
        offset += size
        const expected = 2 * length
        if (expected > 0) {
          if (stack === null) stack = []
          if (preferMap) {
            stack.push({ isMap: true, preferMap: true, index: 0, expected, mapping: new Map(), pendingKey: null })
          } else {
            stack.push({ isMap: true, preferMap: false, index: 0, expected, object: {}, map: null, protoValues: null, protoAction, pendingKey: null })
          }
          continue
        }
        value = buildMap([], 0, context)
      } else {
        throw new Error('not implemented yet')
      }
    }

    // A value was produced (scalar or empty collection). Feed it into the stack
    // of open collections, closing any frame that is now full and re-feeding its
    // resulting collection to its parent.
    if (stack !== null) {
      while (stack.length > 0) {
        const frame = stack[stack.length - 1]
        if (frame.isMap) {
          // Direct-build: string keys go onto the plain object (deferring
          // __proto__), and the first non-string key converts the result to a Map.
          if ((frame.index & 1) === 0) {
            if (!frame.preferMap && frame.map === null && typeof value !== 'string') {
              frame.map = new Map()
              const keys = Object.keys(frame.object)
              for (let j = 0; j < keys.length; j++) frame.map.set(keys[j], frame.object[keys[j]])
              if (frame.protoValues !== null) {
                for (let j = 0; j < frame.protoValues.length; j++) frame.map.set(PROTO, frame.protoValues[j])
                frame.protoValues = null
              }
            }
            frame.pendingKey = value
          } else if (frame.preferMap) {
            frame.mapping.set(frame.pendingKey, value)
          } else if (frame.map !== null) {
            frame.map.set(frame.pendingKey, value)
          } else if (typeof frame.pendingKey === 'string') {
            if (frame.pendingKey === PROTO) {
              if (frame.protoValues === null) frame.protoValues = []
              frame.protoValues.push(value)
            } else {
              frame.object[frame.pendingKey] = value
            }
          }
          frame.index += 1
          if (frame.index < frame.expected) break
          stack.pop()
          if (frame.preferMap) {
            value = frame.mapping
          } else if (frame.map !== null) {
            value = frame.map
          } else {
            if (frame.protoValues !== null) {
              for (let i = 0; i < frame.protoValues.length; i++) {
                if (frame.protoAction === 'error') throw new SyntaxError('Object contains forbidden prototype property')
                if (frame.protoAction === 'remove') continue
                frame.object[PROTO] = frame.protoValues[i]
              }
            }
            value = frame.object
          }
        } else {
          frame.result.push(value)
          if (frame.result.length < frame.expected) break
          stack.pop()
          value = frame.result
        }
      }
    }

    if (stack === null || stack.length === 0) {
      context.value = value
      return offset - initialOffset
    }
  }
}

function decodeSigned (buf, offset, size) {
  if (size === 1) return buf.readInt8(offset)
  if (size === 2) return buf.readInt16BE(offset)
  if (size === 4) return buf.readInt32BE(offset)
  if (size === 8) return readInt64BE(buf, offset)
}

function decodeExt (buf, offset, type, size, context) {
  const toDecode = buf.slice(offset, offset + size)

  const decode = context.decodingTypes.get(type)
  if (!decode) throw new Error('unable to find ext type ' + type)

  return decode(toDecode)
}

function decodeUnsignedInt (buf, offset, size) {
  const maxOffset = offset + size
  let result = 0
  while (offset < maxOffset) { result += buf.readUInt8(offset++) * Math.pow(256, maxOffset - offset) }
  return result
}

function decodeFloat (buf, offset, size) {
  if (size === 4) return buf.readFloatBE(offset)
  if (size === 8) return buf.readDoubleBE(offset)
}

function readInt64BE (buf, offset) {
  const negate = (buf.readUInt8(offset) & 0x80) === 0x80
  let hi = buf.readUInt32BE(offset + 0)
  let lo = buf.readUInt32BE(offset + 4)

  if (negate) {
    lo = (~lo + 1) >>> 0
    hi = (~hi + (lo === 0 ? 1 : 0)) >>> 0
  }

  return (hi * 4294967296 + lo) * (negate ? -1 : +1)
}

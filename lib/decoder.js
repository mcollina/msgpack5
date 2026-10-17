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

function isValidDataSize (dataLength, bufLength, headerLength) {
  return bufLength >= headerLength + dataLength
}

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
        ? buildMap([], 0, context, true)
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

function decodeArray (buf, initialOffset, length, headerLength, context, depth) {
  if (depth > context.maxDepth) {
    throw new Error('Maximum decode depth exceeded')
  }
  checkCollectionLength('array', length, context.options.maxArrayLength)

  const arr = new Array(length)
  let offset = initialOffset
  for (let i = 0; i < length; i++) {
    const consumed = tryDecode(buf, offset, context, depth)
    if (!consumed) return 0
    arr[i] = context.value
    offset += consumed
  }

  context.value = arr
  return headerLength + offset - initialOffset
}

function decodeMap (buf, initialOffset, length, headerLength, context, depth) {
  if (depth > context.maxDepth) {
    throw new Error('Maximum decode depth exceeded')
  }
  checkCollectionLength('map', length, context.options.maxMapLength)

  const itemCount = 2 * length
  let offset = initialOffset

  if (context.options.preferMap) {
    const mapping = new Map()
    for (let i = 0; i < itemCount; i += 2) {
      const keyConsumed = tryDecode(buf, offset, context, depth)
      if (!keyConsumed) return 0
      const key = context.value
      const valueConsumed = tryDecode(buf, offset + keyConsumed, context, depth)
      if (!valueConsumed) return 0
      mapping.set(key, context.value)
      offset += keyConsumed + valueConsumed
    }
    context.value = mapping
  } else {
    // Non-preferMap: build the result directly instead of staging every key
    // and value in a `pairs` array and re-reading them in buildMap. A plain
    // object is produced when every key is a string; as soon as a non-string
    // key is seen the whole map becomes a Map, carrying over the string keys
    // (kept in insertion order). protoAction is applied only to the
    // plain-object result, and only at the end, so a later non-string key
    // (which forces a Map) does not spuriously trigger it.
    const protoAction = context.options.protoAction
    const PROTO = '__proto__'
    const object = {}
    let map = null
    let protoValues = null

    for (let i = 0; i < itemCount; i += 2) {
      const keyConsumed = tryDecode(buf, offset, context, depth)
      if (!keyConsumed) return 0
      const key = context.value
      const valueConsumed = tryDecode(buf, offset + keyConsumed, context, depth)
      if (!valueConsumed) return 0
      const val = context.value
      offset += keyConsumed + valueConsumed

      if (typeof key === 'string') {
        if (map) {
          map.set(key, val)
        } else if (key === PROTO) {
          // Defer so protoAction applies only if this stays a plain object.
          if (protoValues === null) protoValues = []
          protoValues.push(val)
        } else {
          object[key] = val
        }
      } else {
        // Non-string key: the result must be a Map. Carry over the string
        // keys built so far, in order, plus any deferred __proto__ values.
        if (map === null) {
          map = new Map()
          const keys = Object.keys(object)
          for (let j = 0; j < keys.length; j++) {
            map.set(keys[j], object[keys[j]])
          }
          if (protoValues !== null) {
            for (let j = 0; j < protoValues.length; j++) {
              map.set(PROTO, protoValues[j])
            }
          }
        }
        map.set(key, val)
      }
    }

    if (map !== null) {
      context.value = map
    } else {
      if (protoValues !== null) {
        for (let i = 0; i < protoValues.length; i++) {
          if (protoAction === 'error') {
            throw new SyntaxError('Object contains forbidden prototype property')
          }
          if (protoAction === 'remove') continue
          object[PROTO] = protoValues[i]
        }
      }
      context.value = object
    }
  }

  return headerLength + offset - initialOffset
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

      if (key === '__proto__') {
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

function tryDecode (buf, initialOffset, context, depth) {
  if (buf.length <= initialOffset) return 0

  const bufLength = buf.length - initialOffset
  let offset = initialOffset

  const first = buf.readUInt8(offset)
  offset += 1

  if (first < 0x80) { context.value = first; return 1 } // 7-bits positive ints
  if ((first & 0xf0) === 0x80) {
    const length = first & 0x0f
    const headerSize = offset - initialOffset
    // we have a map with less than 15 elements
    return decodeMap(buf, offset, length, headerSize, context, depth + 1)
  }
  if ((first & 0xf0) === 0x90) {
    const length = first & 0x0f
    const headerSize = offset - initialOffset
    // we have an array with less than 15 elements
    return decodeArray(buf, offset, length, headerSize, context, depth + 1)
  }

  if ((first & 0xe0) === 0xa0) {
    // fixstr up to 31 bytes
    const length = first & 0x1f
    if (!isValidDataSize(length, bufLength, 1)) return 0
    context.value = context.fast
      ? buf.utf8Slice(offset, offset + length)
      : buf.toString('utf8', offset, offset + length)
    return length + 1
  }
  if (first === 0xc1) throw new Error('0xc1 is a reserved MessagePack byte')
  if (first >= 0xc0 && first <= 0xc3) return decodeConstants(first, context)

  const size = SIZES[first]
  if (size === undefined) {
    if (first >= 0xe0) { context.value = first - 0x100; return 1 } // 5 bits negative ints
    throw new Error('not implemented yet')
  }
  if (bufLength < size) return 0

  if (first >= 0xc4 && first <= 0xc6) {
    const length = readUIntBE(buf, offset, size - 1)
    offset += size - 1

    if (!isValidDataSize(length, bufLength, size)) return 0
    context.value = buf.slice(offset, offset + length)
    return size + length
  }
  if (first >= 0xc7 && first <= 0xc9) {
    const length = readUIntBE(buf, offset, size - 2)
    offset += size - 2

    const type = buf.readInt8(offset)
    offset += 1

    if (!isValidDataSize(length, bufLength, size)) return 0
    return decodeExt(buf, offset, type, length, size, context)
  }
  if (first >= 0xca && first <= 0xcb) return decodeFloat(buf, offset, size - 1, context)
  if (first >= 0xcc && first <= 0xcf) return decodeUnsignedInt(buf, offset, size - 1, context)
  if (first >= 0xd0 && first <= 0xd3) return decodeSigned(buf, offset, size - 1, context)
  if (first >= 0xd4 && first <= 0xd8) {
    const type = buf.readInt8(offset) // Signed
    offset += 1
    return decodeExt(buf, offset, type, size - 2, 2, context)
  }

  if (first >= 0xd9 && first <= 0xdb) {
    const length = readUIntBE(buf, offset, size - 1)
    offset += size - 1

    if (!isValidDataSize(length, bufLength, size)) return 0
    context.value = context.fast
      ? buf.utf8Slice(offset, offset + length)
      : buf.toString('utf8', offset, offset + length)
    return size + length
  }
  if (first >= 0xdc && first <= 0xdd) {
    const length = readUIntBE(buf, offset, size - 1)
    offset += size - 1
    return decodeArray(buf, offset, length, size, context, depth + 1)
  }
  if (first >= 0xde && first <= 0xdf) {
    let length
    switch (first) {
      case 0xde:
        // maps up to 2^16 elements - 2 bytes
        length = buf.readUInt16BE(offset)
        offset += 2
        return decodeMap(buf, offset, length, 3, context, depth + 1)

      case 0xdf:
        length = buf.readUInt32BE(offset)
        offset += 4
        return decodeMap(buf, offset, length, 5, context, depth + 1)
    }
  }

  throw new Error('not implemented yet')
}

function decodeSigned (buf, offset, size, context) {
  let result
  if (size === 1) result = buf.readInt8(offset)
  if (size === 2) result = buf.readInt16BE(offset)
  if (size === 4) result = buf.readInt32BE(offset)
  if (size === 8) result = readInt64BE(buf, offset)
  context.value = result
  return size + 1
}

function decodeExt (buf, offset, type, size, headerSize, context) {
  const toDecode = buf.slice(offset, offset + size)

  const decode = context.decodingTypes.get(type)
  if (!decode) throw new Error('unable to find ext type ' + type)

  context.value = decode(toDecode)
  return headerSize + size
}

function decodeUnsignedInt (buf, offset, size, context) {
  const maxOffset = offset + size
  let result = 0
  while (offset < maxOffset) { result += buf.readUInt8(offset++) * Math.pow(256, maxOffset - offset) }
  context.value = result
  return size + 1
}

function decodeConstants (first, context) {
  if (first === 0xc0) { context.value = null; return 1 }
  if (first === 0xc2) { context.value = false; return 1 }
  if (first === 0xc3) { context.value = true; return 1 }
}

function decodeFloat (buf, offset, size, context) {
  let result
  if (size === 4) result = buf.readFloatBE(offset)
  if (size === 8) result = buf.readDoubleBE(offset)
  context.value = result
  return size + 1
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

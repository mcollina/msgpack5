'use strict'

const bl = require('bl')
const IncompleteBufferError = require('./helpers.js').IncompleteBufferError

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

module.exports = function buildDecode (decodingTypes, options) {
  const maxDepth = options.maxDepth === undefined ? 100 : options.maxDepth
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new TypeError('maxDepth must be a non-negative integer')
  }

  const context = { decodingTypes, options, maxDepth, decode }
  return decode

  function decode (buf, decodeState) {
    if (!bl.isBufferList(buf)) {
      buf = bl(buf)
    }

    let result
    try {
      result = decodeState
        ? tryDecodeIncremental(buf, decodeState, context)
        : tryDecode(buf, 0, context, 0)
    } catch (err) {
      if (decodeState) decodeState.stack.length = 0
      throw err
    }

    // Handle worst case ASAP and keep code flat
    if (!result) throw new IncompleteBufferError()

    if (!decodeState) buf.consume(result[1])
    return result[0]
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
      const result = tryDecode(buf, 0, context, state.stack.length)
      if (!result) return null

      buf.consume(result[1])
      value = result[0]
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
    length: buf.readUIntBE(1, headerLength - 1),
    headerLength
  }
}

function decodeItems (buf, initialOffset, length, headerLength, context, depth) {
  let offset = initialOffset
  const result = []
  let i = 0

  while (i++ < length) {
    const decodeResult = tryDecode(buf, offset, context, depth)
    if (!decodeResult) return null

    result.push(decodeResult[0])
    offset += decodeResult[1]
  }
  return [result, headerLength + offset - initialOffset]
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
  return decodeItems(buf, initialOffset, length, headerLength, context, depth)
}

function decodeMap (buf, offset, length, headerLength, context, depth) {
  if (depth > context.maxDepth) {
    throw new Error('Maximum decode depth exceeded')
  }
  checkCollectionLength('map', length, context.options.maxMapLength)
  const _temp = decodeItems(buf, offset, 2 * length, headerLength, context, depth)
  if (!_temp) return null
  const [result, consumedBytes] = _temp
  return [buildMap(result, length, context), consumedBytes]
}

function buildMap (result, length, context) {
  let isPlainObject = !context.options.preferMap

  if (isPlainObject) {
    for (let i = 0; i < 2 * length; i += 2) {
      if (typeof result[i] !== 'string') {
        isPlainObject = false
        break
      }
    }
  }

  if (isPlainObject) {
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
      const key = result[i]
      const val = result[i + 1]
      mapping.set(key, val)
    }
    return mapping
  }
}

function tryDecode (buf, initialOffset, context, depth) {
  if (buf.length <= initialOffset) return null

  const bufLength = buf.length - initialOffset
  let offset = initialOffset

  const first = buf.readUInt8(offset)
  offset += 1

  const size = SIZES[first] || -1
  if (bufLength < size) return null

  if (first < 0x80) return [first, 1] // 7-bits positive ints
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
    if (!isValidDataSize(length, bufLength, 1)) return null
    const result = buf.toString('utf8', offset, offset + length)
    return [result, length + 1]
  }
  if (first === 0xc1) throw new Error('0xc1 is a reserved MessagePack byte')
  if (first >= 0xc0 && first <= 0xc3) return decodeConstants(first)
  if (first >= 0xc4 && first <= 0xc6) {
    const length = buf.readUIntBE(offset, size - 1)
    offset += size - 1

    if (!isValidDataSize(length, bufLength, size)) return null
    const result = buf.slice(offset, offset + length)
    return [result, size + length]
  }
  if (first >= 0xc7 && first <= 0xc9) {
    const length = buf.readUIntBE(offset, size - 2)
    offset += size - 2

    const type = buf.readInt8(offset)
    offset += 1

    if (!isValidDataSize(length, bufLength, size)) return null
    return decodeExt(buf, offset, type, length, size, context)
  }
  if (first >= 0xca && first <= 0xcb) return decodeFloat(buf, offset, size - 1)
  if (first >= 0xcc && first <= 0xcf) return decodeUnsignedInt(buf, offset, size - 1)
  if (first >= 0xd0 && first <= 0xd3) return decodeSigned(buf, offset, size - 1)
  if (first >= 0xd4 && first <= 0xd8) {
    const type = buf.readInt8(offset) // Signed
    offset += 1
    return decodeExt(buf, offset, type, size - 2, 2, context)
  }

  if (first >= 0xd9 && first <= 0xdb) {
    const length = buf.readUIntBE(offset, size - 1)
    offset += size - 1

    if (!isValidDataSize(length, bufLength, size)) return null
    const result = buf.toString('utf8', offset, offset + length)
    return [result, size + length]
  }
  if (first >= 0xdc && first <= 0xdd) {
    const length = buf.readUIntBE(offset, size - 1)
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
        // console.log(offset - initialOffset)
        return decodeMap(buf, offset, length, 3, context, depth + 1)

      case 0xdf:
        length = buf.readUInt32BE(offset)
        offset += 4
        return decodeMap(buf, offset, length, 5, context, depth + 1)
    }
  }
  if (first >= 0xe0) return [first - 0x100, 1] // 5 bits negative ints

  throw new Error('not implemented yet')
}

function decodeSigned (buf, offset, size) {
  let result
  if (size === 1) result = buf.readInt8(offset)
  if (size === 2) result = buf.readInt16BE(offset)
  if (size === 4) result = buf.readInt32BE(offset)
  if (size === 8) result = readInt64BE(buf.slice(offset, offset + 8), 0)
  return [result, size + 1]
}

function decodeExt (buf, offset, type, size, headerSize, context) {
  const toDecode = buf.slice(offset, offset + size)

  const decode = context.decodingTypes.get(type)
  if (!decode) throw new Error('unable to find ext type ' + type)

  const value = decode(toDecode)
  return [value, headerSize + size]
}

function decodeUnsignedInt (buf, offset, size) {
  const maxOffset = offset + size
  let result = 0
  while (offset < maxOffset) { result += buf.readUInt8(offset++) * Math.pow(256, maxOffset - offset) }
  return [result, size + 1]
}

function decodeConstants (first) {
  if (first === 0xc0) return [null, 1]
  if (first === 0xc2) return [false, 1]
  if (first === 0xc3) return [true, 1]
}

function decodeFloat (buf, offset, size) {
  let result
  if (size === 4) result = buf.readFloatBE(offset)
  if (size === 8) result = buf.readDoubleBE(offset)
  return [result, size + 1]
}

function readInt64BE (buf, offset) {
  var negate = (buf[offset] & 0x80) == 0x80; // eslint-disable-line

  if (negate) {
    let carry = 1
    for (let i = offset + 7; i >= offset; i--) {
      const v = (buf[i] ^ 0xff) + carry
      buf[i] = v & 0xff
      carry = v >> 8
    }
  }

  const hi = buf.readUInt32BE(offset + 0)
  const lo = buf.readUInt32BE(offset + 4)
  return (hi * 4294967296 + lo) * (negate ? -1 : +1)
}

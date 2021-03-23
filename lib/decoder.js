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
  0xde: 3,
  0xdc: 3,
  0xdd: 5
}

function isValidDataSize (dataLength, bufLength, headerLength) {
  return bufLength >= headerLength + dataLength
}

module.exports = function buildDecode (decodingTypes, options) {
  const context = { decodingTypes, options, decode }
  return decode

  function decode (buf) {
    // TODO: Make it into ensureBl handler ?
    if (!(buf instanceof bl)) {
      buf = bl().append(buf)
    }

    const result = tryDecode(buf, 0, context)
    // Handle worst case ASAP and keep code flat
    if (!result) throw new IncompleteBufferError()

    buf.consume(result[1])
    return result[0]
  }
}

function decodeArray (buf, initialOffset, length, headerLength, context) {
  let offset = initialOffset
  const result = []
  let i = 0

  while (i++ < length) {
    const decodeResult = tryDecode(buf, offset, context)
    if (!decodeResult) return null

    result.push(decodeResult[0])
    offset += decodeResult[1]
  }
  return [result, headerLength + offset - initialOffset]
}

function decodeMap (buf, offset, length, headerLength, context) {
  const _temp = decodeArray(buf, offset, 2 * length, headerLength, context)
  if (!_temp) return null
  const [result, consumedBytes] = _temp

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
    return [object, consumedBytes]
  } else {
    const mapping = new Map()
    for (let i = 0; i < 2 * length; i += 2) {
      const key = result[i]
      const val = result[i + 1]
      mapping.set(key, val)
    }
    return [mapping, consumedBytes]
  }
}

function tryDecode (buf, initialOffset, context) {
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
    return decodeMap(buf, offset, length, headerSize, context)
  }
  if ((first & 0xf0) === 0x90) {
    const length = first & 0x0f
    const headerSize = offset - initialOffset
    // we have an array with less than 15 elements
    return decodeArray(buf, offset, length, headerSize, context)
  }

  if ((first & 0xe0) === 0xa0) {
    // fixstr up to 31 bytes
    const length = first & 0x1f
    if (!isValidDataSize(length, bufLength, 1)) return null
    const result = buf.toString('utf8', offset, offset + length)
    return [result, length + 1]
  }
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
    return decodeArray(buf, offset, length, size, context)
  }
  if (first >= 0xde && first <= 0xdf) {
    let length
    switch (first) {
      case 0xde:
        // maps up to 2^16 elements - 2 bytes
        length = buf.readUInt16BE(offset)
        offset += 2
        // console.log(offset - initialOffset)
        return decodeMap(buf, offset, length, 3, context)

      case 0xdf:
        length = buf.readUInt32BE(offset)
        offset += 4
        return decodeMap(buf, offset, length, 5, context)
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

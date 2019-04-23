'use strict'

var bl = require('bl')
var { IncompleteBufferError } = require('./helpers.js')
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
  0xde: 3
}

function buildDecodeResult (value, bytesConsumed) {
  return { value, bytesConsumed }
}

module.exports = function buildDecode (decodingTypes) {
  return decode

  function getSize (first) {
    return SIZES[first] || -1
  }

  function isValidDataSize (dataLength, bufLength, headerLength) {
    return bufLength >= headerLength + dataLength
  }

  function decode (buf) {
    // TODO: Make it into ensureBl handler ?
    if (!(buf instanceof bl)) {
      buf = bl().append(buf)
    }

    var result = tryDecode(buf)
    // Handle worst case ASAP and keep code flat
    if (!result) throw new IncompleteBufferError()

    buf.consume(result.bytesConsumed)
    return result.value
  }

  function decodeUnsignedInt (buf, initialOffset, size) {
    var result = 0
    var offset = initialOffset + 1
    // Here 1 is length of fist char

    for (var bytePos = 0; bytePos < size; bytePos++) {
      result += buf.readUInt8(offset++) * Math.pow(256, (size - 1 - bytePos))
    }

    return buildDecodeResult(result, size + 1)
  }

  function tryDecode (buf, initialOffset = 0) {
    const bufLength = buf.length - initialOffset
    if (bufLength <= 0) return null

    var offset = initialOffset
    const first = buf.readUInt8(offset++)

    var length
    var result = 0
    var type

    const size = getSize(first)
    if (bufLength < size) return null

    if (first === 0xc0) return buildDecodeResult(null, 1)
    if (first === 0xc2) return buildDecodeResult(false, 1)
    if (first === 0xc3) return buildDecodeResult(true, 1)

    const inRange = (start, end) => (first >= start) && (first <= end)

    if (inRange(0xd4, 0xd8)) return decodeFixExt(buf, initialOffset, size - 2)
    if (inRange(0xcc, 0xcf)) return decodeUnsignedInt(buf, initialOffset, size - 1, first)

    switch (first) {
      case 0xd0:
        // 1-byte signed int
        result = buf.readInt8(initialOffset + 1)
        return buildDecodeResult(result, 2)
      case 0xd1:
        // 2-bytes signed int
        result = buf.readInt16BE(initialOffset + 1)
        return buildDecodeResult(result, 3)
      case 0xd2:
        // 4-bytes signed int
        result = buf.readInt32BE(initialOffset + 1)
        return buildDecodeResult(result, 5)
      case 0xd3:
        result = readInt64BE(buf.slice(initialOffset + 1, initialOffset + 9), 0)
        return buildDecodeResult(result, 9)

      case 0xca:
        // 4-bytes float
        result = buf.readFloatBE(initialOffset + 1)
        return buildDecodeResult(result, 5)
      case 0xcb:
        // 8-bytes double
        result = buf.readDoubleBE(initialOffset + 1)
        return buildDecodeResult(result, 9)

      case 0xd9:
        // strings up to 2^8 - 1 bytes
        length = buf.readUInt8(initialOffset + 1)
        if (!isValidDataSize(length, bufLength, 2)) {
          return null
        }
        result = buf.toString('utf8', initialOffset + 2, initialOffset + 2 + length)
        return buildDecodeResult(result, 2 + length)
      case 0xda:
        // strings up to 2^16 - 2 bytes
        length = buf.readUInt16BE(initialOffset + 1)
        if (!isValidDataSize(length, bufLength, 3)) {
          return null
        }
        result = buf.toString('utf8', initialOffset + 3, initialOffset + 3 + length)
        return buildDecodeResult(result, 3 + length)
      case 0xdb:
        // strings up to 2^32 - 4 bytes
        length = buf.readUInt32BE(initialOffset + 1)
        if (!isValidDataSize(length, bufLength, 5)) {
          return null
        }
        result = buf.toString('utf8', initialOffset + 5, initialOffset + 5 + length)
        return buildDecodeResult(result, 5 + length)
      case 0xc4:
        // buffers up to 2^8 - 1 bytes
        length = buf.readUInt8(initialOffset + 1)
        if (!isValidDataSize(length, bufLength, 2)) {
          return null
        }
        result = buf.slice(initialOffset + 2, initialOffset + 2 + length)
        return buildDecodeResult(result, 2 + length)
      case 0xc5:
        // buffers up to 2^16 - 1 bytes
        length = buf.readUInt16BE(initialOffset + 1)
        if (!isValidDataSize(length, bufLength, 3)) {
          return null
        }
        result = buf.slice(initialOffset + 3, initialOffset + 3 + length)
        return buildDecodeResult(result, 3 + length)
      case 0xc6:
        // buffers up to 2^32 - 1 bytes
        length = buf.readUInt32BE(initialOffset + 1)
        if (!isValidDataSize(length, bufLength, 5)) {
          return null
        }
        result = buf.slice(initialOffset + 5, initialOffset + 5 + length)
        return buildDecodeResult(result, 5 + length)
      case 0xdc:
        // array up to 2^16 elements - 2 bytes
        if (bufLength < 3) {
          return null
        }

        length = buf.readUInt16BE(initialOffset + 1)
        return decodeArray(buf, initialOffset, length, 3)
      case 0xdd:
        // array up to 2^32 elements - 4 bytes
        if (bufLength < 5) {
          return null
        }

        length = buf.readUInt32BE(initialOffset + 1)
        return decodeArray(buf, initialOffset, length, 5)
      case 0xde:
        // maps up to 2^16 elements - 2 bytes
        length = buf.readUInt16BE(initialOffset + 1)
        return decodeMap(buf, initialOffset, length, 3)
      case 0xdf:
        length = buf.readUInt32BE(initialOffset + 1)
        return decodeMap(buf, initialOffset, length, 5)

      case 0xc7:
        // ext up to 2^8 - 1 bytes
        length = buf.readUInt8(initialOffset + 1)
        type = buf.readUInt8(initialOffset + 2)
        if (!isValidDataSize(length, bufLength, 3)) {
          return null
        }
        return decodeExt(buf, initialOffset, type, length, 3)
      case 0xc8:
        // ext up to 2^16 - 1 bytes
        length = buf.readUInt16BE(initialOffset + 1)
        type = buf.readUInt8(initialOffset + 3)
        if (!isValidDataSize(length, bufLength, 4)) {
          return null
        }
        return decodeExt(buf, initialOffset, type, length, 4)
      case 0xc9:
        // ext up to 2^32 - 1 bytes
        length = buf.readUInt32BE(initialOffset + 1)
        type = buf.readUInt8(initialOffset + 5)
        if (!isValidDataSize(length, bufLength, 6)) {
          return null
        }
        return decodeExt(buf, initialOffset, type, length, 6)
    }

    if ((first & 0xf0) === 0x90) {
      // we have an array with less than 15 elements
      length = first & 0x0f
      return decodeArray(buf, initialOffset, length, 1)
    } else if ((first & 0xf0) === 0x80) {
      // we have a map with less than 15 elements
      length = first & 0x0f
      return decodeMap(buf, initialOffset, length, 1)
    } else if ((first & 0xe0) === 0xa0) {
      // fixstr up to 31 bytes
      length = first & 0x1f
      if (!isValidDataSize(length, bufLength, 1)) return null

      result = buf.toString('utf8', initialOffset + 1, initialOffset + length + 1)
      return buildDecodeResult(result, length + 1)
    } else if (first >= 0xe0) {
      // 5 bits negative ints
      result = first - 0x100
      return buildDecodeResult(result, 1)
    } else if (first < 0x80) {
      // 7-bits positive ints
      return buildDecodeResult(first, 1)
    } else {
      throw new Error('not implemented yet')
    }
  }

  function readInt64BE (buf, offset) {
    var negate = (buf[offset] & 0x80) == 0x80 // eslint-disable-line

    if (negate) {
      var carry = 1
      for (var i = offset + 7; i >= offset; i--) {
        var v = (buf[i] ^ 0xff) + carry
        buf[i] = v & 0xff
        carry = v >> 8
      }
    }

    var hi = buf.readUInt32BE(offset + 0)
    var lo = buf.readUInt32BE(offset + 4)
    return (hi * 4294967296 + lo) * (negate ? -1 : +1)
  }

  function decodeArray (buf, offset, length, headerLength) {
    var result = []
    var i = 0
    var totalBytesConsumed = 0

    offset += headerLength
    while (i++ < length) {
      var decodeResult = tryDecode(buf, offset)
      if (!decodeResult) return null

      result.push(decodeResult.value)
      offset += decodeResult.bytesConsumed
      totalBytesConsumed += decodeResult.bytesConsumed
    }
    return buildDecodeResult(result, headerLength + totalBytesConsumed)
  }

  function decodeMap (buf, initialOffset, length, headerLength) {
    var offset = initialOffset + headerLength
    var result = {}
    var i = 0

    while (i++ < length) {
      var keyResult = tryDecode(buf, offset)
      if (!keyResult) return null
      offset += keyResult.bytesConsumed

      var valueResult = tryDecode(buf, offset)
      if (!valueResult) return null
      offset += valueResult.bytesConsumed

      result[keyResult.value] = valueResult.value
    }

    return buildDecodeResult(result, offset - initialOffset)
  }

  function decodeFixExt (buf, offset, size) {
    var type = buf.readInt8(offset + 1) // Signed
    return decodeExt(buf, offset, type, size, 2)
  }

  function decodeTimestamp (buf, size, headerSize) {
    var seconds
    var nanoseconds = 0

    switch (size) {
      case 4:
        // timestamp 32 stores the number of seconds that have elapsed since 1970-01-01 00:00:00 UTC in an 32-bit unsigned integer
        seconds = buf.readUInt32BE(0)
        break

      case 8:
        // Timestamp 64 stores the number of seconds and nanoseconds that have elapsed
        // since 1970-01-01 00:00:00 UTC in 32-bit unsigned integers, split 30/34 bits
        var upper = buf.readUInt32BE(0)
        var lower = buf.readUInt32BE(4)
        nanoseconds = upper / 4
        seconds = ((upper & 0x03) * Math.pow(2, 32)) + lower // If we use bitwise operators, we get truncated to 32bits
        break

      case 12:
        throw new Error('timestamp 96 is not yet implemented')
    }

    var millis = (seconds * 1000) + Math.round(nanoseconds / 1E6)
    return buildDecodeResult(new Date(millis), size + headerSize)
  }

  function decodeExt (buf, initialOffset, type, size, headerSize) {
    const offset = initialOffset + headerSize
    const toDecode = buf.slice(offset, offset + size)

    // Pre-defined
    if (type === -1) return decodeTimestamp(toDecode, size, headerSize)
    // Reserved for future extensions
    if (type < 0) throw new Error('unable to find ext type ' + type)

    const codec = decodingTypes.find(it => it.type === type)
    if (!codec) throw new Error('unable to find ext type ' + type)
    var value = codec.decode(toDecode)

    return buildDecodeResult(value, headerSize + size)
  }
}

module.exports.IncompleteBufferError = IncompleteBufferError

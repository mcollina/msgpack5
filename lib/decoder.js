'use strict'

var bl = require('bl')
var { IncompleteBufferError, decodeTimestamp } = require('./helpers.js')

const SIZES = { 0xc4: 2, 0xc5: 3, 0xc6: 5, 0xc7: 3, 0xc8: 4, 0xc9: 6, 0xca: 5, 0xcb: 9, 0xcc: 2, 0xcd: 3, 0xce: 5, 0xcf: 9, 0xd0: 2, 0xd1: 3, 0xd2: 5, 0xd3: 9, 0xd4: 3, 0xd5: 4, 0xd6: 6, 0xd7: 10, 0xd8: 18, 0xd9: 2, 0xda: 3, 0xdb: 5, 0xde: 3, 0xdc: 3, 0xdd: 5 }

function isValidDataSize (dataLength, bufLength, headerLength) {
  return bufLength >= headerLength + dataLength
}

module.exports = function buildDecode (decodingTypes) {
  return decode

  function decode (buf) {
    // TODO: Make it into ensureBl handler ?
    if (!(buf instanceof bl)) {
      buf = bl().append(buf)
    }

    var result = tryDecode(buf)
    // Handle worst case ASAP and keep code flat
    if (!result) throw new IncompleteBufferError()

    buf.consume(result[1])
    return result[0]
  }

  function tryDecode (buf, initialOffset = 0) {
    if (buf.length <= initialOffset) return null

    const bufLength = buf.length - initialOffset
    var offset = initialOffset

    const first = buf.readUInt8(offset)
    offset += 1

    var result = 0

    const size = SIZES[first] || -1
    if (bufLength < size) return null

    const inRange = (start, end) => first >= start && first <= end

    if (first < 0x80) return [first, 1] // 7-bits positive ints
    // we have an array with less than 15 elements
    if ((first & 0xf0) === 0x80) { return decodeMap(buf, initialOffset, first & 0x0f, 1) }
    // we have a map with less than 15 elements
    if ((first & 0xf0) === 0x90) { return decodeArray(buf, offset, first & 0x0f, 1) }

    if ((first & 0xe0) === 0xa0) {
      // fixstr up to 31 bytes
      const length = first & 0x1f
      if (!isValidDataSize(length, bufLength, 1)) return null
      result = buf.toString('utf8', offset, offset + length)
      return [result, length + 1]
    }
    if (inRange(0xc0, 0xc3)) return decodeConstants(first)
    if (inRange(0xc4, 0xc6)) return decodeBuffers(buf, offset, size - 1)
    if (inRange(0xc7, 0xc9)) return decodeExts(buf, offset, size - 2)
    if (inRange(0xca, 0xcb)) return decodeFloat(buf, offset, size - 1)
    if (inRange(0xcc, 0xcf)) return decodeUnsignedInt(buf, offset, size - 1)
    if (inRange(0xd0, 0xd3)) return decodeSigned(buf, offset, size - 1)
    if (inRange(0xd4, 0xd8)) return decodeFixExts(buf, offset, size - 2)
    if (inRange(0xd9, 0xdb)) return decodeStr(buf, offset, size - 1)
    if (inRange(0xdc, 0xdd)) return decodeArrays(buf, offset, size - 1)
    if (inRange(0xde, 0xdf)) return decodeMaps(buf, offset, size - 1)
    if (first >= 0xe0) return [first - 0x100, 1] // 5 bits negative ints

    function decodeStr (buf, offset, size) {
      const length = buf.readUIntBE(offset, size)
      offset += size

      if (!isValidDataSize(length, bufLength, size + 1)) return null
      result = buf.toString('utf8', offset, offset + length)
      return [result, size + 1 + length]
    }

    function decodeBuffers (buf, offset, size) {
      const length = buf.readUIntBE(offset, size)
      offset += size

      if (!isValidDataSize(length, bufLength, size + 1)) return null
      result = buf.slice(offset, offset + length)
      return [result, size + 1 + length]
    }

    function decodeExts (buf, offset, size) {
      const length = buf.readUIntBE(offset, size)
      offset += size

      const type = buf.readInt8(offset)
      offset += 1

      if (!isValidDataSize(length, bufLength, size + 2)) return null
      return decodeExt(buf, offset, type, length, size + 2)
    }

    function decodeMaps (buf, offset, size) {
      var length
      switch (first) {
        case 0xde:
          // maps up to 2^16 elements - 2 bytes
          length = buf.readUInt16BE(offset)
          offset += 2
          // console.log(offset - initialOffset)
          return decodeMap(buf, initialOffset, length, 3)

        case 0xdf:
          length = buf.readUInt32BE(offset)
          offset += 4
          return decodeMap(buf, initialOffset, length, 5)
      }
    }

    throw new Error('not implemented yet')
  }

  function decodeArrays (buf, offset, size) {
    var length = buf.readUIntBE(offset, size)
    offset += size

    return decodeArray(buf, offset, length, size + 1)
  }

  function decodeArray (buf, initialOffset, length, headerLength) {
    var offset = initialOffset
    var result = []
    var i = 0

    while (i++ < length) {
      var decodeResult = tryDecode(buf, offset)
      if (!decodeResult) return null

      result.push(decodeResult[0])
      offset += decodeResult[1]
    }
    return [result, headerLength + offset - initialOffset]
  }

  function decodeMap (buf, initialOffset, length, headerLength) {
    var offset = initialOffset + headerLength
    var result = {}
    var i = 0

    while (i++ < length) {
      var keyResult = tryDecode(buf, offset)
      if (!keyResult) return null
      offset += keyResult[1]

      var valueResult = tryDecode(buf, offset)
      if (!valueResult) return null
      offset += valueResult[1]

      result[keyResult[0]] = valueResult[0]
    }

    return [result, offset - initialOffset]
  }

  function decodeFixExts (buf, offset, size) {
    var type = buf.readInt8(offset) // Signed
    offset += 1
    return decodeExt(buf, offset, type, size, 2)
  }

  function readInt64BE (buf, offset) {
    var negate = (buf[offset] & 0x80) == 0x80; // eslint-disable-line

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

  function decodeUnsignedInt (buf, offset, size) {
    const maxOffset = offset + size
    var result = 0
    while (offset < maxOffset) { result += buf.readUInt8(offset++) * Math.pow(256, maxOffset - offset) }
    return [result, size + 1]
  }

  function decodeConstants (first) {
    if (first === 0xc0) return [null, 1]
    if (first === 0xc2) return [false, 1]
    if (first === 0xc3) return [true, 1]
  }

  function decodeSigned (buf, offset, size) {
    var result
    if (size === 1) result = buf.readInt8(offset)
    if (size === 2) result = buf.readInt16BE(offset)
    if (size === 4) result = buf.readInt32BE(offset)
    if (size === 8) result = readInt64BE(buf.slice(offset, offset + 8), 0)
    return [result, size + 1]
  }

  function decodeFloat (buf, offset, size) {
    var result
    if (size === 4) result = buf.readFloatBE(offset)
    if (size === 8) result = buf.readDoubleBE(offset)
    return [result, size + 1]
  }

  function decodeExt (buf, offset, type, size, headerSize) {
    const toDecode = buf.slice(offset, offset + size)

    // Pre-defined  (type < 0) Reserved for future extensions
    if (type === -1) return decodeTimestamp(toDecode, size, headerSize)

    const decode = decodingTypes[type]
    if (!decode) throw new Error('unable to find ext type ' + type)

    var value = decode(toDecode)
    return [value, headerSize + size]
  }
}

module.exports.IncompleteBufferError = IncompleteBufferError

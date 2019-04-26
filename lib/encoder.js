'use strict'

var Buffer = require('safe-buffer').Buffer
var bl = require('bl')

module.exports = function buildEncode (encodingTypes, options) {
  if (!options.disableTimestampEncoding) {
    encodingTypes.push(encoderDate)
  }

  function encode (obj) {
    if (obj === undefined) throw new Error('undefined is not encodable in msgpack!')
    if (isNaN(obj)) throw new Error('NaN is not encodable in msgpack!')

    if (obj === null) return Buffer.from([ 0xc0 ])
    if (obj === true) return Buffer.from([ 0xc3 ])
    if (obj === false) return Buffer.from([ 0xc2 ])

    if (typeof obj === 'string') return encodeString(obj, options)

    if (obj && (obj.readUInt32LE || obj instanceof Uint8Array)) {
      if (obj instanceof Uint8Array) {
        obj = Buffer.from(obj)
      }
      // weird hack to support Buffer
      // and Buffer-like objects
      return bl([getBufferHeader(obj.length), obj])
    }
    if (Array.isArray(obj)) return bl().append([ getArrayHeader(obj.length), ...obj.map(encode) ])
    if (typeof obj === 'object') return encodeExt(obj, encodingTypes) || encodeObject(obj, options, encode)
    if (typeof obj === 'number') return encodeNumber(obj, options)

    throw new Error('not implemented yet')
  }

  return function (obj) {
    return encode(obj).slice()
  }
}

//
//
// === MENTAL SEPARATOR ===
//
//

function encodeObject (obj, options, encode) {
  var keys = []

  for (let key in obj) {
    if (obj.hasOwnProperty(key) &&
        obj[key] !== undefined &&
        typeof obj[key] !== 'function') {
      keys.push(key)
    }
  }

  const acc = [ getObjectHeader(keys.length) ]

  if (options.sortKeys) keys.sort()

  keys.forEach(key => {
    acc.push(encode(key), encode(obj[key]))
  })

  return bl(acc)
}

function write64BitUint (buf, obj) {
  // Write long byte by byte, in big-endian order
  for (var currByte = 7; currByte >= 0; currByte--) {
    buf[currByte + 1] = (obj & 0xff)
    obj = obj / 256
  }
}

function write64BitInt (buf, offset, num) {
  var negate = num < 0

  if (negate) {
    num = Math.abs(num)
  }

  var lo = num % 4294967296
  var hi = num / 4294967296
  buf.writeUInt32BE(Math.floor(hi), offset + 0)
  buf.writeUInt32BE(lo, offset + 4)

  if (negate) {
    var carry = 1
    for (var i = offset + 7; i >= offset; i--) {
      var v = (buf[i] ^ 0xff) + carry
      buf[i] = v & 0xff
      carry = v >> 8
    }
  }
}

function isFloat (n) {
  return n % 1 !== 0
}

function isNaN (n) {
  /* eslint-disable no-self-compare */
  return n !== n && typeof n === 'number'
  /* eslint-enable no-self-compare */
}

const fround = Math.fround

function encodeFloat (obj, forceFloat64) {
  var buf

  if (forceFloat64 || !fround || fround(obj) !== obj) {
    buf = Buffer.allocUnsafe(9)
    buf[0] = 0xcb
    buf.writeDoubleBE(obj, 1)
  } else {
    buf = Buffer.allocUnsafe(5)
    buf[0] = 0xca
    buf.writeFloatBE(obj, 1)
  }

  return buf
}

const encoderDate = {
  check (obj) {
    return typeof obj.getDate === 'function'
  },
  encode (obj) {
    return encodeDate(obj)
  }
}

function encodeExt (obj, encodingTypes) {
  var encoded

  for (let i = 0; i < encodingTypes.length; i++) {
    if (encodingTypes[i].check(obj)) {
      encoded = encodingTypes[i].encode(obj)
      break
    }
  }

  if (!encoded) return null
  const header = getExtHeader(encoded.length - 1)
  return bl().append(header).append(encoded)
}

function getExtHeader (length) {
  if (length === 1) return Buffer.from([ 0xd4 ])
  if (length === 2) return Buffer.from([ 0xd5 ])
  if (length === 4) return Buffer.from([ 0xd6 ])
  if (length === 8) return Buffer.from([ 0xd7 ])
  if (length === 16) return Buffer.from([ 0xd8 ])
  if (length < 256) return Buffer.from([ 0xc7, length ])
  if (length < 0x10000) return Buffer.from([ 0xc8, length >> 8, length & 0x00ff ])
  return Buffer.from([ 0xc9, length >> 24, (length >> 16) & 0x000000ff, (length >> 8) & 0x000000ff, length & 0x000000ff ])
}

function getArrayHeader (length) {
  var buf
  if (length < 16) {
    buf = Buffer.allocUnsafe(1)
    buf[0] = 0x90 | length
  } else if (length < 65536) {
    buf = Buffer.allocUnsafe(3)
    buf[0] = 0xdc
    buf.writeUInt16BE(length, 1)
  } else {
    buf = Buffer.allocUnsafe(5)
    buf[0] = 0xdd
    buf.writeUInt32BE(length, 1)
  }
  return buf
}

function getObjectHeader (length) {
  var header
  if (length < 16) return Buffer.from([ 0x80 | length ])

  if (length < 0xFFFF) {
    header = Buffer.allocUnsafe(3)
    header[0] = 0xde
    header.writeUInt16BE(length, 1)
    return header
  }

  header = Buffer.allocUnsafe(5)
  header[0] = 0xdf
  header.writeUInt32BE(length, 1)
  return header
}

function encodeString (obj, options) {
  const len = Buffer.byteLength(obj)
  var buf
  if (len < 32) {
    buf = Buffer.allocUnsafe(1 + len)
    buf[0] = 0xa0 | len
    if (len > 0) {
      buf.write(obj, 1)
    }
  } else if (len <= 0xff && !options.compatibilityMode) {
    // str8, but only when not in compatibility mode
    buf = Buffer.allocUnsafe(2 + len)
    buf[0] = 0xd9
    buf[1] = len
    buf.write(obj, 2)
  } else if (len <= 0xffff) {
    buf = Buffer.allocUnsafe(3 + len)
    buf[0] = 0xda
    buf.writeUInt16BE(len, 1)
    buf.write(obj, 3)
  } else {
    buf = Buffer.allocUnsafe(5 + len)
    buf[0] = 0xdb
    buf.writeUInt32BE(len, 1)
    buf.write(obj, 5)
  }
  return buf
}

function getBufferHeader (length) {
  var header
  if (length <= 0xff) {
    header = Buffer.allocUnsafe(2)
    header[0] = 0xc4
    header[1] = length
  } else if (length <= 0xffff) {
    header = Buffer.allocUnsafe(3)
    header[0] = 0xc5
    header.writeUInt16BE(length, 1)
  } else {
    header = Buffer.allocUnsafe(5)
    header[0] = 0xc6
    header.writeUInt32BE(length, 1)
  }

  return header
}

function encodeDate (dt) {
  var millis = dt * 1
  var seconds = Math.floor(millis / 1000)
  var nanos = (millis - (seconds * 1000)) * 1E6

  if (nanos || seconds > 0xFFFFFFFF) {
    // Timestamp64
    const encoded = Buffer.allocUnsafe(9)
    encoded[0] = -1

    var upperNanos = ((nanos * 4))
    var upperSeconds = seconds / Math.pow(2, 32)
    var upper = (upperNanos + upperSeconds) & 0xFFFFFFFF
    var lower = seconds & 0xFFFFFFFF

    encoded.writeInt32BE(upper, 1)
    encoded.writeInt32BE(lower, 5)
    return encoded
  } else {
    // Timestamp32
    const encoded = Buffer.allocUnsafe(5)
    encoded[0] = -1
    encoded.writeUInt32BE(Math.floor(millis / 1000), 1)
    return encoded
  }
}

function encodeNumber (obj, options) {
  var buf
  if (isFloat(obj)) {
    return encodeFloat(obj, options.forceFloat64)
  } else if (obj >= 0) {
    if (obj < 128) {
      buf = Buffer.allocUnsafe(1)
      buf[0] = obj
    } else if (obj < 256) {
      buf = Buffer.allocUnsafe(2)
      buf[0] = 0xcc
      buf[1] = obj
    } else if (obj < 65536) {
      buf = Buffer.allocUnsafe(3)
      buf[0] = 0xcd
      buf.writeUInt16BE(obj, 1)
    } else if (obj <= 0xffffffff) {
      buf = Buffer.allocUnsafe(5)
      buf[0] = 0xce
      buf.writeUInt32BE(obj, 1)
    } else if (obj <= 9007199254740991) {
      buf = Buffer.allocUnsafe(9)
      buf[0] = 0xcf
      write64BitUint(buf, obj)
    } else {
      return encodeFloat(obj, true)
    }
  } else {
    if (obj >= -32) {
      buf = Buffer.allocUnsafe(1)
      buf[0] = 0x100 + obj
    } else if (obj >= -128) {
      buf = Buffer.allocUnsafe(2)
      buf[0] = 0xd0
      buf.writeInt8(obj, 1)
    } else if (obj >= -32768) {
      buf = Buffer.allocUnsafe(3)
      buf[0] = 0xd1
      buf.writeInt16BE(obj, 1)
    } else if (obj > -214748365) {
      buf = Buffer.allocUnsafe(5)
      buf[0] = 0xd2
      buf.writeInt32BE(obj, 1)
    } else if (obj >= -9007199254740991) {
      buf = Buffer.allocUnsafe(9)
      buf[0] = 0xd3
      write64BitInt(buf, 1, obj)
    } else {
      return encodeFloat(obj, true)
    }
  }
  return buf
}

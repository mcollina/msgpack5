'use strict'

const Buffer = require('safe-buffer').Buffer
const bl = require('bl')
const isFloat = require('./helpers.js').isFloat

module.exports = function buildEncode (encodingTypes, options) {
  function encode (obj) {
    if (obj === undefined) throw new Error('undefined is not encodable in msgpack!')

    if (obj === null) return Buffer.from([0xc0])
    if (obj === true) return Buffer.from([0xc3])
    if (obj === false) return Buffer.from([0xc2])

    if (obj instanceof Map) return encodeMap(obj, options, encode)

    if (typeof obj === 'string') return encodeString(obj, options)

    if (obj && (obj.readUInt32LE || obj instanceof Uint8Array)) {
      if (obj instanceof Uint8Array) {
        obj = Buffer.from(obj)
      }
      // weird hack to support Buffer
      // and Buffer-like objects
      return bl([getBufferHeader(obj.length), obj])
    }
    if (Array.isArray(obj)) return encodeArray(obj, encode)
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

function encodeArray (array, encode) {
  const acc = [getHeader(array.length, 0x90, 0xdc)]

  // This has to be forEach; Array.prototype.map preserves missing values and
  // Array.prototype.values yields them as undefined
  array.forEach(item => {
    acc.push(encode(item))
  })

  if (acc.length !== array.length + 1) {
    throw new Error('Sparse arrays are not encodable in msgpack')
  }

  return bl(acc)
}

function encodeMap (map, options, encode) {
  const acc = [getHeader(map.size, 0x80, 0xde)]
  const keys = [...map.keys()]

  if (!options.preferMap) {
    if (keys.every(item => typeof item === 'string')) {
      console.warn('Map with string only keys will be deserialized as an object!')
    }
  }

  keys.forEach(key => {
    acc.push(encode(key), encode(map.get(key)))
  })
  return bl(acc)
}

function encodeObject (obj, options, encode) {
  const keys = []

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) &&
        obj[key] !== undefined &&
        typeof obj[key] !== 'function') {
      keys.push(key)
    }
  }

  const acc = [getHeader(keys.length, 0x80, 0xde)]

  if (options.sortKeys) keys.sort()

  keys.forEach(key => {
    acc.push(encode(key), encode(obj[key]))
  })

  return bl(acc)
}

function write64BitUint (buf, offset, num) {
  const lo = num % 4294967296
  const hi = Math.floor(num / 4294967296)

  buf.writeUInt32BE(hi, offset + 0)
  buf.writeUInt32BE(lo, offset + 4)
}

function write64BitInt (buf, offset, num) {
  const negate = num < 0
  num = Math.abs(num)
  write64BitUint(buf, offset, num)
  if (negate) negate64BitInt(buf, offset)
}

function negate64BitInt (buf, offset) {
  let i = offset + 8

  // Optimization based on the fact that:
  // buf[i] == 0x00  => (buf[i] ^ 0xff) + 1 = 0x100 = 0x00 + 1 curry

  while (i-- > offset) {
    if (buf[i] === 0x00) continue
    buf[i] = (buf[i] ^ 0xff) + 1
    break
  }

  while (i-- > offset) {
    buf[i] = buf[i] ^ 0xff
  }
}

const fround = Math.fround

function encodeFloat (obj, forceFloat64) {
  let buf

  if (forceFloat64 || !fround || !Object.is(fround(obj), obj)) {
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

function encodeExt (obj, encodingTypes) {
  const codec = encodingTypes.find(codec => codec.check(obj))
  if (!codec) return null
  const encoded = codec.encode(obj)
  if (!encoded) return null

  return bl([getExtHeader(encoded.length - 1), encoded])
}

function getExtHeader (length) {
  if (length === 1) return Buffer.from([0xd4])
  if (length === 2) return Buffer.from([0xd5])
  if (length === 4) return Buffer.from([0xd6])
  if (length === 8) return Buffer.from([0xd7])
  if (length === 16) return Buffer.from([0xd8])

  if (length < 256) return Buffer.from([0xc7, length])
  if (length < 0x10000) return Buffer.from([0xc8, length >> 8, length & 0x00ff])
  return Buffer.from([0xc9, length >> 24, (length >> 16) & 0x000000ff, (length >> 8) & 0x000000ff, length & 0x000000ff])
}

function getHeader (length, tag1, tag2) {
  if (length < 16) return Buffer.from([tag1 | length])
  const size = length < 0x10000 ? 2 : 4
  const buf = Buffer.allocUnsafe(1 + size)
  buf[0] = length < 0x10000 ? tag2 : tag2 + 1
  buf.writeUIntBE(length, 1, size)

  return buf
}

function encodeString (obj, options) {
  const len = Buffer.byteLength(obj)
  let buf
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
  let header
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

function encodeNumber (obj, options) {
  let buf
  if (isFloat(obj)) return encodeFloat(obj, options.forceFloat64)
  if (Math.abs(obj) > 9007199254740991) {
    return encodeFloat(obj, true)
  }

  if (obj >= 0) {
    if (obj < 128) {
      return Buffer.from([obj])
    } else if (obj < 256) {
      return Buffer.from([0xcc, obj])
    } else if (obj < 65536) {
      return Buffer.from([0xcd, 0xff & (obj >> 8), 0xff & (obj)])
    } else if (obj <= 0xffffffff) {
      return Buffer.from([0xce, 0xff & (obj >> 24), 0xff & (obj >> 16), 0xff & (obj >> 8), 0xff & (obj)])
    } else if (obj <= 9007199254740991) {
      buf = Buffer.allocUnsafe(9)
      buf[0] = 0xcf
      write64BitUint(buf, 1, obj)
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
    }
  }
  return buf
}

// function order(num, n = 1, step = 2) {
//    while (num = num >> step) n++;
//    return n
// }

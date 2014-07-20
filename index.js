
var assert    = require('assert')
  , bl        = require('bl')
  , TOLERANCE = 0.1

function msgpack() {

  function encode(obj) {
    var buf
      , len

    if (obj === undefined) {
      throw new Error('undefined is not encodable in msgpack!')
    } else if (obj === null) {
      buf = new Buffer(1)
      buf[0] = 0xc0
    } else if (obj === true) {
      buf = new Buffer(1)
      buf[0] = 0xc3
    } else if (obj === false) {
      buf = new Buffer(1)
      buf[0] = 0xc2
    } else if (typeof obj === 'string') {
      len = Buffer.byteLength(obj)
      if (len < 32) {
        buf = new Buffer(1 + len)
        buf[0] = 0xa0 | len
        buf.write(obj, 1)
      } else if (len <= 0xff) {
        buf = new Buffer(2 + len)
        buf[0] = 0xd9
        buf[1] = len
        buf.write(obj, 2)
      } else if (len <= 0xffff) {
        buf = new Buffer(3 + len)
        buf[0] = 0xda
        buf.writeUInt16BE(len, 1)
        buf.write(obj, 3)
      } else {
        buf = new Buffer(5 + len)
        buf[0] = 0xdb
        buf.writeUInt32BE(len, 1)
        buf.write(obj, 5)
      }
    } else if (obj && obj.readUInt32LE) {
      // weird hack to support Buffer
      // and Buffer-like objects
      if (obj.length <= 0xff) {
        buf = new Buffer(2)
        buf[0] = 0xc4
        buf[1] = obj.length
      } else if (obj.length <= 0xffff) {
        buf = new Buffer(3)
        buf[0] = 0xc5
        buf.writeUInt16BE(obj.length, 1)
      } else {
        buf = new Buffer(5)
        buf[0] = 0xc6
        buf.writeUInt32BE(obj.length, 1)
      }

      buf = bl([buf, obj])
    } else if (Array.isArray(obj)) {
      if (obj.length < 16) {
        buf = new Buffer(1)
        buf[0] = 0x90 | obj.length
      } else if (obj.length < 65536) {
        buf = new Buffer(3)
        buf[0] = 0xdc
        buf.writeUInt16BE(obj.length, 1)
      } else {
        buf = new Buffer(5)
        buf[0] = 0xdd
        buf.writeUInt32BE(obj.length, 1)
      }

      buf = obj.reduce(function(acc, obj) {
        acc.append(encode(obj))
        return acc
      }, bl().append(buf))
    } else if (typeof obj === 'object') {
      buf = encodeObject(obj)
    } else if (typeof obj === 'number') {
      if (isFloat(obj)) {
        return encodeFloat(obj)
      } else if (obj >= 0) {
        if (obj < 128) {
          buf = new Buffer(1)
          buf[0] = obj
        } else if (obj < 256) {
          buf = new Buffer(2)
          buf[0] = 0xcc
          buf[1] = obj
        } else if (obj < 65536) {
          buf = new Buffer(3)
          buf[0] = 0xcd
          buf.writeUInt16BE(obj, 1)
        } else if (obj < 0xffffffff) {
          buf = new Buffer(5)
          buf[0] = 0xce
          buf.writeUInt32BE(obj, 1)
        } else {
          buf = new Buffer(9)
          buf[0] = 0xcf

          write64BitUint(buf, obj)
        }
      } else {
         if (obj > -32) {
          buf = new Buffer(1)
          buf[0] = 0xe0 | -obj
        } else if (obj >= -128) {
          buf = new Buffer(2)
          buf[0] = 0xd0
          buf.writeInt8(obj, 1)
        } else if (obj >= -32768) {
          buf = new Buffer(3)
          buf[0] = 0xd1
          buf.writeInt16BE(obj, 1)
        } else if (obj > -214748365) {
          buf = new Buffer(5)
          buf[0] = 0xd2
          buf.writeInt32BE(obj, 1)
        }
      }
    }

    if (!buf)
      throw new Error('not implemented yet')

    return buf
  }

  function decode(buf) {
    assert(buf.length > 0, 'must not be empty')

    if (!(buf instanceof bl)) {
      buf = bl().append(buf)
    }

    var first = buf.readUInt8(0)
      , i
      , length
      , result

    switch (first) {
      case 0xc0:
        buf.consume(1)
        return null
      case 0xc2:
        buf.consume(1)
        return false
      case 0xc3:
        buf.consume(1)
        return true
      case 0xcc:
        // 1-byte unsigned int
        result = buf.readUInt8(1)
        buf.consume(2)
        return result
      case 0xcd:
        // 2-bytes BE unsigned int
        result = buf.readUInt16BE(1)
        buf.consume(3)
        return result
      case 0xce:
        // 4-bytes BE unsigned int
        result = buf.readUInt32BE(1)
        buf.consume(5)
        return result
      case 0xcf:
        // 8-bytes BE unsigned int
        result = buf.readUInt32BE(5) * 0xffffffff + buf.readUInt32BE(1)
        buf.consume(9)
        return result
      case 0xd0:
        // 1-byte signed int
        result = buf.readInt8(1)
        buf.consume(2)
        return result
      case 0xd1:
        // 2-bytes signed int
        result = buf.readInt16BE(1)
        buf.consume(3)
        return result
      case 0xd2:
        // 4-bytes signed int
        result = buf.readInt32BE(1)
        buf.consume(5)
        return result
      case 0xd3:
        // 8-bytes signed int
        throw new Error('not implemented yet')
      case 0xca:
        // 4-bytes float
        result = buf.readFloatBE(1)
        buf.consume(5)
        return result
      case 0xcb:
        // 8-bytes double
        result = buf.readDoubleBE(1)
        buf.consume(9)
        return result
      case 0xd9:
        // strings up to 2^8 - 1 bytes
        result = buf.toString('utf8', 2, 2 + buf.readUInt8(1))
        buf.consume(3 + buf.readUInt8(1))
        return result
      case 0xda:
        // strings up to 2^16 - 2 bytes
        result = buf.toString('utf8', 3, 3 + buf.readUInt16BE(1))
        buf.consume(4 + buf.readUInt16BE(1))
        return result
      case 0xdb:
        // strings up to 2^32 - 4 bytes
        result = buf.toString('utf8', 5, 5 + buf.readUInt32BE(1))
        buf.consume(6 + buf.readUInt32BE(1))
        return result
      case 0xc4:
        // buffers up to 2^8 - 1 bytes
        result = buf.slice(2, 2 + buf.readUInt8(1))
        buf.consume(3 + buf.readUInt8(1))
        return result
      case 0xc5:
        // buffers up to 2^16 - 1 bytes
        result = buf.slice(3, 3 + buf.readUInt16BE(1))
        buf.consume(4 + buf.readUInt16BE(1))
        return result
      case 0xc6:
        // buffers up to 2^32 - 1 bytes
        result = buf.slice(5, 5 + buf.readUInt32BE(1))
        buf.consume(6 + buf.readUInt32BE(1))
        return result
      case 0xdc:
        // array up to 2^16 elements - 2 bytes
        result = []
        length = buf.readUInt16BE(1)
        buf.consume(3)

        for (i = 0; i < length; i++) {
          result.push(decode(buf))
        }

        return result
      case 0xdd:
        // array up to 2^32 elements - 4 bytes
        result = []
        length = buf.readUInt32BE(1)
        buf.consume(5)

        for (i = 0; i < length; i++) {
          result.push(decode(buf))
        }

        return result
      case 0xde:
        // maps up to 2^16 elements - 2 bytes
        result = []
        length = buf.readUInt16BE(1)
        buf.consume(3)

        for (i = 0; i < length; i++) {
          result[decode(buf)] = decode(buf)
        }

        return result
      case 0xdf:
        throw new Error('map too big to decode in JS')
    }

    if ((first & 0xf0) === 0x90) {
      // we have an array with less than 15 elements
      length = first & 0x0f
      result = []
      buf.consume(1)

      for (i = 0; i < length; i++) {
        result.push(decode(buf))
      }

      return result
    } else if ((first & 0xf0) === 0x80) {
      // we have a map with less than 15 elements
      length = first & 0x0f
      result = {}
      buf.consume(1)

      for (i = 0; i < length; i++) {
        result[decode(buf)] = decode(buf)
      }

      return result
    } else if ((first & 0xe0) === 0xa0) {
      result = buf.toString('utf8', 1, (first & 0x1f) + 1)
      buf.consume((first & 0x1f) + 1)
      return result
    } else if (first > 0xe0) {
      // 5 bits negative ints
      result = - (~0xe0 & first)
      buf.consume(1)
      return result
    } else if (first < 0x80) {
      // 7-bits positive ints
      buf.consume(1)
      return first
    } else {
      throw new Error('not implemented yet')
    }
  }

  function encodeObject(obj) {
    var acc = []
      , length = 0
      , key
      , header

    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        ++length
        acc.push(encode(key))
        acc.push(encode(obj[key]))
      }
    }

    if (length < 16) {
      header = new Buffer(1)
      header[0] = 0x80 | length
    } else {
      header = new Buffer(3)
      header[0] = 0xde
      header.writeUInt16BE(length, 1)
    }

    acc.unshift(header)

    return bl(acc)
  }

  return {
    encode: encode,
    decode: decode
  }
}

function write64BitUint(buf, obj) {
  var big = Math.floor(obj / 0xffffffff)
  buf.writeUInt32BE(big, 5)
  buf.writeUInt32BE(obj - big * 0xffffffff, 1)
}

function isFloat(n) {
  return n !== Math.floor(n)
}

function encodeFloat(obj) {
  var buf

  buf = new Buffer(5)
  buf[0] = 0xca
  buf.writeFloatBE(obj, 1)

  // FIXME is there a way to check if a
  // value fits in a float?
  if (Math.abs(obj - buf.readFloatBE(1)) > TOLERANCE) {
    buf = new Buffer(9)
    buf[0] = 0xcb
    buf.writeDoubleBE(obj, 1)
  }

  return buf
}

module.exports = msgpack

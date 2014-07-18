
var assert    = require('assert')
  , bl        = require('bl')
  , TOLERANCE = 0.1

function msgpack() {

  function encode(obj) {
    var buf
      , len

    if (obj === undefined) {
      throw new Error('undefined is not encodable in msgpack!')
    }

    if (obj === null) {
      buf = new Buffer(1)
      buf[0] = 0xc0
    }

    if (obj === true) {
      buf = new Buffer(1)
      buf[0] = 0xc3
    }

    if (obj === false) {
      buf = new Buffer(1)
      buf[0] = 0xc2
    }

    if (typeof obj === 'string') {
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
    }

    // weird hack to support Buffer
    // and Buffer-like objects
    if (obj && obj.readUInt32LE) {
      console.log(obj.length);
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

      return bl([buf, obj])
    }

    if (typeof obj === 'number') {
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

    var first = buf.readUInt8(0)

    switch (first) {
      case 0xc0:
        return null
      case 0xc2:
        return false
      case 0xc3:
        return true
      case 0xcc:
        // 1-byte unsigned int
        return buf.readUInt8(1)
      case 0xcd:
        // 2-bytes BE unsigned int
        return buf.readUInt16BE(1)
      case 0xce:
        // 4-bytes BE unsigned int
        return buf.readUInt32BE(1)
      case 0xcf:
        // 8-bytes BE unsigned int
        return buf.readUInt32BE(5) * 0xffffffff + buf.readUInt32BE(1)
      case 0xd0:
        // 1-byte signed int
        return buf.readInt8(1)
      case 0xd1:
        // 2-bytes signed int
        return buf.readInt16BE(1)
      case 0xd2:
        // 4-bytes signed int
        return buf.readInt32BE(1)
      case 0xd3:
        // 8-bytes signed int
        throw new Error('not implemented yet')
      case 0xca:
        // 4-bytes float
        return buf.readFloatBE(1)
      case 0xcb:
        // 8-bytes double
        return buf.readDoubleBE(1)
      case 0xd9:
        // strings up to 2^8 - 1 bytes
        return buf.toString('utf8', 2, 2 + buf[1])
      case 0xda:
        // strings up to 2^16 - 1 bytes
        return buf.toString('utf8', 3, 3 + buf.readUInt16BE(1))
      case 0xdb:
        // strings up to 2^32 - 1 bytes
        return buf.toString('utf8', 5, 5 + buf.readUInt32BE(1))
      case 0xc4:
        // buffers up to 2^8 - 1 bytes
        return buf.slice(2, 2 + buf.readUInt8(1))
      case 0xc5:
        // buffers up to 2^16 - 1 bytes
        return buf.slice(3, 3 + buf.readUInt16BE(1))
      case 0xc6:
        // buffers up to 2^32 - 1 bytes
        return buf.slice(5, 5 + buf.readUInt32BE(1))
    }

    if ((first & 0xe0) === 0xa0) {
      return buf.toString('utf8', 1, first & 0x1f + 1)
    }

    if (first > 0xe0) {
      // 5 bits negative ints
      return - (~0xe0 & first)
    } else if (first < 0x80) {
      // 7-bits positive ints
      return first
    } else {
      throw new Error('not implemented yet')
    }
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

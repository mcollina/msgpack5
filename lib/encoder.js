
var bl        = require('bl')
  , TOLERANCE = 0.1

module.exports = function buildEncode(encodingTypes) {
  function encode(obj, avoidSlice) {
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
        acc.append(encode(obj, true))
        return acc
      }, bl().append(buf))
    } else if (obj.isTypedNumber) {
      if (obj.numberType == 'double') {
        buf = new Buffer(9)
        buf[0] = 0xcb
        buf.writeDoubleBE(obj.value, 1)
      } else {
        throw new Error('Unknown Type of TypedNumber')
      }
    } else if (typeof obj === 'object') {
      buf = encodeExt(obj) || encodeObject(obj)
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
         if (obj >= -32) {
          buf = new Buffer(1)
          buf[0] = 0x100 + obj
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

    if (avoidSlice)
      return buf
    else
      return buf.slice()
  }

  function encodeExt(obj) {
    var i
      , encoded
      , length = -1
      , headers = []

    for (i = 0; i < encodingTypes.length; i++) {
      if (encodingTypes[i].check(obj)) {
        encoded = encodingTypes[i].encode(obj)
        break;
      }
    }

    if (!encoded) {
      return null
    }

    // we subtract 1 because the length does not
    // include the type
    length = encoded.length - 1

    if (length === 1) {
      headers.push(0xd4)
    } else if (length === 2) {
      headers.push(0xd5)
    } else if (length === 4) {
      headers.push(0xd6)
    } else if (length === 8) {
      headers.push(0xd7)
    } else if (length === 16) {
      headers.push(0xd8)
    } else if (length < 256) {
      headers.push(0xc7)
      headers.push(length)
    } else if (length < 0x10000) {
      headers.push(0xc8)
      headers.push(length >> 8)
      headers.push(length & 0x00ff)
    } else {
      headers.push(0xc9)
      headers.push(length >> 24)
      headers.push((length >> 16) & 0x000000ff)
      headers.push((length >> 8) & 0x000000ff)
      headers.push(length & 0x000000ff)
    }

    return bl().append(new Buffer(headers)).append(encoded)
  }

  function encodeObject(obj) {
    var acc = []
      , length = 0
      , key
      , header

    for (key in obj) {
      if (obj.hasOwnProperty(key) &&
          obj[key] !== undefined &&
          "function" !== typeof obj[key] ) {
        ++length
        acc.push(encode(key, true))
        acc.push(encode(obj[key], true))
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

    var result = acc.reduce(function(list, buf) {
      return list.append(buf)
    }, bl())

    return result
  }

  return encode
}

function write64BitUint(buf, obj) {
   // Write long byte by byte, in big-endian order
  for (var currByte = 7; currByte >= 0; currByte--) {
    buf[currByte + 1] = (obj & 0xff);
    obj = obj / 256;
  }
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

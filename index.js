
var assert    = require('assert')
  , bl        = require('bl')
  , TOLERANCE = 0.1
  , streams   = require('./lib/streams')

function msgpack() {

  var encodingTypes = []
    , decodingTypes = []

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

    if (avoidSlice)
      return buf
    else
      return buf.slice()
  }

  function decode(buf) {
    assert(buf.length > 0, 'must not be empty')

    if (!(buf instanceof bl)) {
      buf = bl().append(buf)
    }

    var first = buf.readUInt8(0)
      , length
      , result
      , type

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
        buf.consume(2 + buf.readUInt8(1))
        return result
      case 0xda:
        // strings up to 2^16 - 2 bytes
        result = buf.toString('utf8', 3, 3 + buf.readUInt16BE(1))
        buf.consume(3 + buf.readUInt16BE(1))
        return result
      case 0xdb:
        // strings up to 2^32 - 4 bytes
        result = buf.toString('utf8', 5, 5 + buf.readUInt32BE(1))
        buf.consume(5 + buf.readUInt32BE(1))
        return result
      case 0xc4:
        // buffers up to 2^8 - 1 bytes
        result = buf.slice(2, 2 + buf.readUInt8(1))
        buf.consume(2 + buf.readUInt8(1))
        return result
      case 0xc5:
        // buffers up to 2^16 - 1 bytes
        result = buf.slice(3, 3 + buf.readUInt16BE(1))
        buf.consume(3 + buf.readUInt16BE(1))
        return result
      case 0xc6:
        // buffers up to 2^32 - 1 bytes
        result = buf.slice(5, 5 + buf.readUInt32BE(1))
        buf.consume(5 + buf.readUInt32BE(1))
        return result
      case 0xdc:
        // array up to 2^16 elements - 2 bytes
        length = buf.readUInt16BE(1)
        buf.consume(3)
        return decodeArray(buf, length)
      case 0xdd:
        // array up to 2^32 elements - 4 bytes
        length = buf.readUInt32BE(1)
        buf.consume(5)
        return decodeArray(buf, length)
      case 0xde:
        // maps up to 2^16 elements - 2 bytes
        length = buf.readUInt16BE(1)
        buf.consume(3)
        return decodeMap(buf, length)
      case 0xdf:
        throw new Error('map too big to decode in JS')
      case 0xd4:
        return decodeFixExt(buf, 1)
      case 0xd5:
        return decodeFixExt(buf, 2)
      case 0xd6:
        return decodeFixExt(buf, 4)
      case 0xd7:
        return decodeFixExt(buf, 8)
      case 0xd8:
        return decodeFixExt(buf, 16)
      case 0xc7:
        // ext up to 2^8 - 1 bytes
        length  = buf.readUInt8(1)
        type    = buf.readUInt8(2)
        buf.consume(3)
        return decodeExt(buf, type, length)
      case 0xc8:
        // ext up to 2^16 - 1 bytes
        length  = buf.readUInt16BE(1)
        type    = buf.readUInt8(3)
        buf.consume(4)
        return decodeExt(buf, type, length)
      case 0xc9:
        // ext up to 2^32 - 1 bytes
        length  = buf.readUInt32BE(1)
        type    = buf.readUInt8(5)
        buf.consume(6)
        return decodeExt(buf, type, length)
    }

    if ((first & 0xf0) === 0x90) {
      // we have an array with less than 15 elements
      length = first & 0x0f
      buf.consume(1)
      return decodeArray(buf, length)
    } else if ((first & 0xf0) === 0x80) {
      // we have a map with less than 15 elements
      length = first & 0x0f
      buf.consume(1)
      return decodeMap(buf, length)
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

  function decodeArray(buf, length) {
    var result = []
      , i

    for (i = 0; i < length; i++) {
      result.push(decode(buf))
    }
    return result
  }

  function decodeMap(buf, length) {
    var result = {}
      , key
      , i

    for (i = 0; i < length; i++) {
      key         = decode(buf)
      result[key] = decode(buf)
    }
    return result
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

  function registerEncoder(check, encode) {
    assert(check, 'must have an encode function')
    assert(encode, 'must have an encode function')

    encodingTypes.push({
        check: check
      , encode: encode
    })

    return this
  }

  function registerDecoder(type, decode) {
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')

    decodingTypes.push({
        type: type
      , decode: decode
    })

    return this
  }

  function register(type, constructor, encode, decode) {
    assert(constructor, 'must have a constructor')
    assert(encode, 'must have an encode function')
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')

    function check(obj) {
      return (obj instanceof constructor)
    }

    function reEncode(obj) {
      var buf = bl()
        , header = new Buffer(1)

      header.writeInt8(type, 0)

      buf.append(header)
      buf.append(encode(obj))

      return buf
    }

    this.registerEncoder(check, reEncode)
    this.registerDecoder(type, decode)

    return this
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

  function decodeFixExt(buf, size) {
    var type = buf.readUInt8(1)

    buf.consume(2)

    return decodeExt(buf, type, size)
  }

  function decodeExt(buf, type, size) {
    var i
      , toDecode

    for (i = 0; i < decodingTypes.length; i++) {
      if (type === decodingTypes[i].type) {
        toDecode = buf.slice(0, size)
        buf.consume(size)
        return decodingTypes[i].decode(toDecode)
      }
    }

    throw new Error('unable to find ext type ' + type)
  }

  return {
      encode: encode
    , decode: decode
    , register: register
    , registerEncoder: registerEncoder
    , registerDecoder: registerDecoder
    , encoder: streams.encoder
    , decoder: streams.decoder

    // needed for levelup support
    , buffer: true
    , type: 'msgpack5'
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

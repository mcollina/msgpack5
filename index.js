'use strict'

var Buffer = require('safe-buffer').Buffer
var assert = require('assert')
var bl = require('bl')
var streams = require('./lib/streams')
var buildDecode = require('./lib/decoder')
var buildEncode = require('./lib/encoder')
var IncompleteBufferError = require('./lib/helpers.js').IncompleteBufferError
var OutOfRangeError = require('./lib/helpers.js').OutOfRangeError

function msgpack (options) {
  var encodingTypes = []
  var decodingTypes = Object.create(null)

  options = options || {
    forceFloat64: false,
    compatibilityMode: false,
    // if true, skips encoding Dates using the msgpack
    // timestamp ext format (-1)
    disableTimestampEncoding: false,
    // if true, will throw error when decoding a timestamp96 that
    // is more precise, or greater than or lower than the number
    // of seconds JavaScript Date can handle or if nanoseconds > 999999999
    timestamp96ThrowRangeEx: false
  }

  function registerEncoder (check, encode) {
    assert(check, 'must have an encode function')
    assert(encode, 'must have an encode function')

    encodingTypes.push({ check: check, encode: encode })

    return this
  }

  function registerDecoder (type, decode) {
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')
    decodingTypes[type] = decode
    return this
  }

  function register (type, constructor, encode, decode) {
    assert(constructor, 'must have a constructor')
    assert(encode, 'must have an encode function')
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')

    function check (obj) {
      return (obj instanceof constructor)
    }

    function reEncode (obj) {
      var buf = bl()
      var header = Buffer.allocUnsafe(1)

      header.writeInt8(type, 0)

      buf.append(header)
      buf.append(encode(obj))

      return buf
    }

    this.registerEncoder(check, reEncode)
    this.registerDecoder(type, decode)

    return this
  }

  return {
    encode: buildEncode(encodingTypes, options.forceFloat64, options.compatibilityMode, options.disableTimestampEncoding),
    decode: buildDecode(decodingTypes, options.timestamp96ThrowRangeEx),
    register: register,
    registerEncoder: registerEncoder,
    registerDecoder: registerDecoder,
    encoder: streams.encoder,
    decoder: streams.decoder,
    // needed for levelup support
    buffer: true,
    type: 'msgpack5',
    IncompleteBufferError: IncompleteBufferError,
    OutOfRangeError: OutOfRangeError
  }
}

module.exports = msgpack

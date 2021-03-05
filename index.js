'use strict'

const Buffer = require('safe-buffer').Buffer
const assert = require('assert')
const bl = require('bl')
const streams = require('./lib/streams')
const buildDecode = require('./lib/decoder')
const buildEncode = require('./lib/encoder')
const IncompleteBufferError = require('./lib/helpers.js').IncompleteBufferError
const DateCodec = require('./lib/codecs/DateCodec')

function msgpack (options) {
  const encodingTypes = []
  const decodingTypes = new Map()

  options = options || {
    forceFloat64: false,
    compatibilityMode: false,
    // if true, skips encoding Dates using the msgpack
    // timestamp ext format (-1)
    disableTimestampEncoding: false,
    preferMap: false,
    // options.protoAction: 'error' (default) / 'remove' / 'ignore'
    protoAction: 'error'
  }

  decodingTypes.set(DateCodec.type, DateCodec.decode)
  if (!options.disableTimestampEncoding) {
    encodingTypes.push(DateCodec)
  }

  function registerEncoder (check, encode) {
    assert(check, 'must have an encode function')
    assert(encode, 'must have an encode function')

    encodingTypes.push({ check, encode })

    return this
  }

  function registerDecoder (type, decode) {
    assert(type >= 0, 'must have a non-negative type')
    assert(decode, 'must have a decode function')
    decodingTypes.set(type, decode)
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
      const buf = bl()
      const header = Buffer.allocUnsafe(1)

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
    encode: buildEncode(encodingTypes, options),
    decode: buildDecode(decodingTypes, options),
    register,
    registerEncoder,
    registerDecoder,
    encoder: streams.encoder,
    decoder: streams.decoder,
    // needed for levelup support
    buffer: true,
    type: 'msgpack5',
    IncompleteBufferError
  }
}

module.exports = msgpack

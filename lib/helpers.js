'use strict'

var util = require('util')

const fround = Math.fround

exports.IncompleteBufferError = IncompleteBufferError

function IncompleteBufferError (message) {
  Error.call(this) // super constructor
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor) // super helper method to include stack trace in error object
  }
  this.name = this.constructor.name
  this.message = message || 'unable to decode'
}

util.inherits(IncompleteBufferError, Error)

exports.isFloat = function isFloat (n) {
  return n % 1 !== 0
}

exports.isNaN = function isNaN (n) {
  /* eslint-disable no-self-compare */
  return n !== n && typeof n === 'number'
  /* eslint-enable no-self-compare */
}

exports.encodeFloat = function encodeFloat (obj, forceFloat64) {
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

'use strict'

var util = require('util')
var TIME_MAX = 864E10

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

exports.OutOfRangeError = OutOfRangeError

function OutOfRangeError (message) {
  Error.call(this) // super constructor
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor) // super helper method to include stack trace in error object
  }
  this.name = this.constructor.name
  this.message = message || 'unable to decode'
}

util.inherits(OutOfRangeError, Error)

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

exports.decodeTimestamp = function decodeTimestamp (buf, size, headerSize, timestamp96ThrowRangeEx) {
  var seconds
  var nanoseconds = 0

  switch (size) {
    case 4:
      // timestamp 32 stores the number of seconds that have elapsed since 1970-01-01 00:00:00 UTC in an 32-bit unsigned integer
      seconds = buf.readUInt32BE(0)
      break

    case 8:
      // Timestamp 64 stores the number of seconds and nanoseconds that have elapsed
      // since 1970-01-01 00:00:00 UTC in 32-bit unsigned integers, split 30/34 bits
      var upper = buf.readUInt32BE(0)
      var lower = buf.readUInt32BE(4)
      nanoseconds = upper / 4
      seconds = ((upper & 0x03) * Math.pow(2, 32)) + lower // If we use bitwise operators, we get truncated to 32bits
      break

    case 12:
      // Timestamp 96 stores the number of seconds and nanoseconds that have elapsed since 1970-01-01 00:00:00 UTC
      // in 64-bit signed integer and 32-bit unsigned integer
      nanoseconds = buf.readUInt32BE()
      var upper96 = buf.readInt32BE(4)
      var lower96 = buf.readUInt32BE(8)
      seconds = (upper96 * Math.pow(2, 32)) + lower96 // If we use bitwise operators, we get truncated to 32bits
      if (seconds > TIME_MAX) {
        if (timestamp96ThrowRangeEx) {
          throw new OutOfRangeError()
        } else {
          seconds = TIME_MAX // JS Date Max
        }
      } else if (seconds < -TIME_MAX) {
        if (timestamp96ThrowRangeEx) {
          throw new OutOfRangeError()
        } else {
          seconds = -TIME_MAX // JS Date Min
        }
      }

      // Nanos are more precise than allowed
      if ((nanoseconds % 1e6) && timestamp96ThrowRangeEx) {
        throw new OutOfRangeError()
      }

      // Nanos are greater than allowed, 999999999
      if ((nanoseconds >= 1e9)) {
        if (timestamp96ThrowRangeEx) {
          throw new OutOfRangeError()
        } else {
          nanoseconds = 1e9 - 1 // Set to max allowed nanos
        }
      }

      break
  }

  // Must be Math.floor(nanoseconds / 1E6) otherwise we could roll over max seconds
  var millis = (seconds * 1000) + Math.floor(nanoseconds / 1E6)

  return [ new Date(millis), size + headerSize ]
}

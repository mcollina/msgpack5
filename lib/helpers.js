'use strict'

const util = require('util')

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

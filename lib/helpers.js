'use strict'

const util = require('util')
const Buffer = require('safe-buffer').Buffer
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')

exports.IncompleteBufferError = IncompleteBufferError
exports.toBufferList = toBufferList
exports.appendBuffer = appendBuffer

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

// Returns a DynamicBuffer wrapping the given value(s).
// Unlike the DynamicBuffer constructor, nested DynamicBuffer instances are
// unwrapped (mirroring the old `bl([...])` semantics), so their chunks are
// appended rather than stored as a single child buffer.
function toBufferList (buffers) {
  if (DynamicBuffer.isDynamicBuffer(buffers)) return buffers

  const db = new DynamicBuffer()
  if (Array.isArray(buffers)) {
    for (let i = 0; i < buffers.length; i++) {
      appendBuffer(db, buffers[i])
    }
  } else {
    appendBuffer(db, buffers)
  }
  return db
}

function appendBuffer (db, value) {
  if (DynamicBuffer.isDynamicBuffer(value)) {
    db.appendFrom(value)
    return db
  }

  if (value == null) return db

  if (Buffer.isBuffer(value)) {
    db.append(value)
  } else if (value.buffer && typeof value.byteOffset === 'number' && typeof value.byteLength === 'number') {
    // Buffer-like views (e.g. Uint8Array / objects exposing .buffer) are
    // stored as a zero-copy view, mirroring the old `bl` coercion.
    db.append(Buffer.from(value.buffer, value.byteOffset, value.byteLength))
  } else if (typeof value === 'number') {
    // coerce numbers to strings, since Buffer(number) allocates
    db.append(Buffer.from(value.toString()))
  } else {
    db.append(Buffer.from(value))
  }
  return db
}

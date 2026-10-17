'use strict'

const Buffer = require('safe-buffer').Buffer
const { DynamicBuffer } = require('@platformatic/dynamic-buffer')
const isFloat = require('./helpers.js').isFloat

module.exports = function buildEncode (encodingTypes, options) {
  function encode (obj) {
    if (obj === undefined) throw new Error('undefined is not encodable in msgpack!')

    const writer = new Writer()
    encodeValue(writer, obj)
    return writer.finish()
  }

  return encode

  function encodeValue (writer, obj) {
    if (obj === null) { writer.writeUInt8(0xc0); return }
    if (obj === true) { writer.writeUInt8(0xc3); return }
    if (obj === false) { writer.writeUInt8(0xc2); return }

    const type = typeof obj
    if (type === 'string') return encodeString(writer, obj, options)
    if (type === 'number') return encodeNumber(writer, obj, options)

    if (Array.isArray(obj)) return encodeArray(writer, obj, encodeValue)

    if (type === 'object') {
      if (obj instanceof Map) return encodeMap(writer, obj, options, encodeValue)

      if (obj instanceof Uint8Array || obj.readUInt32LE) {
        let buf = obj
        if (obj instanceof Uint8Array) {
          buf = Buffer.from(obj)
        }
        // weird hack to support Buffer
        // and Buffer-like objects
        const getBufferHeader = options.compatibilityMode ? writeCompatibleBufferHeader : writeBufferHeader
        getBufferHeader(writer, buf.length)
        writer.writeBytes(buf)
        return
      }

      if (encodeExt(writer, obj, encodingTypes)) return
      return encodeObject(writer, obj, options, encodeValue)
    }

    throw new Error('not implemented yet')
  }
}

function encodeArray (writer, array, encodeValue) {
  writeHeader(writer, array.length, 0x90, 0xdc)

  for (let i = 0; i < array.length; i++) {
    if (!(i in array)) {
      throw new Error('Sparse arrays are not encodable in msgpack')
    }
    encodeValue(writer, array[i])
  }
}

function encodeMap (writer, map, options, encodeValue) {
  const keys = [...map.keys()]

  writeHeader(writer, map.size, 0x80, 0xde)

  if (!options.preferMap) {
    let allString = true
    for (let i = 0; i < keys.length; i++) {
      if (typeof keys[i] !== 'string') {
        allString = false
        break
      }
    }
    if (allString) {
      console.warn('Map with string only keys will be deserialized as an object!')
    }
  }

  for (let i = 0; i < keys.length; i++) {
    encodeValue(writer, keys[i])
    encodeValue(writer, map.get(keys[i]))
  }
}

function encodeObject (writer, obj, options, encodeValue) {
  const keys = []

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) &&
        obj[key] !== undefined &&
        typeof obj[key] !== 'function') {
      keys.push(key)
    }
  }

  if (options.sortKeys) keys.sort()

  writeHeader(writer, keys.length, 0x80, 0xde)

  for (let i = 0; i < keys.length; i++) {
    encodeValue(writer, keys[i])
    encodeValue(writer, obj[keys[i]])
  }
}

function writeHeader (writer, length, tag1, tag2) {
  if (length < 16) {
    writer.writeUInt8(tag1 | length)
    return
  }
  if (length < 0x10000) {
    writer.writeUInt8(tag2)
    writer.writeUInt16BE(length)
    return
  }
  writer.writeUInt8(tag2 + 1)
  writer.writeUInt32BE(length)
}

function writeBufferHeader (writer, length) {
  if (length <= 0xff) {
    writer.writeUInt8(0xc4)
    writer.writeUInt8(length)
  } else if (length <= 0xffff) {
    writer.writeUInt8(0xc5)
    writer.writeUInt16BE(length)
  } else {
    writer.writeUInt8(0xc6)
    writer.writeUInt32BE(length)
  }
}

function writeCompatibleBufferHeader (writer, length) {
  if (length <= 0x1f) {
    // fix raw header: 101XXXXX
    writer.writeUInt8(0xa0 | length)
  } else if (length <= 0xffff) {
    // raw 16 header: 0xda, XXXXXXXX, XXXXXXXX
    writer.writeUInt8(0xda)
    writer.writeUInt16BE(length)
  } else {
    // raw 32 header: 0xdb, XXXXXXXX, XXXXXXXX, XXXXXXXX, XXXXXXXX
    writer.writeUInt8(0xdb)
    writer.writeUInt32BE(length)
  }
}

const fround = Math.fround

function writeFloat (writer, obj, forceFloat64) {
  if (forceFloat64 || !fround || !Object.is(fround(obj), obj)) {
    writer.writeUInt8(0xcb)
    writer.writeDoubleBE(obj)
  } else {
    writer.writeUInt8(0xca)
    writer.writeFloatBE(obj)
  }
}

function encodeExt (writer, obj, encodingTypes) {
  const codec = encodingTypes.find(codec => codec.check(obj))
  if (!codec) return false
  const encoded = codec.encode(obj)
  if (!encoded) return false

  writeExtHeader(writer, encoded.length - 1)
  writer.writeBytes(encoded)

  return true
}

function writeExtHeader (writer, length) {
  if (length === 1) { writer.writeUInt8(0xd4); return }
  if (length === 2) { writer.writeUInt8(0xd5); return }
  if (length === 4) { writer.writeUInt8(0xd6); return }
  if (length === 8) { writer.writeUInt8(0xd7); return }
  if (length === 16) { writer.writeUInt8(0xd8); return }

  if (length < 256) { writer.writeUInt8(0xc7); writer.writeUInt8(length); return }
  if (length < 0x10000) { writer.writeUInt8(0xc8); writer.writeUInt16BE(length); return }
  writer.writeUInt8(0xc9)
  writer.writeUInt32BE(length)
}

function encodeString (writer, obj, options) {
  const len = Buffer.byteLength(obj)
  if (len < 32) {
    writer.writeUInt8(0xa0 | len)
    if (len > 0) writer.writeUtf8(obj, len)
  } else if (len <= 0xff && !options.compatibilityMode) {
    // str8, but only when not in compatibility mode
    writer.writeUInt8(0xd9)
    writer.writeUInt8(len)
    writer.writeUtf8(obj, len)
  } else if (len <= 0xffff) {
    writer.writeUInt8(0xda)
    writer.writeUInt16BE(len)
    writer.writeUtf8(obj, len)
  } else {
    writer.writeUInt8(0xdb)
    writer.writeUInt32BE(len)
    writer.writeUtf8(obj, len)
  }
}

function encodeNumber (writer, obj, options) {
  if (isFloat(obj)) return writeFloat(writer, obj, options.forceFloat64)
  if (Math.abs(obj) > 9007199254740991) {
    return writeFloat(writer, obj, true)
  }

  if (obj >= 0) {
    if (obj < 128) {
      writer.writeUInt8(obj)
    } else if (obj < 256) {
      writer.writeUInt8(0xcc)
      writer.writeUInt8(obj)
    } else if (obj < 65536) {
      writer.writeUInt8(0xcd)
      writer.writeUInt16BE(obj)
    } else if (obj <= 0xffffffff) {
      writer.writeUInt8(0xce)
      writer.writeUInt32BE(obj)
    } else if (obj <= 9007199254740991) {
      writer.writeUInt8(0xcf)
      write64BitUint(writer, obj)
    }
  } else {
    if (obj >= -32) {
      writer.writeUInt8(0x100 + obj)
    } else if (obj >= -128) {
      writer.writeUInt8(0xd0)
      writer.writeInt8(obj)
    } else if (obj >= -32768) {
      writer.writeUInt8(0xd1)
      writer.writeInt16BE(obj)
    } else if (obj > -214748365) {
      writer.writeUInt8(0xd2)
      writer.writeInt32BE(obj)
    } else if (obj >= -9007199254740991) {
      writer.writeUInt8(0xd3)
      write64BitInt(writer, obj)
    }
  }
}

function write64BitUint (writer, num) {
  const lo = num % 4294967296
  const hi = Math.floor(num / 4294967296)

  writer.writeUInt32BE(hi)
  writer.writeUInt32BE(lo)
}

function write64BitInt (writer, num) {
  const negate = num < 0
  num = Math.abs(num)
  write64BitUint(writer, num)
  if (negate) negate64BitInt(writer)
}

function negate64BitInt (writer) {
  let i = writer.offset

  // Optimization based on the fact that:
  // buffer[i] == 0x00  => (buffer[i] ^ 0xff) + 1 = 0x100 = 0x00 + 1 curry
  while (i-- > writer.offset - 8) {
    if (writer.buffer[i] === 0x00) continue
    writer.buffer[i] = (writer.buffer[i] ^ 0xff) + 1
    break
  }

  while (i-- > writer.offset - 8) {
    writer.buffer[i] = writer.buffer[i] ^ 0xff
  }
}

class Writer {
  constructor (initialSize) {
    this.buffer = Buffer.allocUnsafe(initialSize || 256)
    this.offset = 0
  }

  _ensure (extra) {
    if (this.offset + extra > this.buffer.length) {
      const newLength = Math.max(this.buffer.length * 2, this.offset + extra)
      const next = Buffer.allocUnsafe(newLength)
      this.buffer.copy(next, 0, 0, this.offset)
      this.buffer = next
    }
  }

  writeUInt8 (value) {
    this._ensure(1)
    this.buffer[this.offset++] = value
  }

  writeInt8 (value) {
    this._ensure(1)
    this.buffer.writeInt8(value, this.offset)
    this.offset += 1
  }

  writeUInt16BE (value) {
    this._ensure(2)
    this.buffer.writeUInt16BE(value, this.offset)
    this.offset += 2
  }

  writeInt16BE (value) {
    this._ensure(2)
    this.buffer.writeInt16BE(value, this.offset)
    this.offset += 2
  }

  writeUInt32BE (value) {
    this._ensure(4)
    this.buffer.writeUInt32BE(value, this.offset)
    this.offset += 4
  }

  writeInt32BE (value) {
    this._ensure(4)
    this.buffer.writeInt32BE(value, this.offset)
    this.offset += 4
  }

  writeFloatBE (value) {
    this._ensure(4)
    this.buffer.writeFloatBE(value, this.offset)
    this.offset += 4
  }

  writeDoubleBE (value) {
    this._ensure(8)
    this.buffer.writeDoubleBE(value, this.offset)
    this.offset += 8
  }

  writeUtf8 (str, len) {
    this._ensure(len)
    // this.buffer is always a real Buffer, so the internal utf8Write fast path
    // is available and avoids the Buffer#write argument-validation wrapper.
    this.buffer.utf8Write(str, this.offset, len)
    this.offset += len
  }

  writeBytes (buf) {
    if (!buf || buf.length === 0) return

    if (DynamicBuffer.isDynamicBuffer(buf)) {
      const buffers = buf.buffers
      for (let i = 0; i < buffers.length; i++) {
        this.writeBytes(buffers[i])
      }
      return
    }

    const len = buf.length
    this._ensure(len)
    if (Buffer.isBuffer(buf)) {
      buf.copy(this.buffer, this.offset)
    } else {
      // Buffer-like views (e.g. Uint8Array) — copy their bytes in
      Buffer.from(buf.buffer || buf, buf.byteOffset || 0, len).copy(this.buffer, this.offset)
    }
    this.offset += len
  }

  finish () {
    // Return a view over exactly the used bytes. The writer's buffer is created
    // per encode() call and discarded afterwards, so the returned view is the
    // only reference to those bytes and cannot be aliased by a later allocation.
    // This avoids the per-encode copy in the hot path.
    return this.buffer.subarray(0, this.offset)
  }
}

'use strict'

const test = require('tape').test
const msgpack = require('../')

function buildBuffer (size) {
  const buf = Buffer.allocUnsafe(size)
  buf.fill('a')

  return buf
}

test('encode/compatibility mode', function (t) {
  const compatEncoder = msgpack({
    compatibilityMode: true
  })
  const defaultEncoder = msgpack({
    compatibilityMode: false
  })

  const oneBytesStr = Array(31 + 2).join('x')
  const twoBytesStr = Array(255 + 2).join('x')

  t.test('default encoding a string of length ' + oneBytesStr.length, function (t) {
    // Default: use 1 byte length string (str8)
    const buf = defaultEncoder.encode(oneBytesStr)
    t.equal(buf[0], 0xd9, 'must have the proper header (str8)')
    t.equal(buf.toString('utf8', 2, Buffer.byteLength(oneBytesStr) + 2), oneBytesStr, 'must decode correctly')
    t.end()
  })

  t.test('compat. encoding a string of length ' + oneBytesStr.length, function (t) {
    // Compat. mode: use 2 byte length string (str16)
    const buf = compatEncoder.encode(oneBytesStr)
    t.equal(buf[0], 0xda, 'must have the proper header (str16)')
    t.equal(buf.toString('utf8', 3, Buffer.byteLength(oneBytesStr) + 3), oneBytesStr, 'must decode correctly')
    t.end()
  })

  t.test('encoding for a string of length ' + twoBytesStr.length, function (t) {
    // Two byte strings: compat. mode should make no difference
    const buf1 = defaultEncoder.encode(twoBytesStr)
    const buf2 = compatEncoder.encode(twoBytesStr)
    t.deepEqual(buf1, buf2, 'must be equal for two byte strings')
    t.end()
  })

  const fixRawBuffer = buildBuffer(1)
  const raw16Buffer = buildBuffer(Math.pow(2, 16) - 1)
  const raw32Buffer = buildBuffer(Math.pow(2, 16) + 1)

  t.test('compat. encoding a Buffer of length ' + fixRawBuffer.length, function (t) {
    // fix raw header: 0xa0 | 1 = 0xa1
    const buf = compatEncoder.encode(fixRawBuffer)
    t.equal(buf[0], 0xa1, 'must have the proper header (fix raw)')
    t.equal(buf.toString('utf8', 1, Buffer.byteLength(fixRawBuffer) + 1), fixRawBuffer.toString('utf8'), 'must decode correctly')
    t.end()
  })

  t.test('compat. encoding a Buffer of length ' + raw16Buffer.length, function (t) {
    const buf = compatEncoder.encode(raw16Buffer)
    t.equal(buf[0], 0xda, 'must have the proper header (raw 16)')
    t.equal(buf.toString('utf8', 3, Buffer.byteLength(raw16Buffer) + 3), raw16Buffer.toString('utf8'), 'must decode correctly')
    t.end()
  })

  t.test('compat. encoding a Buffer of length ' + raw32Buffer.length, function (t) {
    const buf = compatEncoder.encode(raw32Buffer)
    t.equal(buf[0], 0xdb, 'must have the proper header (raw 32)')
    t.equal(buf.toString('utf8', 5, Buffer.byteLength(raw32Buffer) + 5), raw32Buffer.toString('utf8'), 'must decode correctly')
    t.end()
  })
})

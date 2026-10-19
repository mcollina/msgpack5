'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

test('encoding/decoding 5-bits negative ints', function (t) {
  const encoder = msgpack()
  const allNum = []

  for (let i = 1; i <= 32; i++) {
    allNum.push(-i)
  }

  allNum.forEach(function (num) {
    t.test('encoding ' + num, function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 1, 'must have 1 byte')
      t.assert.strictEqual(buf[0], num + 0x100, 'must encode correctly')
    })

    t.test('decoding' + num, function (t) {
      const buf = Buffer.from([num + 0x100])
      t.assert.strictEqual(encoder.decode(buf), num, 'must decode correctly')
    })

    t.test('mirror test' + num, function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(num)), num, 'must stay the same')
    })
  })
})

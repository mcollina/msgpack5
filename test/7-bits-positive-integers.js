'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('node:test')
const msgpack = require('../')

test('encoding/decoding 7-bits positive ints', async function (t) {
  const encoder = msgpack()
  const allNum = []

  for (let i = 0; i < 126; i++) {
    allNum.push(i)
  }

  for (const num of allNum) {
    await t.test('encoding ' + num, async function (t) {
      const buf = encoder.encode(num)
      t.assert.strictEqual(buf.length, 1, 'must have 1 byte')
      t.assert.strictEqual(buf[0], num, 'must decode correctly')
    })

    await t.test('decoding ' + num, async function (t) {
      const buf = Buffer.from([num])
      t.assert.strictEqual(encoder.decode(buf), num, 'must decode correctly')
    })

    await t.test('mirror test' + num, async function (t) {
      t.assert.strictEqual(encoder.decode(encoder.encode(num)), num, 'must stay the same')
    })
  }
})

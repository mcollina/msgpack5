'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const fs = require('fs')
const p = require('path')
const msgpack = require('../')

test('encode/decode map with multiple short buffers', function (t) {
  const map = {
    first: Buffer.from('first'),
    second: Buffer.from('second'),
    third: Buffer.from('third')
  }
  const pack = msgpack()

  t.deepEqual(pack.decode(pack.encode(map)), map)
  t.end()
})

if (process.title !== 'browser') {
  test('encode/decode map with all files in this directory', function (t) {
    const files = fs.readdirSync(__dirname)
    const map = files.reduce(function (acc, file) {
      acc[file] = fs.readFileSync(p.join(__dirname, file))
      return acc
    }, {})
    const pack = msgpack()

    t.deepEqual(pack.decode(pack.encode(map)), map)
    t.end()
  })
}

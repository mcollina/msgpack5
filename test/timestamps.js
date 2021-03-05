'use strict'

const Buffer = require('safe-buffer').Buffer
const test = require('tape').test
const msgpack = require('../')

test('timestamp disabling', function (t) {
  const encoder = msgpack({ disableTimestampEncoding: true })
  const timestamps = [
    [new Date('2018-01-02T03:04:05.000000000Z'), [0x80]]
  ]

  timestamps.forEach(function (testcase) {
    const item = testcase[0]
    const expected = testcase[1]

    t.test('encoding ' + item.toString(), function (t) {
      const buf = encoder.encode(item).slice()
      t.equal(buf.length, expected.length, 'must have ' + expected.length + ' bytes')
      t.equal(buf[0], expected[0], 'Should return 0x80 ({}) by default')
      t.end()
    })
  })

  t.end()
})
test('encoding/decoding timestamp 64', function (t) {
  const encoder = msgpack()
  const timestamps = [
    [new Date('2018-01-02T03:04:05.000000000Z'), [0xd6, 0xff, 0x5a, 0x4a, 0xf6, 0xa5]],
    [new Date('2038-01-19T03:14:08.000000000Z'), [0xd6, 0xff, 0x80, 0x00, 0x00, 0x00]],
    [new Date('2038-01-19T03:14:07.999000000Z'), [0xd7, 0xff, 0xee, 0x2E, 0x1F, 0x00, 0x7f, 0xff, 0xff, 0xff]],
    [new Date('2106-02-07T06:28:16.000000000Z'), [0xd7, 0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]],
    [new Date('2018-01-02T03:04:05.678000000Z'), [0xd7, 0xff, 0xa1, 0xa5, 0xd6, 0x00, 0x5a, 0x4a, 0xf6, 0xa5]]
  ]

  timestamps.forEach(function (testcase) {
    const item = testcase[0]
    const expected = testcase[1]

    t.test('encoding ' + item.toString(), function (t) {
      const buf = encoder.encode(item).slice()
      t.equal(buf.length, expected.length, 'must have ' + expected.length + ' bytes')
      switch (expected.length) {
        case 6:
          t.equal(buf[0], 0xd6, 'must have the correct header')
          break
        case 10:
          t.equal(buf[0], 0xd7, 'must have the correct header')
          break
      }
      t.equal(buf.readInt8(1), -1, 'must have the correct type') // Signed
      for (let j = 2; j < buf.length; j++) {
        t.equal(buf[j], expected[j], 'byte ' + (j - 2) + ' match')
      }
      t.end()
    })

    t.test('decoding ' + item, function (t) {
      const buf = Buffer.from(expected)
      const dt = encoder.decode(buf)
      t.equal(dt.toString(), item.toString(), 'must decode correctly\nDecoded:\t' + dt * 1 + '\nExp:\t' + item * 1)
      t.end()
    })

    t.test('mirror test ' + item, function (t) {
      t.equal(encoder.decode(encoder.encode(item)) * 1, item * 1, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

test('encoding/decoding timestamp 96', function (t) {
  const encoder = msgpack()
  const timestamps = [
    [new Date('0001-01-02T03:04:05.000000000Z'), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xf1, 0x88, 0x6f, 0x85, 0xa5]],
    [new Date('1251-01-19T03:14:08.000000000Z'), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xfa, 0xb7, 0xb2, 0xdf, 0x00]],
    [new Date('1526-01-19T03:14:07.999000000Z'), [0xc7, 0x0c, 0xff, 0x3b, 0x8b, 0x87, 0xc0, 0xff, 0xff, 0xff, 0xfc, 0xbc, 0xf4, 0x34, 0x7f]],
    [new Date('1920-02-07T06:28:16.000000000Z'), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xa2, 0x23, 0xf0, 0x00]],
    [new Date('1969-01-02T03:04:05.678000000Z'), [0xc7, 0x0c, 0xff, 0x28, 0x69, 0x75, 0x80, 0xff, 0xff, 0xff, 0xff, 0xfe, 0x20, 0x49, 0x25]],
    [new Date('2514-05-30T02:04:05.678000000Z'), [0xc7, 0x0c, 0xff, 0x28, 0x69, 0x75, 0x80, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x02, 0x95]]
  ]

  timestamps.forEach(function (testcase) {
    const item = testcase[0]
    const expected = testcase[1]

    t.test('encoding ' + item.toString(), function (t) {
      const buf = encoder.encode(item).slice()
      t.equal(buf.length, expected.length, 'must have ' + expected.length + ' bytes')
      t.equal(buf[0], 0xc7, 'must have the correct header')
      t.equal(buf.readInt8(1), 12, 'must have the correct size')
      t.equal(buf.readInt8(2), -1, 'must have the correct type') // Signed
      for (let j = 3; j < buf.length; j++) {
        t.equal(buf[j], expected[j], 'byte ' + (j - 3) + ' match')
      }
      t.end()
    })

    t.test('decoding ' + item, function (t) {
      const buf = Buffer.from(expected)
      const dt = encoder.decode(buf)
      t.equal(dt.toString(), item.toString(), 'must decode correctly\nDecoded:\t' + dt * 1 + '\nExp:\t' + item * 1)
      t.end()
    })

    t.test('mirror test ' + item, function (t) {
      t.equal(encoder.decode(encoder.encode(item)) * 1, item * 1, 'must stay the same')
      t.end()
    })
  })

  t.end()
})

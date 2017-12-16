'use strict'

var Buffer = require('safe-buffer').Buffer
var test = require('tape').test
var msgpack = require('../')

test('timestamp disabling', function (t) {
  var encoder = msgpack({disableTimestampEncoding: true})
  var timestamps = [
        [new Date('2018-01-02T03:04:05.000000000Z'), [0x80]]
  ]

  timestamps.forEach(function (testcase) {
    var item = testcase[0]
    var expected = testcase[1]

    t.test('encoding ' + item.toString(), function (t) {
      var buf = encoder.encode(item).slice()
      t.equal(buf.length, expected.length, 'must have ' + expected.length + ' bytes')
      t.equal(buf[0], expected[0], 'Should return 0x80 ({}) by default')
      t.end()
    })
  })

  t.end()
})
test('encoding/decoding timestamp 64', function (t) {
  var encoder = msgpack()
  var timestamps = [
  [new Date('2018-01-02T03:04:05.000000000Z'), [0xd6, 0xff, 0x5a, 0x4a, 0xf6, 0xa5]],
  [new Date('2038-01-19T03:14:08.000000000Z'), [0xd6, 0xff, 0x80, 0x00, 0x00, 0x00]],
  [new Date('2038-01-19T03:14:07.999000000Z'), [0xd7, 0xff, 0xee, 0x2E, 0x1F, 0x00, 0x7f, 0xff, 0xff, 0xff]],
  [new Date('2106-02-07T06:28:16.000000000Z'), [0xd7, 0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]],
  [new Date('2018-01-02T03:04:05.678000000Z'), [0xd7, 0xff, 0xa1, 0xa5, 0xd6, 0x00, 0x5a, 0x4a, 0xf6, 0xa5]]
  ]

  timestamps.forEach(function (testcase) {
    var item = testcase[0]
    var expected = testcase[1]

    t.test('encoding ' + item.toString(), function (t) {
      var buf = encoder.encode(item).slice()
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
      for (var j = 2; j < buf.length; j++) {
        t.equal(buf[j], expected[j], 'byte ' + (j - 2) + ' match')
      }
      t.end()
    })

    t.test('decoding ' + item, function (t) {
      var buf = Buffer.from(expected)
      var dt = encoder.decode(buf)
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

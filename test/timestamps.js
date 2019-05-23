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
test('encoding/decoding timestamp 32/64/96', function (t) {
  var encoder = msgpack()
  var encoderThrow = msgpack({ timestamp96ThrowRangeEx: true })
  var timestamps = [
    [new Date('1970-01-01T00:00:00Z'), [0xd6, 0xff, 0x00, 0x00, 0x00, 0x00], false, 'Timestamp 32 - Min'],
    [new Date('2106-02-07T06:28:15Z'), [0xd6, 0xff, 0xff, 0xff, 0xff, 0xff], false, 'Timestamp 32 - Max'],
    [new Date('2018-01-02T03:04:05.000Z'), [0xd6, 0xff, 0x5a, 0x4a, 0xf6, 0xa5], false, 'Timestamp 32'],
    [new Date('2038-01-19T03:14:08.000Z'), [0xd6, 0xff, 0x80, 0x00, 0x00, 0x00], false, 'Timestamp 32'],
    [new Date('2038-01-19T03:14:07.999Z'), [0xd7, 0xff, 0xee, 0x2E, 0x1F, 0x00, 0x7f, 0xff, 0xff, 0xff], false, 'Timestamp 64 - has nano seconds'],
    [new Date('2106-02-07T06:28:16.000Z'), [0xd7, 0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00], false, 'Timestamp 64 - is larger than Timestamp 32 can hold'],
    [new Date('2018-01-02T03:04:05.678Z'), [0xd7, 0xff, 0xa1, 0xa5, 0xd6, 0x00, 0x5a, 0x4a, 0xf6, 0xa5], false, 'Timestamp 64 - has nano seconds2'],
    [new Date('2514-05-30T01:53:04.000Z'), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00], false, 'Timestamp 96 - is larger than TimeStamp 64 can hold for seconds'],
    [new Date('1969-12-31T23:59:59.000Z'), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], false, 'Timestamp 96 - is smaller than TimeStamp 64 can hold for seconds'],
    [new Date(8640000000000000), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0xdb, 0xa8, 0x21, 0x80, 0x00], false, 'Timestamp 96 JavaScript - Max Date (Real Timestamp96)'],
    [new Date(-8640000000000000), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xf8, 0x24, 0x57, 0xde, 0x80, 0x00], false, 'Timestamp 96 JavaScript - Min Date (Real Timestamp96)'],
    [new Date(0), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], true, 'Timestamp 96 - is more precise than TimeStamp 64 can hold for nanoseconds'],
    [new Date(999), [0xc7, 0x0c, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], true, 'Timestamp 96 - invalid nanoseconds e.g. > 999999999'],
    [new Date(8640000000000000), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], true, 'Timestamp 96 JavaScript - Max Date (Max Timestamp96) - should throw error if set, round otherwise'],
    [new Date(-8640000000000000), [0xc7, 0x0c, 0xff, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], true, 'Timestamp 96 JavaScript - Min Date (Min Timestamp96) - should throw error if set, round otherwise']
  ]

  timestamps.forEach(function (testcase) {
    var item = testcase[0]
    var expected = testcase[1]
    var outOfRange = testcase[2]
    var testName = testcase[3] + ': '

    if (outOfRange) {
      // Test decoding with timestamp96ThrowRangeEx = true
      t.test('decoding out of range ' + item, function (t) {
        var buf = Buffer.from(expected)

        t.throws(function () {
          encoderThrow.decode(buf)
        }, encoder.OutOfRangeError, testName + 'must throw OutOfRangeError')

        t.end()
      })
    } else {
      t.test('encoding ' + item.toString(), function (t) {
        var buf = encoder.encode(item).slice()
        t.equal(buf.length, expected.length, testName + 'must have ' + expected.length + ' bytes got ' + buf.length + 'bytes for date ' + item)
        switch (expected.length) {
          case 6:
            t.equal(buf[0], 0xd6, 'must have the correct header')
            t.equal(buf.readInt8(1), -1, testName + 'must have the correct type') // Signed
            break
          case 10:
            t.equal(buf[0], 0xd7, 'must have the correct header')
            t.equal(buf.readInt8(1), -1, testName + 'must have the correct type') // Signed
            break
          case 15:
            t.equal(buf[0], 0xc7, 'must have the correct header')
            t.equal(buf[1], 12, 'must have the correct header')
            t.equal(buf.readInt8(2), -1, testName + 'must have the correct type') // Signed
            break
        }
        for (var j = 2; j < buf.length; j++) {
          t.equal(buf[j], expected[j], testName + 'byte ' + (j - 2) + ' match')
        }
        t.end()
      })

      // Only want to mirror test when comparing values that don't have range issues
      t.test('mirror test ' + item, function (t) {
        t.equal(encoder.decode(encoder.encode(item)) * 1, item * 1, testName + 'must stay the same')
        t.end()
      })
    }

    // Test normal decoding, timestamp96ThrowRangeEx = false (default)
    t.test('decoding ' + item, function (t) {
      var buf = Buffer.from(expected)

      var dt = encoder.decode(buf)
      t.equal(dt * 1, item * 1, testName + 'must decode correctly\nDecoded:\t' + dt * 1 + '\nExp:\t' + item * 1)
      t.end()
    })
  })

  t.end()
})

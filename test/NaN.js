'use strict'

var test = require('tape').test
var msgpack = require('../')

test('encode NaN', function (t) {
  var encoder = msgpack()

  t.throws(function () {
    encoder.encode(NaN)
  }, Error, 'must throw Error')

  t.end()
})

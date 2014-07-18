
var test    = require('tap').test
  , msgpack = require('./')

test('encoding/decoding 7-bit positive ints', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 0; i < 126; i++) {
    allNum.push(i)
  }

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 1, 'must have 1 byte')
      t.equal(buf[0], num, 'must decode correctly');
      t.end()
    })

    t.test('decoding' + num, function(t) {
      var buf = new Buffer([num])
      t.equal(encoder.decode(buf), num, 'must decode correctly');
      t.end()
    })

    t.test('mirror test' + num, function(t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same');
      t.end()
    })
  })

  t.end()
})

test('encode/decode null', function(t) {
  var encoder = msgpack()

  t.equal(encoder.encode(null)[0], 0xc0, 'encode null as 0xc0');
  t.equal(encoder.encode(null).length, 1, 'encode a buffer of length 1');
  t.equal(encoder.decode(new Buffer([0xc0])), null, 'decode 0xc0 as null');
  t.equal(encoder.decode(encoder.encode(null)), null, 'mirror test null');

  t.end()
})

test('encode/decode booleans', function(t) {

  var encoder = msgpack()

  t.equal(encoder.encode(true)[0], 0xc3, 'encode true as 0xc3');
  t.equal(encoder.encode(true).length, 1, 'encode true as a buffer of length 1');
  t.equal(encoder.decode(new Buffer([0xc3])), true, 'decode 0xc3 as true');
  t.equal(encoder.decode(encoder.encode(true)), true, 'mirror test true');

  t.equal(encoder.encode(false)[0], 0xc2, 'encode false as 0xc2');
  t.equal(encoder.encode(false).length, 1, 'encode false as a buffer of length 1');
  t.equal(encoder.decode(new Buffer([0xc2])), false, 'decode 0xc2 as false');
  t.equal(encoder.decode(encoder.encode(false)), false, 'mirror test false');

  t.end()
})

test('encoding/decoding 7-bit ints', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 0; i < 126; i++) {
    allNum.push(i)
  }

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 1, 'must have 1 byte')
      t.equal(buf[0], num, 'must decode correctly');
      t.end()
    })

    t.test('decoding' + num, function(t) {
      var buf = new Buffer([num])
      t.equal(encoder.decode(buf), num, 'must decode correctly');
      t.end()
    })

    t.test('mirror test' + num, function(t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same');
      t.end()
    })
  })

  t.end()
})

test('encoding/decoding 5-bit negative ints', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 1; i < 32; i++) {
    allNum.push(-i)
  }

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 1, 'must have 1 byte')
      t.equal(- (~0xe0 & buf[0]), num, 'must decode correctly');
      t.end()
    })

    t.test('decoding' + num, function(t) {
      var buf = new Buffer([0xe0 | -num])
      t.equal(encoder.decode(buf), num, 'must decode correctly');
      t.end()
    })

    t.test('mirror test' + num, function(t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same');
      t.end()
    })
  })

  t.end()
})

test('encoding/decoding 8-bit integers', function(t) {
  var encoder = msgpack()
    , allNum  = []
    , i

  for (i = 128; i < 256; i++) {
    allNum.push(i)
  }

  allNum.forEach(function(num) {
    t.test('encoding ' + num, function(t) {
      var buf = encoder.encode(num)
      t.equal(buf.length, 2, 'must have 2 bytes')
      t.equal(buf[0], 0xcc, 'must have the proper header');
      t.equal(buf[1], num, 'must decode correctly');
      t.end()
    })

    t.test('decoding ' + num, function(t) {
      var buf = new Buffer([0xcc, num])
      t.equal(encoder.decode(buf), num, 'must decode correctly');
      t.end()
    })

    t.test('mirror test ' + num, function(t) {
      t.equal(encoder.decode(encoder.encode(num)), num, 'must stay the same');
      t.end()
    })
  })

  t.end()
})

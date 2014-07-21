msgpack5&nbsp;&nbsp;[![Build Status](https://travis-ci.org/mcollina/mosca.png)](https://travis-ci.org/mcollina/mosca)
========

A msgpack v5 implementation for node.js, with prototype-based extension points.

This library was built as the data format for
[JSChan](http://npm.im/jschan).

Install
-------

```bash
npm install msgpack5 --save
```

Usage
-----

```js
var msgpack = require('msgpack5')() // namespace our extensions
  , assert  = require('assert')
  , a       = new MyType(2, 'a')
  , encode  = msgpack.encode
  , decode  = msgpack.decode

msgpack.register(0x42, MyType, mytipeEncode, mytipeDecode)

console.log(encode({ 'hello': 'world' }).toString('hex'))
// 81a568656c6c6fa5776f726c64
console.log(decode(encode({ 'hello': 'world' })))
// { hello: 'world' }
console.log(encode(a).toString('hex'))
// d5426161
console.log(decode(encode(a)) instanceof MyType)
// true
console.log(decode(encode(a)))
// { value: 'a', size: 2 }

function MyType(size, value) {
  this.value = value
  this.size  = size
}

function mytipeEncode(obj) {
  var buf = new Buffer(obj.size)
  buf.fill(obj.value)
  return buf
}

function mytipeDecode(data) {
  var result = new MyType(data.length, data.toString('utf8', 0, 1))
    , i

  for (i = 0; i < data.length; i++) {
    if (data.readUInt8(0) != data.readUInt8(i)) {
      throw new Error('should all be the same')
    }
  }

  return result
}
```

Disclaimer
----------

This library is built fully on JS and on [bl](http://npm.im/bl) to
simplify the code. Every improvement that keeps the same API is welcome.

Acknowledgements
----------------

This project was kindly sponsored by [nearForm](http://nearform.com).

License
-------

MIT

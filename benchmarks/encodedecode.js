const msgpack = require('../')()
const msg = { hello: 'world' }
const encode = msgpack.encode
const decode = msgpack.decode
const max = 100000
let i

function run () {
  for (i = 0; i < max; i++) {
    decode(encode(msg))
  }
}

// preheat
run()

const start = Date.now()
run()
const stop = Date.now()
console.log('time', stop - start)
console.log('decode/s', max / (stop - start) * 1000)

const msgpack = require('../')()
const bl = require('bl')
const msg = bl(msgpack.encode({ hello: 'world' }))
const decode = msgpack.decode
const max = 1000000
let i

function run () {
  for (i = 0; i < max; i++) {
    decode(msg.duplicate())
  }
}

// preheat
run()

const start = Date.now()
run()
const stop = Date.now()
console.log('time', stop - start)
console.log('decode/s', max / (stop - start) * 1000)

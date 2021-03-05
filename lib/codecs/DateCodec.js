const type = -1

function encode (dt) {
  if (dt === null) {
    return
  }

  const millis = dt * 1
  const seconds = Math.floor(millis / 1000)
  const nanos = (millis - seconds * 1000) * 1e6

  if (seconds < 0 || seconds > 0x400000000) {
    // Timestamp96
    const encoded = Buffer.allocUnsafe(13)
    encoded[0] = -1

    encoded.writeUInt32BE(nanos, 1)

    let hex = ''
    if (seconds >= 0) {
      const padhex = '0000000000000000'
      hex = seconds.toString(16)
      // add some padding
      hex = padhex.slice(0, hex.length * -1) + hex
    } else {
      // encode seconds in 2's Complement 64Bit
      // reverse sign
      // keep all bits 0 and first 1 from right
      // reverse all other bits
      let bin = (seconds * -1).toString(2)
      let i = bin.length - 1
      while (bin[i] === '0') {
        i--
      }
      bin = bin.slice(0, i).split('').map(function (bit) { return bit === '1' ? 0 : 1 }).join('') + bin.slice(i, bin.length)
      // add some padding
      const pad64 = '1111111111111111111111111111111111111111111111111111111111111111'
      bin = pad64.slice(0, bin.length * -1) + bin
      // convert to hex
      bin.match(/.{1,8}/g).forEach(function (byte) {
        byte = parseInt(byte, 2).toString(16)
        if (byte.length === 1) {
          byte = '0' + byte
        }
        hex += byte
      })
    }
    encoded.write(hex, 5, 'hex')
    return encoded
  } else if (nanos || seconds > 0xffffffff) {
    // Timestamp64
    const encoded = Buffer.allocUnsafe(9)
    encoded[0] = -1

    const upperNanos = nanos * 4
    const upperSeconds = seconds / Math.pow(2, 32)
    const upper = (upperNanos + upperSeconds) & 0xffffffff
    const lower = seconds & 0xffffffff

    encoded.writeInt32BE(upper, 1)
    encoded.writeInt32BE(lower, 5)
    return encoded
  } else {
    // Timestamp32
    const encoded = Buffer.allocUnsafe(5)
    encoded[0] = -1
    encoded.writeUInt32BE(Math.floor(millis / 1000), 1)
    return encoded
  }
}

function check (obj) {
  return typeof obj.getDate === 'function'
}

function decode (buf) {
  let seconds
  let nanoseconds = 0
  let upper
  let lower
  let hex

  switch (buf.length) {
    case 4:
      // timestamp 32 stores the number of seconds that have elapsed since 1970-01-01 00:00:00 UTC in an 32-bit unsigned integer
      seconds = buf.readUInt32BE(0)
      break

    case 8:
      // Timestamp 64 stores the number of seconds and nanoseconds that have elapsed
      // since 1970-01-01 00:00:00 UTC in 32-bit unsigned integers, split 30/34 bits
      upper = buf.readUInt32BE(0)
      lower = buf.readUInt32BE(4)
      nanoseconds = upper / 4
      seconds = ((upper & 0x03) * Math.pow(2, 32)) + lower // If we use bitwise operators, we get truncated to 32bits
      break

    case 12:
      // timestamp 96 stores the number of seconds and nanoseconds that have elapsed
      // since 1970-01-01 00:00:00 UTC in 64-bit signed integer and 32-bit unsigned integer

      // get seconds in hex
      hex = buf.toString('hex', 4, 12)
      // check if seconds is a negative number
      if (parseInt(buf.toString('hex', 4, 6), 16) & 0x80) {
        // convert to binary
        let bin = ''
        const pad8 = '00000000'
        hex.match(/.{1,2}/g).forEach(function (byte) {
          byte = parseInt(byte, 16).toString(2)
          byte = pad8.slice(0, byte.length * -1) + byte
          bin += byte
        })
        // decode seconds from 2's Complement 64Bit
        // reverse all bits
        // reverse sign
        // remove one
        seconds = -1 * parseInt(bin.split('').map(function (bit) { return bit === '1' ? 0 : 1 }).join(''), 2) - 1
      } else {
        seconds = parseInt(hex, 16)
      }

      nanoseconds = buf.readUInt32BE(0)
  }

  const millis = (seconds * 1000) + Math.round(nanoseconds / 1E6)

  return new Date(millis)
}

module.exports = { check, type, encode, decode }

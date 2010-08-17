// Verify that we can read a MsgPack stream.

var assert = require('assert');
var TestStream = require('./util').TestStream;
var strtok = require('../lib/strtok');

var data = '\x25' +                         // fixnum(37)
           '\x6f' +                         // fixnum(11)
           '\xff' +                         // negative_fixnum(-32)
           '\xeb' +                         // negative_fixnum(-12)
           '\xcc\xff' +                     // uint8(255)
           '\xcd\x01\x01' +                 // uint16(257)
           '\xce\x01\x01\x01\x01' +         // uint32(16843009)
           '\x93\x78\x0a\xcc\xef';          // array([120, 10, 239])

// Accumulate a top-level MsgPack value
var valuesSeen = 0;
var accMsgPack = function(v) {
    switch (valuesSeen++) {
    case 0:
        assert.strictEqual(typeof v, 'number');
        assert.equal(v, 37);
        break;

    case 1:
        assert.strictEqual(typeof v, 'number');
        assert.equal(v, 111);
        break;

    case 2:
        assert.strictEqual(typeof v, 'number');
        assert.equal(v, -32);
        break;

    case 3:
        assert.strictEqual(typeof v, 'number');
        assert.equal(v, -12);
        break;

    case 4:
        assert.strictEqual(typeof v, 'number');
        assert.equal(v, 255);
        break;

    case 5:
        assert.strictEqual(typeof v, 'number');
        assert.equal(v, 257);
        break;

    case 6:
        assert.strictEqual(typeof v, 'number');
        assert.equal(v, 16843009);
        break;

    case 7:
        assert.ok(Array.isArray(v));
        assert.equal(v.length, 3);
        assert.deepEqual(v, [120, 10, 239]);
        break;

    default:
        console.error('unexpected value: ' + JSON.stringify(v));
    }
};

strtok.parse(new TestStream(data), (function(acc) {
    // Type that we're in when reading a primitive; MSGPACK_* values
    var type = undefined;

    // Type types; only MsgPack primitives that require reading more than a
    // single octet are represented here
    var MSGPACK_UINT8 = 0;
    var MSGPACK_UINT16 = 1;
    var MSGPACK_UINT32 = 2;

    // Parse a single primitive value, calling acc() as values
    // are accumulated
    return function(v) {
        if (v === undefined) {
            return strtok.UINT8;
        }

        switch (type) {
        case undefined:
            // We're reading the first byte of our type. Either we have a
            // single-byte primitive (we accumulate now), a multi-byte
            // primitive (we set our type and accumulate when we've
            // finished reading the primitive from the stream), or we have a
            // complex type.

            // positive fixnum
            if ((v & 0x80) === 0x0) {
                acc(v);
                break;
            }

            // negative fixnum
            if ((v & 0xe0) === 0xe0) {
                acc(-1 * ((v & ~0xe0) + 1));
                break;
            }

            // uint8
            if (v == 0xcc) {
                type = MSGPACK_UINT8;
                break;
            }

            // uint16
            if (v == 0xcd) {
                type = MSGPACK_UINT16;
                return strtok.UINT16_BE;
            }

            // uint32
            if (v == 0xce) {
                type = MSGPACK_UINT32;
                return strtok.UINT32_BE;
            } 

            // fix array
            if ((v & 0x90) === 0x90) {
                acc = (function(nvals, oldAcc) {
                    var arr = [];

                    return function(v) {
                        arr.push(v);

                        if (arr.length >= nvals) {
                            acc = oldAcc;
                            acc(arr);
                        }
                    };
                })(v & 0x0f, acc);
                break;
            }

            console.error('unexpected type: ' + v + '; aborting');
            return strtok.DONE;

        case MSGPACK_UINT8:
            acc(v);
            type = undefined;
            break;

        case MSGPACK_UINT16:
            acc(v);
            type = undefined;
            break;

        case MSGPACK_UINT32:
            acc(v);
            type = undefined;
            break;
        }

        // We're reading a new primitive; go get it
        return strtok.UINT8;
    };
})(accMsgPack));

process.on('exit', function() {
    assert.equal(valuesSeen, 8);
});

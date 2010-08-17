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
           '\xce\x01\x01\x01\x01';          // uint32(16843009)

// Accumulate a top-level MsgPack value
var valuesSeen = 0;
var accMsgPack = function(v) {
    switch (valuesSeen++) {
    case 0:
        assert.ok(typeof v === 'number');
        assert.equal(v, 37);
        break;

    case 1:
        assert.ok(typeof v === 'number');
        assert.equal(v, 111);
        break;

    case 2:
        assert.ok(typeof v === 'number');
        assert.equal(v, -32);
        break;

    case 3:
        assert.ok(typeof v === 'number');
        assert.equal(v, -12);
        break;

    case 4:
        assert.ok(typeof v === 'number');
        assert.equal(v, 255);
        break;

    case 5:
        assert.ok(typeof v === 'number');
        assert.equal(v, 257);
        break;

    case 6:
        assert.ok(typeof v === 'number');
        assert.equal(v, 16843009);
        break;
    }
};

strtok.parse(new TestStream(data), (function() {
    // State that we're in when reading a primitive; MSGPACK_* values
    var state = undefined;

    var MSGPACK_UINT8 = 0;
    var MSGPACK_UINT16 = 1;
    var MSGPACK_UINT32 = 2;

    return function(v) {
        if (v === undefined) {
            return strtok.UINT8;
        }

        switch (state) {
        case undefined:
            if ((v & 0x80) === 0x0) {
                // Positive fixnum
                accMsgPack(v);
            } else if ((v & 0xe0) === 0xe0) {
                // Negative fixnum
                accMsgPack(-1 * ((v & ~0xe0) + 1));
            } else if (v == 0xcc) {
                // uint8
                assert.ok(state === undefined);
                state = MSGPACK_UINT8;
                return strtok.UINT8;
            } else if (v == 0xcd) {
                // uint16
                assert.ok(state === undefined);
                state = MSGPACK_UINT16;
                return strtok.UINT16_BE;
            } else if (v == 0xce) {
                // uint32
                assert.ok(state === undefined);
                state = MSGPACK_UINT32;
                return strtok.UINT32_BE;
            } else {
                console.error('Unexpected type: ' + v);
            }

            return strtok.UINT8;

        case MSGPACK_UINT8:
            accMsgPack(v);
            state = undefined;
            return strtok.UINT8;

        case MSGPACK_UINT16:
            accMsgPack(v);
            state = undefined;
            return strtok.UINT8;

        case MSGPACK_UINT32:
            accMsgPack(v);
            state = undefined;
            return strtok.UINT8;
        }
    };
})());

process.on('exit', function() {
    assert.equal(valuesSeen, 7);
});

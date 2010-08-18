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
           '\x93\x78\x0a\xcc\xef' +         // fixarray([120, 10, 239])
           '\xc0' +                         // nil
           '\xc3' +                         // true
           '\xc2' +                         // false
           '\xd0\xff' +                     // int8(-1)
           '\xd0\x80' +                     // int8(-128)
           '\xd0\x70' +                     // int8(112)
           '\xd1\xff\xff' +                 // int16(-1)
           '\xd1\x80\x00' +                 // int16(-32768)
           '\xd1\x01\x00' +                 // int16(256)
           '\xd2\x00\x00\x00\x00' +         // int32(0)
           '\xd2\x00\x00\xff\xff' +         // int32(65535)
           '\xd2\x80\x00\x00\x00' +         // int32(-2147483648)
           '\xd2\x80\xff\xff\xff' +         // int32(-2130706433)
           '\xdc\x00\x01\x25' +             // array16([37])
           '\xdc\x00\x03\xff\x25\xcc\xff' + // array16([-32, 37, 255])
           '\xdd\x00\x00\x00\x01\x25' +     // array32([37])
           '\xdd\x00\x00\x00\x03\xff\x25\xcc\xff' + // array32([-32, 37, 255])
           '';

// Accumulate a top-level MsgPack value
var valuesSeen = 0;
var accMsgPack = function(v) {
    switch (valuesSeen++) {
    case 0:
        assert.strictEqual(v, 37);
        break;

    case 1:
        assert.strictEqual(v, 111);
        break;

    case 2:
        assert.strictEqual(v, -32);
        break;

    case 3:
        assert.strictEqual(v, -12);
        break;

    case 4:
        assert.strictEqual(v, 255);
        break;

    case 5:
        assert.strictEqual(v, 257);
        break;

    case 6:
        assert.strictEqual(v, 16843009);
        break;

    case 7:
        assert.ok(Array.isArray(v));
        assert.equal(v.length, 3);
        assert.deepEqual(v, [120, 10, 239]);
        break;

    case 8:
        assert.strictEqual(v, undefined);
        break;

    case 9:
        assert.strictEqual(v, true);
        break;

    case 10:
        assert.strictEqual(v, false);
        break;

    case 11:
        assert.strictEqual(v, -1);
        break;

    case 12:
        assert.strictEqual(v, -128);
        break;

    case 13:
        assert.strictEqual(v, 112);
        break;

    case 14:
        assert.strictEqual(v, -1);
        break;

    case 15:
        assert.strictEqual(v, -32768);
        break;

    case 16:
        assert.strictEqual(v, 256);
        break;

    case 17:
        assert.strictEqual(v, 0);
        break;

    case 18:
        assert.strictEqual(v, 65535);
        break;

    case 19:
        assert.strictEqual(v, -2147483648);
        break;

    case 20:
        assert.strictEqual(v, -2130706433);
        break;

    case 21:
        assert.ok(Array.isArray(v));
        assert.equal(v.length, 1);
        assert.deepEqual(v, [37]);
        break;

    case 22:
        assert.ok(Array.isArray(v));
        assert.equal(v.length, 3);
        assert.deepEqual(v, [-32, 37, 255]);
        break;

    case 23:
        assert.ok(Array.isArray(v));
        assert.equal(v.length, 1);
        assert.deepEqual(v, [37]);
        break;

    case 24:
        assert.ok(Array.isArray(v));
        assert.equal(v.length, 3);
        assert.deepEqual(v, [-32, 37, 255]);
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
    var MSGPACK_INT8 = 3;
    var MSGPACK_INT16 = 4;
    var MSGPACK_INT32 = 5;
    var MSGPACK_ARRAY16 = 6;
    var MSGPACK_ARRAY32 = 7;

    // Return a function for unpacking an array
    var unpackArray = function(nvals, oldAcc) {
        var arr = [];

        return function(v) {
            arr.push(v);

            if (arr.length >= nvals) {
                acc = oldAcc;
                acc(arr);
            }
        };
    };

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
            if ((v & 0x80) == 0x0) {
                acc(v);
                break;
            }

            // negative fixnum
            if ((v & 0xe0) == 0xe0) {
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

            // nil/undefined
            if (v == 0xc0) {
                acc(undefined);
                break;
            }

            // true
            if (v == 0xc3) {
                acc(true);
                break;
            }

            // false
            if (v == 0xc2) {
                acc(false);
                break;
            }

            // int8
            if (v == 0xd0) {
                type = MSGPACK_INT8;
                return strtok.INT8;
            }

            // int16
            if (v == 0xd1) {
                type = MSGPACK_INT16;
                return strtok.INT16_BE;
            }

            // int32
            if (v == 0xd2) {
                type = MSGPACK_INT32;
                return strtok.INT32_BE;
            }

            // fix array
            if ((v & 0xf0) === 0x90) {
                acc = unpackArray(v & 0x0f, acc);
                break;
            }

            // array16
            if (v == 0xdc) {
                type = MSGPACK_ARRAY16;
                return strtok.UINT16_BE;
            }

            // array32
            if (v == 0xdd) {
                type = MSGPACK_ARRAY32;
                return strtok.UINT32_BE;
            }

            console.error('unexpected type: ' + v + '; aborting');
            return strtok.DONE;

        case MSGPACK_UINT8:
        case MSGPACK_UINT16:
        case MSGPACK_UINT32:
        case MSGPACK_INT8:
        case MSGPACK_INT16:
        case MSGPACK_INT32:
            acc(v);
            type = undefined;
            break;

        case MSGPACK_ARRAY16:
        case MSGPACK_ARRAY32:
            acc = unpackArray(v, acc);
            type = undefined;
            break;
        }

        // We're reading a new primitive; go get it
        return strtok.UINT8;
    };
})(accMsgPack));

process.on('exit', function() {
    assert.equal(valuesSeen, 25);
});

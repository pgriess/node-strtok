// Verify that we can read a MsgPack stream.

var assert = require('assert');
var strtok = require('../../lib/strtok');

// Generator function for handing to strtok.parse(); takes an accumulator
// callback to invoke when a top-level type is read from the stream
var parser = function(acc) {
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
    var MSGPACK_RAW = 8;
    var MSGPACK_RAW16 = 9;
    var MSGPACK_RAW32 = 10;
    var MSGPACK_RAW_FINISH = 11;
    var MSGPACK_MAP16 = 12;
    var MSGPACK_MAP32 = 13;

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

    // Return a function for unpacking a map
    var unpackMap = function(nvals, oldAcc) {
        var arr = [];

        return function(v) {
            arr.push(v);

            if (arr.length >= 2 * nvals) {
                var map = {};

                for (var i = 0; i < nvals; i++) {
                    map[arr[2 * i]] = arr[2 * i + 1];
                }

                acc = oldAcc;
                acc(map);
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

            // fixraw
            if ((v & 0xe0) == 0xa0) {
                type = MSGPACK_RAW;
                return new strtok.BufferType(v & ~0xe0)
            }

            // raw16
            if (v == 0xda) {
                type = MSGPACK_RAW16;
                return strtok.UINT16_BE;
            }

            // raw32
            if (v == 0xdb) {
                type = MSGPACK_RAW32;
                return strtok.UINT32_BE;
            }

            // fixmap
            if ((v & 0xf0) == 0x80) {
                acc = unpackMap(v & 0x0f, acc);
                break;
            }

            // map16
            if (v == 0xde) {
                type = MSGPACK_MAP16;
                return strtok.UINT16_BE;
            }

            // map32
            if (v == 0xdf) {
                type = MSGPACK_MAP32;
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
        case MSGPACK_RAW:
        case MSGPACK_RAW_FINISH:
            acc(v);
            type = undefined;
            break;

        case MSGPACK_ARRAY16:
        case MSGPACK_ARRAY32:
            acc = unpackArray(v, acc);
            type = undefined;
            break;

        case MSGPACK_RAW16:
        case MSGPACK_RAW32:
            type = MSGPACK_RAW_FINISH;
            return new strtok.BufferType(v);
            break;

        case MSGPACK_MAP16:
        case MSGPACK_MAP32:
            acc = unpackMap(v, acc);
            type = undefined;
            break;
        }

        // We're reading a new primitive; go get it
        return strtok.UINT8;
    };
};
exports.parser = parser;

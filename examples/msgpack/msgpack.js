// Verify that we can read a MsgPack stream.

var assert = require('assert');
var Buffer = require('buffer').Buffer;
var strtok = require('../../lib/strtok');

// Generator function for handing to strtok.parse(); takes an accumulator
// callback to invoke when a top-level type is read from the stream
var strtokParser = function(acc) {
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

    // Unpack a binary string
    var rawStringType = new strtok.StringType(0, 'binary');

    // Return a function for unpacking an array
    var unpackArray = function(nvals, oldAcc) {
        var arr = [];

        if (nvals === 0) {
            acc(arr);
            return oldAcc;
        }

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
        var o = {};
        var k = undefined;
        var numKeys = 0;

        if (nvals === 0) {
            acc(o);
            return oldAcc;
        }

        return function(v) {
            if (k === undefined) {
                k = v;
                return;
            }

            o[k] = v;
            k = undefined;

            if (++numKeys === nvals) {
                acc = oldAcc;
                acc(o);
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
                acc(-1 * (~v & 0xff) - 1);
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

            // null/undefined
            if (v == 0xc0) {
                acc(null);
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
                rawStringType.len = v & ~0xe0;
                return rawStringType;
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
            rawStringType.len = v;
            return rawStringType;

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
exports.strtokParser = strtokParser;

// Write the length component of a 'raw' type
var writeRawLength = function(b, bo, l) {
    if (l <= 31) {
        // fixraw
        strtok.UINT8.put(b, bo, 0xa0 | l);
        return 1;
    } else if (l <= 0xffff) {
        // raw16
        strtok.UINT8.put(b, bo, 0xda);
        strtok.UINT16_BE.put(b, bo + 1, l);
        return 3;
    } else if (l <= 0xffffffff) {
        // raw32
        strtok.UINT8.put(b, bo, 0xdb);
        strtok.UINT32_BE.put(b, bo + 1, l);
        return 5;
    } else {
        throw new Error('Raw too large for serialization!');
    }
}

// Pack an object to the given buffer; returns # bytes written
var packBuf = function(b, bo, v) {
    bo = (bo === undefined) ? 0 : bo;
    v = (v === null) ? undefined : v;

    switch (typeof v) {
    case 'undefined':
        strtok.UINT8.put(b, bo, 0xc0);
        return 1;

    case 'boolean':
        strtok.UINT8.put(b, bo, (v) ? 0xc3 : 0xc2);
        return 1;

    case 'number':
        if (v >= 0) {
            // positive fixnum
            if (v <= 127) {
                strtok.UINT8.put(b, bo, v);
                return 1;
            } 
          
            // uint8
            if (v <= 0xff) {
                strtok.UINT8.put(b, bo, 0xcc);
                strtok.UINT8.put(b, bo + 1, v);
                return 2;
            }

            // uint16
            if (v <= 0xffff) {
                strtok.UINT8.put(b, bo, 0xcd);
                strtok.UINT16_BE.put(b, bo + 1, v);
                return 3;
            }
           
            // uint32
            if (v <= 0xffffffff) {
                strtok.UINT8.put(b, bo, 0xce);
                strtok.UINT32_BE.put(b, bo + 1, v);
                return 5;
            }
        } else {
            // negative fixnum
            if (v >= -32) {
                strtok.UINT8.put(b, bo, v & 0xff);
                return 1;
            }
           
            // int8
            if (v >= -128) {
                strtok.UINT8.put(b, bo, 0xd0);
                strtok.INT8.put(b, bo + 1, v);
                return 2;
            }

            // int16
            if (v >= -32768) {
                strtok.UINT8.put(b, bo, 0xd1);
                strtok.INT16_BE.put(b, bo + 1, v);
                return 3;
            }

            // int32
            if (v >= -2147483648) {
                strtok.UINT8.put(b, bo, 0xd2);
                strtok.INT32_BE.put(b, bo + 1, v);
                return 5;
            }
        }

        throw new Error('Cannot handle 64-bit numbers');
   
    case 'object':
        var len = 0;

        if (Array.isArray(v)) {
            if (v.length <= 15) {
                // fix array
                strtok.UINT8.put(b, bo, 0x90 | v.length);
                len = 1;
            } else if (v.length <= 0xffff) {
                // array16
                strtok.UINT8.put(b, bo, 0xdc);
                strtok.UINT16_BE.put(b, bo + 1, v.length);
                len = 3;
            } else if (v.length <= 0xffffffff) {
                // array32
                strtok.UINT8.put(b, bo, 0xdd);
                strtok.UINT32_BE.put(b, bo + 1, v.length);
                len = 5;
            } else {
                throw new Error('Array too large for serialization!');
            }

            v.forEach(function(vv) {
                len += packBuf(b, bo + len, vv);
            });
        } else if (v instanceof Buffer) {
            var len = writeRawLength(b, bo, v.length);
            v.copy(b, bo + len, 0, v.length);
            len += v.length;
        } else {
            var vk = Object.keys(v);
            if (vk.length <= 15) {
                // fixmap
                strtok.UINT8.put(b, bo, 0x80 | vk.length);
                len = 1;
            } else if (vk.length <= 0xffff) {
                // map16
                strtok.UINT8.put(b, bo, 0xde);
                strtok.UINT16_BE.put(b, bo + 1, vk.length);
                len = 3;
            } else if (vk.length <= 0xffffffff) {
                // map32
                strtok.UINT8.put(b, bo, 0xdf);
                strtok.UINT32_BE.put(b, bo + 1, vk.length);
                len = 5;
            } else {
                throw new Error('Object too large for serialization!');
            }

            vk.forEach(function(k) {
                len += packBuf(b, bo + len, k);
                len += packBuf(b, bo + len, v[k]);
            });
        }

        return len;

    case 'string':
        var len = 0;

        len += writeRawLength(b, bo, Buffer.byteLength(v, 'utf-8'));
        len += b.write(v, bo + len, 'utf-8');

        return len;

    default:
        throw new Error('Cannot handle object of type ' + typeof v);
    }
};
exports.packBuf = packBuf;

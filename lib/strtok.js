// A fast streaming parser library.

var assert = require('assert');
var Buffer = require('buffer').Buffer;

// Sentinel types

var DEFER = {};
exports.DEFER = DEFER;

var DONE = {};
exports.DONE = DONE;

// Primitive types

var UINT8 = {
    len : 1,
    get : function(buf) {
        return buf[0];
    }
};
exports.UINT8 = UINT8;

var UINT16_LE = {
    len : 2,
    get : function(buf) {
        return buf[0] | (buf[1] << 8);
    }
};
exports.UINT16_LE = UINT16_LE;

var UINT16_BE = {
    len : 2,
    get : function(buf) {
        return (buf[0] << 8) | buf[1];
    }
};
exports.UINT16_BE = UINT16_BE;

var UINT32_LE = {
    len : 4,
    get : function(buf) {
        return buf[0] | (buf[1] << 8) |
               (buf[2] << 16) | (buf[3] << 24);
    }
};
exports.UINT32_LE = UINT32_LE;

var UINT32_BE = {
    len : 4,
    get : function(buf) {
        return (buf[0] << 24) | (buf[1] << 16) |
               (buf[2] << 8) | buf[3];
    }
};
exports.UINT32_BE = UINT32_BE;

var INT8 = {
    len : 1,
    get : function(buf)  {
        var v = UINT8.get(buf);
        return ((v & 0x80) === 0x80) ?
            (-128 + (v & 0x7f)) :
            v;
    }
};
exports.INT8 = INT8;

var INT16_BE = {
    len : 2,
    get : function(buf)  {
        var v = UINT16_BE.get(buf);
        return ((v & 0x8000) === 0x8000) ?
            (-32768 + (v & 0x7fff)) :
            v;
    }
};
exports.INT16_BE = INT16_BE;

var INT32_BE = {
    len : 4,
    get : function(buf)  {
        var v = UINT32_BE.get(buf);
        return ((v & 0x80000000) === 0x80000000) ?
            (-2147483648 + (v & 0x7fffffff)) :
            v;
    }
};
exports.INT32_BE = INT32_BE;

// Complex types

var BufferType = function(l) {
    var self = this;

    self.len = l;

    self.get = function(buf) {
        return buf.slice(0, this.len);
    };
};
exports.BufferType = BufferType;

// Parse a stream
var parse = function(s, cb) {
    // Type of data that we're to parse next; if DEFER, we're awaiting
    // an invocation of typeCallback
    var type = DEFER;

    // Data that we've seen but not yet processed / handed off to cb; first
    // valid byte to process is always bufs[0][0]
    var bufs = [];
    var bufsLen = 0;

    // Callback for FSM to tell us what type to expect next
    var typeCallback = function(t) {
        if (type !== DEFER) {
            throw new Error('refusing to overwrite non-DEFER type');
        }

        type = t;

        emitData();
    };

    // Process data that we have accumulated so far, emitting any type(s)
    // collected. This is the main parsing loop.
    //
    // Out strategy for handling buffers is to shift them off of the bufs[]
    // array until we have enough accumulated to account for type.len bytes.
    // If there are any bytes left over in the last buffer that we saw, slice
    // off a new buffer and prepend it to our bufs[] array so that our
    // buf[0][0] invariant is maintained.
    var emitData = function() {
        while (type !== DONE && type !== DEFER && bufsLen >= type.len) {
            var b = bufs.shift();

            if (b.length < type.len) {
                bufs.unshift(b);

                b = new Buffer(type.len);

                var bytesCopied = 0;
                while (bytesCopied < type.len && bufs.length > 0) {
                    var bb = bufs.shift();
                    var copied = bb.copy(
                        b,
                        bytesCopied,
                        0,
                        Math.min(type.len - bytesCopied, bb.length)
                    );

                    bytesCopied += copied;

                    if (copied < bb.length) {
                        assert.equal(bytesCopied, type.len);
                        bufs.unshift(bb.slice(copied, bb.length));
                    }
                }

                assert.equal(bytesCopied, type.len);
            } else if (b.length > type.len) {
                bufs.unshift(b.slice(type.len, b.length));
            }

            bufsLen -= type.len;
            type = cb(type.get(b), typeCallback);
        }

        if (type === DONE) {
            s.removeListener('data', dataListener);
        }
    };

    // Listen for data from our stream
    var dataListener = function(d) {
        bufs.push(d);
        bufsLen += d.length;

        emitData();
    };

    // Get the initial type
    type = cb(undefined, typeCallback);
    if (type !== DONE) {
        s.on('data', dataListener);
    }
};
exports.parse = parse;

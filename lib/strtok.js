// A fast streaming parser library.

var assert = require('assert');
var Buffer = require('buffer').Buffer;

// Map of decimal values to single-byte strings
var BYTES = (function() {
    var a = [];
    for (var i = 0; i < 256; i++) {
        a[i] = i;
    }
    return new Buffer(a).toString('binary');
})();

// Sentinel types

var DEFER = {};
exports.DEFER = DEFER;

var DONE = {};
exports.DONE = DONE;

// Primitive types

var UINT8 = {
    len : 1,
    get : function(buf, off) {
        return buf[off];
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= 0 && v <= 0xff);

        s.write(BYTES[v & 0xff], 'binary');
    }
};
exports.UINT8 = UINT8;

var UINT16_LE = {
    len : 2,
    get : function(buf, off) {
        return buf[off] | (buf[off + 1] << 8);
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= 0 && v <= 0xffff);

        s.write(BYTES[v & 0xff] + BYTES[(v >>> 8) & 0xff], 'binary');
    }
};
exports.UINT16_LE = UINT16_LE;

var UINT16_BE = {
    len : 2,
    get : function(buf, off) {
        return (buf[off] << 8) | buf[off + 1];
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= 0 && v <= 0xffff);

        s.write(BYTES[(v >>> 8) & 0xff] + BYTES[v & 0xff], 'binary');
    }
};
exports.UINT16_BE = UINT16_BE;

var UINT32_LE = {
    len : 4,
    get : function(buf, off) {
        // Shifting the MSB by 24 directly causes it to go negative if its
        // last bit is high, so we instead shift by 23 and multiply by 2.
        // Also, using binary OR to count the MSB if its last bit is high
        // causes the value to go negative. Use addition there.
        return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16)) +
               ((buf[off + 3] << 23) * 2);
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= 0 && v <= 0xffffffff);

        s.write(
            BYTES[v & 0xff] + BYTES[(v >>> 8) & 0xff] +
                BYTES[(v >>> 16) & 0xff] + BYTES[(v >>> 24) & 0xff],
            'binary'
        );
    }
};
exports.UINT32_LE = UINT32_LE;

var UINT32_BE = {
    len : 4,
    get : function(buf, off) {
        // See comments in UINT32_LE.get()
        return ((buf[off] << 23) * 2) +
               ((buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]);
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= 0 && v <= 0xffffffff);

        s.write(
            BYTES[(v >>> 24) & 0xff] + BYTES[(v >>> 16) & 0xff] +
                BYTES[(v >>> 8) & 0xff] + BYTES[v & 0xff],
            'binary'
        );
    }
};
exports.UINT32_BE = UINT32_BE;

var INT8 = {
    len : 1,
    get : function(buf, off)  {
        var v = UINT8.get(buf, off);
        return ((v & 0x80) === 0x80) ?
            (-128 + (v & 0x7f)) :
            v;
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= -128 && v <= 127);
        UINT8.put(s, v & 0xff);
    }
};
exports.INT8 = INT8;

var INT16_BE = {
    len : 2,
    get : function(buf, off)  {
        var v = UINT16_BE.get(buf, off);
        return ((v & 0x8000) === 0x8000) ?
            (-32768 + (v & 0x7fff)) :
            v;
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= -32768 && v <= 32767);
        UINT16_BE.put(s, v & 0xffff);
    }
};
exports.INT16_BE = INT16_BE;

var INT32_BE = {
    len : 4,
    get : function(buf, off)  {
        // We cannot check for 0x80000000 directly, as this always returns
        // false. Instead, check for the two's-compliment value, which
        // behaves as expected. Also, we cannot subtract our value all at
        // once, so do it in two steps to avoid sign busting.
        var v = UINT32_BE.get(buf, off);
        return ((v & 0x80000000) === -2147483648) ?
            ((v & 0x7fffffff) - 1073741824 - 1073741824) :
            v;
    },
    put : function(s, v) {
        assert.equal(typeof v, 'number');
        assert.ok(v >= -2147483648 && v <= 2147483647);
        // Write out as two UINT16_BEs to avoid sign problems. If done this
        // way, the shift seems to operate on an unsigned value.
        UINT16_BE.put(s, (v >>> 16) & 0xffff);
        UINT16_BE.put(s, v & 0xffff);
    }
};
exports.INT32_BE = INT32_BE;

// Complex types
//
// These types are intended to allow callers to re-use them by manipulating
// the 'len' and other properties directly.

var BufferType = function(l) {
    var self = this;

    self.len = l;

    self.get = function(buf, off) {
        return buf.slice(off, off + this.len);
    };
};
exports.BufferType = BufferType;

var StringType = function(l, e) {
    var self = this;

    self.len = l;

    self.encoding = e;

    self.get = function(buf, off) {
        return buf.toString(e, off, off + this.len);
    };
};
exports.StringType = StringType;

// Parse a stream
var parse = function(s, cb) {
    // Type of data that we're to parse next; if DEFER, we're awaiting
    // an invocation of typeCallback
    var type = DEFER;

    // Data that we've seen but not yet processed / handed off to cb; first
    // valid byte to process is always bufs[0][bufOffset]
    var bufs = [];
    var bufsLen = 0;
    var bufOffset = 0;

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
    var emitData = function() {
        while (type !== DONE && type !== DEFER && bufsLen >= type.len) {
            var b = bufs[0];
            var bo = bufOffset;

            assert.ok(bufOffset >= 0 && bufOffset < b.length);

            if ((b.length - bufOffset) < type.len) {
                b = new Buffer(type.len);
                bo = 0;

                var bytesCopied = 0;
                while (bytesCopied < type.len && bufs.length > 0) {
                    var bb = bufs[0];
                    var copied = bb.copy(
                        b,
                        bytesCopied,
                        bufOffset,
                        bufOffset + Math.min(type.len - bytesCopied, bb.length - bufOffset)
                    );

                    bytesCopied += copied;

                    if (copied < (bb.length - bufOffset)) {
                        assert.equal(bytesCopied, type.len);
                        bufOffset += copied;
                    } else {
                        assert.equal(bufOffset + copied, bb.length);
                        bufs.shift();
                        bufOffset = 0;
                    }
                }

                assert.equal(bytesCopied, type.len);
            } else if ((b.length - bufOffset) === type.len) {
                bufs.shift();
                bufOffset = 0;
            } else {
                bufOffset += type.len;
            }

            bufsLen -= type.len;
            type = cb(type.get(b, bo), typeCallback);
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

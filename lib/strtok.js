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
    // byte for 'type' always at 0
    var buf = undefined;

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
    var emitData = function() {
        while (type !== DONE && type !== DEFER && buf.length >= type.len) {
            var v = type.get(buf);

            buf = buf.slice(type.len, buf.length);
            type = cb(v, typeCallback);
        }

        if (type === DONE) {
            s.removeListener('data', dataListener);
        }
    };

    // Listen for data from our stream
    var dataListener = function(d) {
        // Coalesce seen data
        //
        // XXX: This is kind of a bummer. We should ideally not be copying data
        //      around unncessarily, but crossing boundaries is irritating.
        if (buf) {
            var b = new Buffer(buf.length + d.length);
            buf.copy(b, 0, 0);
            d.copy(b, buf.length, 0);

            buf = b;
        } else {
            buf = d;
        }

        emitData();
    };

    // Get the initial type
    type = cb(undefined, typeCallback);
    if (type !== DONE) {
        s.on('data', dataListener);
    }
};
exports.parse = parse;

// A fast streaming parser library.

var assert = require('assert');
var Buffer = require('buffer').Buffer;

// Definition for all primitive types; contents are used to generate other
// data structures for easier use
//
// Each type has
//
//  - a human-readable name
//  - a length
//  - an implicit ID (its index in this array)
var TYPETAB = [
    { name : 'DEFER', len : 0 },
    { name : 'DONE', len : 0 },
    { name : 'UINT8_LE', len : 1 },
    { name : 'UINT8_BE', len : 1 },
    { name : 'UINT16_LE', len : 2 },
    { name : 'UINT16_BE', len : 2 }
];

// Map of type names to IDs
var typesMap = (function() {
    var m = {};
    for (var i = 0; i < TYPETAB.length; i++) {
        var t = TYPETAB[i];

        m[t.name] = i;
    }

    return m;
})();
exports.Types = typesMap;

// Parse a stream
var parse = function(s, cb) {
    // Type of data that we're to parse next; if DEFER, we're awaiting
    // an invocation of typeCallback
    var type = typesMap.DEFER;
    
    // Data that we've seen but not yet processed / handed off to cb; first
    // byte for 'type' always at 0
    var buf = undefined;

    // Callback for FSM to tell us what type to expect next
    var typeCallback = function(t) {
        if (type !== typesMap.DEFER) {
            throw new Error('refusing to overwrite non-DEFER type');
        }

        type = t;

        emitData();
    };

    // Process data that we have accumulated so far, emitting any type(s)
    // collected. This is the main parsing loop.
    var emitData = function() {
        while (type != typesMap.DONE &&
               type != typesMap.DEFER &&
               buf.length >= TYPETAB[type].len) {
            var v = undefined;

            switch (type) {
            case typesMap.UINT8_LE:
            case typesMap.UINT8_BE:
                v = buf[0];
                break;

            case typesMap.UINT16_LE:
                v = buf[0] | (buf[1] << 8);
                break;

            case typesMap.UINT16_BE:
                v = (buf[0] << 8) | buf[1];
                break;

            default:
                console.error('don\'t know how to handle type: ' + type);
                // XXX: not handling this correctly
                return;
            }

            buf = buf.slice(TYPETAB[type].len, buf.length);
            type = cb(v, typeCallback);
            if (!(type >= 0 && type < TYPETAB.length)) {
                console.error('invalid type returned: ' + type + '; aborting');
                type = typesMap.DONE;
            }
        }

        if (type === typesMap.DONE) {
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
    if (!(type >= 0 && type < TYPETAB.length)) {
        throw new Error('invalid type returned from initial callback');
    }

    s.on('data', dataListener);
};
exports.parse = parse;

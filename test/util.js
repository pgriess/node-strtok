// Utilies for testing

var assert = require('assert');
var Buffer = require('buffer').Buffer;
var EventEmitter = require('events').EventEmitter;
var strtok = require('../lib/strtok');
var sys = require('sys');

// A mock stream implementation that breaks up provided data into
// random-sized chunks and emits 'data' events. This is used to simulate
// data arriving with arbitrary packet boundaries.
var TestStream = function(str, min, max) {
    EventEmitter.call(this);

    str = str || '';
    min = min || 1;
    max = max || str.length;

    var self = this;
    var buf = new Buffer(str, 'binary');

    var emitData = function() {
        var len = Math.min(
            min + Math.floor(Math.random() * (max - min)),
            buf.length
        );

        var b = buf.slice(0, len);

        if (len < buf.length) {
            buf = buf.slice(len, buf.length);
            process.nextTick(emitData);
        } else {
            process.nextTick(function() {
                self.emit('end')
            });
        }

        self.emit('data', b);
    };

    process.nextTick(emitData);
};
sys.inherits(TestStream, EventEmitter);
exports.TestStream = TestStream;

// Run the given stream (or string, coverted into a TestStream) through
// strtok,parse() and verify types that come back using the given state
// table.
var runTest = function(s, stateTab) {
    if (typeof s === 'string') {
        s = new TestStream(s);
    }

    assert.equal(typeof s, 'object');
    
    var state = 0;

    process.on('exit', function() {
        assert.equal(stateTab.length, state);
    });

    strtok.parse(s, function(v, cb) {
        assert.ok(state >= 0 && state < stateTab.length);
        return stateTab[state++](v, cb);
    });
};
exports.runTest = runTest;

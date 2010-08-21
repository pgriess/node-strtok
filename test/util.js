// Utilies for testing

var assert = require('assert');
var Buffer = require('buffer').Buffer;
var EventEmitter = require('events').EventEmitter;
var strtok = require('../lib/strtok');
var sys = require('sys');

// A mock stream implementation that breaks up provided data into
// random-sized chunks and emits 'data' events. This is used to simulate
// data arriving with arbitrary packet boundaries.
var SourceStream = function(str, min, max) {
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
sys.inherits(SourceStream, EventEmitter);
exports.SourceStream = SourceStream;

// Stream to accept write() calls and track them in its own buffer rather
// than dumping them to a file descriptor
var SinkStream = function(bufSz) {
    var self = this;

    bufSz = bufSz || 1024;
    var buf = new Buffer(bufSz);
    var bufOffset = 0;

    self.write = function() {
        var bl = (typeof arguments[0] === 'string') ?
            Buffer.byteLength(arguments[0], arguments[1]) :
            arguments[0].length;

        if (bufOffset + bl >= buf.length) {
            var b = new Buffer(((bufOffset + bl + bufSz - 1) / bufSz) * bufSz);
            buf.copy(b, 0, 0, bufOffset);
            buf = b;
        }

        if (typeof arguments[0] === 'string') {
            buf.write(arguments[0], bufOffset, arguments[1]);
        } else {
            arguments[0].copy(buf, bufOffset, 0, arguments[0].length);
            bufOffset += arguments[0].length;
        }

        bufOffset += bl;
    };

    self.getBuffer = function() {
        var b = new Buffer(bufOffset);
        buf.copy(b, 0, 0, bufOffset);

        return b;
    };
};
exports.SinkStream = SinkStream;

// Run the given stream (or string, coverted into a SourceStream) through
// strtok,parse() and verify types that come back using the given state
// table.
var runParseTests = function(s, stateTab) {
    if (typeof s === 'string') {
        s = new SourceStream(s);
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
exports.runParseTests = runParseTests;

// Run a series of tests that generate data and verify the resulting output.
//
// Each argument is a different test, and should be an array of length two
// whose first element is a function and second element is a string
// representing the expected outcome.
var runGenerateTests = function() {
    for (var i = 0; i < arguments.length; i++) {
        var s = new SinkStream();
        arguments[i][0](s);
        assert.strictEqual(
            s.getBuffer().toString('binary'),
            arguments[i][1]
        );
    };
};
exports.runGenerateTests = runGenerateTests;

// Verify that the DONE value is respected.

var assert = require('assert');
var TestStream = require('./util').TestStream;
var strtok = require('../lib/strtok');

var seen = 0;
var data = '\x1a\x1a\x1a\x1a\x1a\x1a';

strtok.parse(new TestStream(data), function(v) {
    if (v === undefined) {
        return strtok.UINT8_LE;
    }

    seen++;
    return strtok.DONE;
});

process.on('exit', function() {
    assert.equal(1, seen);
});

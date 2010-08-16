// Test reading an array of bytes.

var assert = require('assert');
var TestStream = require('./util').TestStream;
var strtok = require('../lib/strtok');

var state = 0;

strtok.parse(new TestStream('\x05peter'), function(v) {
    if (v === undefined) {
        return strtok.UINT8_BE;
    }

    switch (state) {
    case 0:
        state = 1;
        return new strtok.BufferType(v);

    case 1:
        state = 2;
        assert.ok(typeof v === 'object');
        assert.equal(v.toString('utf-8'), 'peter');
        return strtok.DONE;
    }
});

process.on('exit', function() {
    assert.equal(2, state);
});

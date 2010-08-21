// Benchmark unpacking performance of node-strtok vs. node-msgpack

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var nodeMsgpack = require('msgpack');
var strtok = require('../../lib/strtok');
var strtokMsgpack = require('./msgpack');
var sys = require('sys');

var NUM_OBJS = 100000;

var o = {'abcdef' : 1, 'qqq' : 13, '19' : [1, 2, 3, 4]};
// var o = [1, 2, 3, 4, 5, 6, 7, 8, [1, 2, 3, 4, 5, 6, 7, 8]];
// var o = {'abcdef' : 1};
var buf = nodeMsgpack.pack(o);

var StaticStream = function() {
    EventEmitter.call(this);
};
sys.inherits(StaticStream, EventEmitter);

var f = function(i, useNative, cb) {
    if (i >= NUM_OBJS) {
        cb();
        return;
    }

    s = new StaticStream();
    if (useNative) {
        s.on('data', function(b) {
            var v = nodeMsgpack.unpack(b);
            // assert.deepEqual(v, o);
            f(i + 1, useNative, cb);
        });
    } else {
        strtok.parse(
            s,
            strtokMsgpack.parser(function(v) {
                // assert.deepEqual(v, o);
                f(i + 1, useNative, cb);
            })
        );
    }
    process.nextTick(function() {
        s.emit('data', buf);
        s.emit('end');
    });
};

var g = function(useNative) {
    var d = Date.now();

    return function() {
        console.log(((useNative) ? 'native: ' : 'js:     ') + (Date.now() - d) + 'ms');

        if (useNative) {
            f(0, !useNative, g(!useNative));
        }
    };
};

f(0, true, g(true));

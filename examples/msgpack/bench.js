// Benchmark unpacking performance of node-strtok vs. node-msgpack

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var nodeMsgpack = require('msgpack');
var strtok = require('../../lib/strtok');
var strtokMsgpack = require('./msgpack');
var sys = require('sys');
var util = require('../../test/util');

var NUM_OBJS = 100000;

var o = {'abcdef' : 1, 'qqq' : 13, '19' : [1, 2, 3, 4]};
// var o = [1, 2, 3, 4, 5, 6, 7, 8, [1, 2, 3, 4, 5, 6, 7, 8]];
// var o = {'abcdef' : 1};
var buf = nodeMsgpack.pack(o);

var StaticStream = function() {
    EventEmitter.call(this);
};
sys.inherits(StaticStream, EventEmitter);

var ss = new util.SinkStream();

var pack_f = function(i, useNative, cb) {
    if (i >= NUM_OBJS) {
        cb();
        return;
    }

    ss.reset();

    if (useNative) {
        var b = nodeMsgpack.pack(o);
        // assert.deepEqual(b.toString('binary'), buf.toString('binary'));
    } else {
        strtokMsgpack.generator(ss, o);
        // assert.deepEqual(s.getString(), buf.toString('binary'));
    }

    process.nextTick(function() {
        pack_f(i + 1, useNative, cb);
    });
};

var pack_g = function(useNative) {
    var d = Date.now();

    return function() {
        console.log('pack ' + ((useNative) ? 'native: ' : 'js:     ')
            + (Date.now() - d) + 'ms');

        if (useNative) {
            pack_f(0, !useNative, pack_g(!useNative));
        } else {
            unpack_f(0, true, unpack_g(true));
        }
    }
};

var unpack_f = function(i, useNative, cb) {
    if (i >= NUM_OBJS) {
        cb();
        return;
    }

    s = new StaticStream();
    if (useNative) {
        s.on('data', function(b) {
            var v = nodeMsgpack.unpack(b);
            // assert.deepEqual(v, o);
            unpack_f(i + 1, useNative, cb);
        });
    } else {
        strtok.parse(
            s,
            strtokMsgpack.parser(function(v) {
                // assert.deepEqual(v, o);
                unpack_f(i + 1, useNative, cb);
            })
        );
    }
    process.nextTick(function() {
        s.emit('data', buf);
        s.emit('end');
    });
};

var unpack_g = function(useNative) {
    var d = Date.now();

    return function() {
        console.log('unpack ' + ((useNative) ? 'native: ' : 'js:     ')
            + (Date.now() - d) + 'ms');

        if (useNative) {
            unpack_f(0, !useNative, unpack_g(!useNative));
        }
    };
};

pack_f(0, true, pack_g(true));

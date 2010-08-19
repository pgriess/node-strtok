// Benchmark unpacking performance of node-strtok vs. node-msgpack

var EventEmitter = require('events').EventEmitter;
var nodeMsgpack = require('msgpack');
var strtok = require('../../lib/strtok');
var strtokMsgpack = require('./msgpack');
var sys = require('sys');

var USE_NODE_MSGPACK = false;
var NUM_OBJS = 50000;

var o = {'abcdef' : 1, 'qqq' : 13, '19' : [1, 2, 3, 4]};
var buf = nodeMsgpack.pack(o);

var StaticStream = function() {
    EventEmitter.call(this);
};
sys.inherits(StaticStream, EventEmitter);

var f = function(i) {
    if (i >= NUM_OBJS) {
        return;
    }

    s = new StaticStream();
    if (USE_NODE_MSGPACK) {
        s.on('data', function(b) {
            nodeMsgpack.unpack(b);

            f(i + 1);
        });
    } else {
        strtok.parse(
            s,
            strtokMsgpack.parser(function(v) {
                f(i + 1);
            })
        );
    }
    process.nextTick(function() {
        s.emit('data', buf);
        s.emit('end');
    });
};

f(0);

'use strict';
var assert = require('assert');
var cachingStream = require('./');
var through2 = require('through2');

var input;
var copy1;
var copy2;
var cacheCtrl;

beforeEach(function () {
	input = through2();
	cacheCtrl = cachingStream();
	copy1 = copyStream();
	copy2 = copyStream();
});

function pipeTo1() {
	input
		.pipe(cacheCtrl)
		.pipe(copy1);

	input.push('foo');
	input.push('bar');
}

function baseTest(done) {
	pipeTo1();

	setTimeout(function () {
		assert.strictEqual(copy1.toString(), 'foobar');
		cacheCtrl.makeCopyStream().pipe(copy2);
		setTimeout(function () {
			assert.strictEqual(copy2.toString(), 'foobar');
			done();
		});
	});
}

function runBase(fn) {
	return function (done) {
		baseTest(function (err) {
			if (err) {
				return done(err);
			}
			fn(done);
		});
	};
}

it('baseTest ', baseTest);

it('ending input ends both other streams', runBase(function (done) {
	assert(!copy1.isEnded);
	assert(!copy2.isEnded);
	input.end('baz');
	setTimeout(function () {
		assert.strictEqual(copy1.toString(), 'foobarbaz');
		assert.strictEqual(copy2.toString(), 'foobarbaz');
		assert(copy1.isEnded);
		assert(copy2.isEnded);
		done();
	});
}));

it('dropCache will not end the stream if already created', runBase(function (done) {
	cacheCtrl.dropCache();
	setTimeout(function () {
		assert(!copy1.isEnded);
		assert(!copy2.isEnded);
		input.end('baz');
		setTimeout(function () {
			assert.strictEqual(copy1.toString(), 'foobarbaz');
			assert.strictEqual(copy2.toString(), 'foobarbaz');
			assert(copy1.isEnded);
			assert(copy2.isEnded);
			done();
		});
	});
}));

it('dropCache(true) will end only the cache stream', runBase(function (done) {
	cacheCtrl.dropCache(true);
	setTimeout(function () {
		assert(!copy1.isEnded);
		assert(copy2.isEnded);
		input.end('baz');
		setTimeout(function () {
			assert.strictEqual(copy1.toString(), 'foobarbaz');
			assert.strictEqual(copy2.toString(), 'foobar');
			assert(copy1.isEnded);
			assert(copy2.isEnded);
			done();
		});
	});
}));

it('endOutput', runBase(function (done) {
	cacheCtrl.endOutput();
	setTimeout(function () {
		assert(copy1.isEnded);
		assert(!copy2.isEnded);
		input.end('baz');
		setTimeout(function () {
			assert.strictEqual(copy1.toString(), 'foobar');
			assert.strictEqual(copy2.toString(), 'foobarbaz');
			assert(copy1.isEnded);
			assert(copy2.isEnded);
			done();
		});
	});
}));

it('cache can be attached after the first stream has ended', function (done) {
	pipeTo1();
	input.end();
	setTimeout(function () {
		assert(copy1.isEnded);
		assert(!copy2.isEnded);
		assert.strictEqual(copy1.toString(), 'foobar');
		assert.strictEqual(copy2.toString(), '');
		cacheCtrl.makeCopyStream().pipe(copy2);
		setTimeout(function () {
			assert(copy2.isEnded);
			assert.strictEqual(copy2.toString(), 'foobar');
			done();
		});
	});
});

it('makeCachedStream throws if already created ', function () {
	cacheCtrl.makeCopyStream();
	assert.throws(function () {
		cacheCtrl.makeCopyStream();
	}, /already created/);
});

it('makeCachedStream throws if already dropped ', function () {
	cacheCtrl.dropCache();
	assert.throws(function () {
		cacheCtrl.makeCopyStream();
	}, /dropped/);
});

function copyStream(copy) {
	copy = copy !== false;
	var cache = [];
	var ended = false;
	var stream = through2(
		function (chunk, enc, cb) {
			cache.push(copy ? new Buffer(chunk) : chunk);
			cb(null, chunk);
		},
		function (cb) {
			ended = true;
			cb();
		}
	);

	Object.defineProperties(stream, {
		cachedChunks: {
			get: function () {
				return cache.map(function (buffer) {
					return buffer.toString('utf8');
				});
			}
		},
		isEnded: {
			get: function () {
				return ended;
			}
		},
		toString: {
			value: function () {
				return this.cachedChunks.join('');
			}
		}
	});

	return stream;
}

it('copyStream basic operation', function (done) {
	var stream = copyStream();
	stream.write('a');
	stream.write('c');
	setTimeout(function () {
		assert.deepEqual(stream.cachedChunks, ['a', 'c']);
		assert.strictEqual(stream.toString(), 'ac');
		done();
	});
});

it('proof of concept: there is a need', function (done) {
	input.pipe(copy1);

	input.push('foo');
	input.push('bar');

	setTimeout(function () {
		assert.strictEqual(copy1.toString(), 'foobar');
		input.pipe(copy2);
		setTimeout(function () {
			assert.strictEqual(copy2.toString(), '');
			done();
		});
	});
});

it('proof of concept: buffers need to be copied', function (done) {
	var transform = through2(function (chunk, enc, cb) {
		chunk[0] += 2;
		cb(null, chunk);
	});

	copy1 = copyStream(false);
	copy2 = copyStream(false);
	var downstream = copyStream();

	input
		.pipe(copy1);

	input
		.pipe(transform)
		.pipe(downstream);

	input
		.pipe(copy2);

	input.write('abc');
	input.write('tuv');

	setTimeout(function () {
		// Even though they are not piped through the transform - the buffers they receive are modified
		// streams do not make safety copies of buffers (for performance reasons).
		assert.strictEqual(copy1.toString(), downstream.toString(), 'copy1');
		assert.strictEqual(copy2.toString(), downstream.toString(), 'copy2');
		done();
	});
});

it('ending a stream twice is fine', function () {
	var s = through2();
	s.end();
	s.end();
});

'use strict';
var assert = require('assert');
var cachingStream = require('./');
var Transform = require('readable-stream').Transform;
var PassThrough = require('readable-stream').PassThrough;

var input;
var copy1;
var copy2;
var caching;

beforeEach(function () {
	input = new PassThrough();
	caching = cachingStream();
	copy1 = copyStream();
	copy2 = copyStream();
});

function pipeTo1() {
	input
		.pipe(caching)
		.pipe(copy1);

	input.push('foo');
	input.push('bar');
}

function baseTest(done) {
	pipeTo1();

	setTimeout(function () {
		assert.strictEqual(copy1.toString(), 'foobar');
		caching.createCacheStream().pipe(copy2);
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
	caching.dropCache();
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
	caching.dropCache(true);
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
	caching.endPassThroughStream();
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
		caching.createCacheStream().pipe(copy2);
		setTimeout(function () {
			assert(copy2.isEnded);
			assert.strictEqual(copy2.toString(), 'foobar');
			done();
		});
	});
});

it('makeCachedStream throws if already created ', function () {
	caching.createCacheStream();
	assert.throws(function () {
		caching.createCacheStream();
	}, /already created/);
});

it('makeCachedStream throws if already dropped ', function () {
	caching.dropCache();
	assert.throws(function () {
		caching.createCacheStream();
	}, /dropped/);
});

function copyStream(copy) {
	copy = copy !== false;
	var cache = [];
	var ended = false;
	var stream = new Transform({
		transform: function (chunk, enc, cb) {
			cache.push(copy ? new Buffer(chunk) : chunk);
			cb(null, chunk);
		},
		flush: function (cb) {
			ended = true;
			cb();
		}
	});

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

it('with no defensive copies, cache output is modified by transforms on passthrough', function (done) {
	pipeToTransform(function () {
		caching.createCacheStream().pipe(copy2);
		setTimeout(function () {
			// Streams do not make copies of buffers for performance reasons.
			// So copy2 is affected by the transform, even though it is not downstream from it.
			assert.strictEqual(copy2.toString(), 'ABCTUV', 'copy2');
			assert.strictEqual(copy1.toString(), 'ABCTUV', 'copy1');
			done();
		});
	});
});

it('defensive copies prevent transform interference', function (done) {
	caching = cachingStream(true);
	pipeToTransform(function () {
		caching.createCacheStream().pipe(copy2);
		setTimeout(function () {
			assert.strictEqual(copy2.toString(), 'abctuv', 'copy2');
			assert.strictEqual(copy1.toString(), 'ABCTUV', 'copy1');
			done();
		});
	});
});

function pipeToTransform(done) {
	var transform = new Transform({
		transform: function (chunk, enc, cb) {
			// VERY naive toUpperCase that modifies the existing Buffer
			for (var i = 0; i < chunk.length; i++) {
				chunk[i] -= 32;
			}
			cb(null, chunk);
		}
	});

	input.pipe(caching).pipe(transform).pipe(copy1);

	input.write('abc');
	input.write('tuv');

	setTimeout(done);
}

it('ending a stream twice is fine', function () {
	var s = new PassThrough();
	s.end();
	s.end();
});

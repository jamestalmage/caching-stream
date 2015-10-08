'use strict';
module.exports = cachingStream;
var duplexer = require('duplexify');
var stream = require('readable-stream');

function cachingStream() {
	var ended = false;
	var caching = true;
	var passingThrough = true;

	var cache = [];
	var copyStream = null;

	var output = noOpReader();
	var input = new stream.Writable({write: handleData})
		.once('finish', handleFlush);
	var duplex = duplexer(input, output);

	duplex.endOutput = endOutput;
	duplex.makeCopyStream = makeCopyStream;
	duplex.dropCache = dropCache;

	return duplex;

	function handleData(buffer, enc, cb) {
		if (caching) {
			var cacheCopy = passingThrough ? new Buffer(buffer) : buffer;
			if (copyStream) {
				copyStream.push(cacheCopy);
			} else {
				cache.push(cacheCopy);
			}
		}
		if (passingThrough) {
			output.push(buffer);
		}
		cb();
	}

	function handleFlush() {
		ended = true;
		if (output) {
			output.push(null);
		}
		if (caching && copyStream) {
			dropCache(true);
		}
	}

	function makeCopyStream() {
		if (copyStream) {
			throw new Error('copyStream was already created');
		}
		if (!caching) {
			throw new Error('cache has been dropped');
		}
		try {
			copyStream = noOpReader();
			cache.forEach(function (buffer) {
				copyStream.push(buffer);
			});
			return copyStream;
		} finally {
			cache = null;
			if (ended) {
				dropCache(true);
			}
		}
	}

	function endOutput() {
		passingThrough = false;
		output.push(null);
		output = null;
	}

	function dropCache(endStream) {
		cache = null;
		if (copyStream && endStream) {
			copyStream.push(null);
			copyStream = null;
		}
		if (!copyStream) {
			caching = false;
		}
	}
}

function noOp() {}

function noOpReader() {
	return new stream.Readable({read: noOp});
}

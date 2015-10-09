'use strict';
module.exports = cachingStream;
var stream = require('readable-stream');

function cachingStream(defensiveCopies) {
	var created = false;
	var notEnded = true;
	var cacheStream = new stream.Readable({read: noOp});

	var duplex = new stream.Duplex({
		write: write,
		read: noOp
	});

	duplex.once('finish', inputEnded);

	duplex.endPassThroughStream = endPassThroughStream;
	duplex.createCacheStream = createCacheStream;
	duplex.dropCache = dropCache;
	return duplex;

	function write(buffer, enc, cb) {
		if (cacheStream) {
			cacheStream.push(copyBuffer(buffer));
		}
		if (notEnded) {
			this.push(buffer);
		}
		cb();
	}

	function inputEnded() {
		endPassThroughStream();
		endCacheStream();
	}

	function createCacheStream() {
		if (created || !cacheStream) {
			throw new Error('cache was already ' + (created ? 'created' : 'dropped'));
		}
		created = true;
		return cacheStream;
	}

	function endPassThroughStream() {
		if (notEnded) {
			notEnded = false;
			duplex.push(null);
		}
	}

	function endCacheStream() {
		if (cacheStream) {
			cacheStream.push(null);
			if (created) {
				cacheStream = null;
			}
		}
	}

	function dropCache(endStream) {
		if (!created) {
			cacheStream = null;
		}
		if (endStream) {
			endCacheStream();
		}
	}

	function copyBuffer(buffer) {
		return defensiveCopies && notEnded ? new Buffer(buffer) : buffer;
	}
}

function noOp() {}

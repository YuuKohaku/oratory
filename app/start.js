'use strict';

var minimist = require('minimist');
var _ = require('underscore');
var redis = require('redis');

var Worker = require('../src/worker.js');

var args = minimist(process.argv.slice(2));
var id = args.id || process.pid + Date.now(); //@NOTE: suppose this is quite unique
var el = args.errorlist || "list-errors";

var client = redis.createClient();

var worker = new Worker(id, client, function () {
	console.time("START")
	console.log('%s started', id);
});

worker.configure("errorlist", el);
worker.messageGenerator(function () {
	this.cnt = this.cnt || 0;
	return this.cnt++;
});
worker.onMessage(function (msg, callback) {

	function onComplete() {
		var error = Math.random() > 0.85;
		callback(error, msg);
	}
	// processing takes time...
	setTimeout(onComplete, Math.floor(Math.random() * 1000));
})

process.on('exit', function (code) {
	console.info('Exiting, code: %s', code);
	worker.end();
});
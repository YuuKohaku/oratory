'use strict';

var _ = require('underscore');
var redis = require('redis');
var async = require('async');

var Worker = require("../src/worker.js");
var Broker = require("../src/broker.js");

describe('WORKER', function () {
	this.timeout(25000)
	var worker, broker, client;
	beforeEach(function (done) {
		worker = new Worker(process.pid, redis.createClient(), function () {
			setTimeout(done, 2500)
		});
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
		worker.configure("topic", "topic-" + _.random(0, 1000))
	});

	afterEach(function (done) {
		worker.end(done)
	});

	it('auto taking leadership', function (done) {
		var counter = 0,
			max = 10;
		broker = new Broker(redis.createClient(), 'tst');
		broker.act(worker.topic, function (data) {
			console.log("CB DATA", worker.topic, data);
			counter++;
			if (counter == max)
				done();
		});
	});


	it('speaker election', function (done) {
		var wrk = new Worker('tttt', redis.createClient(), function () {
			wrk.messageGenerator(function () {
				this.cnt = this.cnt || 0;
				return this.cnt++;
			});
			wrk.onMessage(function (msg, callback) {
				function onComplete() {
					var error = Math.random() > 0.85;
					callback(error, msg);
				}
				// processing takes time...
				setTimeout(onComplete, Math.floor(Math.random() * 1000));
			})
			setTimeout(function () {
				wrk.end();
				done();
			}, 20000)

		})
	});
});
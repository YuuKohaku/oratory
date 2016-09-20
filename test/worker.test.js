'use strict';

var _ = require('underscore');
var redis = require('redis');
var async = require('async');

var Worker = require("../src/worker.js");
var Broker = require("../src/broker.js");

describe('WORKER', function () {
	var worker, broker, client;
	beforeEach(function (done) {
		worker = new Worker(process.pid, redis.createClient(), done);
		worker.messageGenerator(function () {
			this.cnt = this.cnt || 0;
			return this.cnt++;
		});
		worker.configure("topic", "topic-" + _.random(0, 1000))
	});

	afterEach(function (done) {
		worker.end(done)
	});

	it('auto taking leadership', function (done) {
		this.timeout(20000);
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
});
'use strict';

var _ = require('underscore');
var redis = require('redis');
var async = require('async');

var Worker = require("../src/worker.js");
var Broker = require("../src/broker.js");

describe('WORKER', function () {
	var worker, broker, client;
	beforeEach(function () {
		worker = new Worker(process.pid, redis.createClient());
		worker.messageGenerator(function () {
			this.cnt = this.cnt || 0;
			return this.cnt++;
		});
	});

	afterEach(function (done) {
		worker.end(done);
	});

	it('start', function (done) {
		this.timeout(20000);
		var cnt = 0;
		worker.start(function (res) {
			expect(res)
				.to.equal(true);
			expect(worker.lifesign._lifetimer || worker.lifesign._checktimer)
				.to.be.not.null;
			done();
		});
	});


	it('as leader', function (done) {
		this.timeout(10000);
		var counter = 0,
			max = 10;
		broker = new Broker(redis.createClient(), 'tst');
		broker.act(worker.topic, function (data) {
			counter++;
			if (counter == max)
				done();
		});
		broker.on('subscribe', function () {
			worker.setMode('speaker');
		})
	});


	it('auto taking leadership', function (done) {
		this.timeout(10000);
		var counter = 0,
			max = 10;
		broker = new Broker(redis.createClient(), 'tst');
		broker.act(worker.topic, function (data) {
			counter++;
		});
		broker.on('subscribe', function () {})
		setTimeout(done, 8000)
	});
});
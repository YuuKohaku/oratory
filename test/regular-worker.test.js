'use strict';

var _ = require('underscore');
var redis = require('redis');
var async = require('async');

var Worker = require("../src/regular-worker.js");
var Broker = require("../src/broker.js");

describe('WORKER', function () {
	var worker, broker, client;
	beforeEach(function () {
		worker = new Worker(process.pid, redis.createClient());
	});

	afterEach(function (done) {
		worker.end(done);
	});

	it('start', function (done) {
		this.timeout(20000);
		var cnt = 0;
		worker.start(function (err, res) {
			if (err)
				done(new Error("worker start failed"));
			expect(res)
				.to.equal(1);
			expect(worker.lifesign._lifetimer)
				.to.be.not.null;
			expect(worker.lifesign._checktimer)
				.to.be.not.null;
			done();
		});
	});
});
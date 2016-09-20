'use strict'

var redis = require('redis');
var async = require('async');
var Registry = require('../src/registry.js');


describe('Registry', function () {
	var client = redis.createClient();
	var list = 'list-workers';
	var registry;

	beforeEach(function (done) {
		client.del(list, function () {
			registry = new Registry(list, client);
			done();
		});
	});

	it('add', function (done) {
		var cnt = 0,
			max = 10;
		async.whilst(function () {
				return cnt < max;
			},
			function (cb) {
				cnt++;
				registry.add(cnt, cb);
			},
			function (err, res) {
				client.zrevrangebyscore([list, '+inf', '-inf'],
					function (err, res) {
						expect(res)
							.to.have.length(max);
						done(err);
					});
			});
	});

	it('del', function (done) {
		registry.add('1', function (err, res) {
			registry.del(res, function (err, res) {
				expect(res)
					.to.be.equal(1);
				done();
			})
		});
	});

	it('getPrevious', function (done) {
		var cnt = 0,
			max = 10;
		async.whilst(function () {
				return cnt < max;
			},
			function (cb) {
				cnt++;
				registry.add(cnt, cb);
			},
			function (err, res) {
				registry.getPrevious(function (err, res) {
					expect(res)
						.to.be.have.property('name', max - 1 + '');
					done(err);
				});

			});
	});

	it('getLast', function (done) {
		var cnt = 0,
			max = 10;
		async.whilst(function () {
				return cnt < max;
			},
			function (cb) {
				cnt++;
				registry.add(cnt, cb);
			},
			function (err, res) {
				registry.getLast(function (err, res) {
					expect(res)
						.to.be.have.property('name', max + '');
					done(err);
				});
			});
	});
})
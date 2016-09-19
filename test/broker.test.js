'use strict';

var _ = require('underscore');
var redis = require('redis');
var async = require('async');

var Broker = require("../src/broker.js");

describe('MESSAGE BROKER', function () {
	var broker, client;

	beforeEach(function () {
		client = redis.createClient();
		broker = new Broker(client, process.pid);
	})

	afterEach(function () {
		broker.end();
	})

	it('inherits EventEmitter', function () {
		expect(broker)
			.to.be.instanceof(require('events'));
	});

	it('loopback pub/sub', function (done) {
		var topic = "topic-" + _.random(0, 100);
		var msg = "ack-" + topic;

		broker.subscribe(topic, function (data) {
			expect(data)
				.to.equal(msg);
			done();
		})

		broker.on("subscribe", function (evname) {
			if (evname == topic) broker.publish(topic, msg);
		});
	});

	it('basic pub/sub', function (done) {
		var topic = "topic-" + _.random(0, 100);
		var msg = "ack-" + topic;
		var len = 10,
			process_counter = 0,
			sub_counter = 0;
		var listeners = _.map(Array(len), function (val) {
			return new Broker(redis.createClient());
		});

		function process(data) {
			process_counter++;
			expect(data)
				.to.equal(msg);
			if (process_counter == len) {
				_.forEach(listeners, function (listener) {
					listener.end();
				});
				done();
			}
		}

		_.forEach(listeners, function (listener) {
			listener.subscribe(topic, process);
			listener.on("subscribe", function (evname) {
				sub_counter++;
				if (sub_counter == len && evname == topic)
					broker.publish(topic, msg);
			});
		})

	});

	it('event timestamp get/set', function (done) {
		var ts;
		broker._updateEventTimestamp('event', function (err, t) {
			ts = t;
			broker._getEventTimestamp('event', function (err, res) {
				expect(parseInt(res))
					.to.be.a('Number');
				expect(parseInt(res))
					.to.equal(ts);
				done();
			})
		})
	});

	it('event timestamp diff', function (done) {
		this.timeout(10000);
		var evname = 'event-' + _.random(0, 100);
		var to = 1000;
		broker._updateEventTimestamp(evname, function () {
			setTimeout(function () {
				broker._diffEventTimestamp(evname, function (err, res) {
					//10 ms deviation is supposed to be acceptable in this case
					expect(res)
						.to.satisfy(function (num) {
							return num > to - 10 && num < to + 10;
						});
					done();
				});
			}, to);
		});
	});

	it('drain list', function (done) {
		this.timeout(10000);
		var list = "test-list";
		var len = 100,
			cnt = 0;
		async.whilst(function () {
				return cnt < len;
			},
			function (callback) {
				client.rpush(list, cnt, function (llen) {
					cnt++;
					callback(null, cnt);
				});
			},
			function (err, res) {
				var content = [];
				broker.drainList(list, function (line) {
						content.push(line);
					},
					function (err, res) {
						if (content.length == len)
							done();
						else
							done(new Error("Incomplete drain"))
					})
			})
	});


	it('command/act', function (done) {
		var event = 'event-' + _.random(0, 100);
		var listener = new Broker(redis.createClient());
		var counter = 0,
			max = 10,
			timer = null;

		listener.act(event, function (msg) {
			if (counter == max) {
				clearInterval(timer);
				listener.end();
				done();
			}
		});

		listener.on('subscribe', function () {
			timer = setInterval(function () {
				counter++;
				broker.command(event, counter);
			}, 50);
		});

	});
});
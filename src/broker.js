'use strict';

//message broker abstraction on top of redis
//one instance per thread

var EventEmitter = require('events');
var util = require('util');
var _ = require('underscore');
var async = require('async');

//@TODO: set maxlistenrs outside

function Broker(redis_client, identifier) {
	this._publisher = redis_client;
	this._subscriber = redis_client.duplicate();
	this._identifier = identifier;

	this._timestamp_expiry = 600; // 10 minutes by default

	var self = this;

	this._subscriber.on("subscribe", function (topic, l_count) {
		self.emit("subscribe", topic);
	});

	this._subscriber.on("message", function (topic, message) {
		self.emit(topic, message);
	});
}

util.inherits(Broker, EventEmitter);


//configure existing params
Broker.prototype.configure = function (prop_name, prop_val) {
	if (this[prop_name] !== undefined) {
		this[prop_name] = prop_val;
	}
	return this;
}

//destructor
Broker.prototype.end = function () {
	this._subscriber.unsubscribe();
	this._subscriber.quit();
}

//timestamping
Broker.prototype._getEventTimestamp = function (event_name, callback) {
	this._publisher.get(("timestamp-" + event_name), callback);
}

Broker.prototype._updateEventTimestamp = function (event_name, callback) {
	var self = this;
	this._publisher.time(function (err, redis_ts) {
		if (err) {
			callback(err, null);
			return;
		}
		var ts = parseInt(redis_ts[0] * 1000 + (redis_ts[1] / 1000) | 0);
		var stamp = "timestamp-" + event_name;
		self._publisher.set(stamp, ts, callback);
		self._publisher.expire(stamp, self._timestamp_expiry);
	})
}

Broker.prototype._diffEventTimestamp = function (event_name, callback) {
	var self = this;

	async.parallel({
			curr_timestamp: function (cb) {
				self._publisher.time(function (err, redis_ts) {
					if (err) {
						cb(err, null);
						return;
					}
					var ts = parseInt(redis_ts[0] * 1000 + (redis_ts[1] / 1000) | 0);
					cb(null, ts);
				});
			},
			prev_timestamp: function (cb) {
				self._getEventTimestamp(event_name, cb);
			}
		},
		function (err, results) {
			if (err) {
				callback(err, null)
				return;
			}

			var diff = results.curr_timestamp - results.prev_timestamp;

			callback(null, diff);
		});
}

//Publish/subscribe
Broker.prototype.publish = function (event_name, event_data) {
	this._publisher.publish(event_name, event_data);
};

Broker.prototype.subscribe = function (event_name, callback) {
	this._subscriber.subscribe(event_name);
	this.on(event_name, callback);
};

Broker.prototype.act = function () {

}

//util
Broker.prototype.drainList = function (name, callback, end) {
	var eol = false;
	var self = this;

	async.whilst(function () {
		return !eol;
	}, function (cb) {
		self._publisher.lpop(name, function (err, res) {
			if (err) {
				cb(err, null);
				return;
			}

			eol = res === null;
			if (!eol) callback(res);

			cb(null, res);
		});
	}, function (err, res) {
		if (end && end.constructor === Function) end(err, res);
	});

};

module.exports = Broker;
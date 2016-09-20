'use strict';

//message broker abstraction on top of redis
//one instance per thread

var EventEmitter = require('events');
var util = require('util');
var _ = require('underscore');
var async = require('async');

var errors = require("./errors.js");

//@TODO: set maxlistenrs outside

function Broker(redis_client, identifier) {
	this._publisher = redis_client;
	this._subscriber = redis_client.duplicate();
	this._identifier = identifier;

	this._timestamp_expiry = 600; // 10 minutes by default
	this._response_timeout = 5000; //five seconds should be sufficient or something wrong with redis pub/sub
	this._request_counter = 0;

	this.request_pool_size = 100000; //also should be sufficient for expected load
	//@NOTE an array with predefined size executes a little bit faster
	this._timeout_pool = Array(this.request_pool_size);
	this._request_pool = Array(this.request_pool_size);

	var self = this;

	this._subscriber.on("subscribe", function (topic, l_count) {
		self.emit("subscribe", topic);
	});

	this._subscriber.on("message", function (topic, message) {
		self.emit(topic, message);
	});

	//naming fns collection for metadata
	this._naming = {
		list: function (event_name) {
			return "list-" + event_name;
		},
		update: function (event_name) {
			return "topic-update-" + event_name;
		},
		request: function (worker, task) {
			return ["request", worker, task].join("-");
		},
		response: function (receiver) {
			return "response-" + receiver;
		}
	};

	var self = this;
	var name = this._name("response")(this._identifier);
	this.act(name, function (msg) {
		var message = JSON.parse(msg);
		self._resolveRequest(message.request_id, message.error, message.data);
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

		async.series([
		             self._publisher.set.bind(self._publisher, stamp, ts),
		             self._publisher.expire.bind(self._publisher, stamp, self._timestamp_expiry)
		             ],
			function (err, results) {
				if (err) {
					callback(err, null);
					return;
				}
				callback(null, ts);
			});
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

//Messaging
Broker.prototype.publish = function (event_name, event_data) {
	this._publisher.publish(event_name, event_data);
};

Broker.prototype.subscribe = function (event_name, callback) {
	this._subscriber.subscribe(event_name);
	this.on(event_name, callback);
};

Broker.prototype.unsubscribe = function (event_name, callback) {
	this._subscriber.unsubscribe(event_name);
	this.removeAllListeners(event_name);
};

Broker.prototype.unact = function (event_name) {
	var notification = this._name("update")(event_name);
	this.unsubscribe(notification);
};


Broker.prototype.act = function (event_name, callback) {
	var list = this._name("list")(event_name);
	var notification = this._name("update")(event_name);

	var sink = this.drainList.bind(this, list, callback);

	this.subscribe(notification, sink);
	sink();
};


Broker.prototype.command = function (event_name, event_data, callback) {
	var self = this;
	var list = this._name("list")(event_name);
	var notification = this._name("update")(event_name);
	async.series([
	             self._publisher.rpush.bind(this._publisher, list, event_data),
	             self._updateEventTimestamp.bind(this, event_name)
	             ],
		function (err, res) {
			self._publisher.publish(notification, res[1]);
			if (callback && callback.constructor == Function) callback();
		});

};

Broker.prototype.request = function (worker, task_name, task_data, callback, timeout) {
	var r_id = this._request(callback, timeout || this._response_timeout);

	var message = {
		_task: task_name,
		_sender: this._identifier,
		data: task_data,
		request_id: r_id
	};
	var req_event = this._name("request")(worker, task_name);
	this.command(req_event, JSON.stringify(message));
};

Broker.prototype.do = function (task_name, callback) {
	var req_event = this._name("request")(this._identifier, task_name);

	var self = this;
	this.act(req_event, function (msg) {
		var message = JSON.parse(msg);
		var response_cb = self._reply(message);

		callback(message.data, response_cb);
	});
};

Broker.prototype._request = function (callback, timeout) {
	this._request_counter++;
	this._request_counter = this._request_counter % this.request_pool_size;

	var id = this._request_counter;

	var self = this;
	if (!!timeout) {
		this._timeout_pool[id] = setTimeout(function () {
			self._resolveRequest(id, errors.REQUEST_TIMEOUT, null);
		}, timeout);
	}
	this._request_pool[id] = callback;

	return id;
}

Broker.prototype._reply = function (message) {
	var sender = message._sender;
	var res_event = this._name("response")(sender);
	var self = this;

	return function (err, data) {
		var response = {
			request_id: message.request_id,
			_sender: self._identifier,
			_task: message._task,
			error: err || null
		};

		if (!response.err) {
			response.data = data;
		}
		self.command(res_event, JSON.stringify(response));
	}
};


Broker.prototype._resolveRequest = function (id, err, data) {
	var req_id = parseInt(id);
	var callback = this._request_pool[req_id];
	var timer = this._timeout_pool[req_id];

	clearTimeout(timer);
	this._timeout_pool[req_id] = null;

	if (callback && callback.constructor == Function) {
		callback(err, data);
		this._request_pool[req_id] = null;
	}
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
		if (end && end.constructor == Function) end(err, res);
	});
};

Broker.prototype._name = function (category) {
	return this._naming[category];
};

module.exports = Broker;
'use strict';

var _ = require("underscore");

function Registry(listname, client) {
	this._list = listname;
	this._counter = "counter-" + this._list;
	this._client = client;
	this._index = -1;
}

Registry.prototype.add = function (id, callback) {
	var self = this;
	this._client.incr(this._counter, function (err, cnt) {
		if (err) {
			callback(err, null);
			return;
		}
		self._index = cnt;
		self._client.zadd(self._list, self._index, id,
			function (err, res) {
				self.notify("joined", id);
				callback(err, self._index);
			});
	});
}

Registry.prototype.getScore = function (index, callback) {
	return this._index;
};

Registry.prototype.del = function (entry, callback) {
	var self = this;
	this._client.zremrangebyscore([this._list, entry.index, entry.index], function (err, res) {
		self.notify("left", entry.name);
		callback && callback(err, res);
	});
};

Registry.prototype.getPrevious = function (callback) {
	var self = this;
	this._client.zrevrangebyscore([this._list, this._index, 0, 'WITHSCORES', 'LIMIT', 1, 1],
		function (err, res) {
			if (err) {
				callback(err, null);
				return;
			}
			if (!_.isEmpty(res)) {
				var entry = self._entry(res);
				callback(null, entry);
				return;
			}
			self.getLast(callback);
		});
};

Registry.prototype._entry = function (response) {
	if (_.isEmpty(response)) return null;

	return {
		name: response[0],
		index: response[1]
	};
};

Registry.prototype.getLast = function (callback) {
	var self = this;
	this._client.zrevrangebyscore([this._list, '+inf', 0, 'WITHSCORES', 'LIMIT', 0, 1],
		function (err, res) {
			var data = self._entry(res);
			var response = data.index == self._id ? null : data;
			callback(err, response);
		});
};

Registry.prototype.getList = function (callback) {
	var self = this;
	this._client.zrevrangebyscore([this._list, '+inf', '-inf', 'WITHSCORES'],
		function (err, res) {
			var len = res.length;
			var data = [];
			for (var i = 0; i < len; i += 2) {
				data.push(self._entry([res[i], res[i + 1]]));
			}
			callback(err, data);
		});
};

Registry.prototype.getNotificationEvent = function (event_name) {
	return this._list + '-' + event_name;
}

Registry.prototype.notify = function (event_name, data) {
	this._client.publish(this.getNotificationEvent(event_name), data);
};

module.exports = Registry;
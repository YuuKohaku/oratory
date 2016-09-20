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
				callback(err, self._index);
			});
	});
}

Registry.prototype.del = function (index, callback) {
	this._client.zremrangebyscore([this._list, index, index], callback);
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
			var res = data.index == self._id ? null : data;
			callback(err, res);
		});
};


module.exports = Registry;
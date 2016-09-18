'use strict';

//workers list is stored in a list "worker-list"
//lifesign keeps its index
//each worker regularly updates the mark lifesign-`workername` with default expiration
//each worker regularly checks previous worker mark
//if the previous worker is dead, current worker decrements its index and checks previous once more until current index is 0


var async = require('async');

function Lifesign(client, owner) {
	this._client = client;
	this._owner = owner;
	this._list = "worker-list";
	this._key = "lifesign-" + this._owner;
	this._previous = null;
	this._lifetimer = null;
	this._checktimer = null;

	this.mark_interval = 2500; //ms
	this.mark_expiration = 5000 //ms
	this.check_interval = 5000;

}

Lifesign.prototype._timestamp = function (callback) {
	this._client.time(function (err, redis_ts) {
		if (err) {
			callback(err, null);
			return;
		}
		var ts = parseInt(redis_ts[0] * 1000 + (redis_ts[1] / 1000) | 0);
		callback(null, ts);
	});
}

Lifesign.prototype._previous = function (callback) {
	this._client.lindex(this._list, this._index - 1, callback);
}

Lifesign.prototype.checkPrevious = function (callback) {
	var success = false;
	console.log("PREVCHECK");
	// async.whilst(
	// 	function () {
	// 		return this._index == 0 || ;
	// 	},
	// 	function (callback) {
	// 		count++;
	// 		setTimeout(function () {
	// 			callback(null, count);
	// 		}, 1000);
	// 	},
	// 	function (err, n) {
	// 		// 5 seconds have passed, n = 5
	// 	}
	// );
}


Lifesign.prototype.start = function (callback) {
	var self = this;
	async.series([
	             self._client.lindex.bind(self._client, self._list, -1),
	             self._client.lpush.bind(self._client, self._list, self._owner),
	             self.alive.bind(self)
	             ],
		function (err, results) {
			if (err) {
				callback(err, null);
				return;
			}
			console.log("PREV", results);
			self._previous = results[0];

			self._lifetimer = setInterval(function () {
				self.alive();
			}, self.mark_interval);

			self._checktimer = setInterval(function () {
				self.checkPrevious();
			}, self.check_interval);

			callback(null, results[1]);
		});
}

Lifesign.prototype.end = function (callback) {
	clearInterval(this._lifetimer);
	clearInterval(this._checktimer);
	this._client.lrem(this._list, 0, this._owner, function (err, res) {
		callback && callback(err, res);
	});
}

Lifesign.prototype.alive = function (callback) {
	var self = this;
	self._timestamp(function (err, ts) {
		if (err) {
			callback && callback(err, null);
			return;
		}
		async.series([
		    	self._client.set.bind(self._client, self._key, ts),
		    	self._client.expire.bind(self._client, self._key, self.mark_expiration)
		    ],
			function (err, results) {
				console.log("ALIVE", err, results);
				if (err) {
					callback && callback(err, null);
					return;
				}
				callback && callback(null, ts);
			});
	});
}


Lifesign.prototype.isAlive = function (name, callback) {
	this._client.exists(name, function (err, res) {
		if (err) {
			callback(err, null);
			return;
		}
		callback(null, !!res);
	});
}

module.exports = Lifesign;
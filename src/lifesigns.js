'use strict';

//@NOTE: simple module for monitoring leader signal (monitoringMode) or emitting it (signalingMode)

var async = require('async');

function Lifesign(client, owner, signal_key) {
	this._client = client;
	this._owner = owner;
	this._key = signal_key;
	this._lifetimer = null;
	this._checktimer = null;

	this.mark_interval = 2500; //ms
	this.mark_expiration = 10; //s
	this.check_interval = 2500; //ms
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

Lifesign.prototype.monitoringMode = function (callback) {
	clearInterval(this._lifetimer);
	clearInterval(this._checktimer);
	this._lifetimer = null;
	this._checktimer = setInterval(this.monitor.bind(this, callback), this.check_interval);
}

Lifesign.prototype.signalingMode = function () {
	clearInterval(this._checktimer);
	clearInterval(this._lifetimer);
	this._lifetimer = setInterval(this.signal.bind(this), this.mark_interval);
}

Lifesign.prototype.end = function () {
	clearInterval(this._lifetimer);
	this._lifetimer = null;
	clearInterval(this._checktimer);
	this._checktimer = null;
}

Lifesign.prototype.signal = function (callback) {
	var self = this;
	this._timestamp(function (err, ts) {
		if (err) {
			callback && callback(err, null);
			return;
		}
		async.series([
				self._client.set.bind(self._client, self._key, self._owner),
		    	self._client.expire.bind(self._client, self._key, self.mark_expiration)
		    ],
			function (err, results) {
				if (err) {
					callback && callback(err, null);
					return;
				}
				callback && callback(null, ts);
			});
	});
}


Lifesign.prototype.monitor = function (callback) {
	this._client.exists(this._key, function (err, res) {
		callback(!!res);
	});
}

Lifesign.prototype.getSign = function (callback) {
	this._client.get(this._key, callback);
}

module.exports = Lifesign;
'use strict';

var async = require("async");

var Broker = require('./broker.js');

var ERRORLIST = "list-errors";

function BasicWorker(id, client) {
	this.bus = new Broker(client, id);
	this.errorlist = ERRORLIST;

	this._client = client;
	this._id = id;

	this.bus.do('die', this.die.bind(this));
}

//configuration
BasicWorker.prototype.configure = function (p_name, p_val) {
	if (this[p_name] !== undefined)
		this[p_name] = p_val;
}


BasicWorker.prototype.messageGenerator = function (fn) {
	if (fn && fn.constructor == Function)
		this._messageGenerator = fn;
}


BasicWorker.prototype.onMessage = function (callback) {
	if (callback && callback.constructor == Function)
		this._messageHandler = callback;
}

//lifecycle
BasicWorker.prototype.end = function (callback) {
	var self = this;
	this._stopped = true;
	this.bus.end();
	this.registry.del(this.identify(), function (err, res) {
		self._client.quit();
		callback && callback(err, res);
	});
}

BasicWorker.prototype._isStopped = function () {
	return this._stopped;
}

//messaging
BasicWorker.prototype.messageHandler = function (msg) {
	if (this._messageHandler) {
		this._messageHandler(msg, this.errorHandler.bind(this));
	}
}

BasicWorker.prototype.sendMessage = function (err, res) {
	var msg = this._generateMessage();
	this.bus.command(this.topic, msg);
}

BasicWorker.prototype._generateMessage = function () {
	if (!this._messageGenerator)
		throw new Error('Message generator is not defined');
	return this._messageGenerator();
}

//registry support
BasicWorker.prototype.identify = function () {
	return {
		index: this.registry.getScore(),
		name: this._id
	};
}

//error messages fns
BasicWorker.prototype.listErrors = function (callback) {
	var errlist = [];
	this.bus.drainList(this.errorlist, function (err, line) {
		errlist.push(line);
	}, function (err, res) {
		callback(err, errlist);
	});
}

BasicWorker.prototype.errorHandler = function (err, msg) {
	if (!err)
		return;
	this._client.rpush(this.errorlist, msg);
}

BasicWorker.prototype.die = function (callback) {
	this.end(function (err, res) {
		callback && callback(err, res);
		process.exit();
	});
}
module.exports = BasicWorker;
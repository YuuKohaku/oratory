'use strict';

var Broker = require('./broker.js');
var Lifesign = require('./lifesigns.js');

function Worker(id, client) {
	this.bus = new Broker(client, id);
	this.lifesign = new Lifesign(client, id);

	this.message_interval = 500;
	this.errorlist = "errors-list";

	this._client = client;
	this._id = id;
	this._mode = 'listener';
	this._timer = null;

	var self = this;
	this.bus.act("speech", self.messageHandler);
}

//configuration
Worker.prototype.configure = function (p_name, p_val) {
	if (this[p_name] !== undefined)
		this[p_name] = p_val;
}

Worker.prototype.setMode = function (mode) {
	if (mode != 'listener' && mode != 'speaker')
		return;
	this._mode = mode;
	this._processMode();
}

Worker.prototype._processMode = function () {
	if (this._mode == 'speaker') {
		this._timer = setInterval(this.sendMessage, this.message_interval);
	} else {
		clearInterval(this._timer);
	}
}

//lifecycle
Worker.prototype.start = function (callback) {
	this._processMode();
	this.lifesign.start(callback);
}

Worker.prototype.end = function (callback) {
	var self = this;
	clearInterval(this._timer);
	this.bus.end();
	this.lifesign.end(function (err, res) {
		self._client.quit();
		callback(err, res);
	});
}

//messaging
Worker.prototype.onMessage = function (callback) {
	if (callback && callback.constructor == Function)
		this._messageHandler = callback;
}

Worker.prototype.messageGenerator = function (fn) {
	if (fn && fn.constructor == Function)
		this._messageGenerator = fn;
}

Worker.prototype.messageHandler = function (msg) {
	if (this._messageHandler) {
		this._messageHandler(res, this.errorHandler);
	}
}

Worker.prototype.sendMessage = function (err, res) {
	var msg = this._generateMessage();
	if (msg === null)
		throw new Error('Message generator is not defined');
	this.bus.do('speech', msg);
}

Worker.prototype._generateMessage = function () {
	if (!this._messageGenerator)
		return null;
	return this._messageGenerator();
}

//Error fns
Worker.prototype.listErrors = function (callback) {
	var errlist = [];
	this.bus.drainList(this.errorlist, function (err, line) {
		errlist.push(line);
	}, function (err, res) {
		callback(err, errlist);
	});
}

Worker.prototype.errorHandler = function (err, msg) {
	if (!err)
		return;
	this._client.rpush(this.errorlist, msg);
}


module.exports = Worker;
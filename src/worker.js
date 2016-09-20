'use strict';

var async = require("async");
var _ = require("underscore");

var Lifesign = require('./lifesigns.js');
var BasicWorker = require('./basic-worker.js');
var Registry = require('./registry.js');
var errors = require('./errors.js');

var util = require("util");

var LIFESIGN = "speaker-lifesign";
var DISCOVERED = "speaker-elected";

var MODE_LISTENER = "listener";
var MODE_SPEAKER = "speaker";

function Worker(id, client, done) {
	Worker.super_.prototype.constructor.call(this, id, client, done);

	this.lifesign = new Lifesign(client, id, LIFESIGN);
	this.registry = new Registry("list-workers", client);

	this.message_interval = 500;
	this.topic = "speech";

	this._timer = null;
	this._waiting = false;

	this.bus.do('acknowledge', this.acknowledge.bind(this));
	this.bus.subscribe(this.registry.getNotificationEvent(DISCOVERED), this.setWaiting.bind(this, false));

	this.setMode(MODE_LISTENER);
	this.registry.add(this._id, done);
}

util.inherits(Worker, BasicWorker);

//mode processing
Worker.prototype.setMode = function (mode) {
	if (mode != MODE_LISTENER && mode != MODE_SPEAKER)
		return;
	this.mode = mode;
	this._processMode();
}

Worker.prototype._isSpeaker = function () {
	return this.mode == MODE_SPEAKER;
}

Worker.prototype._isWaiting = function () {
	return this._waiting;
}

Worker.prototype.setWaiting = function (p_val) {
	this._waiting = !!p_val;
}

Worker.prototype._processMode = function () {
	if (!this._isStopped()) {
		if (this._isSpeaker()) {
			console.log("taking the tribune: ", this._id);
			clearInterval(this._timer);
			this._timer = setInterval(this.sendMessage.bind(this), this.message_interval);
			this.lifesign.signalingMode();
			this.bus.unact(this.topic);
		} else {
			clearInterval(this._timer);
			this.lifesign.monitoringMode(this._processSpeakerStatus.bind(this));
			this.bus.act(this.topic, this.messageHandler.bind(this));
		}
	}
}

Worker.prototype._processSpeakerStatus = function (status, callback) {
	if (status == true) {
		console.log("speaker is alive:", this._id);
		return;
	} else {
		console.log("speaker is dead:", this._id);
		if (!this._isWaiting())
			this.tryToSpeak(callback);
	}
}

Worker.prototype.tryToSpeak = function (callback) {
	var self = this;
	if (!this._isStopped()) {
		self.getAttention(function (err, res) {
			if (err) {
				//rollback
				self.setMode(MODE_LISTENER);
				callback && callback(err, null);
				return;
			}
			self.setMode(MODE_SPEAKER);
			callback && callback(err, self._id);
		});
	}
}

Worker.prototype.getAttention = function (callback) {
	var event = "start-" + this.topic;
	var self = this;
	this.registry.getList(function (err, res) {
		if (err) {
			callback(err, null);
			return;
		}
		async.map(res, function (worker, cb) {
				if (worker.name == self._id) {
					cb(null, true);
					return;
				}
				self.bus.request(worker.name, "acknowledge", self.registry.getScore(), cb);
			},
			function (err, res) {
				if (!_.every(res)) {
					callback(errors.LOST_ACK, null)
				} else {
					self.registry.notify('speaker-elected', self._id);
					callback(null, true);
				}
			})
	});
}

Worker.prototype.acknowledge = function (speaker_score, callback) {
	//newbies welcome
	if (this.registry.getScore() < parseInt(speaker_score)) {
		this.setWaiting(true);
	}
	callback(null, this._isWaiting());
}

module.exports = Worker;
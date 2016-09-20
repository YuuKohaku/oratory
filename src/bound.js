'use strict';

var async = require("async");

var Broker = require('./broker.js');
var Registry = require('./registry.js');

function Bound(id, client, done) {
	this.bus = new Broker(client, id);

	this._client = client;
	this._id = id;
	this.registry = new Registry("list-workers", client);
	this.registry.add(this._id, done);
}


module.exports = Bound;
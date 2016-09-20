'use strict';

var async = require('async');
var minimist = require("minimist");
var _ = require('underscore');
var redis = require('redis');

var child_process = require('child_process');

var Broker = require('../src/Broker.js');

var client = redis.createClient();
var bus = new Broker(client, 'master');

var args = minimist(process.argv.slice(2));
var list = 'list-workers';
var errlist = "list-errors";
var workers = [];

if (args.getErrors) {
	printErrors();
} else {
	var num = parseInt(args.count) || 10;

	client.del(list, function () {
		bus.subscribe(list + "-joined", function (name) {
			console.log("%s joined the discussion", name);
		});

		bus.subscribe(list + "-left", function (name) {
			console.log("%s left the discussion", name);
		});

		bus.subscribe(list + "-speaker-elected", function (name) {
			console.log("%s now took the tribune", name);
		});

		spawn(num);
	});
}

function spawn(count) {
	for (var i = 0; i < count; i++) {
		var id = Date.now() + _.random(0, 1000);
		workers.push(id);
		child_process.fork('./src/start.js', ['--id', id, '--errorlist', errlist]);
	}
}

function printErrors() {
	var list = [];
	bus.drainList(errlist, function (err, line) {
		list.push(line);
	}, function (err, res) {
		console.log("Drained errors: ");
		_.forEach(list, console.log)
		bus.end();
		process.exit();
	});
}
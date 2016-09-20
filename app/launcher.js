'use strict';

var async = require('async');
var minimist = require("minimist");
var _ = require('underscore');
var redis = require('redis');

var child_process = require('child_process');
var readline = require("readline");

var Broker = require('../src/broker.js');

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
		child_process.fork('./app/start.js', ['--id', id, '--errorlist', errlist]);
	}
}

function kill(name) {
	bus.request(name, 'die', null);
}

function printErrors() {
	var list = [];
	bus.drainList(errlist, function (err, line) {
		list.push(line);
	}, function (err, res) {
		if (list.length == 0) {
			console.log("No errors in %s", errlist);
			process.exit();
		}
		console.log("Drained errors: ");
		_.forEach(list, function (err) {
			console.log("Error: %s", err);
		})
		bus.end();
		process.exit();
	});
}

var rl = readline.createInterface({
	input: process.stdin
});


rl.on('line', function (command_str) {
	var parts = command_str.split(' ');
	var command = parts[0];
	var value = parts[1];

	switch (command) {
	case "kill":
		kill(value);
		break;
	case "spawn":
		spawn(parseInt(value));
		break;
	case "exit":
		bus.end();
		process.exit();
		break;
	case "help":
		console.log("Available commands: \n kill <id> \n spawn <count> \n exit");
		break;
	default:
		console.log("Invalid command.");
	}
});
global.expect = require("chai")
	.expect;

var gulp = require("gulp");
var mocha = require("gulp-mocha");
var plumber = require("gulp-plumber");

module.exports = function () {
	gulp.watch(['src/**/*.js', 'test/**/*.js'], function () {
		return gulp.src('test/**/*.test.js', {
				read: false
			})
			.pipe(plumber())
			.pipe(mocha({
				require: ['chai', 'redis']
			}));
	});
};
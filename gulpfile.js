'use strict'

var gulp = require("gulp");

var wt_task = require("./gulp-tasks/watch-test.js");

gulp.task('default', ['watch-test']);

gulp.task('watch-test', wt_task);
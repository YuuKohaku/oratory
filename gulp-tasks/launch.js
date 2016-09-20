'use strict';

var nodemon = require('gulp-nodemon');
var demon;

module.exports = function () {
	//@NOTE: clean env every start, hanging intervals are painful
	demon = nodemon({
		script: 'src/launcher.js',
		watch: ['src/'],
		execMap: {},
		env: {
			'NODE_ENV': 'development'
		}
	});
}
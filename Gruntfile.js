var conf = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-wiredep');
	grunt.loadNpmTasks('grunt-bower-task');
	grunt.loadNpmTasks('grunt-usemin');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-watch');

	var jsFiles = ['client/static/js/*.js', 'client/static/js/provider/*.js', 'client/static/js/controller/*.js'];
	var bowerRoot = 'client/static/bower_dependencies/';
	var distPath = 'client/static/dist/';

	grunt.initConfig({
		uglify: {
			min: {
				options: {
					sourceMap: true
				},
				files: {
					'client/static/dist/app.min.js': jsFiles
				}
			}
		},
		wiredep: {
			task: {
				src: bowerRoot + 'dep.html'
			}
		},
		bower: {
			install: {
				options: {
					targetDir: bowerRoot
				}
			}
		},
		useminPrepare: {
			html: bowerRoot + 'dep.html',
			options: {
				dest: distPath
			}
		},
		usemin: {
			html: 'client/static/template/index.html'
		},
		watch: {
			files: jsFiles,
			tasks: ['uglify']
		}
	});

	grunt.registerTask('build', [
		'uglify',
		'bower',
		'wiredep',
		'useminPrepare',
		'concat:generated',
		'uglify:generated',
		'usemin'
	]);

}

module.exports = conf;

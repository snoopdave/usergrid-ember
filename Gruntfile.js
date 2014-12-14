
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    bower_concat: {
      all: {
        dest: 'build/all-deps.js',
        cssDest: 'build/all-deps.css',
        include: [ "jquery", "handlebars", "ember", "ember-data"],
        bowerOptions: { relative: false }
      }
    },

    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: ['build/all-deps.js'],
        dest: 'build/all-deps-min.js'
      }
    }
  });

  // load each NPM task that we want
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-bower-concat');
};


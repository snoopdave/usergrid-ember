/*
 * Licensed under  the  Apache  License, Version 2.0 (the "License") you may not 
 * use this file except in compliance with the License. You may obtain a copy of 
 * the License at:
 * 
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless  required  by  applicable  law  or  agreed  to  in  writing,  software 
 * distributed  under  the  License  is distributed on an "AS IS" BASIS, WITHOUT 
 * WARRANTIES OR CONDITIONS OF ANY  KIND,  either  express  or implied.  See the 
 * License for the specific language governing permissions and limitations under 
 * the License.
 */

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    bower_concat: {
      all: {
        dest: 'build/all-deps.js',
        cssDest: 'build/all-deps.css',
        include: [ "jquery", "handlebars", "ember", "ember-data", "bootstrap"],
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


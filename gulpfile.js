var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var gulp = require('gulp');
var sass = require('gulp-sass');
var rename = require('gulp-rename');
// var connect = require('gulp-connect');
var browserSync = require('browser-sync');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var bower = require('gulp-bower');
var reload = browserSync.reload;

var which = require('which').sync;
var spawn = require('child_process').spawn;


var map = require('vinyl-map');

gulp.task('default', ['develop'], function() {});

gulp.task('build', [
  'compile-stories',
  'story-app-overview',
  'story-app-sass',
  'story-app-vendor',
  'fonts',
  'storyteller'], function() {
});

gulp.task('develop', ['build', 'dev-server', 'watch']);
gulp.task('production', ['build']);

gulp.task('watch', function() {
  gulp.watch(['./story-app/story.html', './story-app/story.html', './content/**/slides.html', './content/**/config.json', './content/**/assets/*'], ['compile-stories', browserSync.reload]);
  gulp.watch(['./story-app/overview.html'], ['story-app-overview', browserSync.reload]);
  gulp.watch(['./story-app/scss/*.scss'], ['story-app-sass', browserSync.reload]);
  gulp.watch(['./storyteller/styles/scss/*.scss'], ['storyteller-css', browserSync.reload]);
  gulp.watch(['./storyteller/*.js', './storyteller/modules/**/*.js'], ['storyteller-js', browserSync.reload]);
});

gulp.task('story-app-sass', function() {
  gulp.src('./story-app/scss/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('./dist/css'))
});

gulp.task('bower', function() {
  return bower()
})

gulp.task('story-app-vendor', ['bower'], function() {
  // gulp.src('./node_modules/touchswipe/index.js')
  //   .pipe(rename('touchswipe.js'))
  //   .pipe(uglify())
  //   .pipe(gulp.dest('./dist/js/vendor'))

  gulp.src(['./bower_components/jquery/dist/jquery.min.js', './bower_components/jquery/dist/jquery.min.map'])
    .pipe(gulp.dest('./dist/js/vendor/2.1.3')) // TODO: automatically insert version number
  gulp.src('./bower_components/jquery-touchswipe/jquery.touchSwipe.min.js')
    .pipe(gulp.dest('./dist/js/vendor/1.6.4'))
  gulp.src(['./bower_components/hammerjs/hammer.min.js', './bower_components/hammerjs/hammer.min.map'])
    .pipe(gulp.dest('./dist/js/vendor/2.0.4'))
});

// we don't watch fonts since we don't expect it to frequently change
gulp.task('fonts', function() {
  gulp.src('./story-app/fonts/*')
    .pipe(gulp.dest('./dist/fonts'));
});

gulp.task('compile-stories', function() {
  // TODO: promisify the file reads in here for performance?
  var storyIndexTemplate = fs.readFileSync('./story-app/story.html').toString();

  try {
    var defaultMeta = JSON.parse(fs.readFileSync('./story-app/default-meta.json').toString());
  } catch (e) {
    gutil.log("ERROR! Unable to parse JSON file './story-app/default-meta.json'");
    return;
  }
  var content = gulp.src('./content/**/config.json');

  // Inlines the config file as a js declaration.
  // Also inserts meta information
  var inlineConfig = map(function(content, filename) {
    try {
      // TODO: Better handling of errors
      var contentJSON = JSON.parse(content.toString());
    } catch (e) {
      gutil.log("ERROR! Unable to parse JSON file: " + filename);
      return;
    }

    content = content.toString();
    content = "<script>window.storyConfig = " + content + ";</script>";
    var storyMeta = typeof contentJSON.meta === 'undefined' ? {} : contentJSON.meta;

    // Missing fields will default to those in story-app/default-meta.json
    var finalMeta = _.assign(_.clone(defaultMeta), storyMeta);
    var newIndex = storyIndexTemplate;
    newIndex = newIndex.replace('<!-- config inserted here -->', content);
    // TODO: Replace things the "correct" way (instead of copy and paste)
    newIndex = newIndex.replace(/<!-- story-meta:title -->/g, finalMeta.title);
    newIndex = newIndex.replace(/<!-- story-meta:description -->/g, finalMeta.description);
    newIndex = newIndex.replace(/<!-- story-meta:image -->/g, finalMeta.image);
    newIndex = newIndex.replace(/<!-- story-meta:author -->/g, finalMeta.author);

    return newIndex;
  });

  var inlineSlide = map(function(content, filename) {
    var slidesPath = path.dirname(filename) + "/slides.html"
    var slidesContent = fs.readFileSync(slidesPath, 'utf-8');
    content = content.toString();
    return content.replace('<!-- slides inserted here -->', slidesContent);
  });

  content
    .pipe(inlineConfig)
    .pipe(inlineSlide)
    .pipe(rename(function(path) {
      path.basename = 'index';
      path.extname = '.html';
    }))
    .pipe(gulp.dest('./dist'));

  gulp.src('./content/**/assets/*')
    .pipe(gulp.dest('./dist/'))
});


gulp.task('story-app-overview', function() {
  gulp.src('./story-app/overview.html')
    .pipe(rename('index.html'))
    .pipe(gulp.dest('./dist/'))
});

gulp.task('storyteller-gulp', function(cb) {
  gutil.log("Starting storyteller.js gulp")
  spawn(which('gulp'), ['--cwd', 'storyteller'], {stdio: 'inherit'})
    .on('exit', function() {
      gutil.log("Finished storyteller.js gulp");
      cb.call();
    });
});

gulp.task('storyteller-css', ['storyteller-gulp'], function() {
  gulp.src(['./storyteller/styles/css/*.css'])
    .pipe(gulp.dest('./dist/css/storyteller'));
});
gulp.task('storyteller-js', function() {
  gulp.src(['./storyteller/storyteller.js'])
    .pipe(gulp.dest('./dist/js/storyteller'));

  gulp.src(['./storyteller/modules/**/*.js']) // TODO: probably don't need 2 gulp.src's
    .pipe(gulp.dest('./dist/js/storyteller/modules'));
});
gulp.task('storyteller', ['storyteller-js', 'storyteller-css'], function() {
});


gulp.task('dev-server', function() {
  // connect.server({
  //   root: 'dist',
  //   livereload: true,
  //   port: 8000
  // });
  browserSync({
    server: {
      baseDir: "./dist/"
    },
    notify: false
   });
});

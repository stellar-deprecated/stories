var fs = require('fs');
var path = require('path');

var gulp = require('gulp');
var sass = require('gulp-sass');
var rename = require('gulp-rename');
var connect = require('gulp-connect');
var chug = require('gulp-chug');

var map = require('vinyl-map');

gulp.task('default', function() {
  console.log('Use gulp build');
});

gulp.task('build', [
  'compile-stories',
  'story-app-sass',
  'storyteller'], function() {
});

gulp.task('develop', ['build', 'dev-server', 'watch']);

gulp.task('watch', function() {
  gulp.watch(['./content/**/slides.html'], ['compile-stories']);
  gulp.watch(['./storyteller/styles/scss/*.scss'], ['storyteller-css']);
  gulp.watch(['./storyteller/*.js', './storyteller/modules/**/*.js'], ['storyteller-js']);
});

gulp.task('story-app-sass', function() {
  gulp.src('./story-app/styles/scss/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('./dist/css'));
});

gulp.task('compile-stories', function() {
  var template = fs.readFileSync('./story-app/index.html').toString(); // TODO: make this async
  var content = gulp.src('./content/**/config.json');

  var inlineConfig = map(function(content) {
    content = content.toString();
    content = "<script>window.storyConfig = " + content + ";</script>"
    return template.replace('<!-- config inserted here -->', content);
  });

  var inlineSlide = map(function(content, filename) {
    var slidesPath = path.dirname(filename) + "/slides.html"
    var slidesContent = fs.readFileSync(slidesPath, 'utf-8'); // TODO: make this async
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


// Calls the default task in storyteller's gulp
gulp.task('storyteller-chug', function() {
  gulp.src('./storyteller/gulpfile.js')
    .pipe(chug());
});
gulp.task('storyteller-css', ['storyteller-chug'], function() {
  gulp.src(['./storyteller/styles/css/*.css'])
    .pipe(gulp.dest('./dist/css/storyteller'));
});
gulp.task('storyteller-js', function() {
  gulp.src(['./storyteller/storyteller.js', './storyteller/modules'])
    .pipe(gulp.dest('./dist/js/storyteller'));
});
gulp.task('storyteller', ['storyteller-js', 'storyteller-css'], function() {
});


gulp.task('dev-server', function() {
  connect.server({
    root: 'dist',
    livereload: true,
    port: 8000
  })
});

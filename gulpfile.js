var fs = require('fs');
var path = require('path');

var gulp = require('gulp');
var sass = require('gulp-sass');
var rename = require('gulp-rename');
var connect = require('gulp-connect');

var map = require('vinyl-map');

gulp.task('default', function() {
  console.log('Use gulp build');
});

gulp.task('build', [
  'compile-stories',
  'story-app-sass',
  'storyteller-sass',
  'storyteller-js'], function() {
});

gulp.task('develop', ['build', 'dev-server', 'watch']);

gulp.task('watch', function() {
  gulp.watch(['./content/**/slides.html'], ['compile-stories']);
  gulp.watch(['./storyteller/scss/*', './storyteller/modules/**/scss/*'], ['storyteller-sass']);
  gulp.watch(['./storyteller/storyteller.js', './storyteller/modules/*.js'], ['storyteller-js']);
})

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


gulp.task('storyteller-sass', function() {
  gulp.src(['./storyteller/scss/*.scss', './storyteller/modules/**/scss/*.scss'])
    .pipe(sass())
    .pipe(gulp.dest('./dist/css'));
});

gulp.task('storyteller-js', function() {
  gulp.src(['./storyteller/modules/**/*.js', './storyteller/storyteller.js'])
    .pipe(gulp.dest('./dist/js'));
});


gulp.task('dev-server', function() {
  connect.server({
    root: 'dist',
    livereload: true,
    port: 8000
  })
});

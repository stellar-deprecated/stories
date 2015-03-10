var gulp = require('gulp');
var sass = require('gulp-sass');

gulp.task('default', function() {
  console.log('default')
});

gulp.task('sass', function() {
  gulp.src('./styles/scss/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('./styles/css'))
    .pipe(gulp.dest('./dist/assets/css'))
});

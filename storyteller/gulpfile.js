var gulp = require('gulp');
var sass = require('gulp-sass');

gulp.task('default', ['main-sass'], function() {

});

gulp.task('main-sass', function() {
  gulp.src('./styles/scss/*.scss')
    .pipe(sass())
    .pipe(gulp.dest('./styles/css'));
});

// // Not yet implemented (keeping it simple)
// gulp.task('modules-sass', function() {
//   gulp.src('./modules/core/scss/*.scss')
//     .pipe(sass())
//     .pipe(gulp.dest('./modules/'));
// });

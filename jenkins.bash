#! /usr/bin/env bash
set -e

npm install

cd storyteller
  npm install
cd -

./node_modules/gulp/bin/gulp.js production

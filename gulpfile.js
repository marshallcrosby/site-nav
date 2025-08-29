/// <binding ProjectOpened='build' />
'use strict';

// Gulp stuff
const { src, dest, series, parallel, watch } = require('gulp');

// Styles
const sass = require('gulp-dart-sass');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer')

// Javascript
const terser = require('gulp-terser');
const rename = require('gulp-rename');
const include = require('gulp-include');

// Markup
const twig = require('gulp-twig');

// Live server
const connect = require('gulp-connect');

const merge = require('merge-stream');

function styles() {
    // Expanded CSS with sourcemaps
    const expanded = src([
        'src/assets/scss/**/*.scss',
        '!src/assets/scss/**/_*'
    ], { sourcemaps: true })
        .pipe(sass({ outputStyle: 'expanded' }).on('error', sass.logError))
        .pipe(postcss([ autoprefixer() ]))
        .pipe(dest('dist/assets/css', { sourcemaps: '.' }));

    // Compressed CSS (minified) with sourcemaps
    const compressed = src([
        'src/assets/scss/**/*.scss',
        '!src/assets/scss/**/_*'
    ], { sourcemaps: true })
        .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
        .pipe(postcss([ autoprefixer() ]))
        .pipe(rename(function (path) {
            if (!path.basename.includes('.min')) {
                path.extname = '.min.css';
            }
        }))
        .pipe(dest('dist/assets/css', { sourcemaps: '.' }));

    return merge(expanded, compressed)
        .pipe(connect.reload());
}

function scripts() {
    // Uncompressed JS with sourcemaps
    const uncompressed = src([
        'src/assets/js/**/*.js',
        '!src/assets/js/**/_*'
    ], { sourcemaps: true })
        .pipe(include({
            includePaths: [__dirname]
        }))
        .pipe(dest('dist/assets/js', { sourcemaps: '.' }));

    // Compressed (minified) JS with sourcemaps
    const compressed = src([
        'src/assets/js/**/*.js',
        '!src/assets/js/**/_*'
    ], { sourcemaps: true })
        .pipe(include({
            includePaths: [__dirname]
        }))
        .pipe(terser({ sourceMap: true }))
        .pipe(rename(function (path) {
            if (!path.basename.includes('.min')) {
                path.extname = '.min.js';
            }
        }))
        .pipe(dest('dist/assets/js', { sourcemaps: '.' }));

    return merge(uncompressed, compressed)
        .pipe(connect.reload());
}

function markup() {
    return src([
            'src/**/*.twig',
            '!src/**/_*'
        ])
        .pipe(twig())
        .pipe(dest('dist'))
        .pipe(connect.reload());
}

function images() {
    return src('src/assets/images/**/*', { encoding: false })
        .pipe(dest('dist/assets/images'))
        .pipe(connect.reload());
}

function watchFiles(cb) {
    watch('src/assets/scss/**/*.scss', series(styles));
    watch('src/assets/js/**/*.js', series(scripts));
    watch('src/assets/images/**/*', images);
    watch('src/**/*.twig', markup);

    cb();
}

function server(cb) {
    connect.server({
        root: 'dist',
        livereload: true
    });

    cb();
}

const build = series(parallel(styles, scripts, markup, images));

exports.build = build;
exports.watch = series(build, watchFiles);
exports.server = series(exports.watch, server);

'use strict';

const webpack = require('webpack');
const CompressionPlugin = require("compression-webpack-plugin");

module.exports = {
  entry: {
    "firebase-cache": './src',
    "firebase-cache.min": "./src"
  },
  devtool: "source-map",
  output: {
    library: ['[name]'],
    libraryTarget: 'umd',
    umdNamedDefine: false,
    path: __dirname + '/dist',
    filename: '[name].js'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      minimize: true
    }),
    new CompressionPlugin({
      asset: "[path].gz[query]",
      algorithm: "gzip",
      test: /\.js$|\.html$/,
      threshold: 10240,
      minRatio: 0.8
    })
  ],
  node: {
    crypto: 'empty',
    net: 'empty',
    dns: 'empty'
  },
  externals: [{
    lodash: true,
    async: true,
    hoek: true,
    joi: true
  }]
};

'use strict';

const path = require('path')
const webpack = require('webpack')
const CompressionPlugin = require("compression-webpack-plugin")

module.exports = {
  entry: './src/index.js',
  //devtool: 'eval',
  //devtool: 'source-map',
  devtool: 'cheap-module-source-map',
  output: {
    library: ['firebase_cache'],
    //libraryTarget: 'umd',
    //umdNamedDefine: false,
    path: __dirname + '/dist',
    filename: 'firebase_cache.js'
  },
  plugins: [
    new CompressionPlugin({
      asset: "[path].gz[query]",
      algorithm: "gzip",
      test: /\.js$/,
      threshold: 10240,
      minRatio: 0.8
    }),
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('production')
      }
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
  }],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules/,
        query: {
          presets: ['es2015']
        }
      }
    ],
  }
};

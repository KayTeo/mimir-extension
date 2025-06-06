const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    popup: './popup.js',
    background: './background.js',
    sidepanel: './sidepanel.js',
    content: './content.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'popup.html', to: 'popup.html' },
        { from: 'sidepanel.html', to: 'sidepanel.html' },
        { from: 'icons', to: 'icons' },
        { from: 'config.js', to: 'config.js' }
      ]
    })
  ],
  optimization: {
    splitChunks: false
  },
  experiments: {
    topLevelAwait: true
  }
}; 
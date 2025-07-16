const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    popup: './ui/popup.js',
    background: './background/background.js',
    sidepanel: './ui/sidepanel.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) => {
      if (pathData.chunk.name === 'background') return 'background/background.js';
      if (pathData.chunk.name === 'popup') return 'ui/popup.js';
      if (pathData.chunk.name === 'sidepanel') return 'ui/sidepanel.js';
      return '[name].js';
    }
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
        { from: 'ui/popup.html', to: 'ui/popup.html' },
        { from: 'ui/sidepanel.html', to: 'ui/sidepanel.html' },
        { from: 'icons', to: 'icons' },
        { from: 'background/config.js', to: 'background/config.js' }
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
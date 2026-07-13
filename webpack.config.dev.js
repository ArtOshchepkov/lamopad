const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    liveReload: true,
    hot: true,
    open: true,
    static: ['./'],
    // доступ с телефона в локальной сети: http://zenbook.local:8080 (mDNS/Avahi)
    host: '0.0.0.0',
    allowedHosts: ['.local'],
  },
});

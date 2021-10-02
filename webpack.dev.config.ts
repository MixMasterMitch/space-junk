import path from 'path';
import { merge } from 'webpack-merge';
import baseConfig from './webpack.config';

module.exports = merge(baseConfig, {
    mode: 'development',

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },

    devServer: {
        static: true,
        port: 3001,
    },

    // Include sourcemaps
    devtool: 'inline-source-map',

    // Keep running even if there are errors
    bail: false,
});

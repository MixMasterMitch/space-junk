import path from 'path';
import { merge } from 'webpack-merge';
import baseConfig from './webpack.config';
import fs from "fs";

module.exports = merge(baseConfig, {
    mode: 'development',

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },

    devServer: {
        static: true,
        port: 3001,
        onBeforeSetupMiddleware: function (devServer) {
            if (!devServer) {
                throw new Error('webpack-dev-server is not defined');
            }

            devServer.app.get('/resources/filtered/*', (req, res) => {
                console.log(req.path);
                res.header('Content-Encoding', 'gzip');
                fs.createReadStream(`./${req.path}.gz`).pipe(res);
            });
        },
    },

    // Include sourcemaps
    devtool: 'inline-source-map',

    // Keep running even if there are errors
    bail: false,
});

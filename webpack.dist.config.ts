import { merge } from 'webpack-merge';
import baseConfig from './webpack.config';

module.exports = merge(baseConfig, {
    mode: 'production',
});

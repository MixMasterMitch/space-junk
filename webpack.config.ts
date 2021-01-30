import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import path from 'path';
import webpack from 'webpack';

const config: webpack.Configuration = {
    entry: {
        main: path.resolve(__dirname, 'src/index.ts'),
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    // disable type checker - we will use it in fork plugin
                    transpileOnly: true,
                },
            },
        ],
    },
    plugins: [new ForkTsCheckerWebpackPlugin()],

    // Fail if there are any errors (such as a TypeScript type issue)
    bail: true,
};

export default config;

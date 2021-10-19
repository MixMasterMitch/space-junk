import path from 'path';
import webpack from 'webpack';

const config: webpack.Configuration = {
    entry: {
        main: path.resolve(__dirname, 'src/index.ts'),
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'esbuild-loader',
                options: {
                    loader: 'tsx',
                    target: 'es2019',
                },
            },
        ],
    },

    // Fail if there are any errors (such as a TypeScript type issue)
    bail: true,
};

export default config;

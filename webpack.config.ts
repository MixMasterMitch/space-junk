import path from 'path';
import webpack from 'webpack';
import WasmPackPlugin from '@wasm-tool/wasm-pack-plugin';

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
                loader: 'esbuild-loader',
                options: {
                    loader: 'ts',
                    target: 'es2019',
                },
            },
        ],
    },
    plugins: [
        new WasmPackPlugin({
            crateDirectory: path.resolve(__dirname, 'src', 'native'),
        }) as any,
    ],
    experiments: {
        syncWebAssembly: true,
    },

    // Fail if there are any errors (such as a TypeScript type issue)
    bail: true,
};

export default config;

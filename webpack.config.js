const path = require('path');

module.exports = {
    mode: 'development',
    entry: {
        background: './src/background.ts',
        content_script: './src/content_script.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'umd',
        globalObject: 'this'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    experiments: {
        topLevelAwait: true
    },
    devtool: 'inline-source-map'
}; 

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
const merge = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');

const makeCommonConfig = require('./webpack.common.js');

const commonConfig = makeCommonConfig();

const config = merge.merge(commonConfig, {
    mode: 'production',
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({extractComments: false})],
    },
});

module.exports = [
    merge.merge(config, {
    }),
];

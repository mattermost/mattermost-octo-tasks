// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import ReactDOM from 'react-dom'
import {Provider as ReduxProvider} from 'react-redux'

import App from './app'
import {initThemes} from './theme'

import './styles/variables.scss'
import './styles/main.scss'
import './styles/labels.scss'

import store from './store'

initThemes()
ReactDOM.render(
    (
        <ReduxProvider store={store}>
            <App/>
        </ReduxProvider>
    ),
    document.getElementById('focalboard-app'),
)

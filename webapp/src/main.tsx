// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import ReactDOM from 'react-dom'
import {store} from 'emoji-mart'

import App from './app'
import {initThemes} from './theme'
import {importNativeAppSettings} from './nativeApp'
import {UserSettings} from './userSettings'

import './styles/variables.scss'
import './styles/main.scss'
import './styles/labels.scss'

store.setHandlers({getter: UserSettings.getEmojiMartSetting, setter: UserSettings.setEmojiMartSetting})
importNativeAppSettings()
initThemes()
ReactDOM.render(<App/>, document.getElementById('main-app'))

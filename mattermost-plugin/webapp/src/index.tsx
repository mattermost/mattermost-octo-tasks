// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'
import {Store, Action} from 'redux'
import {Provider as ReduxProvider} from 'react-redux'

import {GlobalState} from 'mattermost-redux/types/store'

const windowAny = (window as any)
windowAny.baseURL = '/plugins/focalboard'
windowAny.frontendBaseURL = '/plug/focalboard'

import App from '../../../webapp/src/app'
import store from '../../../webapp/src/store'

import '../../../webapp/src/styles/variables.scss'
import '../../../webapp/src/styles/main.scss'
import '../../../webapp/src/styles/labels.scss'

import manifest from './manifest'
import ErrorBoundary from './error_boundary'

// eslint-disable-next-line import/no-unresolved
import {PluginRegistry} from './types/mattermost-webapp'

const focalboardIcon = (
    <svg
        className='Icon'
        viewBox='0 0 64 64'
        width='24px'
        height='24px'
    >
        <g opacity='0.56'>
            <path
                fill='rgba(var(--center-channel-color-rgb), 1)'
                d='M33.071,12.289C20.408,8.822,6.018,15.578,1.395,29.232 c-4.655,13.75,2.719,28.67,16.469,33.325c13.75,4.655,28.67-2.719,33.326-16.469c3.804-11.235-0.462-22.701-8.976-29.249 l-0.46,4.871l-0.001,0c4.631,4.896,6.709,11.941,4.325,18.985c-3.362,9.931-14.447,15.151-24.76,11.66 C11.005,48.865,5.37,37.985,8.731,28.054c2.975-8.788,11.998-13.715,20.743-12.625v-0.001L33.071,12.289L33.071,12.289z M26.896,28.777c3.456-0.665,6.986,2.754,5.762,6.37c-0.854,2.522-3.67,3.85-6.291,2.962c-2.62-0.887-4.052-3.651-3.197-6.174 C23.743,30.238,25.204,29.083,26.896,28.777L26.896,28.777z M25.611,23.833c-1.786,0.323-3.45,1.104-4.812,2.258 c-1.299,1.101-2.319,2.545-2.898,4.258c-0.879,2.597-0.579,5.323,0.617,7.632c1.206,2.329,3.325,4.234,6.07,5.164 c2.744,0.929,5.584,0.701,7.959-0.417c2.352-1.107,4.246-3.091,5.125-5.688c0.555-1.639,0.633-3.254,0.344-4.761 c-0.21-1.093-0.615-2.134-1.174-3.091l1.019-5.107c0.189,0.187,0.374,0.378,0.552,0.574c1.75,1.919,3.008,4.283,3.508,6.877 c0.415,2.154,0.304,4.457-0.484,6.784c-1.239,3.661-3.898,6.453-7.193,8.005c-3.273,1.541-7.175,1.858-10.93,0.588 c-3.754-1.271-6.661-3.895-8.326-7.108c-1.674-3.233-2.09-7.065-0.851-10.728c0.819-2.419,2.26-4.46,4.097-6.016 c1.88-1.593,4.181-2.673,6.656-3.125l-0.001-0.004c1.759-0.339,3.522-0.313,5.213,0.016l-3.583,3.761 c-0.294,0.028-0.588,0.071-0.883,0.127H25.611z'
            />
            <polygon
                fill='rgba(var(--center-channel-color-rgb), 1)'
                points='37.495,11.658 36.79,8.44 41.066,0.207 43.683,4.611 48.803,4.434 44.185,12.48 40.902,13.697 29.542,34.491 26.057,32.594'
            />
        </g>
    </svg>
)

const MainApp = () => {
    useEffect(() => {
        document.body.classList.add('focalboard-body')
        const root = document.getElementById('root')
        if (root) {
            root.classList.add('focalboard-plugin-root')
        }

        return () => {
            document.body.classList.remove('focalboard-body')
            if (root) {
                root.classList.remove('focalboard-plugin-root')
            }
        }
    }, [])

    return (
        <ErrorBoundary>
            <ReduxProvider store={store}>
                <div id='focalboard-app'>
                    <App/>
                </div>
                <div id='focalboard-root-portal'/>
            </ReduxProvider>
        </ErrorBoundary>
    )
}

export default class Plugin {
    channelHeaderButtonId?: string
    registry?: PluginRegistry

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    public async initialize(registry: PluginRegistry, store: Store<GlobalState, Action<Record<string, unknown>>>) {
        this.registry = registry
        this.channelHeaderButtonId = registry.registerChannelHeaderButtonAction(focalboardIcon, () => {
            const currentChannel = store.getState().entities.channels.currentChannelId
            window.open(`${window.location.origin}/plug/focalboard/workspace/${currentChannel}`)
        }, '', 'Focalboard Workspace')
        this.registry.registerCustomRoute('/', MainApp)
    }

    public uninitialize() {
        if (this.channelHeaderButtonId) {
            this.registry?.unregisterComponent(this.channelHeaderButtonId)
        }
    }
}

declare global {
    interface Window {
        registerPlugin(id: string, plugin: Plugin): void
    }
}

window.registerPlugin(manifest.id, new Plugin())

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {exportUserSettingsBlob, importUserSettingsBlob} from './userSettings'

declare interface INativeApp {
    settingsBlob: string | null;
}

declare const NativeApp: INativeApp

export function importNativeAppSettings() {
    if (typeof NativeApp === 'undefined' || !NativeApp.settingsBlob) {
        return
    }
    const importedKeys = importUserSettingsBlob(NativeApp.settingsBlob)
    const messageType = importedKeys.length ? 'didImportUserSettings' : 'didNotImportUserSettings'
    postWebKitMessage({type: messageType, settingsBlob: exportUserSettingsBlob(), keys: importedKeys})
    NativeApp.settingsBlob = null
}

export function notifySettingsChanged(key: string) {
    postWebKitMessage({type: 'didChangeUserSettings', settingsBlob: exportUserSettingsBlob(), key})
}

function postWebKitMessage(message: any) {
    (window as any).webkit?.messageHandlers.nativeApp?.postMessage(message)
}

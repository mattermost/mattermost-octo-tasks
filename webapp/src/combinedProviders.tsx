// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {IntlProvider} from 'react-intl'
import {DndProvider} from 'react-dnd'
import {HTML5Backend} from 'react-dnd-html5-backend'
import {TouchBackend} from 'react-dnd-touch-backend'

import ThemeProvider from '@mattermost/compass-components/utilities/theme/theme-provider'

import {getMessages} from './i18n'
import {IUser, UserContext} from './user'
import {SetLanguageContext} from './setLanguageContext'
import {Utils} from './utils'

type Props = {
    language: string
    setLanguage: (lang: string) => void
    user?: IUser
    children: React.ReactNode
}

const CombinedProviders = React.memo((props: Props): JSX.Element => {
    const {language, setLanguage, user} = props
    return (
        <IntlProvider
            locale={language.split(/[_]/)[0]}
            messages={getMessages(language)}
        >
            <SetLanguageContext.Provider value={setLanguage}>
                <DndProvider backend={Utils.isMobile() ? TouchBackend : HTML5Backend}>
                    <UserContext.Provider value={user}>
                        <ThemeProvider>
                            {props.children}
                        </ThemeProvider>
                    </UserContext.Provider>
                </DndProvider>
            </SetLanguageContext.Provider>
        </IntlProvider>
    )
})

export default CombinedProviders

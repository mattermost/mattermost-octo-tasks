// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useEffect} from 'react'
import {
    BrowserRouter as Router,
    Redirect,
    Route,
    Switch,
} from 'react-router-dom'
import {IntlProvider} from 'react-intl'
import {DndProvider} from 'react-dnd'
import {HTML5Backend} from 'react-dnd-html5-backend'
import {TouchBackend} from 'react-dnd-touch-backend'

import {getMessages} from './i18n'
import {FlashMessages} from './components/flashMessages'
import BoardPage from './pages/boardPage'
import ChangePasswordPage from './pages/changePasswordPage'
import ErrorPage from './pages/errorPage'
import LoginPage from './pages/loginPage'
import RegisterPage from './pages/registerPage'
import {IUser} from './user'
import {Utils} from './utils'
import {importNativeAppSettings} from './nativeApp'
import {fetchCurrentUser, getCurrentUser} from './store/currentUser'
import {getLanguage, fetchLanguage} from './store/language'
import {useAppSelector, useAppDispatch} from './store/hooks'

const App = React.memo((): JSX.Element => {
    importNativeAppSettings()

    const language = useAppSelector<string>(getLanguage)

    const user = useAppSelector<IUser|null>(getCurrentUser)
    const dispatch = useAppDispatch()
    const [initialLoad, setInitialLoad] = useState(false)

    useEffect(() => {
        dispatch(fetchLanguage())
        dispatch(fetchCurrentUser()).then(() => {
            setInitialLoad(true)
        })
    }, [])

    return (
        <IntlProvider
            locale={language.split(/[_]/)[0]}
            messages={getMessages(language)}
        >
            <DndProvider backend={Utils.isMobile() ? TouchBackend : HTML5Backend}>
                <FlashMessages milliseconds={2000}/>
                <Router
                    forceRefresh={true}
                    basename={Utils.getFrontendBaseURL()}
                >
                    <div id='frame'>
                        <div id='main'>
                            <Switch>
                                <Route path='/error'>
                                    <ErrorPage/>
                                </Route>
                                <Route path='/login'>
                                    <LoginPage/>
                                </Route>
                                <Route path='/register'>
                                    <RegisterPage/>
                                </Route>
                                <Route path='/change_password'>
                                    <ChangePasswordPage/>
                                </Route>
                                <Route path='/shared/:boardId?/:viewId?'>
                                    <BoardPage readonly={true}/>
                                </Route>
                                <Route path='/board/:boardId?/:viewId?'>
                                    {initialLoad && !user && <Redirect to='/login'/>}
                                    <BoardPage/>
                                </Route>
                                <Route path='/workspace/:workspaceId/shared/:boardId?/:viewId?'>
                                    <BoardPage readonly={true}/>
                                </Route>
                                <Route
                                    path='/workspace/:workspaceId/:boardId?/:viewId?'
                                    render={({match}) => {
                                        if (initialLoad && !user) {
                                            let redirectUrl = '/' + Utils.buildURL(`/workspace/${match.params.workspaceId}/`)
                                            if (redirectUrl.indexOf('//') === 0) {
                                                redirectUrl = redirectUrl.slice(1)
                                            }
                                            const loginUrl = `/login?r=${encodeURIComponent(redirectUrl)}`
                                            return <Redirect to={loginUrl}/>
                                        }
                                        return (
                                            <BoardPage/>
                                        )
                                    }}
                                />
                                <Route path='/:boardId?/:viewId?'>
                                    {initialLoad && !user && <Redirect to='/login'/>}
                                    <BoardPage/>
                                </Route>
                            </Switch>
                        </div>
                    </div>
                </Router>
            </DndProvider>
        </IntlProvider>
    )
})

export default App

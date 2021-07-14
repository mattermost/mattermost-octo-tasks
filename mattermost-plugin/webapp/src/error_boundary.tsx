// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

type Props = {}
type State = {
    hasError: boolean
}

export default class ErrorBoundary<Props, State> extends React.Component {
    state = {hasError: false}

    static getDerivedStateFromError(error: Error) {
        return {hasError: true}
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.log(error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return <span>Something went wrong.</span>
        }
        return this.props.children
    }
}

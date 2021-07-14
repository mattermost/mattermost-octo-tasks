// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react'
import ReactDOM from 'react-dom'

type Props = {
    children: React.ReactNode
}

const RootPortal = React.memo((props: Props): JSX.Element => {
    const [el] = useState(document.createElement('div'))
    const rootPortal = document.getElementById('focalboard-root-portal')

    useEffect(() => {
        if (rootPortal) {
            rootPortal.appendChild(el)
        }
        return () => {
            if (rootPortal) {
                rootPortal.removeChild(el)
            }
        }
    }, [])

    return ReactDOM.createPortal(props.children, el)  // eslint-disable-line
})

export default RootPortal

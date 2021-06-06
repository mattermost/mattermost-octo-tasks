// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useRef, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'
import {useHotkeys} from 'react-hotkeys-hook'

import {BoardTree} from '../../viewModel/boardTree'
import Button from '../../widgets/buttons/button'
import Editable from '../../widgets/editable'

type Props = {
    boardTree: BoardTree
    setSearchText: (text?: string) => void
}

const ViewHeaderSearch = (props: Props) => {
    const {boardTree, setSearchText} = props
    const intl = useIntl()

    const searchFieldRef = useRef<{focus(selectAll?: boolean): void}>(null)
    const [isSearching, setIsSearching] = useState(Boolean(boardTree.getSearchText()))
    const [searchValue, setSearchValue] = useState(boardTree.getSearchText())

    useEffect(() => {
        searchFieldRef.current?.focus()
    }, [isSearching])

    useHotkeys('ctrl+shift+f,cmd+shift+f', () => {
        setIsSearching(true)
        searchFieldRef.current?.focus(true)
    })

    if (isSearching) {
        return (
            <Editable
                ref={searchFieldRef}
                value={searchValue}
                placeholderText={intl.formatMessage({id: 'ViewHeader.search-text', defaultMessage: 'Search text'})}
                onChange={setSearchValue}
                onCancel={() => {
                    setSearchValue('')
                    setIsSearching(false)
                    setSearchText('')
                }}
                onSave={() => {
                    if (searchValue === '') {
                        setIsSearching(false)
                    }
                    setSearchText(searchValue)
                }}
            />
        )
    }
    return (
        <Button onClick={() => setIsSearching(true)}>
            <FormattedMessage
                id='ViewHeader.search'
                defaultMessage='Search'
            />
        </Button>
    )
}

export default ViewHeaderSearch

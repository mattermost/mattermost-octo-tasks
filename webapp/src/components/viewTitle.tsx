// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {BlockIcons} from '../blockIcons'
import {Board} from '../blocks/board'
import mutator from '../mutator'
import Button from '../widgets/buttons/button'
import Editable from '../widgets/editable'
import EmojiIcon from '../widgets/icons/emoji'
import HideIcon from '../widgets/icons/hide'
import ShowIcon from '../widgets/icons/show'

import BlockIconSelector from './blockIconSelector'
import {MarkdownEditor} from './markdownEditor'
import './viewTitle.scss'

type Props = {
    board: Board
    readonly: boolean
}

const ViewTitle = React.memo((props: Props) => {
    const [title, setTitle] = useState(props.board.title)

    const {board} = props
    const intl = useIntl()

    return (
        <div className='ViewTitle'>
            <div className='add-buttons add-visible'>
                {!props.readonly && !board.icon &&
                    <Button
                        onClick={() => {
                            const newIcon = BlockIcons.shared.randomIcon()
                            mutator.changeIcon(board, newIcon)
                        }}
                        icon={<EmojiIcon/>}
                    >
                        <FormattedMessage
                            id='TableComponent.add-icon'
                            defaultMessage='Add icon'
                        />
                    </Button>
                }
                {!props.readonly && board.showDescription &&
                    <Button
                        onClick={() => {
                            mutator.showDescription(board, false)
                        }}
                        icon={<HideIcon/>}
                    >
                        <FormattedMessage
                            id='ViewTitle.hide-description'
                            defaultMessage='hide description'
                        />
                    </Button>
                }
                {!props.readonly && !board.showDescription &&
                    <Button
                        onClick={() => {
                            mutator.showDescription(board, true)
                        }}
                        icon={<ShowIcon/>}
                    >
                        <span className="non-breaking-space"></span>
                        <FormattedMessage
                            id='ViewTitle.show-description'
                            defaultMessage='show description'
                        />
                    </Button>
                }
            </div>

            <div className='title'>
                <BlockIconSelector block={board}/>
                <Editable
                    className='title'
                    value={title}
                    placeholderText={intl.formatMessage({id: 'ViewTitle.untitled-board', defaultMessage: 'Untitled board'})}
                    onChange={(newTitle) => setTitle(newTitle)}
                    saveOnEsc={true}
                    onSave={() => mutator.changeTitle(board, title)}
                    onCancel={() => setTitle(props.board.title)}
                    readonly={props.readonly}
                    spellCheck={true}
                />
            </div>

            {board.showDescription &&
                <div className='description'>
                    <MarkdownEditor
                        text={board.description}
                        placeholderText='Add a description...'
                        onBlur={(text) => {
                            mutator.changeDescription(board, text)
                        }}
                        readonly={props.readonly}
                    />
                </div>
            }
        </div>
    )
})

export default ViewTitle

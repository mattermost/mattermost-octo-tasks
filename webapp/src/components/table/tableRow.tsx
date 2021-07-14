// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useRef, useEffect} from 'react'
import {FormattedMessage, useIntl} from 'react-intl'

import {Utils} from '../../utils'
import {Card} from '../../blocks/card'
import {Constants} from '../../constants'
import mutator from '../../mutator'
import {BoardTree} from '../../viewModel/boardTree'
import Button from '../../widgets/buttons/button'
import Editable from '../../widgets/editable'
import {useSortable} from '../../hooks/sortable'

import IconButton from '../../widgets/buttons/iconButton'
import DeleteIcon from '../../widgets/icons/delete'
import OptionsIcon from '../../widgets/icons/options'
import Menu from '../../widgets/menu'
import MenuWrapper from '../../widgets/menuWrapper'

import PropertyValueElement from '../propertyValueElement'
import './tableRow.scss'
import {CardTree} from '../../viewModel/cardTree'

type Props = {
    boardTree: BoardTree
    card: Card
    cardTree?: CardTree
    isSelected: boolean
    focusOnMount: boolean
    onSaveWithEnter: () => void
    showCard: (cardId: string) => void
    readonly: boolean
    offset: number
    resizingColumn: string
    columnRefs: Map<string, React.RefObject<HTMLDivElement>>
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
    onDrop: (srcCard: Card, dstCard: Card) => void
}

const TableRow = React.memo((props: Props) => {
    const {boardTree, onSaveWithEnter, columnRefs} = props
    const intl = useIntl()
    const {board, activeView} = boardTree

    const titleRef = useRef<{focus(selectAll?: boolean): void}>(null)
    const [title, setTitle] = useState(props.card.title)
    const {card} = props
    const isManualSort = activeView.sortOptions.length === 0
    const isGrouped = Boolean(activeView.groupById)
    const [isDragging, isOver, cardRef] = useSortable('card', card, !props.readonly && (isManualSort || isGrouped), props.onDrop)

    useEffect(() => {
        if (props.focusOnMount) {
            setTimeout(() => titleRef.current?.focus(), 10)
        }
    }, [])

    const columnWidth = (templateId: string): number => {
        if (props.resizingColumn === templateId) {
            return Math.max(Constants.minColumnWidth, (props.boardTree.activeView.columnWidths[templateId] || 0) + props.offset)
        }
        return Math.max(Constants.minColumnWidth, props.boardTree.activeView.columnWidths[templateId] || 0)
    }

    let className = props.isSelected ? 'TableRow octo-table-row selected' : 'TableRow octo-table-row'
    if (isOver) {
        className += ' dragover'
    }
    if (isGrouped) {
        const groupID = activeView.groupById || ''
        const groupValue = card.properties[groupID] as string || 'undefined'
        if (activeView.collapsedOptionIds.indexOf(groupValue) > -1) {
            className += ' hidden'
        }
    }

    if (!columnRefs.get(Constants.titleColumnId)) {
        columnRefs.set(Constants.titleColumnId, React.createRef())
    }

    return (
        <div
            className={className}
            onClick={props.onClick}
            ref={cardRef}
            style={{opacity: isDragging ? 0.5 : 1}}
        >

            {/* Name / title */}
            <div
                className='octo-table-cell title-cell'
                id='mainBoardHeader'
                style={{width: columnWidth(Constants.titleColumnId)}}
                ref={columnRefs.get(Constants.titleColumnId)}
            >
                <div className='octo-icontitle'>
                    <div className='octo-icon'>{card.icon}</div>
                    <Editable
                        ref={titleRef}
                        value={title}
                        placeholderText='Untitled'
                        onChange={(newTitle: string) => setTitle(newTitle)}
                        onSave={(saveType) => {
                            mutator.changeTitle(card, title)
                            if (saveType === 'onEnter') {
                                onSaveWithEnter()
                            }
                        }}
                        onCancel={() => setTitle(card.title)}
                        readonly={props.readonly}
                        spellCheck={true}
                    />
                </div>

                <div className='open-button'>
                    <Button onClick={() => props.showCard(props.card.id)}>
                        <FormattedMessage
                            id='TableRow.open'
                            defaultMessage='Open'
                        />
                    </Button>
                </div>
            </div>

            {/* Columns, one per property */}

            {board.cardProperties.
                filter((template) => activeView.visiblePropertyIds.includes(template.id)).
                map((template) => {
                    if (!columnRefs.get(template.id)) {
                        columnRefs.set(template.id, React.createRef())
                    }
                    return (
                        <div
                            className='octo-table-cell'
                            key={template.id}
                            style={{width: columnWidth(template.id)}}
                            ref={columnRefs.get(template.id)}
                        >
                            <PropertyValueElement
                                readOnly={props.readonly}
                                card={card}
                                cardTree={props.cardTree}
                                boardTree={boardTree}
                                propertyTemplate={template}
                                emptyDisplayValue=''
                            />
                        </div>)
                })}

            <MenuWrapper
                className='optionsMenu'
                stopPropagationOnToggle={true}
            >
                <IconButton icon={<OptionsIcon/>}/>
                <Menu position='left'>
                    <Menu.Text
                        icon={<DeleteIcon/>}
                        id='delete'
                        name={intl.formatMessage({id: 'TableRow.delete', defaultMessage: 'Delete'})}
                        onClick={async () => {
                            if (!card) {
                                Utils.assertFailure()
                                return
                            }
                            await mutator.deleteBlock(card, 'delete card')
                        }}
                    />

                </Menu>
            </MenuWrapper>
        </div>
    )
})

export default TableRow

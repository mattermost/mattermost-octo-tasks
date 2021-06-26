// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {useIntl} from 'react-intl'

import {Card} from '../blocks/card'
import {IContentBlock} from '../blocks/contentBlock'
import mutator from '../mutator'
import {Utils} from '../utils'
import IconButton from '../widgets/buttons/iconButton'
import AddIcon from '../widgets/icons/add'
import DeleteIcon from '../widgets/icons/delete'
import OptionsIcon from '../widgets/icons/options'
import SortDownIcon from '../widgets/icons/sortDown'
import SortUpIcon from '../widgets/icons/sortUp'
import GripIcon from '../widgets/icons/grip'
import Menu from '../widgets/menu'
import MenuWrapper from '../widgets/menuWrapper'
import {useSortableWithGrip} from '../hooks/sortable'

import ContentElement from './content/contentElement'
import AddContentMenuItem from './addContentMenuItem'
import {contentRegistry} from './content/contentRegistry'
import './contentBlock.scss'

type Props = {
    block: IContentBlock
    card: Card
    readonly: boolean
    onDrop: (srctBlock: IContentBlock, dstBlock: IContentBlock, isParallel?: boolean) => void
}

const ContentBlock = React.memo((props: Props): JSX.Element => {
    const {card, block, readonly} = props
    const intl = useIntl()
    const [isDragging, isOver, gripRef, itemRef] = useSortableWithGrip('content', block, true, props.onDrop)
    const [, isOver2,, itemRef2] = useSortableWithGrip('content', block, true, (src, dst) => props.onDrop(src, dst, true))

    let index = card.contentOrder.indexOf(block.id)
    let colIndex = -1
    let contentOrder = card.contentOrder.slice()
    if (index === -1) {
        contentOrder.find((item, idx) => {
            if (Array.isArray(item) && item.includes(block.id)) {
                index = idx
                colIndex = item.indexOf(block.id)
                return
            }
        })    
    }


    let className = 'ContentBlock octo-block'
    if (isOver) {
        className += ' dragover'
    }
    return (
        <div className="rowContents">
        <div
            className={className}
            style={{opacity: isDragging ? 0.5 : 1, marginLeft: -10}}
            ref={itemRef}
        >
            <div className='octo-block-margin'>
                {!props.readonly &&
                    <MenuWrapper>
                        <IconButton icon={<OptionsIcon/>}/>
                        <Menu>
                            {index > 0 &&
                                <Menu.Text
                                    id='moveUp'
                                    name={intl.formatMessage({id: 'ContentBlock.moveUp', defaultMessage: 'Move up'})}
                                    icon={<SortUpIcon/>}
                                    onClick={() => {
                                        Utils.arrayMove(contentOrder, index, index - 1)
                                        mutator.changeCardContentOrder(card, contentOrder)
                                    }}
                                />}
                            {index < (contentOrder.length - 1) &&
                                <Menu.Text
                                    id='moveDown'
                                    name={intl.formatMessage({id: 'ContentBlock.moveDown', defaultMessage: 'Move down'})}
                                    icon={<SortDownIcon/>}
                                    onClick={() => {
                                        Utils.arrayMove(contentOrder, index, index + 1)
                                        mutator.changeCardContentOrder(card, contentOrder)
                                    }}
                                />}
                            <Menu.SubMenu
                                id='insertAbove'
                                name={intl.formatMessage({id: 'ContentBlock.insertAbove', defaultMessage: 'Insert above'})}
                                icon={<AddIcon/>}
                            >
                                {contentRegistry.contentTypes.map((type) => (
                                    <AddContentMenuItem
                                        key={type}
                                        type={type}
                                        block={block}
                                        card={card}
                                    />
                                ))}
                            </Menu.SubMenu>
                            <Menu.Text
                                icon={<DeleteIcon/>}
                                id='delete'
                                name={intl.formatMessage({id: 'ContentBlock.Delete', defaultMessage: 'Delete'})}
                                onClick={() => {
                                    const description = intl.formatMessage({id: 'ContentBlock.DeleteAction', defaultMessage: 'delete'})
                                    colIndex > -1 ? (contentOrder[index] as string[]).splice(colIndex, 1) : contentOrder.splice(index, 1)

                                    if (Array.isArray(contentOrder[index]) && contentOrder[index].length === 1) {
                                        contentOrder[index] = contentOrder[index][0]
                                    }

                                    mutator.performAsUndoGroup(async () => {
                                        await mutator.deleteBlock(block, description)
                                        await mutator.changeCardContentOrder(card, contentOrder, description)
                                    })
                                }}
                            />
                        </Menu>
                    </MenuWrapper>
                }
                {!props.readonly &&
                    <div
                        ref={gripRef}
                        className='dnd-handle'
                    >
                        <GripIcon/>
                    </div>
                }
            </div>
            <ContentElement
                block={block}
                readonly={readonly}
            />
        </div>
        <div
            ref={itemRef2}
            className={`addToRow ${isOver2 ? 'dragover' : ''}`}
        >
        </div>
        </div>
    )
})

export default ContentBlock

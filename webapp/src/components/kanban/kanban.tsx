// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable max-lines */
import React from 'react'
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl'

import {IPropertyOption} from '../../blocks/board'
import {Card} from '../../blocks/card'
import {Utils} from '../../utils'
import {BoardTree} from '../../viewModel/boardTree'
import Button from '../../widgets/buttons/button'

import KanbanCard from './kanbanCard'
import KanbanColumn from './kanbanColumn'
import KanbanColumnHeader from './kanbanColumnHeader'
import KanbanHiddenColumnItem from './kanbanHiddenColumnItem'
import * as mutations from './kanban.mutations'

import './kanban.scss'

type Props = {
    boardTree: BoardTree
    selectedCardIds: string[]
    intl: IntlShape
    readonly: boolean
    onCardClicked: (e: React.MouseEvent, card: Card) => void
    addCard: (groupByOptionId?: string) => Promise<void>
}

type State = {
    draggedCards: Card[]
    draggedHeaderOption?: IPropertyOption
}

class Kanban extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            draggedCards: [],
        }
    }

    shouldComponentUpdate(): boolean {
        return true
    }

    render(): JSX.Element {
        const {boardTree} = this.props
        const {groupByProperty} = boardTree

        if (!groupByProperty) {
            Utils.assertFailure('Board views must have groupByProperty set')
            return <div/>
        }

        const propertyValues = groupByProperty.options || []
        Utils.log(`${propertyValues.length} propertyValues`)

        const {board, activeView, visibleGroups, hiddenGroups} = boardTree
        const visiblePropertyTemplates = board.cardProperties.filter((template) => activeView.visiblePropertyIds.includes(template.id))
        const isManualSort = activeView.sortOptions.length < 1

        return (
            <div className='Kanban'>
                <div
                    className='octo-board-header'
                    id='mainBoardHeader'
                >
                    {/* Column headers */}

                    {visibleGroups.map((group) => (
                        <KanbanColumnHeader
                            key={group.option.id}
                            group={group}
                            boardTree={boardTree}
                            intl={this.props.intl}
                            addCard={this.props.addCard}
                            readonly={this.props.readonly}
                            propertyNameChanged={(option, text) => mutations.propertyNameChanged(boardTree, option, text)}
                            onDropToColumn={(option, card, dstOption) => mutations.onDropToColumn(boardTree, this.props.selectedCardIds, option, card, dstOption)}
                        />
                    ))}

                    {/* Hidden column header */}

                    {hiddenGroups.length > 0 &&
                        <div className='octo-board-header-cell narrow'>
                            <FormattedMessage
                                id='BoardComponent.hidden-columns'
                                defaultMessage='Hidden columns'
                            />
                        </div>
                    }

                    {!this.props.readonly &&
                        <div className='octo-board-header-cell narrow'>
                            <Button onClick={() => mutations.addGroupClicked(boardTree)}>
                                <FormattedMessage
                                    id='BoardComponent.add-a-group'
                                    defaultMessage='+ Add a group'
                                />
                            </Button>
                        </div>
                    }
                </div>

                {/* Main content */}

                <div
                    className='octo-board-body'
                    id='mainBoardBody'
                >
                    {/* Columns */}

                    {visibleGroups.map((group) => (
                        <KanbanColumn
                            key={group.option.id || 'empty'}
                            onDrop={(card: Card) => mutations.onDropToColumn(boardTree, this.props.selectedCardIds, group.option, card)}
                        >
                            {group.cards.map((card) => (
                                <KanbanCard
                                    card={card}
                                    visiblePropertyTemplates={visiblePropertyTemplates}
                                    key={card.id}
                                    readonly={this.props.readonly}
                                    isSelected={this.props.selectedCardIds.includes(card.id)}
                                    onClick={(e) => {
                                        this.props.onCardClicked(e, card)
                                    }}
                                    onDrop={(srcCard, dstCard) => mutations.onDropToCard(boardTree, this.props.selectedCardIds, srcCard, dstCard)}
                                    isManualSort={isManualSort}
                                />
                            ))}
                            {!this.props.readonly &&
                                <Button
                                    onClick={() => {
                                        this.props.addCard(group.option.id)
                                    }}
                                >
                                    <FormattedMessage
                                        id='BoardComponent.new'
                                        defaultMessage='+ New'
                                    />
                                </Button>
                            }
                        </KanbanColumn>
                    ))}

                    {/* Hidden columns */}

                    {hiddenGroups.length > 0 &&
                        <div className='octo-board-column narrow'>
                            {hiddenGroups.map((group) => (
                                <KanbanHiddenColumnItem
                                    key={group.option.id}
                                    group={group}
                                    boardTree={boardTree}
                                    intl={this.props.intl}
                                    readonly={this.props.readonly}
                                    onDrop={(card: Card) => mutations.onDropToColumn(boardTree, this.props.selectedCardIds, group.option, card)}
                                />
                            ))}
                        </div>}
                </div>
            </div>
        )
    }

}

export default injectIntl(Kanban)

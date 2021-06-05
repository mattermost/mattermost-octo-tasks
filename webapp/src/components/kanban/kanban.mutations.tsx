// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IPropertyOption} from '../../blocks/board'
import {Card} from '../../blocks/card'
import mutator from '../../mutator'
import {Utils} from '../../utils'
import {BoardTree} from '../../viewModel/boardTree'

export const propertyNameChanged = async (boardTree: BoardTree, option: IPropertyOption, text: string): Promise<void> => {
    await mutator.changePropertyOptionValue(boardTree, boardTree.groupByProperty!, option, text)
}

export const addGroupClicked = async (boardTree: BoardTree): Promise<void> => {
    Utils.log('onAddGroupClicked')

    const option: IPropertyOption = {
        id: Utils.createGuid(),
        value: 'New group',
        color: 'propColorDefault',
    }

    await mutator.insertPropertyOption(boardTree, boardTree.groupByProperty!, option, 'add group')
}

export const onDropToColumn = async (boardTree: BoardTree, selectedCardIds: string[], option: IPropertyOption, card?: Card, dstOption?: IPropertyOption): Promise<void> => {
    const optionId = option ? option.id : undefined

    let draggedCardIds = selectedCardIds
    if (card) {
        draggedCardIds = Array.from(new Set(selectedCardIds).add(card.id))
    }

    Utils.assertValue(boardTree)

    if (draggedCardIds.length > 0) {
        const orderedCards = boardTree.orderedCards()
        const cardsById: {[key: string]: Card} = orderedCards.reduce((acc: {[key: string]: Card}, c: Card): {[key: string]: Card} => {
            acc[c.id] = c
            return acc
        }, {})
        const draggedCards: Card[] = draggedCardIds.map((o: string) => cardsById[o])
        await mutator.performAsUndoGroup(async () => {
            const description = draggedCards.length > 1 ? `drag ${draggedCards.length} cards` : 'drag card'
            const awaits = []
            for (const draggedCard of draggedCards) {
                Utils.log(`ondrop. Card: ${draggedCard.title}, column: ${optionId}`)
                const oldValue = draggedCard.properties[boardTree.groupByProperty!.id]
                if (optionId !== oldValue) {
                    awaits.push(mutator.changePropertyValue(draggedCard, boardTree.groupByProperty!.id, optionId, description))
                }
            }
            await Promise.all(awaits)
        })
    } else if (dstOption) {
        Utils.log(`ondrop. Header option: ${dstOption.value}, column: ${option?.value}`)

        // Move option to new index
        const visibleOptionIds = boardTree.visibleGroups.map((o) => o.option.id)

        const {activeView} = boardTree
        const srcIndex = visibleOptionIds.indexOf(dstOption.id)
        const destIndex = visibleOptionIds.indexOf(option.id)

        visibleOptionIds.splice(destIndex, 0, visibleOptionIds.splice(srcIndex, 1)[0])

        await mutator.changeViewVisibleOptionIds(activeView, visibleOptionIds)
    }
}

export const onDropToCard = async (boardTree: BoardTree, selectedCardIds: string[], srcCard: Card, dstCard: Card): Promise<void> => {
    Utils.log(`onDropToCard: ${dstCard.title}`)
    const {activeView} = boardTree
    const optionId = dstCard.properties[activeView.groupById!]

    const draggedCardIds = Array.from(new Set(selectedCardIds).add(srcCard.id))

    const description = draggedCardIds.length > 1 ? `drag ${draggedCardIds.length} cards` : 'drag card'

    // Update dstCard order
    const orderedCards = boardTree.orderedCards()
    const cardsById: {[key: string]: Card} = orderedCards.reduce((acc: {[key: string]: Card}, card: Card): {[key: string]: Card} => {
        acc[card.id] = card
        return acc
    }, {})
    const draggedCards: Card[] = draggedCardIds.map((o: string) => cardsById[o])
    let cardOrder = orderedCards.map((o) => o.id)
    const isDraggingDown = cardOrder.indexOf(srcCard.id) <= cardOrder.indexOf(dstCard.id)
    cardOrder = cardOrder.filter((id) => !draggedCardIds.includes(id))
    let destIndex = cardOrder.indexOf(dstCard.id)
    if (srcCard.properties[boardTree.groupByProperty!.id] === optionId && isDraggingDown) {
        // If the cards are in the same column and dragging down, drop after the target dstCard
        destIndex += 1
    }
    cardOrder.splice(destIndex, 0, ...draggedCardIds)

    await mutator.performAsUndoGroup(async () => {
        // Update properties of dragged cards
        const awaits = []
        for (const draggedCard of draggedCards) {
            Utils.log(`draggedCard: ${draggedCard.title}, column: ${optionId}`)
            const oldOptionId = draggedCard.properties[boardTree.groupByProperty!.id]
            if (optionId !== oldOptionId) {
                awaits.push(mutator.changePropertyValue(draggedCard, boardTree.groupByProperty!.id, optionId, description))
            }
        }
        await Promise.all(awaits)
        await mutator.changeViewCardOrder(activeView, cardOrder, description)
    })
}

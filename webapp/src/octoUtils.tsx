// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntlShape} from 'react-intl'

import {IBlock, MutableBlock} from './blocks/block'
import {IPropertyTemplate, MutableBoard} from './blocks/board'
import {MutableBoardView} from './blocks/boardView'
import {MutableCard} from './blocks/card'
import {MutableCommentBlock} from './blocks/commentBlock'
import {MutableCheckboxBlock} from './blocks/checkboxBlock'
import {MutableDividerBlock} from './blocks/dividerBlock'
import {MutableImageBlock} from './blocks/imageBlock'
import {MutableTextBlock} from './blocks/textBlock'
import {FilterCondition} from './blocks/filterClause'
import {Utils} from './utils'

class OctoUtils {
    static propertyDisplayValue(block: IBlock, propertyValue: string | string[] | undefined, propertyTemplate: IPropertyTemplate, intl: IntlShape): string | string[] | undefined {
        let displayValue: string | string[] | undefined
        switch (propertyTemplate.type) {
        case 'select': {
            // The property value is the id of the template
            if (propertyValue) {
                const option = propertyTemplate.options.find((o) => o.id === propertyValue)
                if (!option) {
                    Utils.assertFailure(`Invalid select option ID ${propertyValue}, block.title: ${block.title}`)
                }
                displayValue = option?.value || '(Unknown)'
            }
            break
        }
        case 'createdTime': {
            displayValue = Utils.displayDateTime(new Date(block.createAt), intl)
            break
        }
        case 'updatedTime': {
            displayValue = Utils.displayDateTime(new Date(block.updateAt), intl)
            break
        }
        case 'date': {
            if (propertyValue) {
                displayValue = Utils.displayDate(new Date(parseInt(propertyValue as string, 10)), intl)
            }
            break
        }
        default:
            displayValue = propertyValue
        }

        return displayValue
    }

    static relativeBlockOrder(partialOrder: readonly string[], blocks: readonly IBlock[], blockA: IBlock, blockB: IBlock): number {
        const orderA = partialOrder.indexOf(blockA.id)
        const orderB = partialOrder.indexOf(blockB.id)

        if (orderA >= 0 && orderB >= 0) {
            // Order of both blocks is specified
            return orderA - orderB
        }
        if (orderA >= 0) {
            return -1
        }
        if (orderB >= 0) {
            return 1
        }

        // Order of both blocks are unspecified, use create date
        return blockA.createAt - blockB.createAt
    }

    static getBlockOrder(partialOrder: readonly string[], blocks: readonly IBlock[]): IBlock[] {
        return blocks.slice().sort((a, b) => this.relativeBlockOrder(partialOrder, blocks, a, b))
    }

    static hydrateBlock(block: IBlock): MutableBlock {
        switch (block.type) {
        case 'board': { return new MutableBoard(block) }
        case 'view': { return new MutableBoardView(block) }
        case 'card': { return new MutableCard(block) }
        case 'text': { return new MutableTextBlock(block) }
        case 'image': { return new MutableImageBlock(block) }
        case 'divider': { return new MutableDividerBlock(block) }
        case 'comment': { return new MutableCommentBlock(block) }
        case 'checkbox': { return new MutableCheckboxBlock(block) }
        default: {
            Utils.assertFailure(`Can't hydrate unknown block type: ${block.type}`)
            return new MutableBlock(block)
        }
        }
    }

    static hydrateBlocks(blocks: readonly IBlock[]): MutableBlock[] {
        return blocks.map((block) => this.hydrateBlock(block))
    }

    static mergeBlocks(blocks: readonly IBlock[], updatedBlocks: readonly IBlock[]): IBlock[] {
        const updatedBlockIds = updatedBlocks.map((o) => o.id)
        const newBlocks = blocks.filter((o) => !updatedBlockIds.includes(o.id))
        const updatedAndNotDeletedBlocks = updatedBlocks.filter((o) => o.deleteAt === 0)
        newBlocks.push(...updatedAndNotDeletedBlocks)
        return newBlocks
    }

    // Creates a copy of the blocks with new ids and parentIDs
    static duplicateBlockTree(blocks: readonly IBlock[], sourceBlockId: string): [MutableBlock[], MutableBlock, Readonly<Record<string, string>>] {
        const idMap: Record<string, string> = {}
        const now = Date.now()
        const newBlocks = blocks.map((block) => {
            const newBlock = this.hydrateBlock(block)
            newBlock.id = Utils.createGuid()
            newBlock.createAt = now
            newBlock.updateAt = now
            idMap[block.id] = newBlock.id
            return newBlock
        })

        const newSourceBlockId = idMap[sourceBlockId]

        // Determine the new rootId if needed
        let newRootId: string
        const sourceBlock = blocks.find((block) => block.id === sourceBlockId)!
        if (sourceBlock.rootId === sourceBlock.id) {
            // Special case: when duplicating a tree from root, remap all the descendant rootIds
            const newSourceRootBlock = newBlocks.find((block) => block.id === newSourceBlockId)!
            newRootId = newSourceRootBlock.id
        }

        newBlocks.forEach((newBlock) => {
            // Note: Don't remap the parent of the new root block
            if (newBlock.id !== newSourceBlockId && newBlock.parentId) {
                newBlock.parentId = idMap[newBlock.parentId] || newBlock.parentId
                Utils.assert(newBlock.parentId, `Block ${newBlock.id} (${newBlock.type} ${newBlock.title}) has no parent`)
            }

            // Remap the rootIds if we are duplicating a tree from root
            if (newRootId) {
                newBlock.rootId = newRootId
            }

            // Remap manual card order
            if (newBlock.type === 'view') {
                const view = newBlock as MutableBoardView
                view.cardOrder = view.cardOrder.map((o) => idMap[o])
            }

            // Remap card content order
            if (newBlock.type === 'card') {
                const card = newBlock as MutableCard
                card.contentOrder = card.contentOrder.map((o) => idMap[o])
            }
        })

        const newSourceBlock = newBlocks.find((block) => block.id === newSourceBlockId)!
        return [newBlocks, newSourceBlock, idMap]
    }

    static filterConditionDisplayString(filterCondition: FilterCondition, intl: IntlShape): string {
        switch (filterCondition) {
        case 'includes': return intl.formatMessage({id: 'Filter.includes', defaultMessage: 'includes'})
        case 'notIncludes': return intl.formatMessage({id: 'Filter.not-includes', defaultMessage: 'doesn\'t include'})
        case 'isEmpty': return intl.formatMessage({id: 'Filter.is-empty', defaultMessage: 'is empty'})
        case 'isNotEmpty': return intl.formatMessage({id: 'Filter.is-not-empty', defaultMessage: 'is not empty'})
        default: {
            Utils.assertFailure()
            return '(unknown)'
        }
        }
    }
}

export {OctoUtils}

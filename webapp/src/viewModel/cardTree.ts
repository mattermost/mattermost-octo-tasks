// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {ContentBlockTypes, contentBlockTypes, IBlock, MutableBlock} from '../blocks/block'
import {Card, MutableCard} from '../blocks/card'
import {CommentBlock} from '../blocks/commentBlock'
import {IContentBlock} from '../blocks/contentBlock'
import octoClient from '../octoClient'
import {OctoUtils} from '../octoUtils'

interface CardTree {
    readonly card: Card
    readonly comments: readonly CommentBlock[]
    readonly contents: Readonly<Array< IContentBlock |IContentBlock[] >>
    readonly allBlocks: readonly IBlock[]
    readonly latestBlock: IBlock
}

class MutableCardTree implements CardTree {
    card: MutableCard
    comments: CommentBlock[] = []
    contents: (IContentBlock[] | IContentBlock)[] = []
    latestBlock: IBlock

    get allBlocks(): IBlock[] {
        return [this.card, ...this.comments, ...this.contents.flat()]
    }

    constructor(card: MutableCard) {
        this.card = card
        this.latestBlock = card
    }

    // Factory methods

    static async sync(boardId: string): Promise<CardTree | undefined> {
        const rawBlocks = await octoClient.getSubtree(boardId)
        return this.buildTree(boardId, rawBlocks)
    }

    static incrementalUpdate(cardTree: CardTree, updatedBlocks: IBlock[]): CardTree | undefined {
        const relevantBlocks = updatedBlocks.filter((block) => block.deleteAt !== 0 || block.id === cardTree.card.id || block.parentId === cardTree.card.id)
        if (relevantBlocks.length < 1) {
            // No change
            return cardTree
        }
        const rawBlocks = OctoUtils.mergeBlocks(cardTree.allBlocks, relevantBlocks)
        return this.buildTree(cardTree.card.id, rawBlocks)
    }

    private static buildTree(cardId: string, sourceBlocks: readonly IBlock[]): MutableCardTree | undefined {
        const blocks = OctoUtils.hydrateBlocks(sourceBlocks)

        const card = blocks.find((o) => o.type === 'card' && o.id === cardId) as MutableCard
        if (!card) {
            return undefined
        }
        const cardTree = new MutableCardTree(card)
        cardTree.comments = blocks.
            filter((block) => block.type === 'comment').
            sort((a, b) => a.createAt - b.createAt) as CommentBlock[]

        const contentBlocks = blocks.filter((block) => contentBlockTypes.includes(block.type as ContentBlockTypes)) as IContentBlock[]

        cardTree.contents = card.contentOrder.map((contentIds) => {
            if (Array.isArray(contentIds)) {
                return contentIds.map((contentId) => contentBlocks.find((content) => content.id === contentId)).filter((content): content is IContentBlock => Boolean(content))
            }

            return contentBlocks.find((content) => content.id === contentIds) || new MutableBlock()
        })

        cardTree.latestBlock = MutableCardTree.getMostRecentBlock(cardTree)

        return cardTree
    }

    public static getMostRecentBlock(cardTree: CardTree): IBlock {
        let latestBlock: IBlock = cardTree.card
        cardTree.allBlocks.forEach((block) => {
            if (latestBlock) {
                latestBlock = block.updateAt > latestBlock.updateAt ? block : latestBlock
            } else {
                latestBlock = block
            }
        })
        return latestBlock
    }
}

const CardTreeContext = React.createContext<CardTree | undefined>(undefined)

export {MutableCardTree, CardTree, CardTreeContext}

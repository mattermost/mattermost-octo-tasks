// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Disable console log
console.log = jest.fn()

import 'isomorphic-fetch'
import {TestBlockFactory} from '../test/testBlockFactory'
import {FetchMock} from '../test/fetchMock'

import {Utils} from '../utils'

import {CardTree, MutableCardTree} from './cardTree'

global.fetch = FetchMock.fn

beforeEach(() => {
    FetchMock.fn.mockReset()
})

test('CardTree', async () => {
    const card = TestBlockFactory.createCard()
    expect(card.id).not.toBeNull()
    const comment = TestBlockFactory.createComment(card)

    // Content
    const text = TestBlockFactory.createText(card)
    await Utils.sleep(10)
    const image = TestBlockFactory.createImage(card)
    await Utils.sleep(10)
    const divider = TestBlockFactory.createDivider(card)
    card.contentOrder = [image.id, divider.id, text.id]

    let cardTree: CardTree | undefined

    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify([card, comment, text, image, divider])))
    cardTree = await MutableCardTree.sync('invalid_id')
    expect(cardTree).toBeUndefined()
    expect(FetchMock.fn).toBeCalledTimes(1)

    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify([card, comment, text, image, divider])))
    cardTree = await MutableCardTree.sync(card.id)
    expect(cardTree).not.toBeUndefined()
    if (!cardTree) {
        fail('sync')
    }

    expect(FetchMock.fn).toBeCalledTimes(2)
    expect(cardTree.card).toEqual(card)
    expect(cardTree.comments).toEqual([comment])
    expect(cardTree.contents).toEqual([image, divider, text]) // Must match specified card.contentOrder

    // Incremental update
    const comment2 = TestBlockFactory.createComment(card)
    const text2 = TestBlockFactory.createText(card)
    await Utils.sleep(10)
    const image2 = TestBlockFactory.createImage(card)
    await Utils.sleep(10)
    const divider2 = TestBlockFactory.createDivider(card)
    card.contentOrder.push(...[text2.id, image2.id, divider2.id])

    cardTree = MutableCardTree.incrementalUpdate(cardTree, [card, comment2, text2, image2, divider2])
    expect(cardTree).not.toBeUndefined()
    if (!cardTree) {
        fail('incrementalUpdate')
    }
    expect(cardTree.comments).toEqual([comment, comment2])

    // The added content's order was not specified in card.contentOrder, so much match created date order
    expect(cardTree.contents).toEqual([image, divider, text, text2, image2, divider2])

    // Incremental update: No change
    const anotherCard = TestBlockFactory.createCard()
    const comment3 = TestBlockFactory.createComment(anotherCard)
    const originalCardTree = cardTree
    cardTree = MutableCardTree.incrementalUpdate(cardTree, [comment3])
    expect(cardTree).toBe(originalCardTree)
    expect(cardTree).not.toBeUndefined()
    if (!cardTree) {
        fail('incrementalUpdate')
    }

    card.contentOrder = [text.id, image.id, divider.id]
    FetchMock.fn.mockReturnValueOnce(FetchMock.jsonResponse(JSON.stringify([card, comment, text, image, divider])))
    cardTree = await MutableCardTree.sync(card.id)
    expect(cardTree).not.toBeUndefined()
    expect(cardTree?.latestBlock.type).toEqual('divider')
})

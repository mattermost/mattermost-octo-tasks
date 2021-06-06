// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Utils} from '../utils'

import {IBlock, MutableBlock} from './block'

interface Card extends IBlock {
    readonly icon: string
    readonly isTemplate: boolean
    readonly properties: Readonly<Record<string, string | string[]>>
    readonly contentOrder: readonly string[]

    duplicate(): MutableCard
}

class MutableCard extends MutableBlock implements Card {
    get icon(): string {
        return this.fields.icon as string
    }
    set icon(value: string) {
        this.fields.icon = value
    }

    get isTemplate(): boolean {
        return Boolean(this.fields.isTemplate)
    }
    set isTemplate(value: boolean) {
        this.fields.isTemplate = value
    }

    get properties(): Record<string, string | string[]> {
        return this.fields.properties as Record<string, string | string[]>
    }
    set properties(value: Record<string, string | string[]>) {
        this.fields.properties = value
    }

    get contentOrder(): string[] {
        return this.fields.contentOrder
    }
    set contentOrder(value: string[]) {
        this.fields.contentOrder = value
    }

    constructor(block: any = {}) {
        super(block)
        this.type = 'card'

        this.icon = block.fields?.icon || ''
        this.properties = {...(block.fields?.properties || {})}
        this.contentOrder = block.fields?.contentOrder?.slice() || []
    }

    duplicate(): MutableCard {
        const card = new MutableCard(this)
        card.id = Utils.createGuid()
        return card
    }
}

export {MutableCard, Card}

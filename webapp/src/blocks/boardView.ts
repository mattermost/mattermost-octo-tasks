// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {Utils} from '../utils'

import {IBlock, MutableBlock} from './block'
import {FilterGroup} from './filterGroup'

type IViewType = 'board' | 'table' | 'gallery' // | 'calendar' | 'list'
type ISortOption = { propertyId: '__title' | string, reversed: boolean }

interface BoardView extends IBlock {
    readonly viewType: IViewType
    readonly groupById?: string
    readonly sortOptions: readonly ISortOption[]
    readonly visiblePropertyIds: readonly string[]
    readonly visibleOptionIds: readonly string[]
    readonly hiddenOptionIds: readonly string[]
    readonly collapsedOptionIds: readonly string[]
    readonly filter: FilterGroup
    readonly cardOrder: readonly string[]
    readonly columnWidths: Readonly<Record<string, number>>
    readonly defaultTemplateId: string

    duplicate(): MutableBoardView
}

class MutableBoardView extends MutableBlock implements BoardView {
    get viewType(): IViewType {
        return this.fields.viewType
    }
    set viewType(value: IViewType) {
        this.fields.viewType = value
    }

    get groupById(): string | undefined {
        return this.fields.groupById
    }
    set groupById(value: string | undefined) {
        this.fields.groupById = value
    }

    get sortOptions(): ISortOption[] {
        return this.fields.sortOptions
    }
    set sortOptions(value: ISortOption[]) {
        this.fields.sortOptions = value
    }

    get visiblePropertyIds(): string[] {
        return this.fields.visiblePropertyIds
    }
    set visiblePropertyIds(value: string[]) {
        this.fields.visiblePropertyIds = value
    }

    get visibleOptionIds(): string[] {
        return this.fields.visibleOptionIds
    }
    set visibleOptionIds(value: string[]) {
        this.fields.visibleOptionIds = value
    }

    get hiddenOptionIds(): string[] {
        return this.fields.hiddenOptionIds
    }
    set hiddenOptionIds(value: string[]) {
        this.fields.hiddenOptionIds = value
    }

    get collapsedOptionIds(): string[] {
        return this.fields.collapsedOptionIds
    }
    set collapsedOptionIds(value: string[]) {
        this.fields.collapsedOptionIds = value
    }

    get filter(): FilterGroup {
        return this.fields.filter
    }
    set filter(value: FilterGroup) {
        this.fields.filter = value
    }

    get cardOrder(): string[] {
        return this.fields.cardOrder
    }
    set cardOrder(value: string[]) {
        this.fields.cardOrder = value
    }

    get columnWidths(): Record<string, number> {
        return this.fields.columnWidths as Record<string, number>
    }
    set columnWidths(value: Record<string, number>) {
        this.fields.columnWidths = value
    }

    get defaultTemplateId(): string {
        return this.fields.defaultTemplateId as string
    }

    set defaultTemplateId(value: string) {
        this.fields.defaultTemplateId = value
    }

    constructor(block: any = {}) {
        super(block)

        this.type = 'view'

        this.sortOptions = block.fields?.sortOptions?.map((o: ISortOption) => ({...o})) || []		// Deep clone
        this.visiblePropertyIds = block.fields?.visiblePropertyIds?.slice() || []
        this.visibleOptionIds = block.fields?.visibleOptionIds?.slice() || []
        this.hiddenOptionIds = block.fields?.hiddenOptionIds?.slice() || []
        this.collapsedOptionIds = block.fields?.collapsedOptionIds?.slice() || []
        this.filter = new FilterGroup(block.fields?.filter)
        this.cardOrder = block.fields?.cardOrder?.slice() || []
        this.columnWidths = {...(block.fields?.columnWidths || {})}

        if (!this.viewType) {
            this.viewType = 'board'
        }
    }

    duplicate(): MutableBoardView {
        const view = new MutableBoardView(this)
        view.id = Utils.createGuid()
        return view
    }
}

function sortBoardViewsAlphabetically(views: BoardView[]): BoardView[] {
    // Strip leading emoji to prevent unintuitive results
    return views.map((v) => {
        return {view: v, title: v.title.replace(/^\p{Emoji}*\s*/u, '')}
    }).sort((v1, v2) => v1.title.localeCompare(v2.title)).map((v) => v.view)
}

export {BoardView, MutableBoardView, IViewType, ISortOption, sortBoardViewsAlphabetically}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {BlockIcons} from './blockIcons'
import {IBlock, MutableBlock} from './blocks/block'
import {Board, IPropertyOption, IPropertyTemplate, MutableBoard, PropertyType} from './blocks/board'
import {BoardView, ISortOption, MutableBoardView} from './blocks/boardView'
import {Card, MutableCard} from './blocks/card'
import {FilterGroup} from './blocks/filterGroup'
import octoClient, {OctoClient} from './octoClient'
import {OctoUtils} from './octoUtils'
import undoManager from './undomanager'
import {Utils} from './utils'
import {BoardTree} from './viewModel/boardTree'

//
// The Mutator is used to make all changes to server state
// It also ensures that the Undo-manager is called for each action
//
class Mutator {
    private undoGroupId?: string

    private beginUndoGroup(): string | undefined {
        if (this.undoGroupId) {
            Utils.assertFailure('UndoManager does not support nested groups')
            return undefined
        }
        this.undoGroupId = Utils.createGuid()
        return this.undoGroupId
    }

    private endUndoGroup(groupId: string) {
        if (this.undoGroupId !== groupId) {
            Utils.assertFailure('Mismatched groupId. UndoManager does not support nested groups')
            return
        }
        this.undoGroupId = undefined
    }

    async performAsUndoGroup(actions: () => Promise<void>): Promise<void> {
        const groupId = this.beginUndoGroup()
        try {
            await actions()
        } catch (err) {
            Utils.assertFailure(`ERROR: ${err?.toString?.()}`)
        }
        if (groupId) {
            this.endUndoGroup(groupId)
        }
    }

    async updateBlock(newBlock: IBlock, oldBlock: IBlock, description: string): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.updateBlock(newBlock)
            },
            async () => {
                await octoClient.updateBlock(oldBlock)
            },
            description,
            this.undoGroupId,
        )
    }

    private async updateBlocks(newBlocks: IBlock[], oldBlocks: IBlock[], description: string): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.updateBlocks(newBlocks)
            },
            async () => {
                await octoClient.updateBlocks(oldBlocks)
            },
            description,
            this.undoGroupId,
        )
    }

    async insertBlock(block: IBlock, description = 'add', afterRedo?: () => Promise<void>, beforeUndo?: () => Promise<void>) {
        await undoManager.perform(
            async () => {
                await octoClient.insertBlock(block)
                await afterRedo?.()
            },
            async () => {
                await beforeUndo?.()
                await octoClient.deleteBlock(block.id)
            },
            description,
            this.undoGroupId,
        )
    }

    async insertBlocks(blocks: IBlock[], description = 'add', afterRedo?: () => Promise<void>, beforeUndo?: () => Promise<void>) {
        await undoManager.perform(
            async () => {
                await octoClient.insertBlocks(blocks)
                await afterRedo?.()
            },
            async () => {
                await beforeUndo?.()
                const awaits = []
                for (const block of blocks) {
                    awaits.push(octoClient.deleteBlock(block.id))
                }
                await Promise.all(awaits)
            },
            description,
            this.undoGroupId,
        )
    }

    async deleteBlock(block: IBlock, description?: string, beforeRedo?: () => Promise<void>, afterUndo?: () => Promise<void>) {
        const actualDescription = description || `delete ${block.type}`

        await undoManager.perform(
            async () => {
                await beforeRedo?.()
                await octoClient.deleteBlock(block.id)
            },
            async () => {
                await octoClient.insertBlock(block)
                await afterUndo?.()
            },
            actualDescription,
            this.undoGroupId,
        )
    }

    async changeTitle(block: IBlock, title: string, description = 'change title') {
        const newBlock = new MutableBlock(block)
        newBlock.title = title
        await this.updateBlock(newBlock, block, description)
    }

    async changeIcon(block: Card | Board, icon: string, description = 'change icon') {
        let newBlock: IBlock
        switch (block.type) {
        case 'card': {
            const card = new MutableCard(block)
            card.icon = icon
            newBlock = card
            break
        }
        case 'board': {
            const board = new MutableBoard(block)
            board.icon = icon
            newBlock = board
            break
        }
        default: {
            Utils.assertFailure(`changeIcon: Invalid block type: ${block.type}`)
            return
        }
        }

        await this.updateBlock(newBlock, block, description)
    }

    async changeDescription(block: IBlock, boardDescription: string, description = 'change description') {
        const newBoard = new MutableBoard(block)
        newBoard.description = boardDescription
        await this.updateBlock(newBoard, block, description)
    }

    async showDescription(board: Board, showDescription = true, description?: string) {
        const newBoard = new MutableBoard(board)
        newBoard.showDescription = showDescription
        let actionDescription = description
        if (!actionDescription) {
            actionDescription = showDescription ? 'show description' : 'hide description'
        }
        await this.updateBlock(newBoard, board, actionDescription)
    }

    async changeCardContentOrder(card: Card, contentOrder: Array<string | string[]>, description = 'reorder'): Promise<void> {
        const newCard = new MutableCard(card)
        newCard.contentOrder = contentOrder
        await this.updateBlock(newCard, card, description)
    }

    // Property Templates

    async insertPropertyTemplate(boardTree: BoardTree, index = -1, template?: IPropertyTemplate) {
        const {board, activeView} = boardTree
        if (!activeView) {
            Utils.assertFailure('insertPropertyTemplate: no activeView')
            return
        }

        const newTemplate = template || {
            id: Utils.createGuid(),
            name: 'New Property',
            type: 'text',
            options: [],
        }

        const oldBlocks: IBlock[] = [board]

        const newBoard = new MutableBoard(board)
        const startIndex = (index >= 0) ? index : board.cardProperties.length
        newBoard.cardProperties.splice(startIndex, 0, newTemplate)
        const changedBlocks: IBlock[] = [newBoard]

        let description = 'add property'

        if (activeView.viewType === 'table') {
            oldBlocks.push(activeView)

            const newActiveView = new MutableBoardView(activeView)
            newActiveView.visiblePropertyIds.push(newTemplate.id)
            changedBlocks.push(newActiveView)

            description = 'add column'
        }

        await this.updateBlocks(changedBlocks, oldBlocks, description)
    }

    async duplicatePropertyTemplate(boardTree: BoardTree, propertyId: string) {
        const {board, activeView} = boardTree
        if (!activeView) {
            Utils.assertFailure('duplicatePropertyTemplate: no activeView')
            return
        }

        const oldBlocks: IBlock[] = [board]

        const newBoard = new MutableBoard(board)
        const changedBlocks: IBlock[] = [newBoard]
        const index = newBoard.cardProperties.findIndex((o) => o.id === propertyId)
        if (index === -1) {
            Utils.assertFailure(`Cannot find template with id: ${propertyId}`)
            return
        }
        const srcTemplate = newBoard.cardProperties[index]
        const newTemplate: IPropertyTemplate = {
            id: Utils.createGuid(),
            name: `${srcTemplate.name} copy`,
            type: srcTemplate.type,
            options: srcTemplate.options.slice(),
        }
        newBoard.cardProperties.splice(index + 1, 0, newTemplate)

        let description = 'duplicate property'
        if (activeView.viewType === 'table') {
            oldBlocks.push(activeView)

            const newActiveView = new MutableBoardView(activeView)
            newActiveView.visiblePropertyIds.push(newTemplate.id)
            changedBlocks.push(newActiveView)

            description = 'duplicate column'
        }

        await this.updateBlocks(changedBlocks, oldBlocks, description)
    }

    async changePropertyTemplateOrder(board: Board, template: IPropertyTemplate, destIndex: number) {
        const templates = board.cardProperties
        const newValue = templates.slice()

        const srcIndex = templates.indexOf(template)
        Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`)
        newValue.splice(destIndex, 0, newValue.splice(srcIndex, 1)[0])

        const newBoard = new MutableBoard(board)
        newBoard.cardProperties = newValue

        await this.updateBlock(newBoard, board, 'reorder properties')
    }

    async deleteProperty(boardTree: BoardTree, propertyId: string) {
        const {board, views, cards} = boardTree

        const oldBlocks: IBlock[] = [board]

        const newBoard = new MutableBoard(board)
        const changedBlocks: IBlock[] = [newBoard]
        newBoard.cardProperties = board.cardProperties.filter((o) => o.id !== propertyId)

        views.forEach((view) => {
            if (view.visiblePropertyIds.includes(propertyId)) {
                oldBlocks.push(view)

                const newView = new MutableBoardView(view)
                newView.visiblePropertyIds = view.visiblePropertyIds.filter((o) => o !== propertyId)
                changedBlocks.push(newView)
            }
        })
        cards.forEach((card) => {
            if (card.properties[propertyId]) {
                oldBlocks.push(card)

                const newCard = new MutableCard(card)
                delete newCard.properties[propertyId]
                changedBlocks.push(newCard)
            }
        })

        await this.updateBlocks(changedBlocks, oldBlocks, 'delete property')
    }

    // Properties

    async insertPropertyOption(boardTree: BoardTree, template: IPropertyTemplate, option: IPropertyOption, description = 'add option') {
        const {board} = boardTree

        Utils.assert(board.cardProperties.includes(template))

        const newBoard = new MutableBoard(board)
        const newTemplate = newBoard.cardProperties.find((o) => o.id === template.id)!
        newTemplate.options.push(option)

        await this.updateBlock(newBoard, board, description)
    }

    async deletePropertyOption(boardTree: BoardTree, template: IPropertyTemplate, option: IPropertyOption) {
        const {board} = boardTree

        const newBoard = new MutableBoard(board)
        const newTemplate = newBoard.cardProperties.find((o) => o.id === template.id)!
        newTemplate.options = newTemplate.options.filter((o) => o.id !== option.id)

        await this.updateBlock(newBoard, board, 'delete option')
    }

    async changePropertyOptionOrder(board: Board, template: IPropertyTemplate, option: IPropertyOption, destIndex: number) {
        const srcIndex = template.options.indexOf(option)
        Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`)

        const newBoard = new MutableBoard(board)
        const newTemplate = newBoard.cardProperties.find((o) => o.id === template.id)!
        newTemplate.options.splice(destIndex, 0, newTemplate.options.splice(srcIndex, 1)[0])

        await this.updateBlock(newBoard, board, 'reorder options')
    }

    async changePropertyOptionValue(boardTree: BoardTree, propertyTemplate: IPropertyTemplate, option: IPropertyOption, value: string) {
        const {board} = boardTree

        const oldBlocks: IBlock[] = [board]

        const newBoard = new MutableBoard(board)
        const newTemplate = newBoard.cardProperties.find((o) => o.id === propertyTemplate.id)!
        const newOption = newTemplate.options.find((o) => o.id === option.id)!
        newOption.value = value
        const changedBlocks: IBlock[] = [newBoard]

        await this.updateBlocks(changedBlocks, oldBlocks, 'rename option')

        return changedBlocks
    }

    async changePropertyOptionColor(board: Board, template: IPropertyTemplate, option: IPropertyOption, color: string) {
        const newBoard = new MutableBoard(board)
        const newTemplate = newBoard.cardProperties.find((o) => o.id === template.id)!
        const newOption = newTemplate.options.find((o) => o.id === option.id)!
        newOption.color = color
        await this.updateBlock(newBoard, board, 'change option color')
    }

    async changePropertyValue(card: Card, propertyId: string, value?: string | string[], description = 'change property') {
        const newCard = new MutableCard(card)
        if (value) {
            newCard.properties[propertyId] = value
        } else {
            delete newCard.properties[propertyId]
        }
        await this.updateBlock(newCard, card, description)
    }

    async changePropertyTypeAndName(boardTree: BoardTree, propertyTemplate: IPropertyTemplate, newType: PropertyType, newName: string) {
        if (propertyTemplate.type === newType && propertyTemplate.name === newName) {
            return
        }

        const {board} = boardTree

        const newBoard = new MutableBoard(board)
        const newTemplate = newBoard.cardProperties.find((o) => o.id === propertyTemplate.id)!
        newTemplate.options = []
        newTemplate.type = newType
        newTemplate.name = newName

        const oldBlocks: IBlock[] = [board]
        const newBlocks: IBlock[] = [newBoard]

        if (propertyTemplate.type !== newType) {
            if (propertyTemplate.type === 'select' || propertyTemplate.type === 'multiSelect') { // If the old type was either select or multiselect
                const isNewTypeSelectOrMulti = newType === 'select' || newType === 'multiSelect'

                for (const card of boardTree.allCards) {
                    const oldValue = Array.isArray(card.properties[propertyTemplate.id]) ?
                        (card.properties[propertyTemplate.id].length > 0 && card.properties[propertyTemplate.id][0]) :
                        card.properties[propertyTemplate.id]

                    if (oldValue) {
                        const newValue = isNewTypeSelectOrMulti ?
                            propertyTemplate.options.find((o) => o.id === oldValue)?.id :
                            propertyTemplate.options.find((o) => o.id === oldValue)?.value
                        const newCard = new MutableCard(card)

                        if (newValue) {
                            newCard.properties[propertyTemplate.id] = newType === 'multiSelect' ? [newValue] : newValue
                        } else {
                            // This was an invalid select option, so delete it
                            delete newCard.properties[propertyTemplate.id]
                        }

                        newBlocks.push(newCard)
                        oldBlocks.push(card)
                    }

                    if (isNewTypeSelectOrMulti) {
                        newTemplate.options = propertyTemplate.options
                    }
                }
            } else if (newType === 'select' || newType === 'multiSelect') { // if the new type is either select or multiselect
                // Map values to new template option IDs
                for (const card of boardTree.allCards) {
                    const oldValue = card.properties[propertyTemplate.id] as string
                    if (oldValue) {
                        let option = newTemplate.options.find((o) => o.value === oldValue)
                        if (!option) {
                            option = {
                                id: Utils.createGuid(),
                                value: oldValue,
                                color: 'propColorDefault',
                            }
                            newTemplate.options.push(option)
                        }

                        const newCard = new MutableCard(card)
                        newCard.properties[propertyTemplate.id] = newType === 'multiSelect' ? [option.id] : option.id

                        newBlocks.push(newCard)
                        oldBlocks.push(card)
                    }
                }
            }
        }

        await this.updateBlocks(newBlocks, oldBlocks, 'change property type and name')
    }

    // Views

    async changeViewSortOptions(view: BoardView, sortOptions: ISortOption[]): Promise<void> {
        const newView = new MutableBoardView(view)
        newView.sortOptions = sortOptions
        await this.updateBlock(newView, view, 'sort')
    }

    async changeViewFilter(view: BoardView, filter: FilterGroup): Promise<void> {
        const newView = new MutableBoardView(view)
        newView.filter = filter
        await this.updateBlock(newView, view, 'filter')
    }

    async changeViewGroupById(view: BoardView, groupById: string): Promise<void> {
        const newView = new MutableBoardView(view)
        newView.groupById = groupById
        newView.hiddenOptionIds = []
        newView.visibleOptionIds = []
        await this.updateBlock(newView, view, 'group by')
    }

    async changeViewVisibleProperties(view: BoardView, visiblePropertyIds: string[], description = 'show / hide property'): Promise<void> {
        const newView = new MutableBoardView(view)
        newView.visiblePropertyIds = visiblePropertyIds
        await this.updateBlock(newView, view, description)
    }

    async changeViewVisibleOptionIds(view: BoardView, visibleOptionIds: string[], description = 'reorder'): Promise<void> {
        const newView = new MutableBoardView(view)
        newView.visibleOptionIds = visibleOptionIds
        await this.updateBlock(newView, view, description)
    }

    async changeViewHiddenOptionIds(view: BoardView, hiddenOptionIds: string[], description = 'reorder'): Promise<void> {
        const newView = new MutableBoardView(view)
        newView.hiddenOptionIds = hiddenOptionIds
        await this.updateBlock(newView, view, description)
    }

    async hideViewColumn(view: BoardView, columnOptionId: string): Promise<void> {
        if (view.hiddenOptionIds.includes(columnOptionId)) {
            return
        }

        const newView = new MutableBoardView(view)
        newView.visibleOptionIds = newView.visibleOptionIds.filter((o) => o !== columnOptionId)
        newView.hiddenOptionIds.push(columnOptionId)
        await this.updateBlock(newView, view, 'hide column')
    }

    async unhideViewColumn(view: BoardView, columnOptionId: string): Promise<void> {
        if (!view.hiddenOptionIds.includes(columnOptionId)) {
            return
        }

        const newView = new MutableBoardView(view)
        newView.hiddenOptionIds = newView.hiddenOptionIds.filter((o) => o !== columnOptionId)

        // Put the column at the end of the visible list
        newView.visibleOptionIds = newView.visibleOptionIds.filter((o) => o !== columnOptionId)
        newView.visibleOptionIds.push(columnOptionId)
        await this.updateBlock(newView, view, 'show column')
    }

    async changeViewCardOrder(view: BoardView, cardOrder: string[], description = 'reorder'): Promise<void> {
        const newView = new MutableBoardView(view)
        newView.cardOrder = cardOrder
        await this.updateBlock(newView, view, description)
    }

    // Duplicate

    async duplicateCard(
        cardId: string,
        description = 'duplicate card',
        asTemplate = false,
        afterRedo?: (newCardId: string) => Promise<void>,
        beforeUndo?: () => Promise<void>,
    ): Promise<[IBlock[], string]> {
        const blocks = await octoClient.getSubtree(cardId, 2)
        const [newBlocks1, newCard] = OctoUtils.duplicateBlockTree(blocks, cardId) as [IBlock[], MutableCard, Record<string, string>]
        const newBlocks = newBlocks1.filter((o) => o.type !== 'comment')
        Utils.log(`duplicateCard: duplicating ${newBlocks.length} blocks`)
        if (asTemplate === newCard.isTemplate) {
            // Copy template
            newCard.title = `${newCard.title} copy`
        } else if (asTemplate) {
            // Template from card
            newCard.title = 'New card template'
        } else {
            // Card from template
            newCard.title = ''

            // If the template doesn't specify an icon, initialize it to a random one
            if (!newCard.icon) {
                newCard.icon = BlockIcons.shared.randomIcon()
            }
        }
        newCard.isTemplate = asTemplate
        await this.insertBlocks(
            newBlocks,
            description,
            async () => {
                await afterRedo?.(newCard.id)
            },
            beforeUndo,
        )
        return [newBlocks, newCard.id]
    }

    async duplicateBoard(
        boardId: string,
        description = 'duplicate board',
        asTemplate = false,
        afterRedo?: (newBoardId: string) => Promise<void>,
        beforeUndo?: () => Promise<void>,
    ): Promise<[IBlock[], string]> {
        const blocks = await octoClient.getSubtree(boardId, 3)
        const [newBlocks1, newBoard] = OctoUtils.duplicateBlockTree(blocks, boardId) as [IBlock[], MutableBoard, Record<string, string>]
        const newBlocks = newBlocks1.filter((o) => o.type !== 'comment')
        Utils.log(`duplicateBoard: duplicating ${newBlocks.length} blocks`)

        if (asTemplate === newBoard.isTemplate) {
            newBoard.title = `${newBoard.title} copy`
        } else if (asTemplate) {
            // Template from board
            newBoard.title = 'New board template'
        } else {
            // Board from template
        }
        newBoard.isTemplate = asTemplate
        await this.insertBlocks(
            newBlocks,
            description,
            async () => {
                await afterRedo?.(newBoard.id)
            },
            beforeUndo,
        )
        return [newBlocks, newBoard.id]
    }

    async duplicateFromRootBoard(
        boardId: string,
        description = 'duplicate board',
        asTemplate = false,
        afterRedo?: (newBoardId: string) => Promise<void>,
        beforeUndo?: () => Promise<void>,
    ): Promise<[IBlock[], string]> {
        const rootClient = new OctoClient(octoClient.serverUrl, '0')
        const blocks = await rootClient.getSubtree(boardId, 3)
        const [newBlocks1, newBoard] = OctoUtils.duplicateBlockTree(blocks, boardId) as [IBlock[], MutableBoard, Record<string, string>]
        const newBlocks = newBlocks1.filter((o) => o.type !== 'comment')
        Utils.log(`duplicateBoard: duplicating ${newBlocks.length} blocks`)

        if (asTemplate === newBoard.isTemplate) {
            newBoard.title = `${newBoard.title} copy`
        } else if (asTemplate) {
            // Template from board
            newBoard.title = 'New board template'
        } else {
            // Board from template
        }
        newBoard.isTemplate = asTemplate
        await this.insertBlocks(
            newBlocks,
            description,
            async () => {
                await afterRedo?.(newBoard.id)
            },
            beforeUndo,
        )
        return [newBlocks, newBoard.id]
    }

    // Other methods

    // Not a mutator, but convenient to put here since Mutator wraps OctoClient
    async exportArchive(boardID?: string): Promise<IBlock[]> {
        return octoClient.exportArchive(boardID)
    }

    // Not a mutator, but convenient to put here since Mutator wraps OctoClient
    async importFullArchive(blocks: readonly IBlock[]): Promise<Response> {
        return octoClient.importFullArchive(blocks)
    }

    get canUndo(): boolean {
        return undoManager.canUndo
    }

    get canRedo(): boolean {
        return undoManager.canRedo
    }

    get undoDescription(): string | undefined {
        return undoManager.undoDescription
    }

    get redoDescription(): string | undefined {
        return undoManager.redoDescription
    }

    async undo() {
        await undoManager.undo()
    }

    async redo() {
        await undoManager.redo()
    }
}

const mutator = new Mutator()
export default mutator

export {mutator}

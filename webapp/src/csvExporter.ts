// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {IntlShape} from 'react-intl'

import {BoardView} from './blocks/boardView'
import {BoardTree} from './viewModel/boardTree'
import {OctoUtils} from './octoUtils'
import {Utils} from './utils'

class CsvExporter {
    static exportTableCsv(boardTree: BoardTree, intl: IntlShape, view?: BoardView): void {
        const {activeView} = boardTree
        const viewToExport = view ?? activeView

        if (!viewToExport) {
            return
        }

        const rows = CsvExporter.generateTableArray(boardTree, viewToExport, intl)

        let csvContent = 'data:text/csv;charset=utf-8,'

        rows.forEach((row) => {
            const encodedRow = row.join(',')
            csvContent += encodedRow + '\r\n'
        })

        const filename = `${Utils.sanitizeFilename(viewToExport.title || 'Untitled')}.csv`
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.style.display = 'none'
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', filename)
        document.body.appendChild(link)						// FireFox support

        link.click()

        // TODO: Review if this is needed in the future, this is to fix the problem with linux webview links
        if ((window as any).openInNewBrowser) {
            (window as any).openInNewBrowser(encodedUri)
        }

        // TODO: Remove or reuse link
    }

    private static encodeText(text: string): string {
        return text.replace(/"/g, '""')
    }

    private static generateTableArray(boardTree: BoardTree, viewToExport: BoardView, intl: IntlShape): string[][] {
        const {board, cards} = boardTree

        const rows: string[][] = []
        const visibleProperties = board.cardProperties.filter((template) => viewToExport.visiblePropertyIds.includes(template.id))

        {
            // Header row
            const row: string[] = ['Title']
            visibleProperties.forEach((template) => {
                row.push(template.name)
            })
            rows.push(row)
        }

        cards.forEach((card) => {
            const row: string[] = []
            row.push(`"${this.encodeText(card.title)}"`)
            visibleProperties.forEach((template) => {
                const propertyValue = card.properties[template.id]
                const displayValue = (OctoUtils.propertyDisplayValue(card, propertyValue, template, intl) || '') as string
                if (template.type === 'number') {
                    const numericValue = propertyValue ? Number(propertyValue).toString() : ''
                    row.push(numericValue)
                } else {
                    // Export as string
                    row.push(`"${this.encodeText(displayValue)}"`)
                }
            })
            rows.push(row)
        })

        return rows
    }
}

export {CsvExporter}

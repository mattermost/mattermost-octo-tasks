// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import marked from 'marked'
import {IntlShape} from 'react-intl'

declare global {
    interface Window {
        msCrypto: Crypto
    }
}

const IconClass = 'octo-icon'
const OpenButtonClass = 'open-button'
const SpacerClass = 'octo-spacer'
const HorizontalGripClass = 'HorizontalGrip'

class Utils {
    static createGuid(): string {
        const crypto = window.crypto || window.msCrypto
        function randomDigit() {
            if (crypto && crypto.getRandomValues) {
                const rands = new Uint8Array(1)
                crypto.getRandomValues(rands)
                return (rands[0] % 16).toString(16)
            }

            return (Math.floor((Math.random() * 16))).toString(16)
        }
        return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, randomDigit)
    }

    static htmlToElement(html: string): HTMLElement {
        const template = document.createElement('template')
        template.innerHTML = html.trim()
        return template.content.firstChild as HTMLElement
    }

    static getElementById(elementId: string): HTMLElement {
        const element = document.getElementById(elementId)
        Utils.assert(element, `getElementById "${elementId}$`)
        return element!
    }

    static htmlEncode(text: string): string {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    static htmlDecode(text: string): string {
        return String(text).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    }

    // re-use canvas object for better performance
    static canvas : HTMLCanvasElement | undefined
    static getTextWidth(displayText: string, fontDescriptor: string): number {
        if (displayText !== '') {
            if (!this.canvas) {
                this.canvas = document.createElement('canvas') as HTMLCanvasElement
            }
            const context = this.canvas.getContext('2d')
            if (context) {
                context.font = fontDescriptor
                const metrics = context.measureText(displayText)
                return Math.ceil(metrics.width)
            }
        }
        return 0
    }

    static getFontAndPaddingFromCell = (cell: Element) : {fontDescriptor: string, padding: number} => {
        const style = getComputedStyle(cell)
        const padding = Utils.getHorizontalPadding(style)
        return Utils.getFontAndPaddingFromChildren(cell.children, padding)
    }

    // recursive routine to determine the padding and font from its children
    // specifically for the table view
    static getFontAndPaddingFromChildren = (children: HTMLCollection, pad: number) : {fontDescriptor: string, padding: number} => {
        const myResults = {
            fontDescriptor: '',
            padding: pad,
        }
        Array.from(children).forEach((element) => {
            switch (element.className) {
            case IconClass:
            case HorizontalGripClass:
                myResults.padding += element.clientWidth
                break
            case SpacerClass:
            case OpenButtonClass:
                break
            default: {
                const style = getComputedStyle(element)
                myResults.fontDescriptor = style.font
                myResults.padding += Utils.getHorizontalPadding(style)
                const childResults = Utils.getFontAndPaddingFromChildren(element.children, myResults.padding)
                if (childResults.fontDescriptor !== '') {
                    myResults.fontDescriptor = childResults.fontDescriptor
                    myResults.padding = childResults.padding
                }
            }
            }
        })
        return myResults
    }

    static getHorizontalPadding = (style: CSSStyleDeclaration): number => {
        return parseInt(style.paddingLeft, 10) + parseInt(style.paddingRight, 10) + parseInt(style.marginLeft, 10) + parseInt(style.marginRight, 10) + parseInt(style.borderLeft, 10) + parseInt(style.borderRight, 10)
    }

    // Markdown

    static htmlFromMarkdown(text: string): string {
        // HACKHACK: Somehow, marked doesn't encode angle brackets
        const renderer = new marked.Renderer()
        if ((window as any).openInNewBrowser) {
            renderer.link = (href, title, contents) => `<a target="_blank" rel="noreferrer" href="${encodeURI(href || '')}" title="${title ? encodeURI(title) : ''}" onclick="event.stopPropagation(); openInNewBrowser && openInNewBrowser(event.target.href);">${contents}</a>`
        }
        const html = marked(text.replace(/</g, '&lt;'), {renderer, breaks: true})
        return html.trim()
    }

    // Date and Time

    static displayDate(date: Date, intl: IntlShape, dateFormat: string): string {
        const text = intl.formatDate(date, {year: 'numeric', month: 'short', day: '2-digit', format: dateFormat})

        return text
    }

    static displayDateTime(date: Date, intl: IntlShape): string {
        const text = intl.formatDate(date, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: 'numeric',
            minute: 'numeric',
        })
        return text
    }

    static sleep(miliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, miliseconds))
    }

    // Errors

    static assertValue(valueObject: any): void {
        const name = Object.keys(valueObject)[0]
        const value = valueObject[name]
        if (!value) {
            Utils.logError(`ASSERT VALUE [${name}]`)
        }
    }

    static assert(condition: any, tag = ''): void {
        /// #!if ENV !== "production"
        if (!condition) {
            Utils.logError(`ASSERT [${tag ?? new Error().stack}]`)
        }

        /// #!endif
    }

    static assertFailure(tag = ''): void {
        /// #!if ENV !== "production"
        Utils.assert(false, tag)

        /// #!endif
    }

    static log(message: string): void {
        /// #!if ENV !== "production"
        const timestamp = (Date.now() / 1000).toFixed(2)
        // eslint-disable-next-line no-console
        console.log(`[${timestamp}] ${message}`)

        /// #!endif
    }

    static logError(message: string): void {
        /// #!if ENV !== "production"
        const timestamp = (Date.now() / 1000).toFixed(2)
        // eslint-disable-next-line no-console
        console.error(`[${timestamp}] ${message}`)

        /// #!endif
    }

    // favicon

    static setFavicon(icon?: string): void {
        const href = icon ? `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>` : ''
        const link = (document.querySelector("link[rel*='icon']") || document.createElement('link')) as HTMLLinkElement
        link.type = 'image/x-icon'
        link.rel = 'shortcut icon'
        link.href = href
        document.getElementsByTagName('head')[0].appendChild(link)
    }

    // URL

    static replaceUrlQueryParam(paramName: string, value?: string): void {
        const queryString = new URLSearchParams(window.location.search)
        const currentValue = queryString.get(paramName) || ''
        if (currentValue !== value) {
            const newUrl = new URL(window.location.toString())
            if (value) {
                newUrl.searchParams.set(paramName, value)
            } else {
                newUrl.searchParams.delete(paramName)
            }
            window.history.pushState({}, document.title, newUrl.toString())
        }
    }

    static ensureProtocol(url: string): string {
        return url.match(/^.+:\/\//) ? url : `https://${url}`
    }

    // File names

    static sanitizeFilename(filename: string): string {
        // TODO: Use an industrial-strength sanitizer
        let sanitizedFilename = filename
        const illegalCharacters = ['\\', '/', '?', ':', '<', '>', '*', '|', '"', '.']
        illegalCharacters.forEach((character) => {
            sanitizedFilename = sanitizedFilename.replace(character, '')
        })
        return sanitizedFilename
    }

    // File picker

    static selectLocalFile(onSelect?: (file: File) => void, accept = '.jpg,.jpeg,.png'): void {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept
        input.onchange = async () => {
            const file = input.files![0]
            onSelect?.(file)
        }

        input.style.display = 'none'
        document.body.appendChild(input)
        input.click()

        // TODO: Remove or reuse input
    }

    // Arrays

    static arraysEqual(a: readonly any[], b: readonly any[]): boolean {
        if (a === b) {
            return true
        }
        if (a === null || b === null) {
            return false
        }
        if (a === undefined || b === undefined) {
            return false
        }
        if (a.length !== b.length) {
            return false
        }

        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) {
                return false
            }
        }
        return true
    }

    static arrayMove(arr: any[], srcIndex: number, destIndex: number): void {
        arr.splice(destIndex, 0, arr.splice(srcIndex, 1)[0])
    }

    // Clipboard

    static copyTextToClipboard(text: string): boolean {
        const textField = document.createElement('textarea')
        textField.innerText = text
        textField.style.position = 'fixed'
        textField.style.opacity = '0'

        document.body.appendChild(textField)
        textField.select()

        let result = false
        try {
            result = document.execCommand('copy')
        } catch (err) {
            Utils.logError(`copyTextToClipboard ERROR: ${err}`)
            result = false
        }
        textField.remove()

        return result
    }

    static isMobile(): boolean {
        const toMatch = [
            /Android/i,
            /webOS/i,
            /iPhone/i,
            /iPad/i,
            /iPod/i,
            /BlackBerry/i,
            /Windows Phone/i,
        ]

        return toMatch.some((toMatchItem) => {
            return navigator.userAgent.match(toMatchItem)
        })
    }

    static getBaseURL(absolute?: boolean): string {
        let baseURL = (window as any).baseURL || ''
        baseURL = baseURL.replace(/\/+$/, '')
        if (baseURL.indexOf('/') === 0) {
            baseURL = baseURL.slice(1)
        }
        if (absolute) {
            return window.location.origin + '/' + baseURL
        }
        return baseURL
    }

    static getFrontendBaseURL(absolute?: boolean): string {
        let frontendBaseURL = (window as any).frontendBaseURL || this.getBaseURL(absolute)
        frontendBaseURL = frontendBaseURL.replace(/\/+$/, '')
        if (frontendBaseURL.indexOf('/') === 0) {
            frontendBaseURL = frontendBaseURL.slice(1)
        }
        if (absolute) {
            return window.location.origin + '/' + frontendBaseURL
        }
        return frontendBaseURL
    }

    static buildURL(path: string, absolute?: boolean): string {
        const baseURL = this.getBaseURL()
        let finalPath = baseURL + path
        if (path.indexOf('/') !== 0) {
            finalPath = baseURL + '/' + path
        }
        if (absolute) {
            if (finalPath.indexOf('/') === 0) {
                finalPath = finalPath.slice(1)
            }
            return window.location.origin + '/' + finalPath
        }
        return finalPath
    }
}

export {Utils}

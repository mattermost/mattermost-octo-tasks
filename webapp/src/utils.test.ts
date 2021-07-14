// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl'

import {Utils} from './utils'

describe('utils', () => {
    describe('assureProtocol', () => {
        test('should passthrough on valid short protocol', () => {
            expect(Utils.ensureProtocol('https://focalboard.com')).toBe('https://focalboard.com')
        })
        test('should passthrough on valid long protocol', () => {
            expect(Utils.ensureProtocol('somecustomprotocol://focalboard.com')).toBe('somecustomprotocol://focalboard.com')
        })

        test('should passthrough on valid short protocol', () => {
            expect(Utils.ensureProtocol('x://focalboard.com')).toBe('x://focalboard.com')
        })

        test('should add a https for empty protocol', () => {
            expect(Utils.ensureProtocol('focalboard.com')).toBe('https://focalboard.com')
        })
    })

    describe('htmlFromMarkdown', () => {
        test('should not allow XSS on links href on the webapp', () => {
            expect(Utils.htmlFromMarkdown('[]("xss-attack="true"other="whatever)')).toBe('<p><a href="%22xss-attack=%22true%22other=%22whatever"></a></p>')
        })

        test('should not allow XSS on links href on the desktop app', () => {
            const windowAsAny = window as any
            windowAsAny.openInNewBrowser = () => null
            const expectedHtml = '<p><a target="_blank" rel="noreferrer" href="%22xss-attack=%22true%22other=%22whatever" title="" onclick="event.stopPropagation(); openInNewBrowser && openInNewBrowser(event.target.href);"></a></p>'
            expect(Utils.htmlFromMarkdown('[]("xss-attack="true"other="whatever)')).toBe(expectedHtml)
            windowAsAny.openInNewBrowser = null
        })
    })

    describe('test - buildURL', () => {
        test('buildURL, no base', () => {
            expect(Utils.buildURL('test', true)).toBe('http://localhost/test')
            expect(Utils.buildURL('/test', true)).toBe('http://localhost/test')

            expect(Utils.buildURL('test')).toBe('/test')
            expect(Utils.buildURL('/test')).toBe('/test')
        })

        test('buildURL, base no slash', () => {
            const windowAsAny = window as any
            windowAsAny.baseURL = 'base'

            expect(Utils.buildURL('test', true)).toBe('http://localhost/base/test')
            expect(Utils.buildURL('/test', true)).toBe('http://localhost/base/test')

            expect(Utils.buildURL('test')).toBe('base/test')
            expect(Utils.buildURL('/test')).toBe('base/test')
        })

        test('buildUrl, base with slash', () => {
            const windowAsAny = window as any
            windowAsAny.baseURL = '/base/'

            expect(Utils.buildURL('test', true)).toBe('http://localhost/base/test')
            expect(Utils.buildURL('/test', true)).toBe('http://localhost/base/test')

            expect(Utils.buildURL('test')).toBe('base/test')
            expect(Utils.buildURL('/test')).toBe('base/test')
        })
    })

    describe('test - display date', () => {
        test('default', () => {
            const testDate = new Date()
            let intlShape = createIntl({
                locale: 'en-US',
                messages: {},
            }, undefined)
            expect(Utils.displayDate(testDate, intlShape)).toBe((testDate.getMonth() + 1) + '/' + testDate.getDate() + '/' + testDate.getFullYear())

            intlShape = createIntl({
                locale: 'fr-FR',
                messages: {},
            }, undefined)
            expect(Utils.displayDate(testDate, intlShape)).toBe(testDate.getDate() + '/' + (testDate.getMonth() + 1) + '/' + testDate.getFullYear())
        })
    })
})

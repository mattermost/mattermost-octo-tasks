// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {fireEvent, render} from '@testing-library/react'
import '@testing-library/jest-dom'
import {IntlProvider} from 'react-intl'

import {IContentBlock} from '../../blocks/contentBlock'

import CheckboxElement from './checkboxElement'

const wrapIntl = (children: any) => <IntlProvider locale='en'>{children}</IntlProvider>

describe('components/content/CheckboxElement', () => {
    const defaultBlock: IContentBlock = {
        id: 'test-id',
        parentId: '',
        rootId: '',
        modifiedBy: 'test-user-id',
        schema: 0,
        type: 'checkbox',
        title: 'test-title',
        fields: {},
        createAt: 0,
        updateAt: 0,
        deleteAt: 0,
    }

    const unmockedFetch = global.fetch

    beforeAll(() => {
        global.fetch = () => {
            const response = new global.Response()
            response.json = () => Promise.resolve(new Response())
            return Promise.resolve(response)
        }
    })

    afterAll(() => {
        global.fetch = unmockedFetch
    })

    test('should match snapshot', () => {
        const component = wrapIntl(
            <CheckboxElement
                block={defaultBlock}
                readonly={false}
            />,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot on read only', () => {
        const component = wrapIntl(
            <CheckboxElement
                block={defaultBlock}
                readonly={true}
            />,
        )
        const {container} = render(component)
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot on change title', () => {
        const component = wrapIntl(
            <CheckboxElement
                block={defaultBlock}
                readonly={false}
            />,
        )
        const {container, getByTitle} = render(component)
        const input = getByTitle(/test-title/i)
        fireEvent.blur(input, {target: {textContent: 'changed name'}})
        expect(container).toMatchSnapshot()
    })

    test('should match snapshot on toggle', () => {
        const component = wrapIntl(
            <CheckboxElement
                block={defaultBlock}
                readonly={false}
            />,
        )
        const {container, getByRole} = render(component)
        const input = getByRole('checkbox')
        fireEvent.change(input, {target: {value: 'on'}})
        expect(container).toMatchSnapshot()
    })
})

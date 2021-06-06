// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'
import {IntlProvider} from 'react-intl'
import {render, wait} from '@testing-library/react'

import {act} from 'react-dom/test-utils'

import userEvent from '@testing-library/user-event'

import UserProperty from './user'

const wrapIntl = (children: any) => <IntlProvider locale='en'>{children}</IntlProvider>

const fetchMock = require('fetch-mock-jest')

describe('components/properties/user', () => {
    beforeAll(() => {
        fetchMock.get('http://localhost/api/v1/workspaces/0/users', JSON.stringify([
            {
                id: 'user-id-1',
                username: 'username-1',
                email: 'user-1@example.com',
                props: {},
                create_at: 1621315184,
                update_at: 1621315184,
                delete_at: 0,
            },
            {
                id: 'user-id-2',
                username: 'username-2',
                email: 'user-2@example.com',
                props: {},
                create_at: 1621315184,
                update_at: 1621315184,
                delete_at: 0,
            },
        ]),
        )
    })

    afterAll(() => {
        fetchMock.mockClear()
    })

    test('not readonly', async () => {
        const component = wrapIntl(
            <UserProperty
                value={'user-id-1'}
                readonly={false}
                onChange={() => {
                }}
            />,
        )

        let container
        act(() => {
            const renderResult = render(component)
            container = renderResult.container
        })
        await wait()
        expect(container).toMatchSnapshot()
    })

    test('readonly view', async () => {
        const component = wrapIntl(
            <UserProperty
                value={'user-id-1'}
                readonly={true}
                onChange={() => {
                }}
            />,
        )

        let container
        act(() => {
            const renderResult = render(component)
            container = renderResult.container
        })
        await wait()
        expect(container).toMatchSnapshot()
    })

    test('user dropdown open', async () => {
        const component = wrapIntl(
            <UserProperty
                value={'user-id-1'}
                readonly={false}
                onChange={() => {
                }}
            />,
        )

        let container: Element | DocumentFragment = {} as Element
        act(() => {
            const renderResult = render(component)
            container = renderResult.container
        })
        await wait()

        if (container) {
            // this is the actual element where the click event triggers
            // opening of the dropdown
            const userProperty = container.querySelector('.UserProperty > div > div:nth-child(1) > div:nth-child(2) > div > input')
            expect(userProperty).not.toBeNull()

            act(() => {
                userEvent.click(userProperty as Element)
            })
            expect(container).toMatchSnapshot()
        } else {
            throw new Error('container should have been initialized')
        }
    })
})

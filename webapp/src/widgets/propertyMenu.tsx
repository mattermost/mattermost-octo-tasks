// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useRef, useEffect} from 'react'
import {useIntl, IntlShape} from 'react-intl'

import {PropertyType} from '../blocks/board'
import {Utils} from '../utils'
import Menu from '../widgets/menu'
import './propertyMenu.scss'

type Props = {
    propertyId: string
    propertyName: string
    propertyType: PropertyType
    onNameChanged: (newName: string) => void
    onTypeChanged: (newType: PropertyType) => void
    onDelete: (id: string) => void
}

function typeDisplayName(intl: IntlShape, type: PropertyType): string {
    switch (type) {
    case 'text': return intl.formatMessage({id: 'PropertyType.Text', defaultMessage: 'Text'})
    case 'number': return intl.formatMessage({id: 'PropertyType.Number', defaultMessage: 'Number'})
    case 'select': return intl.formatMessage({id: 'PropertyType.Select', defaultMessage: 'Select'})
    case 'multiSelect': return intl.formatMessage({id: 'PropertyType.MultiSelect', defaultMessage: 'Multi Select'})
    case 'person': return intl.formatMessage({id: 'PropertyType.Person', defaultMessage: 'Person'})
    case 'file': return intl.formatMessage({id: 'PropertyType.File', defaultMessage: 'File or Media'})
    case 'checkbox': return intl.formatMessage({id: 'PropertyType.Checkbox', defaultMessage: 'Checkbox'})
    case 'url': return intl.formatMessage({id: 'PropertyType.URL', defaultMessage: 'URL'})
    case 'email': return intl.formatMessage({id: 'PropertyType.Email', defaultMessage: 'Email'})
    case 'phone': return intl.formatMessage({id: 'PropertyType.Phone', defaultMessage: 'Phone'})
    case 'createdTime': return intl.formatMessage({id: 'PropertyType.CreatedTime', defaultMessage: 'Created Time'})
    case 'createdBy': return intl.formatMessage({id: 'PropertyType.CreatedBy', defaultMessage: 'Created By'})
    case 'updatedTime': return intl.formatMessage({id: 'PropertyType.UpdatedTime', defaultMessage: 'Updated Time'})
    case 'updatedBy': return intl.formatMessage({id: 'PropertyType.UpdatedBy', defaultMessage: 'Updated By'})
    case 'date': return intl.formatMessage({id: 'PropertyType.Date', defaultMessage: 'Date'})
    default: {
        Utils.assertFailure(`typeDisplayName, unhandled type: ${type}`)
        return type
    }
    }
}
function typeMenuTitle(intl: IntlShape, type: PropertyType): string {
    return `${intl.formatMessage({id: 'PropertyMenu.typeTitle', defaultMessage: 'Type'})}: ${typeDisplayName(intl, type)}`
}

const PropertyMenu = React.memo((props: Props) => {
    const intl = useIntl()
    const nameTextbox = useRef<HTMLInputElement>(null)
    const [name, setName] = useState(props.propertyName)

    const deleteText = intl.formatMessage({
        id: 'PropertyMenu.Delete',
        defaultMessage: 'Delete',
    })

    useEffect(() => {
        nameTextbox.current?.focus()
        nameTextbox.current?.setSelectionRange(0, name.length)
    }, [])

    return (
        <Menu>
            <input
                ref={nameTextbox}
                type='text'
                className='PropertyMenu menu-textbox'
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setName(e.target.value)}
                value={name}
                onBlur={() => props.onNameChanged(name)}
                onKeyDown={(e) => {
                    if (e.keyCode === 13 || e.keyCode === 27) {
                        props.onNameChanged(name)
                        e.stopPropagation()
                    }
                }}
                spellCheck={true}
            />
            <Menu.SubMenu
                id='type'
                name={typeMenuTitle(intl, props.propertyType)}
            >
                <Menu.Label>
                    <b>
                        {intl.formatMessage({id: 'PropertyMenu.changeType', defaultMessage: 'Change property type'})}
                    </b>
                </Menu.Label>

                <Menu.Separator/>

                <Menu.Text
                    id='text'
                    name={typeDisplayName(intl, 'text')}
                    onClick={() => props.onTypeChanged('text')}
                />
                <Menu.Text
                    id='number'
                    name={typeDisplayName(intl, 'number')}
                    onClick={() => props.onTypeChanged('number')}
                />
                <Menu.Text
                    id='email'
                    name={typeDisplayName(intl, 'email')}
                    onClick={() => props.onTypeChanged('email')}
                />
                <Menu.Text
                    id='phone'
                    name={typeDisplayName(intl, 'phone')}
                    onClick={() => props.onTypeChanged('phone')}
                />
                <Menu.Text
                    id='url'
                    name={typeDisplayName(intl, 'url')}
                    onClick={() => props.onTypeChanged('url')}
                />
                <Menu.Text
                    id='select'
                    name={typeDisplayName(intl, 'select')}
                    onClick={() => props.onTypeChanged('select')}
                />
                <Menu.Text
                    id='multiSelect'
                    name={typeDisplayName(intl, 'multiSelect')}
                    onClick={() => props.onTypeChanged('multiSelect')}
                />
                <Menu.Text
                    id='date'
                    name={typeDisplayName(intl, 'date')}
                    onClick={() => props.onTypeChanged('date')}
                />
                <Menu.Text
                    id='person'
                    name={typeDisplayName(intl, 'person')}
                    onClick={() => props.onTypeChanged('person')}
                />
                <Menu.Text
                    id='checkbox'
                    name={typeDisplayName(intl, 'checkbox')}
                    onClick={() => props.onTypeChanged('checkbox')}
                />
                <Menu.Text
                    id='createdTime'
                    name={typeDisplayName(intl, 'createdTime')}
                    onClick={() => props.onTypeChanged('createdTime')}
                />
                <Menu.Text
                    id='updatedTime'
                    name={typeDisplayName(intl, 'updatedTime')}
                    onClick={() => props.onTypeChanged('updatedTime')}
                />
            </Menu.SubMenu>
            <Menu.Text
                id='delete'
                name={deleteText}
                onClick={() => props.onDelete(props.propertyId)}
            />
        </Menu>
    )
})

export default PropertyMenu

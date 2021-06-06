// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {useIntl} from 'react-intl'
import {ActionMeta, FormatOptionLabelMeta, ValueType} from 'react-select'
import CreatableSelect from 'react-select/creatable'

import {CSSObject} from '@emotion/serialize'

import {IPropertyOption} from '../blocks/board'
import {Constants} from '../constants'

import {getSelectBaseStyle} from '../theme'

import Menu from './menu'
import MenuWrapper from './menuWrapper'
import IconButton from './buttons/iconButton'
import OptionsIcon from './icons/options'
import DeleteIcon from './icons/delete'
import CloseIcon from './icons/close'
import Label from './label'

import './valueSelector.scss'

type Props = {
    options: IPropertyOption[]
    value?: IPropertyOption | IPropertyOption[]
    emptyValue: string
    onCreate: (value: string) => void
    onChange: (value: string | string[]) => void
    onChangeColor: (option: IPropertyOption, color: string) => void
    onDeleteOption: (option: IPropertyOption) => void
    isMulti?: boolean
    onDeleteValue?: (value: IPropertyOption) => void
}

type LabelProps = {
    option: IPropertyOption
    meta: FormatOptionLabelMeta<IPropertyOption, true | false>
    onChangeColor: (option: IPropertyOption, color: string) => void
    onDeleteOption: (option: IPropertyOption) => void
    onDeleteValue?: (value: IPropertyOption) => void
}

const ValueSelectorLabel = React.memo((props: LabelProps): JSX.Element => {
    const {option, onDeleteValue, meta} = props
    const intl = useIntl()
    if (meta.context === 'value') {
        return (
            <Label
                color={option.color}
                classNames={`${onDeleteValue ? 'Label-no-padding' : 'Label-single-select'}`}
            >
                <span className='Label-text'>{option.value}</span>
                {onDeleteValue &&
                    <IconButton
                        onClick={() => onDeleteValue(option)}
                        onMouseDown={(e) => e.stopPropagation()}
                        icon={<CloseIcon/>}
                        title='Close'
                        className='margin-left'
                    />
                }
            </Label>
        )
    }
    return (
        <div className='value-menu-option'>
            <div className='label-container'>
                <Label color={option.color}>{option.value}</Label>
            </div>
            <MenuWrapper stopPropagationOnToggle={true}>
                <IconButton icon={<OptionsIcon/>}/>
                <Menu position='left'>
                    <Menu.Text
                        id='delete'
                        icon={<DeleteIcon/>}
                        name={intl.formatMessage({id: 'BoardComponent.delete', defaultMessage: 'Delete'})}
                        onClick={() => props.onDeleteOption(option)}
                    />
                    <Menu.Separator/>
                    {Constants.menuColors.map((color) => (
                        <Menu.Color
                            key={color.id}
                            id={color.id}
                            name={color.name}
                            onClick={() => props.onChangeColor(option, color.id)}
                        />
                    ))}
                </Menu>
            </MenuWrapper>
        </div>
    )
})

const valueSelectorStyle = {
    ...getSelectBaseStyle(),
    option: (provided: CSSObject, state: {isFocused: boolean}): CSSObject => ({
        ...provided,
        background: state.isFocused ? 'rgba(var(--main-fg), 0.1)' : 'rgb(var(--main-bg))',
        color: state.isFocused ? 'rgb(var(--main-fg))' : 'rgb(var(--main-fg))',
        padding: '8px',
    }),
    control: (): CSSObject => ({
        border: 0,
        width: '100%',
        margin: '0',
    }),
    valueContainer: (provided: CSSObject): CSSObject => ({
        ...provided,
        padding: '0 8px',
        overflow: 'unset',
    }),
    multiValue: (provided: CSSObject): CSSObject => ({
        ...provided,
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent',
    }),
    multiValueLabel: (provided: CSSObject): CSSObject => ({
        ...provided,
        display: 'flex',
        paddingLeft: 0,
        padding: 0,
    }),
    multiValueRemove: (): CSSObject => ({
        display: 'none',
    }),
}

function ValueSelector(props: Props): JSX.Element {
    return (
        <CreatableSelect
            isMulti={props.isMulti}
            isClearable={true}
            styles={valueSelectorStyle}
            formatOptionLabel={(option: IPropertyOption, meta: FormatOptionLabelMeta<IPropertyOption, true | false>) => (
                <ValueSelectorLabel
                    option={option}
                    meta={meta}
                    onChangeColor={props.onChangeColor}
                    onDeleteOption={props.onDeleteOption}
                    onDeleteValue={props.onDeleteValue}
                />
            )}
            className='ValueSelector'
            options={props.options}
            getOptionLabel={(o: IPropertyOption) => o.value}
            getOptionValue={(o: IPropertyOption) => o.id}
            onChange={(value: ValueType<IPropertyOption, true | false>, action: ActionMeta<IPropertyOption>): void => {
                if (action.action === 'select-option') {
                    if (Array.isArray(value)) {
                        props.onChange((value as IPropertyOption[]).map((option) => option.id))
                    } else {
                        props.onChange((value as IPropertyOption).id)
                    }
                } else if (action.action === 'clear') {
                    props.onChange('')
                }
            }}
            onCreateOption={props.onCreate}
            autoFocus={true}
            value={props.value}
            closeMenuOnSelect={true}
            placeholder={props.emptyValue}
            hideSelectedOptions={false}
            defaultMenuIsOpen={false}
        />
    )
}

export default ValueSelector

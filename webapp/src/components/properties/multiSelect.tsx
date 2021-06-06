// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {IPropertyOption, IPropertyTemplate} from '../../blocks/board'

import Label from '../../widgets/label'

import ValueSelector from '../../widgets/valueSelector'

type Props = {
    emptyValue: string;
    propertyTemplate: IPropertyTemplate;
    propertyValue: string | string[];
    onChange: (value: string | string[]) => void;
    onChangeColor: (option: IPropertyOption, color: string) => void;
    onDeleteOption: (option: IPropertyOption) => void;
    onCreate: (newValue: string, currentValues: IPropertyOption[]) => void;
    onDeleteValue: (valueToDelete: IPropertyOption, currentValues: IPropertyOption[]) => void;
    isEditable: boolean;
}

const MultiSelectProperty = (props: Props): JSX.Element => {
    const {propertyTemplate, emptyValue, propertyValue, isEditable, onChange, onChangeColor, onDeleteOption, onCreate, onDeleteValue} = props

    const values = Array.isArray(propertyValue) ?
        propertyValue.map((v) => propertyTemplate.options.find((o) => o!.id === v)).filter((v): v is IPropertyOption => Boolean(v)) :
        []

    if (!isEditable) {
        return (
            <div
                className='octo-property-value'
                tabIndex={0}
            >
                {values.map((v) => (
                    <Label
                        key={v.id}
                        color={v ? v.color : 'empty'}
                    >
                        {v.value}
                    </Label>
                ))}
            </div>
        )
    }

    return (
        <ValueSelector
            isMulti={true}
            emptyValue={emptyValue}
            options={propertyTemplate.options}
            value={values}
            onChange={onChange}
            onChangeColor={onChangeColor}
            onDeleteOption={onDeleteOption}
            onDeleteValue={(valueToRemove) => onDeleteValue(valueToRemove, values)}
            onCreate={(newValue) => onCreate(newValue, values)}
        />
    )
}

export default MultiSelectProperty

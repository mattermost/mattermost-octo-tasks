// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState, useRef} from 'react'
import {useIntl} from 'react-intl'
import DayPicker, {DateUtils} from 'react-day-picker'
import MomentLocaleUtils from 'react-day-picker/moment'

import Editable from '../widgets/editable'
import SwitchOption from '../widgets/menu/switchOption'
import Button from '../widgets/buttons/button'

import Modal from '../components/modal'
import ModalWrapper from '../components/modalWrapper'

import 'react-day-picker/lib/style.css'
import './editableDayPicker.scss'
import {Utils} from '../utils'

type Props = {
    className: string
    value: string
    onChange: (value: string) => void
}

type DateProperty = {
    from?: number
    to?: number
    includeTime?: boolean
    timeZone?: string
}

const loadedLocales: Record<string, any> = {}

function EditableDayPicker(props: Props): JSX.Element {
    const {className, value, onChange} = props
    const intl = useIntl()
    const timeZoneOffset = new Date().getTimezoneOffset() * 60 * 1000

    const getDisplayDate = (date: Date | null | undefined) => {
        let displayDate = ''
        if (date) {
            displayDate = Utils.displayDate(date, intl)
        }
        return displayDate
    }

    const createDatePropertyFromString = (initialValue: string) => {
        let dateProperty: DateProperty = {}
        if (initialValue) {
            const singleDate = new Date(Number(initialValue))
            if (singleDate && DateUtils.isDate(singleDate)) {
                dateProperty.from = singleDate.getTime()
            } else {
                dateProperty = JSON.parse(initialValue)
                if (!dateProperty.includeTime) {
                    // if date only, convert from UTC to local time.
                    if (dateProperty.from) {
                        dateProperty.from += timeZoneOffset
                    }
                    if (dateProperty.to) {
                        dateProperty.to += timeZoneOffset
                    }
                }
            }
        }
        return dateProperty
    }

    const [dateProperty, setDateProperty] = useState<DateProperty>(createDatePropertyFromString(value as string))
    const [showDialog, setShowDialog] = useState(false)

    const dateFrom = dateProperty.from ? new Date(dateProperty.from) : undefined
    const dateTo = dateProperty.to ? new Date(dateProperty.to) : undefined
    const [fromInput, setFromInput] = useState<string>(getDisplayDate(dateFrom))
    const [toInput, setToInput] = useState<string>(getDisplayDate(dateTo))

    const stateRef = useRef(dateProperty)
    stateRef.current = dateProperty

    const isRange = dateTo !== undefined

    const locale = intl.locale.toLowerCase()
    if (locale && locale !== 'en' && !loadedLocales[locale]) {
        /* eslint-disable global-require */
        loadedLocales[locale] = require(`moment/locale/${locale}`)
        /* eslint-disable global-require */
    }

    const handleDayClick = (day: Date) => {
        const range = {
            ...dateProperty,
        }
        if (isRange) {
            const newRange = DateUtils.addDayToRange(day, {from: dateFrom, to: dateTo})
            range.from = newRange.from?.getTime()
            range.to = newRange.to?.getTime()
        } else {
            range.from = day.getTime()
            range.to = undefined
        }
        saveRangeValue(range)
    }

    const onRangeClick = () => {
        let range = {
            ...dateProperty,
            from: dateProperty.from,
            to: dateProperty.from,
        }
        if (isRange) {
            range = ({
                from: dateProperty.from,
                to: undefined,
            })
        }
        saveRangeValue(range)
    }

    const onClear = () => {
        saveRangeValue({})
    }

    const saveRangeValue = (range: any) => {
        setDateProperty(range)
        setFromInput(getDisplayDate(range.from ? new Date(range.from) : undefined))
        setToInput(getDisplayDate(range.to ? new Date(range.to) : undefined))
    }

    const onClose = () => {
        const current = stateRef.current
        setShowDialog(false)
        if (current && current.from) {
            if (!current.includeTime) {
                // Day has time is noon, local time
                // Set to UTC time
                if (current.from) {
                    current.from -= timeZoneOffset
                }
                if (current.to) {
                    current.to -= timeZoneOffset
                }
            }
            onChange(JSON.stringify(current))
        } else {
            onChange('')
        }
    }

    let displayValue = ''
    if (dateFrom) {
        displayValue = getDisplayDate(dateFrom)
    }
    if (dateTo) {
        displayValue += ' -> ' + getDisplayDate(dateTo)
    }

    return (
        <div className={'EditableDayPicker '}>
            <Button
                onClick={() => setShowDialog(true)}
            >
                {displayValue || intl.formatMessage({id: 'EditableDayPicker.empty', defaultMessage: 'Empty'})}
            </Button>

            {showDialog &&
                <ModalWrapper>
                    <Modal
                        onClose={() => {
                            onClose()
                        }}
                    >
                        <div
                            className={className + '-overlayWrapper'}
                        >
                            <div className={className + '-overlay'}>
                                <div className={'inputContainer'}>
                                    <Editable
                                        value={fromInput}
                                        placeholderText={intl.formatMessage({id: 'EditableDayPicker.datePlaceholder', defaultMessage: 'Select Date'})}
                                        onChange={setFromInput}
                                        onSave={() => {
                                            const newDate = new Date(fromInput)
                                            if (newDate && DateUtils.isDate(newDate)) {
                                                setDateProperty((prev) => {
                                                    return {...prev, from: newDate.getTime()}
                                                })
                                            } else {
                                                setFromInput(getDisplayDate(dateFrom))
                                            }
                                        }}
                                        onCancel={() => {
                                            setFromInput(getDisplayDate(dateFrom))
                                        }}
                                    />
                                    {dateTo &&
                                        <Editable
                                            value={toInput}
                                            placeholderText={intl.formatMessage({id: 'EditableDayPicker.datePlaceholder', defaultMessage: 'Select Date'})}
                                            onChange={setToInput}
                                            onSave={() => {
                                                const newDate = new Date(toInput)
                                                if (newDate && DateUtils.isDate(newDate)) {
                                                    setDateProperty((prevRange) => {
                                                        return {...prevRange, to: newDate.getTime()}
                                                    })
                                                } else {
                                                    setToInput(getDisplayDate(dateTo))
                                                }
                                            }}
                                            onCancel={() => {
                                                setToInput(getDisplayDate(dateTo))
                                            }}
                                        />
                                    }
                                </div>
                                <DayPicker
                                    onDayClick={handleDayClick}
                                    initialMonth={dateFrom || new Date()}
                                    showOutsideDays={true}
                                    locale={locale}
                                    localeUtils={MomentLocaleUtils}
                                    todayButton={intl.formatMessage({id: 'EditableDayPicker.today', defaultMessage: 'Today'})}
                                    selectedDays={[dateFrom || new Date(), {from: dateFrom, to: dateTo}]}

                                />
                                <hr/>
                                <SwitchOption
                                    key={'EndDateOn'}
                                    id={'EndDateOn'}
                                    name={intl.formatMessage({id: 'EditableDayPicker.endDate', defaultMessage: 'End date'})}
                                    isOn={isRange}
                                    onClick={onRangeClick}
                                />
                                <hr/>
                                <div
                                    className='MenuOption menu-option'
                                >
                                    <Button
                                        onClick={onClear}
                                    >
                                        {intl.formatMessage({id: 'EditableDayPicker.clear', defaultMessage: 'Clear'})}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                </ModalWrapper>
            }
        </div>
    )
}

export default EditableDayPicker

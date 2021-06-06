// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

const UserContext = React.createContext(undefined as IUser|undefined)

const WorkspaceUsersContext = React.createContext({
    users: new Array<IUser>(),
    usersById: new Map<string, IUser>(),
})

interface IUser {
    id: string,
    username: string,
    email: string,
    props: Record<string, any>,
    createAt: number,
    updateAt: number,
}

type WorkspaceUsersContextData = {
    users: Array<IUser>
    usersById: Map<string, IUser>
}

export {IUser, UserContext, WorkspaceUsersContext, WorkspaceUsersContextData}

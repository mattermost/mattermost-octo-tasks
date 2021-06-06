// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/mattermost/focalboard/server/model"

	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/focalboard/server/services/store"
)

func StoreTestUserStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("SetGetSystemSettings", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetWorkspaceUsers(t, store)
	})
}

func testGetWorkspaceUsers(t *testing.T, store store.Store) {
	t.Run("GetWorkspaceUSers", func(t *testing.T) {
		users, err := store.GetUsersByWorkspace("workspace_1")
		require.Equal(t, 0, len(users))
		require.Equal(t, sql.ErrNoRows, err)

		userID := uuid.New().String()

		err = store.CreateUser(&model.User{
			ID:       userID,
			Username: "darth.vader",
		})
		require.Nil(t, err)

		defer store.UpdateUser(&model.User{
			ID:       userID,
			DeleteAt: time.Now().Unix(),
		})

		users, err = store.GetUsersByWorkspace("workspace_1")
		require.Equal(t, 1, len(users))
		require.Equal(t, "darth.vader", users[0].Username)
		require.Nil(t, err)
	})
}

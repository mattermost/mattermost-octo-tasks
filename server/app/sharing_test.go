package app

import (
	"database/sql"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/mattermost/focalboard/server/model"
	st "github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/utils"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestGetSharing(t *testing.T) {
	th := SetupTestHelper(t)
	container := st.Container{
		WorkspaceID: utils.CreateGUID(),
	}

	t.Run("should get a sharing sucessfully", func(t *testing.T) {
		want := &model.Sharing{
			ID:         utils.CreateGUID(),
			Enabled:    true,
			Token:      "token",
			ModifiedBy: "otherid",
			UpdateAt:   time.Now().Unix(),
		}
		th.Store.EXPECT().GetSharing(gomock.Eq(container), gomock.Eq("test-id")).Return(want, nil)

		result, err := th.App.GetSharing(container, "test-id")
		require.NoError(t, err)

		require.Equal(t, result, want)
		require.NotNil(t, th.App)
	})

	t.Run("should fail to get a sharing", func(t *testing.T) {
		th.Store.EXPECT().GetSharing(gomock.Eq(container), gomock.Eq("test-id")).Return(
			nil,
			errors.New("sharing not found"),
		)
		result, err := th.App.GetSharing(container, "test-id")

		require.Nil(t, result)
		require.Error(t, err)
		require.Equal(t, "sharing not found", err.Error())
	})

	t.Run("should return a tuple of nil", func(t *testing.T) {
		th.Store.EXPECT().GetSharing(gomock.Eq(container), gomock.Eq("test-id")).Return(
			nil,
			sql.ErrNoRows,
		)
		result, err := th.App.GetSharing(container, "test-id")

		require.Nil(t, result)
		require.NoError(t, err)
	})
}

func TestUpsertSharing(t *testing.T) {
	th := SetupTestHelper(t)

	container := st.Container{
		WorkspaceID: utils.CreateGUID(),
	}
	sharing := model.Sharing{
		ID:         utils.CreateGUID(),
		Enabled:    true,
		Token:      "token",
		ModifiedBy: "otherid",
		UpdateAt:   time.Now().Unix(),
	}

	t.Run("should success to upsert sharing", func(t *testing.T) {
		th.Store.EXPECT().UpsertSharing(gomock.Eq(container), gomock.Eq(sharing)).Return(nil)
		err := th.App.UpsertSharing(container, sharing)

		require.NoError(t, err)
	})

	t.Run("should fail to upsert a sharing", func(t *testing.T) {
		th.Store.EXPECT().UpsertSharing(gomock.Eq(container), gomock.Eq(sharing)).Return(errors.New("sharing not found"))
		err := th.App.UpsertSharing(container, sharing)

		require.Error(t, err)
		require.Equal(t, "sharing not found", err.Error())
	})
}

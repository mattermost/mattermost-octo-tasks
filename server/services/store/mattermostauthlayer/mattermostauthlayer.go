package mattermostauthlayer

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/mlog"
	"github.com/mattermost/focalboard/server/services/store"
)

const (
	sqliteDBType   = "sqlite3"
	postgresDBType = "postgres"
)

type NotSupportedError struct {
	msg string
}

func (pe NotSupportedError) Error() string {
	return pe.msg
}

// Store represents the abstraction of the data storage.
type MattermostAuthLayer struct {
	store.Store
	dbType string
	mmDB   *sql.DB
	logger *mlog.Logger
}

// New creates a new SQL implementation of the store.
func New(dbType string, db *sql.DB, store store.Store, logger *mlog.Logger) (*MattermostAuthLayer, error) {
	layer := &MattermostAuthLayer{
		Store:  store,
		dbType: dbType,
		mmDB:   db,
		logger: logger,
	}

	return layer, nil
}

// Shutdown close the connection with the store.
func (s *MattermostAuthLayer) Shutdown() error {
	return s.Store.Shutdown()
}

func (s *MattermostAuthLayer) GetRegisteredUserCount() (int, error) {
	query := s.getQueryBuilder().
		Select("count(*)").
		From("Users").
		Where(sq.Eq{"deleteAt": 0})
	row := query.QueryRow()

	var count int
	err := row.Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *MattermostAuthLayer) getUserByCondition(condition sq.Eq) (*model.User, error) {
	query := s.getQueryBuilder().
		Select("id", "username", "email", "password", "MFASecret as mfa_secret", "AuthService as auth_service", "COALESCE(AuthData, '') as auth_data",
			"props", "CreateAt as create_at", "UpdateAt as update_at", "DeleteAt as delete_at").
		From("Users").
		Where(sq.Eq{"deleteAt": 0}).
		Where(condition)
	row := query.QueryRow()
	user := model.User{}

	var propsBytes []byte
	err := row.Scan(&user.ID, &user.Username, &user.Email, &user.Password, &user.MfaSecret, &user.AuthService,
		&user.AuthData, &propsBytes, &user.CreateAt, &user.UpdateAt, &user.DeleteAt)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(propsBytes, &user.Props)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

func (s *MattermostAuthLayer) GetUserByID(userID string) (*model.User, error) {
	return s.getUserByCondition(sq.Eq{"id": userID})
}

func (s *MattermostAuthLayer) GetUserByEmail(email string) (*model.User, error) {
	return s.getUserByCondition(sq.Eq{"email": email})
}

func (s *MattermostAuthLayer) GetUserByUsername(username string) (*model.User, error) {
	return s.getUserByCondition(sq.Eq{"username": username})
}

func (s *MattermostAuthLayer) CreateUser(user *model.User) error {
	return NotSupportedError{"no user creation allowed from focalboard, create it using mattermost"}
}

func (s *MattermostAuthLayer) UpdateUser(user *model.User) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

func (s *MattermostAuthLayer) UpdateUserPassword(username, password string) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

func (s *MattermostAuthLayer) UpdateUserPasswordByID(userID, password string) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

// GetActiveUserCount returns the number of users with active sessions within N seconds ago.
func (s *MattermostAuthLayer) GetActiveUserCount(updatedSecondsAgo int64) (int, error) {
	query := s.getQueryBuilder().
		Select("count(distinct userId)").
		From("Sessions").
		Where(sq.Gt{"LastActivityAt": time.Now().Unix() - updatedSecondsAgo})

	row := query.QueryRow()

	var count int
	err := row.Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *MattermostAuthLayer) GetSession(token string, expireTime int64) (*model.Session, error) {
	return nil, NotSupportedError{"sessions not used when using mattermost"}
}

func (s *MattermostAuthLayer) CreateSession(session *model.Session) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

func (s *MattermostAuthLayer) RefreshSession(session *model.Session) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

func (s *MattermostAuthLayer) UpdateSession(session *model.Session) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

func (s *MattermostAuthLayer) DeleteSession(sessionID string) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

func (s *MattermostAuthLayer) CleanUpSessions(expireTime int64) error {
	return NotSupportedError{"no update allowed from focalboard, update it using mattermost"}
}

func (s *MattermostAuthLayer) GetWorkspace(id string) (*model.Workspace, error) {
	if id == "0" {
		workspace := model.Workspace{
			ID:    id,
			Title: "",
		}

		return &workspace, nil
	}

	query := s.getQueryBuilder().
		Select("DisplayName, Type").
		From("Channels").
		Where(sq.Eq{"ID": id})

	row := query.QueryRow()
	var displayName string
	var channelType string
	err := row.Scan(&displayName, &channelType)
	if err != nil {
		return nil, err
	}

	if channelType != "D" && channelType != "G" {
		return &model.Workspace{ID: id, Title: displayName}, nil
	}

	query = s.getQueryBuilder().
		Select("Username").
		From("ChannelMembers").
		Join("Users ON Users.ID=ChannelMembers.UserID").
		Where(sq.Eq{"ChannelID": id})

	var sb strings.Builder
	rows, err := query.Query()
	if err != nil {
		return nil, err
	}
	defer s.CloseRows(rows)

	first := true
	for rows.Next() {
		if first {
			first = false
		} else {
			sb.WriteString(", ")
		}
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		sb.WriteString(name)
	}
	return &model.Workspace{ID: id, Title: sb.String()}, nil
}

func (s *MattermostAuthLayer) HasWorkspaceAccess(userID string, workspaceID string) (bool, error) {
	query := s.getQueryBuilder().
		Select("count(*)").
		From("ChannelMembers").
		Where(sq.Eq{"ChannelID": workspaceID}).
		Where(sq.Eq{"UserID": userID})

	row := query.QueryRow()

	var count int
	err := row.Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *MattermostAuthLayer) getWorkspaceRoles(userID string, workspaceID string) ([]string, error) {
	query := s.getQueryBuilder().
		Select("Roles, SchemeGuest, SchemeUser, SchemeAdmin").
		From("ChannelMembers").
		Where(sq.Eq{"ChannelID": workspaceID}).
		Where(sq.Eq{"UserID": userID})

	row := query.QueryRow()

	var result struct {
		roles       string
		schemeGuest bool
		schemeUser  bool
		schemeAdmin bool
	}
	err := row.Scan(&result.roles, &result.schemeGuest, &result.schemeUser, &result.schemeAdmin)
	if err != nil {
		return nil, err
	}
	workspaceRoles := []string{}
	roles := strings.Split(result.roles, " ")
	for _, role := range roles {
		if role == "workspace_admin" || role == "workspace_editor" || role == "workspace_commenter" || role == "workspace_viewer" {
			workspaceRoles = append(workspaceRoles, role)
		}
	}
	if len(workspaceRoles) == 0 {
		if result.schemeAdmin {
			workspaceRoles = append(workspaceRoles, "workspace_admin")
		}
		if result.schemeUser {
			workspaceRoles = append(workspaceRoles, "workspace_editor")
		}
		if result.schemeGuest {
			workspaceRoles = append(workspaceRoles, "workspace_viewer")
		}
	}
	return workspaceRoles, nil
}

func (s *MattermostAuthLayer) HasWorkspacePermission(userID string, workspaceID string, permissionID string) bool {
	roleNames, err := s.getWorkspaceRoles(userID, workspaceID)
	if err != nil {
		return false
	}
	s.logger.Error("Unable to get roleNames", mlog.Any("roleNames", roleNames))

	query := s.getQueryBuilder().
		Select("permissions, deleteAt").
		From("Roles").
		Where(sq.Eq{"Name": roleNames})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error("Unable to get roles", mlog.Err(err))
		return false
	}
	defer rows.Close()

	var role struct {
		permissions string
		deleteAt    int
	}
	for rows.Next() {
		err = rows.Scan(&role.permissions, &role.deleteAt)
		if err != nil {
			s.logger.Error("Role error", mlog.Err(err))
			continue
		}
		s.logger.Error("Role", mlog.Any("role", role))
		if role.deleteAt != 0 {
			continue
		}

		permissions := strings.Fields(role.permissions)
		for _, permission := range permissions {
			if permission == permissionID {
				return true
			}
		}
	}

	return false
}

func (s *MattermostAuthLayer) getQueryBuilder() sq.StatementBuilderType {
	builder := sq.StatementBuilder
	if s.dbType == postgresDBType || s.dbType == sqliteDBType {
		builder = builder.PlaceholderFormat(sq.Dollar)
	}

	return builder.RunWith(s.mmDB)
}

func (s *MattermostAuthLayer) GetUsersByWorkspace(workspaceID string) ([]*model.User, error) {
	query := s.getQueryBuilder().
		Select("id", "username", "email", "password", "MFASecret as mfa_secret", "AuthService as auth_service", "COALESCE(AuthData, '') as auth_data",
			"props", "CreateAt as create_at", "UpdateAt as update_at", "DeleteAt as delete_at").
		From("Users").
		Join("ChannelMembers ON ChannelMembers.UserID = Users.ID").
		Where(sq.Eq{"deleteAt": 0}).
		Where(sq.Eq{"ChannelMembers.ChannelId": workspaceID})

	rows, err := query.Query()
	if err != nil {
		return nil, err
	}
	defer s.CloseRows(rows)

	users, err := s.usersFromRows(rows)
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (s *MattermostAuthLayer) usersFromRows(rows *sql.Rows) ([]*model.User, error) {
	users := []*model.User{}

	for rows.Next() {
		var user model.User
		var propsBytes []byte

		err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Email,
			&user.Password,
			&user.MfaSecret,
			&user.AuthService,
			&user.AuthData,
			&propsBytes,
			&user.CreateAt,
			&user.UpdateAt,
			&user.DeleteAt,
		)
		if err != nil {
			return nil, err
		}

		err = json.Unmarshal(propsBytes, &user.Props)
		if err != nil {
			return nil, err
		}

		users = append(users, &user)
	}

	return users, nil
}

func (s *MattermostAuthLayer) CloseRows(rows *sql.Rows) {
	if err := rows.Close(); err != nil {
		s.logger.Error("error closing MattermostAuthLayer row set", mlog.Err(err))
	}
}

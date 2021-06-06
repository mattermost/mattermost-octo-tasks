package sqlstore

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	sq "github.com/Masterminds/squirrel"
	_ "github.com/lib/pq"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/mlog"
	"github.com/mattermost/focalboard/server/services/store"
	_ "github.com/mattn/go-sqlite3"
)

func (s *SQLStore) GetBlocksWithParentAndType(c store.Container, parentID string, blockType string) ([]model.Block, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"parent_id",
			"root_id",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"COALESCE(fields, '{}')",
			"create_at",
			"update_at",
			"delete_at",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"COALESCE(workspace_id, '0')": c.WorkspaceID}).
		Where(sq.Eq{"parent_id": parentID}).
		Where(sq.Eq{"type": blockType})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getBlocksWithParentAndType ERROR`, mlog.Err(err))

		return nil, err
	}

	return s.blocksFromRows(rows)
}

func (s *SQLStore) GetBlocksWithParent(c store.Container, parentID string) ([]model.Block, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"parent_id",
			"root_id",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"COALESCE(fields, '{}')",
			"create_at",
			"update_at",
			"delete_at",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"parent_id": parentID}).
		Where(sq.Eq{"coalesce(workspace_id, '0')": c.WorkspaceID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getBlocksWithParent ERROR`, mlog.Err(err))

		return nil, err
	}

	return s.blocksFromRows(rows)
}

func (s *SQLStore) GetBlocksWithRootID(c store.Container, rootID string) ([]model.Block, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"parent_id",
			"root_id",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"COALESCE(fields, '{}')",
			"create_at",
			"update_at",
			"delete_at",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"root_id": rootID}).
		Where(sq.Eq{"coalesce(workspace_id, '0')": c.WorkspaceID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlocksWithRootID ERROR`, mlog.Err(err))

		return nil, err
	}

	return s.blocksFromRows(rows)
}

func (s *SQLStore) GetBlocksWithType(c store.Container, blockType string) ([]model.Block, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"parent_id",
			"root_id",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"COALESCE(fields, '{}')",
			"create_at",
			"update_at",
			"delete_at",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"type": blockType}).
		Where(sq.Eq{"coalesce(workspace_id, '0')": c.WorkspaceID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getBlocksWithParentAndType ERROR`, mlog.Err(err))

		return nil, err
	}

	return s.blocksFromRows(rows)
}

// GetSubTree2 returns blocks within 2 levels of the given blockID
func (s *SQLStore) GetSubTree2(c store.Container, blockID string) ([]model.Block, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"parent_id",
			"root_id",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"COALESCE(fields, '{}')",
			"create_at",
			"update_at",
			"delete_at",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Or{sq.Eq{"id": blockID}, sq.Eq{"parent_id": blockID}}).
		Where(sq.Eq{"coalesce(workspace_id, '0')": c.WorkspaceID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getSubTree ERROR`, mlog.Err(err))

		return nil, err
	}

	return s.blocksFromRows(rows)
}

// GetSubTree3 returns blocks within 3 levels of the given blockID
func (s *SQLStore) GetSubTree3(c store.Container, blockID string) ([]model.Block, error) {
	// This first subquery returns repeated blocks
	query := s.getQueryBuilder().Select(
		"l3.id",
		"l3.parent_id",
		"l3.root_id",
		"l3.modified_by",
		"l3."+s.escapeField("schema"),
		"l3.type",
		"l3.title",
		"l3.fields",
		"l3.create_at",
		"l3.update_at",
		"l3.delete_at",
	).
		From(s.tablePrefix + "blocks as l1").
		Join(s.tablePrefix + "blocks as l2 on l2.parent_id = l1.id or l2.id = l1.id").
		Join(s.tablePrefix + "blocks as l3 on l3.parent_id = l2.id or l3.id = l2.id").
		Where(sq.Eq{"l1.id": blockID}).
		Where(sq.Eq{"COALESCE(l3.workspace_id, '0')": c.WorkspaceID})

	if s.dbType == postgresDBType {
		query = query.Options("DISTINCT ON (l3.id)")
	} else {
		query = query.Distinct()
	}

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getSubTree3 ERROR`, mlog.Err(err))

		return nil, err
	}

	return s.blocksFromRows(rows)
}

func (s *SQLStore) GetAllBlocks(c store.Container) ([]model.Block, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"parent_id",
			"root_id",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"COALESCE(fields, '{}')",
			"create_at",
			"update_at",
			"delete_at",
		).
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"coalesce(workspace_id, '0')": c.WorkspaceID})

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`getAllBlocks ERROR`, mlog.Err(err))

		return nil, err
	}

	return s.blocksFromRows(rows)
}

func (s *SQLStore) blocksFromRows(rows *sql.Rows) ([]model.Block, error) {
	defer rows.Close()

	results := []model.Block{}

	for rows.Next() {
		var block model.Block
		var fieldsJSON string
		var modifiedBy sql.NullString

		err := rows.Scan(
			&block.ID,
			&block.ParentID,
			&block.RootID,
			&modifiedBy,
			&block.Schema,
			&block.Type,
			&block.Title,
			&fieldsJSON,
			&block.CreateAt,
			&block.UpdateAt,
			&block.DeleteAt)
		if err != nil {
			// handle this error
			s.logger.Error(`ERROR blocksFromRows`, mlog.Err(err))

			return nil, err
		}

		if modifiedBy.Valid {
			block.ModifiedBy = modifiedBy.String
		}

		err = json.Unmarshal([]byte(fieldsJSON), &block.Fields)
		if err != nil {
			// handle this error
			s.logger.Error(`ERROR blocksFromRows fields`, mlog.Err(err))

			return nil, err
		}

		results = append(results, block)
	}

	return results, nil
}

func (s *SQLStore) GetRootID(c store.Container, blockID string) (string, error) {
	query := s.getQueryBuilder().Select("root_id").
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": blockID}).
		Where(sq.Eq{"coalesce(workspace_id, '0')": c.WorkspaceID})

	row := query.QueryRow()

	var rootID string

	err := row.Scan(&rootID)
	if err != nil {
		return "", err
	}

	return rootID, nil
}

func (s *SQLStore) GetParentID(c store.Container, blockID string) (string, error) {
	query := s.getQueryBuilder().Select("parent_id").
		From(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": blockID}).
		Where(sq.Eq{"coalesce(workspace_id, '0')": c.WorkspaceID})

	row := query.QueryRow()

	var parentID string

	err := row.Scan(&parentID)
	if err != nil {
		return "", err
	}

	return parentID, nil
}

func (s *SQLStore) InsertBlock(c store.Container, block model.Block) error {
	if block.RootID == "" {
		return errors.New("rootId is nil")
	}

	fieldsJSON, err := json.Marshal(block.Fields)
	if err != nil {
		return err
	}

	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	query := s.getQueryBuilder().Insert("").
		Columns(
			"workspace_id",
			"id",
			"parent_id",
			"root_id",
			"modified_by",
			s.escapeField("schema"),
			"type",
			"title",
			"fields",
			"create_at",
			"update_at",
			"delete_at",
		).Values(
		c.WorkspaceID,
		block.ID,
		block.ParentID,
		block.RootID,
		block.ModifiedBy,
		block.Schema,
		block.Type,
		block.Title,
		fieldsJSON,
		block.CreateAt,
		block.UpdateAt,
		block.DeleteAt,
	)

	// TODO: migrate this delete/insert to an upsert
	deleteQuery := s.getQueryBuilder().
		Delete(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": block.ID}).
		Where(sq.Eq{"COALESCE(workspace_id, '0')": c.WorkspaceID})
	_, err = sq.ExecContextWith(ctx, tx, deleteQuery)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = sq.ExecContextWith(ctx, tx, query.Into(s.tablePrefix+"blocks"))
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = sq.ExecContextWith(ctx, tx, query.Into(s.tablePrefix+"blocks_history"))
	if err != nil {
		tx.Rollback()
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func (s *SQLStore) DeleteBlock(c store.Container, blockID string, modifiedBy string) error {
	ctx := context.Background()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	now := time.Now().Unix()
	insertQuery := s.getQueryBuilder().Insert(s.tablePrefix+"blocks_history").
		Columns(
			"workspace_id",
			"id",
			"modified_by",
			"update_at",
			"delete_at",
		).
		Values(
			c.WorkspaceID,
			blockID,
			modifiedBy,
			now,
			now,
		)

	_, err = sq.ExecContextWith(ctx, tx, insertQuery)
	if err != nil {
		tx.Rollback()
		return err
	}

	deleteQuery := s.getQueryBuilder().
		Delete(s.tablePrefix + "blocks").
		Where(sq.Eq{"id": blockID}).
		Where(sq.Eq{"COALESCE(workspace_id, '0')": c.WorkspaceID})

	_, err = sq.ExecContextWith(ctx, tx, deleteQuery)
	if err != nil {
		tx.Rollback()
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func (s *SQLStore) GetBlockCountsByType() (map[string]int64, error) {
	query := s.getQueryBuilder().
		Select(
			"type",
			"COUNT(*) AS count",
		).
		From(s.tablePrefix + "blocks").
		GroupBy("type")

	rows, err := query.Query()
	if err != nil {
		s.logger.Error(`GetBlockCountsByType ERROR`, mlog.Err(err))

		return nil, err
	}

	m := make(map[string]int64)

	for rows.Next() {
		var blockType string
		var count int64

		err := rows.Scan(&blockType, &count)
		if err != nil {
			s.logger.Error("Failed to fetch block count", mlog.Err(err))
			return nil, err
		}
		m[blockType] = count
	}
	return m, nil
}

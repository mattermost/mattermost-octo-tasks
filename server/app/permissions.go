package app

func (a *App) CanCreateCards(userID, workspaceID string) bool {
	return a.store.HasWorkspacePermission(userID, workspaceID, "focalboard_workspace_create_cards")
}

func (a *App) CanCreateBoards(userID, workspaceID string) bool {
	return a.store.HasWorkspacePermission(userID, workspaceID, "focalboard_workspace_create_boards")
}

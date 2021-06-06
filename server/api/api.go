package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/app"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/mlog"
	"github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/utils"
)

const (
	HEADER_REQUESTED_WITH     = "X-Requested-With"
	HEADER_REQUESTED_WITH_XML = "XMLHttpRequest"
)

const (
	ERROR_NO_WORKSPACE_CODE    = 1000
	ERROR_NO_WORKSPACE_MESSAGE = "No workspace"
)

// ----------------------------------------------------------------------------------------------------
// REST APIs

type API struct {
	appBuilder      func() *app.App
	authService     string
	singleUserToken string
	MattermostAuth  bool
	logger          *mlog.Logger
}

func NewAPI(appBuilder func() *app.App, singleUserToken string, authService string, logger *mlog.Logger) *API {
	return &API{
		appBuilder:      appBuilder,
		singleUserToken: singleUserToken,
		authService:     authService,
		logger:          logger,
	}
}

func (a *API) app() *app.App {
	return a.appBuilder()
}

func (a *API) RegisterRoutes(r *mux.Router) {
	apiv1 := r.PathPrefix("/api/v1").Subrouter()
	apiv1.Use(a.requireCSRFToken)

	apiv1.HandleFunc("/workspaces/{workspaceID}/blocks", a.sessionRequired(a.handleGetBlocks)).Methods("GET")
	apiv1.HandleFunc("/workspaces/{workspaceID}/blocks", a.sessionRequired(a.handlePostBlocks)).Methods("POST")
	apiv1.HandleFunc("/workspaces/{workspaceID}/blocks/{blockID}", a.sessionRequired(a.handleDeleteBlock)).Methods("DELETE")
	apiv1.HandleFunc("/workspaces/{workspaceID}/blocks/{blockID}/subtree", a.attachSession(a.handleGetSubTree, false)).Methods("GET")

	apiv1.HandleFunc("/workspaces/{workspaceID}/blocks/export", a.sessionRequired(a.handleExport)).Methods("GET")
	apiv1.HandleFunc("/workspaces/{workspaceID}/blocks/import", a.sessionRequired(a.handleImport)).Methods("POST")

	apiv1.HandleFunc("/workspaces/{workspaceID}/sharing/{rootID}", a.sessionRequired(a.handlePostSharing)).Methods("POST")
	apiv1.HandleFunc("/workspaces/{workspaceID}/sharing/{rootID}", a.sessionRequired(a.handleGetSharing)).Methods("GET")

	apiv1.HandleFunc("/workspaces/{workspaceID}", a.sessionRequired(a.handleGetWorkspace)).Methods("GET")
	apiv1.HandleFunc("/workspaces/{workspaceID}/regenerate_signup_token", a.sessionRequired(a.handlePostWorkspaceRegenerateSignupToken)).Methods("POST")
	apiv1.HandleFunc("/workspaces/{workspaceID}/users", a.sessionRequired(a.getWorkspaceUsers)).Methods("GET")

	// User APIs
	apiv1.HandleFunc("/users/me", a.sessionRequired(a.handleGetMe)).Methods("GET")
	apiv1.HandleFunc("/users/{userID}", a.sessionRequired(a.handleGetUser)).Methods("GET")
	apiv1.HandleFunc("/users/{userID}/changepassword", a.sessionRequired(a.handleChangePassword)).Methods("POST")

	apiv1.HandleFunc("/login", a.handleLogin).Methods("POST")
	apiv1.HandleFunc("/register", a.handleRegister).Methods("POST")

	apiv1.HandleFunc("/workspaces/{workspaceID}/{rootID}/files", a.sessionRequired(a.handleUploadFile)).Methods("POST")

	// Get Files API

	files := r.PathPrefix("/files").Subrouter()
	files.HandleFunc("/workspaces/{workspaceID}/{rootID}/{filename}", a.attachSession(a.handleServeFile, false)).Methods("GET")
}

func (a *API) RegisterAdminRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/admin/users/{username}/password", a.adminRequired(a.handleAdminSetPassword)).Methods("POST")
}

func (a *API) requireCSRFToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !a.checkCSRFToken(r) {
			a.logger.Error("checkCSRFToken FAILED")
			a.errorResponse(w, http.StatusBadRequest, "", nil)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (a *API) checkCSRFToken(r *http.Request) bool {
	token := r.Header.Get(HEADER_REQUESTED_WITH)

	if token == HEADER_REQUESTED_WITH_XML {
		return true
	}

	return false
}

func (a *API) hasValidReadTokenForBlock(r *http.Request, container store.Container, blockID string) bool {
	query := r.URL.Query()
	readToken := query.Get("read_token")

	if len(readToken) < 1 {
		return false
	}

	isValid, err := a.app().IsValidReadToken(container, blockID, readToken)
	if err != nil {
		a.logger.Error("IsValidReadToken ERROR", mlog.Err(err))
		return false
	}

	return isValid
}

func (a *API) getContainerAllowingReadTokenForBlock(r *http.Request, blockID string) (*store.Container, error) {
	ctx := r.Context()
	session, _ := ctx.Value("session").(*model.Session)

	if a.MattermostAuth {
		// Workspace auth
		vars := mux.Vars(r)
		workspaceID := vars["workspaceID"]

		container := store.Container{
			WorkspaceID: workspaceID,
		}

		if workspaceID == "0" {
			return &container, nil
		}

		// Has session and access to workspace
		if session != nil && a.app().DoesUserHaveWorkspaceAccess(session.UserID, container.WorkspaceID) {
			return &container, nil
		}

		// No session, but has valid read token (read-only mode)
		if len(blockID) > 0 && a.hasValidReadTokenForBlock(r, container, blockID) {
			return &container, nil
		}

		return nil, errors.New("Access denied to workspace")
	}

	// Native auth: always use root workspace
	container := store.Container{
		WorkspaceID: "0",
	}

	// Has session
	if session != nil {
		return &container, nil
	}

	// No session, but has valid read token (read-only mode)
	if len(blockID) > 0 && a.hasValidReadTokenForBlock(r, container, blockID) {
		return &container, nil
	}

	return nil, errors.New("Access denied to workspace")
}

func (a *API) getContainer(r *http.Request) (*store.Container, error) {
	return a.getContainerAllowingReadTokenForBlock(r, "")
}

func (a *API) handleGetBlocks(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/workspaces/{workspaceID}/blocks getBlocks
	//
	// Returns blocks
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: parent_id
	//   in: query
	//   description: ID of parent block, omit to specify all blocks
	//   required: false
	//   type: string
	// - name: type
	//   in: query
	//   description: Type of blocks to return, omit to specify all types
	//   required: false
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/Block"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	query := r.URL.Query()
	parentID := query.Get("parent_id")
	blockType := query.Get("type")
	container, err := a.getContainer(r)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	blocks, err := a.app().GetBlocks(*container, parentID, blockType)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("GetBlocks",
		mlog.String("parentID", parentID),
		mlog.String("blockType", blockType),
		mlog.Int("block_count", len(blocks)),
	)

	json, err := json.Marshal(blocks)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, json)
}

func stampModifiedByUser(r *http.Request, blocks []model.Block) {
	ctx := r.Context()
	session := ctx.Value("session").(*model.Session)
	userID := session.UserID
	if userID == "single-user" {
		userID = ""
	}

	for i := range blocks {
		blocks[i].ModifiedBy = userID
	}
}

func (a *API) handlePostBlocks(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/workspaces/{workspaceID}/blocks updateBlocks
	//
	// Insert or update blocks
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: array of blocks to insert or update
	//   required: true
	//   schema:
	//     type: array
	//     items:
	//       "$ref": "#/definitions/Block"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	container, err := a.getContainer(r)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	requestBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	var blocks []model.Block

	err = json.Unmarshal(requestBody, &blocks)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	for _, block := range blocks {
		// Error checking
		if len(block.Type) < 1 {
			message := fmt.Sprintf("missing type for block id %s", block.ID)
			a.errorResponse(w, http.StatusBadRequest, message, nil)
			return
		}

		if block.CreateAt < 1 {
			message := fmt.Sprintf("invalid createAt for block id %s", block.ID)
			a.errorResponse(w, http.StatusBadRequest, message, nil)
			return
		}

		if block.UpdateAt < 1 {
			message := fmt.Sprintf("invalid UpdateAt for block id %s", block.ID)
			a.errorResponse(w, http.StatusBadRequest, message, nil)
			return
		}
	}

	stampModifiedByUser(r, blocks)

	err = a.app().InsertBlocks(*container, blocks)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("POST Blocks", mlog.Int("block_count", len(blocks)))
	jsonStringResponse(w, http.StatusOK, "{}")
}

func (a *API) handleGetUser(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/users/{userID} getUser
	//
	// Returns a user
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: userID
	//   in: path
	//   description: User ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/User"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	userID := vars["userID"]

	user, err := a.app().GetUser(userID)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	userData, err := json.Marshal(user)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, userData)
}

func (a *API) handleGetMe(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/users/me getMe
	//
	// Returns the currently logged-in user
	//
	// ---
	// produces:
	// - application/json
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/User"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value("session").(*model.Session)
	var user *model.User
	var err error

	if session.UserID == "single-user" {
		now := time.Now().Unix()
		user = &model.User{
			ID:       "single-user",
			Username: "single-user",
			Email:    "single-user",
			CreateAt: now,
			UpdateAt: now,
		}
	} else {
		user, err = a.app().GetUser(session.UserID)
		if err != nil {
			a.errorResponse(w, http.StatusInternalServerError, "", err)
			return
		}
	}

	userData, err := json.Marshal(user)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, userData)
}

func (a *API) handleDeleteBlock(w http.ResponseWriter, r *http.Request) {
	// swagger:operation DELETE /api/v1/workspaces/{workspaceID}/blocks/{blockID} deleteBlock
	//
	// Deletes a block
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: blockID
	//   in: path
	//   description: ID of block to delete
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	ctx := r.Context()
	session := ctx.Value("session").(*model.Session)
	userID := session.UserID

	vars := mux.Vars(r)
	blockID := vars["blockID"]

	container, err := a.getContainer(r)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	err = a.app().DeleteBlock(*container, blockID, userID)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)

		return
	}

	a.logger.Debug("DELETE Block", mlog.String("blockID", blockID))
	jsonStringResponse(w, http.StatusOK, "{}")
}

func (a *API) handleGetSubTree(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/workspaces/{workspaceID}/blocks/{blockID}/subtree getSubTree
	//
	// Returns the blocks of a subtree
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: blockID
	//   in: path
	//   description: The ID of the root block of the subtree
	//   required: true
	//   type: string
	// - name: l
	//   in: query
	//   description: The number of levels to return. 2 or 3. Defaults to 2.
	//   required: false
	//   type: integer
	//   minimum: 2
	//   maximum: 3
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/Block"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	blockID := vars["blockID"]

	container, err := a.getContainerAllowingReadTokenForBlock(r, blockID)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	query := r.URL.Query()
	levels, err := strconv.ParseInt(query.Get("l"), 10, 32)
	if err != nil {
		levels = 2
	}

	if levels != 2 && levels != 3 {
		a.logger.Error("Invalid levels", mlog.Int64("levels", levels))
		a.errorResponse(w, http.StatusBadRequest, "invalid levels", nil)
		return
	}

	blocks, err := a.app().GetSubTree(*container, blockID, int(levels))
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("GetSubTree",
		mlog.Int64("levels", levels),
		mlog.String("blockID", blockID),
		mlog.Int("block_count", len(blocks)),
	)
	json, err := json.Marshal(blocks)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, json)
}

func (a *API) handleExport(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/workspaces/{workspaceID}/blocks/export exportBlocks
	//
	// Returns all blocks
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/Block"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	query := r.URL.Query()
	rootID := query.Get("root_id")
	container, err := a.getContainer(r)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	blocks := []model.Block{}
	if rootID == "" {
		blocks, err = a.app().GetAllBlocks(*container)
	} else {
		blocks, err = a.app().GetBlocksWithRootID(*container, rootID)
	}

	a.logger.Debug("raw blocks", mlog.Int("block_count", len(blocks)))
	blocks = filterOrphanBlocks(blocks)
	a.logger.Debug("EXPORT filtered blocks", mlog.Int("block_count", len(blocks)))

	json, err := json.Marshal(blocks)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, json)
}

func filterOrphanBlocks(blocks []model.Block) (ret []model.Block) {
	queue := make([]model.Block, 0)
	childrenOfBlockWithID := make(map[string]*[]model.Block)

	// Build the trees from nodes
	for _, block := range blocks {
		if len(block.ParentID) == 0 {
			// Queue root blocks to process first
			queue = append(queue, block)
		} else {
			siblings := childrenOfBlockWithID[block.ParentID]
			if siblings != nil {
				*siblings = append(*siblings, block)
			} else {
				siblings := []model.Block{block}
				childrenOfBlockWithID[block.ParentID] = &siblings
			}
		}
	}

	// Map the trees to an array, which skips orphaned nodes
	blocks = make([]model.Block, 0)
	for len(queue) > 0 {
		block := queue[0]
		queue = queue[1:] // dequeue
		blocks = append(blocks, block)
		children := childrenOfBlockWithID[block.ID]
		if children != nil {
			queue = append(queue, (*children)...)
		}
	}

	return blocks
}

func arrayContainsBlockWithID(array []model.Block, blockID string) bool {
	for _, item := range array {
		if item.ID == blockID {
			return true
		}
	}
	return false
}

func (a *API) handleImport(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/workspaces/{workspaceID}/blocks/import importBlocks
	//
	// Import blocks
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: array of blocks to import
	//   required: true
	//   schema:
	//     type: array
	//     items:
	//       "$ref": "#/definitions/Block"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	container, err := a.getContainer(r)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	requestBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	var blocks []model.Block

	err = json.Unmarshal(requestBody, &blocks)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	stampModifiedByUser(r, blocks)

	err = a.app().InsertBlocks(*container, blocks)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("IMPORT Blocks", mlog.Int("block_count", len(blocks)))
	jsonStringResponse(w, http.StatusOK, "{}")
}

// Sharing

func (a *API) handleGetSharing(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/workspaces/{workspaceID}/sharing/{rootID} getSharing
	//
	// Returns sharing information for a root block
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: rootID
	//   in: path
	//   description: ID of the root block
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/Sharing"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	rootID := vars["rootID"]

	container, err := a.getContainer(r)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	sharing, err := a.app().GetSharing(*container, rootID)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	sharingData, err := json.Marshal(sharing)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("GET sharing", mlog.String("rootID", rootID))
	jsonBytesResponse(w, http.StatusOK, sharingData)
}

func (a *API) handlePostSharing(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/workspaces/{workspaceID}/sharing/{rootID} postSharing
	//
	// Sets sharing information for a root block
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: rootID
	//   in: path
	//   description: ID of the root block
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: sharing information for a root block
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/Sharing"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	container, err := a.getContainer(r)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	requestBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	var sharing model.Sharing

	err = json.Unmarshal(requestBody, &sharing)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	// Stamp ModifiedBy
	ctx := r.Context()
	session := ctx.Value("session").(*model.Session)
	userID := session.UserID
	if userID == "single-user" {
		userID = ""
	}
	sharing.ModifiedBy = userID

	err = a.app().UpsertSharing(*container, sharing)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("POST sharing", mlog.String("sharingID", sharing.ID))
	jsonStringResponse(w, http.StatusOK, "{}")
}

// Workspace

func (a *API) handleGetWorkspace(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/workspaces/{workspaceID} getWorkspace
	//
	// Returns information of the root workspace
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/Workspace"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	var workspace *model.Workspace
	var err error

	if a.MattermostAuth {
		vars := mux.Vars(r)
		workspaceID := vars["workspaceID"]

		ctx := r.Context()
		session := ctx.Value("session").(*model.Session)
		if !a.app().DoesUserHaveWorkspaceAccess(session.UserID, workspaceID) {
			a.errorResponse(w, http.StatusUnauthorized, "", nil)
			return
		}

		workspace, err = a.app().GetWorkspace(workspaceID)
		if err != nil {
			a.errorResponse(w, http.StatusInternalServerError, "", err)
		}
		if workspace == nil {
			a.errorResponse(w, http.StatusUnauthorized, "", nil)
			return
		}
	} else {
		workspace, err = a.app().GetRootWorkspace()
		if err != nil {
			a.errorResponse(w, http.StatusInternalServerError, "", err)
			return
		}
	}

	workspaceData, err := json.Marshal(workspace)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, workspaceData)
}

func (a *API) handlePostWorkspaceRegenerateSignupToken(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/workspaces/{workspaceID}/regenerate_signup_token regenerateSignupToken
	//
	// Regenerates the signup token for the root workspace
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	workspace, err := a.app().GetRootWorkspace()
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	workspace.SignupToken = utils.CreateGUID()

	err = a.app().UpsertWorkspaceSignupToken(*workspace)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
}

// File upload

func (a *API) handleServeFile(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /workspaces/{workspaceID}/{rootID}/{fileID} getFile
	//
	// Returns the contents of an uploaded file
	//
	// ---
	// produces:
	// - application/json
	// - image/jpg
	// - image/png
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: rootID
	//   in: path
	//   description: ID of the root block
	//   required: true
	//   type: string
	// - name: fileID
	//   in: path
	//   description: ID of the file
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	workspaceID := vars["workspaceID"]
	rootID := vars["rootID"]
	filename := vars["filename"]

	// Caller must have access to the root block's container
	_, err := a.getContainerAllowingReadTokenForBlock(r, rootID)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	contentType := "image/jpg"

	fileExtension := strings.ToLower(filepath.Ext(filename))
	if fileExtension == "png" {
		contentType = "image/png"
	}

	w.Header().Set("Content-Type", contentType)

	fileReader, err := a.app().GetFileReader(workspaceID, rootID, filename)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}
	defer fileReader.Close()
	http.ServeContent(w, r, filename, time.Now(), fileReader)
}

// FileUploadResponse is the response to a file upload
// swagger:model
type FileUploadResponse struct {
	// The FileID to retrieve the uploaded file
	// required: true
	FileID string `json:"fileId"`
}

func (a *API) handleUploadFile(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/workspaces/{workspaceID}/{rootID}/files uploadFile
	//
	// Upload a binary file, attached to a root block
	//
	// ---
	// consumes:
	// - multipart/form-data
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// - name: rootID
	//   in: path
	//   description: ID of the root block
	//   required: true
	//   type: string
	// - name: uploaded file
	//   in: formData
	//   type: file
	//   description: The file to upload
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/FileUploadResponse"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	workspaceID := vars["workspaceID"]
	rootID := vars["rootID"]

	// Caller must have access to the root block's container
	_, err := a.getContainerAllowingReadTokenForBlock(r, rootID)
	if err != nil {
		a.noContainerErrorResponse(w, err)
		return
	}

	file, handle, err := r.FormFile("file")
	if err != nil {
		fmt.Fprintf(w, "%v", err)

		return
	}
	defer file.Close()

	fileId, err := a.app().SaveFile(file, workspaceID, rootID, handle.Filename)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("uploadFile",
		mlog.String("filename", handle.Filename),
		mlog.String("fileID", fileId),
	)
	data, err := json.Marshal(FileUploadResponse{FileID: fileId})
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}

func (a *API) getWorkspaceUsers(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /api/v1/workspaces/{workspaceID}/users getWorkspaceUsers
	//
	// Returns workspace users
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: workspaceID
	//   in: path
	//   description: Workspace ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/User"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	workspaceID := vars["workspaceID"]

	ctx := r.Context()
	session := ctx.Value("session").(*model.Session)
	if !a.app().DoesUserHaveWorkspaceAccess(session.UserID, workspaceID) {
		a.errorResponse(w, http.StatusForbidden, "Access denied to workspace", errors.New("Access denied to workspace"))
		return
	}

	users, err := a.app().GetWorkspaceUsers(workspaceID)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	data, err := json.Marshal(users)
	if err != nil {
		a.errorResponse(w, http.StatusInternalServerError, "", err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
}

// Response helpers

func (a *API) errorResponse(w http.ResponseWriter, code int, message string, sourceError error) {
	a.logger.Error("API ERROR",
		mlog.Int("code", code),
		mlog.Err(sourceError),
	)
	w.Header().Set("Content-Type", "application/json")
	data, err := json.Marshal(model.ErrorResponse{Error: message, ErrorCode: code})
	if err != nil {
		data = []byte("{}")
	}
	w.WriteHeader(code)
	w.Write(data)
}

func (a *API) errorResponseWithCode(w http.ResponseWriter, statusCode int, errorCode int, message string, sourceError error) {
	a.logger.Error("API ERROR",
		mlog.Int("status", statusCode),
		mlog.Int("code", errorCode),
		mlog.Err(sourceError),
	)
	w.Header().Set("Content-Type", "application/json")
	data, err := json.Marshal(model.ErrorResponse{Error: message, ErrorCode: errorCode})
	if err != nil {
		data = []byte("{}")
	}
	w.WriteHeader(statusCode)
	w.Write(data)
}

func (a *API) noContainerErrorResponse(w http.ResponseWriter, sourceError error) {
	a.errorResponseWithCode(w, http.StatusBadRequest, ERROR_NO_WORKSPACE_CODE, ERROR_NO_WORKSPACE_MESSAGE, sourceError)
}

func jsonStringResponse(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	fmt.Fprint(w, message)
}

func jsonBytesResponse(w http.ResponseWriter, code int, json []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(json)
}

func addUserID(rw http.ResponseWriter, req *http.Request, next http.Handler) {
	ctx := context.WithValue(req.Context(), "userid", req.Header.Get("userid"))
	req = req.WithContext(ctx)
	next.ServeHTTP(rw, req)
}

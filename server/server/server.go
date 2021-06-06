package server

import (
	"log"
	"net"
	"net/http"
	"os"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/focalboard/server/api"
	"github.com/mattermost/focalboard/server/app"
	"github.com/mattermost/focalboard/server/auth"
	"github.com/mattermost/focalboard/server/context"
	appModel "github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/metrics"
	"github.com/mattermost/focalboard/server/services/mlog"
	"github.com/mattermost/focalboard/server/services/scheduler"
	"github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/services/store/mattermostauthlayer"
	"github.com/mattermost/focalboard/server/services/store/sqlstore"
	"github.com/mattermost/focalboard/server/services/telemetry"
	"github.com/mattermost/focalboard/server/services/webhook"
	"github.com/mattermost/focalboard/server/web"
	"github.com/mattermost/focalboard/server/ws"
	"github.com/oklog/run"

	"github.com/mattermost/mattermost-server/v5/shared/filestore"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	cleanupSessionTaskFrequency = 10 * time.Minute
	updateMetricsTaskFrequency  = 15 * time.Minute

	//nolint:gomnd
	minSessionExpiryTime = int64(60 * 60 * 24 * 31) // 31 days
)

type Server struct {
	config                 *config.Configuration
	wsServer               *ws.Server
	webServer              *web.Server
	store                  store.Store
	filesBackend           filestore.FileBackend
	telemetry              *telemetry.Service
	logger                 *mlog.Logger
	cleanUpSessionsTask    *scheduler.ScheduledTask
	metricsServer          *metrics.Service
	metricsService         *metrics.Metrics
	metricsUpdaterTask     *scheduler.ScheduledTask
	servicesStartStopMutex sync.Mutex

	localRouter     *mux.Router
	localModeServer *http.Server
	api             *api.API
	appBuilder      func() *app.App
}

func New(cfg *config.Configuration, singleUserToken string, logger *mlog.Logger) (*Server, error) {
	var db store.Store
	db, err := sqlstore.New(cfg.DBType, cfg.DBConfigString, cfg.DBTablePrefix, logger)
	if err != nil {
		logger.Error("Unable to start the database", mlog.Err(err))
		return nil, err
	}
	if cfg.AuthMode == "mattermost" {
		layeredStore, err := mattermostauthlayer.New(cfg.DBType, cfg.DBConfigString, db)
		if err != nil {
			log.Print("Unable to start the database", err)
			return nil, err
		}
		db = layeredStore
	}

	authenticator := auth.New(cfg, db)

	wsServer := ws.NewServer(authenticator, singleUserToken, cfg.AuthMode == "mattermost", logger)

	filesBackendSettings := filestore.FileBackendSettings{}
	filesBackendSettings.DriverName = cfg.FilesDriver
	filesBackendSettings.Directory = cfg.FilesPath
	filesBackendSettings.AmazonS3AccessKeyId = cfg.FilesS3Config.AccessKeyId
	filesBackendSettings.AmazonS3SecretAccessKey = cfg.FilesS3Config.SecretAccessKey
	filesBackendSettings.AmazonS3Bucket = cfg.FilesS3Config.Bucket
	filesBackendSettings.AmazonS3PathPrefix = cfg.FilesS3Config.PathPrefix
	filesBackendSettings.AmazonS3Region = cfg.FilesS3Config.Region
	filesBackendSettings.AmazonS3Endpoint = cfg.FilesS3Config.Endpoint
	filesBackendSettings.AmazonS3SSL = cfg.FilesS3Config.SSL
	filesBackendSettings.AmazonS3SignV2 = cfg.FilesS3Config.SignV2
	filesBackendSettings.AmazonS3SSE = cfg.FilesS3Config.SSE
	filesBackendSettings.AmazonS3Trace = cfg.FilesS3Config.Trace

	filesBackend, appErr := filestore.NewFileBackend(filesBackendSettings)
	if appErr != nil {
		logger.Error("Unable to initialize the files storage", mlog.Err(appErr))

		return nil, errors.New("unable to initialize the files storage")
	}

	webhookClient := webhook.NewClient(cfg, logger)

	// Init metrics
	instanceInfo := metrics.InstanceInfo{
		Version:        appModel.CurrentVersion,
		BuildNum:       appModel.BuildNumber,
		Edition:        appModel.Edition,
		InstallationID: os.Getenv("MM_CLOUD_INSTALLATION_ID"),
	}
	metricsService := metrics.NewMetrics(instanceInfo)

	appServices := app.AppServices{
		Auth:         authenticator,
		Store:        db,
		FilesBackend: filesBackend,
		Webhook:      webhookClient,
		Metrics:      metricsService,
		Logger:       logger,
	}
	appBuilder := func() *app.App { return app.New(cfg, wsServer, appServices) }

	focalboardAPI := api.NewAPI(appBuilder, singleUserToken, cfg.AuthMode, logger)

	// Local router for admin APIs
	localRouter := mux.NewRouter()
	focalboardAPI.RegisterAdminRoutes(localRouter)

	// Init workspace
	if _, err = appBuilder().GetRootWorkspace(); err != nil {
		logger.Error("Unable to get root workspace", mlog.Err(err))
		return nil, err
	}

	webServer := web.NewServer(cfg.WebPath, cfg.ServerRoot, cfg.Port, cfg.UseSSL, cfg.LocalOnly, logger)
	webServer.AddRoutes(wsServer)
	webServer.AddRoutes(focalboardAPI)

	settings, err := db.GetSystemSettings()
	if err != nil {
		return nil, err
	}

	// Init telemetry
	telemetryID := settings["TelemetryID"]
	if len(telemetryID) == 0 {
		telemetryID = uuid.New().String()
		if err = db.SetSystemSetting("TelemetryID", uuid.New().String()); err != nil {
			return nil, err
		}
	}
	telemetryOpts := telemetryOptions{
		appBuilder:  appBuilder,
		cfg:         cfg,
		telemetryID: telemetryID,
		logger:      logger,
		singleUser:  len(singleUserToken) > 0,
	}
	telemetryService := initTelemetry(telemetryOpts)

	server := Server{
		config:         cfg,
		wsServer:       wsServer,
		webServer:      webServer,
		store:          db,
		filesBackend:   filesBackend,
		telemetry:      telemetryService,
		metricsServer:  metrics.NewMetricsServer(cfg.PrometheusAddress, metricsService, logger),
		metricsService: metricsService,
		logger:         logger,
		localRouter:    localRouter,
		api:            focalboardAPI,
		appBuilder:     appBuilder,
	}

	server.initHandlers()

	return &server, nil
}

func (s *Server) Start() error {
	s.logger.Info("Server.Start")

	s.webServer.Start()

	s.servicesStartStopMutex.Lock()
	defer s.servicesStartStopMutex.Unlock()

	if s.config.EnableLocalMode {
		if err := s.startLocalModeServer(); err != nil {
			return err
		}
	}

	s.cleanUpSessionsTask = scheduler.CreateRecurringTask("cleanUpSessions", func() {
		secondsAgo := minSessionExpiryTime
		if secondsAgo < s.config.SessionExpireTime {
			secondsAgo = s.config.SessionExpireTime
		}

		if err := s.store.CleanUpSessions(secondsAgo); err != nil {
			s.logger.Error("Unable to clean up the sessions", mlog.Err(err))
		}
	}, cleanupSessionTaskFrequency)

	metricsUpdater := func() {
		app := s.appBuilder()
		blockCounts, err := app.GetBlockCountsByType()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "blocks"), mlog.Err(err))
			return
		}
		s.logger.Log(mlog.Metrics, "Block metrics collected", mlog.Map("block_counts", blockCounts))
		for blockType, count := range blockCounts {
			s.metricsService.ObserveBlockCount(blockType, count)
		}
		workspaceCount, err := app.GetWorkspaceCount()
		if err != nil {
			s.logger.Error("Error updating metrics", mlog.String("group", "workspaces"), mlog.Err(err))
			return
		}
		s.logger.Log(mlog.Metrics, "Workspace metrics collected", mlog.Int64("workspace_count", workspaceCount))
		s.metricsService.ObserveWorkspaceCount(workspaceCount)
	}
	//metricsUpdater()   Calling this immediately causes integration unit tests to fail.
	s.metricsUpdaterTask = scheduler.CreateRecurringTask("updateMetrics", metricsUpdater, updateMetricsTaskFrequency)

	if s.config.Telemetry {
		firstRun := utils.MillisFromTime(time.Now())
		s.telemetry.RunTelemetryJob(firstRun)
	}

	var group run.Group
	if s.config.PrometheusAddress != "" {
		group.Add(func() error {
			if err := s.metricsServer.Run(); err != nil {
				return errors.Wrap(err, "PromServer Run")
			}
			return nil
		}, func(error) {
			s.metricsServer.Shutdown()
		})

		if err := group.Run(); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) Shutdown() error {
	if err := s.webServer.Shutdown(); err != nil {
		return err
	}

	s.stopLocalModeServer()

	s.servicesStartStopMutex.Lock()
	defer s.servicesStartStopMutex.Unlock()

	if s.cleanUpSessionsTask != nil {
		s.cleanUpSessionsTask.Cancel()
	}

	if s.metricsUpdaterTask != nil {
		s.metricsUpdaterTask.Cancel()
	}

	if err := s.telemetry.Shutdown(); err != nil {
		s.logger.Warn("Error occurred when shutting down telemetry", mlog.Err(err))
	}

	defer s.logger.Info("Server.Shutdown")

	return s.store.Shutdown()
}

func (s *Server) Config() *config.Configuration {
	return s.config
}

func (s *Server) Logger() *mlog.Logger {
	return s.logger
}

// Local server

func (s *Server) startLocalModeServer() error {
	s.localModeServer = &http.Server{
		Handler:     s.localRouter,
		ConnContext: context.SetContextConn,
	}

	// TODO: Close and delete socket file on shutdown
	if err := syscall.Unlink(s.config.LocalModeSocketLocation); err != nil {
		s.logger.Error("Unable to unlink socket.", mlog.Err(err))
	}

	socket := s.config.LocalModeSocketLocation
	unixListener, err := net.Listen("unix", socket)
	if err != nil {
		return err
	}
	if err = os.Chmod(socket, 0600); err != nil {
		return err
	}

	go func() {
		s.logger.Info("Starting unix socket server")
		err = s.localModeServer.Serve(unixListener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.logger.Error("Error starting unix socket server", mlog.Err(err))
		}
	}()

	return nil
}

func (s *Server) stopLocalModeServer() {
	if s.localModeServer != nil {
		_ = s.localModeServer.Close()
		s.localModeServer = nil
	}
}

func (s *Server) GetRootRouter() *mux.Router {
	return s.webServer.Router()
}

func (s *Server) SetWSHub(hub ws.Hub) {
	s.wsServer.SetHub(hub)
}

type telemetryOptions struct {
	appBuilder  func() *app.App
	cfg         *config.Configuration
	telemetryID string
	logger      *mlog.Logger
	singleUser  bool
}

func initTelemetry(opts telemetryOptions) *telemetry.Service {
	telemetryService := telemetry.New(opts.telemetryID, opts.logger)

	telemetryService.RegisterTracker("server", func() (telemetry.Tracker, error) {
		return map[string]interface{}{
			"version":          appModel.CurrentVersion,
			"build_number":     appModel.BuildNumber,
			"build_hash":       appModel.BuildHash,
			"edition":          appModel.Edition,
			"operating_system": runtime.GOOS,
		}, nil
	})
	telemetryService.RegisterTracker("config", func() (telemetry.Tracker, error) {
		return map[string]interface{}{
			"serverRoot":  opts.cfg.ServerRoot == config.DefaultServerRoot,
			"port":        opts.cfg.Port == config.DefaultPort,
			"useSSL":      opts.cfg.UseSSL,
			"dbType":      opts.cfg.DBType,
			"single_user": opts.singleUser,
		}, nil
	})
	telemetryService.RegisterTracker("activity", func() (telemetry.Tracker, error) {
		m := make(map[string]interface{})
		var count int
		var err error
		if count, err = opts.appBuilder().GetRegisteredUserCount(); err != nil {
			return nil, err
		}
		m["registered_users"] = count

		if count, err = opts.appBuilder().GetDailyActiveUsers(); err != nil {
			return nil, err
		}
		m["daily_active_users"] = count

		if count, err = opts.appBuilder().GetWeeklyActiveUsers(); err != nil {
			return nil, err
		}
		m["weekly_active_users"] = count

		if count, err = opts.appBuilder().GetMonthlyActiveUsers(); err != nil {
			return nil, err
		}
		m["monthly_active_users"] = count
		return m, nil
	})
	telemetryService.RegisterTracker("blocks", func() (telemetry.Tracker, error) {
		blockCounts, err := opts.appBuilder().GetBlockCountsByType()
		if err != nil {
			return nil, err
		}
		m := make(map[string]interface{})
		for k, v := range blockCounts {
			m[k] = v
		}
		return m, nil
	})
	telemetryService.RegisterTracker("workspaces", func() (telemetry.Tracker, error) {
		count, err := opts.appBuilder().GetWorkspaceCount()
		if err != nil {
			return nil, err
		}
		m := map[string]interface{}{
			"workspaces": count,
		}
		return m, nil
	})
	return telemetryService
}

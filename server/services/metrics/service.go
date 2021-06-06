package metrics

import (
	"net/http"

	"github.com/mattermost/focalboard/server/services/mlog"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Service prometheus to run the server
type Service struct {
	*http.Server
}

// NewMetricsServer factory method to create a new prometheus server
func NewMetricsServer(address string, metricsService *Metrics, logger *mlog.Logger) *Service {
	return &Service{
		&http.Server{
			Addr: address,
			Handler: promhttp.HandlerFor(metricsService.registry, promhttp.HandlerOpts{
				ErrorLog: logger.StdLogger(mlog.Error),
			}),
		},
	}
}

// Run will start the prometheus server
func (h *Service) Run() error {
	return errors.Wrap(h.Server.ListenAndServe(), "prometheus ListenAndServe")
}

// Shutdown will shutdown the prometheus server
func (h *Service) Shutdown() error {
	return errors.Wrap(h.Server.Close(), "prometheus Close")
}

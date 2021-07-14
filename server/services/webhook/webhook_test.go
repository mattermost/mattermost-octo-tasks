package webhook

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/mlog"
)

func TestClientUpdateNotify(t *testing.T) {

	var isNotified bool
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isNotified = true
	}))
	defer ts.Close()

	cfg := &config.Configuration{
		WebhookUpdate: []string{ts.URL},
	}

	client := NewClient(cfg, mlog.CreateTestLogger(t))

	client.NotifyUpdate(model.Block{})

	if !isNotified {
		t.Error("webhook url not be notified")
	}
}

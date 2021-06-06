// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import "github.com/mattermost/logr/v2"

// Standard levels
var (
	Panic  = logr.Panic // ID = 0
	Fatal  = logr.Fatal // ID = 1
	Error  = logr.Error // ID = 2
	Warn   = logr.Warn  // ID = 3
	Info   = logr.Info  // ID = 4
	Debug  = logr.Debug // ID = 5
	Trace  = logr.Trace // ID = 6
	StdAll = []Level{Panic, Fatal, Error, Warn, Info, Debug, Trace}
)

// Register custom (discrete) levels here.
// !!!!! Custom ID's must be between 20 and 32,768 !!!!!!
var (
	/* Example
	   // used by the audit system
	   AuditAPI     = Level{ID: 100, Name: "audit-api"}
	   AuditContent = Level{ID: 101, Name: "audit-content"}
	   AuditPerms   = Level{ID: 102, Name: "audit-permissions"}
	   AuditCLI     = Level{ID: 103, Name: "audit-cli"}
	*/

	// add more here ...
	Telemetry = Level{ID: 500, Name: "telemetry"}
	Metrics   = Level{ID: 501, Name: "metrics"}
)

// Combinations for LogM (log multi)
var (
/* Example
MAuditAll = []Level{AuditAPI, AuditContent, AuditPerms, AuditCLI}
*/
)

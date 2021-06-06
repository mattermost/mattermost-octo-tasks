// Package mlog provides a simple wrapper around Logr.
package mlog

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"time"

	"github.com/mattermost/logr/v2"
	logrcfg "github.com/mattermost/logr/v2/config"
)

const (
	ShutdownTimeout = time.Second * 15
)

// Type and function aliases from Logr to limit the spread of dependencies throughout Focalboard.
type Field = logr.Field
type Level = logr.Level

// Any picks the best supported field type based on type of val.
// For best performance when passing a struct (or struct pointer),
// implement `logr.LogWriter` on the struct, otherwise reflection
// will be used to generate a string representation.
var Any = logr.Any

// Int64 constructs a field containing a key and Int64 value.
var Int64 = logr.Int64

// Int32 constructs a field containing a key and Int32 value.
var Int32 = logr.Int32

// Int constructs a field containing a key and Int value.
var Int = logr.Int

// Uint64 constructs a field containing a key and Uint64 value.
var Uint64 = logr.Uint64

// Uint32 constructs a field containing a key and Uint32 value.
var Uint32 = logr.Uint32

// Uint constructs a field containing a key and Uint value.
var Uint = logr.Uint

// Float64 constructs a field containing a key and Float64 value.
var Float64 = logr.Float64

// Float32 constructs a field containing a key and Float32 value.
var Float32 = logr.Float32

// String constructs a field containing a key and String value.
var String = logr.String

// Stringer constructs a field containing a key and a fmt.Stringer value.
// The fmt.Stringer's `String` method is called lazily.
var Stringer = logr.Stringer

// Err constructs a field containing a default key ("error") and error value.
var Err = logr.Err

// NamedErr constructs a field containing a key and error value.
var NamedErr = logr.NamedErr

// Bool constructs a field containing a key and bool value.
var Bool = logr.Bool

// Time constructs a field containing a key and time.Time value.
var Time = logr.Time

// Duration constructs a field containing a key and time.Duration value.
var Duration = logr.Duration

// Millis constructs a field containing a key and timestamp value.
// The timestamp is expected to be milliseconds since Jan 1, 1970 UTC.
var Millis = logr.Millis

// Array constructs a field containing a key and array value.
var Array = logr.Array

// Map constructs a field containing a key and map value.
var Map = logr.Map

// LoggerConfig is a map of LogTarget configurations.
type LoggerConfig map[string]logrcfg.TargetCfg

func (lc LoggerConfig) append(cfg LoggerConfig) {
	for k, v := range cfg {
		lc[k] = v
	}
}

// Logger provides a thin wrapper around a Logr instance. This is a struct instead of an interface
// so that there are no allocations on the heap each interface method invocation. Normally not
// something to be concerned about, but logging calls for disabled levels should have as little CPU
// and memory impact as possible. Most of these wrapper calls will be inlined as well.
type Logger struct {
	log *logr.Logger
}

// NewLogger creates a new Logger instance which can be configured via `(*Logger).Configure`
func NewLogger() *Logger {
	lgr, _ := logr.New()
	log := lgr.NewLogger()

	return &Logger{
		log: &log,
	}
}

// Configure provides a new configuration for this logger.
// Zero or more sources of config can be provided, with target name collisions resolved using the
// following precedence:
//     cfgFile > cfgJson
func (l *Logger) Configure(cfgFile string, cfgEscaped string) error {
	cfgMap := make(LoggerConfig)

	// Add config from file
	if cfgFile != "" {
		if b, err := ioutil.ReadFile(string(cfgFile)); err != nil {
			return fmt.Errorf("error reading logger config file %s: %w", cfgFile, err)
		} else {
			var mapCfgFile LoggerConfig
			if err := json.Unmarshal(b, &mapCfgFile); err != nil {
				return fmt.Errorf("error decoding logger config file %s: %w", cfgFile, err)
			}
			cfgMap.append(mapCfgFile)
		}
	}

	// Add config from escaped json string
	if cfgEscaped != "" {
		var mapCfgEscaped LoggerConfig
		if err := json.Unmarshal([]byte(cfgEscaped), &mapCfgEscaped); err != nil {
			return fmt.Errorf("error decoding logger config as escaped json: %w", err)
		}
		cfgMap.append(mapCfgEscaped)
	}

	if len(cfgMap) == 0 {
		return nil
	}

	return logrcfg.ConfigureTargets(l.log.Logr(), cfgMap, nil)
}

// With creates a new Logger with the specified fields. This is a light-weight
// operation and can be called on demand.
func (l *Logger) With(fields ...Field) *Logger {
	logWith := l.log.With(fields...)
	return &Logger{
		log: &logWith,
	}
}

// IsLevelEnabled returns true only if at least one log target is
// configured to emit the specified log level. Use this check when
// gathering the log info may be expensive.
//
// Note, transformations and serializations done via fields are already
// lazily evaluated and don't require this check beforehand.
func (l *Logger) IsLevelEnabled(level Level) bool {
	return l.IsLevelEnabled(level)
}

// Log emits the log record for any targets configured for the specified level.
func (l *Logger) Log(level Level, msg string, fields ...Field) {
	l.log.Log(level, msg, fields...)
}

// LogM emits the log record for any targets configured for the specified levels.
// Equivalent to calling `Log` once for each level.
func (l *Logger) LogM(levels []Level, msg string, fields ...Field) {
	l.log.LogM(levels, msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Trace` level.
func (l *Logger) Trace(msg string, fields ...Field) {
	l.log.Trace(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Debug` level.
func (l *Logger) Debug(msg string, fields ...Field) {
	l.log.Debug(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Info` level.
func (l *Logger) Info(msg string, fields ...Field) {
	l.log.Info(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Warn` level.
func (l *Logger) Warn(msg string, fields ...Field) {
	l.log.Warn(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Error` level.
func (l *Logger) Error(msg string, fields ...Field) {
	l.log.Error(msg, fields...)
}

// Convenience method equivalent to calling `Log` with the `Fatal` level,
// followed by `os.Exit(1)`.
func (l *Logger) Fatal(msg string, fields ...Field) {
	l.log.Log(logr.Fatal, msg, fields...)
	l.Shutdown()
	os.Exit(1)
}

// HasTargets returns true if at least one log target has been added.
func (l *Logger) HasTargets() bool {
	return l.log.Logr().HasTargets()
}

// StdLogger creates a standard logger backed by this logger.
// All log records are output with the specified level.
func (l *Logger) StdLogger(level Level) *log.Logger {
	return l.log.StdLogger(level)
}

// RedirectStdLog redirects output from the standard library's package-global logger
// to this logger at the specified level and with zero or more Field's. Since this logger already
// handles caller annotations, timestamps, etc., it automatically disables the standard
// library's annotations and prefixing.
// A function is returned that restores the original prefix and flags and resets the standard
// library's output to os.Stdout.
func (l *Logger) RedirectStdLog(level Level, fields ...Field) func() {
	return l.log.Logr().RedirectStdLog(level, fields...)
}

// Shutdown shuts down the logger after making best efforts to flush any
// remaining records.
func (l *Logger) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), ShutdownTimeout)
	defer cancel()
	return l.log.Logr().ShutdownWithTimeout(ctx)
}

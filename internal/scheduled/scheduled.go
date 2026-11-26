// Package scheduled implements superuser-managed HTTP requests that run on a cron schedule.
package scheduled

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	validation "ganigeorgiev.com/pocketbase/ozzo-validation/v4"
	"ganigeorgiev.com/pocketbase/pocketbase/apis"
	"ganigeorgiev.com/pocketbase/pocketbase/core"
	"ganigeorgiev.com/pocketbase/pocketbase/tools/cron"
	"ganigeorgiev.com/pocketbase/pocketbase/tools/types"
)

// Collection is the internal collection that stores scheduled requests.
const Collection = "_ekilie_scheduled_requests"

// RunsCollection stores one row per execution.
const RunsCollection = "_ekilie_scheduled_runs"

const jobPrefix = "ekilie-scheduled:"

var methods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"}

// Manager keeps the stored definitions in sync with the app cron scheduler.
type Manager struct {
	app  core.App
	mu   sync.Mutex
	jobs map[string]struct{}
}

// Register installs the collection hooks, cron sync and the run-now route.
func Register(app core.App) *Manager {
	m := &Manager{app: app, jobs: map[string]struct{}{}}

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		if err := m.ensureCollection(); err != nil {
			return fmt.Errorf("scheduled requests: %w", err)
		}
		m.sync()
		m.bindRoutes(e)
		return e.Next()
	})

	app.OnRecordValidate(Collection).BindFunc(func(e *core.RecordEvent) error {
		if err := validate(e.Record); err != nil {
			return err
		}
		return e.Next()
	})

	app.OnRecordAfterCreateSuccess(Collection).BindFunc(func(e *core.RecordEvent) error {
		m.sync()
		return e.Next()
	})

	app.OnRecordAfterUpdateSuccess(Collection).BindFunc(func(e *core.RecordEvent) error {
		// Run results update the record constantly. Only re-register when the schedule or enabled flag changes.
		if e.Record.GetString("schedule") != e.Record.Original().GetString("schedule") ||
			e.Record.GetBool("enabled") != e.Record.Original().GetBool("enabled") {
			m.sync()
		}
		return e.Next()
	})

	app.OnRecordAfterDeleteSuccess(Collection).BindFunc(func(e *core.RecordEvent) error {
		m.sync()
		return e.Next()
	})

	app.OnCollectionDeleteRequest().BindFunc(func(e *core.CollectionRequestEvent) error {
		if e.Collection.Name == Collection {
			return e.BadRequestError("The scheduled requests store is managed by the console and cannot be deleted.", nil)
		}
		return e.Next()
	})

	return m
}

func (m *Manager) bindRoutes(e *core.ServeEvent) {
	group := e.Router.Group("/api/_c/scheduled-requests/v1")
	group.Bind(apis.RequireSuperuserAuth())
	group.POST("/{id}/run", func(re *core.RequestEvent) error {
		result, err := m.Run(re.Request.PathValue("id"))
		if err != nil {
			return re.NotFoundError("Scheduled request not found.", err)
		}
		return re.JSON(http.StatusOK, result)
	})
}

func (m *Manager) ensureCollection() error {
	if _, err := m.app.FindCollectionByNameOrId(Collection); err != nil {
		if err := m.app.Save(newCollection()); err != nil {
			return err
		}
	}
	if _, err := m.app.FindCollectionByNameOrId(RunsCollection); err != nil {
		if err := m.app.Save(newRunsCollection()); err != nil {
			return err
		}
	}
	return nil
}

func newRunsCollection() *core.Collection {
	collection := core.NewBaseCollection(RunsCollection)
	collection.Fields.Add(
		&core.TextField{Name: "requestId", Required: true, Max: 40},
		&core.TextField{Name: "name", Max: 120},
		&core.NumberField{Name: "status", OnlyInt: true},
		&core.NumberField{Name: "duration", OnlyInt: true},
		&core.TextField{Name: "error", Max: 2000},
		&core.TextField{Name: "response", Max: 2000},
		&core.AutodateField{Name: "created", OnCreate: true},
	)
	return collection
}

func newCollection() *core.Collection {
	collection := core.NewBaseCollection(Collection)
	minTimeout, maxTimeout := 1.0, 300.0
	minZero, maxStatus := 0.0, 599.0
	collection.Fields.Add(
		&core.TextField{Name: "name", Required: true, Max: 120, Presentable: true},
		&core.TextField{Name: "schedule", Required: true, Max: 120},
		&core.SelectField{Name: "method", Required: true, MaxSelect: 1, Values: methods},
		&core.URLField{Name: "url", Required: true},
		&core.JSONField{Name: "headers", MaxSize: 64 * 1024},
		&core.TextField{Name: "body", Max: 64 * 1024},
		&core.NumberField{Name: "timeout", OnlyInt: true, Min: &minTimeout, Max: &maxTimeout},
		&core.BoolField{Name: "enabled"},
		&core.DateField{Name: "lastRun"},
		&core.NumberField{Name: "lastStatus", OnlyInt: true, Min: &minZero, Max: &maxStatus},
		&core.NumberField{Name: "lastDuration", OnlyInt: true, Min: &minZero},
		&core.TextField{Name: "lastError", Max: 2000},
		&core.TextField{Name: "lastResponse", Max: 4000},
		&core.NumberField{Name: "runCount", OnlyInt: true, Min: &minZero},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	return collection
}

func (m *Manager) sync() {
	records, err := m.app.FindAllRecords(Collection)
	if err != nil {
		m.app.Logger().Warn("scheduled requests: failed to load definitions", "error", err)
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for id := range m.jobs {
		m.app.Cron().Remove(id)
	}
	m.jobs = map[string]struct{}{}

	for _, record := range records {
		if !record.GetBool("enabled") {
			continue
		}
		id := record.Id
		jobID := jobPrefix + id
		if err := m.app.Cron().Add(jobID, record.GetString("schedule"), func() {
			m.runScheduled(id)
		}); err != nil {
			m.app.Logger().Warn("scheduled requests: failed to register job", "id", id, "error", err)
			continue
		}
		m.jobs[jobID] = struct{}{}
	}
}

func (m *Manager) runScheduled(id string) {
	record, err := m.app.FindRecordById(Collection, id)
	if err != nil || !record.GetBool("enabled") {
		return
	}
	m.execute(record)
}

// Result describes one executed request.
type Result struct {
	Status   int          `json:"status"`
	Duration int64        `json:"duration"`
	Response string       `json:"response"`
	Error    string       `json:"error"`
	Record   *core.Record `json:"record"`
}

// Run executes a scheduled request immediately and stores the result.
func (m *Manager) Run(id string) (*Result, error) {
	record, err := m.app.FindRecordById(Collection, id)
	if err != nil {
		return nil, err
	}
	return m.execute(record), nil
}

func (m *Manager) execute(record *core.Record) *Result {
	result := &Result{}
	started := time.Now()
	status := 0
	responseText := ""
	errorText := ""

	defer func() {
		result.Status = status
		result.Duration = time.Since(started).Milliseconds()
		result.Response = responseText
		result.Error = errorText

		record.Set("lastRun", types.NowDateTime())
		record.Set("lastStatus", status)
		record.Set("lastDuration", result.Duration)
		record.Set("lastResponse", responseText)
		record.Set("lastError", errorText)
		record.Set("runCount", record.GetInt("runCount")+1)
		if err := m.app.Save(record); err != nil {
			m.app.Logger().Warn("scheduled requests: failed to save run result", "id", record.Id, "error", err)
		}
		result.Record = record

		run := core.NewRecord(mustCollection(m.app, RunsCollection))
		run.Set("requestId", record.Id)
		run.Set("name", record.GetString("name"))
		run.Set("status", status)
		run.Set("duration", result.Duration)
		run.Set("error", errorText)
		run.Set("response", responseText)
		if err := m.app.Save(run); err != nil {
			m.app.Logger().Warn("scheduled requests: failed to save run history", "id", record.Id, "error", err)
		}
	}()

	method := strings.ToUpper(record.GetString("method"))
	if !validMethod(method) {
		errorText = "Unsupported HTTP method."
		return result
	}

	target := record.GetString("url")
	body := record.GetString("body")
	if method == http.MethodGet || method == http.MethodHead {
		body = ""
	}

	request, err := http.NewRequest(method, target, strings.NewReader(body))
	if err != nil {
		errorText = err.Error()
		return result
	}

	var headers map[string]string
	if raw := record.GetString("headers"); raw != "" && raw != "null" {
		if err := json.Unmarshal([]byte(raw), &headers); err != nil {
			errorText = "Headers must be a JSON object of string values."
			return result
		}
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	if request.Header.Get("User-Agent") == "" {
		request.Header.Set("User-Agent", "Ekilie Box scheduled request")
	}

	timeout := record.GetInt("timeout")
	if timeout <= 0 {
		timeout = 30
	} else if timeout > 300 {
		timeout = 300
	}

	client := &http.Client{Timeout: time.Duration(timeout) * time.Second}
	response, err := client.Do(request)
	if err != nil {
		errorText = err.Error()
		return result
	}
	defer response.Body.Close()

	status = response.StatusCode
	raw, readErr := io.ReadAll(io.LimitReader(response.Body, 2000))
	responseText = string(raw)
	if readErr != nil {
		errorText = readErr.Error()
	}

	return result
}

func mustCollection(app core.App, name string) *core.Collection {
	collection, err := app.FindCollectionByNameOrId(name)
	if err != nil {
		return core.NewBaseCollection(name)
	}
	return collection
}

func validMethod(method string) bool {
	for _, item := range methods {
		if item == method {
			return true
		}
	}
	return false
}

func validate(record *core.Record) error {
	errs := validation.Errors{}

	if _, err := cron.NewSchedule(record.GetString("schedule")); err != nil {
		errs["schedule"] = validation.NewError("validation_invalid_cron", "Invalid cron expression: "+err.Error())
	}

	target := record.GetString("url")
	parsed, err := url.ParseRequestURI(target)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		errs["url"] = validation.NewError("validation_invalid_url", "Must be an absolute http or https URL.")
	}

	method := strings.ToUpper(record.GetString("method"))
	if !validMethod(method) {
		errs["method"] = validation.NewError("validation_invalid_method", "Must be GET, POST, PUT, PATCH, DELETE or HEAD.")
	}

	if timeout := record.GetInt("timeout"); timeout < 0 || timeout > 300 {
		errs["timeout"] = validation.NewError("validation_invalid_timeout", "Must be between 0 and 300 seconds.")
	}

	if raw := record.GetString("headers"); raw != "" && raw != "null" {
		var headers map[string]string
		if err := json.Unmarshal([]byte(raw), &headers); err != nil {
			errs["headers"] = validation.NewError("validation_invalid_headers", "Must be a JSON object of string values.")
		}
	}

	if len(errs) == 0 {
		return nil
	}
	return errs
}

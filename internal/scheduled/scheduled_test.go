package scheduled

import (
	"strings"
	"testing"

	"ganigeorgiev.com/pocketbase/pocketbase/core"
)

func testRecord() *core.Record {
	record := core.NewRecord(newCollection())
	record.Set("name", "Test")
	record.Set("schedule", "0 3 * * *")
	record.Set("method", "POST")
	record.Set("url", "https://example.com/hook")
	record.Set("headers", `{"Authorization":"Bearer test"}`)
	record.Set("timeout", 30)
	record.Set("enabled", true)
	return record
}

func TestValidateAcceptsValidDefinition(t *testing.T) {
	if err := validate(testRecord()); err != nil {
		t.Fatalf("expected valid definition, got %v", err)
	}
}

func TestValidateRejectsBadDefinitions(t *testing.T) {
	tests := []struct {
		name   string
		change func(*core.Record)
		want   string
	}{
		{"cron", func(r *core.Record) { r.Set("schedule", "not a cron") }, "schedule"},
		{"url scheme", func(r *core.Record) { r.Set("url", "ftp://example.com/file") }, "url"},
		{"url relative", func(r *core.Record) { r.Set("url", "/relative") }, "url"},
		{"method", func(r *core.Record) { r.Set("method", "TRACE") }, "method"},
		{"timeout", func(r *core.Record) { r.Set("timeout", 301) }, "timeout"},
		{"headers", func(r *core.Record) { r.Set("headers", `{"X":1}`) }, "headers"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			record := testRecord()
			test.change(record)
			err := validate(record)
			if err == nil {
				t.Fatal("expected a validation error")
			}
			if !strings.Contains(err.Error(), test.want) {
				t.Fatalf("expected %q in error, got %v", test.want, err)
			}
		})
	}
}

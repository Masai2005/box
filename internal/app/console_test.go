package app

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ganigeorgiev.com/pocketbase/pocketbase/core"
	"ganigeorgiev.com/pocketbase/pocketbase/tools/router"
)

func serveConsoleRequest(t *testing.T, path string, embedded bool) (*httptest.ResponseRecorder, bool, error) {
	t.Helper()
	rec := httptest.NewRecorder()
	re := &core.RequestEvent{Event: router.Event{
		Response: rec,
		Request:  httptest.NewRequest(http.MethodGet, path, nil),
	}}
	called := false
	err := consoleHandler(func(*core.RequestEvent) error {
		called = true
		return nil
	}, embedded)(re)
	return rec, called, err
}

func TestConsoleHandlerSetsCSPForEmbeddedConsole(t *testing.T) {
	for _, path := range []string{"/", "/collections", "/assets/index.js"} {
		rec, called, err := serveConsoleRequest(t, path, true)
		if err != nil || !called {
			t.Fatalf("%s: expected static handler to run, err=%v called=%v", path, err, called)
		}
		csp := rec.Header().Get("Content-Security-Policy")
		for _, want := range []string{"script-src 'self'", "frame-ancestors 'none'", "object-src 'none'"} {
			if !strings.Contains(csp, want) {
				t.Fatalf("%s: CSP %q missing %q", path, csp, want)
			}
		}
		for _, directive := range strings.Split(csp, ";") {
			if strings.HasPrefix(strings.TrimSpace(directive), "script-src") && strings.Contains(directive, "unsafe") {
				t.Fatalf("%s: script-src must not allow unsafe sources: %q", path, directive)
			}
		}
	}
}

func TestConsoleHandlerLeavesPublicDirAlone(t *testing.T) {
	rec, called, err := serveConsoleRequest(t, "/", false)
	if err != nil || !called {
		t.Fatalf("expected static handler to run, err=%v called=%v", err, called)
	}
	if csp := rec.Header().Get("Content-Security-Policy"); csp != "" {
		t.Fatalf("publicDir responses must not get the console CSP, got %q", csp)
	}
}

func TestConsoleHandlerRejectsAPIAndDashboardPaths(t *testing.T) {
	for _, path := range []string{"/api/unknown", "/_/"} {
		rec, called, err := serveConsoleRequest(t, path, true)
		if err == nil || called {
			t.Fatalf("%s: expected not found without serving the SPA, err=%v called=%v", path, err, called)
		}
		if csp := rec.Header().Get("Content-Security-Policy"); csp != "" {
			t.Fatalf("%s: API paths must not get the console CSP, got %q", path, csp)
		}
	}
}

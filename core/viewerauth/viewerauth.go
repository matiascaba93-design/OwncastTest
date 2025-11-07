package viewerauth

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/owncast/owncast/persistence/configrepository"
	"github.com/owncast/owncast/utils"
)

const (
	// CookieName is the name of the cookie that stores the viewer session token.
	CookieName = "oc_viewer_auth"

	sessionDuration = 12 * time.Hour
)

var (
	sessions   = make(map[string]time.Time)
	sessionsMu sync.RWMutex
)

var (
	// ErrPasswordNotConfigured indicates no viewer password has been configured.
	ErrPasswordNotConfigured = errors.New("viewer password not configured")
	// ErrInvalidPassword indicates the provided password is incorrect.
	ErrInvalidPassword = errors.New("invalid viewer password")
)

// IsEnabled returns true if a viewer access password has been configured.
func IsEnabled() bool {
	configRepository := configrepository.Get()
	return configRepository.GetViewerAccessPassword() != ""
}

// Authenticate validates a provided password and returns a new session token.
func Authenticate(password string) (string, time.Time, error) {
	configRepository := configrepository.Get()
	storedHash := configRepository.GetViewerAccessPassword()
	if storedHash == "" {
		return "", time.Time{}, ErrPasswordNotConfigured
	}

	if err := utils.CompareHash(storedHash, password); err != nil {
		return "", time.Time{}, ErrInvalidPassword
	}

	return createSession()
}

// HasValidSession returns true if the request carries a valid viewer auth session.
func HasValidSession(r *http.Request) bool {
	if !IsEnabled() {
		return true
	}

	token := getTokenFromRequest(r)
	if token == "" {
		return false
	}

	return validateToken(token)
}

// RequireValidSessionOrJSON writes a JSON error and returns false if authentication fails.
func RequireValidSessionOrJSON(w http.ResponseWriter, r *http.Request) bool {
	if HasValidSession(r) {
		return true
	}

	writeUnauthorizedJSON(w)
	return false
}

// RequireValidSessionOrStatus writes the provided status code if authentication fails.
func RequireValidSessionOrStatus(w http.ResponseWriter, r *http.Request, status int) bool {
	if HasValidSession(r) {
		return true
	}

	w.WriteHeader(status)
	return false
}

// SetSessionCookie writes the session cookie to the response.
func SetSessionCookie(w http.ResponseWriter, r *http.Request, token string, expires time.Time) {
	cookie := &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(time.Until(expires).Seconds()),
		Secure:   isSecureRequest(r),
	}
	http.SetCookie(w, cookie)
}

// ClearSessionCookie removes the viewer auth cookie and invalidates the token if present.
func ClearSessionCookie(w http.ResponseWriter, r *http.Request) {
	token := getTokenFromRequest(r)
	if token != "" {
		invalidateToken(token)
	}

	cookie := &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(r),
	}
	http.SetCookie(w, cookie)
}

// InvalidateAllSessions clears all active viewer sessions.
func InvalidateAllSessions() {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	sessions = make(map[string]time.Time)
}

func writeUnauthorizedJSON(w http.ResponseWriter) {
	type response struct {
		Error string `json:"error"`
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(response{Error: "viewer_auth_required"})
}

func getTokenFromRequest(r *http.Request) string {
	cookie, err := r.Cookie(CookieName)
	if err == nil && cookie.Value != "" {
		return cookie.Value
	}

	// Fallback to Authorization Bearer token if provided (useful for programmatic access).
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[len("bearer "):])
	}

	return ""
}

func validateToken(token string) bool {
	sessionsMu.RLock()
	expires, ok := sessions[token]
	sessionsMu.RUnlock()
	if !ok {
		return false
	}

	if time.Now().After(expires) {
		sessionsMu.Lock()
		delete(sessions, token)
		sessionsMu.Unlock()
		return false
	}

	return true
}

func invalidateToken(token string) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	delete(sessions, token)
}

func createSession() (string, time.Time, error) {
	token, err := utils.GenerateRandomString(48)
	if err != nil {
		return "", time.Time{}, err
	}
	expires := time.Now().Add(sessionDuration)

	sessionsMu.Lock()
	sessions[token] = expires
	sessionsMu.Unlock()

	return token, expires, nil
}

func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}

	proto := r.Header.Get("X-Forwarded-Proto")
	return strings.EqualFold(proto, "https")
}

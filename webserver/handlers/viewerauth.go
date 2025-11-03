package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/owncast/owncast/core/viewerauth"
	webutils "github.com/owncast/owncast/webserver/utils"
)

type viewerAuthRequest struct {
	Password string `json:"password"`
}

type viewerAuthResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// ViewerAuthenticate handles viewer password authentication and issues a session cookie.
func ViewerAuthenticate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	decoder := json.NewDecoder(r.Body)
	var request viewerAuthRequest
	if err := decoder.Decode(&request); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(viewerAuthResponse{Success: false, Message: "invalid payload"})
		return
	}

	password := strings.TrimSpace(request.Password)
	token, expires, err := viewerauth.Authenticate(password)
	if err != nil {
		switch {
		case errors.Is(err, viewerauth.ErrPasswordNotConfigured):
			w.WriteHeader(http.StatusNotFound)
		case errors.Is(err, viewerauth.ErrInvalidPassword):
			w.WriteHeader(http.StatusUnauthorized)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
		_ = json.NewEncoder(w).Encode(viewerAuthResponse{Success: false, Message: err.Error()})
		return
	}

	viewerauth.SetSessionCookie(w, r, token, expires)
	_ = json.NewEncoder(w).Encode(viewerAuthResponse{Success: true})
}

// ViewerLogout clears the viewer auth session cookie.
func ViewerLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	viewerauth.ClearSessionCookie(w, r)
	_ = json.NewEncoder(w).Encode(viewerAuthResponse{Success: true})
}

// ViewerAuthStatus returns whether the current request is authenticated.
func ViewerAuthStatus(w http.ResponseWriter, r *http.Request) {
	authenticated := viewerauth.HasValidSession(r)
	type statusResponse struct {
		Enabled       bool `json:"enabled"`
		Authenticated bool `json:"authenticated"`
	}

	response := statusResponse{
		Enabled:       viewerauth.IsEnabled(),
		Authenticated: authenticated,
	}

	webutils.WriteResponse(w, response)
}

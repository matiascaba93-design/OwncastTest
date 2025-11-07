package admin

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/owncast/owncast/config"
	"github.com/owncast/owncast/utils"
	"github.com/owncast/owncast/webserver/router/middleware"
	webutils "github.com/owncast/owncast/webserver/utils"
	log "github.com/sirupsen/logrus"
)

type recordingInfo struct {
	Name      string    `json:"name"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"createdAt"`
}

// ListRecordings returns all saved recordings.
func ListRecordings(w http.ResponseWriter, r *http.Request) {
	recordings, err := os.ReadDir(config.RecordingsStoragePath)
	if err != nil {
		log.Errorln("unable to list recordings", err)
		webutils.InternalErrorHandler(w, err)
		return
	}

	response := make([]recordingInfo, 0)
	for _, entry := range recordings {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			log.Warnln("unable to stat recording", entry.Name(), err)
			continue
		}

		response = append(response, recordingInfo{
			Name:      entry.Name(),
			Size:      info.Size(),
			CreatedAt: info.ModTime(),
		})
	}

	sort.Slice(response, func(i, j int) bool {
		return response[i].CreatedAt.After(response[j].CreatedAt)
	})

	w.Header().Set("Content-Type", "application/json")
	middleware.DisableCache(w)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Errorln(err)
	}
}

// DownloadRecording streams the requested recording to the client.
func DownloadRecording(w http.ResponseWriter, r *http.Request) {
	filename := sanitizeRecordingFilename(chi.URLParam(r, "filename"))
	if filename == "" {
		webutils.WriteSimpleResponse(w, false, "invalid recording name")
		return
	}

	path := filepath.Join(config.RecordingsStoragePath, filename)
	if !utils.DoesFileExists(path) {
		webutils.WriteSimpleResponse(w, false, "recording not found")
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")
	http.ServeFile(w, r, path)
}

// DeleteRecording removes the requested recording from disk.
func DeleteRecording(w http.ResponseWriter, r *http.Request) {
	filename := sanitizeRecordingFilename(chi.URLParam(r, "filename"))
	if filename == "" {
		webutils.WriteSimpleResponse(w, false, "invalid recording name")
		return
	}

	path := filepath.Join(config.RecordingsStoragePath, filename)
	if err := os.Remove(path); err != nil {
		webutils.WriteSimpleResponse(w, false, err.Error())
		return
	}

	webutils.WriteSimpleResponse(w, true, "deleted")
}

func sanitizeRecordingFilename(name string) string {
	if name == "" {
		return ""
	}

	clean := filepath.Base(name)
	if clean != name {
		return ""
	}

	return clean
}

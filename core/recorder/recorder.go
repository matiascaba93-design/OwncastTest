package recorder

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/owncast/owncast/config"
	"github.com/owncast/owncast/persistence/configrepository"
	"github.com/owncast/owncast/utils"
	log "github.com/sirupsen/logrus"
)

type session struct {
	variantIndex int
	startedAt    time.Time
}

var (
	activeSession *session
	mu            sync.Mutex
)

// Start initializes a new recording session for the given highest-quality variant index.
func Start(variantIndex int) {
	configRepository := configrepository.Get()
	if !configRepository.GetRecordingEnabled() {
		return
	}

	if err := os.MkdirAll(config.RecordingsStoragePath, 0o755); err != nil {
		log.Errorln("unable to create recordings directory", err)
		return
	}

	mu.Lock()
	defer mu.Unlock()

	activeSession = &session{
		variantIndex: variantIndex,
		startedAt:    time.Now(),
	}
}

// Stop finalizes the active recording session, if one exists.
func Stop() {
	mu.Lock()
	currentSession := activeSession
	activeSession = nil
	mu.Unlock()

	if currentSession == nil {
		return
	}

	finalizeRecording(currentSession)
}

func finalizeRecording(s *session) {
	playlistPath := filepath.Join(config.HLSStoragePath, fmt.Sprintf("%d/stream.m3u8", s.variantIndex))
	if !utils.DoesFileExists(playlistPath) {
		log.Warnln("recording playlist not found", playlistPath)
		return
	}

	timestamp := s.startedAt.Format("20060102-150405")
	outputFilename := fmt.Sprintf("recording-%s.mp4", timestamp)
	outputPath := filepath.Join(config.RecordingsStoragePath, outputFilename)

	ffmpegPath := utils.ValidatedFfmpegPath(configrepository.Get().GetFfMpegPath())

	cmd := exec.Command(ffmpegPath, //nolint:gosec
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-i", playlistPath,
		"-c", "copy",
		outputPath,
	)

	if err := cmd.Run(); err != nil {
		log.Errorln("recording finalize failed", err)
		return
	}

	log.Infof("Saved recording to %s", outputPath)
}

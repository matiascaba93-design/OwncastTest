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

const (
	playlistWaitTimeout   = 10 * time.Second
	playlistRetryInterval = 500 * time.Millisecond
	minRecordingSizeBytes = 512 * 1024 // 512 KiB
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
	if !waitForPlaylist(playlistPath) {
		log.Warnln("recording playlist not found", playlistPath)
		return
	}

	timestamp := s.startedAt.Format("20060102-150405")
	outputFilename := fmt.Sprintf("recording-%s.mp4", timestamp)
	finalOutputPath := filepath.Join(config.RecordingsStoragePath, outputFilename)
	tmpOutputPath := finalOutputPath + ".tmp"

	ffmpegPath := utils.ValidatedFfmpegPath(configrepository.Get().GetFfMpegPath())

	_ = os.Remove(tmpOutputPath)
	if err := runFFmpegCopy(ffmpegPath, playlistPath, tmpOutputPath); err != nil {
		log.Warnln("recording finalize failed, attempting recovery", err)
		_ = os.Remove(tmpOutputPath)
		if err := runFFmpegRecover(ffmpegPath, playlistPath, tmpOutputPath); err != nil {
			_ = os.Remove(tmpOutputPath)
			log.Errorln("recording finalize failed after recovery attempt", err)
			return
		}
	}

	if err := os.Rename(tmpOutputPath, finalOutputPath); err != nil {
		_ = os.Remove(tmpOutputPath)
		log.Errorln("unable to finalize recording file", err)
		return
	}

	info, err := os.Stat(finalOutputPath)
	if err != nil {
		log.Errorln("unable to stat finalized recording", err)
		return
	}

	if info.Size() < minRecordingSizeBytes {
		log.Warnf("Saved recording to %s but the file is smaller than expected (%d bytes); the upstream stream may have ended abruptly", finalOutputPath, info.Size())
		return
	}

	log.Infof("Saved recording to %s", finalOutputPath)
}

func waitForPlaylist(path string) bool {
	deadline := time.Now().Add(playlistWaitTimeout)
	for time.Now().Before(deadline) {
		if utils.DoesFileExists(path) {
			return true
		}
		time.Sleep(playlistRetryInterval)
	}

	return utils.DoesFileExists(path)
}

func runFFmpegCopy(ffmpegPath, playlistPath, outputPath string) error {
	args := []string{
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-i", playlistPath,
		"-c", "copy",
		outputPath,
	}

	return runFFmpeg(ffmpegPath, args)
}

func runFFmpegRecover(ffmpegPath, playlistPath, outputPath string) error {
	args := []string{
		"-hide_banner",
		"-loglevel", "warning",
		"-y",
		"-fflags", "+genpts",
		"-i", playlistPath,
		"-c:v", "copy",
		"-c:a", "copy",
		"-copyts",
		"-avoid_negative_ts", "make_zero",
		outputPath,
	}

	return runFFmpeg(ffmpegPath, args)
}

func runFFmpeg(ffmpegPath string, args []string) error {
	cmd := exec.Command(ffmpegPath, args...) //nolint:gosec
	return cmd.Run()
}

package filestore

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	MaxUploadBytes      = 12 << 20 // 12 MiB raw upload
	MaxImages           = 8
	OriginalMaxEdge     = 4500 // garde-fou anti-abus, sans compression visible
	ThumbMaxEdge        = 480
	OriginalJPEGQuality = 95
	ThumbJPEGQuality    = 72
)

type EncodedImage struct {
	ID           string
	OriginalName string
	ContentType  string
	FullJPEG     []byte
	ThumbJPEG    []byte
}

type StoredImage struct {
	ID           string
	OriginalName string
	ContentType  string
	FullRelPath  string
	ThumbRelPath string
}

type Store struct {
	Root string
}

func New(root string) (*Store, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return nil, fmt.Errorf("FILES_ROOT vide")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o775); err != nil {
		return nil, err
	}
	return &Store{Root: abs}, nil
}

func (s *Store) bookingDir(bookingID string) string {
	return filepath.Join(s.Root, sanitizeID(bookingID))
}

func sanitizeID(id string) string {
	id = strings.TrimSpace(id)
	id = strings.ReplaceAll(id, "..", "")
	id = strings.ReplaceAll(id, "/", "")
	id = strings.ReplaceAll(id, "\\", "")
	return id
}

// EncodeJPEGVariants compresse en mémoire sans écrire sur disque
// (utilisé avant paiement).
func EncodeJPEGVariants(imageID, originalName string, raw []byte) (*EncodedImage, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("fichier vide")
	}
	if len(raw) > MaxUploadBytes {
		return nil, fmt.Errorf("fichier trop volumineux (max 12 Mo)")
	}
	imageID = sanitizeID(imageID)
	if imageID == "" {
		return nil, fmt.Errorf("identifiants invalides")
	}

	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("image invalide (JPEG, PNG ou WebP uniquement)")
	}

	fullJPEG, err := encodeJPEGBytes(resizeMax(src, OriginalMaxEdge), OriginalJPEGQuality)
	if err != nil {
		return nil, err
	}
	thumbJPEG, err := encodeJPEGBytes(resizeMax(src, ThumbMaxEdge), ThumbJPEGQuality)
	if err != nil {
		return nil, err
	}

	return &EncodedImage{
		ID:           imageID,
		OriginalName: filepath.Base(strings.TrimSpace(originalName)),
		ContentType:  "image/jpeg",
		FullJPEG:     fullJPEG,
		ThumbJPEG:    thumbJPEG,
	}, nil
}

// PersistJPEGBytes écrit la version finale sur disque (après paiement uniquement).
func (s *Store) PersistJPEGBytes(bookingID, imageID string, fullJPEG, thumbJPEG []byte) (*StoredImage, error) {
	bookingID = sanitizeID(bookingID)
	imageID = sanitizeID(imageID)
	if bookingID == "" || imageID == "" {
		return nil, fmt.Errorf("identifiants invalides")
	}
	if len(fullJPEG) == 0 || len(thumbJPEG) == 0 {
		return nil, fmt.Errorf("données image manquantes")
	}

	dir := s.bookingDir(bookingID)
	if err := os.MkdirAll(dir, 0o775); err != nil {
		return nil, err
	}

	fullName := imageID + ".jpg"
	thumbName := imageID + "_thumb.jpg"
	fullPath := filepath.Join(dir, fullName)
	thumbPath := filepath.Join(dir, thumbName)

	if err := os.WriteFile(fullPath, fullJPEG, 0o644); err != nil {
		return nil, err
	}
	if err := os.WriteFile(thumbPath, thumbJPEG, 0o644); err != nil {
		_ = os.Remove(fullPath)
		return nil, err
	}

	return &StoredImage{
		ID:           imageID,
		ContentType:  "image/jpeg",
		FullRelPath:  filepath.ToSlash(filepath.Join(bookingID, fullName)),
		ThumbRelPath: filepath.ToSlash(filepath.Join(bookingID, thumbName)),
	}, nil
}

func (s *Store) Open(relPath string) (*os.File, error) {
	full, err := s.resolve(relPath)
	if err != nil {
		return nil, err
	}
	return os.Open(full)
}

func (s *Store) ReadFile(relPath string) ([]byte, error) {
	full, err := s.resolve(relPath)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(full)
}

func (s *Store) RemoveImage(bookingID, imageID string) error {
	bookingID = sanitizeID(bookingID)
	imageID = sanitizeID(imageID)
	dir := s.bookingDir(bookingID)
	err1 := os.Remove(filepath.Join(dir, imageID+".jpg"))
	err2 := os.Remove(filepath.Join(dir, imageID+"_thumb.jpg"))
	if err1 != nil && !os.IsNotExist(err1) {
		return err1
	}
	if err2 != nil && !os.IsNotExist(err2) {
		return err2
	}
	// nettoie le dossier booking s'il est vide
	if entries, err := os.ReadDir(dir); err == nil && len(entries) == 0 {
		_ = os.Remove(dir)
	}
	return nil
}

func (s *Store) RemoveBooking(bookingID string) error {
	dir := s.bookingDir(bookingID)
	if err := os.RemoveAll(dir); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *Store) resolve(relPath string) (string, error) {
	relPath = filepath.Clean("/" + strings.TrimSpace(relPath))
	relPath = strings.TrimPrefix(relPath, "/")
	if relPath == "" || strings.Contains(relPath, "..") {
		return "", fmt.Errorf("chemin invalide")
	}
	full := filepath.Join(s.Root, relPath)
	rel, err := filepath.Rel(s.Root, full)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("chemin invalide")
	}
	return full, nil
}

func encodeJPEGBytes(img image.Image, quality int) ([]byte, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func resizeMax(src image.Image, maxEdge int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= 0 || h <= 0 {
		return src
	}
	if w <= maxEdge && h <= maxEdge {
		return src
	}
	scale := float64(maxEdge) / float64(w)
	if h > w {
		scale = float64(maxEdge) / float64(h)
	}
	nw := int(float64(w) * scale)
	nh := int(float64(h) * scale)
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}

// Ensure png decoder registered (jpeg/webp already via imports).
var _ = png.Decode

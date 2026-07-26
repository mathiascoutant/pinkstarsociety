package handlers

import (
	"context"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"pinkstarsociety/internal/filestore"
	"pinkstarsociety/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func inspirationImagePublicJSON(token string, img models.InspirationImage) gin.H {
	base := "/api/public/bookings/" + token + "/inspiration-images/" + img.ID
	return gin.H{
		"id":           img.ID,
		"originalName": img.OriginalName,
		"contentType":  img.ContentType,
		"createdAt":    img.CreatedAt,
		"thumbUrl":     base + "?variant=thumb",
		"fullUrl":      base + "?variant=full",
	}
}

func inspirationImagesPublicJSON(token string, images []models.InspirationImage) []gin.H {
	out := make([]gin.H, 0, len(images))
	for _, img := range images {
		out = append(out, inspirationImagePublicJSON(token, img))
	}
	return out
}

func findInspiration(b models.Booking, imageID string) (models.InspirationImage, bool) {
	for _, img := range b.InspirationImages {
		if img.ID == imageID {
			return img, true
		}
	}
	return models.InspirationImage{}, false
}

// pullUnpaidInspirationOffDisk : si une résa non payée a encore des fichiers
// sur disque (ancien comportement), les ramène en Mongo et supprime le dossier.
func (h *Handlers) pullUnpaidInspirationOffDisk(ctx context.Context, b *models.Booking) {
	if h.Files == nil || b.PaymentStatus != "pending" || len(b.InspirationImages) == 0 {
		return
	}
	changed := false
	for i := range b.InspirationImages {
		img := &b.InspirationImages[i]
		if img.FullPath == "" && img.ThumbPath == "" {
			continue
		}
		if len(img.FullData) == 0 && img.FullPath != "" {
			if raw, err := h.Files.ReadFile(img.FullPath); err == nil {
				img.FullData = raw
			}
		}
		if len(img.ThumbData) == 0 && img.ThumbPath != "" {
			if raw, err := h.Files.ReadFile(img.ThumbPath); err == nil {
				img.ThumbData = raw
			}
		}
		_ = h.Files.RemoveImage(b.ID.Hex(), img.ID)
		img.FullPath = ""
		img.ThumbPath = ""
		changed = true
	}
	if !changed {
		return
	}
	_ = h.Files.RemoveBooking(b.ID.Hex())
	_, err := h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{
		"$set": bson.M{
			"inspiration_images": b.InspirationImages,
			"updated_at":         time.Now().UTC(),
		},
	})
	if err != nil {
		log.Println("inspiration migrate off-disk:", err)
	}
}

// persistInspirationImagesToDisk écrit les images sur FILES_ROOT après paiement
// et vide les binaires Mongo.
func (h *Handlers) persistInspirationImagesToDisk(ctx context.Context, b *models.Booking) {
	if h.Files == nil || len(b.InspirationImages) == 0 {
		return
	}
	changed := false
	for i := range b.InspirationImages {
		img := &b.InspirationImages[i]
		if img.FullPath != "" && img.ThumbPath != "" && len(img.FullData) == 0 {
			continue // déjà sur disque
		}
		if len(img.FullData) == 0 || len(img.ThumbData) == 0 {
			continue
		}
		stored, err := h.Files.PersistJPEGBytes(b.ID.Hex(), img.ID, img.FullData, img.ThumbData)
		if err != nil {
			log.Printf("inspiration persist booking=%s image=%s: %v", b.ID.Hex(), img.ID, err)
			continue
		}
		img.FullPath = stored.FullRelPath
		img.ThumbPath = stored.ThumbRelPath
		img.FullData = nil
		img.ThumbData = nil
		changed = true
	}
	if !changed {
		return
	}
	_, err := h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{
		"$set": bson.M{
			"inspiration_images": b.InspirationImages,
			"updated_at":         time.Now().UTC(),
		},
	})
	if err != nil {
		log.Println("inspiration persist mongo:", err)
	}
}

// UploadPublicInspirationImages — POST multipart field "files" (1..n)
// Avant paiement : stockage Mongo uniquement (pas de fichier dans FILES_ROOT).
func (h *Handlers) UploadPublicInspirationImages(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	if !b.InspirationRequired {
		c.JSON(http.StatusBadRequest, gin.H{"error": "images d'inspiration non demandées pour cette réservation"})
		return
	}
	if b.PaymentStatus != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "les images ne peuvent plus être modifiées après paiement"})
		return
	}
	h.pullUnpaidInspirationOffDisk(ctx, &b)

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "formulaire invalide"})
		return
	}
	files := form.File["files"]
	if len(files) == 0 {
		files = form.File["file"]
	}
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "aucune image fournie"})
		return
	}

	existing := len(b.InspirationImages)
	if existing+len(files) > filestore.MaxImages {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum 8 images d'inspiration"})
		return
	}

	added := make([]models.InspirationImage, 0, len(files))
	for _, fh := range files {
		if fh.Size > filestore.MaxUploadBytes {
			c.JSON(http.StatusBadRequest, gin.H{"error": "fichier trop volumineux (max 12 Mo)"})
			return
		}
		src, err := fh.Open()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "lecture fichier impossible"})
			return
		}
		raw, err := io.ReadAll(io.LimitReader(src, filestore.MaxUploadBytes+1))
		_ = src.Close()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "lecture fichier impossible"})
			return
		}
		if len(raw) > filestore.MaxUploadBytes {
			c.JSON(http.StatusBadRequest, gin.H{"error": "fichier trop volumineux (max 12 Mo)"})
			return
		}

		imageID := strings.ReplaceAll(uuid.NewString(), "-", "")
		encoded, err := filestore.EncodeJPEGVariants(imageID, fh.Filename, raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		added = append(added, models.InspirationImage{
			ID:           encoded.ID,
			OriginalName: encoded.OriginalName,
			ContentType:  encoded.ContentType,
			FullData:     encoded.FullJPEG,
			ThumbData:    encoded.ThumbJPEG,
			CreatedAt:    time.Now().UTC(),
		})
	}

	newList := append(append([]models.InspirationImage{}, b.InspirationImages...), added...)
	_, err = h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{
		"$set": bson.M{
			"inspiration_images": newList,
			"updated_at":         time.Now().UTC(),
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "enregistrement impossible"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"images": inspirationImagesPublicJSON(token, newList),
		"count":  len(newList),
	})
}

// DeletePublicInspirationImage — DELETE /public/bookings/:token/inspiration-images/:imageId
func (h *Handlers) DeletePublicInspirationImage(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	imageID := strings.TrimSpace(c.Param("imageId"))
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "réservation introuvable"})
		return
	}
	if b.PaymentStatus != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "les images ne peuvent plus être modifiées après paiement"})
		return
	}
	img, ok := findInspiration(b, imageID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "image introuvable"})
		return
	}

	next := make([]models.InspirationImage, 0, len(b.InspirationImages))
	for _, x := range b.InspirationImages {
		if x.ID != imageID {
			next = append(next, x)
		}
	}
	_, err := h.DB.Collection("bookings").UpdateOne(ctx, bson.M{"_id": b.ID}, bson.M{
		"$set": bson.M{
			"inspiration_images": next,
			"updated_at":         time.Now().UTC(),
		},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "suppression impossible"})
		return
	}
	// Nettoyage disque au cas où un ancien upload y était encore
	if h.Files != nil {
		_ = h.Files.RemoveImage(b.ID.Hex(), img.ID)
	}
	c.JSON(http.StatusOK, gin.H{
		"ok":     true,
		"images": inspirationImagesPublicJSON(token, next),
		"count":  len(next),
	})
}

func (h *Handlers) writeInspirationVariant(c *gin.Context, b models.Booking, img models.InspirationImage, variant string) {
	if variant == "thumb" {
		if img.ThumbPath != "" && h.Files != nil {
			if f, err := h.Files.Open(img.ThumbPath); err == nil {
				defer f.Close()
				c.Header("Cache-Control", "private, max-age=3600")
				c.Header("Content-Type", "image/jpeg")
				http.ServeContent(c.Writer, c.Request, img.ThumbPath, img.CreatedAt, f)
				return
			}
		}
		if len(img.ThumbData) > 0 {
			c.Header("Cache-Control", "private, max-age=3600")
			c.Data(http.StatusOK, "image/jpeg", img.ThumbData)
			return
		}
	} else {
		if img.FullPath != "" && h.Files != nil {
			if f, err := h.Files.Open(img.FullPath); err == nil {
				defer f.Close()
				c.Header("Cache-Control", "private, max-age=3600")
				c.Header("Content-Type", "image/jpeg")
				http.ServeContent(c.Writer, c.Request, img.FullPath, img.CreatedAt, f)
				return
			}
		}
		if len(img.FullData) > 0 {
			c.Header("Cache-Control", "private, max-age=3600")
			c.Data(http.StatusOK, "image/jpeg", img.FullData)
			return
		}
	}
	c.Status(http.StatusNotFound)
}

// GetPublicInspirationImage — GET ?variant=thumb|full (défaut full)
func (h *Handlers) GetPublicInspirationImage(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	imageID := strings.TrimSpace(c.Param("imageId"))
	variant := strings.ToLower(strings.TrimSpace(c.DefaultQuery("variant", "full")))
	if variant != "thumb" && variant != "full" {
		variant = "full"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"public_token": token}).Decode(&b); err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	if b.PaymentStatus == "pending" {
		h.pullUnpaidInspirationOffDisk(ctx, &b)
	}
	img, ok := findInspiration(b, imageID)
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	h.writeInspirationVariant(c, b, img, variant)
}

// GetAdminInspirationImage — même chose via id booking + auth admin
func (h *Handlers) GetAdminInspirationImage(c *gin.Context) {
	idHex := strings.TrimSpace(c.Param("id"))
	imageID := strings.TrimSpace(c.Param("imageId"))
	oid, err := primitive.ObjectIDFromHex(idHex)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	variant := strings.ToLower(strings.TrimSpace(c.DefaultQuery("variant", "full")))
	if variant != "thumb" && variant != "full" {
		variant = "full"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	var b models.Booking
	if err := h.DB.Collection("bookings").FindOne(ctx, bson.M{"_id": oid}).Decode(&b); err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	if b.PaymentStatus == "pending" {
		h.pullUnpaidInspirationOffDisk(ctx, &b)
	}
	img, ok := findInspiration(b, imageID)
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	h.writeInspirationVariant(c, b, img, variant)
}

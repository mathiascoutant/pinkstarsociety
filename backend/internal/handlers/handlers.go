package handlers

import (
	"log"

	"pinkstarsociety/internal/config"
	"pinkstarsociety/internal/filestore"

	"go.mongodb.org/mongo-driver/mongo"
)

type Handlers struct {
	DB     *mongo.Database
	Config *config.Config
	Files  *filestore.Store
}

func New(db *mongo.Database, cfg *config.Config) *Handlers {
	h := &Handlers{DB: db, Config: cfg}
	store, err := filestore.New(cfg.FilesRoot)
	if err != nil {
		log.Printf("filestore: %v (uploads d'inspiration désactivés)", err)
	} else {
		h.Files = store
		log.Printf("filestore prêt: %s", store.Root)
	}
	return h
}

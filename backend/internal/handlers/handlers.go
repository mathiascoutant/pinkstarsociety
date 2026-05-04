package handlers

import (
	"pinkstarsociety/internal/config"

	"go.mongodb.org/mongo-driver/mongo"
)

type Handlers struct {
	DB     *mongo.Database
	Config *config.Config
}

func New(db *mongo.Database, cfg *config.Config) *Handlers {
	return &Handlers{DB: db, Config: cfg}
}

package db

import (
	"context"
	"time"

	"pinkstarsociety/internal/config"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func Connect(ctx context.Context, cfg *config.Config) (*mongo.Database, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}
	database := client.Database(cfg.MongoDatabase)

	users := database.Collection("users")
	_, _ = users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})

	bookings := database.Collection("bookings")
	_, _ = bookings.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "public_token", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	_, _ = bookings.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "client_user_id", Value: 1}},
	})
	_, _ = users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "qr_token", Value: 1}},
		Options: options.Index().
			SetUnique(true).
			SetPartialFilterExpression(bson.M{
				"qr_token": bson.M{"$exists": true, "$type": "string", "$ne": ""},
			}),
	})

	return database, nil
}

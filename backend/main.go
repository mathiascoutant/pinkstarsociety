package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pinkstarsociety/internal/config"
	"pinkstarsociety/internal/db"
	"pinkstarsociety/internal/handlers"
	"pinkstarsociety/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	database, err := db.Connect(ctx, cfg)
	if err != nil {
		log.Fatal("mongodb: ", err)
	}

	h := handlers.New(database, cfg)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL, "http://127.0.0.1:5173", "http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")

	api.POST("/auth/register", h.Register)
	api.POST("/auth/login", h.Login)

	authz := api.Group("")
	authz.Use(middleware.AuthRequired(cfg))
	authz.GET("/me", h.Me)
	authz.PATCH("/me", h.PatchMe)
	authz.DELETE("/me", h.DeleteMe)
	authz.GET("/me/bookings", h.ClientListBookings)
	authz.GET("/me/bookings/:id", h.ClientGetBooking)

	admin := api.Group("/admin")
	admin.Use(middleware.AuthRequired(cfg), middleware.AdminOnly())
	admin.GET("/users", h.AdminListUsers)
	admin.PATCH("/users/:id", h.AdminPatchUser)
	admin.DELETE("/users/:id", h.AdminDeleteUser)

	admin.GET("/service-types", h.ListServiceTypes)
	admin.POST("/service-types", h.CreateServiceType)
	admin.PATCH("/service-types/:id", h.PatchServiceType)
	admin.DELETE("/service-types/:id", h.DeleteServiceType)

	admin.GET("/bookings", h.AdminListBookings)
	admin.GET("/bookings/summary", h.AdminBookingSummary)
	admin.POST("/bookings", h.AdminCreateBooking)
	admin.PATCH("/bookings/:id", h.AdminPatchBooking)
	admin.DELETE("/bookings/:id", h.AdminDeleteBooking)
	admin.POST("/bookings/:id/verify-arrival", h.AdminVerifyClientArrival)
	admin.POST("/bookings/:id/complete-service", h.AdminCompleteService)

	pub := api.Group("/public")
	pub.GET("/bookings/:token", h.GetPublicBooking)
	pub.POST("/bookings/:token/checkout", h.CreateCheckout)
	pub.POST("/bookings/confirm", h.ConfirmCheckoutSession)
	pub.GET("/bookings/:token/facture.pdf", h.DownloadInvoice)
	pub.GET("/bookings/:token/agenda.ics", h.CalendarICS)

	r.POST("/api/stripe/webhook", h.StripeWebhook)

	srvAddr := ":" + cfg.Port
	go func() {
		if err := r.Run(srvAddr); err != nil {
			log.Fatal(err)
		}
	}()
	log.Println("API ecoute sur", srvAddr)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
}

package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"pinkstarsociety/internal/config"
	"pinkstarsociety/internal/db"
	"pinkstarsociety/internal/handlers"
	"pinkstarsociety/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// isSubPath indique si full est un chemin sous root (évite path traversal).
func isSubPath(root, full string) bool {
	rel, err := filepath.Rel(root, full)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

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
	admin.GET("/loyalty-codes", h.ListLoyaltyCodes)
	admin.POST("/loyalty-codes", h.CreateLoyaltyCode)
	admin.PATCH("/loyalty-codes/:id", h.PatchLoyaltyCode)
	admin.DELETE("/loyalty-codes/:id", h.DeleteLoyaltyCode)

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

	r.GET("/health", func(c *gin.Context) {
		c.Status(200)
	})

	staticRoot := strings.TrimSpace(os.Getenv("STATIC_ROOT"))
	if staticRoot != "" {
		abs, err := filepath.Abs(staticRoot)
		if err != nil {
			log.Fatal("STATIC_ROOT: ", err)
		}
		assetsDir := filepath.Join(abs, "assets")
		if st, err := os.Stat(assetsDir); err == nil && st.IsDir() {
			r.Static("/assets", assetsDir)
		}
		for _, name := range []string{"star.svg", "favicon.ico"} {
			p := filepath.Join(abs, name)
			if _, err := os.Stat(p); err == nil {
				r.StaticFile("/"+name, p)
			}
		}
		r.NoRoute(func(c *gin.Context) {
			p := c.Request.URL.Path
			if strings.HasPrefix(p, "/api") {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			if c.Request.Method != "GET" && c.Request.Method != "HEAD" {
				c.Status(404)
				return
			}
			sub := strings.TrimPrefix(p, "/")
			if sub != "" {
				full := filepath.Join(abs, filepath.Clean(sub))
				if isSubPath(abs, full) {
					if st, err := os.Stat(full); err == nil && !st.IsDir() {
						c.File(full)
						return
					}
				}
			}
			c.File(filepath.Join(abs, "index.html"))
		})
	}

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

package main

import (
	"log"

	"github.com/cloudinary/cloudinary-go/v2"

	"media-api/internal/cache"
	"media-api/internal/config"
	"media-api/internal/database"
	"media-api/internal/modules/post"
	"media-api/internal/queue"
	"media-api/internal/routes"
	"media-api/internal/websocket"
)

func main() {
	// 1. Load configuration
	cfg := config.LoadConfig()

	// 2. Connect to database
	database.ConnectPostgres(cfg.DatabaseURL)
	database.Migrate(database.DB)

	// 3. Connect to Redis
	database.ConnectRedis(cfg.RedisURL)
	cache.InitRedis(cfg.RedisURL)
	websocket.SetRedisClient(database.RedisClient)

	// 3.5 Initialize WebSocket Hub
	hub := websocket.NewHub()
	go hub.Run()

	// 4. Initialize Asynq Client
	queue.InitClient(cfg.RedisURL)
	
	// Initialize Cloudinary
	var cld *cloudinary.Cloudinary
	if cfg.CloudinaryCloudName != "" {
		var err error
		cld, err = cloudinary.NewFromParams(cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret)
		if err != nil {
			log.Printf("Failed to initialize Cloudinary: %v", err)
		}
	}

	// 4.5 Register Asynq Handlers
	queue.RegisterHandler("media:process", post.HandleMediaProcess(database.DB, hub, cld))
	queue.RegisterHandler("post:update_comment_count", post.HandleUpdateCommentCount(database.DB))

	// 5. Start Asynq Server (Worker) in a goroutine
	go queue.StartServer(cfg.RedisURL)

	// 6. Setup router
	r := routes.SetupRouter(database.DB, hub)

	// 7. Start server
	log.Printf("Starting server on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

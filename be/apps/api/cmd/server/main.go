package main

import (
	"log"

	"media-api/internal/config"
	"media-api/internal/database"
	"media-api/internal/queue"
	"media-api/internal/routes"
)

func main() {
	// 1. Load configuration
	cfg := config.LoadConfig()

	// 2. Connect to database
	database.ConnectPostgres(cfg.DatabaseURL)
	database.Migrate(database.DB)

	// 3. Connect to Redis
	database.ConnectRedis(cfg.RedisURL)

	// 4. Initialize Asynq Client
	queue.InitClient(cfg.RedisURL)

	// 5. Start Asynq Server (Worker) in a goroutine
	go queue.StartServer(cfg.RedisURL)

	// 6. Setup router
	r := routes.SetupRouter(database.DB)

	// 7. Start server
	log.Printf("Starting server on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

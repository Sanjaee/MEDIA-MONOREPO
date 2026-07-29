package main

import (
	"log"
	"time"

	"media-api/internal/cache"
	"media-api/internal/config"
	"media-api/internal/database"
	"media-api/internal/modules/post"
	"media-api/internal/modules/notification"
	"media-api/internal/modules/user"
	"media-api/internal/queue"
	"media-api/internal/routes"
	"media-api/internal/storage"
	"media-api/internal/websocket"
	"media-api/internal/worker"
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
	
	// Initialize Storage (R2)
	store, err := storage.NewR2()
	if err != nil {
		log.Printf("Failed to initialize R2 storage: %v", err)
	}

	// 4.5 Register Asynq Handlers
	queue.RegisterHandler("media:process", post.HandleMediaProcess(database.DB, hub, store))
	queue.RegisterHandler("post:update_comment_count", post.HandleUpdateCommentCount(database.DB))
	queue.RegisterHandler("post:update_trending_score", post.HandleUpdateTrendingScore(database.DB))
	queue.RegisterHandler(worker.TypeUpdateCommentScore, worker.NewUpdateCommentScoreTaskHandler(database.DB).ProcessTask)

	// 5. Start Asynq Server (Worker) in a goroutine
	go queue.StartServer(cfg.RedisURL)

	// 5.5 Start background role expiration worker
	go func() {
		notificationRepo := notification.NewRepository(database.DB)
		notifService := notification.NewService(notificationRepo)

		for {
			now := time.Now()
			
			// 1. Notify users expiring in <= 3 days
			in3Days := now.AddDate(0, 0, 3)
			var expiringUsers []user.User
			database.DB.Where("role_expired_at IS NOT NULL AND role_expired_at > ? AND role_expired_at < ? AND role_expiring_notified = ?", now, in3Days, false).Find(&expiringUsers)
			for _, u := range expiringUsers {
				if u.Role != nil {
					_ = notifService.CreateRoleExpiringSoonNotification(u.ID, *u.Role)
				}
				database.DB.Model(&u).Update("role_expiring_notified", true)
			}

			// 2. Expire users and notify
			var expiredUsers []user.User
			database.DB.Where("role_expired_at IS NOT NULL AND role_expired_at < ?", now).Find(&expiredUsers)
			for _, u := range expiredUsers {
				if u.Role != nil {
					_ = notifService.CreateRoleExpiredNotification(u.ID, *u.Role)
				}
				database.DB.Model(&u).Updates(map[string]interface{}{
					"role": "member",
					"role_expired_at": nil,
					"role_expiring_notified": false,
				})
			}
			
			time.Sleep(1 * time.Hour)
		}
	}()

	// 6. Setup router
	r := routes.SetupRouter(database.DB, hub, store)

	// 7. Start server
	log.Printf("Starting server on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

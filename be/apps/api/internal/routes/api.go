package routes

import (
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"media-api/internal/cache"
	"media-api/internal/middleware"
	"media-api/internal/modules/auth"
	"media-api/internal/modules/chat"
	"media-api/internal/modules/comment"
	"media-api/internal/modules/interaction"
	"media-api/internal/modules/monetization"
	"media-api/internal/modules/notification"
	"media-api/internal/modules/post"
	"media-api/internal/storage"
	"media-api/internal/websocket"
)

func SetupRouter(db *gorm.DB, hub *websocket.Hub, store storage.Storage) *gin.Engine {
	r := gin.Default()

	// Hub is now passed from main.go


	notificationRepo := notification.NewRepository(db)
	notificationService := notification.NewService(notificationRepo)
	notificationHandler := notification.NewHandler(notificationService)

	postRepo := post.NewRepository(db)
	postService := post.NewService(postRepo, hub, store)
	postController := post.NewController(postService)

	commentRepo := comment.NewRepository(db)
	commentService := comment.NewService(commentRepo, notificationService)
	commentController := comment.NewController(commentService)

	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authService)

	interactionRepo := interaction.NewRepository(db)
	interactionService := interaction.NewService(interactionRepo, notificationService)
	interactionController := interaction.NewController(interactionService)

	chatRepo := chat.NewRepository(db)
	chatService := chat.NewService(chatRepo)
	chatHandler := chat.NewHandler(chatService)

	monetizationRepo := monetization.NewRepository(db)
	
	plisioAPIKey := os.Getenv("PLISIO_API_KEY")
	appURL := os.Getenv("NEXT_PUBLIC_APP_URL")
	if appURL == "" {
		appURL = "http://localhost:3000"
	}
	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://localhost:8080"
	}
	
	monetizationService := monetization.NewService(monetizationRepo, db, notificationService, store, plisioAPIKey, appURL, backendURL)

	monetizationHandler := monetization.NewHandler(monetizationService)

	// Health check route
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	api := r.Group("/api")
	api.Use(middleware.OptionalAuth(authService))
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "pong",
			})
		})

		// Post and Feed routes
		post.RegisterRoutes(api, postController)

		// Comment routes
		comment.RegisterRoutes(api, commentController)

		// Interaction routes
		interaction.RegisterRoutes(api, interactionController)

		// Monetization routes
		monetization.RegisterRoutes(api, monetizationHandler)

		// Chat routes
		chat.RegisterRoutes(api, chatHandler)

		// Notification routes
		notification.RegisterRoutes(api, notificationHandler)

		// User routes
		api.GET("/users/profile/:username", authHandler.GetUserProfileByUsername)
		api.GET("/users/search", authHandler.SearchUsers)
		api.POST("/users/:id/follow", middleware.RateLimitMiddleware(cache.RDB, 50, 1*time.Hour), authHandler.ToggleFollow)

		// Auth Adapter routes
		adapter := api.Group("/auth/adapter")
		adapter.Use(middleware.CSRFMiddleware())
		{
			adapter.POST("/user", authHandler.CreateUser)
			adapter.GET("/user/:id", authHandler.GetUser)
			adapter.GET("/user/email/:email", authHandler.GetUserByEmail)
			adapter.GET("/user/account/:provider/:providerAccountId", authHandler.GetUserByAccount)
			adapter.PUT("/user/:id", authHandler.UpdateUser)
			
			adapter.POST("/account", authHandler.LinkAccount)
			
			adapter.POST("/session", authHandler.CreateSession)
			adapter.GET("/session/:sessionToken", authHandler.GetSessionAndUser)
			adapter.PUT("/session/:sessionToken", authHandler.UpdateSession)
			adapter.DELETE("/session/:sessionToken", authHandler.DeleteSession)
		}

		// WebSocket Route
		api.GET("/ws", func(c *gin.Context) {
			websocket.ServeWs(hub, chatService, c)
		})
	}

	return r
}

package routes

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"media-api/internal/modules/auth"
	"media-api/internal/modules/post"
)

func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	// Dependency Injection
	postRepo := post.NewRepository(db)
	postService := post.NewService(postRepo)
	postHandler := post.NewHandler(postService)

	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authService)

	// Health check route
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "pong",
			})
		})

		// Post routes
		api.GET("/posts", postHandler.GetPosts)

		// Auth Adapter routes
		adapter := api.Group("/auth/adapter")
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
	}

	return r
}

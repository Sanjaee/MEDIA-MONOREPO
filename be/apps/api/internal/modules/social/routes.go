package social

import (
	"time"

	"github.com/gin-gonic/gin"

	"media-api/internal/cache"
	"media-api/internal/middleware"
)

func RegisterRoutes(router *gin.RouterGroup, controller *Controller) {
	// User-to-user actions
	router.POST("/users/:id/friend", middleware.RateLimitMiddleware(cache.RDB, 20, 1*time.Hour), controller.ToggleFriend)
	router.GET("/users/:id/social", controller.GetSocialStatus)
	router.POST("/users/:id/block", middleware.RateLimitMiddleware(cache.RDB, 10, 1*time.Hour), controller.BlockUser)
	router.DELETE("/users/:id/block", middleware.RateLimitMiddleware(cache.RDB, 10, 1*time.Hour), controller.UnblockUser)

	// Reports
	router.POST("/posts/:id/report", middleware.RateLimitMiddleware(cache.RDB, 10, 1*time.Minute), controller.ReportPost)

	// Admin
	admin := router.Group("/admin")
	{
		admin.GET("/reports", controller.ListReports)
		admin.POST("/reports/:id/status", controller.UpdateReportStatus)
	}
}
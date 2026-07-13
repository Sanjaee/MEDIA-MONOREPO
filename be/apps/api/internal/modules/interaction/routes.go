package interaction

import (
	"time"
	"github.com/gin-gonic/gin"
	"media-api/internal/cache"
	"media-api/internal/middleware"
)

func RegisterRoutes(router *gin.RouterGroup, controller *Controller) {
	router.POST("/posts/:id/like", middleware.RateLimitMiddleware(cache.RDB, 1, 5*time.Second), controller.ToggleLike)
	router.POST("/posts/:id/bookmark", controller.ToggleBookmark)
}

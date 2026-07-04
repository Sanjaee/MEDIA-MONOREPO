package interaction

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(router *gin.RouterGroup, controller *Controller) {
	router.POST("/posts/:id/like", controller.ToggleLike)
}

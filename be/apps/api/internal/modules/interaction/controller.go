package interaction

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

type Controller struct {
	service Service
}

func NewController(service Service) *Controller {
	return &Controller{service}
}

// ToggleLike handles POST /api/posts/:id/like
func (c *Controller) ToggleLike(ctx *gin.Context) {
	postID := ctx.Param("id")
	authHeader := ctx.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	}

	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isLiked, likeCount, err := c.service.ToggleLike(ctx.Request.Context(), userID, postID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"isLiked":   isLiked,
		"likeCount": likeCount,
	})
}

// ToggleBookmark handles POST /api/posts/:id/bookmark
func (c *Controller) ToggleBookmark(ctx *gin.Context) {
	postID := ctx.Param("id")

	authHeader := ctx.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	}

	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	isBookmarked, newCount, err := c.service.ToggleBookmark(ctx.Request.Context(), userID, postID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"bookmarked":    isBookmarked,
		"bookmarkCount": newCount,
	})
}

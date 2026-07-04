package post

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Controller struct {
	service Service
}

func NewController(service Service) *Controller {
	return &Controller{service}
}

// GetLatestFeed handles GET /api/feed/latest
func (c *Controller) GetLatestFeed(ctx *gin.Context) {
	cursor := ctx.Query("cursor")
	limitStr := ctx.DefaultQuery("limit", "10")
	limit, _ := strconv.Atoi(limitStr)

	posts, err := c.service.GetLatestFeed(ctx.Request.Context(), cursor, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nextCursor string
	if len(posts) > limit {
		nextCursor = posts[limit].CreatedAt.Format(time.RFC3339Nano)
		posts = posts[:limit]
	}

	ctx.JSON(http.StatusOK, gin.H{
		"posts":      posts,
		"nextCursor": nextCursor,
	})
}

// CreatePost handles POST /api/posts
func (c *Controller) CreatePost(ctx *gin.Context) {
	authHeader := ctx.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	}

	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	post := &Post{
		ID:       uuid.New().String(),
		AuthorID: userID,
		Content:  &req.Content,
	}

	if err := c.service.CreatePost(ctx.Request.Context(), post); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, post)
}

// GetPostById handles GET /api/posts/:id
func (c *Controller) GetPostById(ctx *gin.Context) {
	postID := ctx.Param("id")
	post, err := c.service.GetPostById(ctx.Request.Context(), postID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	ctx.JSON(http.StatusOK, post)
}

// UpdatePost handles PUT /api/posts/:id
func (c *Controller) UpdatePost(ctx *gin.Context) {
	postID := ctx.Param("id")
	// For example purposes, assuming auth middleware sets "userID" in gin context
	userID := ctx.GetString("userID") 
	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := c.service.UpdatePost(ctx.Request.Context(), postID, userID, &req.Content)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()}) // using 403 or 500
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "success"})
}

// DeletePost handles DELETE /api/posts/:id
func (c *Controller) DeletePost(ctx *gin.Context) {
	postID := ctx.Param("id")
	userID := ctx.GetString("userID")
	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	err := c.service.DeletePost(ctx.Request.Context(), postID, userID)
	if err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "success"})
}

// RegisterRoutes registers HTTP routes for post module
func RegisterRoutes(router *gin.RouterGroup, controller *Controller) {
	// e.g. api/feed/latest
	feedRoutes := router.Group("/feed")
	{
		feedRoutes.GET("/latest", controller.GetLatestFeed)
		feedRoutes.GET("/trending", controller.GetLatestFeed) // TODO: Implement GetTrendingFeed logic in controller
		feedRoutes.GET("/hot", controller.GetLatestFeed)      // TODO: Implement GetHotFeed logic in controller
		feedRoutes.GET("/media", controller.GetLatestFeed)    // TODO: Implement GetMediaFeed logic in controller
		feedRoutes.GET("/search", controller.GetLatestFeed)   // TODO: Implement GetSearchFeed logic in controller
		feedRoutes.GET("/bookmarks", controller.GetLatestFeed) // TODO: Implement bookmarks feed
	}

	postRoutes := router.Group("/posts")
	{
		postRoutes.POST("", controller.CreatePost)
		postRoutes.GET("/:id", controller.GetPostById)
		postRoutes.PUT("/:id", controller.UpdatePost)
		postRoutes.DELETE("/:id", controller.DeletePost)
		// postRoutes.POST("/:id/like", controller.ToggleLike)
		// postRoutes.POST("/:id/bookmark", controller.ToggleBookmark)
	}
}

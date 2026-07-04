package post

import (
	"net/http"
	"os"
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

	authHeader := ctx.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	}

	posts, err := c.service.GetLatestFeed(ctx.Request.Context(), userID, cursor, limit)
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

	form, err := ctx.MultipartForm()
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid form data", "details": err.Error()})
		return
	}

	contentVals := form.Value["content"]
	var contentStr string
	if len(contentVals) > 0 {
		contentStr = contentVals[0]
	}
	var contentPtr *string
	if contentStr != "" {
		contentPtr = &contentStr
	}

	post := &Post{
		ID:       uuid.New().String(),
		AuthorID: userID,
		Content:  contentPtr,
	}

	// Get uploaded files
	files := form.File["media"]
	var tempFiles []string
	for _, file := range files {
		// Save file to temp directory
		tempFilePath := os.TempDir() + "/" + uuid.New().String() + "_" + file.Filename
		if err := ctx.SaveUploadedFile(file, tempFilePath); err == nil {
			tempFiles = append(tempFiles, tempFilePath)
		}
	}

	visibility := "public"
	if len(tempFiles) > 0 {
		visibility = "processing"
	}
	post.Visibility = &visibility

	if err := c.service.CreatePost(ctx.Request.Context(), post, tempFiles); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, post)
}

// GetPostById handles GET /api/posts/:id
func (c *Controller) GetPostById(ctx *gin.Context) {
	postID := ctx.Param("id")

	authHeader := ctx.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	}

	post, err := c.service.GetPostById(ctx.Request.Context(), userID, postID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}

	ctx.JSON(http.StatusOK, post)
}

// UpdatePost handles PUT /api/posts/:id
func (c *Controller) UpdatePost(ctx *gin.Context) {
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
	authHeader := ctx.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	}
	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	err := c.service.DeletePost(ctx.Request.Context(), postID, userID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		// postRoutes.POST("/:id/bookmark", controller.ToggleBookmark)
	}
}



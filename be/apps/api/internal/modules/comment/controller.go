package comment

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

func (c *Controller) CreateComment(ctx *gin.Context) {
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
		PostID          string  `json:"postId"`
		Content         string  `json:"content"`
		ParentCommentID *string `json:"parentCommentId"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	comment := &Comment{
		ID:              uuid.New().String(),
		PostID:          req.PostID,
		AuthorID:        userID,
		Content:         req.Content,
		ParentCommentID: req.ParentCommentID,
	}

	if err := c.service.CreateComment(ctx.Request.Context(), comment); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, comment)
}

func (c *Controller) DeleteComment(ctx *gin.Context) {
	commentID := ctx.Param("id")
	authHeader := ctx.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	}

	if userID == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := c.service.DeleteComment(ctx.Request.Context(), commentID, userID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}

func (c *Controller) GetComments(ctx *gin.Context) {
	postID := ctx.Param("postId")
	cursor := ctx.Query("cursor")
	limitStr := ctx.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	comments, err := c.service.GetCommentsByPostID(ctx.Request.Context(), postID, cursor, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nextCursor *string
	if len(comments) > limit {
		nc := comments[limit].CreatedAt.Format(time.RFC3339Nano)
		nextCursor = &nc
		comments = comments[:limit]
	}

	ctx.JSON(http.StatusOK, gin.H{
		"comments":   comments,
		"nextCursor": nextCursor,
	})
}

func (c *Controller) GetReplies(ctx *gin.Context) {
	parentID := ctx.Param("id")
	cursor := ctx.Query("cursor")
	limitStr := ctx.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	comments, err := c.service.GetRepliesByCommentID(ctx.Request.Context(), parentID, cursor, limit)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var nextCursor *string
	if len(comments) > limit {
		nc := comments[limit].CreatedAt.Format(time.RFC3339Nano)
		nextCursor = &nc
		comments = comments[:limit]
	}

	ctx.JSON(http.StatusOK, gin.H{
		"replies":    comments,
		"nextCursor": nextCursor,
	})
}

func RegisterRoutes(router *gin.RouterGroup, controller *Controller) {
	commentRoutes := router.Group("/comments")
	{
		commentRoutes.POST("", controller.CreateComment)
		commentRoutes.GET("/post/:postId", controller.GetComments)
		commentRoutes.GET("/:id/replies", controller.GetReplies)
		commentRoutes.DELETE("/:id", controller.DeleteComment)
	}
}

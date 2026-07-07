package chat

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service}
}

// GetConversations returns all conversations for the authenticated user
func (h *Handler) GetConversations(c *gin.Context) {
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	conversations, err := h.service.GetUserConversations(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": conversations})
}

// GetMessages returns messages for a specific conversation
func (h *Handler) GetMessages(c *gin.Context) {
	conversationID := c.Param("id")
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	messages, err := h.service.GetMessages(conversationID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": messages})
}

// CreateConversation gets or creates a conversation with another user
func (h *Handler) CreateConversation(c *gin.Context) {
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		ReceiverID string `json:"receiverId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	conv, err := h.service.GetOrCreateConversation(userID, req.ReceiverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": conv})
}

// GetUnreadCount returns the total unread message count for the user
func (h *Handler) GetUnreadCount(c *gin.Context) {
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	count, err := h.service.GetTotalUnreadCount(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": map[string]int64{"count": count}})
}

// MarkAsRead marks a conversation's messages as read
func (h *Handler) MarkAsRead(c *gin.Context) {
	userID := c.GetHeader("X-User-Id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	conversationID := c.Param("id")
	if err := h.service.MarkConversationAsRead(conversationID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": "success"})
}

// RegisterRoutes registers chat routes
func RegisterRoutes(r *gin.RouterGroup, handler *Handler) {
	chat := r.Group("/chat")
	{
		chat.GET("/conversations", handler.GetConversations)
		chat.GET("/conversations/:id/messages", handler.GetMessages)
		chat.POST("/conversations", handler.CreateConversation)
		chat.GET("/unread-count", handler.GetUnreadCount)
		chat.PUT("/conversations/:id/read", handler.MarkAsRead)
	}
}


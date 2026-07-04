package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"media-api/internal/modules/user"
)

type Handler struct {
	service Service
}

func NewHandler(service Service) *Handler {
	return &Handler{service}
}

func (h *Handler) CreateUser(c *gin.Context) {
	var u user.User
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.service.CreateUser(&u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *Handler) GetUser(c *gin.Context) {
	id := c.Param("id")
	u, err := h.service.GetUser(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *Handler) GetUserByEmail(c *gin.Context) {
	email := c.Param("email")
	u, err := h.service.GetUserByEmail(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *Handler) GetUserByAccount(c *gin.Context) {
	provider := c.Param("provider")
	providerAccountId := c.Param("providerAccountId")

	u, err := h.service.GetUserByAccount(provider, providerAccountId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	var u user.User
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u.ID = c.Param("id")

	updated, err := h.service.UpdateUser(&u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) LinkAccount(c *gin.Context) {
	var a user.Account
	if err := c.ShouldBindJSON(&a); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	linked, err := h.service.LinkAccount(&a)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, linked)
}

func (h *Handler) CreateSession(c *gin.Context) {
	var s user.Session
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.service.CreateSession(&s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *Handler) GetSessionAndUser(c *gin.Context) {
	sessionToken := c.Param("sessionToken")
	s, u, err := h.service.GetSessionAndUser(sessionToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if s == nil || u == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"session": s,
		"user":    u,
	})
}

func (h *Handler) UpdateSession(c *gin.Context) {
	var s user.Session
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	s.SessionToken = c.Param("sessionToken")

	updated, err := h.service.UpdateSession(&s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) DeleteSession(c *gin.Context) {
	sessionToken := c.Param("sessionToken")
	err := h.service.DeleteSession(sessionToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func (h *Handler) GetUserProfileByUsername(c *gin.Context) {
	username := c.Param("username")
	// Mock implementation for now
	c.JSON(http.StatusOK, gin.H{
		"id": "mock-id",
		"name": "Mock User",
		"username": username,
		"image": "",
		"bio": "",
		"role": "user",
		"isVerified": false,
		"isBanned": false,
		"stats": gin.H{
			"totalThreads": 0,
			"totalPosts": 0,
			"reputation": 0,
		},
		"recentPosts": []interface{}{},
	})
}

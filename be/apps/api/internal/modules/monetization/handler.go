package monetization

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service Service
}

func RegisterRoutes(router *gin.RouterGroup, h *Handler) {
	payment := router.Group("/payment")
	{
		payment.GET("/plisio/currencies", h.GetCurrencies)
		payment.POST("/plisio/role", h.CreateRolePayment)
		payment.POST("/plisio/ad", h.CreateAdPayment)
		payment.POST("/plisio/webhook", h.Webhook)
		payment.GET("/plisio/verify", h.VerifyOrder)
	}
}

func NewHandler(service Service) *Handler {

	return &Handler{service: service}
}

func (h *Handler) GetCurrencies(c *gin.Context) {
	currencies, err := h.service.GetPlisioCurrencies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": currencies})
}

func (h *Handler) CreateRolePayment(c *gin.Context) {
	// Require Auth
	authHeader := c.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	} else if xUserId := c.GetHeader("X-User-Id"); xUserId != "" {
		userID = xUserId
	}

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req CreateRolePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, invoiceURL, err := h.service.CreatePaymentForRolePlisio(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"order_id":  tx.ID,
			"hostedUrl": invoiceURL,
		},
	})
}

func (h *Handler) CreateAdPayment(c *gin.Context) {
	// Require Auth
	authHeader := c.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	} else if xUserId := c.GetHeader("X-User-Id"); xUserId != "" {
		userID = xUserId
	}
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req CreateAdPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, invoiceURL, err := h.service.CreatePaymentForAdPlisio(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"order_id":  tx.ID,
			"hostedUrl": invoiceURL,
		},
	})
}

func (h *Handler) Webhook(c *gin.Context) {
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	if err := h.service.HandlePlisioWebhook(payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) VerifyOrder(c *gin.Context) {
	// Require Auth
	authHeader := c.GetHeader("Authorization")
	var userID string
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		userID = authHeader[7:]
	} else if xUserId := c.GetHeader("X-User-Id"); xUserId != "" {
		userID = xUserId
	}

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	orderID := c.Query("order_id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "order_id is required"})
		return
	}

	tx, status, err := h.service.VerifyPlisioOrder(userID, orderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"payment": tx,
			"status":  status,
		},
	})
}

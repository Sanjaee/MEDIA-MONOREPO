package monetization

import (
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
		payment.POST("/plisio/product", h.CreateProductPayment)
		payment.POST("/plisio/webhook", h.Webhook)
		payment.GET("/plisio/verify", h.VerifyOrder)
		payment.GET("/products/sales", h.GetProductSalesStats)
	}

	ads := router.Group("/ads")
	{
		ads.POST("/", h.CreatePendingAd)
		ads.GET("/pending", h.GetPendingAds)
		ads.PUT("/:id/setup", h.SetupAd)
		ads.GET("/active", h.GetActiveAds)
		ads.PUT("/:id", h.UpdateAd)
		ads.DELETE("/:id", h.DeleteAd)
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

func (h *Handler) CreateProductPayment(c *gin.Context) {
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

	var req CreateProductPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, invoiceURL, err := h.service.CreatePaymentForProductPlisio(userID, req)
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

// Ads Handlers

func (h *Handler) CreatePendingAd(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req CreatePendingAdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ad, err := h.service.CreatePendingAdSlot(userID, req.DurationDays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": ad})
}

func (h *Handler) GetPendingAds(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	ads, err := h.service.GetPendingAdSlots(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": ads})
}

func (h *Handler) SetupAd(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	adID := c.Param("id")

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form data", "details": err.Error()})
		return
	}

	req := SetupAdSlotRequest{
		Title:       c.PostForm("title"),
		LinkURL:     c.PostForm("linkUrl"),
		MediaType:   c.PostForm("mediaType"),
	}

	if req.Title == "" || req.LinkURL == "" || req.MediaType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields (title, linkUrl, mediaType)"})
		return
	}

	files := form.File["media"]
	var tempFilePath string
	if len(files) > 0 {
		file := files[0]
		// Save file to temp directory
		tempFilePath = os.TempDir() + "/" + uuid.New().String() + "_" + file.Filename
		if err := c.SaveUploadedFile(file, tempFilePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save media file"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "media file is required"})
		return
	}

	ad, err := h.service.SetupAdSlot(userID, adID, req, tempFilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": ad})
}

func (h *Handler) GetActiveAds(c *gin.Context) {
	ads, err := h.service.GetActiveAds()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": ads})
}

func (h *Handler) UpdateAd(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	adID := c.Param("id")

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form data", "details": err.Error()})
		return
	}

	req := SetupAdSlotRequest{
		Title:     c.PostForm("title"),
		LinkURL:   c.PostForm("linkUrl"),
		MediaType: c.PostForm("mediaType"),
	}

	files := form.File["media"]
	var tempFilePath string
	if len(files) > 0 {
		file := files[0]
		// Save file to temp directory
		tempFilePath = os.TempDir() + "/" + uuid.New().String() + "_" + file.Filename
		if err := c.SaveUploadedFile(file, tempFilePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save media file"})
			return
		}
	}

	ad, err := h.service.UpdateAdSlotDetails(userID, adID, req, tempFilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": ad})
}

func (h *Handler) DeleteAd(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	adID := c.Param("id")

	err := h.service.DeleteAdSlot(userID, adID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func getAuthUserID(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	} else if xUserId := c.GetHeader("X-User-Id"); xUserId != "" {
		return xUserId
	}
	return ""
}

func (h *Handler) GetProductSalesStats(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	stats, err := h.service.GetProductSalesStats(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

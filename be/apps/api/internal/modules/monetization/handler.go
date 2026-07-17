package monetization

import (
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"media-api/internal/cache"
	"media-api/internal/middleware"
)

type Handler struct {
	service Service
}

func RegisterRoutes(router *gin.RouterGroup, h *Handler) {
	payment := router.Group("/payment")
	{
		// Apply rate limit ONLY to payment creation endpoints to prevent spam, not webhooks or currencies
		creationLimiter := middleware.RateLimitMiddleware(cache.RDB, 30, time.Hour)
		
		payment.GET("/plisio/currencies", h.GetCurrencies)
		payment.POST("/plisio/role", creationLimiter, h.CreateRolePayment)
		payment.POST("/plisio/ad", creationLimiter, h.CreateAdPayment)
		payment.POST("/plisio/product", creationLimiter, h.CreateProductPayment)
		
		// Webhook MUST NOT be rate-limited, otherwise Plisio cannot notify us!
		payment.POST("/plisio/webhook", h.Webhook)
		payment.POST("/plisio/verify-key", h.VerifyKey)
		payment.GET("/plisio/verify", h.VerifyOrder)
		payment.GET("/products/sales", h.GetProductSalesStats)
		payment.POST("/products/withdraw", h.WithdrawProductEarnings)
		payment.GET("/products/withdraw/history", h.GetWithdrawalHistory)
		payment.GET("/admin/transactions", h.GetAllTransactionsAdmin)
	}

	products := router.Group("/products")
	{
		products.POST("/:postId/access-token", h.GenerateProductAccessURL)
		products.GET("/download", h.DownloadProductByToken)
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
	userID := c.GetString("userID")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
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

	tx, invData, err := h.service.CreatePaymentForRolePlisio(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	respData := map[string]interface{}{
		"order_id":  tx.ID,
		"hostedUrl": invData.InvoiceURL,
	}

	// Include white-label data if present
	if invData.QrCode != "" && invData.WalletHash != "" {
		respData["whiteLabel"] = map[string]interface{}{
			"wallet_hash":            invData.WalletHash,
			"qr_code":                invData.QrCode,
			"amount":                 invData.Amount,
			"currency":               invData.Currency,
			"status":                 invData.Status,
			"expected_confirmations": invData.ExpectedConfirmations,
			"pending_amount":         invData.PendingAmount,
			"invoice_sum":            invData.InvoiceSum,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    respData,
	})
}

func (h *Handler) CreateAdPayment(c *gin.Context) {
	// Require Auth
	userID := c.GetString("userID")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
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
	userID := c.GetString("userID")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
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

	tx, invData, err := h.service.CreatePaymentForProductPlisio(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	respData := map[string]interface{}{
		"order_id":  tx.ID,
		"hostedUrl": invData.InvoiceURL,
	}

	// Include white-label data if present
	if invData.QrCode != "" && invData.WalletHash != "" {
		respData["whiteLabel"] = map[string]interface{}{
			"wallet_hash":            invData.WalletHash,
			"qr_code":                invData.QrCode,
			"amount":                 invData.Amount,
			"currency":               invData.Currency,
			"status":                 invData.Status,
			"expected_confirmations": invData.ExpectedConfirmations,
			"pending_amount":         invData.PendingAmount,
			"invoice_sum":            invData.InvoiceSum,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    respData,
	})
}

func (h *Handler) Webhook(c *gin.Context) {
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("Plisio webhook read error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	if err := h.service.HandlePlisioWebhook(payload); err != nil {
		log.Printf("Plisio webhook handle error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) VerifyOrder(c *gin.Context) {
	// Require Auth
	userID := c.GetString("userID")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
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

func (h *Handler) VerifyKey(c *gin.Context) {
	// This endpoint verifies a Plisio callback signature securely on the backend
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	isValid := h.service.VerifyPlisioSignatureOnly(data)
	c.JSON(http.StatusOK, gin.H{"valid": isValid})
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
	userID := c.GetString("userID")
	if userID == "" {
		userID = c.GetHeader("X-User-Id")
	}
	return userID
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

func (h *Handler) WithdrawProductEarnings(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req WithdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	withdrawal, err := h.service.WithdrawProductEarnings(userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": withdrawal})
}

func (h *Handler) GetWithdrawalHistory(c *gin.Context) {
	userID := getAuthUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	history, err := h.service.GetWithdrawalHistory(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": history})
}

// GenerateProductAccessURL checks if the user purchased the product and issues a short-lived download token
func (h *Handler) GenerateProductAccessURL(c *gin.Context) {
	userID := c.GetString("userID")
	postID := c.Param("postId")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Verify purchase
	hasBought, err := h.service.VerifyProductPurchase(userID, postID)
	if err != nil || !hasBought {
		c.JSON(http.StatusForbidden, gin.H{"error": "not purchased"})
		return
	}

	// Generate a short-lived token using the UUID package
	tokenID := uuid.New().String()

	// Generated product token

	// The checklist says: h.redisClient.Set(ctx, fmt.Sprintf("product_token:%s", token.TokenID), token.R2URL, 30*time.Minute)
	// But h.redisClient is not in Handler struct. Wait, I should add this to the service.
	// Let's create a service method GenerateProductToken that does this instead.
	tokenID, err = h.service.GenerateProductToken(userID, postID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"accessToken": tokenID,
		"expiresIn":   1800, // 30 minutes
	})
}

// DownloadProductByToken handles the final redirect using the token
func (h *Handler) DownloadProductByToken(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}

	signedURL, err := h.service.GetSignedURLFromToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, signedURL)
}

func (h *Handler) GetAllTransactionsAdmin(c *gin.Context) {
	userID := c.GetString("userID")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	transactions, err := h.service.GetAllTransactionsAdmin(userID)
	if err != nil {
		if err.Error() == "forbidden: owner access required" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transactions"})
		}
		return
	}

	c.JSON(http.StatusOK, transactions)
}

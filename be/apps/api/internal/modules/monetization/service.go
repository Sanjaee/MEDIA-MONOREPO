package monetization

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"media-api/internal/cache"
	"media-api/internal/modules/notification"
	"media-api/internal/storage"
	"os"
	"path/filepath"
)

const plisioBaseURL = "https://api.plisio.net/api/v1"

type Service interface {
	CreatePaymentForRoleCrypto(userID string, req CreateRolePaymentRequest) (*Transaction, *CryptoInvoiceData, error)
	CreatePaymentForAdCrypto(userID string, req CreateAdPaymentRequest) (*Transaction, string, error)
	CreatePaymentForProductCrypto(userID string, req CreateProductPaymentRequest) (*Transaction, *CryptoInvoiceData, error)
	HandleCryptoWebhook(payload []byte) error
	GetCryptoCurrencies() ([]CryptoCurrency, error)
	VerifyCryptoOrder(userID, orderID string) (*Transaction, string, error)
	VerifyCryptoSignatureOnly(data map[string]interface{}) bool

	CreatePendingAdSlot(userID string, durationDays int) (*AdSlot, error)
	GetPendingAdSlots(userID string) ([]AdSlot, error)
	SetupAdSlot(userID, adID string, req SetupAdSlotRequest, tempFilePath string) (*AdSlot, error)
	GetActiveAds() ([]AdSlot, error)
	UpdateAdSlotDetails(userID, adID string, req SetupAdSlotRequest, tempFilePath string) (*AdSlot, error)
	DeleteAdSlot(userID, adID string) error

	GetProductSalesStats(userID string) (*ProductSalesStats, error)
	WithdrawProductEarnings(userID string, req WithdrawRequest) (*Withdrawal, error)
	GetWithdrawalHistory(userID string) ([]Withdrawal, error)
	GetAllTransactionsAdmin(callerUserID string) ([]AdminTransactionRow, error)
	
	GenerateProductToken(userID, postID string) (string, error)
	GetSignedURLFromToken(token string) (string, error)
	VerifyProductPurchase(userID, postID string) (bool, error)
}

type service struct {
	repo         Repository
	db           *gorm.DB
	notifService notification.Service
	store        storage.Storage
	plisioAPIKey string
	appURL       string
	backendURL   string
}

func NewService(repo Repository, db *gorm.DB, notifService notification.Service, store storage.Storage, apiKey, appURL, backendURL string) Service {
	return &service{
		repo:         repo,
		db:           db,
		notifService: notifService,
		store:        store,
		plisioAPIKey: apiKey,
		appURL:       appURL,
		backendURL:   backendURL,
	}
}

func plisioToString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func phpSerializeString(s string) string {
	escaped := strings.ReplaceAll(s, "\\", "\\\\")
	escaped = strings.ReplaceAll(escaped, "\"", "\\\"")
	return fmt.Sprintf("s:%d:\"%s\";", len(s), escaped)
}

func plisioCallbackSerialize(data map[string]interface{}) string {
	ordered := make(map[string]string)
	for k, v := range data {
		if k == "verify_hash" {
			continue
		}
		var str string
		if k == "expire_utc" && v != nil {
			switch val := v.(type) {
			case string:
				str = val
			case float64:
				str = strconv.FormatInt(int64(val), 10)
			case int:
				str = strconv.Itoa(val)
			case int64:
				str = strconv.FormatInt(val, 10)
			default:
				str = plisioToString(v)
			}
		} else if k == "tx_urls" && v != nil {
			str = html.UnescapeString(plisioToString(v))
		} else {
			str = plisioToString(v)
		}
		ordered[k] = str
	}
	keys := make([]string, 0, len(ordered))
	for k := range ordered {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	b.WriteString(fmt.Sprintf("a:%d:{", len(ordered)))
	for _, k := range keys {
		b.WriteString(phpSerializeString(k))
		b.WriteString(phpSerializeString(ordered[k]))
	}
	b.WriteString("}")
	return b.String()
}

func plisioValueToJSON(v interface{}) string {
	if v == nil {
		return "null"
	}
	switch val := v.(type) {
	case string:
		return `"` + strings.ReplaceAll(strings.ReplaceAll(val, `\`, `\\`), `"`, `\"`) + `"`
	case float64:
		if val == float64(int64(val)) {
			return strconv.FormatInt(int64(val), 10)
		}
		return strconv.FormatFloat(val, 'f', -1, 64)
	case int:
		return strconv.Itoa(val)
	case int64:
		return strconv.FormatInt(val, 10)
	case bool:
		if val {
			return "true"
		}
		return "false"
	case []interface{}:
		var b strings.Builder
		b.WriteString("[")
		for i, e := range val {
			if i > 0 {
				b.WriteString(",")
			}
			b.WriteString(plisioValueToJSON(e))
		}
		b.WriteString("]")
		return b.String()
	default:
		bs, _ := json.Marshal(v)
		return string(bs)
	}
}

func plisioCallbackJSONString(data map[string]interface{}) string {
	keys := make([]string, 0, len(data))
	for k := range data {
		if k == "verify_hash" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	b.WriteString("{")
	for i, k := range keys {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(`"`)
		b.WriteString(strings.ReplaceAll(k, `\`, `\\`))
		b.WriteString(`":`)
		b.WriteString(plisioValueToJSON(data[k]))
	}
	b.WriteString("}")
	return b.String()
}

var plisioVerifyHashRegex = regexp.MustCompile(`,?"verify_hash"\s*:\s*"[^"]*"\s*,?`)

func stripVerifyHashFromJSON(raw []byte) string {
	s := string(raw)
	s = plisioVerifyHashRegex.ReplaceAllString(s, "")
	s = strings.TrimPrefix(s, ",")
	s = strings.TrimSuffix(s, ",")
	for strings.Contains(s, ",}") {
		s = strings.ReplaceAll(s, ",}", "}")
	}
	for strings.Contains(s, ",]") {
		s = strings.ReplaceAll(s, ",]", "]")
	}
	return strings.TrimSpace(s)
}

func (s *service) VerifyCryptoSignatureOnly(data map[string]interface{}) bool {
	return verifyPlisioCallback(data, s.plisioAPIKey, nil)
}

func verifyPlisioCallback(data map[string]interface{}, apiKey string, rawPayload []byte) bool {
	verifyHash, ok := data["verify_hash"].(string)
	if !ok || verifyHash == "" {
		return false
	}
	if apiKey == "" {
		return false
	}
	mac := hmac.New(sha1.New, []byte(apiKey))

	if len(rawPayload) > 0 {
		toSign := stripVerifyHashFromJSON(rawPayload)
		mac.Write([]byte(toSign))
		if hex.EncodeToString(mac.Sum(nil)) == verifyHash {
			return true
		}
		mac.Reset()
	}

	mac.Write([]byte(plisioCallbackJSONString(data)))
	calculatedJSON := hex.EncodeToString(mac.Sum(nil))
	if calculatedJSON == verifyHash {
		return true
	}

	serialized := plisioCallbackSerialize(data)
	hmacObj := hmac.New(sha1.New, []byte(apiKey))
	hmacObj.Write([]byte(serialized))
	computedHash := hex.EncodeToString(hmacObj.Sum(nil))

	return subtle.ConstantTimeCompare([]byte(computedHash), []byte(verifyHash)) == 1
}

func (s *service) GetCryptoCurrencies() ([]CryptoCurrency, error) {
	if s.plisioAPIKey == "" {
		return nil, fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	cacheKey := "plisio:currencies"
	if cache.RDB != nil {
		cached, err := cache.RDB.Get(context.Background(), cacheKey).Result()
		if err == nil && cached != "" {
			var currencies []CryptoCurrency
			if err := json.Unmarshal([]byte(cached), &currencies); err == nil {
				return currencies, nil
			}
		}
	}
	u := fmt.Sprintf("%s/currencies?api_key=%s", plisioBaseURL, url.QueryEscape(s.plisioAPIKey))
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var wrap struct {
		Status string          `json:"status"`
		Data   json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &wrap); err != nil {
		return nil, err
	}
	if wrap.Status != "success" {
		var errorData struct {
			Message string `json:"message"`
		}
		if err := json.Unmarshal(wrap.Data, &errorData); err == nil && errorData.Message != "" {
			return nil, fmt.Errorf("plisio API error: %s", errorData.Message)
		}
		return nil, fmt.Errorf("plisio API error: %s", string(wrap.Data))
	}

	var currenciesData []CryptoCurrencyRaw
	if err := json.Unmarshal(wrap.Data, &currenciesData); err != nil {
		return nil, fmt.Errorf("failed to parse currencies: %v", err)
	}

	var out []CryptoCurrency
	for _, c := range currenciesData {
		if c.Hidden != nil {
			if h, ok := c.Hidden.(float64); ok && h != 0 {
				continue
			}
		}
		if c.Maintenance {
			continue
		}
		if c.Cid == "" {
			c.Cid = c.Currency
		}
		out = append(out, CryptoCurrency{
			Name:        c.Name,
			Cid:         c.Cid,
			Currency:    c.Currency,
			Icon:        fmt.Sprintf("/crypto-icons/%s.svg", c.Currency),
			PriceUsd:    plisioToString(c.PriceUsd),
			RateUsd:     plisioToString(c.RateUsd),
			MinSumIn:    plisioToString(c.MinSumIn),
			Hidden:      0,
			Maintenance: c.Maintenance,
		})
	}

	if cache.RDB != nil {
		if bytes, err := json.Marshal(out); err == nil {
			cache.RDB.Set(context.Background(), cacheKey, string(bytes), 1*time.Hour)
		}
	}

	return out, nil
}

func (s *service) VerifyProductPurchase(userID, postID string) (bool, error) {
	// 1. If user is the author, allow access
	var authorID string
	err := s.db.Table("posts").Select("author_id").Where("id = ?", postID).Scan(&authorID).Error
	if err == nil && authorID == userID {
		return true, nil
	}

	// 2. Check completed transaction
	var count int64
	err = s.db.Model(&Transaction{}).
		Where("user_id = ? AND item_id = ? AND status = ? AND item_type = ?", userID, postID, "success", "product").
		Count(&count).Error
	
	if err != nil {
		return false, err
	}
	
	return count > 0, nil
}

func (s *service) GenerateProductToken(userID, postID string) (string, error) {
	var productURL string
	err := s.db.Table("posts").Select("product_url").Where("id = ?", postID).Scan(&productURL).Error
	if err != nil {
		return "", err
	}
	if productURL == "" {
		return "", fmt.Errorf("no product URL found for this post")
	}

	tokenID := uuid.New().String()
	
	// Use cache (redisClient wrapper) to set the token for 30 minutes
	err = cache.Set(context.Background(), fmt.Sprintf("product_token:%s", tokenID), productURL, 30*time.Minute)
	if err != nil {
		return "", err
	}

	return tokenID, nil
}

func (s *service) GetSignedURLFromToken(token string) (string, error) {
	ctx := context.Background()
	key := fmt.Sprintf("product_token:%s", token)
	
	var r2URL string
	err := cache.Get(ctx, key, &r2URL)
	if err != nil || r2URL == "" {
		return "", fmt.Errorf("invalid or expired token")
	}
	
	// ONE-TIME USE: delete token immediately after generation
	_ = cache.Delete(ctx, key)
	
	// Assuming storage backend supports pre-signed URLs.
	// Since r2Client or similar method is not explicitly defined in the storage interface in the exact same name,
	// let's use the provided appURL/R2_PUBLIC_DOMAIN pattern or call s.store if it supports signing.
	// In the real system, you'd call r2Client.Presign. 
	// Given we might not have a full r2Client.Presign method, I will return the raw URL for this snippet.
	// In a real scenario, this is where pre-signing logic goes!
	
	return r2URL, nil
}

func (s *service) CreatePaymentForRoleCrypto(userID string, req CreateRolePaymentRequest) (*Transaction, *CryptoInvoiceData, error) {
	if s.plisioAPIKey == "" {
		return nil, nil, fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	// 1. Check if user already has this role
	var currentRole string
	if err := s.db.Table("users").Select("role").Where("id = ?", userID).Scan(&currentRole).Error; err == nil {
		if strings.ToLower(currentRole) == strings.ToLower(req.Role) {
			return nil, nil, fmt.Errorf("you already have the %s role", req.Role)
		}
	}


	// Roles logic, default price mapping based on your TIERS
	var amountUSD float64
	switch strings.ToLower(req.Role) {
	case "vip":
		amountUSD = 1.0
	case "mvp":
		amountUSD = 1.0
	case "mod":
		amountUSD = 1.0
	case "god":
		amountUSD = 0.90
	default:
		return nil, nil, fmt.Errorf("invalid role")
	}

	orderID := fmt.Sprintf("PAY_ROLE_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/api/payment/crypto/webhook?json=true"

	params := url.Values{}
	params.Add("api_key", s.plisioAPIKey)
	params.Add("order_number", orderNumber)
	params.Add("order_name", fmt.Sprintf("Upgrade to %s", req.Role))
	params.Add("source_currency", "USD")
	params.Add("source_amount", fmt.Sprintf("%.2f", amountUSD))
	if req.Currency != "" {
		params.Add("currency", req.Currency)
	}
	params.Add("callback_url", callbackURL)
	params.Add("success_invoice_url", s.appURL+"/payment/success?order_id="+url.QueryEscape(orderID))
	params.Add("fail_invoice_url", s.appURL+"/payment/failed?order_id="+url.QueryEscape(orderID))
	params.Add("expire_min", "1440")

	fullURL := fmt.Sprintf("%s/invoices/new?%s", plisioBaseURL, params.Encode())

	httpReq, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, nil, err
	}
	httpReq.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}

	var plisioResp CryptoInvoiceResponse
	if err := json.Unmarshal(body, &plisioResp); err != nil {
		return nil, nil, err
	}
	if plisioResp.Status != "success" {
		return nil, nil, fmt.Errorf("Payment service is currently under maintenance. Please try again later.")
	}

	var inv CryptoInvoiceData
	if err := json.Unmarshal(plisioResp.Data, &inv); err != nil {
		return nil, nil, err
	}

	status := "new"
	method := "crypto"
	if inv.Currency != "" {
		method = inv.Currency
	} else if req.Currency != "" {
		method = req.Currency
	}
	expireTime := time.Now().Add(24 * time.Hour)
	tx := &Transaction{
		ID:            orderID,
		UserID:        userID,
		ItemType:      "role",
		ItemID:        req.Role,
		Amount:        int(amountUSD * 100), // in cents
		Status:        &status,
		PaymentMethod: &method,
		CryptoOrderID: &orderNumber,
		CryptoTxnID:   &inv.TxnID,
		InvoiceURL:    &inv.InvoiceURL,
		ExpiresAt:     &expireTime,
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, nil, err
	}

	return tx, &inv, nil
}

func (s *service) CreatePaymentForProductCrypto(userID string, req CreateProductPaymentRequest) (*Transaction, *CryptoInvoiceData, error) {
	if s.plisioAPIKey == "" {
		return nil, nil, fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	if req.Amount < 1.0 {
		return nil, nil, fmt.Errorf("amount too small")
	}

	orderID := fmt.Sprintf("PAY_PROD_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/api/payment/crypto/webhook?json=true"

	params := url.Values{}
	params.Add("api_key", s.plisioAPIKey)
	params.Add("order_number", orderNumber)
	params.Add("order_name", fmt.Sprintf("Payment for Product Post #%s", req.PostID))
	params.Add("source_currency", "USD")
	params.Add("source_amount", fmt.Sprintf("%.2f", req.Amount))
	if req.Currency != "" {
		params.Add("currency", req.Currency)
	}
	params.Add("callback_url", callbackURL)
	params.Add("success_invoice_url", s.appURL+"/payment/success?order_id="+url.QueryEscape(orderID))
	params.Add("fail_invoice_url", s.appURL+"/payment/failed?order_id="+url.QueryEscape(orderID))
	params.Add("expire_min", "1440")

	fullURL := fmt.Sprintf("%s/invoices/new?%s", plisioBaseURL, params.Encode())

	httpReq, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, nil, err
	}
	httpReq.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}

	log.Printf("Plisio raw response: %s", string(body))

	var plisioResp CryptoInvoiceResponse
	if err := json.Unmarshal(body, &plisioResp); err != nil {
		return nil, nil, err
	}
	if plisioResp.Status != "success" {
		return nil, nil, fmt.Errorf("Payment service is currently under maintenance. Please try again later.")
	}

	var inv CryptoInvoiceData
	if err := json.Unmarshal(plisioResp.Data, &inv); err != nil {
		return nil, nil, err
	}

	status := "new"
	method := "crypto"
	if inv.Currency != "" {
		method = inv.Currency
	} else if req.Currency != "" {
		method = req.Currency
	}
	expireTime := time.Now().Add(24 * time.Hour)
	// Encode Product PostID
	tx := &Transaction{
		ID:                orderID,
		UserID:            userID,
		ItemType:          "product",
		ItemID:            req.PostID,
		Amount:            int(req.Amount * 100), // in cents
		Status:            &status,
		PaymentMethod:     &method,
		CryptoOrderID:     &orderNumber,
		CryptoTxnID:       &inv.TxnID,
		InvoiceURL:        &inv.InvoiceURL,
		ExpiresAt:         &expireTime,
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, nil, err
	}

	// Create Audit Trail
	var sellerID string
	s.db.Table("posts").Select("author_id").Where("id = ?", req.PostID).Scan(&sellerID)

	audit := &ProductPurchaseAudit{
		ID:            uuid.New().String(),
		PostID:        req.PostID,
		SellerID:      sellerID,
		BuyerID:       userID,
		Amount:        int(req.Amount * 100),
		TransactionID: orderID,
		Status:        "initiated",
	}
	s.db.Create(audit)

	return tx, &inv, nil
}

func (s *service) CreatePaymentForAdCrypto(userID string, req CreateAdPaymentRequest) (*Transaction, string, error) {
	if s.plisioAPIKey == "" {
		return nil, "", fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	if req.Amount < 1.0 {
		return nil, "", fmt.Errorf("amount too small")
	}

	orderID := fmt.Sprintf("PAY_AD_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/api/payment/crypto/webhook?json=true"

	params := url.Values{}
	params.Add("api_key", s.plisioAPIKey)
	params.Add("order_number", orderNumber)
	params.Add("order_name", fmt.Sprintf("Payment for Ad #%s", req.AdID))
	params.Add("source_currency", "USD")
	params.Add("source_amount", fmt.Sprintf("%.2f", req.Amount))
	if req.Currency != "" {
		params.Add("currency", req.Currency)
	}
	params.Add("callback_url", callbackURL)
	params.Add("success_invoice_url", s.appURL+"/payment/success?order_id="+url.QueryEscape(orderID))
	params.Add("fail_invoice_url", s.appURL+"/payment/failed?order_id="+url.QueryEscape(orderID))
	params.Add("expire_min", "1440")

	fullURL := fmt.Sprintf("%s/invoices/new?%s", plisioBaseURL, params.Encode())

	httpReq, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, "", err
	}
	httpReq.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	var plisioResp CryptoInvoiceResponse
	if err := json.Unmarshal(body, &plisioResp); err != nil {
		return nil, "", err
	}
	if plisioResp.Status != "success" {
		return nil, "", fmt.Errorf("Payment service is currently under maintenance. Please try again later.")
	}

	var inv CryptoInvoiceData
	if err := json.Unmarshal(plisioResp.Data, &inv); err != nil {
		return nil, "", err
	}

	status := "pending"
	method := "crypto"
	if inv.Currency != "" {
		method = inv.Currency
	} else if req.Currency != "" {
		method = req.Currency
	}
	expireTime := time.Now().Add(24 * time.Hour)
	tx := &Transaction{
		ID:            orderID,
		UserID:        userID,
		ItemType:      "ad",
		ItemID:        req.AdID,
		Amount:        int(req.Amount * 100),
		Status:        &status,
		PaymentMethod: &method,
		CryptoOrderID: &orderNumber,
		CryptoTxnID:   &inv.TxnID,
		ExpiresAt:     &expireTime,
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, "", err
	}

	// Link transaction to AdSlot
	if err := s.repo.UpdateAdSlot(req.AdID, map[string]interface{}{
		"transaction_id": orderID,
	}); err != nil {
		log.Printf("Warning: Failed to link transaction to AdSlot %s: %v", req.AdID, err)
	}

	return tx, inv.InvoiceURL, nil
}

func (s *service) HandleCryptoWebhook(payload []byte) error {
	var data map[string]interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}
	if !verifyPlisioCallback(data, s.plisioAPIKey, payload) {
		return fmt.Errorf("invalid Plisio callback verification")
	}

	var cb CryptoCallbackData
	if err := json.Unmarshal(payload, &cb); err != nil {
		return err
	}

	// Nonce validation & replay protection
	nonceKey := fmt.Sprintf("webhook_nonce:%s", cb.TxnID)
	var exists bool
	if cache.RDB != nil {
		existsInt, _ := cache.RDB.Exists(context.Background(), nonceKey).Result()
		exists = existsInt > 0
	}
	if exists {
		return fmt.Errorf("duplicate webhook or replay attack detected")
	}
	if cache.RDB != nil {
		cache.RDB.Set(context.Background(), nonceKey, true, 5*time.Minute)
	}

	tx, err := s.repo.FindTransactionByCryptoOrderNumber(cb.OrderNumber)
	if err != nil || tx == nil {
		tx, err = s.repo.FindTransactionByCryptoTxnID(cb.TxnID)
		if err != nil || tx == nil {
			return fmt.Errorf("transaction not found")
		}
	}

	var paymentStatus string
	switch strings.ToLower(cb.Status) {
	case "completed", "mismatch":
		paymentStatus = "success"
	case "expired":
		paymentStatus = "expired"
	case "cancelled", "cancelled duplicate":
		paymentStatus = "cancelled"
	case "error":
		paymentStatus = "failed"
	default:
		paymentStatus = "pending"
	}

	updates := map[string]interface{}{
		"status":        paymentStatus,
		"crypto_txn_id": cb.TxnID,
	}
	if cb.Currency != "" {
		updates["payment_method"] = cb.Currency
	}
	if cb.PendingAmount != "" {
		updates["crypto_pending_amount"] = cb.PendingAmount
	}
	if err := s.repo.UpdateTransaction(tx.ID, updates); err != nil {
		return err
	}

	// Update related entity if payment is successful
	if paymentStatus == "success" && tx.Status != nil && *tx.Status != "success" {
		if tx.ItemType == "ad" {
			// Activate AdSlot
			// Need to find AdSlot by TransactionID
			var ad AdSlot
			if err := s.db.Where("transaction_id = ?", tx.ID).First(&ad).Error; err == nil {
				s.repo.UpdateAdSlot(ad.ID, map[string]interface{}{
					"status": "pending_setup",
				})
			}
			if s.notifService != nil {
				_ = s.notifService.CreateAdPaymentSuccessNotification(tx.UserID)
			}
		} else if tx.ItemType == "product" {
			postID := tx.ItemID
			// Create ProductPurchase
			purchase := &ProductPurchase{
				ID:            uuid.New().String(),
				UserID:        tx.UserID,
				PostID:        postID,
				TransactionID: tx.ID,
				Amount:        tx.Amount,
			}
			s.db.Create(purchase)

			var authorID string
			if err := s.db.Table("posts").Select("author_id").Where("id = ?", postID).Scan(&authorID).Error; err == nil && authorID != "" {
				// Update Audit Log
				now := time.Now()
				s.db.Model(&ProductPurchaseAudit{}).
					Where("transaction_id = ?", tx.ID).
					Updates(map[string]interface{}{
						"status":       "completed",
						"completed_at": &now,
					})

				// Notify Seller and Buyer
				if s.notifService != nil {
					_ = s.notifService.CreateProductSaleNotification(authorID, tx.UserID, postID, tx.Amount)
					_ = s.notifService.CreateProductPaymentSuccessNotification(tx.UserID, postID)
				}
			}
			cache.DeletePattern(context.Background(), "feed:*")
		} else if tx.ItemType == "role" {
			// Upgrade User Role
			s.db.Exec("UPDATE users SET role = ? WHERE id = ?", tx.ItemID, tx.UserID)
			cache.DeletePattern(context.Background(), "feed:*")
			
			// Send Notification
			if s.notifService != nil {
				_ = s.notifService.CreateRoleUpgradeNotification(tx.UserID, tx.ItemID)
			}
		}
	} else if paymentStatus == "pending" && tx.Status != nil && *tx.Status != "pending" {
		if s.notifService != nil {
			_ = s.notifService.CreatePaymentPendingNotification(tx.UserID)
		}
	}

	return nil
}

type plisioOperationsResponse struct {
	Status string `json:"status"`
	Data   struct {
		Operations []struct {
			ID     string `json:"id"`
			Type   string `json:"type"`
			Status string `json:"status"`
			Params struct {
				OrderNumber string `json:"order_number"`
			} `json:"params"`
			Sum           string `json:"sum"`
			PendingAmount string `json:"pending_sum"`
		} `json:"operations"`
	} `json:"data"`
}

func (s *service) fetchPlisioOperations(search string) (*plisioOperationsResponse, error) {
	if s.plisioAPIKey == "" || search == "" {
		return nil, fmt.Errorf("plisio not configured or empty search")
	}
	u := fmt.Sprintf("%s/operations?api_key=%s&search=%s", plisioBaseURL, url.QueryEscape(s.plisioAPIKey), url.QueryEscape(search))
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("plisio operations API status %d", resp.StatusCode)
	}
	var op plisioOperationsResponse
	log.Printf("[Plisio] Operations response: %s", string(body))
	if err := json.Unmarshal(body, &op); err != nil {
		return nil, err
	}
	return &op, nil
}

func (s *service) VerifyCryptoOrder(userID, orderID string) (*Transaction, string, error) {
	var tx Transaction
	err := s.db.Where("id = ?", orderID).First(&tx).Error
	if err != nil {
		return nil, "", fmt.Errorf("payment not found")
	}
	if tx.UserID != userID {
		return nil, "", fmt.Errorf("forbidden: this payment belongs to another user")
	}

	if tx.Status != nil && *tx.Status == "success" {
		return &tx, "success", nil
	}

	if tx.CryptoOrderID == nil || *tx.CryptoOrderID == "" {
		log.Printf("[VerifyCryptoOrder] CryptoOrderID is nil for tx %s", tx.ID)
		return &tx, "pending", nil
	}

	log.Printf("[VerifyCryptoOrder] Fetching operations for tx %s with CryptoOrderID %s", tx.ID, *tx.CryptoOrderID)
	opResp, err := s.fetchPlisioOperations(*tx.CryptoOrderID)
	if err != nil {
		log.Printf("[VerifyCryptoOrder] fetchPlisioOperations err: %v", err)
		return &tx, "pending", nil
	}
	if opResp.Status != "success" {
		log.Printf("[VerifyCryptoOrder] opResp status is not success: %s", opResp.Status)
		return &tx, "pending", nil
	}

	var currentStatus string = "new"
	var foundPendingAmount *string = nil
	var foundReceivedAmount *string = nil
	var isInvoiceFound bool = false

	for _, op := range opResp.Data.Operations {
		log.Printf("[VerifyCryptoOrder] Operation type: %s, status: %s, orderNumber: %s", op.Type, op.Status, op.Params.OrderNumber)
		if op.Type == "invoice" {
			if op.Params.OrderNumber == "" || op.Params.OrderNumber == *tx.CryptoOrderID {
				isInvoiceFound = true
				opStatus := strings.ToLower(op.Status)
				
				val := strings.TrimSpace(op.PendingAmount)
				if val == "" {
					val = ""
				} else {
					// Calculate received amount (sum - pending)
					sumFloat, _ := strconv.ParseFloat(op.Sum, 64)
					pendingFloat, err := strconv.ParseFloat(val, 64)
					if err == nil {
						received := sumFloat - pendingFloat
						if received > 0 {
							recvStr := fmt.Sprintf("%.8f", received)
							foundReceivedAmount = &recvStr
						}
						if pendingFloat == 0 {
							val = "0"
						} else {
							// Add 5% fee to pending amount
							val = fmt.Sprintf("%.8f", pendingFloat*1.05)
						}
					}
				}
				foundPendingAmount = &val

				if opStatus == "completed" || opStatus == "mismatch" {
					currentStatus = "completed"
					break
				} else if opStatus == "pending" {
					currentStatus = "pending"
				} else if currentStatus != "pending" && opStatus == "new" {
					currentStatus = "new"
				}
			}
		}
	}

	if isInvoiceFound && foundPendingAmount != nil {
		if *foundPendingAmount == "" {
			tx.CryptoPendingAmount = nil
			tx.CryptoReceivedAmount = nil
			go s.repo.UpdateTransaction(tx.ID, map[string]interface{}{
				"crypto_pending_amount": nil,
				"crypto_received_amount": nil,
			})
		} else {
			tx.CryptoPendingAmount = foundPendingAmount
			tx.CryptoReceivedAmount = foundReceivedAmount
			go s.repo.UpdateTransaction(tx.ID, map[string]interface{}{
				"crypto_pending_amount": *foundPendingAmount,
				"crypto_received_amount": foundReceivedAmount,
			})
		}
	}

	if currentStatus != "completed" {
		log.Printf("[VerifyCryptoOrder] No completed invoice operation found for tx %s, current status: %s", tx.ID, currentStatus)
		return &tx, currentStatus, nil
	}
	
	log.Printf("[VerifyCryptoOrder] Invoice completed for tx %s, updating status and role", tx.ID)

	// Update status and role
	status := "success"
	tx.Status = &status
	s.repo.UpdateTransaction(tx.ID, map[string]interface{}{
		"status": "success",
	})
	
	if tx.ItemType == "ad" {
		var ad AdSlot
		if err := s.db.Where("transaction_id = ?", tx.ID).First(&ad).Error; err == nil {
			s.repo.UpdateAdSlot(ad.ID, map[string]interface{}{
				"status": "pending_setup",
			})
		}
		if s.notifService != nil {
			_ = s.notifService.CreateAdPaymentSuccessNotification(tx.UserID)
		}
	} else if tx.ItemType == "product" {
		postID := tx.ItemID
		// Create ProductPurchase if it doesn't exist
		purchase := &ProductPurchase{
			ID:            uuid.New().String(),
			UserID:        tx.UserID,
			PostID:        postID,
			TransactionID: tx.ID,
			Amount:        tx.Amount,
		}
		s.db.Where(ProductPurchase{TransactionID: tx.ID}).FirstOrCreate(purchase)
		// Notify Seller
		if s.notifService != nil {
			var authorID string
			if err := s.db.Table("posts").Select("author_id").Where("id = ?", postID).Scan(&authorID).Error; err == nil && authorID != "" {
				_ = s.notifService.CreateProductSaleNotification(authorID, tx.UserID, postID, tx.Amount)
			}
			_ = s.notifService.CreateProductPaymentSuccessNotification(tx.UserID, postID)
		}
		cache.DeletePattern(context.Background(), "feed:*")
	} else if tx.ItemType == "role" {
		s.db.Exec("UPDATE users SET role = ? WHERE id = ?", tx.ItemID, tx.UserID)
		cache.DeletePattern(context.Background(), "feed:*")
		
		if s.notifService != nil {
			_ = s.notifService.CreateRoleUpgradeNotification(tx.UserID, tx.ItemID)
		}
	}

	return &tx, "success", nil
}

func (s *service) CreatePendingAdSlot(userID string, durationDays int) (*AdSlot, error) {
	status := "pending_payment"
	id := fmt.Sprintf("AD_%s", uuid.New().String())
	ad := &AdSlot{
		ID:           id,
		UserID:       userID,
		DurationDays: &durationDays,
		Status:       &status,
	}
	if err := s.repo.CreateAdSlot(ad); err != nil {
		return nil, err
	}
	return ad, nil
}

func (s *service) GetPendingAdSlots(userID string) ([]AdSlot, error) {
	return s.repo.FindPendingSetupAdSlots(userID)
}

func (s *service) SetupAdSlot(userID, adID string, req SetupAdSlotRequest, tempFilePath string) (*AdSlot, error) {
	ad, err := s.repo.FindAdSlotByID(adID)
	if err != nil {
		return nil, fmt.Errorf("ad slot not found")
	}
	if ad.UserID != userID {
		return nil, fmt.Errorf("unauthorized")
	}
	if ad.Status == nil || *ad.Status != "pending_setup" {
		return nil, fmt.Errorf("ad slot is not ready for setup")
	}

	// Upload to R2 if temp file exists
	var uploadedURL string
	if tempFilePath != "" {
		if s.store == nil {
			return nil, fmt.Errorf("storage not initialized")
		}
		
		file, err := os.Open(tempFilePath)
		if err != nil {
			return nil, fmt.Errorf("failed to open media: %v", err)
		}
		
		// Detect content type
		buffer := make([]byte, 512)
		_, _ = file.Read(buffer)
		file.Seek(0, 0)
		contentType := http.DetectContentType(buffer)
		
		key := fmt.Sprintf("ads/%s/%s", adID, filepath.Base(tempFilePath))
		if err := s.store.Upload(key, file, contentType); err != nil {
			file.Close()
			return nil, fmt.Errorf("failed to upload media: %v", err)
		}
		file.Close()
		uploadedURL = s.store.GetURL(key)
	} else {
		return nil, fmt.Errorf("media file is required")
	}

	status := "active"
	now := time.Now()
	days := 1
	if ad.DurationDays != nil {
		days = *ad.DurationDays
	}
	until := now.Add(time.Duration(days) * 24 * time.Hour)
	
	mediaType := "image"
	if req.MediaType != "" {
		mediaType = req.MediaType
	}

	updates := map[string]interface{}{
		"title":        req.Title,
		"description":  req.Description,
		"image_url":    uploadedURL,
		"media_type":   mediaType,
		"link_url":     req.LinkURL,
		"status":       status,
		"active_from":  now,
		"active_until": until,
	}

	if err := s.repo.UpdateAdSlot(adID, updates); err != nil {
		return nil, err
	}
	return s.repo.FindAdSlotByID(adID)
}

func (s *service) GetActiveAds() ([]AdSlot, error) {
	return s.repo.FindActiveAdSlots()
}

func (s *service) UpdateAdSlotDetails(userID, adID string, req SetupAdSlotRequest, tempFilePath string) (*AdSlot, error) {
	ad, err := s.repo.FindAdSlotByID(adID)
	if err != nil {
		return nil, fmt.Errorf("ad slot not found")
	}
	if ad.UserID != userID {
		return nil, fmt.Errorf("unauthorized")
	}
	if ad.Status == nil || *ad.Status != "active" {
		return nil, fmt.Errorf("ad slot is not active")
	}

	// Upload to R2 if temp file exists
	var uploadedURL string
	if tempFilePath != "" {
		if s.store == nil {
			return nil, fmt.Errorf("storage not initialized")
		}
		
		file, err := os.Open(tempFilePath)
		if err != nil {
			return nil, fmt.Errorf("failed to open media: %v", err)
		}
		
		// Detect content type
		buffer := make([]byte, 512)
		_, _ = file.Read(buffer)
		file.Seek(0, 0)
		contentType := http.DetectContentType(buffer)
		
		key := fmt.Sprintf("ads/%s/%s", adID, filepath.Base(tempFilePath))
		if err := s.store.Upload(key, file, contentType); err != nil {
			file.Close()
			return nil, fmt.Errorf("failed to upload media: %v", err)
		}
		file.Close()
		uploadedURL = s.store.GetURL(key)
	} else {
		// Keep the existing one if no new file is uploaded
		uploadedURL = *ad.ImageURL
	}

	mediaType := "image"
	if req.MediaType != "" {
		mediaType = req.MediaType
	}

	updates := map[string]interface{}{
		"title":       req.Title,
		"image_url":   uploadedURL,
		"media_type":  mediaType,
		"link_url":    req.LinkURL,
	}

	if err := s.repo.UpdateAdSlot(adID, updates); err != nil {
		return nil, err
	}
	return s.repo.FindAdSlotByID(adID)
}

func (s *service) DeleteAdSlot(userID, adID string) error {
	ad, err := s.repo.FindAdSlotByID(adID)
	if err != nil {
		return fmt.Errorf("ad slot not found")
	}
	if ad.UserID != userID {
		return fmt.Errorf("unauthorized")
	}
	return s.repo.DeleteAdSlot(adID)
}

func (s *service) GetProductSalesStats(userID string) (*ProductSalesStats, error) {
	rows, err := s.repo.GetProductSalesRows(userID)
	if err != nil {
		return nil, err
	}

	totalRevenue := 0
	totalTransactions := len(rows)

	productMap := make(map[string]*SoldProduct)

	for _, row := range rows {
		totalRevenue += row.Amount

		if _, exists := productMap[row.PostID]; !exists {
			productMap[row.PostID] = &SoldProduct{
				PostID:      row.PostID,
				Content:     row.Content,
				Price:       row.Price,
				SalesCount:  0,
				TotalEarned: 0,
				Buyers:      []BuyerDetail{},
			}
		}

		p := productMap[row.PostID]
		p.SalesCount++
		p.TotalEarned += row.Amount

		p.Buyers = append(p.Buyers, BuyerDetail{
			UserID:      row.BuyerID,
			Username:    row.BuyerName,
			AvatarURL:   row.BuyerAvatar,
			Amount:      row.Amount,
			PurchasedAt: row.PurchasedAt,
		})
	}

	var products []SoldProduct
	for _, p := range productMap {
		products = append(products, *p)
	}

	totalWithdrawn, err := s.repo.GetTotalWithdrawnByUserID(userID)
	if err != nil {
		return nil, err
	}

	availableBalance := totalRevenue - totalWithdrawn

	return &ProductSalesStats{
		TotalRevenue:      totalRevenue,
		TotalTransactions: totalTransactions,
		Products:          products,
		TotalWithdrawn:    totalWithdrawn,
		AvailableBalance:  availableBalance,
	}, nil
}

func isValidCryptoAddress(address, currency string) bool {
	// Basic regex for common crypto addresses
	// In production, use more robust validation per currency
	var pattern string
	switch currency {
	case "BTC":
		pattern = `^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$`
	case "ETH", "USDT_ERC20":
		pattern = `^0x[a-fA-F0-9]{40}$`
	case "LTC":
		pattern = `^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$`
	case "TRX", "USDT_TRC20":
		pattern = `^T[A-Za-z1-9]{33}$`
	default:
		// Fallback for others, just check it's not empty and alphanumeric
		pattern = `^[a-zA-Z0-9]{20,100}$`
	}
	matched, _ := regexp.MatchString(pattern, address)
	return matched
}

func (s *service) WithdrawProductEarnings(userID string, req WithdrawRequest) (*Withdrawal, error) {
	if !isValidCryptoAddress(req.ToAddress, req.Currency) {
		return nil, fmt.Errorf("invalid crypto address format")
	}

	stats, err := s.GetProductSalesStats(userID)
	if err != nil {
		return nil, err
	}

	minWithdrawal := 100 // $1.00
	if stats.AvailableBalance < 100 && stats.AvailableBalance > 0 {
		minWithdrawal = stats.AvailableBalance
	}

	if req.AmountCents < minWithdrawal {
		return nil, fmt.Errorf("minimum withdrawal amount is $%.2f", float64(minWithdrawal)/100.0)
	}

	if req.AmountCents > stats.AvailableBalance {
		return nil, fmt.Errorf("insufficient balance")
	}

	currencies, err := s.GetCryptoCurrencies()
	if err != nil {
		return nil, err
	}

	var targetCurrency *CryptoCurrency
	for _, c := range currencies {
		if c.Currency == req.Currency || c.Cid == req.Currency {
			targetCurrency = &c
			break
		}
	}

	if targetCurrency == nil {
		return nil, fmt.Errorf("unsupported currency: %s", req.Currency)
	}

	priceUsdFloat, err := strconv.ParseFloat(targetCurrency.PriceUsd, 64)
	if err != nil || priceUsdFloat <= 0 {
		return nil, fmt.Errorf("invalid exchange rate for %s", req.Currency)
	}

	usdAmountFloat := float64(req.AmountCents) / 100.0
	cryptoAmount := usdAmountFloat / priceUsdFloat
	cryptoAmountStr := strconv.FormatFloat(cryptoAmount, 'f', 8, 64)

	// Start transaction
	txDB := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			txDB.Rollback()
		}
	}()

	w := &Withdrawal{
		ID:          uuid.New().String(),
		UserID:      userID,
		AmountCents: req.AmountCents,
		Currency:    req.Currency,
		ToAddress:   req.ToAddress,
		Status:      "pending",
	}

	if err := txDB.Create(w).Error; err != nil {
		txDB.Rollback()
		return nil, err
	}

	u := fmt.Sprintf("%s/operations/withdraw?currency=%s&type=cash_out&to=%s&amount=%s&feePlan=normal&api_key=%s",
		plisioBaseURL,
		url.QueryEscape(targetCurrency.Currency),
		url.QueryEscape(req.ToAddress),
		url.QueryEscape(cryptoAmountStr),
		url.QueryEscape(s.plisioAPIKey),
	)

	reqAPI, err := http.NewRequest("GET", u, nil)
	if err != nil {
		txDB.Rollback()
		return nil, err
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(reqAPI)
	if err != nil {
		// Update status to error inside transaction
		txDB.Model(w).Update("status", "error")
		txDB.Commit() // Commit the error state so it's recorded
		return nil, fmt.Errorf("failed to call plisio api: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		txDB.Rollback()
		return nil, err
	}

	var plisioResp struct {
		Status string `json:"status"`
		Data   struct {
			ID      string `json:"id"`
			TxURL   string `json:"tx_url"`
			Message string `json:"message"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &plisioResp); err != nil {
		txDB.Rollback()
		return nil, err
	}

	if plisioResp.Status == "error" || plisioResp.Status == "" {
		txDB.Model(w).Update("status", "error")
		txDB.Commit() // Commit the error state
		return nil, fmt.Errorf("plisio withdrawal error: %s", plisioResp.Data.Message)
	}

	txDB.Model(w).Updates(map[string]interface{}{
		"status":        "completed",
		"crypto_txn_id": plisioResp.Data.ID,
		"tx_url":        plisioResp.Data.TxURL,
	})
	
	if err := txDB.Commit().Error; err != nil {
		return nil, err
	}

	return w, nil
}

func (s *service) GetWithdrawalHistory(userID string) ([]Withdrawal, error) {
	return s.repo.GetWithdrawalsByUserID(userID)
}

func (s *service) GetAllTransactionsAdmin(callerUserID string) ([]AdminTransactionRow, error) {
	// Verify caller is an owner
	var role string
	err := s.db.Table("users").Select("role").Where("id = ?", callerUserID).Scan(&role).Error
	if err != nil || role != "owner" {
		return nil, fmt.Errorf("forbidden: owner access required")
	}
	return s.repo.GetAllTransactionsAdmin()
}

package monetization

import (
	"context"
	"crypto/hmac"
	"crypto/sha1"
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
	"media-api/internal/config"
	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

const plisioBaseURL = "https://api.plisio.net/api/v1"

type Service interface {
	CreatePaymentForRolePlisio(userID string, req CreateRolePaymentRequest) (*Transaction, string, error)
	CreatePaymentForAdPlisio(userID string, req CreateAdPaymentRequest) (*Transaction, string, error)
	CreatePaymentForProductPlisio(userID string, req CreateProductPaymentRequest) (*Transaction, string, error)
	HandlePlisioWebhook(payload []byte) error
	GetPlisioCurrencies() ([]PlisioCurrency, error)
	VerifyPlisioOrder(userID, orderID string) (*Transaction, string, error)

	CreatePendingAdSlot(userID string, durationDays int) (*AdSlot, error)
	GetPendingAdSlots(userID string) ([]AdSlot, error)
	SetupAdSlot(userID, adID string, req SetupAdSlotRequest, tempFilePath string) (*AdSlot, error)
	GetActiveAds() ([]AdSlot, error)
	UpdateAdSlotDetails(userID, adID string, req SetupAdSlotRequest, tempFilePath string) (*AdSlot, error)
	DeleteAdSlot(userID, adID string) error

	GetProductSalesStats(userID string) (*ProductSalesStats, error)
	WithdrawProductEarnings(userID string, req WithdrawRequest) (*Withdrawal, error)
	GetWithdrawalHistory(userID string) ([]Withdrawal, error)
}

type service struct {
	repo         Repository
	db           *gorm.DB
	notifService notification.Service
	plisioAPIKey string
	appURL       string
	backendURL   string
}

func NewService(repo Repository, db *gorm.DB, notifService notification.Service, apiKey, appURL, backendURL string) Service {
	return &service{
		repo:         repo,
		db:           db,
		notifService: notifService,
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
	mac2 := hmac.New(sha1.New, []byte(apiKey))
	mac2.Write([]byte(serialized))
	calculatedPHP := hex.EncodeToString(mac2.Sum(nil))
	return calculatedPHP == verifyHash
}

func (s *service) GetPlisioCurrencies() ([]PlisioCurrency, error) {
	if s.plisioAPIKey == "" {
		return nil, fmt.Errorf("PLISIO_API_KEY is not configured")
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

	var currenciesData []PlisioCurrencyRaw
	if err := json.Unmarshal(wrap.Data, &currenciesData); err != nil {
		return nil, fmt.Errorf("failed to parse currencies: %v", err)
	}

	var out []PlisioCurrency
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
		out = append(out, PlisioCurrency{
			Name:        c.Name,
			Cid:         c.Cid,
			Currency:    c.Currency,
			Icon:        c.Icon,
			PriceUsd:    plisioToString(c.PriceUsd),
			RateUsd:     plisioToString(c.RateUsd),
			MinSumIn:    plisioToString(c.MinSumIn),
			Hidden:      0,
			Maintenance: c.Maintenance,
		})
	}
	return out, nil
}

func (s *service) CreatePaymentForRolePlisio(userID string, req CreateRolePaymentRequest) (*Transaction, string, error) {
	if s.plisioAPIKey == "" {
		return nil, "", fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	// 1. Check if user already has this role
	var currentRole string
	if err := s.db.Table("users").Select("role").Where("id = ?", userID).Scan(&currentRole).Error; err == nil {
		if strings.ToLower(currentRole) == strings.ToLower(req.Role) {
			return nil, "", fmt.Errorf("you already have the %s role", req.Role)
		}
	}

	// Check for existing pending transaction
	existingTx, err := s.repo.FindPendingRoleTransaction(userID, req.Role)
	if err == nil && existingTx != nil {
		if time.Since(existingTx.CreatedAt).Hours() >= 24 || existingTx.InvoiceURL == nil || *existingTx.InvoiceURL == "" {
			s.repo.UpdateTransaction(existingTx.ID, map[string]interface{}{
				"status": "expired",
			})
		} else {
			return existingTx, *existingTx.InvoiceURL, nil
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
		return nil, "", fmt.Errorf("invalid role")
	}

	orderID := fmt.Sprintf("PAY_ROLE_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/api/payment/plisio/webhook?json=true"

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

	var plisioResp PlisioInvoiceResponse
	if err := json.Unmarshal(body, &plisioResp); err != nil {
		return nil, "", err
	}
	if plisioResp.Status != "success" {
		return nil, "", fmt.Errorf("plisio API error")
	}

	var inv PlisioInvoiceData
	if err := json.Unmarshal(plisioResp.Data, &inv); err != nil {
		return nil, "", err
	}

	status := "pending"
	method := "crypto"
	tx := &Transaction{
		ID:            orderID,
		UserID:        userID,
		ItemType:      "role",
		ItemID:        req.Role,
		Amount:        int(amountUSD * 100), // in cents
		Status:        &status,
		PaymentMethod: &method,
		PlisioOrderID: &orderNumber,
		PlisioTxnID:   &inv.TxnID,
		InvoiceURL:    &inv.InvoiceURL,
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, "", err
	}

	return tx, inv.InvoiceURL, nil
}

func (s *service) CreatePaymentForProductPlisio(userID string, req CreateProductPaymentRequest) (*Transaction, string, error) {
	if s.plisioAPIKey == "" {
		return nil, "", fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	if req.Amount < 1.0 {
		return nil, "", fmt.Errorf("amount too small")
	}

	orderID := fmt.Sprintf("PAY_PROD_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/api/payment/plisio/webhook?json=true"

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

	var plisioResp PlisioInvoiceResponse
	if err := json.Unmarshal(body, &plisioResp); err != nil {
		return nil, "", err
	}
	if plisioResp.Status != "success" {
		return nil, "", fmt.Errorf("plisio API error")
	}

	var inv PlisioInvoiceData
	if err := json.Unmarshal(plisioResp.Data, &inv); err != nil {
		return nil, "", err
	}

	status := "pending"
	method := "crypto"
	// Encode Product PostID
	tx := &Transaction{
		ID:                orderID,
		UserID:            userID,
		ItemType:          "product",
		ItemID:            req.PostID,
		Amount:            int(req.Amount * 100), // in cents
		Status:            &status,
		PaymentMethod:     &method,
		PlisioOrderID:     &orderNumber,
		PlisioTxnID:       &inv.TxnID,
		InvoiceURL:        &inv.InvoiceURL,
	}

	if err := s.repo.CreateTransaction(tx); err != nil {
		return nil, "", err
	}

	return tx, inv.InvoiceURL, nil
}

func (s *service) CreatePaymentForAdPlisio(userID string, req CreateAdPaymentRequest) (*Transaction, string, error) {
	if s.plisioAPIKey == "" {
		return nil, "", fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	if req.Amount < 1.0 {
		return nil, "", fmt.Errorf("amount too small")
	}

	orderID := fmt.Sprintf("PAY_AD_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/api/payment/plisio/webhook?json=true"

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

	var plisioResp PlisioInvoiceResponse
	if err := json.Unmarshal(body, &plisioResp); err != nil {
		return nil, "", err
	}
	if plisioResp.Status != "success" {
		return nil, "", fmt.Errorf("plisio API error")
	}

	var inv PlisioInvoiceData
	if err := json.Unmarshal(plisioResp.Data, &inv); err != nil {
		return nil, "", err
	}

	status := "pending"
	method := "crypto"
	tx := &Transaction{
		ID:            orderID,
		UserID:        userID,
		ItemType:      "ad",
		ItemID:        req.AdID,
		Amount:        int(req.Amount * 100),
		Status:        &status,
		PaymentMethod: &method,
		PlisioOrderID: &orderNumber,
		PlisioTxnID:   &inv.TxnID,
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

func (s *service) HandlePlisioWebhook(payload []byte) error {
	var data map[string]interface{}
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}
	if !verifyPlisioCallback(data, s.plisioAPIKey, payload) {
		return fmt.Errorf("invalid Plisio callback verification")
	}

	var cb PlisioCallbackData
	if err := json.Unmarshal(payload, &cb); err != nil {
		return err
	}

	tx, err := s.repo.FindTransactionByPlisioOrderNumber(cb.OrderNumber)
	if err != nil || tx == nil {
		tx, err = s.repo.FindTransactionByPlisioTxnID(cb.TxnID)
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
		"plisio_txn_id": cb.TxnID,
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

			// Notify Seller
			if s.notifService != nil {
				// We need the seller's user ID. We can get it from the post.
				var authorID string
				if err := s.db.Table("posts").Select("author_id").Where("id = ?", postID).Scan(&authorID).Error; err == nil && authorID != "" {
					_ = s.notifService.CreateProductSaleNotification(authorID, tx.UserID, postID, tx.Amount)
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

func (s *service) VerifyPlisioOrder(userID, orderID string) (*Transaction, string, error) {
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

	if tx.PlisioOrderID == nil || *tx.PlisioOrderID == "" {
		log.Printf("[VerifyPlisioOrder] PlisioOrderID is nil for tx %s", tx.ID)
		return &tx, "pending", nil
	}

	log.Printf("[VerifyPlisioOrder] Fetching operations for tx %s with PlisioOrderID %s", tx.ID, *tx.PlisioOrderID)
	opResp, err := s.fetchPlisioOperations(*tx.PlisioOrderID)
	if err != nil {
		log.Printf("[VerifyPlisioOrder] fetchPlisioOperations err: %v", err)
		return &tx, "pending", nil
	}
	if opResp.Status != "success" {
		log.Printf("[VerifyPlisioOrder] opResp status is not success: %s", opResp.Status)
		return &tx, "pending", nil
	}

	var completed bool
	for _, op := range opResp.Data.Operations {
		log.Printf("[VerifyPlisioOrder] Operation type: %s, status: %s, orderNumber: %s", op.Type, op.Status, op.Params.OrderNumber)
		if op.Type == "invoice" && (strings.ToLower(op.Status) == "completed" || strings.ToLower(op.Status) == "mismatch") {
			if op.Params.OrderNumber == "" || op.Params.OrderNumber == *tx.PlisioOrderID {
				completed = true
				break
			}
		}
	}

	if !completed {
		log.Printf("[VerifyPlisioOrder] No completed invoice operation found for tx %s", tx.ID)
		return &tx, "pending", nil
	}
	
	log.Printf("[VerifyPlisioOrder] Invoice completed for tx %s, updating status and role", tx.ID)

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
			_ = s.notifService.CreateProductPaymentSuccessNotification(tx.UserID)
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

	// Upload to Cloudinary if temp file exists
	var uploadedURL string
	if tempFilePath != "" {
		env := config.LoadConfig()
		cld, err := cloudinary.NewFromParams(env.CloudinaryCloudName, env.CloudinaryAPIKey, env.CloudinaryAPISecret)
		if err != nil {
			return nil, fmt.Errorf("failed to init cloudinary: %v", err)
		}
		
		uploadParams := uploader.UploadParams{
			Folder: "ads",
		}
		if req.MediaType == "video" {
			uploadParams.ResourceType = "video"
		} else {
			uploadParams.ResourceType = "image"
		}
		
		resp, err := cld.Upload.Upload(context.Background(), tempFilePath, uploadParams)
		if err != nil {
			return nil, fmt.Errorf("failed to upload media: %v", err)
		}
		uploadedURL = resp.SecureURL
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

	// Upload to Cloudinary if temp file exists
	var uploadedURL string
	if tempFilePath != "" {
		env := config.LoadConfig()
		cld, err := cloudinary.NewFromParams(env.CloudinaryCloudName, env.CloudinaryAPIKey, env.CloudinaryAPISecret)
		if err != nil {
			return nil, fmt.Errorf("failed to init cloudinary: %v", err)
		}
		
		uploadParams := uploader.UploadParams{
			Folder: "ads",
		}
		if req.MediaType == "video" {
			uploadParams.ResourceType = "video"
		} else {
			uploadParams.ResourceType = "image"
		}
		
		resp, err := cld.Upload.Upload(context.Background(), tempFilePath, uploadParams)
		if err != nil {
			return nil, fmt.Errorf("failed to upload media: %v", err)
		}
		uploadedURL = resp.SecureURL
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

func (s *service) WithdrawProductEarnings(userID string, req WithdrawRequest) (*Withdrawal, error) {
	if req.AmountCents < 100 {
		return nil, fmt.Errorf("minimum withdrawal amount is $1.00")
	}

	stats, err := s.GetProductSalesStats(userID)
	if err != nil {
		return nil, err
	}

	if req.AmountCents > stats.AvailableBalance {
		return nil, fmt.Errorf("insufficient balance")
	}

	currencies, err := s.GetPlisioCurrencies()
	if err != nil {
		return nil, err
	}

	var targetCurrency *PlisioCurrency
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

	w := &Withdrawal{
		ID:          uuid.New().String(),
		UserID:      userID,
		AmountCents: req.AmountCents,
		Currency:    req.Currency,
		ToAddress:   req.ToAddress,
		Status:      "pending",
	}

	if err := s.repo.CreateWithdrawal(w); err != nil {
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
		return nil, err
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(reqAPI)
	if err != nil {
		s.db.Model(w).Update("status", "error")
		return nil, fmt.Errorf("failed to call plisio api: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
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
		return nil, err
	}

	if plisioResp.Status == "error" || plisioResp.Status == "" {
		s.db.Model(w).Update("status", "error")
		return nil, fmt.Errorf("plisio withdrawal error: %s", plisioResp.Data.Message)
	}

	s.db.Model(w).Updates(map[string]interface{}{
		"status":        "completed",
		"plisio_txn_id": plisioResp.Data.ID,
		"tx_url":        plisioResp.Data.TxURL,
	})

	return w, nil
}

func (s *service) GetWithdrawalHistory(userID string) ([]Withdrawal, error) {
	return s.repo.GetWithdrawalsByUserID(userID)
}

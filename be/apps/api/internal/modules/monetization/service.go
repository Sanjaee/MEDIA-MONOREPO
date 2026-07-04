package monetization

import (
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
)

const plisioBaseURL = "https://api.plisio.net/api/v1"

type Service interface {
	CreatePaymentForRolePlisio(userID string, req CreateRolePaymentRequest) (*Transaction, string, error)
	CreatePaymentForAdPlisio(userID string, req CreateAdPaymentRequest) (*Transaction, string, error)
	HandlePlisioWebhook(payload []byte) error
	GetPlisioCurrencies() ([]PlisioCurrency, error)
}

type service struct {
	repo         Repository
	db           *gorm.DB
	plisioAPIKey string
	appURL       string
	backendURL   string
}

func NewService(repo Repository, db *gorm.DB, apiKey, appURL, backendURL string) Service {
	return &service{
		repo:         repo,
		db:           db,
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
		Status string              `json:"status"`
		Data   []PlisioCurrencyRaw `json:"data"`
	}
	if err := json.Unmarshal(body, &wrap); err != nil {
		return nil, err
	}
	if wrap.Status != "success" {
		return nil, fmt.Errorf("plisio API error: %s", wrap.Status)
	}

	var out []PlisioCurrency
	for _, c := range wrap.Data {
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
		amountUSD = 10.0
	case "mvp":
		amountUSD = 30.0
	case "mod":
		amountUSD = 50.0
	case "god":
		amountUSD = 100.0
	default:
		return nil, "", fmt.Errorf("invalid role")
	}

	orderID := fmt.Sprintf("PAY_ROLE_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/v1/payment/webhook?json=true"

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
		Role:          req.Role,
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

func (s *service) CreatePaymentForAdPlisio(userID string, req CreateAdPaymentRequest) (*Transaction, string, error) {
	if s.plisioAPIKey == "" {
		return nil, "", fmt.Errorf("PLISIO_API_KEY is not configured")
	}

	if req.Amount < 1.0 {
		return nil, "", fmt.Errorf("amount too small")
	}

	orderID := fmt.Sprintf("PAY_AD_%s", uuid.New().String())
	orderNumber := uuid.New().String()

	callbackURL := s.backendURL + "/v1/payment/webhook?json=true"

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
		Role:          "ad", // Mark as ad payment
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
	case "completed":
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
		if tx.Role == "ad" {
			// Activate AdSlot
			// Need to find AdSlot by TransactionID
			var ad AdSlot
			if err := s.db.Where("transaction_id = ?", tx.ID).First(&ad).Error; err == nil {
				s.repo.UpdateAdSlot(ad.ID, map[string]interface{}{
					"status": "active",
				})
			}
		} else {
			// Upgrade User Role
			s.db.Exec("UPDATE users SET role = ? WHERE id = ?", tx.Role, tx.UserID)
		}
	}

	return nil
}

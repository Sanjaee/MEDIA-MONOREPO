package monetization

import "encoding/json"

type CreateRolePaymentRequest struct {
	Role     string `json:"role" binding:"required"`
	Currency string `json:"currency"`
}

type CreateAdPaymentRequest struct {
	AdID     string  `json:"adId" binding:"required"`
	Amount   float64 `json:"amount" binding:"required"`
	Currency string  `json:"currency"`
}

type CreateProductPaymentRequest struct {
	PostID   string  `json:"postId" binding:"required"`
	Amount   float64 `json:"amount" binding:"required"`
	Currency string  `json:"currency"`
}

type CreatePendingAdRequest struct {
	DurationDays int `json:"durationDays" binding:"required"`
}

type SetupAdSlotRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl" binding:"required"`
	MediaType   string `json:"mediaType"`
	LinkURL     string `json:"linkUrl" binding:"required"`
}

// Plisio types for crypto payment
type PlisioInvoiceResponse struct {
	Status string          `json:"status"`
	Data   json.RawMessage `json:"data,omitempty"`
}

type PlisioInvoiceData struct {
	TxnID          string `json:"txn_id"`
	InvoiceURL     string `json:"invoice_url"`
	Amount         string `json:"amount,omitempty"`
	Currency       string `json:"currency,omitempty"`
	SourceCurrency string `json:"source_currency,omitempty"`
	ExpireUtc      int64  `json:"expire_utc,omitempty"`
}

type PlisioCallbackData struct {
	TxnID          string `json:"txn_id"`
	IpnType        string `json:"ipn_type"`
	OrderNumber    string `json:"order_number"`
	Status         string `json:"status"`
	Amount         string `json:"amount"`
	Currency       string `json:"currency"`
	SourceCurrency string `json:"source_currency,omitempty"`
	PsysCid        string `json:"psys_cid,omitempty"`
	ExpireUtc      string `json:"expire_utc,omitempty"`
	VerifyHash     string `json:"verify_hash"`
}

type PlisioCurrencyRaw struct {
	Name        string      `json:"name"`
	Cid         string      `json:"cid"`
	Currency    string      `json:"currency"`
	Icon        string      `json:"icon"`
	RateUsd     interface{} `json:"rate_usd"`
	PriceUsd    interface{} `json:"price_usd"`
	MinSumIn    interface{} `json:"min_sum_in"`
	Hidden      interface{} `json:"hidden"`
	Maintenance bool        `json:"maintenance"`
}

type PlisioCurrency struct {
	Name        string `json:"name"`
	Cid         string `json:"cid"`
	Currency    string `json:"currency"`
	Icon        string `json:"icon"`
	RateUsd     string `json:"rateUsd"`
	PriceUsd    string `json:"priceUsd"`
	MinSumIn    string `json:"minSumIn"`
	Hidden      int    `json:"hidden"`
	Maintenance bool   `json:"maintenance"`
}

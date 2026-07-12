package monetization

import (
	"time"
)

type Transaction struct {
	ID            string    `gorm:"primaryKey;type:varchar"`
	UserID        string    `gorm:"type:varchar;not null"`
	ItemType      string    `gorm:"type:varchar;not null;default:'role'"` // 'role', 'ad', 'product'
	ItemID        string    `gorm:"type:varchar;not null;default:''"`
	Amount        int       `gorm:"type:integer;not null"`
	Status        *string   `gorm:"type:varchar;default:'pending'"`
	PlisioOrderID *string   `gorm:"type:varchar"`
	PlisioTxnID   *string   `gorm:"type:varchar"`
	PaymentMethod *string   `gorm:"type:varchar;default:'crypto'"`
	InvoiceURL    *string   `gorm:"type:varchar"`
	CreatedAt     time.Time `gorm:"autoCreateTime;type:timestamp"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime;type:timestamp"`
}

type AdSlot struct {
	ID            string     `gorm:"primaryKey;type:varchar" json:"id"`
	UserID        string     `gorm:"type:varchar;not null" json:"userId"`
	TransactionID *string    `gorm:"type:varchar" json:"transactionId"`
	Title         *string    `gorm:"type:varchar" json:"title"`
	Description   *string    `gorm:"type:text" json:"description"`
	ImageURL      *string    `gorm:"type:text" json:"imageUrl"`
	MediaType     *string    `gorm:"type:varchar;default:'image'" json:"mediaType"`
	LinkURL       *string    `gorm:"type:text" json:"linkUrl"`
	DurationDays  *int       `gorm:"type:integer;default:1" json:"durationDays"`
	Status        *string    `gorm:"type:varchar;default:'pending_payment'" json:"status"`
	ActiveFrom    *time.Time `gorm:"type:timestamp" json:"activeFrom"`
	ActiveUntil   *time.Time `gorm:"type:timestamp" json:"activeUntil"`
	CreatedAt     time.Time  `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt"`
}

type ProductPurchase struct {
	ID            string    `gorm:"primaryKey;type:varchar" json:"id"`
	UserID        string    `gorm:"type:varchar;not null" json:"userId"`
	PostID        string    `gorm:"type:varchar;not null" json:"postId"`
	TransactionID string    `gorm:"type:varchar;not null" json:"transactionId"`
	Amount        int       `gorm:"type:integer;not null" json:"amount"`
	CreatedAt     time.Time `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
}

type Withdrawal struct {
	ID          string    `gorm:"primaryKey;type:varchar" json:"id"`
	UserID      string    `gorm:"type:varchar;not null" json:"userId"`
	AmountCents int       `gorm:"type:integer;not null" json:"amountCents"`
	Currency    string    `gorm:"type:varchar;not null" json:"currency"`
	ToAddress   string    `gorm:"type:varchar;not null" json:"toAddress"`
	Status      string    `gorm:"type:varchar;default:'pending'" json:"status"`
	PlisioTxnID *string   `gorm:"type:varchar" json:"plisioTxnId"`
	TxURL       *string   `gorm:"type:varchar" json:"txUrl"`
	CreatedAt   time.Time `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt"`
}

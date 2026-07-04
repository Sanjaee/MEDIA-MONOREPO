package monetization

import (
	"time"
)

type Transaction struct {
	ID            string    `gorm:"primaryKey;type:varchar"`
	UserID        string    `gorm:"type:varchar;not null"`
	Role          string    `gorm:"type:varchar;not null"`
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
	ID            string     `gorm:"primaryKey;type:varchar"`
	UserID        string     `gorm:"type:varchar;not null"`
	TransactionID *string    `gorm:"type:varchar"`
	Title         *string    `gorm:"type:varchar"`
	Description   *string    `gorm:"type:text"`
	ImageURL      *string    `gorm:"type:text"`
	LinkURL       *string    `gorm:"type:text"`
	Status        *string    `gorm:"type:varchar;default:'pending_payment'"`
	ActiveFrom    *time.Time `gorm:"type:timestamp"`
	ActiveUntil   *time.Time `gorm:"type:timestamp"`
	CreatedAt     time.Time  `gorm:"autoCreateTime;type:timestamp"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime;type:timestamp"`
}

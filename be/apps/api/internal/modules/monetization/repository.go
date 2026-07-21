package monetization

import (
	"time"
	"gorm.io/gorm"
)

type Repository interface {
	CreateTransaction(tx *Transaction) error
	UpdateTransaction(id string, updates map[string]interface{}) error
	FindTransactionByID(id string) (*Transaction, error)
	FindTransactionByCryptoOrderNumber(orderNumber string) (*Transaction, error)
	FindTransactionByCryptoTxnID(txnID string) (*Transaction, error)
	FindPendingRoleTransaction(userID, role string) (*Transaction, error)

	CreateAdSlot(ad *AdSlot) error
	UpdateAdSlot(id string, updates map[string]interface{}) error
	FindAdSlotByID(id string) (*AdSlot, error)
	FindPendingSetupAdSlots(userID string) ([]AdSlot, error)
	FindActiveAdSlots() ([]AdSlot, error)
	DeleteAdSlot(id string) error

	GetProductSalesRows(sellerID string) ([]ProductPurchaseRow, error)
	CreateWithdrawal(w *Withdrawal) error
	GetTotalWithdrawnByUserID(userID string) (int, error)
	GetWithdrawalsByUserID(userID string) ([]Withdrawal, error)
	GetAllTransactionsAdmin() ([]AdminTransactionRow, error)
}

type ProductPurchaseRow struct {
	PostID      string
	Content     string
	Price       int
	Amount      int
	BuyerID     string
	BuyerName   string
	BuyerAvatar string
	PurchasedAt time.Time
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db}
}

func (r *repository) CreateTransaction(tx *Transaction) error {
	return r.db.Create(tx).Error
}

func (r *repository) UpdateTransaction(id string, updates map[string]interface{}) error {
	return r.db.Model(&Transaction{}).Where("id = ?", id).Updates(updates).Error
}

func (r *repository) FindTransactionByID(id string) (*Transaction, error) {
	var tx Transaction
	err := r.db.Where("id = ?", id).First(&tx).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

// Since we store Plisio order_number in Metadata or directly if we add a column.
// Wait, the model has PlisioOrderID *string which we can use for order_number.
// And PlisioTxnID *string for txn_id.
func (r *repository) FindTransactionByCryptoOrderNumber(orderNumber string) (*Transaction, error) {
	var tx Transaction
	err := r.db.Where("crypto_order_id = ?", orderNumber).First(&tx).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *repository) FindTransactionByCryptoTxnID(txnID string) (*Transaction, error) {
	var tx Transaction
	err := r.db.Where("crypto_txn_id = ?", txnID).First(&tx).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *repository) FindPendingRoleTransaction(userID, role string) (*Transaction, error) {
	var tx Transaction
	err := r.db.Where("user_id = ? AND item_type = ? AND item_id = ? AND status = ?", userID, "role", role, "pending").Order("created_at desc").First(&tx).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *repository) CreateAdSlot(ad *AdSlot) error {
	return r.db.Create(ad).Error
}

func (r *repository) UpdateAdSlot(id string, updates map[string]interface{}) error {
	return r.db.Model(&AdSlot{}).Where("id = ?", id).Updates(updates).Error
}

func (r *repository) FindAdSlotByID(id string) (*AdSlot, error) {
	var ad AdSlot
	err := r.db.Where("id = ?", id).First(&ad).Error
	if err != nil {
		return nil, err
	}
	return &ad, nil
}

func (r *repository) FindPendingSetupAdSlots(userID string) ([]AdSlot, error) {
	var ads []AdSlot
	err := r.db.Where("user_id = ? AND status = ?", userID, "pending_setup").Order("created_at desc").Find(&ads).Error
	return ads, err
}

func (r *repository) FindActiveAdSlots() ([]AdSlot, error) {
	var ads []AdSlot
	// Active ads are those with status='active' and active_until > now()
	err := r.db.Where("status = ? AND active_until > NOW()", "active").Order("active_from desc").Find(&ads).Error
	return ads, err
}

func (r *repository) DeleteAdSlot(id string) error {
	return r.db.Delete(&AdSlot{}, "id = ?", id).Error
}

func (r *repository) GetProductSalesRows(sellerID string) ([]ProductPurchaseRow, error) {
	var rows []ProductPurchaseRow
	query := `
		SELECT 
			p.id as post_id,
			p.content,
			p.product_price as price,
			pp.amount,
			u.id as buyer_id,
			u.username as buyer_name,
			u.image as buyer_avatar,
			pp.created_at as purchased_at
		FROM product_purchases pp
		JOIN posts p ON pp.post_id = p.id
		JOIN users u ON pp.user_id = u.id
		WHERE p.author_id = ?
		ORDER BY pp.created_at DESC
	`
	err := r.db.Raw(query, sellerID).Scan(&rows).Error
	return rows, err
}

func (r *repository) CreateWithdrawal(w *Withdrawal) error {
	return r.db.Create(w).Error
}

func (r *repository) GetTotalWithdrawnByUserID(userID string) (int, error) {
	var total int
	err := r.db.Model(&Withdrawal{}).
		Where("user_id = ? AND status != ?", userID, "error").
		Select("COALESCE(SUM(amount_cents), 0)").
		Scan(&total).Error
	return total, err
}

func (r *repository) GetWithdrawalsByUserID(userID string) ([]Withdrawal, error) {
	var withdrawals []Withdrawal
	err := r.db.Where("user_id = ?", userID).Order("created_at desc").Find(&withdrawals).Error
	return withdrawals, err
}

type AdminTransactionRow struct {
	ID                   string    `json:"id"`
	UserID               string    `json:"userId"`
	Username             string    `json:"username"`
	Email                string    `json:"email"`
	ItemType             string    `json:"itemType"`
	ItemID               string    `json:"itemId"`
	Amount               int       `json:"amount"`
	Status               string    `json:"status"`
	PaymentMethod        string    `json:"paymentMethod"`
	CreatedAt            time.Time `json:"createdAt"`
	CryptoOrderID        *string   `json:"cryptoOrderId,omitempty"`
	CryptoTxnID          *string   `json:"cryptoTxnId,omitempty"`
	CryptoPendingAmount  *string   `json:"cryptoPendingAmount,omitempty"`
	CryptoReceivedAmount *string   `json:"cryptoReceivedAmount,omitempty"`
	InvoiceURL           *string   `json:"invoiceUrl,omitempty"`
}

func (r *repository) GetAllTransactionsAdmin() ([]AdminTransactionRow, error) {
	var rows []AdminTransactionRow
	query := `
		SELECT 
			t.id, 
			t.user_id, 
			u.username, 
			u.email, 
			t.item_type, 
			t.item_id, 
			t.amount, 
			COALESCE(NULLIF(t.status, ''), 'new') as status, 
			COALESCE(t.payment_method, '') as payment_method, 
			t.created_at,
			t.crypto_order_id,
			t.crypto_txn_id,
			t.crypto_pending_amount,
			t.crypto_received_amount,
			t.invoice_url
		FROM transactions t
		LEFT JOIN users u ON t.user_id = u.id
		WHERE t.item_type IN ('ad', 'product', 'role')
		ORDER BY t.created_at DESC
	`
	err := r.db.Raw(query).Scan(&rows).Error
	return rows, err
}

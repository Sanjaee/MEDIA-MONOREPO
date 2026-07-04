package monetization

import (
	"gorm.io/gorm"
)

type Repository interface {
	CreateTransaction(tx *Transaction) error
	UpdateTransaction(id string, updates map[string]interface{}) error
	FindTransactionByID(id string) (*Transaction, error)
	FindTransactionByPlisioOrderNumber(orderNumber string) (*Transaction, error)
	FindTransactionByPlisioTxnID(txnID string) (*Transaction, error)
	FindPendingRoleTransaction(userID, role string) (*Transaction, error)

	CreateAdSlot(ad *AdSlot) error
	UpdateAdSlot(id string, updates map[string]interface{}) error
	FindAdSlotByID(id string) (*AdSlot, error)
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
func (r *repository) FindTransactionByPlisioOrderNumber(orderNumber string) (*Transaction, error) {
	var tx Transaction
	err := r.db.Where("plisio_order_id = ?", orderNumber).First(&tx).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *repository) FindTransactionByPlisioTxnID(txnID string) (*Transaction, error) {
	var tx Transaction
	err := r.db.Where("plisio_txn_id = ?", txnID).First(&tx).Error
	if err != nil {
		return nil, err
	}
	return &tx, nil
}

func (r *repository) FindPendingRoleTransaction(userID, role string) (*Transaction, error) {
	var tx Transaction
	err := r.db.Where("user_id = ? AND role = ? AND status = ?", userID, role, "pending").Order("created_at desc").First(&tx).Error
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

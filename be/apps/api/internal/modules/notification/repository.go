package notification

import (
	"gorm.io/gorm"
)

type Repository interface {
	CreateOrUpdateNotification(n *Notification) error
	GetNotificationsByUserID(userID string, limit, offset int) ([]Notification, error)
	MarkAsRead(notificationID string, userID string) error
	MarkAllAsRead(userID string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db}
}

func (r *repository) CreateOrUpdateNotification(n *Notification) error {
	// For like anti-spam, if type is LIKE, check if it already exists
	if n.Type != nil && *n.Type == "LIKE" && n.EntityID != nil {
		var existing Notification
		err := r.db.Where("user_id = ? AND actor_id = ? AND type = ? AND entity_id = ?", n.UserID, n.ActorID, *n.Type, *n.EntityID).First(&existing).Error
		if err == nil {
			// Already exists, don't create a new one, but we can update it if needed.
			// Returning nil means success without inserting a duplicate.
			return nil
		}
	}
	
	return r.db.Create(n).Error
}

func (r *repository) GetNotificationsByUserID(userID string, limit, offset int) ([]Notification, error) {
	var notifications []Notification
	err := r.db.Preload("Actor").Where("user_id = ?", userID).Order("created_at desc").Limit(limit).Offset(offset).Find(&notifications).Error
	return notifications, err
}

func (r *repository) MarkAsRead(notificationID string, userID string) error {
	return r.db.Model(&Notification{}).Where("id = ? AND user_id = ?", notificationID, userID).Update("is_read", true).Error
}

func (r *repository) MarkAllAsRead(userID string) error {
	return r.db.Model(&Notification{}).Where("user_id = ? AND is_read = false", userID).Update("is_read", true).Error
}

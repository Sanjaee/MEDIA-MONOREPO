package notification

import (
	"time"
)

type Notification struct {
	ID        string    `gorm:"primaryKey;type:varchar"`
	UserID    string    `gorm:"type:varchar;not null"`
	ActorID   string    `gorm:"type:varchar;not null"`
	Type      *string   `gorm:"type:varchar"`
	EntityID  *string   `gorm:"type:varchar"`
	IsRead    *bool     `gorm:"type:boolean;default:false"`
	CreatedAt time.Time `gorm:"autoCreateTime;type:timestamp"`
}

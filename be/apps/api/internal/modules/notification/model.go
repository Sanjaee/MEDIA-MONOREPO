package notification

import (
	"time"

	"media-api/internal/modules/user"
)

type Notification struct {
	ID        string    `gorm:"primaryKey;type:varchar"`
	UserID    string    `gorm:"type:varchar;not null"`
	ActorID   string    `gorm:"type:varchar;not null"`
	Type      *string   `json:"type" gorm:"type:varchar"`
	EntityID  *string   `json:"entityId" gorm:"type:varchar"`
	Message   *string   `json:"message" gorm:"type:text"`
	IsRead    *bool     `json:"isRead" gorm:"type:boolean;default:false"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;type:timestamp"`

	// Relations
	Actor     user.User `json:"actor" gorm:"foreignKey:ActorID"`
}

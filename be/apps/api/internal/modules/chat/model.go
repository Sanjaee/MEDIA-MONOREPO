package chat

import (
	"time"

	"media-api/internal/modules/user"
)

// Conversation represents a chat between two users.
type Conversation struct {
	ID        string    `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	User1ID   string    `json:"user1Id" gorm:"type:uuid;not null;index"`
	User1     user.User `json:"user1" gorm:"foreignKey:User1ID"`
	User2ID   string    `json:"user2Id" gorm:"type:uuid;not null;index"`
	User2     user.User `json:"user2" gorm:"foreignKey:User2ID"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	// Messages is a one-to-many relationship.
	Messages []Message `json:"messages,omitempty" gorm:"foreignKey:ConversationID"`
}

// Message represents a single chat message.
type Message struct {
	ID             string       `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ConversationID string       `json:"conversationId" gorm:"type:uuid;not null;index"`
	Conversation   Conversation `json:"-" gorm:"foreignKey:ConversationID"`
	SenderID       string       `json:"senderId" gorm:"type:uuid;not null"`
	Sender         user.User    `json:"sender" gorm:"foreignKey:SenderID"`
	Content        string       `json:"content" gorm:"type:text;not null"`
	IsRead         bool         `json:"isRead" gorm:"default:false"`
	CreatedAt      time.Time    `json:"createdAt" gorm:"index"`
}

package chat

import (
	"errors"

	"gorm.io/gorm"
)

type Repository interface {
	GetConversationsByUserID(userID string) ([]Conversation, error)
	GetConversationBetweenUsers(user1ID, user2ID string) (*Conversation, error)
	CreateConversation(conversation *Conversation) error
	GetMessagesByConversationID(conversationID string, limit, offset int) ([]Message, error)
	SaveMessage(message *Message) error
	GetConversationByID(id string) (*Conversation, error)
	GetTotalUnreadCount(userID string) (int64, error)
	MarkConversationAsRead(conversationID string, currentUserID string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db}
}

func (r *repository) GetConversationsByUserID(userID string) ([]Conversation, error) {
	var conversations []Conversation
	err := r.db.
		Preload("User1").
		Preload("User2").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at desc").Limit(1)
		}).
		Where("user1_id = ? OR user2_id = ?", userID, userID).
		Order("updated_at desc").
		Find(&conversations).Error
	return conversations, err
}

func (r *repository) GetConversationBetweenUsers(user1ID, user2ID string) (*Conversation, error) {
	var conversation Conversation
	err := r.db.
		Where("(user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)", user1ID, user2ID, user2ID, user1ID).
		First(&conversation).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &conversation, nil
}

func (r *repository) CreateConversation(conversation *Conversation) error {
	return r.db.Create(conversation).Error
}

func (r *repository) GetMessagesByConversationID(conversationID string, limit, offset int) ([]Message, error) {
	var messages []Message
	err := r.db.
		Preload("Sender").
		Where("conversation_id = ?", conversationID).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&messages).Error
	return messages, err
}

func (r *repository) SaveMessage(message *Message) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		
		// Update conversation updated_at
		return tx.Model(&Conversation{}).
			Where("id = ?", message.ConversationID).
			Update("updated_at", message.CreatedAt).Error
	})
}

func (r *repository) GetConversationByID(id string) (*Conversation, error) {
	var conversation Conversation
	err := r.db.
		Preload("User1").
		Preload("User2").
		Where("id = ?", id).
		First(&conversation).Error
	if err != nil {
		return nil, err
	}
	return &conversation, nil
}

func (r *repository) GetTotalUnreadCount(userID string) (int64, error) {
	var count int64
	err := r.db.Model(&Message{}).
		Joins("JOIN conversations c ON messages.conversation_id = c.id").
		Where("(c.user1_id = ? OR c.user2_id = ?) AND messages.sender_id != ? AND messages.is_read = false", userID, userID, userID).
		Count(&count).Error
	return count, err
}

func (r *repository) MarkConversationAsRead(conversationID string, currentUserID string) error {
	return r.db.Model(&Message{}).
		Where("conversation_id = ? AND sender_id != ? AND is_read = false", conversationID, currentUserID).
		Update("is_read", true).Error
}

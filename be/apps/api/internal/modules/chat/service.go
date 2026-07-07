package chat

import (
	"errors"
)

type Service interface {
	GetUserConversations(userID string) ([]Conversation, error)
	GetMessages(conversationID string, limit, offset int) ([]Message, error)
	SendMessage(senderID, receiverID, content string) (*Message, error)
	GetOrCreateConversation(user1ID, user2ID string) (*Conversation, error)
	GetTotalUnreadCount(userID string) (int64, error)
	MarkConversationAsRead(conversationID string, currentUserID string) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo}
}

func (s *service) GetUserConversations(userID string) ([]Conversation, error) {
	return s.repo.GetConversationsByUserID(userID)
}

func (s *service) GetMessages(conversationID string, limit, offset int) ([]Message, error) {
	return s.repo.GetMessagesByConversationID(conversationID, limit, offset)
}

func (s *service) SendMessage(senderID, receiverID, content string) (*Message, error) {
	if senderID == receiverID {
		return nil, errors.New("cannot send message to yourself")
	}

	conv, err := s.GetOrCreateConversation(senderID, receiverID)
	if err != nil {
		return nil, err
	}

	msg := &Message{
		ConversationID: conv.ID,
		SenderID:       senderID,
		Content:        content,
	}

	if err := s.repo.SaveMessage(msg); err != nil {
		return nil, err
	}

	// We can fetch the sender to have it populated for the real-time event.
	// But the client typically already knows the sender if they receive it,
	// or we can just send the message as is.

	return msg, nil
}

func (s *service) GetOrCreateConversation(user1ID, user2ID string) (*Conversation, error) {
	conv, err := s.repo.GetConversationBetweenUsers(user1ID, user2ID)
	if err != nil {
		return nil, err
	}
	
	if conv != nil {
		return conv, nil
	}

	// Create new
	newConv := &Conversation{
		User1ID: user1ID,
		User2ID: user2ID,
	}
	if err := s.repo.CreateConversation(newConv); err != nil {
		return nil, err
	}
	
	// Refetch to get full relations if needed, or just return
	return s.repo.GetConversationByID(newConv.ID)
}

func (s *service) GetTotalUnreadCount(userID string) (int64, error) {
	return s.repo.GetTotalUnreadCount(userID)
}

func (s *service) MarkConversationAsRead(conversationID string, currentUserID string) error {
	return s.repo.MarkConversationAsRead(conversationID, currentUserID)
}

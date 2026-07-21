package websocket

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/redis/go-redis/v9"
)

const chatPubSubChannel = "chat_messages"

var redisClient *redis.Client

// SetRedisClient sets the redis client for websocket pubsub
func SetRedisClient(r *redis.Client) {
	redisClient = r
}

// Hub maintains the set of active clients and broadcasts messages to them.
type Hub struct {
	// Registered clients mapped by UserID
	clients map[string]map[*Client]bool

	// Inbound messages to be routed to specific users
	SendToUser chan *MessagePayload

	// Register requests from the clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	mu sync.RWMutex
}

type MessagePayload struct {
	UserID  string          `json:"userId,omitempty"` // Used for routing
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		SendToUser: make(chan *MessagePayload),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	// Start Redis subscriber
	go h.subscribeToRedis()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[client.UserID]; !ok {
				h.clients[client.UserID] = make(map[*Client]bool)
			}
			h.clients[client.UserID][client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if userClients, ok := h.clients[client.UserID]; ok {
				if _, ok := userClients[client]; ok {
					delete(userClients, client)
					close(client.send)
					if len(userClients) == 0 {
						delete(h.clients, client.UserID)
					}
				}
			}
			h.mu.Unlock()

		case message := <-h.SendToUser:
			h.mu.RLock()
			if message.UserID == "*" {
				for _, userClients := range h.clients {
					for client := range userClients {
						select {
						case client.send <- message:
						default:
							close(client.send)
							delete(userClients, client)
						}
					}
				}
			} else if userClients, ok := h.clients[message.UserID]; ok {
				for client := range userClients {
					select {
					case client.send <- message:
					default:
						close(client.send)
						delete(userClients, client)
					}
				}
				if len(userClients) == 0 {
					delete(h.clients, message.UserID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) subscribeToRedis() {
	if redisClient == nil {
		log.Println("RedisClient is nil, skipping Redis Pub/Sub subscription")
		return
	}

	ctx := context.Background()
	pubsub := redisClient.Subscribe(ctx, chatPubSubChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {
		var payload MessagePayload
		if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
			log.Printf("Error unmarshaling redis message: %v", err)
			continue
		}

		// Send to local client if connected
		h.SendToUser <- &payload
	}
}

// PublishToRedis publishes a message to the Redis channel
func PublishToRedis(payload *MessagePayload) error {
	if redisClient == nil {
		return nil // Fallback if no redis
	}
	ctx := context.Background()
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return redisClient.Publish(ctx, chatPubSubChannel, data).Err()
}

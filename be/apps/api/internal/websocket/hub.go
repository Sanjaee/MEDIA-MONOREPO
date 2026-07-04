package websocket

import (
	"encoding/json"
	"sync"
)

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

// MessagePayload represents the structure of the data sent through WebSocket
type MessagePayload struct {
	UserID  string          `json:"-"` // Used for routing, not sent to client
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
			if userClients, ok := h.clients[message.UserID]; ok {
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

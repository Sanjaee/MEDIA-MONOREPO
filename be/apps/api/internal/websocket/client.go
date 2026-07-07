package websocket

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	
	"media-api/internal/modules/chat"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var (
	newline = []byte{'\n'}
	space   = []byte{' '}
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// In production, you should check the origin properly
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	Hub *Hub

	// The user ID associated with this connection
	UserID string

	// The websocket connection.
	Conn *websocket.Conn

	// Buffered channel of outbound messages.
	send chan *MessagePayload

	// Chat Service to handle incoming messages
	ChatService chat.Service
}

// readPump pumps messages from the websocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()
	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error { c.Conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		message = bytes.TrimSpace(bytes.Replace(message, newline, space, -1))
		
		var payload struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(message, &payload); err != nil {
			log.Printf("error unmarshaling client message: %v", err)
			continue
		}

		if payload.Type == "chat_message" && c.ChatService != nil {
			var chatData struct {
				ReceiverID string `json:"receiverId"`
				Content    string `json:"content"`
			}
			if err := json.Unmarshal(payload.Payload, &chatData); err == nil {
				savedMsg, err := c.ChatService.SendMessage(c.UserID, chatData.ReceiverID, chatData.Content)
				if err != nil {
					log.Printf("error saving chat message: %v", err)
					continue
				}

				// Broadcast to Receiver
				b, _ := json.Marshal(savedMsg)
				outPayload := &MessagePayload{
					UserID:  chatData.ReceiverID,
					Type:    "new_message",
					Payload: b,
				}
				PublishToRedis(outPayload)

				// Also broadcast back to Sender so they know it was saved (and get the ID/timestamp)
				selfPayload := &MessagePayload{
					UserID:  c.UserID,
					Type:    "new_message",
					Payload: b,
				}
				PublishToRedis(selfPayload)
			}
		}
	}
}

// writePump pumps messages from the hub to the websocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			
			// Encode message to JSON
			payloadData, _ := json.Marshal(message)
			w.Write(payloadData)

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(newline)
				payloadData, _ := json.Marshal(<-c.send)
				w.Write(payloadData)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

package websocket

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *Hub, c *gin.Context) {
	// Extract the user ID from the query param
	userID := c.Query("userId")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "userId query param required"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		// upgrader.Upgrade handles the error response
		return
	}

	client := &Client{
		Hub:    hub,
		UserID: userID,
		Conn:   conn,
		send:   make(chan *MessagePayload, 256),
	}

	client.Hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.
	go client.writePump()
	go client.readPump()
}

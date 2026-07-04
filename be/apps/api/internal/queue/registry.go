package queue

import (
	"context"

	"github.com/hibiken/asynq"
)

var (
	mux *asynq.ServeMux
)

func init() {
	mux = asynq.NewServeMux()
}

// RegisterHandler allows any module to register a task handler
func RegisterHandler(pattern string, handler func(context.Context, *asynq.Task) error) {
	mux.HandleFunc(pattern, handler)
}

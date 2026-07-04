package queue

import (
	"log"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

func StartServer(redisUrl string) {
	opts, err := redis.ParseURL(redisUrl)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL for Asynq Server: %v", err)
	}

	redisConnOpt := asynq.RedisClientOpt{
		Addr:     opts.Addr,
		Password: opts.Password,
		DB:       opts.DB,
	}

	srv := asynq.NewServer(
		redisConnOpt,
		asynq.Config{
			// Specify how many concurrent workers to use
			Concurrency: 10,
			// Optionally specify multiple queues with different priority.
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
		},
	)

	log.Println("Starting Asynq worker server...")
	if err := srv.Run(mux); err != nil {
		log.Fatalf("could not run Asynq server: %v", err)
	}
}

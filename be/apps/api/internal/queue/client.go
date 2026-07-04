package queue

import (
	"log"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

var Client *asynq.Client

func InitClient(redisUrl string) *asynq.Client {
	opts, err := redis.ParseURL(redisUrl)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL for Asynq: %v", err)
	}

	redisConnOpt := asynq.RedisClientOpt{
		Addr:     opts.Addr,
		Password: opts.Password,
		DB:       opts.DB,
	}

	client := asynq.NewClient(redisConnOpt)
	Client = client
	log.Println("Asynq client initialized successfully.")
	return client
}

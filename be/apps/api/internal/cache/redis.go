package cache

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

func InitRedis(redisUrl string) {
	opts, err := redis.ParseURL(redisUrl)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL for Cache: %v", err)
	}

	RDB = redis.NewClient(&redis.Options{
		Addr:     opts.Addr,
		Password: opts.Password,
		DB:       opts.DB,
	})

	_, err = RDB.Ping(context.Background()).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Redis Cache client initialized successfully.")
}

// Get parses a JSON value from Redis into the provided destination pointer.
func Get(ctx context.Context, key string, dest interface{}) error {
	val, err := RDB.Get(ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

// Set marshals a value to JSON and saves it in Redis with the given expiration.
func Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	bytes, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return RDB.Set(ctx, key, bytes, expiration).Err()
}

// Delete removes a key from Redis.
func Delete(ctx context.Context, key string) error {
	return RDB.Del(ctx, key).Err()
}

// DeletePattern removes all keys matching the given pattern using SCAN.
func DeletePattern(ctx context.Context, pattern string) error {
	var cursor uint64
	for {
		var keys []string
		var err error
		keys, cursor, err = RDB.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}
		if len(keys) > 0 {
			if err := RDB.Del(ctx, keys...).Err(); err != nil {
				return err
			}
		}
		if cursor == 0 {
			break
		}
	}
	return nil
}

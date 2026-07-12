package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	RedisURL    string
	Port        string
	CloudinaryCloudName string
	CloudinaryAPIKey    string
	CloudinaryAPISecret string
}

func LoadConfig() *Config {
	// Load .env file from current or parent directories
	err := godotenv.Load(".env", "../.env", "../../.env", "../../../.env")
	if err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	redisUrl := os.Getenv("REDIS_URL")
	if redisUrl == "" {
		log.Fatal("REDIS_URL is not set")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	return &Config{
		DatabaseURL: dbUrl,
		RedisURL:    redisUrl,
		Port:        port,
		CloudinaryCloudName: cloudName,
		CloudinaryAPIKey:    apiKey,
		CloudinaryAPISecret: apiSecret,
	}
}

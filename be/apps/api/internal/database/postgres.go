package database

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"media-api/internal/modules/chat"
	"media-api/internal/modules/comment"
	"media-api/internal/modules/interaction"
	"media-api/internal/modules/monetization"
	"media-api/internal/modules/news"
	"media-api/internal/modules/notification"
	"media-api/internal/modules/post"
	"media-api/internal/modules/user"
)

var DB *gorm.DB

func ConnectPostgres(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to postgres: %v", err)
	}

	DB = db
	log.Println("Connected to PostgreSQL successfully.")
	return db
}

func Migrate(db *gorm.DB) {
	log.Println("Running AutoMigrate...")
	err := db.AutoMigrate(
		// Auth & User
		&user.User{},
		&user.Account{},
		&user.Session{},
		&user.VerificationToken{},
		&user.Follow{},

		// Post
		&post.Post{},
		&post.Media{},
		&post.PostView{},

		// Interaction
		&comment.Comment{},
		&interaction.Like{},
		&interaction.Bookmark{},

		// Notification
		&notification.Notification{},

		// Monetization
		&monetization.Transaction{},
		&monetization.AdSlot{},

		// Chat
		&chat.Conversation{},
		&chat.Message{},

		// News
		&news.News{},
		&news.NewsMedia{},
	)
	if err != nil {
		log.Fatalf("AutoMigrate failed: %v", err)
	}
	log.Println("AutoMigrate completed.")
}

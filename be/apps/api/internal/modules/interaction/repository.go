package interaction

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository interface {
	ToggleLike(ctx context.Context, userID, postID string) (bool, int, string, error)
	ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) ToggleLike(ctx context.Context, userID, postID string) (bool, int, string, error) {
	var isLiked bool
	var newCount int
	var postOwnerID string

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var like Like
		err := tx.Where("user_id = ? AND post_id = ?", userID, postID).First(&like).Error

		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Like does not exist, so we CREATE it and increment post like count
			newLike := Like{
				ID:     uuid.New().String(),
				UserID: userID,
				PostID: postID,
			}
			isLiked = true
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&newLike).Error; err != nil {
				return err
			}

		} else {
			// Like exists, so we DELETE it
			isLiked = false
			if err := tx.Where("user_id = ? AND post_id = ?", userID, postID).Delete(&Like{}).Error; err != nil {
				return err
			}
		}

		// Recalculate Post like count EXACTLY from likes table (Guarantees no minus values or race conditions)
		if err := tx.Exec("UPDATE posts SET like_count = (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) WHERE id = ?", postID).Error; err != nil {
			return err
		}

		// Fetch latest count and author
		var post struct {
			LikeCount int
			AuthorID  string
		}
		if err := tx.Table("posts").Select("like_count, author_id").Where("id = ?", postID).Scan(&post).Error; err == nil {
			newCount = post.LikeCount
			postOwnerID = post.AuthorID
		}

		return nil
	})

	return isLiked, newCount, postOwnerID, err
}

func (r *repository) ToggleBookmark(ctx context.Context, userID, postID string) (bool, int, error) {
	var isBookmarked bool
	var newCount int

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var bookmark Bookmark
		err := tx.Where("user_id = ? AND post_id = ?", userID, postID).First(&bookmark).Error

		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Bookmark does not exist, so we CREATE it and increment post bookmark count
			newBookmark := Bookmark{
				ID:     uuid.New().String(),
				UserID: userID,
				PostID: postID,
			}
			isBookmarked = true
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&newBookmark).Error; err != nil {
				return err
			}

		} else {
			// Bookmark exists, so we DELETE it
			isBookmarked = false
			if err := tx.Where("user_id = ? AND post_id = ?", userID, postID).Delete(&Bookmark{}).Error; err != nil {
				return err
			}
		}

		// Recalculate Post bookmark count EXACTLY from bookmarks table
		if err := tx.Exec("UPDATE posts SET bookmark_count = (SELECT COUNT(*) FROM bookmarks WHERE post_id = posts.id) WHERE id = ?", postID).Error; err != nil {
			return err
		}

		// Fetch latest count
		var post struct {
			BookmarkCount int
		}
		if err := tx.Table("posts").Select("bookmark_count").Where("id = ?", postID).Scan(&post).Error; err == nil {
			newCount = post.BookmarkCount
		}

		return nil
	})

	return isBookmarked, newCount, err
}

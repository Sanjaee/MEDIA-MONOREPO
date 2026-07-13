package post

import (
	"time"

	"gorm.io/gorm"
	"media-api/internal/modules/user"
)

type Post struct {
	ID             string     `gorm:"primaryKey;type:varchar" json:"id"`
	AuthorID       string     `gorm:"type:varchar;not null" json:"authorId"`
	Author         *user.User `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Content        *string    `gorm:"type:text" json:"content"`
	Visibility     *string    `gorm:"type:varchar;default:'public'" json:"visibility"`
	ReplyToPostID  *string    `gorm:"type:varchar" json:"replyToPostId"`
	RepostOfPostID *string    `gorm:"type:varchar" json:"repostOfPostId"`
	LikeCount      *int       `gorm:"type:integer;default:0" json:"likeCount"`
	CommentCount   *int       `gorm:"type:integer;default:0" json:"commentCount"`
	RepostCount    *int       `gorm:"type:integer;default:0" json:"repostCount"`
	BookmarkCount  *int       `gorm:"type:integer;default:0" json:"bookmarkCount"`
	ViewCount      *int       `gorm:"type:integer;default:0" json:"viewCount"`
	HasLiked       bool       `gorm:"->;type:boolean" json:"hasLiked"`
	HasBookmarked  bool       `gorm:"->;type:boolean" json:"hasBookmarked"`
	IsProduct      *bool      `gorm:"type:boolean;default:false" json:"isProduct"`
	ProductPrice   *int       `gorm:"type:integer" json:"productPrice"`
	ProductURL     *string    `gorm:"type:text" json:"productUrl,omitempty"`
	HasBought      bool       `gorm:"->;type:boolean" json:"hasBought"`
	CreatedAt      time.Time  `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
	UpdatedAt      time.Time  `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`
	DeletedBy      *string    `gorm:"type:varchar" json:"deletedBy,omitempty"`
	DeleteReason   *string    `gorm:"type:varchar" json:"deleteReason,omitempty"`
	Media          []Media    `gorm:"foreignKey:PostID;constraint:OnDelete:CASCADE;" json:"media,omitempty"`
}

type Media struct {
	ID           string    `gorm:"primaryKey;type:varchar" json:"id"`
	PostID       string    `gorm:"type:varchar;not null" json:"postId"`
	Type         string    `gorm:"type:varchar;not null" json:"type"`
	URL          string    `gorm:"type:text;not null" json:"url"`
	PublicID     *string   `gorm:"type:varchar" json:"publicId"`
	ThumbnailURL *string   `gorm:"type:text" json:"thumbnailUrl"`
	AltText      *string   `gorm:"type:text" json:"altText"`
	Width        *int      `gorm:"type:integer" json:"width"`
	Height       *int      `gorm:"type:integer" json:"height"`
	Duration     *int      `gorm:"type:integer" json:"duration"`
	Bytes        *int      `gorm:"type:integer" json:"bytes"`
	Format       *string   `gorm:"type:varchar" json:"format"`
	SortOrder    *int      `gorm:"type:integer;default:0" json:"sortOrder"`
	CreatedAt    time.Time `gorm:"autoCreateTime;type:timestamp" json:"createdAt"`
}

type PostView struct {
	ID        string    `gorm:"primaryKey;type:varchar"`
	PostID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_post_user_view"`
	UserID    string    `gorm:"type:varchar;not null;uniqueIndex:idx_post_user_view"`
	CreatedAt time.Time `gorm:"autoCreateTime;type:timestamp"`
}

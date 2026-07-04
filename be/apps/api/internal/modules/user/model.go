package user

import (
	"time"
)

type User struct {
	ID            string     `gorm:"primaryKey;type:varchar" json:"id"`
	Username      *string    `gorm:"type:varchar;unique" json:"username,omitempty"`
	Name          *string    `gorm:"type:varchar" json:"name,omitempty"`
	Email         string     `gorm:"type:varchar;unique;not null" json:"email"`
	EmailVerified *time.Time `gorm:"type:timestamp;column:emailVerified" json:"emailVerified,omitempty"`
	Image         *string    `gorm:"type:text" json:"image,omitempty"`
	Bio           *string    `gorm:"type:text" json:"bio,omitempty"`
	Role          *string    `gorm:"type:varchar;default:'member'" json:"role,omitempty"`
	IsVerified    *bool      `gorm:"type:boolean;default:false" json:"is_verified,omitempty"`
	IsBanned      *bool      `gorm:"type:boolean;default:false" json:"is_banned,omitempty"`
	BannedUntil   *time.Time `gorm:"type:timestamp" json:"banned_until,omitempty"`
	BanReason     *string    `gorm:"type:text" json:"ban_reason,omitempty"`
	CreatedAt     time.Time  `gorm:"autoCreateTime;type:timestamp" json:"createdAt,omitempty"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime;type:timestamp" json:"updatedAt,omitempty"`
}

type Account struct {
	ID                string  `gorm:"primaryKey;type:varchar" json:"id,omitempty"`
	UserID            string  `gorm:"type:varchar;not null" json:"userId"`
	Type              string  `gorm:"type:varchar;not null" json:"type"`
	Provider          string  `gorm:"type:varchar;not null" json:"provider"`
	ProviderAccountID string  `gorm:"type:varchar;not null" json:"providerAccountId"`
	RefreshToken      *string `gorm:"type:text" json:"refresh_token,omitempty"`
	AccessToken       *string `gorm:"type:text" json:"access_token,omitempty"`
	ExpiresAt         *int    `gorm:"type:integer" json:"expires_at,omitempty"`
	TokenType         *string `gorm:"type:varchar" json:"token_type,omitempty"`
	Scope             *string `gorm:"type:text" json:"scope,omitempty"`
	IDToken           *string `gorm:"type:text" json:"id_token,omitempty"`
	SessionState      *string `gorm:"type:text" json:"session_state,omitempty"`
}

type Session struct {
	SessionToken string    `gorm:"primaryKey;type:varchar" json:"sessionToken"`
	UserID       string    `gorm:"type:varchar;not null" json:"userId"`
	Expires      time.Time `gorm:"type:timestamp;not null" json:"expires"`
}

type VerificationToken struct {
	Identifier string    `gorm:"primaryKey;type:varchar"`
	Token      string    `gorm:"primaryKey;type:varchar"`
	Expires    time.Time `gorm:"type:timestamp;not null"`
}

type Follow struct {
	ID          string    `gorm:"primaryKey;type:varchar"`
	FollowerID  string    `gorm:"type:varchar;not null;uniqueIndex:idx_follower_following"`
	FollowingID string    `gorm:"type:varchar;not null;uniqueIndex:idx_follower_following"`
	CreatedAt   time.Time `gorm:"autoCreateTime;type:timestamp"`
}

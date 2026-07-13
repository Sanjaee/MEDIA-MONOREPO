package auth

import (
	"errors"

	"gorm.io/gorm"

	"media-api/internal/modules/user"
)

type Repository interface {
	CreateUser(u *user.User) error
	GetUserByID(id string) (*user.User, error)
	GetUserByEmail(email string) (*user.User, error)
	GetUserByAccount(provider, providerAccountId string) (*user.User, error)
	UpdateUser(u *user.User) error
	
	LinkAccount(a *user.Account) error
	
	CreateSession(s *user.Session) error
	GetSessionAndUser(sessionToken string) (*user.Session, *user.User, error)
	UpdateSession(s *user.Session) error
	DeleteSession(sessionToken string) error
	
	CheckUsernameExists(username string) (bool, error)
	GetUserProfileByUsername(username string) (map[string]interface{}, error)
	SearchUsers(query string, limit int) ([]user.User, error)
	ToggleFollow(followerID, followingID string) (bool, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db}
}

func (r *repository) CreateUser(u *user.User) error {
	return r.db.Create(u).Error
}

func (r *repository) GetUserByID(id string) (*user.User, error) {
	var u user.User
	err := r.db.Where("id = ?", id).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *repository) GetUserByEmail(email string) (*user.User, error) {
	var u user.User
	err := r.db.Where("email = ?", email).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *repository) GetUserByAccount(provider, providerAccountId string) (*user.User, error) {
	var account user.Account
	err := r.db.Where("provider = ? AND provider_account_id = ?", provider, providerAccountId).First(&account).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return r.GetUserByID(account.UserID)
}

func (r *repository) UpdateUser(u *user.User) error {
	// Updates non-zero fields
	return r.db.Model(u).Where("id = ?", u.ID).Updates(u).Error
}

func (r *repository) LinkAccount(a *user.Account) error {
	return r.db.Create(a).Error
}

func (r *repository) CreateSession(s *user.Session) error {
	return r.db.Create(s).Error
}

func (r *repository) GetSessionAndUser(sessionToken string) (*user.Session, *user.User, error) {
	var s user.Session
	err := r.db.Where("session_token = ?", sessionToken).First(&s).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, nil
		}
		return nil, nil, err
	}

	u, err := r.GetUserByID(s.UserID)
	if err != nil || u == nil {
		return nil, nil, err
	}

	return &s, u, nil
}

func (r *repository) UpdateSession(s *user.Session) error {
	return r.db.Model(s).Where("session_token = ?", s.SessionToken).Updates(s).Error
}

func (r *repository) DeleteSession(sessionToken string) error {
	return r.db.Where("session_token = ?", sessionToken).Delete(&user.Session{}).Error
}

func (r *repository) CheckUsernameExists(username string) (bool, error) {
	var count int64
	err := r.db.Model(&user.User{}).Where("username = ?", username).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *repository) GetUserProfileByUsername(username string) (map[string]interface{}, error) {
	var u user.User
	err := r.db.Where("username = ?", username).First(&u).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	var totalThreads int64
	r.db.Table("posts").Where("author_id = ?", u.ID).Count(&totalThreads)

	var totalPosts int64
	r.db.Table("comments").Where("author_id = ?", u.ID).Count(&totalPosts)

	var reputation int64
	r.db.Table("likes").Joins("JOIN posts ON posts.id = likes.post_id").Where("posts.author_id = ?", u.ID).Count(&reputation)

	var recentPosts []map[string]interface{}
	r.db.Table("posts").Select("id, content, created_at, comment_count").Where("author_id = ?", u.ID).Order("created_at desc").Limit(5).Find(&recentPosts)
    
	var formattedRecentPosts []map[string]interface{}
	for _, p := range recentPosts {
		formattedRecentPosts = append(formattedRecentPosts, map[string]interface{}{
			"id":        p["id"],
			"content":   p["content"],
			"createdAt": p["created_at"],
			"stats": map[string]interface{}{
				"replies": p["comment_count"],
			},
		})
	}

	profile := map[string]interface{}{
		"id":          u.ID,
		"name":        u.Name,
		"username":    u.Username,
		"image":       u.Image,
		"bio":         u.Bio,
		"role":        u.Role,
		"isVerified":  u.IsVerified,
		"isBanned":    u.IsBanned,
		"bannedUntil": u.BannedUntil,
		"banReason":   u.BanReason,
		"createdAt":   u.CreatedAt,
		"stats": map[string]interface{}{
			"totalThreads": totalThreads,
			"totalPosts":   totalPosts,
			"reputation":   reputation,
		},
		"recentPosts": formattedRecentPosts,
	}

	return profile, nil
}

func (r *repository) SearchUsers(query string, limit int) ([]user.User, error) {
	var users []user.User
	if limit <= 0 {
		limit = 20
	}
	
	err := r.db.Where("name ILIKE ? OR username ILIKE ?", "%"+query+"%", "%"+query+"%").Limit(limit).Find(&users).Error
	if err != nil {
		return nil, err
	}
	return users, nil
}

func (r *repository) ToggleFollow(followerID, followingID string) (bool, error) {
	var follow user.Follow
	err := r.db.Where("follower_id = ? AND following_id = ?", followerID, followingID).First(&follow).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create follow
			newFollow := user.Follow{
				FollowerID:  followerID,
				FollowingID: followingID,
			}
			if err := r.db.Create(&newFollow).Error; err != nil {
				return false, err
			}
			return true, nil
		}
		return false, err
	}

	// Delete follow
	if err := r.db.Delete(&follow).Error; err != nil {
		return false, err
	}
	return false, nil
}

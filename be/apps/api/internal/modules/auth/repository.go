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

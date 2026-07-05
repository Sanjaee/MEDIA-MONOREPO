package auth

import (
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"media-api/internal/modules/user"
)

type Service interface {
	CreateUser(u *user.User) (*user.User, error)
	GetUser(id string) (*user.User, error)
	GetUserByEmail(email string) (*user.User, error)
	GetUserByAccount(provider, providerAccountId string) (*user.User, error)
	UpdateUser(u *user.User) (*user.User, error)

	LinkAccount(a *user.Account) (*user.Account, error)

	CreateSession(s *user.Session) (*user.Session, error)
	GetSessionAndUser(sessionToken string) (*user.Session, *user.User, error)
	UpdateSession(s *user.Session) (*user.Session, error)
	DeleteSession(sessionToken string) error
	GetUserProfileByUsername(username string) (map[string]interface{}, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo}
}

func (s *service) CreateUser(u *user.User) (*user.User, error) {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}

	// Generate unique username
	var baseUsername string
	if u.Name != nil && *u.Name != "" {
		baseUsername = cleanString(*u.Name)
	} else if u.Email != "" {
		parts := strings.Split(u.Email, "@")
		baseUsername = cleanString(parts[0])
	}
	if baseUsername == "" {
		baseUsername = "user"
	}

	username := baseUsername
	counter := 1

	for {
		exists, err := s.repo.CheckUsernameExists(username)
		if err != nil {
			return nil, err
		}
		if !exists {
			break
		}
		// Generate random suffix or counter
		rand.Seed(time.Now().UnixNano())
		username = fmt.Sprintf("%s%d%d", baseUsername, rand.Intn(1000), counter)
		counter++
	}
	u.Username = &username
	
	// Set default role if not set
	if u.Role == nil {
		role := "member"
		u.Role = &role
	}

	err := s.repo.CreateUser(u)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *service) GetUser(id string) (*user.User, error) {
	return s.repo.GetUserByID(id)
}

func (s *service) GetUserByEmail(email string) (*user.User, error) {
	return s.repo.GetUserByEmail(email)
}

func (s *service) GetUserByAccount(provider, providerAccountId string) (*user.User, error) {
	return s.repo.GetUserByAccount(provider, providerAccountId)
}

func (s *service) UpdateUser(u *user.User) (*user.User, error) {
	err := s.repo.UpdateUser(u)
	if err != nil {
		return nil, err
	}
	return s.repo.GetUserByID(u.ID)
}

func (s *service) LinkAccount(a *user.Account) (*user.Account, error) {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	err := s.repo.LinkAccount(a)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (s *service) CreateSession(session *user.Session) (*user.Session, error) {
	err := s.repo.CreateSession(session)
	if err != nil {
		return nil, err
	}
	return session, nil
}

func (s *service) GetSessionAndUser(sessionToken string) (*user.Session, *user.User, error) {
	return s.repo.GetSessionAndUser(sessionToken)
}

func (s *service) UpdateSession(session *user.Session) (*user.Session, error) {
	err := s.repo.UpdateSession(session)
	if err != nil {
		return nil, err
	}
	return session, nil
}

func (s *service) DeleteSession(sessionToken string) error {
	return s.repo.DeleteSession(sessionToken)
}

func (s *service) GetUserProfileByUsername(username string) (map[string]interface{}, error) {
	return s.repo.GetUserProfileByUsername(username)
}

func cleanString(input string) string {
	input = strings.ToLower(input)
	re := regexp.MustCompile("[^a-z0-9]")
	return re.ReplaceAllString(input, "")
}

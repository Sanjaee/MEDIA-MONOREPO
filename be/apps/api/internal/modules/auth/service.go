package auth

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"media-api/internal/modules/user"
	"media-api/internal/storage"
)

type Service interface {
	CreateUser(u *user.User) (*user.User, error)
	GetUser(id string) (*user.User, error)
	GetUserByEmail(email string) (*user.User, error)
	GetUserByAccount(provider, providerAccountId string) (*user.User, error)
	UpdateUser(u *user.User) (*user.User, error)
	UpdateMyProfile(userID string, name string, tempFilePath string) (*user.User, error)

	LinkAccount(a *user.Account) (*user.Account, error)

	CreateSession(s *user.Session) (*user.Session, error)
	GetSessionAndUser(sessionToken string) (*user.Session, *user.User, error)
	UpdateSession(s *user.Session) (*user.Session, error)
	DeleteSession(sessionToken string) error
	GetUserProfileByUsername(username string) (map[string]interface{}, error)
	SearchUsers(query string, limit int) ([]user.User, error)
	ToggleFollow(followerID, followingID string) (bool, error)
	GetAllUsersAdmin(adminUserID string) ([]user.User, error)
	GetTopSpenders(limit int) ([]map[string]interface{}, error)
	GetTopSellers(limit int) ([]map[string]interface{}, error)
	GetTopLarpOverall(limit int) ([]map[string]interface{}, error)
	BanUser(adminUserID, targetUserID string, reason string, durationDays int) error
	UnbanUser(adminUserID, targetUserID string) error

	GenerateToken(userID string) (string, error)
	ValidateToken(tokenString string) (*jwt.RegisteredClaims, error)
}

type service struct {
	repo  Repository
	store storage.Storage
}

func NewService(repo Repository, store storage.Storage) Service {
	return &service{repo, store}
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
		
		ownerEmail := os.Getenv("OWNER_EMAIL")
		if ownerEmail == "" {
			ownerEmail = "afrizaahmad18@gmail.com"
		}
		
		if u.Email != "" && strings.EqualFold(u.Email, ownerEmail) {
			role = "owner"
		}
		
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

func (s *service) BanUser(adminUserID, targetUserID string, reason string, durationDays int) error {
	admin, err := s.repo.GetUserByID(adminUserID)
	if err != nil || admin == nil {
		return fmt.Errorf("unauthorized")
	}

	if admin.Role == nil || *admin.Role != "owner" {
		return fmt.Errorf("forbidden: owner access required")
	}

	target, err := s.repo.GetUserByID(targetUserID)
	if err != nil || target == nil {
		return fmt.Errorf("target user not found")
	}

	isBanned := true
	target.IsBanned = &isBanned
	target.BanReason = &reason
	
	if durationDays > 0 {
		bannedUntil := time.Now().AddDate(0, 0, durationDays)
		target.BannedUntil = &bannedUntil
	} else {
		// Permanent ban
		target.BannedUntil = nil
	}

	return s.repo.UpdateUser(target)
}

func (s *service) UnbanUser(adminUserID, targetUserID string) error {
	admin, err := s.repo.GetUserByID(adminUserID)
	if err != nil || admin == nil {
		return fmt.Errorf("unauthorized")
	}

	if admin.Role == nil || *admin.Role != "owner" {
		return fmt.Errorf("forbidden: owner access required")
	}

	target, err := s.repo.GetUserByID(targetUserID)
	if err != nil || target == nil {
		return fmt.Errorf("target user not found")
	}

	isBanned := false
	target.IsBanned = &isBanned
	target.BanReason = nil
	target.BannedUntil = nil

	return s.repo.UpdateUser(target)
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

func (s *service) SearchUsers(query string, limit int) ([]user.User, error) {
	return s.repo.SearchUsers(query, limit)
}

func cleanString(input string) string {
	input = strings.ToLower(input)
	re := regexp.MustCompile("[^a-z0-9]")
	return re.ReplaceAllString(input, "")
}

func (s *service) GenerateToken(userID string) (string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "default_secret_for_dev_only"
	}
	
	claims := &jwt.RegisteredClaims{
		Subject:   userID,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    "media-api",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(jwtSecret))
}

func (s *service) ValidateToken(tokenString string) (*jwt.RegisteredClaims, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "default_secret_for_dev_only"
	}

	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*jwt.RegisteredClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

func (s *service) ToggleFollow(followerID, followingID string) (bool, error) {
	if followerID == followingID {
		return false, fmt.Errorf("cannot follow yourself")
	}

	followingUser, err := s.repo.GetUserByID(followingID)
	if err != nil || followingUser == nil {
		return false, fmt.Errorf("user not found")
	}

	return s.repo.ToggleFollow(followerID, followingID)
}

func (s *service) GetAllUsersAdmin(adminUserID string) ([]user.User, error) {
	adminUser, err := s.repo.GetUserByID(adminUserID)
	if err != nil || adminUser == nil {
		return nil, fmt.Errorf("admin user not found")
	}
	if adminUser.Role == nil || *adminUser.Role != "owner" {
		return nil, fmt.Errorf("forbidden: owner access required")
	}

	return s.repo.GetAllUsersAdmin()
}

func (s *service) GetTopSpenders(limit int) ([]map[string]interface{}, error) {
	return s.repo.GetTopSpenders(limit)
}

func (s *service) GetTopSellers(limit int) ([]map[string]interface{}, error) {
	return s.repo.GetTopSellers(limit)
}

func (s *service) GetTopLarpOverall(limit int) ([]map[string]interface{}, error) {
	return s.repo.GetTopLarpOverall(limit)
}

func (s *service) UpdateMyProfile(userID string, name string, tempFilePath string) (*user.User, error) {
	u, err := s.repo.GetUserByID(userID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	if name != "" {
		u.Name = &name
	}

	if tempFilePath != "" {
		if s.store == nil {
			return nil, fmt.Errorf("storage not initialized")
		}

		file, err := os.Open(tempFilePath)
		if err != nil {
			return nil, fmt.Errorf("failed to open media: %v", err)
		}
		defer file.Close()

		// Detect content type
		buffer := make([]byte, 512)
		_, _ = file.Read(buffer)
		file.Seek(0, 0)
		contentType := http.DetectContentType(buffer)

		key := fmt.Sprintf("users/%s_%s", userID, filepath.Base(tempFilePath))
		if err := s.store.Upload(key, file, contentType); err != nil {
			return nil, fmt.Errorf("failed to upload media: %v", err)
		}
		uploadedURL := s.store.GetURL(key)

		// Delete old image if it exists to prevent orphaned images
		if u.Image != nil && *u.Image != "" {
			parts := strings.Split(*u.Image, "/")
			if len(parts) > 0 {
				oldKey := "users/" + parts[len(parts)-1]
				_ = s.store.Delete(oldKey)
			}
		}

		u.Image = &uploadedURL
	}

	err = s.repo.UpdateUser(u)
	if err != nil {
		return nil, err
	}

	return s.repo.GetUserByID(u.ID)
}

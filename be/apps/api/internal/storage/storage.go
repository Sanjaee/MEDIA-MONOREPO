package storage

import (
	"io"
)

type Storage interface {
	Upload(key string, body io.Reader, contentType string) error
	Delete(key string) error
	GetURL(key string) string
}

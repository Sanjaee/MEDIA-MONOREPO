package storage

import (
	"context"
	"io"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func (r *R2) Upload(key string, body io.Reader, contentType string) error {
	_, err := r.Client.PutObject(
		context.Background(),
		&s3.PutObjectInput{
			Bucket:      &r.Bucket,
			Key:         &key,
			Body:        body,
			ContentType: &contentType,
		},
	)

	return err
}

package storage

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func (r *R2) Delete(key string) error {
	_, err := r.Client.DeleteObject(
		context.Background(),
		&s3.DeleteObjectInput{
			Bucket: &r.Bucket,
			Key:    &key,
		},
	)

	return err
}

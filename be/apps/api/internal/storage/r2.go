package storage

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type R2 struct {
	Client *s3.Client
	Bucket string
}

func NewR2() (*R2, error) {
	r2AccessKey := os.Getenv("R2_ACCESS_KEY_ID")
	r2SecretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	r2Endpoint := os.Getenv("R2_ENDPOINT")
	r2Bucket := os.Getenv("R2_BUCKET")

	if r2AccessKey == "" || r2SecretKey == "" || r2Endpoint == "" || r2Bucket == "" {
		return nil, fmt.Errorf("missing required R2 environment variables")
	}

	cfg, err := config.LoadDefaultConfig(
		context.Background(),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				r2AccessKey,
				r2SecretKey,
				"",
			),
		),
		config.WithRegion("auto"),
		config.WithBaseEndpoint(r2Endpoint),
	)

	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(cfg)

	return &R2{
		Client: client,
		Bucket: r2Bucket,
	}, nil
}

func (r *R2) GetURL(key string) string {
	domain := os.Getenv("R2_PUBLIC_DOMAIN")
	if domain == "" {
		// Fallback for local testing if not set
		domain = "https://pub-xxxxxxxx.r2.dev" 
	}
	// Ensure domain doesn't end with slash
	domain = strings.TrimSuffix(domain, "/")
	return fmt.Sprintf("%s/%s", domain, key)
}

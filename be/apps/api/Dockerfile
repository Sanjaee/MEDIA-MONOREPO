# Build Stage
FROM golang:alpine AS builder

WORKDIR /app
COPY go.mod ./

# Run go mod tidy before download if needed, though usually just download is fine.
# We will copy the source code first to be safe.
COPY . .
RUN go mod tidy
RUN go build -o main ./cmd/server/main.go

# Production Stage
FROM alpine:latest

WORKDIR /app
COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]

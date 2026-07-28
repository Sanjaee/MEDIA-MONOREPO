package ranking

import (
	"math"
	"time"
)

type Comment struct {
	LikeCount     int
	ReplyCount    int
	ReactionCount int
	CreatedAt     time.Time
	Pinned        bool

	HasImage   bool
	HasMention bool
	Content    string

	AuthorKarma int
}

func Score(c Comment) float64 {
	ageHours := time.Since(c.CreatedAt).Hours()
	if ageHours < 0 {
		ageHours = 0
	}

	// 1. Hitung Poin Interaksi (Base Points)
	// Kita berikan modal 1.0 poin agar komentar tanpa interaksi tidak bernilai 0
	points := 1.0 + (float64(c.LikeCount) * 2.0) + (float64(c.ReplyCount) * 3.5) + (float64(c.ReactionCount) * 1.5) + (float64(c.AuthorKarma) * 0.5)

	// 2. Kualitas Konten
	quality := 0.0
	if c.HasImage {
		quality += 1.0
	}
	if c.HasMention {
		quality += 0.5
	}
	if len(c.Content) > 100 {
		quality += 1.0
	}
	if len(c.Content) < 5 {
		quality -= 0.5 // Penalti wajar untuk komentar terlalu pendek
	}

	totalPoints := points + quality
	if totalPoints < 0.1 {
		totalPoints = 0.1 // Hindari nilai poin negatif atau 0
	}

	// 3. Hacker News Gravity Algorithm: Score = Points / (Age + 2)^Gravity
	// Gravity 1.2 sangat cocok untuk Social Media (membuat komentar lawas tapi ramai tetap awet di atas komentar baru yg sepi)
	gravity := 1.2
	score := totalPoints / math.Pow(ageHours + 2.0, gravity)

	// 4. Pin diutamakan
	if c.Pinned {
		score += 10000.0
	}

	return score
}

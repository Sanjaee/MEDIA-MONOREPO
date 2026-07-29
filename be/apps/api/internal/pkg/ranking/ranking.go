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

	// 1. Hitung Poin Interaksi (Engagement)
	// Reply berbobot jauh lebih besar karena menandakan diskusi (8 poin)
	engagement := 
		(float64(c.LikeCount) * 2.0) + 
		(float64(c.ReplyCount) * 8.0) + 
		(float64(c.ReactionCount) * 2.0)

	// 2. Kualitas Konten
	if c.HasImage {
		engagement += 2.0
	}
	if c.HasMention {
		engagement += 0.5
	}
	if len(c.Content) > 100 {
		engagement += 2.0
	}
	if len(c.Content) < 5 {
		engagement -= 0.5 // Penalti wajar untuk komentar terlalu pendek
	}

	// 3. Reputasi Pembuat (Author Karma)
	engagement += math.Log1p(float64(c.AuthorKarma))

	// 4. Kalkulasi Akhir: Engagement dikurangi Age Penalty yang ringan (Akar Kuadrat Usia)
	// Dengan ini, komentar yang ramai akan tetap berada di atas walau usianya sudah berhari-hari.
	score := engagement - math.Sqrt(ageHours)

	// 5. Pin diutamakan paling atas
	if c.Pinned {
		score += 100000.0
	}

	return score
}

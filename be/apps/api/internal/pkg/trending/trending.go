package trending

import (
	"math"
	"time"
)

type Post struct {
	Likes     int
	Comments  int
	Reposts   int
	Bookmarks int
	Views     int
	CreatedAt time.Time
}

func CalculateScore(p Post) float64 {
	age := time.Since(p.CreatedAt).Hours()

	if age < 1 {
		age = 1
	}

	base :=
		math.Log(float64(p.Likes)+1)*2 +
			math.Log(float64(p.Comments)+1)*4 +
			math.Log(float64(p.Reposts)+1)*6 +
			math.Log(float64(p.Bookmarks)+1)*5 +
			math.Sqrt(float64(p.Views))

	engagement := float64(
		p.Likes+
			p.Comments*2+
			p.Reposts*3+
			p.Bookmarks*2,
	) / math.Max(float64(p.Views), 1)

	velocity := engagement / age

	score :=
		base *
			(1 + engagement) *
			(1 + velocity) /
			math.Pow(age+2, 1.5)

	// In case of NaN or Inf
	if math.IsNaN(score) || math.IsInf(score, 0) {
		return 0
	}

	return score
}

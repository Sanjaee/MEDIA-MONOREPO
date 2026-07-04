package post

type Service interface {
	GetAllPosts() ([]Post, error)
}

type service struct {
	repository Repository
}

func NewService(repository Repository) *service {
	return &service{repository}
}

func (s *service) GetAllPosts() ([]Post, error) {
	posts, err := s.repository.FindAll()
	if err != nil {
		return posts, err
	}
	return posts, nil
}

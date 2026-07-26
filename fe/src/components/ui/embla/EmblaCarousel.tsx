import React, { useMemo, useEffect } from 'react'
import { EmblaOptionsType } from 'embla-carousel'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import './embla.css'

type PropType = {
  slides: any[]
  options?: EmblaOptionsType
}

const EmblaCarousel = (props: PropType) => {
  const { slides, options } = props
  
  const startIndex = useMemo(() => {
    if (!slides || slides.length === 0) return 0;
    return Math.floor(Date.now() / 5000) % slides.length;
  }, [slides]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { ...options, startIndex }, 
    [Autoplay({ delay: 5000, stopOnInteraction: false })]
  )

  return (
    <div className="embla">
      <div className="embla__viewport overflow-hidden" ref={emblaRef}>
        <div className="embla__container">
          {slides.map((ad, index) => (
            <div className="embla__slide" key={ad.id || index}>
              <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block relative aspect-video w-full h-full">
                {ad.imageUrl ? (
                  ad.mediaType === "video" ? (
                    <video src={ad.imageUrl} autoPlay muted loop className="w-full h-full object-cover" />
                  ) : (
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted">Ad Media</div>
                )}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default EmblaCarousel

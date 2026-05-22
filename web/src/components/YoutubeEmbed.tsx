import { PlayIcon } from '@/components/icons';

interface YoutubeEmbedProps {
  videoId: string;
  label: string;
  className?: string;
}

export function YoutubeEmbed({ videoId, label, className }: YoutubeEmbedProps) {
  if (videoId) {
    return (
      <div className={`youtube-embed-wrapper ${className ?? ''}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className={`media-placeholder ${className ?? ''}`}>
      <div className="media-placeholder-inner">
        <div className="media-play-icon"><PlayIcon /></div>
        <p className="media-placeholder-label">{label}</p>
      </div>
    </div>
  );
}

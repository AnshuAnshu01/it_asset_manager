import bgVideo from '../assets/bg.mp4';

export default function BackgroundVideo() {
  return (
    <div className="global-bg-video-wrapper">
      <video
        src={bgVideo}
        autoPlay
        loop
        muted
        defaultMuted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noremoteplayback"
        ref={(el) => {
          if (el) el.muted = true;
        }}
        className="global-bg-video"
      />
      <div className="global-bg-video-overlay" />
    </div>
  );
}

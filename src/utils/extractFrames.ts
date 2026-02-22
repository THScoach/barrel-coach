const FRAME_PERCENTAGES = [0.05, 0.20, 0.35, 0.50, 0.65, 0.80, 0.95];
const TARGET_WIDTH = 800;

export const extractFrames = async (videoFile: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const objUrl = URL.createObjectURL(videoFile);
    video.src = objUrl;

    video.onloadedmetadata = async () => {
      const { duration, videoWidth, videoHeight } = video;
      if (!duration || duration === Infinity) {
        URL.revokeObjectURL(objUrl);
        return reject(new Error("Could not read video duration."));
      }

      const scale = TARGET_WIDTH / videoWidth;
      const canvas = document.createElement("canvas");
      canvas.width = TARGET_WIDTH;
      canvas.height = Math.round(videoHeight * scale);
      const ctx = canvas.getContext("2d")!;

      const frames: string[] = [];

      for (const pct of FRAME_PERCENTAGES) {
        const time = pct * duration;
        await new Promise<void>((res) => {
          video.currentTime = time;
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL("image/jpeg", 0.85));
            res();
          };
        });
      }

      URL.revokeObjectURL(objUrl);
      resolve(frames);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Failed to load video for frame extraction."));
    };
  });
};

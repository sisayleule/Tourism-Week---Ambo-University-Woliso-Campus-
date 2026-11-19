# source-media/

Local archive for large original video files. **Never deployed.**

Place your master recordings here before transcoding. The MP4s in `public/videos/`
are the transcoded, compressed versions that are actually served.

## Recommended ffmpeg commands

### Desktop (hero-720-v2.mp4, target ≈ 2 MB for a 10–12 s loop)
```
ffmpeg -i source-media/YOUR_SOURCE.mp4 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -crf 28 -preset slow -tune film \
  -profile:v high -level 4.0 \
  -movflags +faststart \
  -an \
  -t 12 \
  public/videos/hero-720-v2.mp4
```

### Mobile (hero-480-v2.mp4, target ≈ 1 MB for a 10–12 s loop)
```
ffmpeg -i source-media/YOUR_SOURCE.mp4 \
  -vf "scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -crf 30 -preset slow -tune film \
  -profile:v baseline -level 3.1 \
  -movflags +faststart \
  -an \
  -t 12 \
  public/videos/hero-480-v2.mp4
```

After transcoding, run `node scripts/check-hero-media.mjs` to verify file sizes
and that the moov atom is before the mdat atom (required for progressive download).

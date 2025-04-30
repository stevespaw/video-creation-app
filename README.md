# MP3 to MP4 Converter Web App

This Node.js app creates an H.264 MP4 video from an MP3 file and an image. The result is uploaded to S3-compatible storage (e.g., iDrive e2). A web UI and REST API are included.

## Features

- Input via HTTP URLs for audio and image
- Converts audio+image to MP4 using FFmpeg
- Frame rate: 29.97 fps, optimized for still images
- Uploads result to S3-compatible object storage
- Shows public URL in both web UI and API

## Web UI

Access at `/` and fill in MP3 and image URLs.

## API

### POST /api/render

**Form Fields:**

- `audioUrl`: Public MP3 file URL
- `imageUrl`: Public JPG/PNG file URL

**Response:**

```json
{
  "url": "https://bucket.endpoint/file.mp4"
}
```

## Environment Variables (`.env`)

```
AWS_ACCESS_KEY_ID=your-idrive-e2-key
AWS_SECRET_ACCESS_KEY=your-idrive-e2-secret
AWS_ENDPOINT=https://your-idrive-e2-endpoint.com
AWS_BUCKET=your-bucket-name
REGION=us-east-1
```

## Docker Usage

### Build

```bash
docker-compose build
```

### Run

```bash
docker-compose up
```

App will be available at http://localhost:3000
## Using the API

The API endpoint `/api/create-video` accepts:

- **Form-data**:  
  - `audio`: MP3 file  
  - `image`: PNG file  
- **JSON body**:  
  - `audioUrl`: URL to MP3 file  
  - `imageUrl`: URL to PNG file  
  - `outputUrl`: Optional URL for output MP4

Example using `curl`:

```
curl -X POST http://localhost:3000/create-video \
  -F "audio=@/path/to/audio.mp3" \
  -F "image=@/path/to/image.png" \
  -H "Content-Type: multipart/form-data"
```

Or with URLs:

```
curl -X POST http://localhost:3000/create-video \
  -H "Content-Type: application/json" \
  -d '{"audioUrl":"https://example.com/audio.mp3","imageUrl":"https://example.com/image.png"}'
```

## Notes

- The application creates H.264 MP4 videos compatible with most players.  
- HTTP URLs are downloaded using `axios` and processed locally.  
- Output files are stored in the `uploads` directory or at the specified `outputUrl`.  
- The Docker image includes FFmpeg, ensuring consistency across environments.  
- For production, add authentication, rate limiting, and input validation.  
- Clean up the `uploads` directory periodically to manage disk space.

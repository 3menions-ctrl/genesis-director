# Cloud Run FFmpeg Video Stitcher

Production-grade video stitching service using FFmpeg for lossless concatenation and audio injection.

## Features

- ✅ **Lossless Concatenation**: Uses FFmpeg concat demuxer (no re-encoding)
- ✅ **Audio Injection**: Overlay background music spanning full duration
- ✅ **Error Validation**: Detects missing/corrupted clips before processing
- ✅ **Auto-Upload**: Uploads final MP4 to Supabase Storage
- ✅ **Dashboard Update**: Updates project status on completion

## Deployment to Google Cloud Run

### Prerequisites

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
2. A GCP project with billing enabled
3. Docker installed locally (for testing)

### Step 1: Set up GCP Project

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### Step 2: Create Artifact Registry

```bash
# Create a Docker repository
gcloud artifacts repositories create video-stitcher \
  --repository-format=docker \
  --location=us-central1 \
  --description="Video stitcher Docker images"
```

### Step 3: Build and Push

```bash
# Navigate to this directory
cd cloud-run-stitcher

# Configure Docker for Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push using Cloud Build
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/$PROJECT_ID/video-stitcher/ffmpeg-stitcher:latest
```

### Step 4: Deploy to Cloud Run

```bash
# Deploy with required environment variables
gcloud run deploy ffmpeg-stitcher \
  --image us-central1-docker.pkg.dev/$PROJECT_ID/video-stitcher/ffmpeg-stitcher:latest \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 600 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=https://ahlikyhgcqvrdvbtkghh.supabase.co" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
```

### Step 5: Get Service URL

```bash
# Get the deployed URL
gcloud run services describe ffmpeg-stitcher \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)'
```

### Step 6: Add URL to Supabase Secrets

Add the Cloud Run URL as a secret in your Supabase project:

```
CLOUD_RUN_STITCHER_URL=https://ffmpeg-stitcher-xxxxx-uc.a.run.app
```

## API Endpoints

### POST /stitch

Stitch multiple video clips into a single video.

**Request:**
```json
{
  "projectId": "uuid",
  "projectTitle": "My Movie",
  "clips": [
    {
      "shotId": "shot-1",
      "videoUrl": "https://...",
      "durationSeconds": 4
    }
  ],
  "audioMixMode": "full",
  "backgroundMusicUrl": "https://...",
  "outputFormat": "mp4"
}
```

**Response (Success):**
```json
{
  "success": true,
  "finalVideoUrl": "https://...",
  "durationSeconds": 24,
  "clipsProcessed": 6
}
```

**Response (Validation Error):**
```json
{
  "success": false,
  "error": "Some clips failed validation",
  "invalidClips": [{ "shotId": "shot-3", "error": "..." }],
  "requiresRegeneration": ["shot-3"]
}
```

### POST /validate

Validate clips without processing.

### GET /

Health check endpoint.

## Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export SUPABASE_URL=https://ahlikyhgcqvrdvbtkghh.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-key

# Run locally
npm start
```

## Cost Estimation

- Cloud Run: ~$0.01-0.05 per 24-second video stitch
- Storage: Supabase storage costs apply
- No per-render API fees (unlike Creatomate)

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Edge Function  │────▶│   Cloud Run + FFmpeg │────▶│ Supabase Storage│
│  (orchestrator) │     │   (video processing) │     │  (final output) │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │                         │
        │                         ├── Download clips
        │                         ├── Validate with FFprobe
        │                         ├── Lossless concat
        │                         ├── Audio injection
        │                         └── Upload to storage
        │
        └── Trigger regeneration for invalid clips
```

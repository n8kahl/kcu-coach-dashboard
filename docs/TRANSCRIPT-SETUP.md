# Transcript System Setup

This document explains how to enable automatic transcription for video content.

## How It Works

1. **Video Upload**: Videos are uploaded to Cloudflare Stream
2. **Webhook Notification**: Cloudflare sends a webhook when video processing completes
3. **Job Enqueue**: The webhook handler enqueues a transcript job in `transcript_jobs` table
4. **Transcription**: The cron endpoint or worker processes jobs:
   - First tries Cloudflare's built-in captions
   - Falls back to OpenAI Whisper if captions not available
5. **Storage**: Transcript text is saved to `course_lessons.transcript_text`
6. **Segments**: Timestamped segments are saved to `transcript_segments` table

## Setup Options

### Option A: Cron Endpoint (Recommended for Serverless)

Use the cron endpoint for serverless platforms like Vercel or Railway.

1. **Set environment variable**:
   ```
   CRON_SECRET=your-secure-random-string
   ```

2. **Configure cron job** (examples):

   **Vercel** (`vercel.json`):
   ```json
   {
     "crons": [{
       "path": "/api/cron/process-transcripts",
       "schedule": "*/5 * * * *"
     }]
   }
   ```

   **Railway**: Use Railway's cron service to call:
   ```
   GET https://your-app.railway.app/api/cron/process-transcripts
   Authorization: Bearer your-cron-secret
   ```

   **External scheduler** (cron-job.org, etc.):
   ```bash
   curl -X GET "https://your-app.com/api/cron/process-transcripts" \
     -H "Authorization: Bearer your-cron-secret"
   ```

### Option B: Background Worker (For VMs/Containers)

Run the worker script as a persistent service:

```bash
# Install dependencies
npm install

# Run the worker
npx tsx scripts/transcript-worker.ts
```

For production, use a process manager like PM2:
```bash
pm2 start "npx tsx scripts/transcript-worker.ts" --name transcript-worker
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | For Whisper transcription fallback |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token with Stream access |
| `CRON_SECRET` | For cron | Protects the cron endpoint |

## Manual Transcription

Admins can manually trigger transcription from the Content Studio:

1. Go to Admin → Content Studio
2. Select a video/lesson
3. Click "Generate Transcript"

Or use the API directly:
```bash
POST /api/admin/content/video/transcribe
{
  "lessonId": "lesson-uuid",
  "generateEmbeddings": true
}
```

## Monitoring

Check transcript job status:
```sql
-- Pending jobs
SELECT * FROM transcript_jobs WHERE status = 'pending';

-- Failed jobs (will not retry)
SELECT * FROM transcript_jobs WHERE status = 'failed';

-- Recent completions
SELECT * FROM transcript_jobs
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;
```

## Troubleshooting

### "No captions available" + Whisper fails
- Ensure `OPENAI_API_KEY` is set
- Check if video downloads are enabled in Cloudflare Stream
- Video might be too large for Whisper (>25MB)

### Jobs stuck in "processing"
- Worker/cron may have crashed mid-job
- Reset stuck jobs:
  ```sql
  UPDATE transcript_jobs
  SET status = 'pending', attempts = attempts
  WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '10 minutes';
  ```

### Transcripts not appearing
1. Check if job completed: `SELECT * FROM transcript_jobs WHERE content_id = 'lesson-id'`
2. Check lesson record: `SELECT transcript_text FROM course_lessons WHERE id = 'lesson-id'`
3. Check for errors in logs

## Performance Notes

- The cron endpoint processes up to 3 jobs per invocation
- Each transcription takes ~30-60 seconds depending on video length
- Jobs are prioritized by `priority` field (higher = first)
- Failed jobs retry up to 3 times with exponential backoff

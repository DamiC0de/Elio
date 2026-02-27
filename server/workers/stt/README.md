# Elio STT Worker — faster-whisper

Speech-to-text worker utilisant faster-whisper (CTranslate2) en CPU.

## Setup

```bash
cd workers/stt
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Lancement

```bash
# Nécessite Redis
python main.py
```

## Configuration (env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `STT_MODEL_SIZE` | `small` | Modèle Whisper (tiny/base/small/medium) |
| `STT_COMPUTE_TYPE` | `int8` | Quantization (int8/float16/float32) |
| `STT_CPU_THREADS` | `4` | Threads CPU |
| `STT_LANGUAGE` | `fr` | Langue cible |
| `REDIS_HOST` | `localhost` | Host Redis |
| `REDIS_PORT` | `6379` | Port Redis |
| `STT_HEALTH_PORT` | `5001` | Port healthcheck HTTP |

## Protocol Redis

**Job (push to `stt:jobs`):**
```json
{
  "job_id": "uuid",
  "audio_base64": "base64-encoded-wav-or-opus"
}
```

**Result (get from `stt:result:{job_id}`):**
```json
{
  "job_id": "uuid",
  "status": "success",
  "text": "transcription",
  "language": "fr",
  "duration_ms": 280,
  "audio_duration": 4.5
}
```

"""
Elio STT Worker — faster-whisper speech-to-text service.

Listens on Redis queue for audio transcription jobs.
Also exposes a /health HTTP endpoint for monitoring.
"""

import json
import time
import base64
import tempfile
import threading
import logging
from pathlib import Path

import redis
from faster_whisper import WhisperModel
from flask import Flask, jsonify

from config import (
    MODEL_SIZE, COMPUTE_TYPE, CPU_THREADS, LANGUAGE, BEAM_SIZE,
    REDIS_HOST, REDIS_PORT, REDIS_DB,
    QUEUE_NAME, RESULT_PREFIX, JOB_TIMEOUT,
    HEALTH_PORT,
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}',
)
logger = logging.getLogger("stt-worker")

# Load model at startup (no cold start per request)
logger.info(f"Loading Whisper model: {MODEL_SIZE} ({COMPUTE_TYPE}, {CPU_THREADS} threads)")
model = WhisperModel(
    MODEL_SIZE,
    device="cpu",
    compute_type=COMPUTE_TYPE,
    cpu_threads=CPU_THREADS,
)
logger.info("Model loaded successfully")

# Redis connection
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# Stats
stats = {
    "jobs_processed": 0,
    "jobs_failed": 0,
    "total_audio_seconds": 0.0,
    "total_processing_ms": 0.0,
    "started_at": time.time(),
}


def transcribe_audio(audio_bytes: bytes) -> dict:
    """Transcribe audio bytes to text using faster-whisper."""
    start = time.perf_counter()

    # Write to temp file (faster-whisper needs a file path)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        temp_path = f.name

    try:
        segments, info = model.transcribe(
            temp_path,
            language=LANGUAGE,
            beam_size=BEAM_SIZE,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
            ),
        )

        # Collect all segments
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())

        text = " ".join(text_parts)
        duration_ms = round((time.perf_counter() - start) * 1000)

        return {
            "text": text,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
            "duration_ms": duration_ms,
            "audio_duration": round(info.duration, 2),
        }
    finally:
        Path(temp_path).unlink(missing_ok=True)


def process_job(job_data: str) -> None:
    """Process a single STT job from Redis."""
    try:
        job = json.loads(job_data)
        job_id = job.get("job_id", "unknown")
        logger.info(f"Processing job {job_id}")

        # Decode audio
        audio_b64 = job.get("audio_base64", "")
        audio_bytes = base64.b64decode(audio_b64)

        # Transcribe
        result = transcribe_audio(audio_bytes)
        result["job_id"] = job_id
        result["status"] = "success"

        # Update stats
        stats["jobs_processed"] += 1
        stats["total_audio_seconds"] += result.get("audio_duration", 0)
        stats["total_processing_ms"] += result["duration_ms"]

        logger.info(
            f"Job {job_id} done: '{result['text'][:80]}...' "
            f"({result['duration_ms']}ms, {result.get('audio_duration', 0)}s audio)"
        )

        # Publish result
        r.set(
            f"{RESULT_PREFIX}{job_id}",
            json.dumps(result),
            ex=60,  # Expire after 60s
        )

    except Exception as e:
        stats["jobs_failed"] += 1
        logger.error(f"Job failed: {e}")

        job_id = "unknown"
        try:
            job_id = json.loads(job_data).get("job_id", "unknown")
        except Exception:
            pass

        r.set(
            f"{RESULT_PREFIX}{job_id}",
            json.dumps({"job_id": job_id, "status": "error", "error": str(e)}),
            ex=60,
        )


def worker_loop():
    """Main worker loop — blocks on Redis BRPOP."""
    logger.info(f"Worker listening on queue: {QUEUE_NAME}")

    while True:
        try:
            result = r.brpop(QUEUE_NAME, timeout=JOB_TIMEOUT)
            if result:
                _, job_data = result
                process_job(job_data.decode("utf-8"))
        except redis.ConnectionError:
            logger.warning("Redis connection lost, retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            logger.error(f"Worker error: {e}")
            time.sleep(1)


# Health endpoint
health_app = Flask(__name__)


@health_app.route("/health")
def health():
    uptime = round(time.time() - stats["started_at"])
    avg_ms = 0
    if stats["jobs_processed"] > 0:
        avg_ms = round(stats["total_processing_ms"] / stats["jobs_processed"])

    return jsonify({
        "status": "ok",
        "service": "stt-worker",
        "model": f"{MODEL_SIZE}-{COMPUTE_TYPE}",
        "uptime_seconds": uptime,
        "jobs_processed": stats["jobs_processed"],
        "jobs_failed": stats["jobs_failed"],
        "avg_processing_ms": avg_ms,
    })


if __name__ == "__main__":
    # Start health server in background thread
    health_thread = threading.Thread(
        target=lambda: health_app.run(host="0.0.0.0", port=HEALTH_PORT),
        daemon=True,
    )
    health_thread.start()
    logger.info(f"Health endpoint running on :{HEALTH_PORT}/health")

    # Start worker
    worker_loop()

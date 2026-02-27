"""
Elio TTS Worker — Piper ONNX text-to-speech service.

Listens on Redis queue for text synthesis jobs.
Supports streaming by sentence for low TTFB.
"""

import json
import time
import base64
import io
import re
import wave
import threading
import logging

import redis
from piper import PiperVoice
from flask import Flask, jsonify

from config import (
    MODEL_PATH, MODEL_CONFIG,
    REDIS_HOST, REDIS_PORT, REDIS_DB,
    QUEUE_NAME, RESULT_PREFIX, JOB_TIMEOUT,
    HEALTH_PORT,
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}',
)
logger = logging.getLogger("tts-worker")

# Load model at startup
logger.info(f"Loading Piper model: {MODEL_PATH}")
try:
    voice = PiperVoice.load(MODEL_PATH, config_path=MODEL_CONFIG)
    logger.info("Piper model loaded successfully")
except Exception as e:
    logger.warning(f"Could not load Piper model: {e}. Worker will start but synthesis will fail.")
    voice = None

# Redis
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# Stats
stats = {
    "jobs_processed": 0,
    "jobs_failed": 0,
    "total_chars": 0,
    "total_processing_ms": 0.0,
    "started_at": time.time(),
}

# Sentence splitter
SENTENCE_RE = re.compile(r'(?<=[.!?:;])\s+')


def split_sentences(text: str) -> list[str]:
    """Split text into sentences for streaming TTS."""
    sentences = SENTENCE_RE.split(text.strip())
    return [s.strip() for s in sentences if s.strip()]


def synthesize_text(text: str) -> bytes:
    """Synthesize text to WAV bytes using Piper."""
    if voice is None:
        raise RuntimeError("Piper model not loaded")

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        voice.synthesize(text, wav_file)

    return buffer.getvalue()


def process_job(job_data: str) -> None:
    """Process a single TTS job from Redis."""
    try:
        job = json.loads(job_data)
        job_id = job.get("job_id", "unknown")
        text = job.get("text", "")
        streaming = job.get("streaming", False)

        if not text:
            raise ValueError("Empty text")

        logger.info(f"Processing job {job_id}: '{text[:60]}...' (streaming={streaming})")
        start = time.perf_counter()

        if streaming:
            # Stream by sentence
            sentences = split_sentences(text)
            for i, sentence in enumerate(sentences):
                audio_bytes = synthesize_text(sentence)
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")

                chunk_result = {
                    "job_id": job_id,
                    "status": "chunk",
                    "chunk_index": i,
                    "is_last": i == len(sentences) - 1,
                    "audio_base64": audio_b64,
                    "text": sentence,
                }

                r.rpush(f"{RESULT_PREFIX}{job_id}:chunks", json.dumps(chunk_result))

            duration_ms = round((time.perf_counter() - start) * 1000)
            r.set(
                f"{RESULT_PREFIX}{job_id}",
                json.dumps({
                    "job_id": job_id,
                    "status": "success",
                    "chunks_count": len(sentences),
                    "duration_ms": duration_ms,
                }),
                ex=60,
            )
        else:
            # Full synthesis
            audio_bytes = synthesize_text(text)
            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            duration_ms = round((time.perf_counter() - start) * 1000)

            r.set(
                f"{RESULT_PREFIX}{job_id}",
                json.dumps({
                    "job_id": job_id,
                    "status": "success",
                    "audio_base64": audio_b64,
                    "duration_ms": duration_ms,
                    "chars": len(text),
                }),
                ex=60,
            )

        stats["jobs_processed"] += 1
        stats["total_chars"] += len(text)
        stats["total_processing_ms"] += duration_ms
        logger.info(f"Job {job_id} done in {duration_ms}ms ({len(text)} chars)")

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
    """Main worker loop."""
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
        "service": "tts-worker",
        "model": MODEL_PATH,
        "model_loaded": voice is not None,
        "uptime_seconds": uptime,
        "jobs_processed": stats["jobs_processed"],
        "jobs_failed": stats["jobs_failed"],
        "avg_processing_ms": avg_ms,
    })


if __name__ == "__main__":
    health_thread = threading.Thread(
        target=lambda: health_app.run(host="0.0.0.0", port=HEALTH_PORT),
        daemon=True,
    )
    health_thread.start()
    logger.info(f"Health endpoint running on :{HEALTH_PORT}/health")

    worker_loop()

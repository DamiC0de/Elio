"""TTS Worker configuration."""

import os

# Model
MODEL_PATH = os.getenv("TTS_MODEL_PATH", "models/fr_FR-siwis-medium.onnx")
MODEL_CONFIG = os.getenv("TTS_MODEL_CONFIG", "models/fr_FR-siwis-medium.onnx.json")

# Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# Queue
QUEUE_NAME = os.getenv("TTS_QUEUE_NAME", "tts:jobs")
RESULT_PREFIX = os.getenv("TTS_RESULT_PREFIX", "tts:result:")
JOB_TIMEOUT = int(os.getenv("TTS_JOB_TIMEOUT", "10"))

# Server
HEALTH_PORT = int(os.getenv("TTS_HEALTH_PORT", "5002"))

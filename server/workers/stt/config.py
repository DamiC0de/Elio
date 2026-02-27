"""STT Worker configuration."""

import os

# Model
MODEL_SIZE = os.getenv("STT_MODEL_SIZE", "small")
COMPUTE_TYPE = os.getenv("STT_COMPUTE_TYPE", "int8")
CPU_THREADS = int(os.getenv("STT_CPU_THREADS", "4"))
LANGUAGE = os.getenv("STT_LANGUAGE", "fr")
BEAM_SIZE = int(os.getenv("STT_BEAM_SIZE", "1"))

# Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# Queue
QUEUE_NAME = os.getenv("STT_QUEUE_NAME", "stt:jobs")
RESULT_PREFIX = os.getenv("STT_RESULT_PREFIX", "stt:result:")
JOB_TIMEOUT = int(os.getenv("STT_JOB_TIMEOUT", "10"))

# Server
HEALTH_PORT = int(os.getenv("STT_HEALTH_PORT", "5001"))

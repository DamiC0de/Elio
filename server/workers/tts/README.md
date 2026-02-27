# Elio TTS Worker — Piper ONNX

Text-to-speech worker utilisant Piper ONNX en CPU.

## Setup

```bash
cd workers/tts
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Télécharger un modèle FR
mkdir -p models
wget -O models/fr_FR-siwis-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx
wget -O models/fr_FR-siwis-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json
```

## Lancement

```bash
python main.py
```

## Protocol Redis

**Job (push to `tts:jobs`):**
```json
{
  "job_id": "uuid",
  "text": "Bonjour, comment puis-je t'aider ?",
  "streaming": true
}
```

**Result — full mode (`tts:result:{job_id}`):**
```json
{
  "job_id": "uuid",
  "status": "success",
  "audio_base64": "...",
  "duration_ms": 180,
  "chars": 35
}
```

**Result — streaming mode (`tts:result:{job_id}:chunks` list):**
```json
{
  "job_id": "uuid",
  "status": "chunk",
  "chunk_index": 0,
  "is_last": false,
  "audio_base64": "...",
  "text": "Bonjour."
}
```

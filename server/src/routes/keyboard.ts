/**
 * Keyboard Extension API
 * 
 * Processes voice input from the Diva iOS keyboard extension.
 * - Receives audio (base64)
 * - Transcribes via Whisper
 * - Optionally reformulates via Claude
 * - Returns text for insertion
 */
import type { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Whisper API configuration
const WHISPER_URL = process.env['OPENAI_STT_BASE_URL'] || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || '';

export async function keyboardRoutes(app: FastifyInstance) {
  /**
   * Process voice input from keyboard
   */
  app.post('/api/v1/keyboard/process', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const userId = request.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { audio, format, text: inputText, mode } = request.body as {
      audio?: string; // base64 audio
      format?: string; // audio format (m4a, wav, etc.)
      text?: string; // direct text input (alternative to audio)
      mode?: 'transcribe' | 'reformulate' | 'command'; // processing mode
    };

    const processingMode = mode || 'reformulate';

    try {
      let transcribedText = inputText;

      // Step 1: Transcribe audio if provided
      if (audio && !inputText) {
        transcribedText = await transcribeAudio(audio, format || 'm4a');
        
        if (!transcribedText) {
          return reply.send({ 
            success: false, 
            error: 'Transcription failed',
            text: '' 
          });
        }
      }

      if (!transcribedText) {
        return reply.send({ 
          success: false, 
          error: 'No audio or text provided',
          text: '' 
        });
      }

      // Step 2: Process based on mode
      let outputText = transcribedText;
      let actions: any[] = [];

      if (processingMode === 'reformulate') {
        // Reformulate the text to be cleaner/more professional
        outputText = await reformulateText(transcribedText);
      } else if (processingMode === 'command') {
        // Execute as a Diva command and get response
        // This would integrate with the full orchestrator
        // For now, just reformulate
        outputText = await reformulateText(transcribedText);
      }
      // 'transcribe' mode just returns the raw transcription

      return reply.send({
        success: true,
        text: outputText,
        original: transcribedText,
        mode: processingMode,
        actions,
      });

    } catch (err: any) {
      app.log.error({ err }, 'Keyboard processing error');
      return reply.status(500).send({
        success: false,
        error: err.message || 'Processing failed',
        text: '',
      });
    }
  });
}

/**
 * Transcribe audio using Whisper API
 */
async function transcribeAudio(base64Audio: string, format: string): Promise<string> {
  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    
    // Create form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: `audio/${format}` });
    formData.append('file', audioBlob, `audio.${format}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    const response = await fetch(`${WHISPER_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error('[Keyboard] Whisper API error:', response.status);
      return '';
    }

    const result = await response.json() as { text: string };
    return result.text;
  } catch (err) {
    console.error('[Keyboard] Transcription error:', err);
    return '';
  }
}

/**
 * Reformulate text to be cleaner and more professional
 */
async function reformulateText(text: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: process.env['ANTHROPIC_MODEL'] || 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Reformule ce texte dicté pour qu'il soit clair, bien ponctué et prêt à être envoyé. 
Garde le sens original et le ton. Ne change pas le message, juste améliore la forme.
Si c'est déjà bien, retourne-le tel quel.

Texte dicté: "${text}"

Réponds UNIQUEMENT avec le texte reformulé, sans guillemets ni explication.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text.trim();
    }
    return text;
  } catch (err) {
    console.error('[Keyboard] Reformulation error:', err);
    return text; // Return original if reformulation fails
  }
}

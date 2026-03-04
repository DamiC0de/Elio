/**
 * Cancel command detection — US-007
 * Detects vocal cancel commands to interrupt Diva.
 */

const CANCEL_COMMANDS = [
  'annule', 'annuler', 'cancel',
  'stop', 'arrête', 'arrêter',
  'tais-toi', 'tais toi', 'silence',
  'non', 'laisse tomber', 'rien',
  'oublie', 'oublie ça', 'tant pis',
];

/**
 * Check if a transcript is a cancel command.
 * Handles exact matches and partial matches at start/end of text.
 */
export function isCancelCommand(text: string): boolean {
  if (!text) return false;
  
  const lowered = text.toLowerCase().trim();
  
  // Short phrases are likely just cancel commands
  const wordCount = lowered.split(/\s+/).length;
  
  return CANCEL_COMMANDS.some(cmd => {
    // Exact match
    if (lowered === cmd) return true;
    
    // For short inputs (1-3 words), check if it contains the command
    if (wordCount <= 3) {
      // Starts with command
      if (lowered.startsWith(cmd + ' ') || lowered.startsWith(cmd + ',')) return true;
      // Ends with command
      if (lowered.endsWith(' ' + cmd) || lowered.endsWith(',' + cmd)) return true;
      // Contains as standalone word
      if (lowered.includes(' ' + cmd + ' ')) return true;
    }
    
    return false;
  });
}

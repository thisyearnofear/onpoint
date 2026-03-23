/**
 * Persona Voice Synthesis
 *
 * Maps persona IDs to specific SpeechSynthesisUtterance properties.
 * Low technical overhead, significant "vibe" improvement for Live AR sessions.
 *
 * Design: Single source of truth (DRY), composable (MODULAR), enhancement-first.
 */

// ── Types ──

export type StylistPersona =
  | "luxury"
  | "streetwear"
  | "sustainable"
  | "edina"
  | "miranda"
  | "shaft";

export interface VoiceProfile {
  pitch: number;      // 0.1 to 2.0
  rate: number;       // 0.1 to 10.0
  volume: number;     // 0 to 1
  preferredVoice?: string; // Substring to match in available voices
  fallbackVoice?: string;
}

// ── Voice Profiles ──

const VOICE_PROFILES: Record<StylistPersona, VoiceProfile> = {
  luxury: {
    pitch: 0.9,
    rate: 0.85,
    volume: 0.9,
    preferredVoice: "Samantha",
    fallbackVoice: "Karen",
  },
  streetwear: {
    pitch: 1.1,
    rate: 1.15,
    volume: 1.0,
    preferredVoice: "Alex",
    fallbackVoice: "Daniel",
  },
  sustainable: {
    pitch: 1.0,
    rate: 0.95,
    volume: 0.85,
    preferredVoice: "Moira",
    fallbackVoice: "Fiona",
  },
  edina: {
    pitch: 1.3,
    rate: 1.3,
    volume: 1.0,
    preferredVoice: "Karen",
    fallbackVoice: "Samantha",
  },
  miranda: {
    pitch: 0.7,
    rate: 0.75,
    volume: 0.95,
    preferredVoice: "Daniel",
    fallbackVoice: "Alex",
  },
  shaft: {
    pitch: 0.6,
    rate: 0.9,
    volume: 1.0,
    preferredVoice: "Alex",
    fallbackVoice: "Daniel",
  },
};

// ── Default Profile ──

const DEFAULT_PROFILE: VoiceProfile = {
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
};

// ── Core Functions ──

/**
 * Get voice profile for a persona.
 */
export function getVoiceProfile(persona: string): VoiceProfile {
  return VOICE_PROFILES[persona as StylistPersona] || DEFAULT_PROFILE;
}

/**
 * Find the best matching voice from available system voices.
 */
export function findBestVoice(
  profile: VoiceProfile,
  availableVoices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (availableVoices.length === 0) return null;

  // Try preferred voice
  if (profile.preferredVoice) {
    const preferred = availableVoices.find((v) =>
      v.name.toLowerCase().includes(profile.preferredVoice!.toLowerCase()),
    );
    if (preferred) return preferred;
  }

  // Try fallback voice
  if (profile.fallbackVoice) {
    const fallback = availableVoices.find((v) =>
      v.name.toLowerCase().includes(profile.fallbackVoice!.toLowerCase()),
    );
    if (fallback) return fallback;
  }

  // Try English voices
  const englishVoice = availableVoices.find((v) =>
    v.lang.startsWith("en"),
  );
  if (englishVoice) return englishVoice;

  // Return first available
  return availableVoices[0] || null;
}

/**
 * Create a configured SpeechSynthesisUtterance for a persona.
 */
export function createPersonaUtterance(
  text: string,
  persona: string,
): SpeechSynthesisUtterance {
  const profile = getVoiceProfile(persona);
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.pitch = profile.pitch;
  utterance.rate = profile.rate;
  utterance.volume = profile.volume;

  // Try to set voice (voices may not be loaded yet)
  const voices = window.speechSynthesis?.getVoices() || [];
  const bestVoice = findBestVoice(profile, voices);
  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  return utterance;
}

/**
 * Speak text with persona-specific voice.
 * Returns a promise that resolves when speech ends.
 */
export function speakAsPersona(
  text: string,
  persona: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = createPersonaUtterance(text, persona);

    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      // Don't reject on interrupt — it's expected behavior
      if (event.error === "interrupted") {
        resolve();
      } else {
        reject(new Error(`Speech synthesis error: ${event.error}`));
      }
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stop any ongoing speech.
 */
export function stopSpeaking(): void {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if speech synthesis is available.
 */
export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

// ── Exports ──

export const PersonaVoice = {
  getVoiceProfile,
  findBestVoice,
  createPersonaUtterance,
  speakAsPersona,
  stopSpeaking,
  isSpeechSynthesisAvailable,
  VOICE_PROFILES,
};
/**
 * Digital Somesh Voice Hook
 *
 * Triggers voice alerts for key market events using Web Speech API.
 * Somesh is the trading mentor persona who delivers hard truths.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LTP2Score } from '@/lib/ltp-gamma-engine';

export type VoiceTrigger =
  | 'call_wall_reject'
  | 'put_wall_bounce'
  | 'zero_gamma_cross'
  | 'sniper_setup'
  | 'dumb_trade'
  | 'patience_candle'
  | 'vwap_reclaim'
  | 'vwap_rejection'
  | 'trend_flip';

interface VoiceAlert {
  trigger: VoiceTrigger;
  message: string;
  priority: number; // Higher = more important, will interrupt lower priority
}

// Somesh's wisdom library
const VOICE_ALERTS: Record<VoiceTrigger, string[]> = {
  call_wall_reject: [
    "Call Wall rejection. Don't be a bitch chasing tops.",
    "Call Wall says no. Respect the gamma, bro.",
    "Rejected at Call Wall. The smart money is fading this.",
    "Call Wall rejection confirmed. This is where retail gets trapped.",
  ],
  put_wall_bounce: [
    "Put Wall bounce. Don't short the hole.",
    "Put Wall held. Dealers are defending this level.",
    "Bouncing off Put Wall support. Watch for a reclaim of VWAP.",
    "Put Wall bounce confirmed. Short squeeze potential here.",
  ],
  zero_gamma_cross: [
    "Entering Volatility Zone. Stops hunt incoming.",
    "Zero Gamma crossed. Expect wild swings both ways.",
    "We're in no man's land now. Dealers aren't pinning price here.",
    "Zero Gamma breach. Volatility about to expand. Size down.",
  ],
  sniper_setup: [
    "Sniper setup forming. Patience pays.",
    "All factors aligned. This is the A plus setup we wait for.",
    "Sniper entry confirmed. Execute with confidence.",
    "Beautiful confluence here. Take the trade, manage the risk.",
  ],
  dumb_trade: [
    "That's a dumb shit trade. Don't do it.",
    "Low probability setup. Your edge is not here.",
    "This is where traders blow up accounts. Walk away.",
    "No confluence. No trade. It's that simple.",
  ],
  patience_candle: [
    "Patience candle confirmed. Entry signal activated.",
    "Inside bar breakout setup. Wait for the trigger.",
    "Patience candle forming. Get ready but don't jump early.",
    "The market is coiling. Expansion coming soon.",
  ],
  vwap_reclaim: [
    "VWAP reclaimed. Bulls back in control.",
    "Back above VWAP. Dip buyers stepping in.",
    "VWAP reclaim confirmed. Look for continuation higher.",
    "Strong VWAP reclaim. Shorts are trapped here.",
  ],
  vwap_rejection: [
    "VWAP rejection. Bears defending.",
    "Failed VWAP reclaim. Weakness confirmed.",
    "Rejected at VWAP. Lower prices coming.",
    "VWAP acting as resistance. Don't fight it.",
  ],
  trend_flip: [
    "Trend flip detected. Adjust your bias.",
    "Cloud color change. New trend emerging.",
    "EMAs crossed. Trend is shifting.",
    "Major trend change. Reassess your positions.",
  ],
};

// Priority levels (higher = more important)
const TRIGGER_PRIORITY: Record<VoiceTrigger, number> = {
  sniper_setup: 10,
  call_wall_reject: 9,
  put_wall_bounce: 9,
  zero_gamma_cross: 8,
  dumb_trade: 7,
  trend_flip: 6,
  vwap_reclaim: 5,
  vwap_rejection: 5,
  patience_candle: 4,
};

interface UseSomeshVoiceOptions {
  enabled?: boolean;
  volume?: number; // 0-1
  rate?: number;   // 0.5-2
  pitch?: number;  // 0-2
  cooldownMs?: number; // Minimum time between same trigger
}

interface UseSomeshVoiceReturn {
  speak: (trigger: VoiceTrigger) => void;
  speakCustom: (message: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  lastTrigger: VoiceTrigger | null;

  // Convenience methods for common events
  checkScore: (score: LTP2Score) => void;
  onCallWallProximity: (isNear: boolean, wasNear: boolean) => void;
  onPutWallProximity: (isNear: boolean, wasNear: boolean) => void;
  onZeroGammaCross: (crossed: boolean, wasCrossed: boolean) => void;
  onVWAPCross: (aboveVwap: boolean, wasAboveVwap: boolean) => void;
}

export function useSomeshVoice(options: UseSomeshVoiceOptions = {}): UseSomeshVoiceReturn {
  const {
    enabled: initialEnabled = true,
    volume = 0.8,
    rate = 1.0,
    pitch = 1.0,
    cooldownMs = 30000, // 30 second cooldown per trigger
  } = options;

  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastTrigger, setLastTrigger] = useState<VoiceTrigger | null>(null);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cooldownsRef = useRef<Map<VoiceTrigger, number>>(new Map());
  const currentPriorityRef = useRef<number>(0);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Get random message for trigger
  const getRandomMessage = useCallback((trigger: VoiceTrigger): string => {
    const messages = VOICE_ALERTS[trigger];
    return messages[Math.floor(Math.random() * messages.length)];
  }, []);

  // Check if trigger is on cooldown
  const isOnCooldown = useCallback((trigger: VoiceTrigger): boolean => {
    const lastTime = cooldownsRef.current.get(trigger);
    if (!lastTime) return false;
    return Date.now() - lastTime < cooldownMs;
  }, [cooldownMs]);

  // Core speak function
  const speakMessage = useCallback((message: string, priority: number = 5) => {
    if (!isEnabled || !synthRef.current) return;

    // If currently speaking something more important, don't interrupt
    if (isSpeaking && priority <= currentPriorityRef.current) {
      return;
    }

    // Cancel current speech if lower priority
    if (isSpeaking) {
      synthRef.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.volume = volume;
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Try to find a good voice (prefer male voices for Somesh)
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')
    ) || voices.find(
      (v) => v.lang.startsWith('en-US')
    ) || voices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      currentPriorityRef.current = priority;
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      currentPriorityRef.current = 0;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      currentPriorityRef.current = 0;
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [isEnabled, isSpeaking, volume, rate, pitch]);

  // Speak a trigger
  const speak = useCallback((trigger: VoiceTrigger) => {
    if (isOnCooldown(trigger)) return;

    const message = getRandomMessage(trigger);
    const priority = TRIGGER_PRIORITY[trigger];

    speakMessage(message, priority);
    cooldownsRef.current.set(trigger, Date.now());
    setLastTrigger(trigger);
  }, [isOnCooldown, getRandomMessage, speakMessage]);

  // Speak custom message
  const speakCustom = useCallback((message: string) => {
    speakMessage(message, 5);
  }, [speakMessage]);

  // Stop speaking
  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      currentPriorityRef.current = 0;
    }
  }, []);

  // Check LTP2 score and trigger appropriate voice
  const checkScore = useCallback((score: LTP2Score) => {
    if (score.grade === 'Sniper') {
      speak('sniper_setup');
    } else if (score.grade === 'Dumb Shit' && score.score < 30) {
      speak('dumb_trade');
    }
  }, [speak]);

  // Call Wall proximity handler
  const onCallWallProximity = useCallback((isNear: boolean, wasNear: boolean) => {
    // Trigger when we just got near and potentially rejected
    if (wasNear && !isNear) {
      speak('call_wall_reject');
    }
  }, [speak]);

  // Put Wall proximity handler
  const onPutWallProximity = useCallback((isNear: boolean, wasNear: boolean) => {
    // Trigger when we bounced off put wall
    if (wasNear && !isNear) {
      speak('put_wall_bounce');
    }
  }, [speak]);

  // Zero Gamma cross handler
  const onZeroGammaCross = useCallback((crossed: boolean, wasCrossed: boolean) => {
    if (crossed && !wasCrossed) {
      speak('zero_gamma_cross');
    }
  }, [speak]);

  // VWAP cross handler
  const onVWAPCross = useCallback((aboveVwap: boolean, wasAboveVwap: boolean) => {
    if (aboveVwap && !wasAboveVwap) {
      speak('vwap_reclaim');
    } else if (!aboveVwap && wasAboveVwap) {
      speak('vwap_rejection');
    }
  }, [speak]);

  return {
    speak,
    speakCustom,
    stop,
    isSpeaking,
    isEnabled,
    setEnabled: setIsEnabled,
    lastTrigger,
    checkScore,
    onCallWallProximity,
    onPutWallProximity,
    onZeroGammaCross,
    onVWAPCross,
  };
}

// Export voice alerts for reference
export { VOICE_ALERTS, TRIGGER_PRIORITY };

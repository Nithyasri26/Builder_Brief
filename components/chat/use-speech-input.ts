'use client';

import * as React from 'react';

/**
 * Voice input through the browser's own speech recognition.
 *
 * No speech model is built or shipped here, and the rest of the product does
 * not know voice exists: recognised text is handed to the same chat pipeline
 * as typed text. Swapping in a different recogniser is a change to this hook.
 */

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(onText: (text: string) => void) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = React.useRef(onText);
  onTextRef.current = onText;

  React.useEffect(() => {
    setSupported(Boolean(getRecognitionConstructor()));
  }, []);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const start = React.useCallback(() => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) {
      setError('Voice input is not available in this browser. You can type instead.');
      return;
    }
    setError(null);
    const recognition = new Constructor();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) transcript += result[0].transcript;
      }
      const clean = transcript.trim();
      if (clean) onTextRef.current(clean);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone permission was declined. You can type instead.'
          : 'Voice input did not work. You can type instead.',
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  React.useEffect(() => () => recognitionRef.current?.stop(), []);

  return {
    supported,
    listening,
    error,
    start,
    stop,
    toggle: () => (listening ? stop() : start()),
  };
}

import { useState, useCallback, useRef } from 'react';
import { LiveSession } from './providers/base-provider';
import { GeminiLiveProvider } from './providers/gemini-live-provider';

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [reasoning, setReasoning] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  const startSession = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Fetch provisioned config
      const response = await fetch('/api/ai/live-session', { method: 'POST' });
      const { config, error: provError } = await response.json().catch(() => ({}));
      if (provError || !config) throw new Error(provError || 'Failed to provision session');
      
      const provider = new GeminiLiveProvider({
        apiKey: config.apiKey,
        httpOptions: { baseUrl: config.baseURL }
      });
      
      const session = await provider.connectLiveSession!();
      
      // Attach listeners
      session.on('transcript', (text) => setTranscript(text));
      session.on('response', (text) => setAiResponse(prev => prev + ' ' + text));
      session.on('reasoning', (text) => setReasoning(prev => [text, ...prev].slice(0, 10)));
      session.on('error', (err) => setError(err));
      session.on('disconnected', () => setIsConnected(false));

      await session.connect();
      sessionRef.current = session;
      setIsConnected(true);

      // Start sending video frames (simple canvas capture at 1fps for analysis)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      frameIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && ctx && sessionRef.current) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          const base64Image = canvas.toDataURL('image/jpeg', 0.6);
          sessionRef.current.sendImage(base64Image);
        }
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start live session');
      console.error(err);
    } finally {
      setIsInitializing(false);
    }
  }, []);
  
  const stopSession = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setTranscript('');
    setAiResponse('');
    setReasoning([]);
  }, []);
  
  return {
    isConnected,
    isInitializing,
    error,
    transcript,
    aiResponse,
    reasoning,
    videoRef,
    startSession,
    stopSession
  };
}

import { useState, useCallback, useRef } from 'react';
import { LiveSession } from './providers/base-provider';
import { GeminiLiveProvider } from './providers/gemini-live-provider';

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  
  const startSession = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Fetch provisioned config from backend endpoint
      const response = await fetch('/api/ai/live-session', { method: 'POST' });
      if (!response.ok) {
         const errData = await response.json().catch(() => ({}));
         throw new Error(errData.error || 'Failed to provision Gemini Live session from server');
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      const config = data.config;

      const provider = new GeminiLiveProvider({
        apiKey: config.apiKey,
        httpOptions: { baseUrl: config.baseURL }
      });
      if (!provider.connectLiveSession) {
        throw new Error('GeminiLiveProvider does not support connectLiveSession');
      }
      
      const session = await provider.connectLiveSession();
      await session.connect();
      
      sessionRef.current = session;
      setIsConnected(true);
      
    } catch (err: any) {
      setError(err.message || 'Failed to start live session');
      console.error(err);
    } finally {
      setIsInitializing(false);
    }
  }, []);
  
  const stopSession = useCallback(() => {
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
  }, []);
  
  return {
    isConnected,
    isInitializing,
    error,
    videoRef,
    startSession,
    stopSession
  };
}

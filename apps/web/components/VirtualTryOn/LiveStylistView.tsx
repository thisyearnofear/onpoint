import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@repo/ui/card';
import { Button } from '@repo/ui/button';
import { Mic, Video, PhoneOff, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeminiLive } from '@repo/ai-client';

interface LiveStylistViewProps {
  onBack: () => void;
}

export function LiveStylistView({ onBack }: LiveStylistViewProps) {
  const { isConnected, isInitializing, error, videoRef, startSession, stopSession } = useGeminiLive();

  useEffect(() => {
    // Automatically start the session when entering this view, or user can click a button.
    // Let's require the user to explicitly click "Start Session" for better permission handling.
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return (
    <Card className="overflow-hidden border-primary/30 shadow-2xl bg-black/5 dark:bg-black/40 backdrop-blur-md relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background/50 to-accent/10 pointer-events-none" />
      
      <CardContent className="p-0 flex flex-col items-center justify-center min-h-[500px] relative z-10">
        
        {/* Holographic Header */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 backdrop-blur-md border border-white/10">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-sm font-medium tracking-wide">Live AR Stylist</span>
          </div>
          
          <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full bg-background/50 backdrop-blur-md hover:bg-destructive/20 hover:text-white">
            Exit
          </Button>
        </div>

        {/* Video Feed */}
        <div className="relative w-full h-full min-h-[500px] flex justify-center items-center bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-700 ${isConnected ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {/* Agent Active Indicator Overlay */}
          <AnimatePresence>
            {isConnected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 ring-inset ring-2 ring-primary/40 pointer-events-none"
              >
                {/* Simulated Audio/Vision Pulse */}
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Connection Controls/Status */}
          {!isConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shadow-[0_0_40px_rgba(var(--primary),0.5)]">
                <Video className="w-10 h-10 text-white" />
              </div>
              
              <h3 className="text-2xl font-semibold mb-2 text-white">Gemini Multimodal Agent</h3>
              <p className="text-white/70 max-w-sm mb-8">
                Your interruptible, real-time AI stylist. It sees what your camera sees and talks to you naturally.
              </p>
              
              {error ? (
                <div className="flex items-center gap-2 p-3 bg-destructive/20 text-red-200 rounded-lg max-w-sm mb-4">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm text-center">{error}</p>
                </div>
              ) : null}
              
              <Button 
                onClick={startSession} 
                disabled={isInitializing}
                className="rounded-full px-8 py-6 text-lg tracking-wide shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-shadow bg-white text-black hover:bg-white/90"
              >
                {isInitializing ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 animate-spin" /> Connecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mic className="w-5 h-5" /> Start Live Voice Session
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Live Controls */}
        <AnimatePresence>
          {isConnected && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute bottom-6 flex gap-4 z-20"
            >
              <div className="flex gap-2 p-2 rounded-full bg-background/80 backdrop-blur-xl border border-white/10 shadow-2xl">
                <Button variant="ghost" size="icon" className="rounded-full bg-primary/20 text-primary">
                  <Mic className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full bg-primary/20 text-primary">
                  <Video className="w-5 h-5" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="rounded-full hover:bg-destructive shadow-lg shadow-destructive/20"
                  onClick={stopSession}
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </CardContent>
    </Card>
  );
}

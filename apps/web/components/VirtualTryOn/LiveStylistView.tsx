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
  const { 
    isConnected, 
    isInitializing, 
    error, 
    videoRef, 
    startSession, 
    stopSession,
    transcript,
    aiResponse,
    reasoning
  } = useGeminiLive();

  const handleCapture = () => {
    // High-fidelity capture logic (Snapshot with AR Overlay)
    alert('Capture Snapshot ready for Farcaster! (Simulation)');
  };

  return (
    <Card className="overflow-hidden border-0 shadow-2xl bg-black relative rounded-2xl min-h-[600px]">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none z-10" />
      
      {/* Tactical Scanning HUD Overlay */}
      <AnimatePresence>
        {isConnected && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-20 pointer-events-none"
          >
            {/* Scanning Horizontal Line */}
            <motion.div 
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[1px] bg-primary/40 shadow-[0_0_15px_rgba(var(--primary),0.8)]"
            />
            {/* Corner Brackets */}
            <div className="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
            <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-primary/40 rounded-tr-lg" />
            <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-primary/40 rounded-bl-lg" />
            <div className="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      <CardContent className="p-0 flex flex-col items-center justify-center min-h-[600px] relative">
        
        {/* Top Navigation & Status */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-30">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/10">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
                {isConnected ? 'Agent Active' : 'System Standby'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-destructive/60">
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Live Reasoning Terminal (Side HUD) */}
        <AnimatePresence>
          {isConnected && reasoning.length > 0 && (
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="absolute left-6 top-24 w-48 z-30 hidden md:block"
            >
              <div className="p-3 rounded-lg bg-black/40 backdrop-blur-xl border border-white/5 font-mono text-[10px] space-y-2">
                <div className="text-primary/60 flex items-center gap-2">
                  <span className="animate-pulse">●</span> AGENT_REASONING
                </div>
                <div className="space-y-1">
                  {reasoning.map((item, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1 - (i * 0.15), x: 0 }}
                      className="text-white/70 overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                      {`> ${item}`}
                    </motion.div>
                  )) || null}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Transcription & AI Captions */}
        <AnimatePresence>
          {isConnected && (transcript || aiResponse) && (
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="absolute bottom-28 left-6 right-6 z-30 flex flex-col items-center gap-3 text-center"
            >
              {transcript && (
                <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-white/90 text-sm max-w-[80%]">
                  "{transcript}"
                </div>
              )}
              {aiResponse && (
                <div className="px-5 py-3 rounded-2xl bg-primary/20 backdrop-blur-xl border border-primary/30 text-white text-lg font-medium shadow-2xl shadow-primary/20 max-w-[90%] leading-snug">
                  {aiResponse}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Feed */}
        <div className="relative w-full h-full min-h-[600px] flex justify-center items-center bg-black overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-all duration-1000 ${isConnected ? 'scale-105 opacity-80' : 'opacity-40 grayscale'}`}
          />
          
          {/* Connection State UI */}
          {!isConnected && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-30">
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-32 h-32 mb-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_60px_rgba(var(--primary),0.6)]"
              >
                <Sparkles className="w-12 h-12 text-white" />
              </motion.div>
              
              <h2 className="text-3xl font-bold mb-3 text-white tracking-tight">OnPoint Intelligence</h2>
              <p className="text-white/60 max-w-sm mb-10 text-lg">
                Enter a live multimodal session with your personal celebrity stylist.
              </p>
              
              <Button 
                onClick={startSession} 
                disabled={isInitializing}
                className="rounded-full px-10 py-7 text-xl font-bold shadow-2xl shadow-primary/50 transition-all hover:scale-105 bg-white text-black active:scale-95"
              >
                {isInitializing ? "Initializing Neural Link..." : "Start Live Session"}
              </Button>
            </div>
          )}
        </div>

        {/* Floating Call Controls */}
        <AnimatePresence>
          {isConnected && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-6 z-40"
            >
              <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/5 text-white hover:bg-white/20">
                  <Mic className="w-5 h-5" />
                </Button>
                
                <Button 
                   onClick={handleCapture}
                   className="w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:scale-110 transition-transform"
                >
                  <Camera className="w-6 h-6" />
                </Button>

                <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/5 text-white hover:bg-white/20">
                  <Video className="w-5 h-5" />
                </Button>

                <div className="w-[1px] h-8 bg-white/10 mx-2" />

                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="w-12 h-12 rounded-full shadow-lg shadow-destructive/20"
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

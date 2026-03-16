import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@repo/ui/card';
import { Button } from '@repo/ui/button';
import { Mic, Video, PhoneOff, Sparkles, AlertCircle, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeminiLive } from '@repo/ai-client';
import { useMiniApp } from '@neynar/react';
import { sdk } from '@farcaster/miniapp-sdk';

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
  const { context } = useMiniApp();

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      // Draw video frame
      ctx.drawImage(videoRef.current, 0, 0);

      // Add HUD Overlays
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)'; // Primary color
      ctx.lineWidth = 4;
      
      // Draw corner brackets
      const margin = 40;
      const len = 60;
      // Top Left
      ctx.beginPath(); ctx.moveTo(margin, margin + len); ctx.lineTo(margin, margin); ctx.lineTo(margin + len, margin); ctx.stroke();
      // Top Right
      ctx.beginPath(); ctx.moveTo(canvas.width - margin - len, margin); ctx.lineTo(canvas.width - margin, margin); ctx.lineTo(canvas.width - margin, margin + len); ctx.stroke();
      // Bottom Left
      ctx.beginPath(); ctx.moveTo(margin, canvas.height - margin - len); ctx.lineTo(margin, canvas.height - margin); ctx.lineTo(margin + len, canvas.height - margin); ctx.stroke();
      // Bottom Right
      ctx.beginPath(); ctx.moveTo(canvas.width - margin - len, canvas.height - margin); ctx.lineTo(canvas.width - margin, canvas.height - margin); ctx.lineTo(canvas.width - margin, canvas.height - margin - len); ctx.stroke();

      // Draw AI Response if exists
      if (aiResponse) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const rectWidth = canvas.width * 0.8;
        const rectHeight = 100;
        const rectX = (canvas.width - rectWidth) / 2;
        const rectY = canvas.height - 180;
        
        // Rounded rect for text
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 20);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        
        // Text wrap support
        const words = aiResponse.split(' ');
        let line = '';
        let y = rectY + 60;
        for(let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > rectWidth - 40 && n > 0) {
            ctx.fillText(line, canvas.width / 2, y);
            line = words[n] + ' ';
            y += 40;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, canvas.width / 2, y);
      }

      // Branding
      ctx.fillStyle = 'rgba(124, 58, 237, 0.9)';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('BeOnPoint AR Stylist', margin + 20, margin + 40);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
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
          {isConnected && !capturedImage && (
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
                   disabled={isCapturing}
                   className="w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:scale-110 transition-transform"
                >
                  {isCapturing ? <Sparkles className="animate-spin w-6 h-6" /> : <Camera className="w-6 h-6" />}
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

        {/* Captured Preview & Share Overlay */}
        <AnimatePresence>
          {capturedImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6"
            >
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10 mb-8 max-w-2xl">
                <img src={capturedImage} className="w-full h-full object-cover" alt="Captured Frame" />
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-primary/80 backdrop-blur-md text-[10px] font-bold text-white tracking-widest uppercase">
                  Proof of Style
                </div>
              </div>

              <div className="flex flex-col gap-4 w-full max-w-xs">
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg font-bold"
                  disabled={isCapturing}
                  onClick={async () => {
                    try {
                      setIsCapturing(true);
                      
                      // 1. Convert base64 to Blob
                      const response = await fetch(capturedImage!);
                      const blob = await response.blob();
                      
                      // 2. Upload to our new API
                      const formData = new FormData();
                      formData.append('image', blob, 'stylist-capture.jpg');
                      
                      const uploadRes = await fetch('/api/social/upload', {
                        method: 'POST',
                        body: formData
                      });
                      
                      if (!uploadRes.ok) throw new Error('Upload failed');
                      const { url } = await uploadRes.json();
                      
                      const shareText = `Just got a live style critique from my AI Stylist on BeOnPoint! 📸✨\n\nAI noticed: "${aiResponse || 'My style is on point!'}"\n\n#BeOnPoint #AIStylist #FashionProof`;

                      // 3. Share via SDK if available, or API fallback
                      if (context?.client) {
                        await (sdk.actions as any).composeCast({
                          text: shareText,
                          embeds: [url]
                        });
                      } else {
                        // Fallback to clipboard or API
                        await navigator.clipboard.writeText(`${shareText} ${url}`);
                        alert('Link copied to clipboard! (Not in Farcaster App)');
                      }
                      
                      setCapturedImage(null);
                    } catch (err) {
                      console.error('Share failed:', err);
                      alert('Failed to share capture. Please try again.');
                    } finally {
                      setIsCapturing(false);
                    }
                  }}
                >
                  {isCapturing ? <Sparkles className="animate-spin w-6 h-6 mr-2" /> : null}
                  {isCapturing ? 'Preparing Post...' : 'Share to Farcaster'}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-white/60 hover:text-white"
                  onClick={() => setCapturedImage(null)}
                >
                  Discard
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </CardContent>
    </Card>
  );
}

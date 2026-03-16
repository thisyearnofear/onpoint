import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@repo/ui/card';
import { Button } from '@repo/ui/button';
import { Mic, Video, PhoneOff, Sparkles, AlertCircle, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeminiLive } from '@repo/ai-client';
import { useMiniApp } from '@neynar/react';
import { sdk } from '@farcaster/miniapp-sdk';
import { CeloTipButton } from './CeloTipButton';
import { MintLookButton } from './MintLookButton';

interface CaptureOption {
  image: string;
  comment: string;
}

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
    aiResponse: liveAiResponse,
    reasoning
  } = useGeminiLive();
  const { context } = useMiniApp();

  const [captures, setCaptures] = useState<CaptureOption[]>([]);
  const [selectedCaptureIndex, setSelectedCaptureIndex] = useState<number>(0);
  const [finalAdvice, setFinalAdvice] = useState<string>('');
  const [uploadedData, setUploadedData] = useState<{ url: string; ipfsUrl: string; ipfsCid: string } | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [terminalExpanded, setTerminalExpanded] = useState(false);

  const hasCaptures = captures.length > 0;
  const selectedCapture = hasCaptures ? captures[selectedCaptureIndex] : null;

  useEffect(() => {
    if (liveAiResponse?.trim()) {
      setFinalAdvice(liveAiResponse.trim());
    }
  }, [liveAiResponse]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const parseAdvice = (text: string) => {
    return text
      .split(/(?:\n|•|-\s|\d+\.\s)/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 3);
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setIsCapturing(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);
    
    // Premium Haptic Feedback
    try {
      await (sdk.haptics.impactOccurred as any)('heavy');
    } catch { /* ignore if not supported */ }

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

      const comment = (liveAiResponse || finalAdvice || 'Great structure. Keep this silhouette and add one accent accessory.').trim();

      // Draw AI Response if exists
      if (comment) {
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
        const words = comment.split(' ');
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
      setCaptures((prev) => {
        const next = [{ image: dataUrl, comment }, ...prev].slice(0, 4);
        setSelectedCaptureIndex(0);
        return next;
      });
      setFinalAdvice(comment);
      setUploadedData(null); // Reset upload state for new capture
      // Removed stopSession() here to allow multiple captures
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const uploadCapture = async () => {
    if (uploadedData) return uploadedData;
    if (!selectedCapture) {
      throw new Error('No capture selected');
    }
    
    setIsCapturing(true);
    try {
      const response = await fetch(selectedCapture.image);
      const blob = await response.blob();
      
      const formData = new FormData();
      formData.append('image', blob, 'stylist-capture.jpg');
      
      const uploadRes = await fetch('/api/social/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      const data = await uploadRes.json();
      setUploadedData(data);
      return data;
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopSession();
                onBack();
              }}
              className="rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-destructive/60"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Instructions Overlay */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 text-center"
            >
              <div className="max-w-xs space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Neural Stylist Ready</h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    For the best results:
                  </p>
                  <ul className="text-left text-xs text-white/50 space-y-2 py-4">
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px]">1</div>
                      Step back 5-8 feet for a full-body scan.
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px]">2</div>
                      Ensure lighting is bright (face the light).
                    </li>
                    <li className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px]">3</div>
                      Speak to your stylist about your plans.
                    </li>
                  </ul>
                </div>
                <Button 
                  onClick={() => setShowInstructions(false)}
                  className="w-full py-6 rounded-full font-bold text-lg bg-primary text-white"
                >
                  I'm Ready
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Reasoning Terminal (Bottom Dock) */}
        <AnimatePresence>
          {isConnected && reasoning.length > 0 && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={() => setTerminalExpanded(!terminalExpanded)}
              className={`absolute bottom-32 left-6 right-6 z-40 transition-all duration-300 cursor-pointer ${terminalExpanded ? 'h-48' : 'h-11 overflow-hidden'}`}
            >
              <div className={`h-full w-full p-3 rounded-xl bg-black/60 backdrop-blur-2xl border ${terminalExpanded ? 'border-primary/40 shadow-[0_0_30px_rgba(var(--primary),0.3)]' : 'border-white/10'} font-mono text-[10px] transition-all duration-500`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-primary flex items-center gap-2 font-bold tracking-widest uppercase">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-primary" 
                    />
                    Agent_Analysis {terminalExpanded ? '[-]' : '[+]'}
                  </div>
                  <div className="text-white/40 text-[8px] uppercase">Multimodal Feedback</div>
                </div>
                <div className="space-y-1.5">
                  {reasoning.slice(0, terminalExpanded ? 10 : 1).map((item, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1 - (i * 0.1), x: 0 }}
                      className="text-white/70 line-clamp-1"
                    >
                      {`> ${item}`}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Transcription & AI Captions */}
        <AnimatePresence>
          {isConnected && (transcript || liveAiResponse) && (
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className={`absolute ${terminalExpanded ? 'bottom-56' : 'bottom-44'} left-6 right-6 z-30 flex flex-col items-center gap-3 text-center transition-all duration-300`}
            >
              {transcript && (
                <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-white/90 text-sm max-w-[80%]">
                  "{transcript}"
                </div>
              )}
              {liveAiResponse && (
                <div className="px-5 py-3 rounded-2xl bg-primary/20 backdrop-blur-xl border border-primary/30 text-white text-lg font-medium shadow-2xl shadow-primary/20 max-w-[90%] leading-snug">
                  {liveAiResponse}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!!error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-destructive/85 px-4 py-2 text-[11px] text-destructive-foreground shadow-lg">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}

        {!!finalAdvice && !isConnected && !hasCaptures && (
          <div className="absolute bottom-6 left-6 right-6 z-30 rounded-2xl bg-black/65 border border-white/10 backdrop-blur-xl p-4 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-primary">Final stylist advice</div>
            <div className="text-white text-sm leading-relaxed">{finalAdvice}</div>
            <ul className="space-y-1 text-white/80 text-xs">
              {parseAdvice(finalAdvice).map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

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

        {/* Camera Flash Effect */}
        <AnimatePresence>
          {showFlash && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-white pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Floating Call Controls */}
        <AnimatePresence>
          {isConnected && !hasCaptures && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="absolute bottom-8 sm:bottom-12 left-0 right-0 flex justify-center items-center gap-6 z-40 px-6 pb-[env(safe-area-inset-bottom)]"
            >
              <div className="flex items-center gap-4 px-6 py-3 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <Button variant="ghost" size="icon" className="w-12 h-12 rounded-full bg-white/5 text-white hover:bg-white/20">
                  <Mic className="w-5 h-5" />
                </Button>
                
                <Button 
                   onClick={handleCapture}
                   disabled={isCapturing}
                   className="w-16 h-16 rounded-full bg-primary text-white shadow-[0_0_20px_rgba(var(--primary),0.4)] hover:scale-110 active:scale-95 transition-all border-4 border-white/10"
                >
                  {isCapturing ? <Sparkles className="animate-spin w-7 h-7" /> : <Camera className="w-7 h-7" />}
                </Button>

                <div className="w-[1px] h-8 bg-white/10 mx-1" />

                <div className="flex flex-col items-center">
                  <Button 
                    variant="outline"
                    size="icon" 
                    className="w-12 h-12 rounded-full border-white/20 text-white hover:bg-green-500/20"
                    onClick={async () => {
                      try { await (sdk.haptics.impactOccurred as any)('medium'); } catch {}
                      stopSession();
                    }}
                  >
                    <div className="relative">
                      <PhoneOff className="w-5 h-5 text-red-500" />
                      {hasCaptures && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[8px] flex items-center justify-center font-bold">
                          {captures.length}
                        </div>
                      )}
                    </div>
                  </Button>
                  <span className="text-[7px] font-black uppercase tracking-widest mt-1 text-white/40">Finish</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Captured Preview & Share Overlay */}
        <AnimatePresence>
          {hasCaptures && selectedCapture && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 pb-[env(safe-area-inset-bottom)]"
            >
              <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10 mb-8 max-w-2xl">
                <img src={selectedCapture.image} className="w-full h-full object-cover" alt="Captured Frame" />
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-primary/80 backdrop-blur-md text-[10px] font-bold text-white tracking-widest uppercase">
                  Proof of Style
                </div>
              </div>

              {captures.length > 1 && (
                <div className="w-full max-w-2xl mb-6">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-2">Choose your proof shot</p>
                  <div className="grid grid-cols-4 gap-2">
                    {captures.map((item, index) => (
                      <button
                        type="button"
                        key={`${item.image}-${index}`}
                        onClick={() => {
                          setSelectedCaptureIndex(index);
                          setUploadedData(null);
                        }}
                        className={`relative rounded-lg overflow-hidden border transition ${
                          selectedCaptureIndex === index ? 'border-primary ring-2 ring-primary/40' : 'border-white/20'
                        }`}
                      >
                        <img src={item.image} alt={`Proof option ${index + 1}`} className="h-16 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="w-full max-w-2xl mb-6 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-primary mb-1">Stylist comment on this shot</p>
                <p className="text-sm text-white/90 leading-relaxed">{selectedCapture.comment}</p>
              </div>

              <div className="flex flex-col gap-4 w-full max-w-xs">
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-6 text-lg font-bold"
                  disabled={isCapturing}
                  onClick={async () => {
                    try {
                      // 1. Upload if not already uploaded
                      const data = await uploadCapture();
                      const { url } = data;
                      
                      const shareText = `Just got a live style critique from my AI Stylist on BeOnPoint! 📸✨\n\nStylist notes: "${selectedCapture.comment || 'My style is on point!'}"\n\n#BeOnPoint #AIStylist #FashionProof`;

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
                      
                      setCaptures([]);
                      setSelectedCaptureIndex(0);
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

                <div className="flex items-center gap-2">
                   <div className="h-[1px] flex-1 bg-white/10" />
                   <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">or</span>
                   <div className="h-[1px] flex-1 bg-white/10" />
                </div>

                <CeloTipButton />

                <div className="flex items-center gap-2">
                   <div className="h-[1px] flex-1 bg-white/10" />
                   <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ownership</span>
                   <div className="h-[1px] flex-1 bg-white/10" />
                </div>

                <MintLookButton 
                  imageUrl={uploadedData?.url || ''} 
                  ipfsCid={uploadedData?.ipfsCid || ''}
                  aiCritique={selectedCapture.comment}
                  onUpload={uploadCapture}
                />

                <Button 
                  variant="ghost" 
                  className="w-full text-white/60 hover:text-white"
                  onClick={() => {
                    setCaptures([]);
                    setSelectedCaptureIndex(0);
                    setUploadedData(null);
                  }}
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

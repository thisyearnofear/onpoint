import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@repo/ui/card';
import { Button } from '@repo/ui/button';
import { Mic, Video, PhoneOff, Sparkles, AlertCircle, Camera, Clock, Volume2, VolumeX, Calendar, Sun, MessageSquareWarning, CheckCircle, Palette, Ruler, Eye } from 'lucide-react';
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
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionGoal, setSessionGoal] = useState<'event' | 'daily' | 'critique' | null>(null);
  const [userApiKey, setUserApiKey] = useState('');
  const [showByokInput, setShowByokInput] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Derive a session summary from reasoning + AI responses
  const sessionSummary = React.useMemo(() => {
    if (reasoning.length === 0 && !finalAdvice) return null;

    const allText = [...reasoning, finalAdvice].filter(Boolean).join(' ').toLowerCase();
    const positives = ['good', 'great', 'sharp', 'excellent', 'love', 'perfect', 'solid', 'working', 'flattering', 'on point', 'elevate', 'strong'];
    const negatives = ['avoid', 'not working', 'clash', 'off', 'wrong', 'too tight', 'too loose', 'mismatch', 'distract', 'overpower'];
    const topics: string[] = [];

    if (/color|palette|tone|shade|hue|coordination/.test(allText)) topics.push('Color Harmony');
    if (/fit|drape|silhouette|proportion|shape|tailor/.test(allText)) topics.push('Fit & Proportion');
    if (/accessory|jewelry|watch|belt|bag|shoe/.test(allText)) topics.push('Accessories');
    if (/texture|fabric|material/.test(allText)) topics.push('Fabric & Texture');
    if (/posture|stance|pose|angle/.test(allText)) topics.push('Posture & Pose');
    if (/event|occasion|formal|casual|dress code/.test(allText)) topics.push('Occasion Match');
    if (/layer|outerwear|cardigan|jacket/.test(allText)) topics.push('Layering');

    const posCount = positives.filter(p => allText.includes(p)).length;
    const negCount = negatives.filter(n => allText.includes(n)).length;
    const total = posCount + negCount;
    // Score 5-10 based on positive-to-negative ratio, with floor of 5
    const rawScore = total === 0 ? 7 : Math.round(5 + (posCount / total) * 5);
    const score = Math.min(10, Math.max(5, rawScore));

    const takeaways = reasoning
      .slice(0, 5)
      .map(r => r.replace(/^["\s]+|["\s]+$/g, ''))
      .filter(r => r.length > 15 && r.length < 120);

    return { score, topics: topics.slice(0, 4), takeaways };
  }, [reasoning, finalAdvice]);

  const GOAL_OPTIONS = [
    { id: 'event' as const, label: 'Event Styling', desc: 'Prepare for a special occasion — formal, party, or date night', icon: Calendar, color: 'from-purple-500 to-indigo-600' },
    { id: 'daily' as const, label: 'Daily Outfit Check', desc: 'Quick review of your everyday look for fit and coordination', icon: Sun, color: 'from-amber-500 to-orange-600' },
    { id: 'critique' as const, label: 'Honest Critique', desc: 'No sugarcoating — real talk on what works and what doesn\'t', icon: MessageSquareWarning, color: 'from-rose-500 to-red-600' },
  ];

  const hasCaptures = captures.length > 0;
  const selectedCapture = hasCaptures ? captures[selectedCaptureIndex] : null;

  // Coaching overlays — derived from reasoning keywords
  const [coachingBadges, setCoachingBadges] = useState<Array<{ id: string; label: string; icon: typeof CheckCircle; color: string }>>([]);

  useEffect(() => {
    if (!isConnected || reasoning.length === 0) {
      setCoachingBadges([]);
      return;
    }
    const latest = (reasoning[0] || '').toLowerCase();
    const badges: typeof coachingBadges = [];

    if (/color|palette|tone|shade|hue/.test(latest)) {
      badges.push({ id: 'color', label: 'Color Check', icon: Palette, color: 'from-violet-500/80 to-purple-600/80' });
    }
    if (/fit|drape|silhouette|proportion|shape/.test(latest)) {
      badges.push({ id: 'fit', label: 'Fit Analysis', icon: Ruler, color: 'from-emerald-500/80 to-green-600/80' });
    }
    if (/good|great|sharp|excellent|love|perfect|solid|working/.test(latest)) {
      badges.push({ id: 'approval', label: 'Looking Good', icon: CheckCircle, color: 'from-sky-500/80 to-blue-600/80' });
    }
    if (/scan|analyz|check|evaluat|review/.test(latest) && !badges.some(b => b.id === 'approval')) {
      badges.push({ id: 'scanning', label: 'Scanning…', icon: Eye, color: 'from-amber-500/80 to-orange-600/80' });
    }

    setCoachingBadges(badges);
  }, [isConnected, reasoning]);

  useEffect(() => {
    if (liveAiResponse?.trim()) {
      setFinalAdvice(liveAiResponse.trim());
    }
  }, [liveAiResponse]);

  // Voice Synthesis Logic
  useEffect(() => {
    if (isVoiceEnabled && liveAiResponse) {
      const utterance = new SpeechSynthesisUtterance(liveAiResponse);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      window.speechSynthesis.cancel(); // Stop current speech
      window.speechSynthesis.speak(utterance);
    }
  }, [liveAiResponse, isVoiceEnabled]);

  useEffect(() => {
    return () => {
      stopSession();
      window.speechSynthesis.cancel();
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

      // Add HUD Overlays (Subtle)
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
      ctx.lineWidth = 4;
      
      const margin = 40;
      const len = 60;
      ctx.beginPath(); ctx.moveTo(margin, margin + len); ctx.lineTo(margin, margin); ctx.lineTo(margin + len, margin); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(canvas.width - margin - len, margin); ctx.lineTo(canvas.width - margin, margin); ctx.lineTo(canvas.width - margin, margin + len); ctx.stroke();

      const comment = (liveAiResponse || finalAdvice || 'Captured look for analysis.').trim();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCaptures((prev) => {
        const next = [{ image: dataUrl, comment }, ...prev].slice(0, 4);
        setSelectedCaptureIndex(0);
        return next;
      });
      setFinalAdvice(comment);
      setUploadedData(null);
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const startTimerCapture = useCallback(() => {
    if (countdown !== null) return;
    setCountdown(3);
    
    // Play countdown sound if possible
    try {
      const ctx = new AudioContext();
      const playBeep = (freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      };

      let count = 3;
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          playBeep(880);
          setCountdown(count);
        } else {
          clearInterval(interval);
          playBeep(1760);
          setCountdown(null);
          handleCapture();
        }
      }, 1000);
      playBeep(880); // First beep
    } catch {
      // Fallback if AudioContext fails
      let count = 3;
      const interval = setInterval(() => {
        count--;
        if (count > 0) setCountdown(count);
        else {
          clearInterval(interval);
          setCountdown(null);
          handleCapture();
        }
      }, 1000);
    }
  }, [countdown, handleCapture]);

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
        <div className="absolute top-6 left-4 right-4 flex justify-between items-center z-30">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
                {isConnected ? 'Agent Active' : 'System Standby'}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              className={`rounded-full px-3 h-8 border backdrop-blur-xl transition-all ${isVoiceEnabled ? 'bg-primary border-primary/40 text-white' : 'bg-black/40 border-white/10 text-white/60'}`}
            >
              {isVoiceEnabled ? <Volume2 className={`w-3.5 h-3.5 mr-1.5`} /> : <VolumeX className={`w-3.5 h-3.5 mr-1.5`} />}
              <span className="text-[8px] font-bold uppercase tracking-widest">{isVoiceEnabled ? 'Voice On' : 'Voice Off'}</span>
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopSession();
              onBack();
            }}
            className="rounded-full w-10 h-10 bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-destructive"
          >
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>

        {/* Dynamic Reasoning Ticker (Top Center) */}
        <AnimatePresence>
          {isConnected && reasoning.length > 0 && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              onClick={() => setTerminalExpanded(!terminalExpanded)}
              className="absolute top-20 left-4 right-4 z-40"
            >
              <div className={`w-full transition-all duration-500 ${terminalExpanded ? 'max-h-64' : 'max-h-16'} overflow-hidden rounded-2xl bg-black/40 backdrop-blur-3xl border border-white/10 shadow-2xl`}>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]" 
                      />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Stylist Intelligence</span>
                    </div>
                    <span className="text-[9px] text-white/30 uppercase font-mono">{terminalExpanded ? 'Collapse' : 'Logs'}</span>
                  </div>
                  
                  <div className="font-mono">
                    {terminalExpanded ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar pb-2">
                        {reasoning.map((item, i) => (
                          <div key={i} className="text-[11px] text-white/60 border-l border-white/5 pl-3 leading-relaxed">
                            <span className="text-primary/40 mr-2">›</span>{item}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-white line-clamp-2 leading-relaxed tracking-tight italic">
                        "{reasoning[0]}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Captions & Countdown */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div 
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 z-[70] flex items-center justify-center bg-black/20"
            >
              <span className="text-9xl font-black text-white drop-shadow-[0_0_50px_rgba(var(--primary),0.8)]">
                {countdown}
              </span>
            </motion.div>
          )}

          {isConnected && liveAiResponse && !terminalExpanded && (
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="absolute bottom-32 left-6 right-6 z-30 flex flex-col items-center gap-3 text-center"
            >
              <div className="px-6 py-4 rounded-[2rem] bg-primary shadow-[0_20px_50px_rgba(var(--primary),0.3)] text-white text-lg font-bold shadow-2xl max-w-[90%] leading-tight transform-gpu animate-float">
                {liveAiResponse}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!!error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-destructive/85 px-4 py-2 text-[11px] text-destructive-foreground shadow-lg">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
            {!showByokInput && (
              <button
                onClick={() => setShowByokInput(true)}
                className="ml-1 rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/90 hover:bg-white/10"
              >
                Use my key
              </button>
            )}
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

          {/* Real-time Coaching Overlays */}
          <AnimatePresence>
            {coachingBadges.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-24 right-4 z-30 flex flex-col gap-2"
              >
                {coachingBadges.map((badge) => (
                  <motion.div
                    key={badge.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${badge.color} backdrop-blur-xl px-3 py-1.5 shadow-lg border border-white/10`}
                  >
                    <badge.icon className="w-3.5 h-3.5 text-white" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">{badge.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

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
              <p className="text-white/60 max-w-sm mb-8 text-lg">
                {sessionGoal
                  ? `Starting your ${GOAL_OPTIONS.find(g => g.id === sessionGoal)?.label.toLowerCase()} session…`
                  : 'Choose a goal for your live styling session.'}
              </p>

              {!sessionGoal ? (
                <div className="w-full max-w-sm space-y-3">
                  {GOAL_OPTIONS.map((goal) => (
                    <motion.button
                      key={goal.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSessionGoal(goal.id)}
                      className="w-full flex items-center gap-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-4 text-left hover:bg-white/10 hover:border-white/20 transition-all group"
                    >
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${goal.color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl transition-shadow`}>
                        <goal.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white">{goal.label}</div>
                        <div className="text-xs text-white/50 leading-relaxed truncate">{goal.desc}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {showByokInput && (
                    <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/40 p-3 backdrop-blur-xl">
                      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/60 mb-2">
                        Optional BYOK fallback
                      </div>
                      <input
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Paste your Gemini API key"
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        className="w-full rounded-xl border border-white/20 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-primary/60"
                      />
                      <div className="mt-2 text-[11px] text-white/50 leading-relaxed">
                        Used for this live session only and never shown in logs.
                      </div>
                    </div>
                  )}
                  <Button 
                    onClick={() => startSession(sessionGoal, userApiKey)} 
                    disabled={isInitializing}
                    className="rounded-full px-10 py-7 text-xl font-bold shadow-2xl shadow-primary/50 transition-all hover:scale-105 bg-white text-black active:scale-95"
                  >
                    {isInitializing ? "Initializing Neural Link…" : "Start Live Session"}
                  </Button>
                  <button
                    onClick={() => {
                      setSessionGoal(null);
                      setShowByokInput(false);
                    }}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
                  >
                    Change goal
                  </button>
                  {!showByokInput && (
                    <button
                      onClick={() => setShowByokInput(true)}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
                    >
                      Use your own Gemini API key
                    </button>
                  )}
                </div>
              )}
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
              className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-40 px-6"
            >
              <div className="flex items-center gap-4 px-6 py-4 rounded-[2.5rem] bg-black/60 backdrop-blur-3xl border border-white/10 shadow-2xl ring-1 ring-white/5">
                <div className="flex flex-col items-center">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={startTimerCapture}
                    disabled={countdown !== null}
                    className={`w-12 h-12 rounded-full border transition-all ${countdown !== null ? 'bg-primary/20 border-primary' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                  >
                    <Clock className={`w-5 h-5 ${countdown !== null ? 'animate-pulse' : ''}`} />
                  </Button>
                  <span className="text-[7px] font-black uppercase tracking-widest mt-1.5 text-white/40">Auto</span>
                </div>
                
                <Button 
                   onClick={handleCapture}
                   disabled={isCapturing}
                   className="w-16 h-16 rounded-full bg-primary text-white shadow-[0_0_30px_rgba(var(--primary),0.4)] hover:scale-110 active:scale-95 transition-all border-4 border-white/20"
                >
                  {isCapturing ? <Sparkles className="animate-spin w-7 h-7" /> : <Camera className="w-7 h-7" />}
                </Button>

                <div className="w-[1px] h-10 bg-white/10 mx-1" />

                <div className="flex flex-col items-center">
                  <Button 
                    variant="outline"
                    size="icon" 
                    className="w-12 h-12 rounded-full border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/40 transition-all"
                    onClick={async () => {
                      try { await (sdk.haptics.impactOccurred as any)('medium'); } catch {}
                      stopSession();
                      setShowSummary(true);
                    }}
                  >
                    <div className="relative">
                      <PhoneOff className="w-5 h-5 text-red-500" />
                      {hasCaptures && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary text-[10px] flex items-center justify-center font-black border-2 border-black"
                        >
                          {captures.length}
                        </motion.div>
                      )}
                    </div>
                  </Button>
                  <span className="text-[7px] font-black uppercase tracking-widest mt-1.5 text-white/40">Finish</span>
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
                {/* Style Score Badge */}
                {sessionSummary && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white"
                      style={{
                        background: sessionSummary.score >= 8 ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                          : sessionSummary.score >= 6 ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                          : 'linear-gradient(135deg, #ef4444, #dc2626)'
                      }}
                    >
                      {sessionSummary.score}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/80">Style Score</span>
                  </div>
                )}
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
                      
                      const scoreLine = sessionSummary ? `\n📊 Style Score: ${sessionSummary.score}/10` : '';
                      const topicsLine = sessionSummary?.topics.length ? `\n🏷️ ${sessionSummary.topics.join(' • ')}` : '';
                      const shareText = `Just got a live style critique from my AI Stylist on BeOnPoint! 📸✨${scoreLine}${topicsLine}\n\nStylist notes: "${selectedCapture.comment || 'My style is on point!'}"\n\n#BeOnPoint #AIStylist #FashionProof`;

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

        {/* Session Completion Summary */}
        <AnimatePresence>
          {showSummary && sessionSummary && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6"
            >
              <div className="w-full max-w-sm space-y-6">
                {/* Score Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-28 h-28 mb-3">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                      <motion.circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={sessionSummary.score >= 8 ? '#22c55e' : sessionSummary.score >= 6 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${sessionSummary.score * 26.4} 264`}
                        initial={{ strokeDasharray: '0 264' }}
                        animate={{ strokeDasharray: `${sessionSummary.score * 26.4} 264` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-white">{sessionSummary.score}</span>
                      <span className="text-[9px] uppercase tracking-widest text-white/50 font-bold">Style Score</span>
                    </div>
                  </div>
                  <p className="text-white/60 text-sm">
                    {sessionSummary.score >= 8 ? 'Looking sharp! 🔥' : sessionSummary.score >= 6 ? 'Solid foundation with room to level up' : 'Let\'s work on a few things'}
                  </p>
                </div>

                {/* Topics Analyzed */}
                {sessionSummary.topics.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/40">Topics Analyzed</p>
                    <div className="flex flex-wrap gap-2">
                      {sessionSummary.topics.map((topic) => (
                        <span key={topic} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-white/70">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Takeaways */}
                {sessionSummary.takeaways.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/40">Key Takeaways</p>
                    <ul className="space-y-1.5">
                      {sessionSummary.takeaways.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/80 leading-relaxed">
                          <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                          <span className="italic">"{tip}"</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    onClick={() => {
                      setShowSummary(false);
                      setSessionGoal(null);
                      setFinalAdvice('');
                      onBack();
                    }}
                    className="w-full bg-white text-black rounded-full py-5 font-bold hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Done
                  </Button>
                  <button
                    onClick={() => {
                      setShowSummary(false);
                      setSessionGoal(null);
                      setFinalAdvice('');
                    }}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2 text-center"
                  >
                    Start a new session
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </CardContent>
    </Card>
  );
}

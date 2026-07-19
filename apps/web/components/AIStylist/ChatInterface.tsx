import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Separator } from "@repo/ui/separator";
import { MessageCircle, Sparkles, Send, RefreshCw, Bot, Palette, Settings, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { ChatMessage } from './ChatMessage';
import { Avatar, AvatarFallback } from "@repo/ui/avatar";
import type { StylistPersona, StyleSuggestion } from "@repo/ai-client";
import { speakAsPersona, stopSpeaking, getVoiceProfile } from "../../lib/utils/persona-voice";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  recommendations?: Array<{
    item: string;
    reason: string;
    priority: number;
  }>;
  stylingTips?: string[];
}

interface GuidedPrompt {
  icon: React.ElementType;
  text: string;
  examples?: string[];
}

interface ChatInterfaceProps {
  selectedPersona: StylistPersona;
  loading: boolean;
  messages: Message[];
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  activeGuidedPrompt: number | null;
  guidedPrompts: GuidedPrompt[];
  handleGenerateSuggestions: () => Promise<void>;
  clearConversation: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setSuggestions: React.Dispatch<React.SetStateAction<StyleSuggestion[]>>;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveGuidedPrompt: React.Dispatch<React.SetStateAction<number | null>>;
  startConversation: () => void;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  handleSendMessage: () => Promise<void>;
  handleGuidedPromptSelect: (promptText: string) => void;
  handleToggleContext: () => void;
  contextData: Record<string, string>;
}

export function ChatInterface({
  selectedPersona,
  loading,
  messages,
  scrollAreaRef,
  activeGuidedPrompt,
  guidedPrompts,
  handleGenerateSuggestions,
  clearConversation,
  setMessages,
  setSuggestions,
  setShowSuggestions,
  setActiveGuidedPrompt,
  startConversation,
  message,
  setMessage,
  handleKeyPress,
  handleSendMessage,
  handleGuidedPromptSelect,
  handleToggleContext,
  contextData,
}: ChatInterfaceProps) {
  const [autoPlay, setAutoPlay] = useState(() => {
    try {
      return localStorage.getItem(`onpoint:autoPlay:${selectedPersona}`) === "true";
    } catch {
      return false;
    }
  });
  const [autoPlayingId, setAutoPlayingId] = useState<string | null>(null);
  const lastAutoPlayedId = useRef<string | null>(null);

  const personaProfile = getVoiceProfile(selectedPersona);

  // Voice volume (0–1 mapped from 0–100% for the slider)
  const [voiceVolume, setVoiceVolume] = useState(() => {
    try {
      const stored = localStorage.getItem(`onpoint:voiceVolume:${selectedPersona}`);
      if (stored) return Math.max(0, Math.min(100, Number(stored))) / 100;
    } catch {}
    return personaProfile.volume;
  });

  // Voice rate (0.5–2.0 mapped from 50–200% for the slider)
  const [voiceRate, setVoiceRate] = useState(() => {
    try {
      const stored = localStorage.getItem(`onpoint:voiceRate:${selectedPersona}`);
      if (stored) return Math.max(0.5, Math.min(2, Number(stored)));
    } catch {}
    return personaProfile.rate;
  });

  const voiceOverrides = { volume: voiceVolume, rate: voiceRate };

  // Persist auto-play preference when value changes (key derived from current persona)
  useEffect(() => {
    try {
      localStorage.setItem(`onpoint:autoPlay:${selectedPersona}`, String(autoPlay));
    } catch {
      // localStorage unavailable
    }
  }, [autoPlay]);

  // Load stored preference when persona switches (runs before persist above on key change)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`onpoint:autoPlay:${selectedPersona}`) === "true";
      setAutoPlay(stored);
    } catch {
      setAutoPlay(false);
    }
  }, [selectedPersona]);

  // Persist volume and rate per persona
  useEffect(() => {
    try {
      localStorage.setItem(`onpoint:voiceVolume:${selectedPersona}`, String(Math.round(voiceVolume * 100)));
    } catch {}
  }, [voiceVolume]);
  useEffect(() => {
    try {
      localStorage.setItem(`onpoint:voiceRate:${selectedPersona}`, String(voiceRate));
    } catch {}
  }, [voiceRate]);

  // Restore stored volume/rate when persona switches
  useEffect(() => {
    try {
      const storedVol = localStorage.getItem(`onpoint:voiceVolume:${selectedPersona}`);
      if (storedVol) setVoiceVolume(Math.max(0, Math.min(100, Number(storedVol))) / 100);
      else setVoiceVolume(getVoiceProfile(selectedPersona).volume);
    } catch {}
    try {
      const storedRate = localStorage.getItem(`onpoint:voiceRate:${selectedPersona}`);
      if (storedRate) setVoiceRate(Math.max(0.5, Math.min(2, Number(storedRate))));
      else setVoiceRate(getVoiceProfile(selectedPersona).rate);
    } catch {}
  }, [selectedPersona]);

  // Auto-play the latest assistant message when autoPlay is enabled
  useEffect(() => {
    if (!autoPlay) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;
    if (lastMsg.id === lastAutoPlayedId.current) return;
    lastAutoPlayedId.current = lastMsg.id;
    setAutoPlayingId(lastMsg.id);
    speakAsPersona(lastMsg.content, selectedPersona, voiceOverrides).finally(() => {
      setAutoPlayingId(null);
    });
  }, [messages, autoPlay, selectedPersona]);

  // Determine if the latest assistant message is being auto-played
  const lastMsg = messages[messages.length - 1];
  const autoPlayActive = autoPlayingId !== null && lastMsg?.id === autoPlayingId;

  const handleResetVoice = useCallback(() => {
    const profile = getVoiceProfile(selectedPersona);
    stopSpeaking();
    setVoiceVolume(profile.volume);
    setVoiceRate(profile.rate);
    try {
      localStorage.removeItem(`onpoint:voiceVolume:${selectedPersona}`);
      localStorage.removeItem(`onpoint:voiceRate:${selectedPersona}`);
    } catch {}
  }, [selectedPersona]);

  const handleAutoPlayStop = useCallback(() => {
    stopSpeaking();
    setAutoPlay(false);
    setAutoPlayingId(null);
  }, []);

  const handleClearConversation = useCallback(() => {
    clearConversation();
    setMessages([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveGuidedPrompt(null);
    lastAutoPlayedId.current = null;
    stopSpeaking();
    setAutoPlay(false);
    setAutoPlayingId(null);
  }, [clearConversation, setMessages, setSuggestions, setShowSuggestions, setActiveGuidedPrompt]);

  return (
    <Card className="elegant-shadow">
      <CardHeader className="glass-effect pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Chat with {selectedPersona === "luxury" ? "Anna Karenina" :
              selectedPersona === "streetwear" ? "Artful Dodger" :
                selectedPersona === "sustainable" ? "Mowgli" :
                  selectedPersona === "edina" ? "Edina Monsoon" :
                    selectedPersona === "miranda" ? "Miranda Priestly" :
                      "John Shaft"}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoPlay((prev) => {
                const next = !prev;
                if (!next) stopSpeaking();
                return next;
              })}
              className={`h-8 text-xs px-2 transition-colors ${
                autoPlay
                  ? "border-success/50 text-success bg-success/10 hover:bg-success/15"
                  : "border-muted-foreground/30 text-muted-foreground hover:bg-muted/5"
              }`}
              title={autoPlay ? "Auto-play is on — new responses will be read aloud" : "Auto-play persona voice for new responses"}
            >
              {autoPlay ? (
                <Volume2 className="h-3.5 w-3.5 mr-1 fill-emerald-500" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 mr-1" />
              )}
              Voice
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleContext}
              className="border-muted-foreground/30 text-muted-foreground hover:bg-muted/5 h-8 text-xs px-2"
              title="Add or update context"
            >
              <Settings className="h-3 w-3 mr-1" />
              Context
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSuggestions}
              disabled={loading}
              className="border-primary/30 text-primary hover:bg-primary/5 h-8 text-xs px-2"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Suggestions
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/lab?tab=try-on', '_blank')}
              className="border-accent/30 text-accent hover:bg-accent/5 h-8 text-xs px-2"
              title="Open Lab try-on"
            >
              <Palette className="h-3 w-3 mr-1" />
              Try-on
            </Button>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearConversation}
                disabled={loading}
                className="border-muted-foreground/30 text-muted-foreground hover:bg-muted/5 h-8 text-xs px-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {/* Voice settings panel — visible when auto-play is enabled */}
      {autoPlay && (
        <div className="px-5 pb-3 pt-0">
          <div className="flex items-center gap-4 rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Volume2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(voiceVolume * 100)}
                onChange={(e) => setVoiceVolume(Number(e.target.value) / 100)}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted-foreground/20 accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-success"
                title={`Volume: ${Math.round(voiceVolume * 100)}%`}
              />
              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right flex-shrink-0">
                {Math.round(voiceVolume * 100)}%
              </span>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground/60 flex-shrink-0">Speed</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="range"
                min="50"
                max="200"
                value={Math.round(voiceRate * 100)}
                onChange={(e) => setVoiceRate(Number(e.target.value) / 100)}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted-foreground/20 accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                title={`Speed: ${Math.round(voiceRate * 100)}%`}
              />
              <span className="text-xs tabular-nums text-muted-foreground w-8 text-right flex-shrink-0">
                {Math.round(voiceRate * 100)}%
              </span>
            </div>
            <button
              onClick={handleResetVoice}
              className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-muted/80 transition-all"
              title="Reset volume and speed to persona defaults"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <CardContent className="pt-0">
        {/* Context Summary */}
        {messages.length > 0 && (contextData.occasion || contextData.weather || contextData.location || contextData.time) && (
          <div className="mb-4 p-2 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-primary">
                <Settings className="h-3 w-3" />
                <span>
                  {[contextData.occasion, contextData.weather, contextData.location, contextData.time]
                    .filter(Boolean)
                    .join(' • ')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleContext}
                className="h-6 text-xs text-primary hover:bg-primary/10"
              >
                Edit
              </Button>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {messages.length > 0 ? (
          <div className="space-y-4">
            <ScrollArea className="h-80 pr-2" ref={scrollAreaRef}>
              <div className="space-y-4 py-2">
                {messages.map((msg, index) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isLast={index === messages.length - 1}
                    selectedPersona={selectedPersona}
                    autoPlayActive={autoPlayActive && index === messages.length - 1}
                    onAutoPlayStop={handleAutoPlayStop}
                    voiceOverrides={voiceOverrides}
                  />
                ))}
                {loading && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        Styling advice incoming...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Guided Prompts */}
            {activeGuidedPrompt !== null && (
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    {guidedPrompts[activeGuidedPrompt]?.icon &&
                      React.createElement(guidedPrompts[activeGuidedPrompt].icon, { className: "h-4 w-4" })}
                    {guidedPrompts[activeGuidedPrompt]?.text}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setActiveGuidedPrompt(null)}
                  >
                    ×
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {guidedPrompts[activeGuidedPrompt]?.examples?.map((example, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleGuidedPromptSelect(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />
          </div>
        ) : (
          <div className="text-center py-6">
            <MessageCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">
              What are you styling for?
            </h3>
            <p className="text-muted-foreground mb-4 text-xs">
              Tap a suggestion or type your own
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
              {[
                "Date night outfit",
                "Work meeting look",
                "Casual weekend",
                "What goes with jeans?",
              ].map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs"
                  disabled={loading}
                  onClick={() => {
                    startConversation();
                    // Small delay to let conversation initialize
                    setTimeout(() => handleGuidedPromptSelect(prompt), 100);
                  }}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Message Input */}
        {messages.length > 0 && (
          <div className="mt-4">
            {/* Quick Prompt Buttons */}
            {activeGuidedPrompt === null && messages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {guidedPrompts.slice(0, 3).map((prompt, index) => {
                  const Icon = prompt.icon;
                  return (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setActiveGuidedPrompt(index)}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {prompt.text.split(' ')[0]}
                    </Button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="Ask about styling, sourcing, or fittings..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={loading}
                  className="pr-10 text-sm"
                />
                <MessageCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={loading || !message.trim()}
                className="fashion-gradient text-white min-w-[80px] h-10 text-sm"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
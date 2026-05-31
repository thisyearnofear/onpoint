import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from "@repo/ui/avatar";
import {
  Bot,
  User,
  ShoppingBag,
  Lightbulb,
  Star,
  Volume2,
} from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { speakAsPersona, stopSpeaking } from "../../lib/utils/persona-voice";

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

export function ChatMessage({
  message,
  isLast,
  selectedPersona,
  autoPlayActive = false,
  onAutoPlayStop,
  voiceOverrides,
}: {
  message: Message;
  isLast: boolean;
  selectedPersona?: StylistPersona;
  autoPlayActive?: boolean;
  onAutoPlayStop?: () => void;
  voiceOverrides?: { volume?: number; rate?: number };
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const mountedRef = useRef(true);
  const isUser = message.role === "user";

  // Sync isPlaying with auto-play state (both on and off)
  useEffect(() => {
    setIsPlaying(autoPlayActive);
  }, [autoPlayActive]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopSpeaking();
    };
  }, []);

  const toggleVoice = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPersona) return;
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      // If auto-play is active, stop it at the parent level too
      if (autoPlayActive && onAutoPlayStop) {
        onAutoPlayStop();
      }
    } else {
      setIsPlaying(true);
      speakAsPersona(message.content, selectedPersona, voiceOverrides).finally(() => {
        if (mountedRef.current) {
          setIsPlaying(false);
        }
      });
    }
  }, [isPlaying, message.content, selectedPersona, autoPlayActive, onAutoPlayStop]);

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : ""} ${isLast ? "mb-2" : "mb-4"}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
          <AvatarFallback>
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`max-w-[85%] ${isUser ? "order-first" : ""}`}>
        <div
          className={`rounded-lg p-3 ${
            isUser ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm whitespace-pre-wrap flex-1">{message.content}</p>
            {!isUser && selectedPersona && (
              <button
                onClick={toggleVoice}
                className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all ${
                  isPlaying
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/80"
                }`}
                title={isPlaying ? "Stop reading" : "Listen to this response"}
              >
                {isPlaying ? (
                  <span className="flex items-center gap-[2px]">
                    <span className="w-[2px] h-3 bg-current rounded-full animate-pulse" />
                    <span className="w-[2px] h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <span className="w-[2px] h-3.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          {message.recommendations && message.recommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-muted-foreground/20">
              <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <ShoppingBag className="h-3 w-3" />
                Recommendations
              </h5>
              <div className="space-y-2">
                {message.recommendations.slice(0, 3).map((rec, index) => (
                  <div key={index} className="text-xs">
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Star
                          className={`h-3 w-3 ${rec.priority >= 3 ? "text-yellow-500" : rec.priority >= 2 ? "text-blue-500" : "text-gray-400"}`}
                        />
                      </div>
                      <div>
                        <span className="font-medium">{rec.item}</span>
                        <p className="text-muted-foreground mt-1">
                          {rec.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {message.stylingTips && message.stylingTips.length > 0 && (
            <div className="mt-3 pt-3 border-t border-muted-foreground/20">
              <h5 className="text-xs font-semibold mb-2 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" />
                Styling Tips
              </h5>
              <div className="space-y-1">
                {message.stylingTips.map((tip, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    • {tip}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-1 text-right">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
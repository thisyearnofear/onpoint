"use client";

import React from "react";
import { RefreshCw, Sparkles, Palette, Camera, MessageCircle } from "lucide-react";

interface AILoadingStateProps {
  type: 'design' | 'color' | 'tryon' | 'chat' | 'analysis';
  message?: string;
}

export function AILoadingState({ type, message }: AILoadingStateProps) {
  const configs = {
    design: {
      icon: Sparkles,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      defaultMessage: 'Creating your design...'
    },
    color: {
      icon: Palette,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      defaultMessage: 'Generating color palette...'
    },
    tryon: {
      icon: Camera,
      color: 'text-blue-600',
      bgColor: 'bg-blue-600/10',
      defaultMessage: 'Analyzing fit and measurements...'
    },
    chat: {
      icon: MessageCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-600/10',
      defaultMessage: 'Getting styling advice...'
    },
    analysis: {
      icon: RefreshCw,
      color: 'text-purple-600',
      bgColor: 'bg-purple-600/10',
      defaultMessage: 'Analyzing your request...'
    }
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
      <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`h-5 w-5 ${config.color} animate-pulse`} />
      </div>
      <div>
        <p className="text-sm font-medium">{message || config.defaultMessage}</p>
        <div className="flex items-center gap-1 mt-1">
          <div className="w-1 h-1 bg-current rounded-full animate-bounce" />
          <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  );
}
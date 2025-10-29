import React from 'react';
import { Avatar, AvatarFallback } from "@repo/ui/avatar";
import {
  Bot,
  User,
  ShoppingBag,
  Lightbulb,
  Star,
} from "lucide-react";

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
}: {
  message: Message;
  isLast: boolean;
}) {
  const isUser = message.role === "user";

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
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>

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
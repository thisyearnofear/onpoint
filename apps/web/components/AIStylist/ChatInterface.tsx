import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Separator } from "@repo/ui/separator";
import { MessageCircle, Sparkles, Send, RefreshCw, Bot, User } from "lucide-react";
import { ChatMessage } from './ChatMessage';
import { Avatar, AvatarFallback } from "@repo/ui/avatar";

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
  handleGuidedPromptSelect
}) {
  return (
    <Card className="elegant-shadow">
      <CardHeader className="glass-effect pb-3 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Chat with {selectedPersona === "luxury" ? "Luxury Expert" : 
                     selectedPersona === "streetwear" ? "Streetwear Guru" : 
                     selectedPersona === "sustainable" ? "Sustainable Consultant" : 
                     selectedPersona === "edina" ? "Edina Monsoon" : 
                     selectedPersona === "miranda" ? "Miranda Priestly" : 
                     "John Shaft"}
          </CardTitle>
          <div className="flex gap-2">
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
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearConversation();
                  setMessages([]);
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setActiveGuidedPrompt(null);
                }}
                disabled={loading}
                className="border-accent/30 text-accent hover:bg-accent/5 h-8 text-xs px-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
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
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">
              Ready to Style?
            </h3>
            <p className="text-muted-foreground mb-4 text-sm max-w-md mx-auto">
              Start a conversation with your selected stylist to get
              personalized fashion advice.
            </p>
            <Button onClick={startConversation} disabled={loading} size="sm">
              <MessageCircle className="h-4 w-4 mr-2" />
              Start Conversation
            </Button>
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
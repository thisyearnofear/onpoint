"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Avatar, AvatarFallback } from "@repo/ui/avatar";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Separator } from "@repo/ui/separator";
import {
  MessageCircle,
  Sparkles,
  Send,
  RefreshCw,
  User,
  Bot,
  Leaf,
  Crown,
  Zap,
  ShoppingBag,
  Lightbulb,
  Star,
  Calendar,
  Sun,
  Cloud,
  Users,
  MapPin,
  Clock,
} from "lucide-react";
import { useAIStylist } from "@repo/ai-client";
import type { StylistPersona, StyleSuggestion } from "@repo/ai-client";

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

interface PersonaCardProps {
  persona: StylistPersona;
  isSelected: boolean;
  onSelect: (persona: StylistPersona) => void;
  disabled?: boolean;
}

// Guided prompt suggestions
const guidedPrompts = [
  {
    icon: Calendar,
    text: "What occasion are you preparing for?",
    examples: ["Work meeting", "Wedding", "Casual weekend", "Date night"]
  },
  {
    icon: Sun,
    text: "What season is it?",
    examples: ["Spring", "Summer", "Fall", "Winter"]
  },
  {
    icon: Cloud,
    text: "What's the weather forecast?",
    examples: ["Sunny", "Rainy", "Cold", "Warm"]
  },
  {
    icon: Users,
    text: "Who will be there?",
    examples: ["Friends", "Family", "Colleagues", "Love interest"]
  },
  {
    icon: MapPin,
    text: "Where are you going?",
    examples: ["City", "Beach", "Mountains", "Restaurant"]
  },
  {
    icon: Clock,
    text: "What time of day?",
    examples: ["Morning", "Afternoon", "Evening", "Night"]
  }
];

function PersonaCard({
  persona,
  isSelected,
  onSelect,
  disabled,
}: PersonaCardProps) {
  const personaConfig = {
    luxury: {
      title: "Luxury Expert",
      description: "Sophisticated styling for high-end fashion",
      icon: Crown,
      color: "text-amber-600",
      bgColor: "bg-amber-600/10",
      ringColor: "ring-amber-600",
      buttonBg: "bg-amber-600 hover:bg-amber-600/90",
    },
    streetwear: {
      title: "Streetwear Guru",
      description: "Urban and contemporary fashion guidance",
      icon: Zap,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
      ringColor: "ring-blue-600",
      buttonBg: "bg-blue-600 hover:bg-blue-600/90",
    },
    sustainable: {
      title: "Sustainable Consultant",
      description: "Eco-friendly and ethical fashion advice",
      icon: Leaf,
      color: "text-emerald-600",
      bgColor: "bg-emerald-600/10",
      ringColor: "ring-emerald-600",
      buttonBg: "bg-emerald-600 hover:bg-emerald-600/90",
    },
    edina: {
      title: "Edina Monsoon",
      description: "Absolutely Fabulous fashion victim, darling!",
      icon: Sparkles,
      color: "text-pink-600",
      bgColor: "bg-pink-600/10",
      ringColor: "ring-pink-600",
      buttonBg: "bg-pink-600 hover:bg-pink-600/90",
    },
    miranda: {
      title: "Miranda Priestly",
      description: "Runway editor with impossibly high standards",
      icon: Star,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
      ringColor: "ring-purple-600",
      buttonBg: "bg-purple-600 hover:bg-purple-600/90",
    },
    shaft: {
      title: "John Shaft Style",
      description: "Cool 1970s sophistication with an edge",
      icon: ShoppingBag,
      color: "text-orange-600",
      bgColor: "bg-orange-600/10",
      ringColor: "ring-orange-600",
      buttonBg: "bg-orange-600 hover:bg-orange-600/90",
    },
  };

  const config = personaConfig[persona];
  const Icon = config.icon;

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 elegant-shadow hover:scale-[1.02] ${
        isSelected ? `ring-2 ${config.ringColor} shadow-xl bg-primary/5` : "hover:shadow-lg"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={() => !disabled && onSelect(persona)}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{config.title}</h4>
            <p className="text-muted-foreground text-xs truncate">
              {config.description}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={isSelected ? "default" : "outline"}
          className={`w-full mt-3 text-xs ${
            isSelected ? `${config.buttonBg} text-white` : `border-primary/30 text-primary hover:bg-primary/5`
          }`}
          disabled={disabled}
        >
          {isSelected ? "Selected" : "Select"}
        </Button>
      </div>
    </Card>
  );
}

function ChatMessage({
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

function StyleSuggestions({ suggestions }: { suggestions: StyleSuggestion[] }) {
  if (suggestions.length === 0) return null;

  return (
    <Card className="mt-6 elegant-shadow">
      <CardHeader className="glass-effect pb-3 pt-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Style Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="glass-effect rounded-lg p-3">
              <h4 className="font-semibold capitalize text-sm mb-3 flex items-center gap-2 text-primary">
                <ShoppingBag className="h-4 w-4" />
                {suggestion.category}
              </h4>
              <div className="space-y-2">
                {suggestion.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="p-2 bg-background/50 rounded-lg border border-primary/10"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-xs">{item.name}</p>
                      <Badge
                        variant={
                          item.priority === "high"
                            ? "default"
                            : item.priority === "medium"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs ml-2"
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {item.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AIStylist() {
  const [selectedPersona, setSelectedPersona] =
    useState<StylistPersona>("luxury");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<StyleSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeGuidedPrompt, setActiveGuidedPrompt] = useState<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    conversationHistory,
    loading,
    error,
    chatWithStylist,
    generateStyleSuggestions,
    clearConversation,
    clearError,
  } = useAIStylist(selectedPersona);

  // Sync conversation history with messages
  useEffect(() => {
    const newMessages: Message[] = conversationHistory.map((msg, index) => ({
      id: `${msg.timestamp}-${index}`,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));
    setMessages(newMessages);
  }, [conversationHistory]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage("");

    try {
      const response = await chatWithStylist(userMessage);
      if (response) {
        // Update the last assistant message with recommendations and tips
        setMessages((prev) => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            updated[updated.length - 1] = {
              ...lastMessage,
              recommendations: response.recommendations,
              stylingTips: response.stylingTips,
            };
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }, [message, loading, chatWithStylist]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  const handlePersonaChange = useCallback(
    (persona: StylistPersona) => {
      if (persona === selectedPersona) return;

      setSelectedPersona(persona);
      clearConversation();
      setMessages([]);
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveGuidedPrompt(null);
    },
    [selectedPersona, clearConversation],
  );

  const handleGenerateSuggestions = useCallback(async () => {
    const preferences = {
      style: selectedPersona,
      occasion: "everyday",
      budget: "flexible",
    };

    const newSuggestions = await generateStyleSuggestions(preferences);
    if (newSuggestions) {
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    }
  }, [selectedPersona, generateStyleSuggestions]);

  const startConversation = useCallback(() => {
    const greetings = {
      luxury:
        "Hello! I'm your luxury fashion expert. I can help you discover sophisticated pieces, investment items, and timeless elegance. What would you like to explore today?",
      streetwear:
        "Hey! I'm your streetwear guru. Ready to dive into the latest drops, urban fashion, and fresh street style? What's on your mind?",
      sustainable:
        "Hi there! I'm your sustainable fashion consultant. Let's find beautiful, ethical pieces that align with your values. How can I help you build a more conscious wardrobe?",
      edina:
        "Darling! Sweetie! It's Edina, and I am absolutely OBSESSED with making you look fabulous! We're going to create looks that are so avant-garde, so cutting-edge, so absolutely divine! What fashion emergency can I solve for you today?",
      miranda:
        "I am Miranda Priestly. You have come to me seeking fashion guidance, and I will provide it - but only if you're prepared to meet the highest standards. Tell me what you need, and I will determine if it's worthy of my attention.",
      shaft:
        "Right on. You've come to the right cat for some serious style advice. I know how to put together a look that commands respect and turns heads. What kind of situation are we styling for? Let's make it smooth.",
    };

    const welcomeMessage: Message = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: greetings[selectedPersona],
      timestamp: Date.now(),
    };

    setMessages([welcomeMessage]);
  }, [selectedPersona]);

  const handleGuidedPromptSelect = (promptText: string) => {
    setMessage(promptText);
    setActiveGuidedPrompt(null);
  };

  return (
    <section className="py-16 bg-subtle-gradient">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            AI Stylist Agent
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base leading-relaxed">
            Get personalized fashion advice, sourcing recommendations, and
            styling expertise from our intelligent fashion consultants.
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Compact Stylist Selection */}
          <Card className="elegant-shadow">
            <CardHeader className="glass-effect pb-4 pt-4">
              <CardTitle className="text-center text-lg">Choose Your Stylist</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Top Row - 3 Stylists */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <PersonaCard
                  persona="luxury"
                  isSelected={selectedPersona === "luxury"}
                  onSelect={handlePersonaChange}
                  disabled={loading}
                />
                <PersonaCard
                  persona="streetwear"
                  isSelected={selectedPersona === "streetwear"}
                  onSelect={handlePersonaChange}
                  disabled={loading}
                />
                <PersonaCard
                  persona="sustainable"
                  isSelected={selectedPersona === "sustainable"}
                  onSelect={handlePersonaChange}
                  disabled={loading}
                />
              </div>
              
              {/* Bottom Row - 3 Stylists */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <PersonaCard
                  persona="edina"
                  isSelected={selectedPersona === "edina"}
                  onSelect={handlePersonaChange}
                  disabled={loading}
                />
                <PersonaCard
                  persona="miranda"
                  isSelected={selectedPersona === "miranda"}
                  onSelect={handlePersonaChange}
                  disabled={loading}
                />
                <PersonaCard
                  persona="shaft"
                  isSelected={selectedPersona === "shaft"}
                  onSelect={handlePersonaChange}
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Chat Interface */}
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

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="mt-2 h-6 text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Style Suggestions */}
          {showSuggestions && <StyleSuggestions suggestions={suggestions} />}
        </div>
      </div>
    </section>
  );
}
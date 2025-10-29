import React, { useState, useCallback, useRef, useEffect } from "react";
import { MessageCircle, Sparkles, User, Globe, Calendar, Sun, Cloud, Users, MapPin, Clock } from "lucide-react";
import { useAIStylist } from "@repo/ai-client";
import type { StylistPersona, StyleSuggestion } from "@repo/ai-client";
import { Button } from "@repo/ui/button";

import { StylistSelection } from "./AIStylist/StylistSelection";
import { ContextCollector } from "./AIStylist/ContextCollector";
import { ChatInterface } from "./AIStylist/ChatInterface";
import { StyleSuggestions } from "./AIStylist/StyleSuggestions";

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
    label: 'Location',
    placeholder: 'Where are you going?',
    examples: ["City", "Beach", "Mountains", "Restaurant"]
  },
  {
    icon: Clock,
    text: "What time of day?",
    examples: ["Morning", "Afternoon", "Evening", "Night"]
  }
];

// Context fields for structured styling information
const contextFields = [
  {
    id: 'occasion',
    icon: Calendar,
    label: 'Occasion',
    placeholder: 'What event or activity?',
    examples: ["Work meeting", "Wedding", "Casual weekend", "Date night"]
  },
  {
    id: 'weather',
    icon: Cloud,
    label: 'Weather',
    placeholder: 'Current weather?',
    examples: ["Sunny", "Rainy", "Cold", "Warm"]
  },
  {
    id: 'location',
    icon: MapPin,
    label: 'Location',
    placeholder: 'Where are you going?',
    examples: ["City", "Beach", "Mountains", "Restaurant"]
  },
  {
    id: 'time',
    icon: Clock,
    label: 'Time of Day',
    placeholder: 'What time?',
    examples: ["Morning", "Afternoon", "Evening", "Night"]
  },
  {
    id: 'gender',
    icon: Users,
    label: 'Gender',
    placeholder: 'Your gender?',
    examples: ["Male", "Female", "Non-binary"]
  },
  {
    id: 'ageRange',
    icon: User,
    label: 'Age Range',
    placeholder: 'Your age range?',
    examples: ["18-25", "26-35", "36-45", "46+"]
  },
  {
    id: 'ethnicity',
    icon: Globe,
    label: 'Ethnicity',
    placeholder: 'Your ethnicity?',
    examples: ["Caucasian", "Asian", "Hispanic", "African", "Other"]
  }
];

export function AIStylist() {
  const [selectedPersona, setSelectedPersona] =
    useState<StylistPersona>("luxury");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<StyleSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeGuidedPrompt, setActiveGuidedPrompt] = useState<number | null>(null);
  const [contextStep, setContextStep] = useState<'initial' | 'context' | 'chat'>('context');
  const [contextData, setContextData] = useState({
    occasion: '',
    weather: '',
    location: '',
    time: '',
    gender: '',
    ageRange: '',
    ethnicity: ''
  });
  const [contextErrors, setContextErrors] = useState<Record<string, boolean>>({});
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
      // If we're in chat mode, go back to context gathering to let user reconsider with new persona
      if (contextStep === 'chat') {
        setContextStep('context');
        setContextData({occasion: '', weather: '', location: '', time: '', gender: '', ageRange: '', ethnicity: ''});
      }
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
    setContextStep('chat');
  }, [selectedPersona]);

  const handleGuidedPromptSelect = (promptText: string) => {
    // If we're still in context gathering phase, try to map the selection to context fields
    if (contextStep === 'context' || contextStep === 'initial') {
      // Try to match the prompt to one of our context fields
      let matchedField = false;
      
      for (const field of contextFields) {
        if (field.examples.includes(promptText)) {
          handleContextChange(field.id, promptText);
          matchedField = true;
          break;
        }
      }
      
      // If no field matched, just add to message
      if (!matchedField) {
        setMessage(prev => prev ? `${prev} ${promptText}` : promptText);
      }
    } else {
      // In chat mode, add to message
      setMessage(prev => prev ? `${prev} ${promptText}` : promptText);
    }
    
    setActiveGuidedPrompt(null);
  };

  const handleContextChange = (field: string, value: string) => {
    setContextData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (contextErrors[field]) {
      setContextErrors(prev => ({
        ...prev,
        [field]: false
      }));
    }
  };

  const validateContext = (): boolean => {
    const requiredFields = ['occasion', 'weather', 'location', 'time'];
    const errors: Record<string, boolean> = {};
    
    requiredFields.forEach(field => {
      if (!contextData[field as keyof typeof contextData]) {
        errors[field] = true;
      }
    });
    
    setContextErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartChat = () => {
    if (validateContext()) {
      // Create a context summary message to provide to the AI
      let contextSummary = `I'm styling for: ${contextData.occasion} in ${contextData.weather} weather, at ${contextData.location}, during ${contextData.time}.`;
      if (contextData.gender) {
        contextSummary += ` I am ${contextData.gender}`;
      }
      if (contextData.ageRange) {
        contextSummary += `, in the ${contextData.ageRange} age range`;
      }
      if (contextData.ethnicity) {
        contextSummary += `, and of ${contextData.ethnicity} ethnicity.`;
      }
      
      const contextMessage: Message = {
        id: `context-${Date.now()}`,
        role: "user",
        content: contextSummary,
        timestamp: Date.now(),
      };
      
      // Add context message to conversation and proceed to chat
      setMessages([contextMessage]);
      setContextStep('chat');
      
      // Send context to stylist to begin conversation
      chatWithStylist(contextSummary);
    }
  };

  const handleSkipContext = () => {
    setContextStep('chat');
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
          <StylistSelection
            selectedPersona={selectedPersona}
            handlePersonaChange={handlePersonaChange}
            loading={loading}
          />

          {contextStep === 'context' ? (
            <ContextCollector
              contextData={contextData}
              contextErrors={contextErrors}
              contextFields={contextFields}
              handleContextChange={handleContextChange}
              handleStartChat={handleStartChat}
              handleSkipContext={handleSkipContext}
            />
          ) : (
            <ChatInterface
              selectedPersona={selectedPersona}
              loading={loading}
              messages={messages}
              scrollAreaRef={scrollAreaRef}
              activeGuidedPrompt={activeGuidedPrompt}
              guidedPrompts={guidedPrompts}
              handleGenerateSuggestions={handleGenerateSuggestions}
              clearConversation={clearConversation}
              setMessages={setMessages}
              setSuggestions={setSuggestions}
              setShowSuggestions={setShowSuggestions}
              setActiveGuidedPrompt={setActiveGuidedPrompt}
              startConversation={startConversation}
              message={message}
              setMessage={setMessage}
              handleKeyPress={handleKeyPress}
              handleSendMessage={handleSendMessage}
              handleGuidedPromptSelect={handleGuidedPromptSelect}
            />
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

          {/* Style Suggestions */}
          {showSuggestions && <StyleSuggestions suggestions={suggestions} />}
        </div>
      </div>
    </section>
  );
}
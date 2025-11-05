import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Sparkles } from "lucide-react";

interface ContextField {
  id: string;
  icon: React.ElementType;
  label: string;
  placeholder: string;
  examples: string[];
}

interface ContextCollectorProps {
  contextData: Record<string, string>;
  contextErrors: Record<string, boolean>;
  contextFields: ContextField[];
  handleContextChange: (field: string, value: string) => void;
  handleStartChat: () => void;
  handleSkipContext: () => void;
}

export function ContextCollector({
  contextData,
  contextErrors,
  contextFields,
  handleContextChange,
  handleStartChat,
  handleSkipContext,
}: ContextCollectorProps) {
  const [showOptional, setShowOptional] = React.useState(false);

  // Essential fields for better styling advice
  const essentialFields = contextFields.slice(0, 4); // occasion, weather, location, time
  const optionalFields = contextFields.slice(4); // gender, age, ethnicity

  // Quick scenario presets
  const quickScenarios = [
    { label: "Work", icon: "💼", data: { occasion: "Work meeting", weather: "Indoor", location: "Office", time: "Morning" } },
    { label: "Date", icon: "💕", data: { occasion: "Date night", weather: "Evening", location: "Restaurant", time: "Evening" } },
    { label: "Casual", icon: "☀️", data: { occasion: "Casual weekend", weather: "Sunny", location: "City", time: "Afternoon" } },
    { label: "Event", icon: "✨", data: { occasion: "Wedding", weather: "Outdoor", location: "Venue", time: "Evening" } }
  ];

  const handleQuickScenario = (scenarioData: Record<string, string>) => {
    Object.entries(scenarioData).forEach(([key, value]) => {
      handleContextChange(key, value);
    });
  };

  const hasEssentialData = essentialFields.every(field =>
    contextData[field.id as keyof typeof contextData]
  );

  return (
    <Card className="elegant-shadow max-w-2xl mx-auto">
      <CardHeader className="glass-effect pb-4 pt-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Style Context</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipContext}
            className="ml-auto text-xs"
          >
            Skip
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Help me understand your styling needs for better recommendations
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Scenarios */}
        <div className="text-center">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {quickScenarios.map((scenario, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="h-12 flex-col gap-1 text-xs"
                onClick={() => handleQuickScenario(scenario.data)}
              >
                <span className="text-base">{scenario.icon}</span>
                {scenario.label}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mb-4">Quick presets or customize below</div>
        </div>

        {/* Essential Fields - Compact Grid */}
        <div className="grid grid-cols-2 gap-3 text-center">
          {essentialFields.map((field) => {
            const Icon = field.icon;
            return (
            <div key={field.id} className="space-y-1 text-center">
                <div className="flex items-center justify-center gap-1">
                <Icon className="h-3 w-3 text-primary" />
                <label className="text-xs font-medium">{field.label}</label>
                {contextErrors[field.id] && <span className="text-xs text-destructive">*</span>}
                </div>
                <Input
                  placeholder={field.placeholder}
                  value={contextData[field.id as keyof typeof contextData]}
                  onChange={(e) => handleContextChange(field.id, e.target.value)}
                  className={`text-xs h-8 text-center ${contextErrors[field.id] ? "border-destructive" : ""}`}
                />
                <div className="flex flex-wrap gap-1 justify-center">
                  {field.examples.slice(0, 2).map((example, idx) => (
                    <Button
                      key={idx}
                      variant={contextData[field.id as keyof typeof contextData] === example ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => handleContextChange(field.id, example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Optional Fields Toggle */}
        {!showOptional && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOptional(true)}
              className="text-xs text-muted-foreground"
            >
              + Add personal details for better recommendations
            </Button>
          </div>
        )}

        {/* Optional Fields */}
        {showOptional && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Personal Details (Optional)</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOptional(false)}
                className="text-xs h-6"
              >
                Hide
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {optionalFields.map((field) => {
                const Icon = field.icon;
                return (
                  <div key={field.id} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <Icon className="h-3 w-3 text-primary flex-shrink-0" />
                      <label className="text-xs font-medium flex-shrink-0">{field.label}</label>
                      <Input
                        placeholder={field.placeholder}
                        value={contextData[field.id as keyof typeof contextData]}
                        onChange={(e) => handleContextChange(field.id, e.target.value)}
                        className="text-xs h-7 flex-1"
                      />
                    </div>
                    <div className="flex gap-1">
                      {field.examples.slice(0, 3).map((example, idx) => (
                        <Button
                          key={idx}
                          variant={contextData[field.id as keyof typeof contextData] === example ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => handleContextChange(field.id, example)}
                        >
                          {example}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 text-center">
          <Button
            onClick={handleStartChat}
            className="fashion-gradient text-white px-8"
            disabled={!hasEssentialData}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Start Styling Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
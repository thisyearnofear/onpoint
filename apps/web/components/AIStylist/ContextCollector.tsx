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
  const [currentStep, setCurrentStep] = React.useState(0);

  // Progressive disclosure: Essential fields first, then optional
  const essentialFields = contextFields.slice(0, 4); // occasion, weather, location, time

  const showingEssential = currentStep === 0;
  const fieldsToShow = showingEssential ? essentialFields : contextFields;

  // Quick scenario presets
  const quickScenarios = [
    {
      label: "Work Meeting",
      icon: "💼",
      data: { occasion: "Work meeting", weather: "Indoor", location: "Office", time: "Morning" }
    },
    {
      label: "Date Night",
      icon: "💕",
      data: { occasion: "Date night", weather: "Evening", location: "Restaurant", time: "Evening" }
    },
    {
      label: "Weekend Casual",
      icon: "☀️",
      data: { occasion: "Casual weekend", weather: "Sunny", location: "City", time: "Afternoon" }
    },
    {
      label: "Special Event",
      icon: "✨",
      data: { occasion: "Wedding", weather: "Outdoor", location: "Venue", time: "Evening" }
    }
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
    <Card className="elegant-shadow">
      <CardHeader className="glass-effect pb-3 pt-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Style Context
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <div className={`h-2 w-2 rounded-full ${showingEssential ? 'bg-primary' : 'bg-primary/30'}`} />
          <div className={`h-2 w-2 rounded-full ${!showingEssential ? 'bg-primary' : 'bg-primary/30'}`} />
          <span className="text-xs text-muted-foreground ml-2">
            Step {currentStep + 1} of 2
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold mb-2">
              {showingEssential ? "Quick Setup" : "Personal Details (Optional)"}
            </h3>
            <p className="text-muted-foreground">
              {showingEssential
                ? "Start with a quick scenario or fill in the essentials"
                : "Add more details for personalized recommendations"
              }
            </p>
          </div>

          {/* Quick Scenarios - Only show on first step */}
          {showingEssential && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <span>⚡</span> Quick Start
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {quickScenarios.map((scenario, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="h-auto p-3 text-left justify-start"
                    onClick={() => handleQuickScenario(scenario.data)}
                  >
                    <span className="mr-2">{scenario.icon}</span>
                    <span className="text-xs">{scenario.label}</span>
                  </Button>
                ))}
              </div>
              <div className="text-center my-4">
                <span className="text-xs text-muted-foreground bg-background px-2">or customize below</span>
              </div>
            </div>
          )}

          {fieldsToShow.map((field) => {
            const Icon = field.icon;
            const isRequired = essentialFields.includes(field);
            return (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary" />
                  <label className="font-medium text-sm">{field.label}</label>
                  {isRequired && contextErrors[field.id] && (
                    <span className="text-xs text-destructive ml-auto">(required)</span>
                  )}
                  {!isRequired && (
                    <span className="text-xs text-muted-foreground ml-auto">(optional)</span>
                  )}
                </div>

                <Input
                  placeholder={field.placeholder}
                  value={contextData[field.id as keyof typeof contextData]}
                  onChange={(e) => handleContextChange(field.id, e.target.value)}
                  className={contextErrors[field.id] ? "border-destructive" : ""}
                />

                <div className="flex flex-wrap gap-2 mt-2">
                  {field.examples.map((example, idx) => (
                    <Button
                      key={idx}
                      variant={contextData[field.id as keyof typeof contextData] === example ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleContextChange(field.id, example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-4">
            {showingEssential ? (
              <>
                <Button
                  onClick={handleStartChat}
                  className="fashion-gradient text-white flex-1"
                  disabled={!hasEssentialData}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Styling Session
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  disabled={!hasEssentialData}
                >
                  Add Details
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleSkipContext}
                  size="sm"
                >
                  Skip
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(0)}
                >
                  Back
                </Button>
                <Button
                  onClick={handleStartChat}
                  className="fashion-gradient text-white flex-1"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Styling Session
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
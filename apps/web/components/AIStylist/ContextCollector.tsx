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
  return (
    <Card className="elegant-shadow">
      <CardHeader className="glass-effect pb-3 pt-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Style Context
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold mb-2">Let&apos;s get to know your style situation</h3>
            <p className="text-muted-foreground">Fill in these details to get personalized styling advice</p>
          </div>
          
          {contextFields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.id} className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary" />
                  <label className="font-medium text-sm">{field.label}</label>
                  {contextErrors[field.id] && (
                    <span className="text-xs text-destructive ml-auto">(required)</span>
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
            <Button
              onClick={handleStartChat}
              className="fashion-gradient text-white flex-1"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Get Styling Advice
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipContext}
            >
              Skip for now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Sparkles, ShoppingBag, Palette, Camera, ExternalLink } from "lucide-react";
import type { StyleSuggestion } from "@repo/ai-client";

interface StyleSuggestionsProps {
  suggestions: StyleSuggestion[];
}

export function StyleSuggestions({ suggestions }: StyleSuggestionsProps) {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

        {/* Action Buttons */}
        <div className="border-t border-border pt-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => window.open('/collage', '_blank')}
              className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Palette className="h-4 w-4" />
              Create Visual Board
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/style', '_blank')}
              className="flex items-center gap-2 border-accent/30 text-accent hover:bg-accent/5"
            >
              <Camera className="h-4 w-4" />
              Try On Virtually
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/', '_blank')}
              className="flex items-center gap-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted/5"
            >
              <ExternalLink className="h-4 w-4" />
              Design Studio
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Take your styling session further with our integrated tools
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
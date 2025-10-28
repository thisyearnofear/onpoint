"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Sparkles, RefreshCw, Save, Wand2 } from "lucide-react";
import { useDesignStudio } from "@repo/ai-client";
import type { DesignGeneration } from "@repo/ai-client";

export function DesignStudio() {
  const [visionInput, setVisionInput] = useState("");
  const [refinementInput, setRefinementInput] = useState("");
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);

  const { designs, loading, error, generateDesign, refineDesign, clearError } =
    useDesignStudio();

  const handleGenerate = useCallback(async () => {
    if (!visionInput.trim()) return;

    const design = await generateDesign(visionInput.trim());
    if (design) {
      setSelectedDesign(design.id);
      setVisionInput("");
    }
  }, [visionInput, generateDesign]);

  const handleRefine = useCallback(async () => {
    if (!selectedDesign || !refinementInput.trim()) return;

    const success = await refineDesign(selectedDesign, refinementInput.trim());
    if (success) {
      setRefinementInput("");
    }
  }, [selectedDesign, refinementInput, refineDesign]);

  const handleVariationGenerate = useCallback(
    async (baseDesign: DesignGeneration) => {
      const variationPrompt = `Create a variation of: ${baseDesign.designPrompt}`;
      await generateDesign(variationPrompt);
    },
    [generateDesign],
  );

  const renderDesignPreview = (design: DesignGeneration, index: number) => (
    <Card
      key={design.id}
      className={`cursor-pointer transition-all duration-200 elegant-shadow ${
        selectedDesign === design.id
          ? "ring-2 ring-primary shadow-xl bg-primary/5"
          : "hover:ring-1 hover:ring-primary/30 hover:shadow-xl"
      }`}
      onClick={() => setSelectedDesign(design.id)}
    >
      <CardHeader className="pb-3 glass-effect">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Design {index + 1}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {new Date(design.timestamp).toLocaleTimeString()}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm text-foreground line-clamp-3 leading-relaxed">
            {design.description.split("\n")[0]}
          </p>
          <div className="flex flex-wrap gap-1">
            {design.tags.slice(0, 3).map((tag, tagIndex) => (
              <Badge key={tagIndex} variant="outline" className="text-xs border-primary/30 text-primary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const selectedDesignData = designs.find((d) => d.id === selectedDesign);

  return (
    <section className="py-20 bg-subtle-gradient">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Design Studio</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Describe your fashion vision and watch AI bring it to life. Generate
            multiple variations and refine your designs with intuitive controls.
          </p>
        </div>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Input Section */}
          <Card className="elegant-shadow">
            <CardContent className="p-6">
              <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Describe your fashion vision... (e.g., 'elegant evening gown with floral embroidery')"
                    value={visionInput}
                    onChange={(e) => setVisionInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !loading && handleGenerate()
                    }
                    className="pr-12"
                    disabled={loading}
                  />
                  <Sparkles className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !visionInput.trim()}
                  className="fashion-gradient text-white min-w-[120px]"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>

              {error && (
                <div className="mb-4 p-4 glass-effect border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm font-medium">{error}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="mt-2"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Design Previews */}
          {designs.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {designs
                  .slice(0, 6)
                  .map((design, index) => renderDesignPreview(design, index))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center glass-effect rounded-lg p-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedDesign || loading}
                    onClick={() =>
                      selectedDesignData &&
                      handleVariationGenerate(selectedDesignData)
                    }
                    className="border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Variations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedDesign}
                    onClick={() => {
                      // Toggle refinement input visibility
                      const refinementSection =
                        document.getElementById("refinement-section");
                      if (refinementSection) {
                        refinementSection.style.display =
                          refinementSection.style.display === "none"
                            ? "block"
                            : "none";
                      }
                    }}
                    className="border-accent/30 text-accent hover:bg-accent/5"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Refine Design
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!selectedDesign}
                  onClick={() => {
                    // TODO: Implement save to lookbook
                    alert("Save to Lookbook feature coming soon!");
                  }}
                  className="bg-primary/10 text-primary hover:bg-primary/20"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save to Lookbook
                </Button>
              </div>
            </>
          )}

          {/* Refinement Section */}
          <div id="refinement-section" style={{ display: "none" }}>
            <Card className="elegant-shadow">
              <CardHeader className="glass-effect">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-accent" />
                  Refine Selected Design
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Make adjustments to perfect your design
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Describe refinements... (e.g., 'softer colors', 'more structured silhouette')"
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && !loading && handleRefine()
                      }
                      className="pr-12"
                      disabled={loading}
                    />
                    <Wand2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <Button
                    onClick={handleRefine}
                    disabled={
                      loading || !refinementInput.trim() || !selectedDesign
                    }
                    className="fashion-gradient text-white min-w-[100px]"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Apply Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Design Details */}
          {selectedDesignData && (
            <Card className="elegant-shadow">
              <CardHeader className="glass-effect">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Design Details
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Complete specifications for your selected design
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass-effect rounded-lg p-4">
                    <h4 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      Design Description
                    </h4>
                    <div className="prose prose-sm max-w-none">
                      {selectedDesignData.description
                        .split("\n")
                        .map((line, index) => (
                          <p key={index} className="mb-3 text-sm leading-relaxed">
                            {line}
                          </p>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-effect rounded-lg p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2 text-accent">
                        <Wand2 className="h-4 w-4" />
                        Original Prompt
                      </h4>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">
                        &ldquo;{selectedDesignData.designPrompt}&rdquo;
                      </p>
                    </div>

                    <div className="glass-effect rounded-lg p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                        <Badge className="h-4 w-4 p-0" />
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDesignData.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="border-primary/30 text-primary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {selectedDesignData.variations.length > 0 && (
                      <div className="glass-effect rounded-lg p-4">
                        <h4 className="font-semibold mb-3 flex items-center gap-2 text-accent">
                          <RefreshCw className="h-4 w-4" />
                          Variations
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedDesignData.variations.length} variation(s) available
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Getting Started Message */}
          {designs.length === 0 && !loading && (
            <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Design Studio Ready</h3>
                <p className="text-muted-foreground text-center max-w-lg mb-6 leading-relaxed">
                  Transform your fashion vision into reality. Describe any garment or style
                  you can imagine, and watch as AI brings your creative concepts to life
                  with detailed designs and specifications.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                  <div className="text-center p-4 rounded-lg bg-background/50">
                    <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">AI Generation</p>
                    <p className="text-xs text-muted-foreground">Instant design creation</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-background/50">
                    <RefreshCw className="h-6 w-6 text-accent mx-auto mb-2" />
                    <p className="text-sm font-medium">Variations</p>
                    <p className="text-xs text-muted-foreground">Multiple options</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-background/50">
                    <Wand2 className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">Refinement</p>
                    <p className="text-xs text-muted-foreground">Iterative improvement</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

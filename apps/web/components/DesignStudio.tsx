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
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        selectedDesign === design.id
          ? "ring-2 ring-primary shadow-lg"
          : "hover:ring-1 hover:ring-primary/50"
      }`}
      onClick={() => setSelectedDesign(design.id)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Design {index + 1}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground line-clamp-3">
            {design.description.split("\n")[0]}
          </p>
          <div className="flex flex-wrap gap-1">
            {design.tags.slice(0, 3).map((tag, tagIndex) => (
              <Badge key={tagIndex} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(design.timestamp).toLocaleTimeString()}
          </p>
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
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4 mb-6">
                <Input
                  placeholder="Describe your fashion idea... (e.g., 'a high-fashion streetwear jacket with reflective material')"
                  value={visionInput}
                  onChange={(e) => setVisionInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !loading && handleGenerate()
                  }
                  className="flex-1"
                  disabled={loading}
                />
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
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm">{error}</p>
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
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selectedDesign || loading}
                    onClick={() =>
                      selectedDesignData &&
                      handleVariationGenerate(selectedDesignData)
                    }
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Variations
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
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Refine
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!selectedDesign}
                  onClick={() => {
                    // TODO: Implement save to lookbook
                    alert("Save to Lookbook feature coming soon!");
                  }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save to Lookbook
                </Button>
              </div>
            </>
          )}

          {/* Refinement Section */}
          <div id="refinement-section" style={{ display: "none" }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Refine Selected Design
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input
                    placeholder="Describe what you'd like to change... (e.g., 'make it more casual', 'add floral patterns')"
                    value={refinementInput}
                    onChange={(e) => setRefinementInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !loading && handleRefine()
                    }
                    className="flex-1"
                    disabled={loading}
                  />
                  <Button
                    onClick={handleRefine}
                    disabled={
                      loading || !refinementInput.trim() || !selectedDesign
                    }
                    variant="outline"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Design Details */}
          {selectedDesignData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Design Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Design Description</h4>
                    <div className="prose prose-sm max-w-none">
                      {selectedDesignData.description
                        .split("\n")
                        .map((line, index) => (
                          <p key={index} className="mb-2 text-sm">
                            {line}
                          </p>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Original Prompt</h4>
                      <p className="text-sm text-muted-foreground italic">
                        &ldquo;{selectedDesignData.designPrompt}&rdquo;
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDesignData.tags.map((tag, index) => (
                          <Badge key={index} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {selectedDesignData.variations.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">
                          Variations Available
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {selectedDesignData.variations.length} variation(s)
                          generated
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
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Ready to Create?</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Describe your fashion vision above and let AI generate unique
                  designs for you. Try prompts like &ldquo;vintage-inspired
                  denim jacket&rdquo; or &ldquo;elegant evening dress with
                  geometric patterns&rdquo;.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

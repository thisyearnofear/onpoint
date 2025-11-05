'use client';

import React from 'react';
import { Palette, Sparkles, ArrowLeft, Shirt, Wand2 } from 'lucide-react';
import { Button } from '@repo/ui/button';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Input } from '@repo/ui/input';
import InteractiveStylingCanvas from '@repo/shared-ui/components/InteractiveStylingCanvas';
import { useAIColorPalette, useAIStyleSuggestions, useAIVirtualTryOnEnhancement } from '@onpoint/ai-client';
import Link from 'next/link';

export default function StylePage() {
  const { palette, loading: paletteLoading, error: paletteError, generatePalette, clearError } = useAIColorPalette();
  const { suggestions } = useAIStyleSuggestions();
  const { enhancement, loading: enhancementLoading, enhanceTryOn } = useAIVirtualTryOnEnhancement();

  const [palettePrompt, setPalettePrompt] = React.useState('Fashion outfit with streetwear elements');
  const [selectedCanvasColor, setSelectedCanvasColor] = React.useState<string | undefined>();

  const palettePresets = [
    'Fashion outfit with streetwear elements',
    'Professional business attire',
    'Casual weekend outfit',
    'Evening cocktail dress',
    'Summer beach wear',
    'Winter formal wear'
  ];

  const mockOutfitItems = [
    {
      id: '1',
      name: 'Urban Streetwear Jacket',
      description: 'High-fashion streetwear jacket with reflective material and bold geometric patterns',
      imageUrl: '/assets/1Product.png'
    },
    {
      id: '2',
      name: 'Designer Sneakers',
      description: 'Limited edition sneakers with unique color blocking and premium materials',
      imageUrl: '/assets/2Product.png'
    }
  ];

  const handleGenerateVariations = () => {
    alert('Generate variations with AI - feature implementation in progress!');
  };

  const handleColorPalette = async () => {
    if (!palettePrompt.trim()) {
      alert('Please enter a description for your color palette');
      return;
    }
    await generatePalette(palettePrompt);
  };

  const handleAIEnhance = async () => {
    
    await enhanceTryOn(mockOutfitItems);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 w-full border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Palette className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              OnPoint Style Lab
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
          <ConnectButton showBalance={false} chainStatus="none" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">


        {/* Page Header */}
        <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
        Interactive
        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        {' '}Style Canvas
        </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
        Experiment with colors, patterns, and styles. Mix and match elements to create unique fashion designs.
        </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
        <Button
        onClick={handleGenerateVariations}
        variant="outline"
        className="flex items-center gap-2"
        disabled={false}
        >
        <Sparkles className="h-4 w-4" />
        Generate Variations
        </Button>

        {/* Color Palette Input and Button */}
        <div className="flex flex-col gap-3 min-w-[300px]">
        <div className="flex flex-col gap-2">
        <div className="space-y-2">
        <Input
          type="text"
          value={palettePrompt}
          onChange={(e) => {
            setPalettePrompt(e.target.value);
            if (paletteError) clearError(); // Clear error when user types
          }}
          placeholder="e.g., 'Summer beach outfit', 'Professional business attire', 'Evening cocktail dress'..."
            className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              💡 Try: occasion + style + mood (e.g., "casual weekend outfit", "formal wedding colors", "minimalist office wear")
            </p>
          </div>
        <Button
        onClick={handleColorPalette}
        variant="outline"
        className="flex items-center gap-2 w-full"
        disabled={paletteLoading}
        >
        <Palette className="h-4 w-4" />
        {paletteLoading ? (
            <>
                <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
                Generating...
              </>
            ) : (
              'Generate Palette'
            )}
          </Button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1 justify-center">
            <span className="text-xs text-muted-foreground mr-2 self-center">Quick:</span>
            {palettePresets.slice(0, 3).map((preset, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setPalettePrompt(preset)}
                disabled={paletteLoading}
              >
                {preset.split(' ')[0]}
              </Button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleAIEnhance}
          className="fashion-gradient text-white flex items-center gap-2"
          disabled={enhancementLoading}
        >
        <Wand2 className="h-4 w-4" />
        {enhancementLoading ? 'Enhancing...' : 'AI Enhance'}
        </Button>
        </div>

        {/* Error Display */}
        {paletteError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4 max-w-2xl mx-auto">
            <p className="text-sm text-destructive">{paletteError}</p>
          </div>
        )}

        {/* AI Color Palette Display */}
        {palette && (
        <div className="elegant-shadow border-0 rounded-lg bg-card p-4 mb-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
          <span className="font-medium">Color Palette</span>
        </div>
        <span className="text-xs text-muted-foreground">Click to apply</span>
        </div>

        <p className="text-sm text-muted-foreground mb-3">{palette.description}</p>

        <div className="flex flex-wrap gap-3 mb-3">
              {palette.colors.map((color, index) => {
            const isSelected = selectedCanvasColor === (typeof color === 'string' ? color : color.hex);
          const hexValue = typeof color === 'string' ? color : color.hex;
        const nameValue = typeof color === 'string' ? '' : color.name;

        return (
        <div key={index} className="flex flex-col items-center cursor-pointer group">
        <div
        className={`w-12 h-12 rounded-md border-2 transition-all duration-200 ${
        isSelected
        ? 'border-primary ring-2 ring-primary/20 scale-110'
            : 'border-muted-foreground/20 group-hover:border-primary/50'
        }`}
        style={{ backgroundColor: hexValue }}
        onClick={() => setSelectedCanvasColor(isSelected ? undefined : hexValue)}
          title={isSelected ? `Selected: ${hexValue}` : `Click to select ${hexValue}`}
        />
        <span className={`text-xs mt-1 font-mono transition-colors ${
          isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
        }`}>
          {hexValue}
        </span>
        {nameValue && (
        <span className={`text-xs max-w-[60px] text-center leading-tight ${
          isSelected ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {nameValue}
          </span>
          )}
          </div>
          );
          })}
            </div>

        {/* Compact Styling Tips */}
        {palette.stylingTips && palette.stylingTips.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1">
        {palette.stylingTips.slice(0, 2).map((tip, index) => (
        <div key={index} className="flex items-start gap-1">
        <span className="text-primary mt-1">•</span>
        <span>{tip}</span>
        </div>
        ))}
        </div>
        )}
        </div>
        )}

        {/* AI Style Suggestions Display */}
        {suggestions && (
          <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Shirt className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">AI Style Suggestions</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="border border-muted-foreground/20 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{suggestion.category}</h4>
                  <div className="space-y-2">
                    {suggestion.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="text-sm">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Virtual Try-On Enhancement Display */}
        {enhancement && (
          <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">AI Enhanced Virtual Try-On</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Enhanced Outfit</h4>
                <div className="space-y-3">
                  {enhancement.enhancedOutfit.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/10 rounded-lg">
                      <div className="w-12 h-12 rounded bg-muted-foreground/10 flex items-center justify-center">
                        <Shirt className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <h5 className="font-medium">{item.name}</h5>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Styling Tips</h4>
                <ul className="space-y-2">
                  {enhancement.stylingTips.map((tip, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Canvas */}
        <div className="elegant-shadow border-0 rounded-lg bg-card p-6">
          <InteractiveStylingCanvas
            selectedColor={selectedCanvasColor}
            onColorApplied={(elementId, color) => {
              console.log(`Applied ${color} to element ${elementId}`);
              // Could add toast notification here
            }}
          />
        </div>

        {/* Tips Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-4 rounded-lg bg-card/50 border">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold mb-2">Drag & Drop</h3>
        <p className="text-sm text-muted-foreground">
        Move elements around the canvas to experiment with layouts
        </p>
        </div>
        <div className="text-center p-4 rounded-lg bg-card/50 border">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent/10 flex items-center justify-center">
        <Palette className="h-6 w-6 text-accent" />
        </div>
        <h3 className="font-semibold mb-2">AI Color Palettes</h3>
        <p className="text-sm text-muted-foreground">
        Generate professional color palettes, then click colors to apply them to canvas elements
        </p>
        </div>
        <div className="text-center p-4 rounded-lg bg-card/50 border">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold mb-2">AI Enhancement</h3>
        <p className="text-sm text-muted-foreground">
        Get AI-powered styling tips and outfit recommendations
        </p>
        </div>
        </div>
      </main>
    </div>
  );
}

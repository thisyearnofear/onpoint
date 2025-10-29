'use client';

import React from 'react';
import { Palette, Sparkles, ArrowLeft, Shirt, Wand2 } from 'lucide-react';
import { Button } from '@repo/ui/button';
import InteractiveStylingCanvas from '@repo/shared-ui/components/InteractiveStylingCanvas';
import { useAIColorPalette, useAIStyleSuggestions, useAIVirtualTryOnEnhancement } from '@onpoint/ai-client';
import Link from 'next/link';

export default function StylePage() {
  const { palette, loading: paletteLoading, generatePalette } = useAIColorPalette();
  const { suggestions } = useAIStyleSuggestions();
  const { enhancement, loading: enhancementLoading, enhanceTryOn } = useAIVirtualTryOnEnhancement();
  
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
    
    await generatePalette('Fashion outfit with streetwear elements');
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
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              Connect Wallet
            </Button>
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
        <Button 
          onClick={handleColorPalette} 
          variant="outline" 
          className="flex items-center gap-2"
          disabled={paletteLoading}
        >
        <Palette className="h-4 w-4" />
        {paletteLoading ? 'Generating Palette...' : 'Color Palette'}
        </Button>
        <Button 
          onClick={handleAIEnhance} 
          className="fashion-gradient text-white flex items-center gap-2"
          disabled={enhancementLoading}
        >
        <Wand2 className="h-4 w-4" />
        {enhancementLoading ? 'Enhancing...' : 'AI Enhance'}
        </Button>
        </div>

        {/* AI Color Palette Display */}
        {palette && (
          <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">AI Generated Color Palette</h3>
            </div>
            
            <p className="text-muted-foreground mb-4">{palette.description}</p>
            
            <div className="flex flex-wrap gap-4">
              {palette.colors.map((color, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className="w-16 h-16 rounded-lg border border-muted-foreground/20 shadow-sm" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-muted-foreground mt-2 font-mono">{color}</span>
                </div>
              ))}
            </div>
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
        <InteractiveStylingCanvas />
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
        <h3 className="font-semibold mb-2">Color Mixing</h3>
        <p className="text-sm text-muted-foreground">
        Click on elements to change colors and see live previews
        </p>
        </div>
        <div className="text-center p-4 rounded-lg bg-card/50 border">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold mb-2">AI Suggestions</h3>
        <p className="text-sm text-muted-foreground">
        Get intelligent recommendations for color combinations and styles
        </p>
        </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import { Palette, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@repo/ui/button';
import InteractiveStylingCanvas from '@repo/shared-ui/components/InteractiveStylingCanvas';
import Link from 'next/link';

export default function StylePage() {
  const handleGenerateVariations = () => {
    alert('Generate variations - feature coming soon!');
  };

  const handleColorPalette = () => {
    alert('Color palette - feature coming soon!');
  };

  const handleAIEnhance = () => {
    alert('AI enhance - feature coming soon!');
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
        <Button onClick={handleGenerateVariations} variant="outline" className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Generate Variations
        </Button>
        <Button onClick={handleColorPalette} variant="outline" className="flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Color Palette
        </Button>
        <Button onClick={handleAIEnhance} className="fashion-gradient text-white flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        AI Enhance
        </Button>
        </div>

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

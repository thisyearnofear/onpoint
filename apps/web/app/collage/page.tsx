'use client';

import React, { useState } from 'react';
import { Palette, Sparkles, Camera, MessageCircle, Save, Share2, ArrowLeft, Plus, Upload, Heart } from 'lucide-react';
import { Button } from '@repo/ui/button';
import { critiqueOutfit, type CritiqueResponse } from '@onpoint/ai-client';
import Link from 'next/link';

export default function CollagePage() {
  const [critique, setCritique] = useState<CritiqueResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGetCritique = async () => {
    setLoading(true);
    try {
      const result = await critiqueOutfit('Current collage inspiration');
      setCritique(result);
    } catch (error) {
      console.error('Failed to get critique:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    alert('Collage saved locally!');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Share link copied to clipboard!');
  };

  const handleGenerateGarment = () => {
    alert('Generate new garment - feature coming soon! This would create a custom shirt, shorts, trousers, or jacket from your collage.');
  };

  const handleAddImage = () => {
    alert('Add image - upload or search for fashion inspiration!');
  };

  // Mock collage items
  const collageItems = [
    { id: 1, type: 'image', src: '/assets/1Product.png', alt: 'Fashion inspiration 1' },
    { id: 2, type: 'image', src: '/assets/2Product.png', alt: 'Fashion inspiration 2' },
    { id: 3, type: 'text', content: 'Urban streetwear vibes' },
    { id: 4, type: 'image', src: '/assets/3Product.png', alt: 'Fashion inspiration 3' },
  ];

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
                OnPoint Collage Creator
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
            Create Your
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {' '}Perfect Collage
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Curate your fashion inspiration. Collect images, ideas, and styles, then use AI to generate custom garments that match your vision.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <Button onClick={handleAddImage} variant="outline" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Inspiration
          </Button>
          <Button onClick={handleGenerateGarment} className="fashion-gradient text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Generate Garment
          </Button>
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save Collage
          </Button>
          <Button onClick={handleShare} variant="outline" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button
            onClick={handleGetCritique}
            disabled={loading}
            className="fashion-gradient text-white flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? 'Getting Critique...' : 'Get AI Critique'}
          </Button>
        </div>

        {/* AI Critique Display */}
        {critique && (
          <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">AI Fashion Critique</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Rating:</span>
                  <div className="flex items-center gap-1">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < critique.rating ? 'bg-accent' : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {critique.rating}/10
                  </span>
                </div>
                <p className="text-muted-foreground">{critique.feedback}</p>
              </div>

              {critique.suggestions && (
                <div>
                  <h4 className="font-medium mb-2">Suggestions:</h4>
                  <ul className="space-y-1">
                    {critique.suggestions.map((suggestion: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collage Canvas */}
        <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-h-[400px]">
            {collageItems.map((item) => (
              <div
                key={item.id}
                className="relative group border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors rounded-lg p-4 flex flex-col items-center justify-center min-h-[150px] bg-card/50"
              >
                {item.type === 'image' ? (
                  <img src={item.src} alt={item.alt} className="max-w-full max-h-full object-contain rounded" />
                ) : (
                  <p className="text-center text-muted-foreground">{item.content}</p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {/* Add new item placeholder */}
            <div className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors rounded-lg p-4 flex flex-col items-center justify-center min-h-[150px] cursor-pointer" onClick={handleAddImage}>
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center">Add Inspiration</p>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Bring Your Vision to Life?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Once your collage is complete, generate custom garments or try them on in our interactive style lab.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Button asChild className="fashion-gradient text-white px-6 py-3 h-auto min-h-[48px] text-base font-medium">
              <Link href="/style" className="flex items-center justify-center gap-3 whitespace-nowrap">
                <Camera className="h-5 w-5 flex-shrink-0" />
                <span>Try On in Style Lab</span>
              </Link>
            </Button>
            <Button variant="outline" className="px-6 py-3 h-auto min-h-[48px] text-base font-medium border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              <Sparkles className="mr-3 h-5 w-5 flex-shrink-0" />
              <span>Order Custom Piece</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

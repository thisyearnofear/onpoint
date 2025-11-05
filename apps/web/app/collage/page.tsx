'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Palette, Sparkles, Camera, MessageCircle, Save, Share2, Plus, Shirt, Search } from 'lucide-react';
import { Button } from '@repo/ui/button';
import { critiqueOutfit, generateClothingFromCollage, type CritiqueResponse, type ClothingGenerationResponse } from '@onpoint/ai-client';
import Link from 'next/link';
import { MobileNavigation } from '@/components/mobile-navigation';
// import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
// import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
// import { useSortable } from '@dnd-kit/sortable';
// import { CSS } from '@dnd-kit/utilities';
import html2canvas from 'html2canvas';

interface CollageItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
}

interface CanvasItem extends CollageItem {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

// Draggable Library Item Component
function DraggableLibraryItem({ item, onAdd }: { item: CollageItem; onAdd: (item: CollageItem) => void }) {
  return (
    <div className="relative group border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors rounded-lg p-4 flex flex-col items-center justify-center min-h-[120px]">
      <div className="relative w-full h-32">
        <Image
          src={item.imageUrl || '/assets/placeholder.png'}
          alt={item.name || 'Fashion inspiration'}
          fill
          sizes="320px"
          className="object-contain rounded"
          loading="lazy"
        />
      </div>
      <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 rounded truncate">
        {item.name}
      </div>
      <button
        onClick={() => onAdd(item)}
        className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
      >
        +
      </button>
    </div>
  );
}

export default function CollagePage() {
  const [critique, setCritique] = useState<CritiqueResponse | null>(null);
  const [clothingDesign, setClothingDesign] = useState<ClothingGenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [exportLoading, setExportLoading] = useState(false);
  const [usageCount, setUsageCount] = useState({ generations: 0, critiques: 0, suggestions: 0 });

  // Fashion library items
  const fashionLibrary = useMemo<CollageItem[]>(() => [
    {
      id: '1',
      name: 'Urban Streetwear Jacket',
      description: 'High-fashion streetwear jacket with reflective material and bold geometric patterns',
      imageUrl: '/assets/1Product.png',
      category: 'clothing'
    },
    {
      id: '2',
      name: 'Designer Sneakers',
      description: 'Limited edition sneakers with unique color blocking and premium materials',
      imageUrl: '/assets/2Product.png',
      category: 'shoes'
    },
    {
      id: '3',
      name: 'Statement Accessories',
      description: 'Bold accessories that complement the urban aesthetic with metallic finishes',
      imageUrl: '/assets/3Product.png',
      category: 'accessories'
    },
    {
      id: '4',
      name: 'Model Look 1',
      description: 'Complete styled look showcasing modern urban fashion',
      imageUrl: '/assets/1Model.png',
      category: 'looks'
    },
    {
      id: '5',
      name: 'Model Look 2',
      description: 'Sophisticated ensemble with contemporary styling',
      imageUrl: '/assets/2Model.png',
      category: 'looks'
    },
    {
      id: '6',
      name: 'Model Look 3',
      description: 'Elegant styling with attention to detail and proportion',
      imageUrl: '/assets/3Model.png',
      category: 'looks'
    }
  ], []);

  const filteredLibrary = useMemo(() => {
    return fashionLibrary.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [fashionLibrary, searchQuery, selectedCategory]);

  const categories = ['all', ...Array.from(new Set(fashionLibrary.map(item => item.category)))];

  const handleGetCritique = async () => {
    if (canvasItems.length === 0) {
      alert('Please add some items to your collage first!');
      return;
    }
    setLoading(true);
    try {
      const result = await critiqueOutfit(canvasItems);
      setCritique(result);
      setUsageCount(prev => ({ ...prev, critiques: prev.critiques + 1 }));
    } catch (error) {
      console.error('Failed to get critique:', error);
      alert('Failed to get AI critique. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGarment = async () => {
    if (canvasItems.length === 0) {
      alert('Please add some items to your collage first!');
      return;
    }
    setLoading(true);
    try {
      const result = await generateClothingFromCollage(canvasItems);
      setClothingDesign(result);
      setUsageCount(prev => ({ ...prev, generations: prev.generations + 1 }));
    } catch (error) {
      console.error('Failed to generate clothing:', error);
      alert('Failed to generate clothing design. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    alert('Collage saved locally!');
  };



  const handleAddToCanvas = (item: CollageItem) => {
    if (!canvasItems.find(ci => ci.id === item.id)) {
      const newItem: CanvasItem = {
        ...item,
        x: Math.random() * 200,
        y: Math.random() * 200,
        scale: 1,
        rotation: 0
      };
      setCanvasItems(prev => [...prev, newItem]);
      // Clear suggestions when collage changes
      setSuggestions(null);
    }
  };

  const handleExport = async () => {
    if (canvasItems.length === 0) {
      alert('Please add some items to your collage first!');
      return;
    }
    setExportLoading(true);
    try {
      const canvasElement = document.querySelector('.elegant-shadow') as HTMLElement;
      if (canvasElement) {
        const canvas = await html2canvas(canvasElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
        });
        const link = document.createElement('a');
        link.download = 'my-fashion-collage.png';
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export collage. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleShare = () => {
    const shareText = `Check out my fashion collage created with OnPoint AI! 🎨✨`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: 'My Fashion Collage',
        text: shareText,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      alert('Share link copied to clipboard! Share your creation with friends.');
    }
  };

  const handleGetSuggestions = async () => {
    if (canvasItems.length === 0) {
      alert('Please add some items to your collage first!');
      return;
    }
    setSuggestionsLoading(true);
    try {
      // Use lightweight critique for suggestions
      const result = await critiqueOutfit(canvasItems);
      // Extract key suggestions from the critique
      const keySuggestions = result ? [
        `Style Direction: ${result.styleNotes || 'Analyzing style...'}`,
        ...(result.strengths?.slice(0, 2) || []),
        ...(result.improvements?.slice(0, 2) || [])
      ] : ['Generating style suggestions...'];
      setSuggestions(keySuggestions);
      setUsageCount(prev => ({ ...prev, suggestions: prev.suggestions + 1 }));
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      alert('Failed to get style suggestions. Please try again.');
    } finally {
      setSuggestionsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 w-full border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Palette className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                OnPoint Collage Creator
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <MobileNavigation showBackButton={true} />
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground hidden md:block">
              Connect Wallet
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex gap-8">

        {/* Sidebar - Fashion Library */}
        <aside className="w-80 flex-shrink-0">
          <div className="sticky top-24">
            <h2 className="text-2xl font-bold mb-4">Fashion Library</h2>

            {/* Search and Filter */}
            <div className="mb-4 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search inspiration..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 text-xs rounded-full ${selectedCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Library Items */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {filteredLibrary.length > 0 ? (
                filteredLibrary.map(item => (
                  <DraggableLibraryItem key={item.id} item={item} onAdd={handleAddToCanvas} />
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>No items found matching your search.</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="text-primary hover:underline mt-2"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Create Your
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {' '}Perfect Collage
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Drag items from the library to build your collage, then use AI to generate custom garments and get expert feedback. Share your creations with friends!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Button
              onClick={handleGetSuggestions}
              disabled={suggestionsLoading || canvasItems.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {suggestionsLoading ? 'Getting Suggestions...' : 'Get Style Suggestions'}
            </Button>
            <Button
              onClick={handleGenerateGarment}
              disabled={loading || canvasItems.length === 0}
              className="fashion-gradient text-white flex items-center gap-2"
            >
              <Shirt className="h-4 w-4" />
              {loading ? 'Generating...' : 'Generate Garment'}
            </Button>
            <Button onClick={handleSave} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              Save Collage
            </Button>
            <Button
              onClick={handleExport}
              disabled={exportLoading || canvasItems.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Camera className="h-4 w-4" />
              {exportLoading ? 'Exporting...' : 'Export Image'}
            </Button>
            <Button onClick={handleShare} variant="outline" className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button
              onClick={handleGetCritique}
              disabled={loading || canvasItems.length === 0}
              className="fashion-gradient text-white flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? 'Getting Critique...' : 'Get AI Critique'}
            </Button>
          </div>

          {/* Subtle Upgrade Teaser */}
          {(usageCount.generations >= 3 || usageCount.critiques >= 3 || usageCount.suggestions >= 3) && (
            <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-4 mb-8 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium text-primary">Enjoying OnPoint AI?</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Try one more generation or critique for just $1.99. Unlock unlimited creativity with our premium features.
              </p>
            </div>
          )}

          {/* AI Suggestions Display */}
          {suggestions && (
            <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">AI Style Suggestions</h3>
              </div>
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <p className="text-muted-foreground">{suggestion}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Refine your collage based on these suggestions, then generate a full garment or get a detailed critique.
              </p>
            </div>
          )}

          {/* AI Clothing Design Display */}
          {clothingDesign && (
            <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shirt className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">AI Generated Clothing Design</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Design Description</h4>
                  <p className="text-muted-foreground mb-4">{clothingDesign.description}</p>

                  <h4 className="font-medium mb-2">Style Notes</h4>
                  <p className="text-muted-foreground">{clothingDesign.styleNotes}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Color Palette</h4>
                  <div className="flex gap-2 mb-4">
                    {clothingDesign.colorPalette.map((color, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <div
                          className="w-8 h-8 rounded-full border border-muted-foreground/20"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs text-muted-foreground mt-1">{color}</span>
                      </div>
                    ))}
                  </div>

                  <h4 className="font-medium mb-2">Materials</h4>
                  <div className="flex flex-wrap gap-2">
                    {clothingDesign.materials.map((material, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                      >
                        {material}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                          className={`w-2 h-2 rounded-full ${i < critique.rating ? 'bg-accent' : 'bg-muted'
                            }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {critique.rating}/10
                    </span>
                  </div>

                  <p className="text-muted-foreground">{critique.styleNotes}</p>
                </div>

                {(critique.strengths.length > 0 || critique.improvements.length > 0) && (
                  <div>
                    <h4 className="font-medium mb-2">Strengths:</h4>
                    <ul className="space-y-1 mb-4">
                      {critique.strengths.map((strength: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-600 mt-1">✓</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                    <h4 className="font-medium mb-2">Improvements:</h4>
                    <ul className="space-y-1">
                      {critique.improvements.map((improvement: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-amber-600 mt-1">•</span>
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collage Canvas */}
          <div
            className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 relative min-h-[500px] overflow-hidden"
          >
            <div className="absolute inset-0">
              {canvasItems.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Plus className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Click + on items from the library to start your collage</p>
                  </div>
                </div>
              )}
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
        </div>
      </main>
    </div>
  );
}

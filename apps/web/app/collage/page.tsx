'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Palette, Sparkles, Camera, MessageCircle, Save, Share2, Plus, Heart, Shirt, Coins } from 'lucide-react';
import { Button } from '@repo/ui/button';
import { critiqueOutfit, generateClothingFromCollage, type CritiqueResponse, type ClothingGenerationResponse } from '@onpoint/ai-client';
import { mintNFT, type MintResult } from '@onpoint/blockchain-client';
import Link from 'next/link';
import { MobileNavigation } from '@/components/mobile-navigation';

export default function CollagePage() {
  const [critique, setCritique] = useState<CritiqueResponse | null>(null);
  const [clothingDesign, setClothingDesign] = useState<ClothingGenerationResponse | null>(null);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Fashion items using our existing style lab images
  const collageItems = [
    {
      id: '1',
      name: 'Urban Streetwear Jacket',
      description: 'High-fashion streetwear jacket with reflective material and bold geometric patterns',
      imageUrl: '/assets/1Product.png',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: 'Designer Sneakers',
      description: 'Limited edition sneakers with unique color blocking and premium materials',
      imageUrl: '/assets/2Product.png',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      name: 'Statement Accessories',
      description: 'Bold accessories that complement the urban aesthetic with metallic finishes',
      imageUrl: '/assets/3Product.png',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '4',
      name: 'Model Look 1',
      description: 'Complete styled look showcasing modern urban fashion',
      imageUrl: '/assets/1Model.png',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '5',
      name: 'Model Look 2',
      description: 'Sophisticated ensemble with contemporary styling',
      imageUrl: '/assets/2Model.png',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '6',
      name: 'Model Look 3',
      description: 'Elegant styling with attention to detail and proportion',
      imageUrl: '/assets/3Model.png',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const handleGetCritique = async () => {
    setLoading(true);
    try {
      const result = await critiqueOutfit(collageItems);
      setCritique(result);
    } catch (error) {
      console.error('Failed to get critique:', error);
      alert('Failed to get AI critique. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGarment = async () => {
    setLoading(true);
    try {
      const result = await generateClothingFromCollage(collageItems);
      setClothingDesign(result);
    } catch (error) {
      console.error('Failed to generate clothing:', error);
      alert('Failed to generate clothing design. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMintNFT = async () => {
    if (!clothingDesign) {
      alert('Please generate a clothing design first.');
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, we would use actual contract config
      const contractConfig = {
        address: '0x0000000000000000000000000000000000000000' as const, // Placeholder
        abi: [] // Placeholder
      };

      const result = await mintNFT(contractConfig, JSON.stringify({
        ...clothingDesign,
        imageUrl: '/assets/1Product.png' // Placeholder
      }));

      setMintResult(result);
    } catch (error) {
      console.error('Failed to mint NFT:', error);
      alert('Failed to mint NFT. Please try again.');
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

  const handleAddImage = () => {
    alert('Add image - upload or search for fashion inspiration!');
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
          <Button
            onClick={handleGenerateGarment}
            disabled={loading}
            className="fashion-gradient text-white flex items-center gap-2"
          >
            <Shirt className="h-4 w-4" />
            {loading ? 'Generating...' : 'Generate Garment'}
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

        {/* AI Clothing Design Display */}
        {clothingDesign && (
          <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shirt className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">AI Generated Clothing Design</h3>
              <Button
                onClick={handleMintNFT}
                disabled={loading}
                className="ml-auto fashion-gradient text-white flex items-center gap-2"
                size="sm"
              >
                <Coins className="h-4 w-4" />
                {loading ? 'Minting...' : 'Mint as NFT'}
              </Button>
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

            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleMintNFT}
                disabled={loading}
                className="fashion-gradient text-white flex items-center gap-2"
              >
                <Coins className="h-4 w-4 mr-2" />
                Mint Custom Piece as NFT
              </Button>
            </div>
          </div>
        )}

        {/* NFT Minting Result */}
        {mintResult && (
          <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold">NFT Minting Result</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground mb-2">
                  <span className="font-medium">Status:</span> {mintResult.status}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Token ID:</span> {mintResult.tokenId}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground break-all">
                  <span className="font-medium">Transaction:</span> {mintResult.transactionHash}
                </p>
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
        <div className="elegant-shadow border-0 rounded-lg bg-card p-6 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 min-h-[400px]">
            {collageItems.map((item) => (
              <div
                key={item.id}
                className="relative group border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors rounded-lg p-4 flex flex-col items-center justify-center min-h-[150px] bg-card/50"
              >
                <div className="relative w-full h-full">
                  <Image
                    src={item.imageUrl || '/assets/placeholder.png'}
                    alt={item.name || 'Fashion inspiration'}
                    fill
                    className="object-contain rounded"
                    loading="lazy"
                  />
                </div>
                <div className="absolute bottom-2 left-2 right-2 bg-black/50 text-white text-xs p-1 rounded truncate">
                  {item.name}
                </div>
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

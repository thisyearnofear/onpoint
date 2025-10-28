import React from 'react';
import { Palette, Sparkles, Camera, MessageCircle } from 'lucide-react';
import { Button } from '@repo/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 w-full border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              OnPoint
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
          <Button asChild variant="ghost" className="flex items-center gap-2">
          <Link href="/collage">
          <Sparkles className="h-4 w-4" />
          Collage Creator
          </Link>
          </Button>
          <Button asChild variant="ghost" className="flex items-center gap-2">
            <Link href="/style">
              <Palette className="h-4 w-4" />
              Style Lab
            </Link>
          </Button>
           </nav>

          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 fashion-gradient opacity-5"></div>

          <div className="relative z-10 container mx-auto px-4 text-center">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Look & Feel
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {' '}OnPoint
              </span>
              </h1>

              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Design, visualize, and personalize clothing with AI. Try on your creations virtually
                and get expert styling advice—all in one beautiful platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 max-w-md mx-auto">
              <Button asChild size="lg" className="fashion-gradient text-white hover:opacity-90 elegant-shadow px-8 py-4 h-auto min-h-[56px] text-lg font-semibold">
              <Link href="/collage" className="flex items-center justify-center gap-3 whitespace-nowrap">
              <Sparkles className="h-5 w-5 flex-shrink-0" />
              <span>Create Collage</span>
              </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="soft-shadow px-8 py-4 h-auto min-h-[56px] text-lg font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              <Link href="/style" className="flex items-center justify-center gap-3 whitespace-nowrap">
              <Palette className="h-5 w-5 flex-shrink-0" />
              <span>Style Lab</span>
              </Link>
              </Button>
               </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">AI Design</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-accent/10 flex items-center justify-center">
                    <Camera className="h-6 w-6 text-accent" />
                  </div>
                  <p className="text-sm font-medium">Virtual Try-On</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">AI Stylist</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-accent/10 flex items-center justify-center">
                    <Palette className="h-6 w-6 text-accent" />
                  </div>
                  <p className="text-sm font-medium">Style Lab</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Design Studio Section */}
        <section className="py-20 bg-subtle-gradient">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Design Studio</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Describe your fashion vision and watch AI bring it to life.
                Generate multiple variations and refine your designs with intuitive controls.
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="elegant-shadow border-0 rounded-lg bg-card p-6">
                <div className="flex gap-4 mb-6">
                  <input
                    placeholder="Describe your fashion idea... (e.g., 'a high-fashion streetwear jacket with reflective material')"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                  />
                  <Button className="fashion-gradient text-white">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors rounded-lg p-4 flex flex-col items-center justify-center h-32">
                    <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center">Design Preview 1</p>
                  </div>
                  <div className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors rounded-lg p-4 flex flex-col items-center justify-center h-32">
                    <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center">Design Preview 2</p>
                  </div>
                  <div className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/30 transition-colors rounded-lg p-4 flex flex-col items-center justify-center h-32">
                    <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center">Design Preview 3</p>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Refine
                    </Button>
                    <Button variant="outline" size="sm">
                      Variations
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm">
                    Save to Lookbook
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Virtual Try-On Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Virtual Try-On</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See yourself wearing your creations. Upload a photo or use body scanning
                technology to visualize outfits with realistic lighting and proportions.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              <div className="elegant-shadow border-0 rounded-lg bg-card p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Upload Photo</h3>
                  <p className="text-muted-foreground">Use an existing photo for try-on</p>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center mb-4">
                  <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag & drop your photo here or click to browse
                  </p>
                  <Button variant="outline">Select Photo</Button>
                </div>
              </div>

              <div className="elegant-shadow border-0 rounded-lg bg-card p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Body Scan</h3>
                  <p className="text-muted-foreground">Create accurate body measurements</p>
                </div>

                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center mb-4">
                  <div className="w-24 h-32 mx-auto mb-4 bg-muted rounded-lg flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate precise body measurements for perfect fit
                  </p>
                  <Button variant="outline">Start Scan</Button>
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              <Button className="fashion-gradient text-white">
                Try On Selected Design
              </Button>
            </div>
          </div>
        </section>

        {/* AI Stylist Section */}
        <section className="py-20 bg-subtle-gradient">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">AI Stylist Agent</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Get personalized fashion advice, sourcing recommendations, and styling
                expertise from our AI-powered fashion consultants.
              </p>
            </div>

            <div className="max-w-4xl mx-auto mb-12">
              <div className="elegant-shadow border-0 rounded-lg bg-card p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-muted rounded-lg p-4 mb-4">
                      <p className="text-sm">Hello! I'm your AI stylist. How can I help you with your fashion journey today?</p>
                    </div>
                    <div className="flex gap-2">
                      <input placeholder="Ask about styling, sourcing, or fittings..." className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1" />
                      <Button className="fashion-gradient text-white">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              <div className="elegant-shadow border-0 rounded-lg bg-card hover:scale-105 transition-transform p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-600/10 flex items-center justify-center">
                  <Palette className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Luxury Expert</h3>
                <p className="text-muted-foreground text-sm">Sophisticated styling for high-end fashion</p>
                <Button variant="outline" className="mt-4">
                  Select Stylist
                </Button>
              </div>
              <div className="elegant-shadow border-0 rounded-lg bg-card hover:scale-105 transition-transform p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-600/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Streetwear Guru</h3>
                <p className="text-muted-foreground text-sm">Urban and contemporary fashion guidance</p>
                <Button variant="outline" className="mt-4">
                  Select Stylist
                </Button>
              </div>
              <div className="elegant-shadow border-0 rounded-lg bg-card hover:scale-105 transition-transform p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-600/10 flex items-center justify-center">
                  <Camera className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Sustainable Consultant</h3>
                <p className="text-muted-foreground text-sm">Eco-friendly and ethical fashion advice</p>
                <Button variant="outline" className="mt-4">
                  Select Stylist
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

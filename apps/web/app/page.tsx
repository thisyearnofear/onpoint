import React from "react";
import { Palette, Sparkles, Camera, MessageCircle, Users } from "lucide-react";
import { Button } from "@repo/ui/button";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MobileNavigation } from "@/components/mobile-navigation";
import { DesignStudio } from "../components/DesignStudio";
import { VirtualTryOn } from "../components/VirtualTryOn";
import { AIStylist } from "../components/AIStylist";
import { FarcasterSignInButton } from "../components/FarcasterSignInButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 w-full border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              BeOnPoint
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
            <Button asChild variant="ghost" className="flex items-center gap-2">
              <Link href="/social">
                <Users className="h-4 w-4" />
                Social
              </Link>
            </Button>
          </nav>

          <div className="flex items-center gap-4">
            <MobileNavigation />
            <FarcasterSignInButton />
            <ConnectButton />
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
                Look, Feel,
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {" "}
                  BeOnPoint
                </span>
              </h1>

              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Design, visualize, and personalize clothing with AI. Try on your
                creations virtually and get expert styling advice—all in one
                beautiful platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 max-w-md mx-auto">
                <Button
                  asChild
                  size="lg"
                  className="fashion-gradient text-white hover:opacity-90 elegant-shadow px-8 py-4 h-auto min-h-[56px] text-lg font-semibold"
                >
                  <Link
                    href="/collage"
                    className="flex items-center justify-center gap-3 whitespace-nowrap"
                  >
                    <Sparkles className="h-5 w-5 flex-shrink-0" />
                    <span>Create Collage</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="soft-shadow px-8 py-4 h-auto min-h-[56px] text-lg font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Link
                    href="/style"
                    className="flex items-center justify-center gap-3 whitespace-nowrap"
                  >
                    <Palette className="h-5 w-5 flex-shrink-0" />
                    <span>Style Lab</span>
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-8 max-w-3xl mx-auto">
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
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">Social Hub</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Design Studio Section */}
        <DesignStudio />

        {/* Virtual Try-On Section */}
        <VirtualTryOn />

        {/* AI Stylist Section */}
        <AIStylist />
      </main>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Menu, X, Palette, Sparkles, Users } from 'lucide-react';
import { Button } from '@repo/ui/button';
import Link from 'next/link';
import { EnhancedConnectButton } from './EnhancedConnectButton';

interface MobileNavigationProps {
  showBackButton?: boolean;
}

export function MobileNavigation({ showBackButton = false }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-card border-l flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Palette className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  BeOnPoint
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            <nav className="flex-1 flex flex-col p-4 gap-4">
              {showBackButton ? (
                <Button asChild variant="ghost" className="justify-start">
                  <Link href="/" onClick={() => setIsOpen(false)}>
                    ← Back to Home
                  </Link>
                </Button>
              ) : null}

              <Button asChild variant="ghost" className="justify-start">
                <Link href="/collage" onClick={() => setIsOpen(false)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Collage Creator
                </Link>
              </Button>

              <Button asChild variant="ghost" className="justify-start">
                <Link href="/style" onClick={() => setIsOpen(false)}>
                  <Palette className="h-4 w-4 mr-2" />
                  Style Lab
                </Link>
              </Button>

              <Button asChild variant="ghost" className="justify-start">
                <Link href="/social" onClick={() => setIsOpen(false)}>
                  <Users className="h-4 w-4 mr-2" />
                  Social
                </Link>
              </Button>
            </nav>

            <div className="p-4 border-t">
              <EnhancedConnectButton className="w-full" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
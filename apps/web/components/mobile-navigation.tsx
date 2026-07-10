'use client';

import React, { useState } from 'react';
import { Menu, X, Palette, Camera, Store, FlaskConical } from 'lucide-react';
import { Button } from '@repo/ui/button';
import Link from 'next/link';
import { CTA_LAB, CTA_SHOP, CTA_SUPPLY, PRODUCT_NAME } from '../lib/brand';

interface MobileNavigationProps {
  showBackButton?: boolean;
}

export function MobileNavigation({ showBackButton = false }: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-card border-l flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Palette className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {PRODUCT_NAME}
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
                <Link href={CTA_SHOP.href} onClick={() => setIsOpen(false)}>
                  <Camera className="h-4 w-4 mr-2" />
                  {CTA_SHOP.label}
                </Link>
              </Button>

              <Button asChild variant="ghost" className="justify-start">
                <Link href={CTA_SUPPLY.href} onClick={() => setIsOpen(false)}>
                  <Store className="h-4 w-4 mr-2" />
                  {CTA_SUPPLY.label}
                </Link>
              </Button>

              <Button asChild variant="ghost" className="justify-start">
                <Link href={`${CTA_LAB.href}?tab=try-on`} onClick={() => setIsOpen(false)}>
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Lab try-on
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

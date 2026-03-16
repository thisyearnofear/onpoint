"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, 
  Camera, 
  MessageCircle, 
  LayoutDashboard,
  Users,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@repo/ui/button';
import { CommandCenter } from './CommandCenter';
import { DesignStudio } from '../DesignStudio';
import { VirtualTryOn } from '../VirtualTryOn';
import { AIStylist } from '../AIStylist';
import { SocialFeed } from '../SocialFeed';

type AppMode = 'dashboard' | 'design' | 'try-on' | 'stylist' | 'social';

export function TacticalDashboard() {
  const [mode, setMode] = useState<AppMode>('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'HUB', icon: LayoutDashboard, color: 'text-white' },
    { id: 'design', label: 'DESIGN', icon: Palette, color: 'text-indigo-400' },
    { id: 'try-on', label: 'TRY-ON', icon: Camera, color: 'text-accent' },
    { id: 'stylist', label: 'STYLIST', icon: MessageCircle, color: 'text-primary' },
    { id: 'social', label: 'FEED', icon: Users, color: 'text-blue-400' },
  ];

  const renderContent = () => {
    switch (mode) {
      case 'dashboard':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white tracking-tighter">Command Center</h2>
              <p className="text-white/40 text-sm max-w-sm leading-relaxed">
                Welcome back, Agent. Your fashion intelligence network is active.
              </p>
            </div>
            
            <CommandCenter />

            <div className="grid grid-cols-1 gap-4">
               <DashboardActionCard 
                 title="Launch Live AR Stylist"
                 description="Real-time multimodal session with Gemini Pro Vision."
                 icon={<Camera className="w-6 h-6 text-accent" />}
                 onClick={() => setMode('try-on')}
                 buttonText="Start Session"
                 tag="Hot"
               />
               <DashboardActionCard 
                 title="AI Design Studio"
                 description="Generate unique patterns and styles on-chain."
                 icon={<Palette className="w-6 h-6 text-indigo-400" />}
                 onClick={() => setMode('design')}
                 buttonText="Open Studio"
               />
            </div>
          </motion.div>
        );
      case 'design':
        return <DesignStudio />;
      case 'try-on':
        return <VirtualTryOn />;
      case 'stylist':
        return <AIStylist />;
      case 'social':
        return <SocialFeed />;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-black">
      {/* Dynamic Header/Mode Switcher */}
      <div className="sticky top-16 z-40 bg-black/80 backdrop-blur-md border-b border-white/5 px-2 md:px-0">
        <div className="container mx-auto">
          <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-3 gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id as AppMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap ${
                  mode === item.id 
                    ? 'bg-white/10 text-white ring-1 ring-white/20' 
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                <item.icon className={`w-4 h-4 ${mode === item.id ? item.color : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
    </div>
  );
}

function DashboardActionCard({ title, description, icon, onClick, buttonText, tag }: any) {
  return (
    <div 
      onClick={onClick}
      className="group relative p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-pointer overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon}
      </div>
      
      {tag && (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/20 border border-accent/30 text-accent text-[8px] font-black uppercase tracking-widest mb-4">
          <Sparkles className="w-2.5 h-2.5" />
          {tag}
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-white/5 ring-1 ring-white/5 group-hover:ring-white/10 transition-all">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white tracking-tight mb-1 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-white/40 text-xs leading-relaxed max-w-xs">{description}</p>
        </div>
        <div className="self-center">
          <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-all transform group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
}

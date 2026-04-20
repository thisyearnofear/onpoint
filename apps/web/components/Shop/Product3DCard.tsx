"use client";

import React, { useRef, useState } from "react";

/**
 * Product card with CSS 3D perspective tilt on hover.
 * Achieves the "interactive product" feel without WebGL overhead or type conflicts.
 */

interface Product3DCardProps {
  imageUrl: string;
  name: string;
  price: number;
  badge?: string;
  reason?: string;
  onClick?: () => void;
}

export function Product3DCard({ imageUrl, name, price, badge, reason, onClick }: Product3DCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -12, y: x * 12 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <button
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative rounded-xl overflow-hidden border border-primary/20 bg-card hover:border-primary/40 transition-colors text-left w-full"
      style={{
        perspective: "600px",
      }}
    >
      {badge && (
        <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-full bg-primary/90 text-white text-[8px] font-bold shadow-lg">
          {badge}
        </div>
      )}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.02 : 1})`,
          transformStyle: "preserve-3d",
        }}
      >
        <div className="aspect-[4/5] bg-muted overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className={`w-full h-full object-cover transition-all duration-300 ${isHovered ? "brightness-110" : ""}`}
          />
          {/* Shine effect on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: `radial-gradient(circle at ${(tilt.y / 12 + 0.5) * 100}% ${(tilt.x / -12 + 0.5) * 100}%, rgba(255,255,255,0.15), transparent 60%)`,
            }}
          />
        </div>
        <div className="p-2 space-y-0.5">
          <p className="text-xs font-medium truncate">{name}</p>
          {reason && (
            <p className="text-[10px] text-muted-foreground line-clamp-1 leading-tight">
              💡 {reason}
            </p>
          )}
          <span className="text-xs font-bold text-primary">${price}</span>
        </div>
      </div>
    </button>
  );
}

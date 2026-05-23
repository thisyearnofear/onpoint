'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface ShirtData {
  id: string;
  productSrc: string;
  modelSrc: string;
  shirtName: string;
  modelSize: string;
  position: { top: string; left: string };
}

interface ShirtState {
  top: string;
  left: string;
  isGrabbed: boolean;
  isDraggingRight: boolean;
  isDraggingLeft: boolean;
}

interface InteractiveStylingCanvasProps {
  selectedColor?: string;
  onColorApplied?: (elementId: string, color: string) => void;
}

const getHueRotation = (hexColor: string): string => {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return '0deg';
  const d = max - min;
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return `${Math.round(h * 360)}deg`;
};

const STORAGE_KEY = 'onpoint-collage';

const shirtsData: ShirtData[] = [
  { id: '1', productSrc: '/assets/1Product.png', modelSrc: '/assets/1Model.png', shirtName: 'Ratphex-T', modelSize: 'L', position: { top: '20%', left: '15%' } },
  { id: '2', productSrc: '/assets/2Product.png', modelSrc: '/assets/2Model.png', shirtName: 'RatwardScissor-T', modelSize: 'XL', position: { top: '45%', left: '80%' } },
  { id: '3', productSrc: '/assets/3Product.png', modelSrc: '/assets/3Model.png', shirtName: 'AnimalCollective-T', modelSize: 'S', position: { top: '70%', left: '15%' } },
];

const defaultShirtStates: Record<string, ShirtState> = {
  '1': { top: '20%', left: '15%', isGrabbed: false, isDraggingRight: false, isDraggingLeft: false },
  '2': { top: '45%', left: '80%', isGrabbed: false, isDraggingRight: false, isDraggingLeft: false },
  '3': { top: '70%', left: '15%', isGrabbed: false, isDraggingRight: false, isDraggingLeft: false },
};

function updateState(
  prev: Record<string, ShirtState>,
  id: string,
  patch: Partial<ShirtState>,
): Record<string, ShirtState> {
  return { ...prev, [id]: { ...prev[id]!, ...patch } };
}

function InteractiveStylingCanvas({ selectedColor, onColorApplied }: InteractiveStylingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLImageElement>(null);
  const [centerImageSrc, setCenterImageSrc] = useState('/assets/1Model.png');
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [elementColors, setElementColors] = useState<Record<string, string>>({});
  const [shirtStates, setShirtStates] = useState<Record<string, ShirtState>>(defaultShirtStates);

  // Stable refs for drag state to avoid useEffect feedback loops
  const isDraggingRef = useRef(false);
  const activeShirtRef = useRef<HTMLElement | null>(null);
  const isMovingRef = useRef(false);
  const isHoveringCenterRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const currentPositionRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ left: '', top: '' });
  const originalCenterSrcRef = useRef('');
  // Mirror state into refs so stable event handlers always read latest values
  const shirtStatesRef = useRef(shirtStates);
  shirtStatesRef.current = shirtStates;
  const centerImageSrcRef = useRef(centerImageSrc);
  centerImageSrcRef.current = centerImageSrc;

  // Load persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { centerImageSrc: savedSrc, shirtStates: savedStates } = JSON.parse(saved);
        if (savedSrc) setCenterImageSrc(savedSrc);
        if (savedStates) setShirtStates(savedStates);
      }
    } catch { /* ignore corrupt data */ }
  }, []);

  // Persist state on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ centerImageSrc, shirtStates }));
    } catch { /* ignore quota errors */ }
  }, [centerImageSrc, shirtStates]);

  // Preload images
  useEffect(() => {
    const paths = shirtsData.flatMap(s => [s.productSrc, s.modelSrc, s.modelSrc.replace('Model.png', 'ModelHover.png')]);
    let loaded = 0;
    for (const src of paths) {
      const img = new Image();
      img.onload = img.onerror = () => { loaded++; };
      img.src = src;
    }
  }, []);

  const handleColorClick = useCallback((shirtId: string) => {
    if (selectedColor && !isDraggingRef.current) {
      setElementColors(prev => ({ ...prev, [shirtId]: selectedColor }));
      onColorApplied?.(shirtId, selectedColor);
    }
  }, [selectedColor, onColorApplied]);

  // Stable drag logic — all mutable state uses refs to avoid re-creating listeners
  useEffect(() => {
    const container = containerRef.current;
    const centerImg = centerRef.current;
    if (!container || !centerImg) return;

    let moveTimer: ReturnType<typeof setTimeout>;

    const getShirtId = (el: HTMLElement) => el.dataset.shirtId;

    const handleStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      const shirtId = getShirtId(target);
      if (!shirtId) return;

      activeShirtRef.current = target;
      const state = shirtStatesRef.current[shirtId]!;
      initialPosRef.current = { left: state.left, top: state.top };
      originalCenterSrcRef.current = centerImageSrcRef.current;
      isHoveringCenterRef.current = false;

      const rect = target.getBoundingClientRect();
      currentPositionRef.current = { x: rect.left, y: rect.top };

      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return;
        lastPositionRef.current = { x: touch.clientX, y: touch.clientY };
      } else {
        lastPositionRef.current = { x: e.clientX, y: e.clientY };
      }

      target.style.cursor = 'grabbing';
      target.style.zIndex = '1000';
      setShirtStates(prev => updateState(prev, shirtId, { isGrabbed: true, isDraggingRight: false, isDraggingLeft: false }));
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const active = activeShirtRef.current;
      if (!active) return;
      e.preventDefault();

      let clientX: number, clientY: number;
      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return;
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const last = lastPositionRef.current;
      const dx = clientX - last.x;
      const dy = clientY - last.y;
      const pos = currentPositionRef.current;
      pos.x += dx;
      pos.y += dy;
      active.style.left = `${pos.x}px`;
      active.style.top = `${pos.y}px`;

      const shirtRect = active.getBoundingClientRect();
      const shirtCenterX = shirtRect.left + shirtRect.width / 2;
      const shirtCenterY = shirtRect.top + shirtRect.height / 2;
      const centerRect = centerImg.getBoundingClientRect();
      const centerCenterX = centerRect.left + centerRect.width / 2;
      const centerCenterY = centerRect.top + centerRect.height / 2;

      const collides = Math.abs(shirtCenterX - centerCenterX) < centerRect.width * 0.4 &&
        Math.abs(shirtCenterY - centerCenterY) < centerRect.height * 0.4;

      if (collides && !isHoveringCenterRef.current) {
        setCenterImageSrc(originalCenterSrcRef.current.replace('Model.png', 'ModelHover.png'));
        isHoveringCenterRef.current = true;
      } else if (!collides && isHoveringCenterRef.current) {
        setCenterImageSrc(originalCenterSrcRef.current);
        isHoveringCenterRef.current = false;
      }

      const shirtId = getShirtId(active);
      if (!shirtId) return;

      const isMovingNow = Math.abs(dx) > 2 || Math.abs(dy) > 2;
      if (isMovingNow && !isMovingRef.current) {
        isDraggingRef.current = true;
        setShirtStates(prev => updateState(prev, shirtId, { isGrabbed: false, isDraggingRight: dx > 0, isDraggingLeft: dx < 0 }));
        isMovingRef.current = true;
      } else if (isMovingRef.current && dx !== 0) {
        setShirtStates(prev => updateState(prev, shirtId, { isDraggingRight: dx > 0, isDraggingLeft: dx < 0 }));
      }

      lastPositionRef.current = { x: clientX, y: clientY };

      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        if (isMovingRef.current) {
          setShirtStates(prev => updateState(prev, shirtId, { isGrabbed: true, isDraggingRight: false, isDraggingLeft: false }));
          isMovingRef.current = false;
        }
      }, 50);
    };

    const handleEnd = () => {
      const active = activeShirtRef.current;
      if (!active) return;
      const shirtId = getShirtId(active);
      if (!shirtId) return;

      const shirtRect = active.getBoundingClientRect();
      const shirtCenterX = shirtRect.left + shirtRect.width / 2;
      const shirtCenterY = shirtRect.top + shirtRect.height / 2;
      const centerRect = centerImg.getBoundingClientRect();
      const centerCenterX = centerRect.left + centerRect.width / 2;
      const centerCenterY = centerRect.top + centerRect.height / 2;

      const collides = Math.abs(shirtCenterX - centerCenterX) < centerRect.width * 0.4 &&
        Math.abs(shirtCenterY - centerCenterY) < centerRect.height * 0.4;

      if (collides) {
        const shirt = shirtsData.find(s => s.id === shirtId);
        if (shirt) {
          setCenterImageSrc(shirt.modelSrc);
        }
        resetPosition(active);
      } else {
        resetPosition(active);
        if (isHoveringCenterRef.current) {
          setCenterImageSrc(originalCenterSrcRef.current);
        }
      }

      active.style.cursor = 'grab';
      active.style.zIndex = '';
      setShirtStates(prev => updateState(prev, shirtId, { isGrabbed: false, isDraggingRight: false, isDraggingLeft: false }));

      clearTimeout(moveTimer);
      setTimeout(() => { isDraggingRef.current = false; }, 100);
      isHoveringCenterRef.current = false;
      activeShirtRef.current = null;
    };

    const resetPosition = (el: HTMLElement) => {
      el.style.left = initialPosRef.current.left;
      el.style.top = initialPosRef.current.top;
    };

    const shirts = shirtsData.map(s => document.getElementById(`shirt-${s.id}`)).filter(Boolean) as HTMLElement[];
    for (const el of shirts) {
      el.addEventListener('mousedown', handleStart);
      el.addEventListener('touchstart', handleStart, { passive: false });
    }
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      for (const el of shirts) {
        el.removeEventListener('mousedown', handleStart);
        el.removeEventListener('touchstart', handleStart);
      }
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
      clearTimeout(moveTimer);
    };
  }, []); // stable: all mutable state read via refs

  // Close tooltip on outside click
  useEffect(() => {
    if (!tooltipVisible) return;
    const handler = (e: MouseEvent) => {
      const btn = document.getElementById('info-tooltip');
      if (btn && !btn.contains(e.target as Node)) {
        setTooltipVisible(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [tooltipVisible]);

  return (
    <div className="relative w-full h-screen flex flex-col items-center p-5 max-w-none">
      <div ref={containerRef} className="relative w-full h-full flex justify-center items-center">
        {shirtsData.map(shirt => {
          const state = shirtStates[shirt.id]!;
          const color = elementColors[shirt.id];
          const canApply = !!selectedColor && !state.isGrabbed;
          return (
            <img
              key={shirt.id}
              id={`shirt-${shirt.id}`}
              data-shirt-id={shirt.id}
              src={shirt.productSrc}
              alt={shirt.shirtName}
              onClick={canApply ? () => handleColorClick(shirt.id) : undefined}
              title={canApply ? `Click to apply ${selectedColor}` : undefined}
              className={`
                absolute max-w-[9.8%] h-auto cursor-grab z-20 select-none
                md:max-w-[9.8%]
                max-md:max-w-[21%]
                transition-transform duration-200 ease-out
                ${state.isGrabbed ? 'scale-105 drop-shadow-[0_5px_10px_rgba(0,0,0,0.15)] z-[1000]' : ''}
                ${state.isDraggingRight ? '[transform:perspective(500px)_rotateY(-15deg)_rotateX(5deg)_scale(0.92,0.98)_skew(-5deg,2deg)] drop-shadow-[5px_5px_15px_rgba(0,0,0,0.2)] z-[1000]' : ''}
                ${state.isDraggingLeft ? '[transform:perspective(500px)_rotateY(15deg)_rotateX(5deg)_scale(0.92,0.98)_skew(5deg,-2deg)] drop-shadow-[-5px_5px_15px_rgba(0,0,0,0.2)] z-[1000]' : ''}
                ${canApply ? 'cursor-pointer hover:scale-105' : ''}
              `}
              style={{
                top: state.top,
                left: state.left,
                filter: color ? `hue-rotate(${getHueRotation(color)}) saturate(3) brightness(1.2)` : undefined,
                transition: 'filter 0.3s ease-in-out, transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
              }}
              draggable={false}
            />
          );
        })}
        <img
          ref={centerRef}
          id="centerImage"
          src={centerImageSrc}
          alt="Model wearing Product"
          className="absolute max-w-[35%] h-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-100 pointer-events-none select-none transition-opacity duration-300 ease-in-out max-md:max-w-[80%] max-md:top-[45%]"
          draggable={false}
        />
        <button
          id="info-tooltip"
          onClick={() => setTooltipVisible(v => !v)}
          className={`
            absolute top-[25%] left-[55%] -translate-x-1/2 -translate-y-1/2
            w-[18px] h-[18px] rounded-full
            border border-foreground/60 text-foreground/60
            flex items-center justify-center text-[11px] font-bold
            cursor-help z-[15] font-sans
            hover:border-foreground hover:text-foreground
            transition-colors duration-200
            max-md:top-[25%] max-md:left-[65%]
          `}
        >
          ?
          <span
            data-tooltip-visible={tooltipVisible}
            className={`
              absolute bottom-full left-1/2 -translate-x-1/2 mb-1
              whitespace-nowrap bg-black/80 text-white
              px-2.5 py-1 rounded text-xs font-mono
              pointer-events-none z-20
              transition-opacity duration-300
              ${tooltipVisible ? 'opacity-100 visible' : 'opacity-0 invisible'}
            `}
          >
            Model is 5ft 4" and wears size S
          </span>
        </button>
      </div>
    </div>
  );
}

export default InteractiveStylingCanvas;

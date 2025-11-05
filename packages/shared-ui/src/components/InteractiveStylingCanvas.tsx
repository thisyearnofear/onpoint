'use client';

import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

// Styled components for the CSS
const Container = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: none;
  background-size: 15px 15px;
  padding: 20px;
`;

const ShirtsContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const CenterImage = styled.img`
  position: absolute;
  max-width: 25%;
  height: auto;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  opacity: 1;
  transition: opacity 0.3s ease-in-out;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-drag: none;
`;

const Shirt = styled.img.withConfig({
  shouldForwardProp: (prop) => !['isGrabbed', 'isDraggingRight', 'isDraggingLeft'].includes(prop),
})<{ isGrabbed?: boolean; isDraggingRight?: boolean; isDraggingLeft?: boolean }>`
  position: absolute;
  max-width: 9.8%;
  height: auto;
  transition: transform 0.2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  transform-origin: center center;
  will-change: transform;
  cursor: grab;

  ${({ isGrabbed }) => isGrabbed && `
    transform: scale(1.05);
    filter: drop-shadow(0 5px 10px rgba(0,0,0,0.15));
  `}

  ${({ isDraggingRight }) => isDraggingRight && `
    transform: perspective(500px) rotateY(-15deg) rotateX(5deg) scale(0.92, 0.98) skew(-5deg, 2deg);
    filter: drop-shadow(5px 5px 15px rgba(0,0,0,0.2));
  `}

  ${({ isDraggingLeft }) => isDraggingLeft && `
    transform: perspective(500px) rotateY(15deg) rotateX(5deg) scale(0.92, 0.98) skew(5deg, -2deg);
    filter: drop-shadow(-5px 5px 15px rgba(0,0,0,0.2));
  `}
`;

const InfoTooltip = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'tooltipVisible',
})<{ tooltipVisible?: boolean }>`
  position: absolute;
  top: 25%;
  left: 55%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  color: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 11px;
  font-weight: bold;
  cursor: help;
  z-index: 15;
  transition: border-color 0.2s ease, color 0.2s ease;
  font-family: sans-serif;

  &:hover {
    color: rgba(0, 0, 0, 0.9);
    border-color: rgba(0, 0, 0, 0.9);
  }

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 120%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-family: "Source Code Pro", monospace;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.3s ease, visibility 0.3s ease;
    z-index: 20;
  }

  ${({ tooltipVisible }) => tooltipVisible && `
    &::after {
      opacity: 1;
      visibility: visible;
    }
  `}
`;

// Responsive styles
const ResponsiveContainer = styled(Container)`
  @media (max-width: 767px) {
    padding-top: 120px;
    padding-bottom: 5vh;
  }
`;

const ResponsiveShirt = styled(Shirt)`
  @media (max-width: 767px) {
    max-width: 21%;
    transition: transform 0.2s ease-out;
  }
`;

const ResponsiveCenterImage = styled(CenterImage)`
  @media (max-width: 767px) {
    max-width: 80%;
    top: 45%;
    left: 50%;
  }
`;

const ResponsiveInfoTooltip = styled(InfoTooltip)`
  @media (max-width: 767px) {
    top: 25%;
    left: 65%;
  }

  @media (max-width: 429px) {
    top: 25%;
    left: 65%;
  }
`;

interface ShirtData {
  id: string;
  productSrc: string;
  modelSrc: string;
  shirtName: string;
  modelSize: string;
  position: { top: string; left: string };
}

interface InteractiveStylingCanvasProps {
  selectedColor?: string;
  onColorApplied?: (elementId: string, color: string) => void;
}

// Helper function to convert hex color to hue rotation for CSS filter
const getHueRotation = (hexColor: string): string => {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Convert RGB to HSL to get hue
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max === min) {
    h = 0; // achromatic
  } else {
    const d = max - min;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)}deg`;
};

const InteractiveStylingCanvas: React.FC<InteractiveStylingCanvasProps> = ({
  selectedColor,
  onColorApplied
}) => {
  const shirtsContainerRef = useRef<HTMLDivElement>(null);
  const centerImageRef = useRef<HTMLImageElement>(null);
  const infoTooltipRef = useRef<HTMLSpanElement>(null);

  // State for element colors
  const [elementColors, setElementColors] = useState<Record<string, string>>({});

  // Track drag state to prevent click when dragging
  const isDraggingRef = useRef(false);

  // Handle color application to elements
  const handleElementClick = (shirtId: string) => {
    if (selectedColor && !isDraggingRef.current) {
      setElementColors(prev => ({
        ...prev,
        [shirtId]: selectedColor
    }));
      onColorApplied?.(shirtId, selectedColor);
  }
  };

  const [centerImageSrc, setCenterImageSrc] = useState('/assets/1Model.png');
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [shirtStates, setShirtStates] = useState<any>({
    '1': { isGrabbed: false, isDraggingRight: false, isDraggingLeft: false, left: '15%', top: '20%' },
    '2': { isGrabbed: false, isDraggingRight: false, isDraggingLeft: false, left: '80%', top: '45%' },
    '3': { isGrabbed: false, isDraggingRight: false, isDraggingLeft: false, left: '15%', top: '70%' },
  });

  const shirtsData: ShirtData[] = [
    { id: '1', productSrc: '/assets/1Product.png', modelSrc: '/assets/1Model.png', shirtName: 'Ratphex-T', modelSize: 'L', position: { top: '20%', left: '15%' } },
    { id: '2', productSrc: '/assets/2Product.png', modelSrc: '/assets/2Model.png', shirtName: 'RatwardScissor-T', modelSize: 'XL', position: { top: '45%', left: '80%' } },
    { id: '3', productSrc: '/assets/3Product.png', modelSrc: '/assets/3Model.png', shirtName: 'AnimalCollective-T', modelSize: 'S', position: { top: '70%', left: '15%' } },
  ];

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('onpoint-collage');
      if (saved) {
        const { centerImageSrc: savedSrc, shirtStates: savedStates } = JSON.parse(saved);
        setCenterImageSrc(savedSrc || '/assets/1Model.png');
        setShirtStates(savedStates || {
          '1': { isGrabbed: false, isDraggingRight: false, isDraggingLeft: false, left: '15%', top: '20%' },
          '2': { isGrabbed: false, isDraggingRight: false, isDraggingLeft: false, left: '80%', top: '45%' },
          '3': { isGrabbed: false, isDraggingRight: false, isDraggingLeft: false, left: '15%', top: '70%' },
        });
      }
    }
  }, []);

  // Persistence: Save to localStorage on changes
  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = { centerImageSrc, shirtStates };
      localStorage.setItem('onpoint-collage', JSON.stringify(data));
    }
  }, [centerImageSrc, shirtStates]);

  useEffect(() => {
    const preloadImages = (imageArray: string[], callback: () => void) => {
      let loadedCount = 0;
      const totalImages = imageArray.length;
      if (totalImages === 0) {
        callback();
        return;
      }
      imageArray.forEach((path) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          if (loadedCount === totalImages) callback();
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount === totalImages) callback();
        };
        img.src = path;
      });
    };

    const imagePaths = shirtsData.flatMap(shirt => [shirt.productSrc, shirt.modelSrc, shirt.modelSrc.replace('Model.png', 'ModelHover.png')]);
    preloadImages(imagePaths, () => {
      // Remove loading if any
    });

    // Drag and drop logic adapted to React
    let activeShirt: HTMLElement | null = null;
    let initialShirtPos = { left: '', top: '' };
    let initialTouchPos = { x: 0, y: 0 };
    let currentPos = { x: 0, y: 0 };
    let lastX = 0;
    let lastY = 0;
    let isMoving = false;
    let moveTimeout: NodeJS.Timeout;
    let originalCenterImageSrc = centerImageSrc;
    let isHoveringCenterImage = false;

    const handleStart = (e: MouseEvent | TouchEvent, shirtId: string | number) => {
      e.preventDefault();
      // Only run in browser environment
      if (typeof window === 'undefined' || !window.document) return;
      isDraggingRef.current = true;
      activeShirt = document.getElementById(`shirt-${shirtId}`);
      if (!activeShirt || !centerImageRef.current) return;

      const shirtState = shirtStates[shirtId as keyof typeof shirtStates];
      initialShirtPos.left = shirtState.left;
      initialShirtPos.top = shirtState.top;

      originalCenterImageSrc = centerImageSrc;
      isHoveringCenterImage = false;

      // Only run in browser environment
      if (typeof window === 'undefined' || !window.getComputedStyle) return;
      const computedStyle = window.getComputedStyle(activeShirt);
      currentPos.x = parseInt(computedStyle.left) || 0;
      currentPos.y = parseInt(computedStyle.top) || 0;

      if (e.type === 'mousedown') {
        const mouseE = e as MouseEvent;
        lastX = mouseE.clientX;
        lastY = mouseE.clientY;
        initialTouchPos.x = mouseE.clientX;
        initialTouchPos.y = mouseE.clientY;
        // Only run in browser environment
        if (typeof window !== 'undefined' && window.document) {
          document.addEventListener('mousemove', handleMove);
          document.addEventListener('mouseup', handleEnd);
        }
      } else if (e.type === 'touchstart') {
        const touchE = e as TouchEvent;
        const touch = touchE.touches[0];
        if (touch) {
          lastX = touch.clientX;
          lastY = touch.clientY;
          initialTouchPos.x = touch.clientX;
          initialTouchPos.y = touch.clientY;
        }
        // Only run in browser environment
        if (typeof window !== 'undefined' && window.document) {
          document.addEventListener('touchmove', handleMove, { passive: false });
          document.addEventListener('touchend', handleEnd);
          document.addEventListener('touchcancel', handleEnd);
        }
      }

      activeShirt.style.cursor = 'grabbing';
      activeShirt.style.zIndex = '1000';
      setShirtStates((prev: any) => ({ ...prev, [shirtId]: { ...prev[shirtId], isGrabbed: true, isDraggingRight: false, isDraggingLeft: false } }));
      };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!activeShirt || !centerImageRef.current) return;
      e.preventDefault();

      const shirtIdMoving = activeShirt.id.split('-')[1];

      let clientX = 0, clientY = 0;
      if (e.type === 'mousemove') {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      } else {
        const touch = (e as TouchEvent).touches[0];
        if (touch) {
          clientX = touch.clientX;
          clientY = touch.clientY;
        }
      }

      const deltaX = clientX - lastX;
      const deltaY = clientY - lastY;
      currentPos.x += deltaX;
      currentPos.y += deltaY;
      activeShirt.style.left = `${currentPos.x}px`;
      activeShirt.style.top = `${currentPos.y}px`;

      const shirtRect = activeShirt.getBoundingClientRect();
      const centerImageRect = centerImageRef.current.getBoundingClientRect();
      const collision = 
        shirtRect.right >= centerImageRect.left &&
        shirtRect.left <= centerImageRect.right &&
        shirtRect.bottom >= centerImageRect.top &&
        shirtRect.top <= centerImageRect.bottom;

      if (collision && !isHoveringCenterImage) {
        const hoverSrc = originalCenterImageSrc.replace('Model.png', 'ModelHover.png');
        setCenterImageSrc(hoverSrc);
        isHoveringCenterImage = true;
      } else if (!collision && isHoveringCenterImage) {
        setCenterImageSrc(originalCenterImageSrc);
        isHoveringCenterImage = false;
      }
      const isMovingNow = Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2;
      if (isMovingNow && !isMoving) {
        setShirtStates((prev: any) => ({ ...prev, [shirtIdMoving as string]: { ...prev[shirtIdMoving as string], isGrabbed: false, isDraggingRight: deltaX > 0, isDraggingLeft: deltaX < 0 } }));
        isMoving = true;
      } else if (isMoving && deltaX !== 0) {
        setShirtStates((prev: any) => ({ ...prev, [shirtIdMoving as string]: { ...prev[shirtIdMoving as string], isDraggingRight: deltaX > 0, isDraggingLeft: deltaX < 0 } }));
      }

      lastX = clientX;
      lastY = clientY;

      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        if (isMoving) {
          setShirtStates((prev: any) => ({ ...prev, [shirtIdMoving as string]: { ...prev[shirtIdMoving as string], isGrabbed: true, isDraggingRight: false, isDraggingLeft: false } }));
          isMoving = false;
        }
      }, 50);
      };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!activeShirt || !centerImageRef.current) return;

      const shirtRect = activeShirt.getBoundingClientRect();
      const centerImageRect = centerImageRef.current.getBoundingClientRect();
      const shirtCenterX = shirtRect.left + shirtRect.width / 2;
      const shirtCenterY = shirtRect.top + shirtRect.height / 2;

      const collision = 
        shirtCenterX >= centerImageRect.left &&
        shirtCenterX <= centerImageRect.right &&
        shirtCenterY >= centerImageRect.top &&
        shirtCenterY <= centerImageRect.bottom;

      if (collision) {
        const shirtId = activeShirt.id.split('-')[1];
        const shirt = shirtsData.find(s => s.id === shirtId);
        if (shirt) {
          setCenterImageSrc(shirt.modelSrc);
          originalCenterImageSrc = shirt.modelSrc;
        }
        activeShirt.style.left = initialShirtPos.left;
        activeShirt.style.top = initialShirtPos.top;
        currentPos.x = parseInt(initialShirtPos.left) || 0;
      } else {
        activeShirt.style.left = initialShirtPos.left;
        activeShirt.style.top = initialShirtPos.top;
        currentPos.x = parseInt(initialShirtPos.left) || 0;
        currentPos.y = parseInt(initialShirtPos.top) || 0;
        if (isHoveringCenterImage) {
          setCenterImageSrc(originalCenterImageSrc);
        }
      }

      activeShirt.style.cursor = 'grab';
      activeShirt.style.zIndex = '';
      const shirtIdEnd = activeShirt!.id.split('-')[1];
      setShirtStates((prev: any) => ({ ...prev, [shirtIdEnd as string]: { ...prev[shirtIdEnd as string], isGrabbed: false, isDraggingRight: false, isDraggingLeft: false } }));

      if (moveTimeout) clearTimeout(moveTimeout);
      // Reset drag state after a short delay to allow click events
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
      // Only run in browser environment
      if (typeof window !== 'undefined' && window.document) {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('touchcancel', handleEnd);
      }
      isHoveringCenterImage = false;
      activeShirt = null;
      };

          shirtsData.forEach(shirt => {
            // Only run in browser environment
            if (typeof window !== 'undefined' && window.document) {
              const shirtEl = document.getElementById(`shirt-${shirt.id}`);
              if (shirtEl) {
                const startHandler = (e: MouseEvent | TouchEvent) => handleStart(e, shirt.id);
                shirtEl.addEventListener('mousedown', startHandler);
                shirtEl.addEventListener('touchstart', startHandler, { passive: false });
              }
            }
          });
    const handleResize = () => {
      // Only run in browser environment
      if (typeof window !== 'undefined' && window.document) {
        document.querySelectorAll('.shirt').forEach((shirt) => {
          (shirt as HTMLElement).style.left = '';
          (shirt as HTMLElement).style.top = '';
        });
      }
      setShirtStates((prev: any) => {
        const newStates = { ...prev };
        Object.keys(newStates).forEach(key => {
          const shirtData = shirtsData.find(s => s.id === key);
          if (shirtData) {
            newStates[key].left = shirtData.position.left;
            newStates[key].top = shirtData.position.top;
          }
        });
        return newStates;
        });
        };

    // Only run in browser environment
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      // Only run in browser environment
      if (typeof window !== 'undefined' && window.document) {
        shirtsData.forEach(shirt => {
          const shirtEl = document.getElementById(`shirt-${shirt.id}`);
          if (shirtEl) {
            shirtEl.removeEventListener('mousedown', (e) => handleStart(e, shirt.id));
            shirtEl.removeEventListener('touchstart', (e) => handleStart(e, shirt.id));
          }
        });
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      }
    };
  }, []);

  const handleTooltipClick = () => {
    setTooltipVisible(!tooltipVisible);
  };

  const handleDocumentClick = (e: MouseEvent) => {
    if (infoTooltipRef.current && !infoTooltipRef.current.contains(e.target as Node) && tooltipVisible) {
      setTooltipVisible(false);
    }
  };

  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined' && window.document) {
      document.addEventListener('click', handleDocumentClick);
      return () => document.removeEventListener('click', handleDocumentClick);
    }
  }, [tooltipVisible]);

  return (
    <ResponsiveContainer>
      <ShirtsContainer ref={shirtsContainerRef}>
        {shirtsData.map(shirt => {
        const state = shirtStates[shirt.id];
        const appliedColor = elementColors[shirt.id];
        const canApplyColor = selectedColor && !state?.isGrabbed;
        return (
        <ResponsiveShirt
        key={shirt.id}
        id={`shirt-${shirt.id}`}
        src={shirt.productSrc}
        alt={shirt.shirtName}
          data-mouse-src={shirt.modelSrc}
        data-shirt-name={shirt.shirtName}
        data-model-size={shirt.modelSize}
        className={`shirt transition-all duration-200 ${canApplyColor ? 'cursor-pointer hover:scale-105' : ''}`}
        isGrabbed={state?.isGrabbed}
        isDraggingRight={state?.isDraggingRight}
        isDraggingLeft={state?.isDraggingLeft}
        style={{
        top: state?.top,
        left: state?.left,
        filter: appliedColor ? `sepia(1) hue-rotate(${getHueRotation(appliedColor)}) saturate(2)` : undefined
        }}
        onClick={canApplyColor ? () => handleElementClick(shirt.id) : undefined}
        title={canApplyColor ? `Click to apply ${selectedColor}` : undefined}
        />
        );
        })}
        <ResponsiveCenterImage ref={centerImageRef} id="centerImage" src={centerImageSrc} alt="Model wearing Product" />
        <ResponsiveInfoTooltip
          ref={infoTooltipRef}
          id="info-tooltip"
          data-tooltip='Model is 5ft 4" and wears size S'
          tooltipVisible={tooltipVisible}
          onClick={handleTooltipClick}
        >
          ?
        </ResponsiveInfoTooltip>
      </ShirtsContainer>
    </ResponsiveContainer>
  );
};

export default InteractiveStylingCanvas;

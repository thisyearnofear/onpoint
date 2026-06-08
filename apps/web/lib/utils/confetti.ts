/**
 * Lightweight canvas confetti — no dependencies.
 * Fires a celebratory burst of colored particles.
 */

interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  origin?: { x: number; y: number };
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#6366f1", // indigo (primary)
  "#a855f7", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
];

let isRunning = false;

export function fireConfetti(options: ConfettiOptions = {}): void {
  const {
    particleCount = 60,
    spread = 70,
    origin = { x: 0.5, y: 0.5 },
    colors = DEFAULT_COLORS,
  } = options;

  if (isRunning) return;
  isRunning = true;

  // Create a full-screen canvas
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    isRunning = false;
    return;
  }

  const cx = origin.x * canvas.width;
  const cy = origin.y * canvas.height;

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    decay: number;
    shape: "rect" | "circle";
  }

  const particles: Particle[] = [];

  for (let i = 0; i < particleCount; i++) {
    const angleDeg = (Math.random() * spread * 2 - spread);
    const angleRad = (Math.PI / 180) * angleDeg;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angleRad) * speed * (0.6 + Math.random() * 0.4),
      vy: Math.sin(angleRad) * speed * (0.6 + Math.random() * 0.4) - 4,
      size: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      decay: 0.015 + Math.random() * 0.02,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    });
  }

  let animationId: number;

  function animate() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity <= 0) continue;
      alive = true;

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate((p.rotation * Math.PI) / 180);
      ctx!.globalAlpha = Math.max(0, p.opacity);
      ctx!.fillStyle = p.color;

      if (p.shape === "rect") {
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.restore();
    }

    if (alive) {
      animationId = requestAnimationFrame(animate);
    } else {
      canvas.remove();
      isRunning = false;
    }
  }

  animationId = requestAnimationFrame(animate);
}

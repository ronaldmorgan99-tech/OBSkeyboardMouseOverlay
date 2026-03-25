import React, { useState, useEffect, useMemo, useRef } from 'react';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, MousePointer2, Keyboard, Palette, Layout as LayoutIcon, Sliders } from 'lucide-react';

// --- Types ---

interface OverlaySettings {
  primaryColor: string;
  activeColor: string;
  borderColor: string;
  textColor: string;
  activeTextColor: string;
  glowColor: string;
  baseColor: string;
  skewAngle: number;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  scale: number;
  showMouse: boolean;
  showKeyboard: boolean;
  fontFamily: 'sans' | 'display' | 'mono' | 'tactical' | 'condensed' | 'futuristic' | 'fira';
  glowIntensity: number;
  scanlines: boolean;
  animationSpeed: number;
  keySpacing: number;
  showFire: boolean;
  chromaKeyMode: boolean;
  transparentMode: boolean;
  rgbMode: boolean;
  rgbSpeed: number;
  realismLevel: number; // 0 (flat) to 100 (high realism)
  glowStrength: number; // 0 to 100
  mouseSkinUrl?: string;
  inputMode: 'browser' | 'external';
  externalInputUrl: string;
}

type InputConnectionStatus = 'disabled' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface InputController {
  pressKey: (code: string) => void;
  releaseKey: (code: string) => void;
  setActiveKeys: (codes: string[]) => void;
  pressMouseButton: (button: number) => void;
  releaseMouseButton: (button: number) => void;
  setActiveMouseButtons: (buttons: number[]) => void;
  updateMousePos: (x: number, y: number) => void;
  pulseScroll: (direction: 'up' | 'down') => void;
}

interface InputProvider {
  connect: (
    controller: InputController,
    onStatus?: (status: InputConnectionStatus) => void
  ) => () => void;
}

const CHROMA_GREEN = '#00ff00';
const SETTINGS_STORAGE_KEY = 'obs-overlay-settings-v1';

const PRESETS: Record<string, Partial<OverlaySettings>> = {
  'Neon Elite': {
    primaryColor: '#080808',
    activeColor: '#facc15',
    borderColor: '#facc15',
    textColor: '#facc15',
    activeTextColor: '#000000',
    glowColor: '#facc15',
    baseColor: '#1a1a1a',
    glowIntensity: 25,
    glowStrength: 80,
    realismLevel: 90,
    borderRadius: 8,
    skewAngle: -5,
    showFire: false,
    scanlines: true,
  },
  'Cyber Stealth': {
    primaryColor: '#050505',
    activeColor: '#ffffff',
    borderColor: '#333333',
    textColor: '#666666',
    activeTextColor: '#000000',
    glowColor: '#ffffff',
    baseColor: '#111111',
    glowIntensity: 15,
    glowStrength: 40,
    realismLevel: 100,
    borderRadius: 4,
    skewAngle: -10,
    showFire: false,
  },
  'Glass Minimal': {
    primaryColor: 'rgba(255, 255, 255, 0.03)',
    activeColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textColor: '#ffffff',
    activeTextColor: '#ffffff',
    glowColor: '#ffffff',
    baseColor: 'rgba(255, 255, 255, 0.05)',
    glowIntensity: 10,
    glowStrength: 30,
    realismLevel: 50,
    borderRadius: 12,
    skewAngle: 0,
    showFire: false,
  },
  'Inferno Pro': {
    primaryColor: '#0a0200',
    activeColor: '#ef4444',
    borderColor: '#f97316',
    textColor: '#f97316',
    activeTextColor: '#ffffff',
    glowColor: '#ef4444',
    baseColor: '#1a0500',
    glowIntensity: 35,
    glowStrength: 90,
    realismLevel: 80,
    borderRadius: 2,
    skewAngle: -15,
    showFire: true,
  }
};

const DEFAULT_SETTINGS: OverlaySettings = {
  primaryColor: '#080808',
  activeColor: '#facc15',
  borderColor: 'rgba(250, 204, 21, 0.4)',
  textColor: 'rgba(250, 204, 21, 0.6)',
  activeTextColor: '#000000',
  glowColor: '#facc15',
  baseColor: '#1a1a1a',
  skewAngle: -5,
  borderWidth: 1.5,
  borderRadius: 8,
  opacity: 0.95,
  scale: 1,
  showMouse: true,
  showKeyboard: true,
  fontFamily: 'display',
  glowIntensity: 25,
  scanlines: true,
  animationSpeed: 0.1,
  keySpacing: 10,
  showFire: false,
  chromaKeyMode: false,
  transparentMode: false,
  rgbMode: false,
  rgbSpeed: 5,
  realismLevel: 80,
  glowStrength: 70,
  mouseSkinUrl: '',
  inputMode: 'browser',
  externalInputUrl: 'ws://127.0.0.1:4456',
};

const loadStoredSettings = (): OverlaySettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!rawSettings) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsedSettings = JSON.parse(rawSettings);
    if (!parsedSettings || typeof parsedSettings !== 'object' || Array.isArray(parsedSettings)) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsedSettings,
    };
  } catch (error) {
    console.warn('Failed to parse saved overlay settings; falling back to defaults.', error);
    return DEFAULT_SETTINGS;
  }
};

// --- Components ---

const FireShader = ({ color, rgbMode, rgbSpeed }: { color: string, rgbMode: boolean, rgbSpeed: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true });
    if (!gl) return;

    const vertexSrc = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSrc = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform vec3 baseColor;
      uniform bool rgbMode;
      uniform float rgbSpeed;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
          mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
          u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        
        // Dynamic distortion for "licking" effect
        vec2 q = uv;
        q.x += fbm(uv * 3.0 + time * 0.5) * 0.1 - 0.05;
        q.y -= time * 1.2;
        
        float n = fbm(q * 4.0);
        
        // Organic teardrop mask
        float dist = length(vec2(uv.x - 0.5, uv.y * 0.5));
        float mask = smoothstep(0.5, 0.2, dist);
        mask *= pow(1.0 - uv.y, 1.5); // Fade at top
        
        float flame = n * mask * 2.0;
        flame = smoothstep(0.1, 0.8, flame);
        
        vec3 activeColor = baseColor;
        if (rgbMode) {
          float hue = fract(time * rgbSpeed * 0.05);
          activeColor = hsv2rgb(vec3(hue, 1.0, 1.0));
        }
        
        // Color ramp: hot core to cooler edges
        vec3 col = mix(activeColor * 0.5, activeColor, flame);
        col = mix(col, vec3(1.0, 1.0, 1.0), pow(flame, 3.5)); // White hot core
        
        // Add some "embers" or extra glow at the bottom
        float glow = exp(-dist * 10.0) * 0.5;
        col += activeColor * glow;
        
        float alpha = clamp(flame * 1.5, 0.0, 1.0);
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `;

    function compile(type: number, src: string) {
      const shader = gl!.createShader(type)!;
      gl!.shaderSource(shader, src);
      gl!.compileShader(shader);
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    const timeLoc = gl.getUniformLocation(program, 'time');
    const resLoc = gl.getUniformLocation(program, 'resolution');
    const colorLoc = gl.getUniformLocation(program, 'baseColor');
    const rgbModeLoc = gl.getUniformLocation(program, 'rgbMode');
    const rgbSpeedLoc = gl.getUniformLocation(program, 'rgbSpeed');

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
      ] : [1, 0.5, 0];
    };

    let animationFrameId: number;
    const start = performance.now();

    const render = () => {
      const now = performance.now();
      const t = now / 1000; // Use absolute time for global sync
      const rgb = hexToRgb(colorRef.current);
      
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(timeLoc, t);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform3f(colorLoc, rgb[0], rgb[1], rgb[2]);
      gl.uniform1i(rgbModeLoc, rgbMode ? 1 : 0);
      gl.uniform1f(rgbSpeedLoc, rgbSpeed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [rgbMode, rgbSpeed]);

  return (
    <canvas 
      ref={canvasRef} 
      width={100} 
      height={150} 
      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[220%] pointer-events-none mix-blend-screen"
    />
  );
};

const LiveStatus = ({ activeKeys, activeMouseButtons, settings }: { activeKeys: Set<string>, activeMouseButtons: Set<number>, settings: OverlaySettings }) => {
  const isActive = activeKeys.size > 0 || activeMouseButtons.size > 0;
  const isChroma = settings.chromaKeyMode;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`absolute top-10 left-10 flex flex-col gap-2 p-5 rounded-xl border z-30 min-w-[220px] ${isChroma ? 'bg-black border-white/20' : 'bg-black/60 border-white/5 backdrop-blur-2xl'}`}
      style={{ boxShadow: isChroma ? '0 10px 40px rgba(0,0,0,0.8)' : '0 10px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(255, 255, 255, 0.02)' }}
    >
      <span className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: isChroma ? '#ffffff' : 'var(--glow-color)', opacity: 0.8 }}>Live Status</span>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div 
            className="w-2.5 h-2.5 rounded-full transition-colors duration-300"
            style={{ 
              backgroundColor: isActive ? (isChroma ? '#ffffff' : '#4ade80') : (isChroma ? '#333333' : 'var(--glow-color)'),
              boxShadow: `0 0 10px ${isActive ? (isChroma ? '#ffffff' : '#4ade80') : (isChroma ? '#333333' : 'var(--glow-color)')}`
            }} 
          />
          {isActive && (
            <motion.div 
              animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={`absolute inset-0 rounded-full ${isChroma ? 'bg-white' : 'bg-green-400'}`}
            />
          )}
        </div>
        <span className={`text-sm font-medium tracking-wide ${isChroma ? 'text-white' : 'text-white/70'}`}>
          {isActive ? 'Input Detected...' : 'Awaiting Input...'}
        </span>
      </div>
    </motion.div>
  );
};

const KeyCap = ({ 
  label, 
  isActive, 
  settings, 
  width = 'w-16', 
  height = 'h-16',
  fontSize = 'text-xl'
}: { 
  label: string; 
  isActive: boolean; 
  settings: OverlaySettings;
  width?: string;
  height?: string;
  fontSize?: string;
}) => {
  const realism = settings.realismLevel / 100;
  const glowStr = settings.glowStrength / 100;

  return (
    <div className={`relative ${width} ${height} group`}>
      {/* Surface Glow (The spill on the desk) */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.6 * glowStr, scale: 1.5 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute -inset-4 blur-3xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${settings.glowColor} 0%, transparent 70%)`,
              zIndex: -2
            }}
          />
        )}
      </AnimatePresence>

      {/* Key Base (The glowing 3D side) */}
      <div 
        className="absolute inset-0 transition-all duration-150"
        style={{
          backgroundColor: isActive ? 'var(--glow-color)' : settings.baseColor,
          borderRadius: `${settings.borderRadius}px`,
          transform: `translateY(${isActive ? 1 : 8 * realism}px) scaleX(${isActive ? 0.98 : 1})`,
          opacity: isActive ? 1 : 0.4,
          boxShadow: isActive 
            ? `0 0 20px var(--glow-color), 0 0 40px color-mix(in srgb, var(--glow-color), transparent 60%), 0 0 80px color-mix(in srgb, var(--glow-color), transparent 80%), 0 120px 100px color-mix(in srgb, var(--glow-color), transparent 90%), 0 10px 20px rgba(0,0,0,0.4)` 
            : `0 ${6 * realism}px 15px rgba(0,0,0,0.8), 0 0 10px color-mix(in srgb, var(--glow-color), transparent 90%)`,
          zIndex: 0,
          border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.03)'
        }}
      />

      {/* Key Body (The top surface) */}
      <motion.div 
        animate={{ 
          y: isActive ? 6 * realism : 0,
          rotateX: isActive ? 8 * realism : 0,
          scale: isActive ? 0.95 : 1,
          boxShadow: isActive 
            ? `inset 0 0 20px rgba(255,255,255,0.2), inset 0 -4px 10px rgba(0,0,0,0.4)` 
            : `inset 0 2px 4px rgba(255,255,255,0.05), inset 0 -4px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255, 255, 255, 0.03)`
        }}
        transition={{ 
          type: "spring", 
          stiffness: 800, 
          damping: 30
        }}
        className="w-full h-full relative flex items-center justify-center overflow-hidden z-10 origin-top"
        style={{
          backgroundColor: isActive ? 'var(--active-color)' : settings.primaryColor,
          border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255, 255, 255, 0.03)'}`,
          borderRadius: `${settings.borderRadius}px`,
        }}
      >
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />
        
        {/* Fire Effect */}
        <AnimatePresence>
          {isActive && settings.showFire && (
            <FireShader color={settings.activeColor} rgbMode={settings.rgbMode} rgbSpeed={settings.rgbSpeed} />
          )}
        </AnimatePresence>

        <motion.span 
          className={`${fontSize} ${['sans', 'mono'].includes(settings.fontFamily) ? 'italic' : ''} font-bold uppercase select-none tracking-tighter`}
          style={{ 
            fontFamily: `var(--font-${settings.fontFamily})`,
            color: isActive 
              ? (settings.rgbMode ? 'var(--active-text-color-rgb)' : settings.activeTextColor) 
              : 'var(--inactive-text-color)',
            textShadow: isActive 
              ? `0 0 15px ${settings.rgbMode ? 'var(--active-text-color-rgb)' : 'var(--glow-color)'}, 0 0 30px ${settings.rgbMode ? 'var(--active-text-color-rgb)' : 'var(--glow-color)'}` 
              : `0 0 5px color-mix(in srgb, var(--glow-color), transparent 80%)`,
            opacity: isActive ? 1 : 0.5
          }}
        >
          {label}
        </motion.span>
        
        {/* Glossy Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      </motion.div>
    </div>
  );
};

const MouseOverlay = ({ activeButtons, scrollDirection, settings, mousePos }: { activeButtons: Set<number>, scrollDirection: 'up' | 'down' | null, settings: OverlaySettings, mousePos: { x: number, y: number } }) => {
  const isLeft = activeButtons.has(0);
  const isRight = activeButtons.has(2);
  const isMiddle = activeButtons.has(1);
  const isBack = activeButtons.has(3);
  const isForward = activeButtons.has(4);
  const isScrolling = scrollDirection !== null;

  const realism = settings.realismLevel / 100;
  const glowStr = settings.glowStrength / 100;

  return (
    <div className="flex flex-col items-center gap-8">
      <motion.div 
        animate={{ 
          scale: settings.scale,
          rotateX: 15 * realism,
          rotateY: -5 * realism
        }}
        className="relative w-44 h-72 border flex flex-col overflow-hidden bg-[#1a1a1a] backdrop-blur-3xl"
        style={{ 
          borderColor: 'rgba(250, 204, 21, 0.25)',
          borderRadius: '100px',
          borderWidth: '1px',
          boxShadow: `0 40px 100px rgba(0,0,0,0.8), inset 0 0 40px rgba(250, 204, 21, 0.05)`,
          perspective: '1200px',
          background: 'linear-gradient(180deg, #222222 0%, #151515 100%)'
        }}
      >
        {/* Rim Glow (The golden outline) */}
        <div className={`absolute inset-0 rounded-[inherit] transition-opacity duration-300 pointer-events-none`}
             style={{ 
               boxShadow: `inset 0 0 30px var(--glow-color), 0 0 60px color-mix(in srgb, var(--glow-color), transparent 40%)`,
               border: `2px solid color-mix(in srgb, var(--glow-color), transparent 50%)`
             }} />

        {/* Buttons Area */}
        <div className="flex h-[45%] border-b relative z-10" style={{ borderColor: 'rgba(250, 204, 21, 0.25)' }}>
          {/* Left Button */}
          <motion.div 
            animate={{ backgroundColor: isLeft ? `color-mix(in srgb, var(--glow-color), transparent 80%)` : 'transparent' }}
            className="flex-1 border-r relative overflow-hidden flex items-center justify-center"
            style={{ borderColor: 'rgba(250, 204, 21, 0.25)' }}
          >
            <AnimatePresence>
              {isLeft && settings.showFire && (
                <FireShader color={settings.activeColor} rgbMode={settings.rgbMode} rgbSpeed={settings.rgbSpeed} />
              )}
            </AnimatePresence>
            {isLeft && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 blur-2xl" 
                style={{ background: `radial-gradient(circle, color-mix(in srgb, var(--glow-color), transparent 70%) 0%, transparent 70%)` }} 
              />
            )}
            <span 
              className={`relative z-10 text-[8px] font-bold tracking-[0.3em] uppercase mt-20 transition-colors duration-200`} 
              style={{ 
                fontFamily: `var(--font-${settings.fontFamily})`,
                color: isLeft 
                  ? (settings.rgbMode ? 'var(--active-text-color-rgb)' : settings.activeTextColor) 
                  : 'var(--inactive-text-color)',
                textShadow: isLeft ? `0 0 10px ${settings.rgbMode ? 'var(--active-text-color-rgb)' : 'var(--glow-color)'}` : 'none',
                opacity: isLeft ? 1 : 0.2
              }}
            >
              LMB
            </span>
          </motion.div>

          {/* Right Button */}
          <motion.div 
            animate={{ backgroundColor: isRight ? `color-mix(in srgb, var(--glow-color), transparent 80%)` : 'transparent' }}
            className="flex-1 relative overflow-hidden flex items-center justify-center"
          >
            <AnimatePresence>
              {isRight && settings.showFire && (
                <FireShader color={settings.activeColor} rgbMode={settings.rgbMode} rgbSpeed={settings.rgbSpeed} />
              )}
            </AnimatePresence>
            {isRight && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 blur-2xl" 
                style={{ background: `radial-gradient(circle, color-mix(in srgb, var(--glow-color), transparent 70%) 0%, transparent 70%)` }} 
              />
            )}
            <span 
              className={`relative z-10 text-[8px] font-bold tracking-[0.3em] uppercase mt-20 transition-colors duration-200`} 
              style={{ 
                fontFamily: `var(--font-${settings.fontFamily})`,
                color: isRight 
                  ? (settings.rgbMode ? 'var(--active-text-color-rgb)' : settings.activeTextColor) 
                  : 'var(--inactive-text-color)',
                textShadow: isRight ? `0 0 10px ${settings.rgbMode ? 'var(--active-text-color-rgb)' : 'var(--glow-color)'}` : 'none',
                opacity: isRight ? 1 : 0.2
              }}
            >
              RMB
            </span>
          </motion.div>
        </div>
        
        {/* Scroll Wheel */}
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-20 border rounded-full bg-black/80 flex flex-col items-center justify-center overflow-hidden z-20 shadow-2xl"
             style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
           <motion.div 
             animate={{ 
                backgroundColor: (isMiddle || isScrolling) ? `color-mix(in srgb, var(--glow-color), transparent 70%)` : 'transparent',
                boxShadow: (isMiddle || isScrolling) ? `0 0 30px var(--glow-color)` : 'none'
             }}
             className="w-full h-full relative flex flex-col items-center justify-center" 
           >
             <AnimatePresence>
               {(isMiddle || isScrolling) && settings.showFire && (
                 <FireShader color={settings.activeColor} rgbMode={settings.rgbMode} rgbSpeed={settings.rgbSpeed} />
               )}
             </AnimatePresence>
             {/* Wheel Ribs */}
             <div className="flex flex-col gap-1.5">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-4 h-0.5 bg-white/10 rounded-full" />
                ))}
             </div>
             
             {/* Active Glow */}
             <AnimatePresence>
                {(isMiddle || isScrolling) && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent" 
                    />
                )}
             </AnimatePresence>

             {isScrolling && (
               <motion.div 
                 initial={{ y: scrollDirection === 'up' ? 10 : -10, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 z-30"
               >
                 {[...Array(3)].map((_, i) => (
                   <span key={i} className="text-[14px] font-black text-black leading-none select-none">
                     {scrollDirection === 'up' ? '▲' : '▼'}
                   </span>
                 ))}
               </motion.div>
             )}
           </motion.div>
        </div>

        {/* Side Buttons */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-3 -translate-x-1 z-20">
          <motion.div 
            animate={{ backgroundColor: isForward ? 'var(--glow-color)' : 'rgba(255,255,255,0.05)' }}
            className="w-2.5 h-12 border rounded-r-lg relative overflow-hidden shadow-xl"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <AnimatePresence>
              {isForward && settings.showFire && (
                <FireShader color={settings.activeColor} rgbMode={settings.rgbMode} rgbSpeed={settings.rgbSpeed} />
              )}
            </AnimatePresence>
          </motion.div>
          <motion.div 
            animate={{ backgroundColor: isBack ? 'var(--glow-color)' : 'rgba(255,255,255,0.05)' }}
            className="w-2.5 h-12 border rounded-r-lg relative overflow-hidden shadow-xl"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <AnimatePresence>
              {isBack && settings.showFire && (
                <FireShader color={settings.activeColor} rgbMode={settings.rgbMode} rgbSpeed={settings.rgbSpeed} />
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Mouse Body Detail */}
        <div className="flex-1 flex flex-col items-center justify-end pb-10 gap-4 relative">
            {settings.mouseSkinUrl && (
              <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
                <img 
                  src={settings.mouseSkinUrl} 
                  alt="Mouse Skin" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="w-16 h-0.5 bg-white/40 rounded-full relative z-10" />
            <div className="w-10 h-10 rounded-full border-2 border-white/60 bg-white/30 flex items-center justify-center overflow-hidden shadow-inner relative z-10">
                <motion.div 
                  animate={{ 
                    x: (mousePos.x - 0.5) * 12,
                    y: (mousePos.y - 0.5) * 12
                  }}
                  className="w-3 h-3 rounded-full" 
                  style={{ 
                    backgroundColor: 'var(--glow-color)',
                    boxShadow: `0 0 25px var(--glow-color), 0 0 50px var(--glow-color)`
                  }}
                />
            </div>
        </div>
      </motion.div>
      <span className="text-xs font-black uppercase tracking-[0.4em] opacity-40 select-none text-white">Mouse Input</span>
    </div>
  );
};

const createBrowserEventsProvider = (mouseTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>): InputProvider => ({
  connect: (controller) => {
    const handleKeyDown = (e: KeyboardEvent) => controller.pressKey(e.code);
    const handleKeyUp = (e: KeyboardEvent) => controller.releaseKey(e.code);
    const handleMouseDown = (e: MouseEvent) => controller.pressMouseButton(e.button);
    const handleMouseUp = (e: MouseEvent) => controller.releaseMouseButton(e.button);
    const handleWheel = (e: WheelEvent) => controller.pulseScroll(e.deltaY < 0 ? 'up' : 'down');
    const handleMouseMove = (e: MouseEvent) => {
      if (mouseTimeoutRef.current) {
        clearTimeout(mouseTimeoutRef.current);
      }

      controller.updateMousePos(e.clientX / window.innerWidth, e.clientY / window.innerHeight);

      mouseTimeoutRef.current = setTimeout(() => {
        controller.updateMousePos(0.5, 0.5);
      }, 100);
    };
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('contextmenu', preventContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('contextmenu', preventContextMenu);
    };
  },
});

const createWebSocketInputProvider = (url: string): InputProvider => ({
  connect: (controller, onStatus) => {
    onStatus?.('connecting');

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(url);
    } catch {
      onStatus?.('error');
      return () => undefined;
    }

    const handleOpen = () => onStatus?.('connected');
    const handleClose = () => onStatus?.('disconnected');
    const handleError = () => onStatus?.('error');
    const handleMessage = (event: MessageEvent) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!payload || typeof payload !== 'object') return;
      const data = payload as Record<string, unknown>;
      const type = data.type;
      if (typeof type !== 'string') return;

      if (type === 'key' && typeof data.code === 'string' && typeof data.pressed === 'boolean') {
        data.pressed ? controller.pressKey(data.code) : controller.releaseKey(data.code);
        return;
      }

      if (type === 'mouse_button' && typeof data.button === 'number' && typeof data.pressed === 'boolean') {
        data.pressed ? controller.pressMouseButton(data.button) : controller.releaseMouseButton(data.button);
        return;
      }

      if (type === 'mouse_move' && typeof data.x === 'number' && typeof data.y === 'number') {
        controller.updateMousePos(data.x, data.y);
        return;
      }

      if (type === 'wheel') {
        if (data.direction === 'up' || data.direction === 'down') {
          controller.pulseScroll(data.direction);
        } else if (typeof data.deltaY === 'number') {
          controller.pulseScroll(data.deltaY < 0 ? 'up' : 'down');
        }
        return;
      }

      if (type === 'snapshot') {
        if (Array.isArray(data.activeKeys) && data.activeKeys.every((k) => typeof k === 'string')) {
          controller.setActiveKeys(data.activeKeys as string[]);
        }
        if (Array.isArray(data.activeMouseButtons) && data.activeMouseButtons.every((b) => typeof b === 'number')) {
          controller.setActiveMouseButtons(data.activeMouseButtons as number[]);
        }
        if (
          data.mousePos &&
          typeof data.mousePos === 'object' &&
          typeof (data.mousePos as Record<string, unknown>).x === 'number' &&
          typeof (data.mousePos as Record<string, unknown>).y === 'number'
        ) {
          const pos = data.mousePos as { x: number; y: number };
          controller.updateMousePos(pos.x, pos.y);
        }
      }
    };

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleError);
    socket.addEventListener('message', handleMessage);

    return () => {
      if (!socket) return;
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('close', handleClose);
      socket.removeEventListener('error', handleError);
      socket.removeEventListener('message', handleMessage);
      socket.close();
    };
  },
});

export default function App() {
  const urlConfig = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get('mode') || '').toLowerCase();
    const isOverlayMode = mode === 'overlay';
    const hideSettings = params.get('hideSettings') === '1' || params.get('hideSettings')?.toLowerCase() === 'true';
    const transparent = params.get('transparent') === '1' || params.get('transparent')?.toLowerCase() === 'true';
    const preset = params.get('preset');

    return {
      isOverlayMode,
      shouldHideSettings: isOverlayMode || hideSettings,
      transparent,
      preset,
    };
  }, []);

  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [activeMouseButtons, setActiveMouseButtons] = useState<Set<number>>(new Set());
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [settings, setSettings] = useState<OverlaySettings>(() => loadStoredSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [externalConnectionStatus, setExternalConnectionStatus] = useState<InputConnectionStatus>('disabled');
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(!urlConfig.shouldHideSettings);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // RGB Animation Logic (CSS Variable based for performance)
  useEffect(() => {
    if (!settings.rgbMode) {
      containerRef.current?.style.setProperty('--active-color', settings.activeColor);
      containerRef.current?.style.setProperty('--glow-color', settings.glowColor);
      containerRef.current?.style.setProperty('--inactive-text-color', settings.textColor);
      containerRef.current?.style.setProperty('--active-text-color-rgb', settings.activeTextColor);
      return;
    }

    let animationFrameId: number;

    const animate = () => {
      const now = performance.now();
      const t = now / 1000;
      const hue = (t * settings.rgbSpeed * 0.05) % 1.0;
      const offsetHue = (hue + 0.5) % 1.0; // 180 degree offset for visibility
      
      const color = `hsl(${hue * 360}, 100%, 50%)`;
      const offsetColor = `hsl(${offsetHue * 360}, 100%, 50%)`;
      
      // Active color now follows RGB as per user request
      containerRef.current?.style.setProperty('--active-color', color);
      containerRef.current?.style.setProperty('--glow-color', color);
      // Inactive text follows RGB
      containerRef.current?.style.setProperty('--inactive-text-color', color);
      // Active text follows offset RGB for visibility through fire
      containerRef.current?.style.setProperty('--active-text-color-rgb', offsetColor);
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [settings.rgbMode, settings.rgbSpeed, settings.activeColor, settings.glowColor, settings.textColor]);

  const inputController = useMemo<InputController>(() => ({
    pressKey: (code: string) => {
      setActiveKeys((prev) => new Set(prev).add(code));
    },
    releaseKey: (code: string) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    },
    setActiveKeys: (codes: string[]) => {
      setActiveKeys(new Set(codes));
    },
    pressMouseButton: (button: number) => {
      setActiveMouseButtons((prev) => new Set(prev).add(button));
    },
    releaseMouseButton: (button: number) => {
      setActiveMouseButtons((prev) => {
        const next = new Set(prev);
        next.delete(button);
        return next;
      });
    },
    setActiveMouseButtons: (buttons: number[]) => {
      setActiveMouseButtons(new Set(buttons));
    },
    updateMousePos: (x: number, y: number) => {
      setMousePos({
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
      });
    },
    pulseScroll: (direction: 'up' | 'down') => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      setScrollDirection(direction);
      scrollTimeoutRef.current = setTimeout(() => {
        setScrollDirection(null);
      }, 150);
    },
  }), []);

  useEffect(() => {
    if (settings.inputMode !== 'external') {
      setExternalConnectionStatus('disabled');
      return;
    }

    const wsProvider = createWebSocketInputProvider(settings.externalInputUrl);
    return wsProvider.connect(inputController, setExternalConnectionStatus);
  }, [inputController, settings.inputMode, settings.externalInputUrl]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const shouldUseBrowserProvider =
      settings.inputMode === 'browser' ||
      (settings.inputMode === 'external' && externalConnectionStatus !== 'connected');

    if (!shouldUseBrowserProvider) {
      return;
    }

    const browserProvider = createBrowserEventsProvider(mouseTimeoutRef);
    return browserProvider.connect(inputController);
  }, [inputController, externalConnectionStatus, settings.inputMode]);
    setSettings(prev => {
      let nextSettings: OverlaySettings = { ...prev };

      if (urlConfig.preset) {
        const presetName = Object.keys(PRESETS).find((name) => name.toLowerCase() === urlConfig.preset!.toLowerCase());
        if (presetName) {
          nextSettings = {
            ...DEFAULT_SETTINGS,
            ...PRESETS[presetName],
          } as OverlaySettings;
        }
      }

      if (urlConfig.transparent) {
        nextSettings = {
          ...nextSettings,
          transparentMode: true,
          chromaKeyMode: false,
        };
      }

      return nextSettings;
    });

    if (urlConfig.shouldHideSettings) {
      setShowSettings(false);
    }
  }, [urlConfig]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to persist overlay settings.', error);
    }
  }, [settings]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('wheel', handleWheel);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove, handleWheel, handleContextMenu]);

  const updateSetting = (key: keyof OverlaySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetName: string) => {
    setSettings(prev => ({ 
      ...DEFAULT_SETTINGS, 
      ...PRESETS[presetName] 
    }));
  };

  const isExternalMode = settings.inputMode === 'external';
  const connectionLabel: Record<InputConnectionStatus, string> = {
    disabled: 'Disabled',
    connecting: 'Connecting',
    connected: 'Connected',
    disconnected: 'Disconnected (Browser Fallback)',
    error: 'Connection Error (Browser Fallback)',
  };
  const connectionClassName: Record<InputConnectionStatus, string> = {
    disabled: 'border-white/20 text-white/70',
    connecting: 'border-amber-400/50 text-amber-300',
    connected: 'border-emerald-400/50 text-emerald-300',
    disconnected: 'border-orange-400/50 text-orange-300',
    error: 'border-red-400/50 text-red-300',
  const resetSettings = () => {
    const shouldReset = window.confirm('Reset all overlay settings to defaults?');
    if (!shouldReset) return;

    window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen w-full flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors duration-500"
      style={{ 
        backgroundColor: settings.transparentMode 
          ? 'transparent' 
          : (settings.chromaKeyMode ? CHROMA_GREEN : '#030303') 
      }}
    >
      {/* Noise & Dust Texture */}
      {!settings.chromaKeyMode && !settings.transparentMode && (
        <>
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.05] contrast-150 brightness-150" 
               style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.1]" 
               style={{ 
                 backgroundImage: 'radial-gradient(circle at center, rgba(250, 204, 21, 0.1) 0%, transparent 70%)',
                 filter: 'blur(100px)'
               }} />
          {/* Golden Dust Particles */}
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.2]"
               style={{
                 backgroundImage: `radial-gradient(circle at 2px 2px, rgba(250, 204, 21, 0.4) 1px, transparent 0)`,
                 backgroundSize: '40px 40px'
               }} />
        </>
      )}

      {/* Live Status Panel */}
      {!settings.transparentMode && (
        <LiveStatus activeKeys={activeKeys} activeMouseButtons={activeMouseButtons} settings={settings} />
      )}

      {isExternalMode && (
        <div className={`absolute top-6 right-6 z-30 px-3 py-1 rounded-full border text-[10px] uppercase tracking-widest bg-black/40 backdrop-blur ${connectionClassName[externalConnectionStatus]}`}>
          External Input: {connectionLabel[externalConnectionStatus]}
        </div>
      )}

      {/* Scanlines Effect */}
      {settings.scanlines && !settings.chromaKeyMode && !settings.transparentMode && (
        <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.05]" 
             style={{ backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
      )}

      {/* Background Grid Decoration */}
      {!settings.chromaKeyMode && !settings.transparentMode && (
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '100px 100px' }} />
      )}

      {/* Main Display Area */}
      <div 
        className="flex flex-col md:flex-row items-center justify-center gap-32 z-10 transition-transform duration-300"
        style={{ transform: `skewX(${settings.skewAngle}deg)` }}
      >
        {settings.showKeyboard && (
          <div className="flex flex-col items-center">
            <div className="flex flex-col" style={{ transform: `scale(${settings.scale})`, gap: `${settings.keySpacing}px` }}>
              {/* Row 1: QWER */}
              <div className="flex" style={{ gap: `${settings.keySpacing}px`, marginLeft: `${64 + settings.keySpacing}px` }}>
                <KeyCap label="Q" isActive={activeKeys.has('KeyQ')} settings={settings} />
                <KeyCap label="W" isActive={activeKeys.has('KeyW')} settings={settings} />
                <KeyCap label="E" isActive={activeKeys.has('KeyE')} settings={settings} />
                <KeyCap label="R" isActive={activeKeys.has('KeyR')} settings={settings} />
              </div>
              {/* Row 2: Shift ASD F */}
              <div className="flex" style={{ gap: `${settings.keySpacing}px` }}>
                <KeyCap label="SHIFT" isActive={activeKeys.has('ShiftLeft') || activeKeys.has('ShiftRight')} settings={settings} width="w-28" fontSize="text-sm" />
                <KeyCap label="A" isActive={activeKeys.has('KeyA')} settings={settings} />
                <KeyCap label="S" isActive={activeKeys.has('KeyS')} settings={settings} />
                <KeyCap label="D" isActive={activeKeys.has('KeyD')} settings={settings} />
                <KeyCap label="F" isActive={activeKeys.has('KeyF')} settings={settings} />
              </div>
              {/* Row 3: Ctrl Space */}
              <div className="flex" style={{ gap: `${settings.keySpacing}px` }}>
                <KeyCap label="CTRL" isActive={activeKeys.has('ControlLeft') || activeKeys.has('ControlRight')} settings={settings} width="w-24" fontSize="text-sm" />
                <KeyCap label="" isActive={activeKeys.has('Space')} settings={settings} width="w-[320px]" />
              </div>
            </div>
            <span className={`text-xs font-black uppercase tracking-[0.4em] mt-12 select-none text-white ${settings.chromaKeyMode ? 'text-black' : 'opacity-40'}`}>Keyboard Input</span>
          </div>
        )}

        {settings.showMouse && (
          <MouseOverlay activeButtons={activeMouseButtons} scrollDirection={scrollDirection} settings={settings} mousePos={mousePos} />
        )}
      </div>

      {/* Settings Toggle */}
      {!urlConfig.shouldHideSettings && (
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="fixed bottom-12 right-12 w-16 h-16 flex items-center justify-center bg-black/60 hover:bg-black/80 border border-yellow-500/20 rounded-full transition-all z-50 group backdrop-blur-3xl"
          style={{ 
            boxShadow: !settings.chromaKeyMode ? '0 10px 30px rgba(0,0,0,0.6), 0 0 0 1px rgba(250, 204, 21, 0.1)' : ''
          }}
        >
          <Settings className={`w-7 h-7 transition-transform duration-700 ${showSettings ? 'rotate-180' : 'group-hover:rotate-90'} text-yellow-500`} />
          <div className="absolute inset-0 rounded-full bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && !urlConfig.shouldHideSettings && (
          <motion.div 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed top-0 right-0 h-full w-80 bg-[#141414] border-l border-white/10 p-6 z-40 overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-8">
              <Sliders className="w-5 h-5 text-yellow-400" />
              <h2 className="text-xl font-display font-bold uppercase tracking-tight">Configuration</h2>
            </div>

            <div className="space-y-8">
              {/* Visual Fidelity */}
              <section className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-lg space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Visual Fidelity</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase font-bold opacity-60">
                    <span>Realism Level</span>
                    <span>{settings.realismLevel}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={settings.realismLevel}
                    onChange={(e) => updateSetting('realismLevel', parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase font-bold opacity-60">
                    <span>Glow Strength</span>
                    <span>{settings.glowStrength}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={settings.glowStrength}
                    onChange={(e) => updateSetting('glowStrength', parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                  />
                </div>
              </section>

              {/* Mouse Skin */}
              <section className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-lg space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <MousePointer2 className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Mouse Skin</span>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold opacity-50">Skin URL (GIF/PNG)</label>
                  <input 
                    type="text" 
                    placeholder="https://example.com/skin.gif"
                    value={settings.mouseSkinUrl || ''} 
                    onChange={(e) => updateSetting('mouseSkinUrl', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-yellow-500/50 outline-none"
                  />
                  <p className="text-[9px] opacity-40 italic">Paste a URL to apply a custom skin to the mouse body.</p>
                </div>
              </section>

              {/* Presets */}
              <section>
                <div className="flex items-center gap-2 mb-4 opacity-60">
                  <LayoutIcon className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Presets</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(PRESETS).map(name => (
                    <button 
                      key={name}
                      onClick={() => applyPreset(name)}
                      className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] uppercase font-bold tracking-wider transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </section>

              {/* Input Pipeline */}
              <section className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase tracking-tight text-sky-300">External Input Mode</span>
                    <span className="text-[10px] opacity-60">Use companion WebSocket events</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.inputMode === 'external'}
                    onChange={(e) => updateSetting('inputMode', e.target.checked ? 'external' : 'browser')}
                    className="w-5 h-5 accent-sky-500"
                  />
                </div>

                {settings.inputMode === 'external' && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold opacity-50">WebSocket URL</label>
                    <input
                      type="text"
                      value={settings.externalInputUrl}
                      onChange={(e) => updateSetting('externalInputUrl', e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-sky-400/60 outline-none"
                    />
                    <p className="text-[9px] opacity-50 italic">
                      Expected JSON: key, mouse_button, mouse_move, wheel, and snapshot events.
                    </p>
                  </div>
                )}
              </section>

              {/* Chroma Key / Transparent Mode */}
              <section className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase tracking-tight text-green-400">Transparent Mode</span>
                    <span className="text-[10px] opacity-60">For OBS Browser Source</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settings.transparentMode} 
                    onChange={(e) => {
                      updateSetting('transparentMode', e.target.checked);
                      if (e.target.checked) updateSetting('chromaKeyMode', false);
                    }}
                    className="w-5 h-5 accent-green-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase tracking-tight text-green-400">Chroma Key</span>
                    <span className="text-[10px] opacity-60">Enable Green Screen</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={settings.chromaKeyMode} 
                    onChange={(e) => {
                      updateSetting('chromaKeyMode', e.target.checked);
                      if (e.target.checked) updateSetting('transparentMode', false);
                    }}
                    className="w-5 h-5 accent-green-500"
                  />
                </div>
              </section>

              {/* RGB Mode */}
              <section className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold uppercase tracking-tight text-indigo-400">RGB Animation</span>
                      <span className="text-[10px] opacity-60">Cycle active key colors</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.rgbMode} 
                      onChange={(e) => updateSetting('rgbMode', e.target.checked)}
                      className="w-5 h-5 accent-indigo-500"
                    />
                  </div>
                  {settings.rgbMode && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] uppercase font-bold opacity-60">
                        <span>Cycle Speed</span>
                        <span>{settings.rgbSpeed}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        step="1"
                        value={settings.rgbSpeed}
                        onChange={(e) => updateSetting('rgbSpeed', parseInt(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* Colors */}
              <section>
                <div className="flex items-center gap-2 mb-4 opacity-60">
                  <Palette className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Colors</span>
                </div>
                <div className="space-y-4">
                  {/* Primary Color */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold opacity-50">Inactive Key</label>
                    <input 
                      type="color" 
                      value={settings.primaryColor} 
                      onChange={(e) => updateSetting('primaryColor', e.target.value)}
                      className="w-full h-8 bg-transparent border-none cursor-pointer"
                    />
                  </div>

                  {/* Active Color */}
                  <div className={`flex flex-col gap-1 ${settings.rgbMode ? 'opacity-30 pointer-events-none' : ''}`}>
                    <label className="text-[10px] uppercase font-bold opacity-50">Active Key {settings.rgbMode && '(RGB)'}</label>
                    <input 
                      type="color" 
                      value={settings.activeColor} 
                      onChange={(e) => updateSetting('activeColor', e.target.value)}
                      className="w-full h-8 bg-transparent border-none cursor-pointer"
                    />
                  </div>

                  {/* Glow Color */}
                  <div className={`flex flex-col gap-1 ${settings.rgbMode ? 'opacity-30 pointer-events-none' : ''}`}>
                    <label className="text-[10px] uppercase font-bold opacity-50">Glow Color {settings.rgbMode && '(RGB)'}</label>
                    <input 
                      type="color" 
                      value={settings.glowColor} 
                      onChange={(e) => updateSetting('glowColor', e.target.value)}
                      className="w-full h-8 bg-transparent border-none cursor-pointer"
                    />
                  </div>

                  {/* Text Colors */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold opacity-50">Text (Inactive)</label>
                      <input 
                        type="color" 
                        value={settings.textColor} 
                        onChange={(e) => updateSetting('textColor', e.target.value)}
                        className="w-full h-8 bg-transparent border-none cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold opacity-50">Text (Active)</label>
                      <input 
                        type="color" 
                        value={settings.activeTextColor} 
                        onChange={(e) => updateSetting('activeTextColor', e.target.value)}
                        className="w-full h-8 bg-transparent border-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Border & Base */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold opacity-50">Border</label>
                      <input 
                        type="color" 
                        value={settings.borderColor} 
                        onChange={(e) => updateSetting('borderColor', e.target.value)}
                        className="w-full h-8 bg-transparent border-none cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold opacity-50">Key Base</label>
                      <input 
                        type="color" 
                        value={settings.baseColor} 
                        onChange={(e) => updateSetting('baseColor', e.target.value)}
                        className="w-full h-8 bg-transparent border-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Effects */}
              <section>
                <div className="flex items-center gap-2 mb-4 opacity-60">
                  <AnimatePresence>
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}>
                      <Sliders className="w-4 h-4" />
                    </motion.div>
                  </AnimatePresence>
                  <span className="text-xs font-bold uppercase tracking-widest">Effects</span>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs opacity-50">Glow Intensity ({settings.glowIntensity})</label>
                    <input 
                      type="range" min="0" max="50" step="1"
                      value={settings.glowIntensity} 
                      onChange={(e) => updateSetting('glowIntensity', parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Scanlines</label>
                    <input 
                      type="checkbox" 
                      checked={settings.scanlines} 
                      onChange={(e) => updateSetting('scanlines', e.target.checked)}
                      className="accent-yellow-400"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Fire Effect</label>
                    <input 
                      type="checkbox" 
                      checked={settings.showFire} 
                      onChange={(e) => updateSetting('showFire', e.target.checked)}
                      className="accent-yellow-400"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs opacity-50">Anim Speed ({settings.animationSpeed}s)</label>
                    <input 
                      type="range" min="0" max="0.5" step="0.01"
                      value={settings.animationSpeed} 
                      onChange={(e) => updateSetting('animationSpeed', parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                  </div>
                </div>
              </section>

              {/* Layout & Style */}
              <section>
                <div className="flex items-center gap-2 mb-4 opacity-60">
                  <Keyboard className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Style</span>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs opacity-50">Border Radius ({settings.borderRadius}px)</label>
                    <input 
                      type="range" min="0" max="20" step="1"
                      value={settings.borderRadius} 
                      onChange={(e) => updateSetting('borderRadius', parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs opacity-50">Key Spacing ({settings.keySpacing}px)</label>
                    <input 
                      type="range" min="0" max="20" step="1"
                      value={settings.keySpacing} 
                      onChange={(e) => updateSetting('keySpacing', parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs opacity-50">Skew Angle ({settings.skewAngle}°)</label>
                    <input 
                      type="range" min="-45" max="45" step="1"
                      value={settings.skewAngle} 
                      onChange={(e) => updateSetting('skewAngle', parseInt(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs opacity-50">Font Family</label>
                    <select 
                      value={settings.fontFamily}
                      onChange={(e) => updateSetting('fontFamily', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded p-2 text-sm outline-none focus:border-yellow-400"
                    >
                      <option value="sans">Inter (Sans)</option>
                      <option value="display">Outfit (Display)</option>
                      <option value="mono">JetBrains Mono</option>
                      <option value="tactical">Space Grotesk (Tactical)</option>
                      <option value="condensed">Bebas Neue (Condensed)</option>
                      <option value="futuristic">Rajdhani (Futuristic)</option>
                      <option value="fira">Fira Code (Modern Mono)</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                onClick={resetSettings}
                className="w-full rounded border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500/20"
              >
                Reset to Defaults
              </button>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5">
              <p className="text-[10px] opacity-30 uppercase tracking-tighter leading-relaxed">
                Tactical Input Overlay v1.1<br/>
                Enhanced Customization Suite<br/>
                © 2026 Tactical Systems
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

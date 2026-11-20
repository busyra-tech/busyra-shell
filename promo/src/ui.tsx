import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Warna brand Djie Shell (sama dengan app & website)
export const C = {
  bg: "#07090D",
  panel: "#0F131A",
  teal: "#3FD0B4",
  blue: "#5B9CF5",
  purple: "#9D7CF2",
  orange: "#F2A65A",
  red: "#F0616D",
  green: "#4ADE80",
  ink: "#E6EDF3",
  ink2: "rgba(230,237,243,0.62)",
  ink3: "rgba(230,237,243,0.38)",
};
export const GRAD = `linear-gradient(120deg, ${C.teal}, ${C.blue} 50%, ${C.purple})`;
export const FONT = `-apple-system, "SF Pro Display", "Helvetica Neue", Inter, sans-serif`;
export const MONO = `"SF Mono", Menlo, "Cascadia Mono", monospace`;

export const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Pegas dengan jeda (frame). */
export const useSpring = (delay = 0, damping = 18, mass = 0.9) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass, stiffness: 120 } });
};

/** Nilai 0→1 linear antara dua frame (dengan easing). */
export const useProgress = (from: number, to: number, e = ease) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
};

/** Latar gelap dengan cahaya gradien bergerak + titik grid, mirip website. */
export const Background: React.FC<{ hue?: number }> = ({ hue = 0 }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const blob = (x: number, y: number, color: string, size: number, phase: number) => (
    <div
      style={{
        position: "absolute",
        left: `${x + Math.sin(t * 0.35 + phase) * 6}%`,
        top: `${y + Math.cos(t * 0.3 + phase) * 6}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        filter: "blur(140px)",
        opacity: 0.32,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      {blob(18, 22, C.teal, 760, 0 + hue)}
      {blob(82, 30, C.purple, 720, 2 + hue)}
      {blob(55, 95, C.blue, 820, 4 + hue)}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Pembungkus scene: fade + sedikit zoom saat masuk & keluar. */
export const Scene: React.FC<{ duration: number; children: React.ReactNode; fade?: number }> = ({ duration, children, fade = 14 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fade, duration - fade, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, fade, duration - fade, duration], [1.03, 1, 1, 0.98], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};

/** Jendela app dengan bayangan, sudut membulat, dan kemiringan 3D. */
export const AppWindow: React.FC<{
  src: string;
  width: number;
  aspect?: number;
  rotateY?: number;
  rotateX?: number;
  style?: React.CSSProperties;
  zoom?: number;
  origin?: string;
  glow?: string;
  position?: string;
}> = ({ src, width, aspect = 1032 / 1600, rotateY = 0, rotateX = 0, style, zoom = 1, origin = "50% 50%", glow = C.teal, position = "50% 50%" }) => (
  <div
    style={{
      width,
      height: width * aspect,
      borderRadius: 22,
      overflow: "hidden",
      transform: `perspective(2200px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
      boxShadow: `0 60px 140px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.09), 0 30px 120px -50px ${glow}`,
      background: C.panel,
      ...style,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: position, transform: `scale(${zoom})`, transformOrigin: origin }}
    />
  </div>
);

/** Judul kinetik: kata demi kata naik dari bawah dengan blur. */
export const Kinetic: React.FC<{ text: string; delay?: number; size?: number; gradientWords?: string[]; weight?: number; stagger?: number; align?: "left" | "center" }> = ({
  text,
  delay = 0,
  size = 84,
  gradientWords = [],
  weight = 800,
  stagger = 3,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, letterSpacing: "-0.04em", lineHeight: 1.04, color: C.ink, textAlign: align }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 16, stiffness: 110 } });
        const bare = (x: string) => x.replace(/[.,!?]/g, "");
        const grad = gradientWords.map(bare).includes(bare(w));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0 0.12em 0.1em 0", verticalAlign: "top" }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - s) * 90}%)`,
                opacity: s,
                filter: `blur(${(1 - s) * 10}px)`,
                ...(grad ? { backgroundImage: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : {}),
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Teks kecil muncul halus. */
export const Fade: React.FC<{ delay?: number; children: React.ReactNode; y?: number; style?: React.CSSProperties }> = ({ delay = 0, children, y = 20, style }) => {
  const s = useSpring(delay, 20);
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * y}px)`, ...style }}>{children}</div>;
};

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; delay?: number }> = ({ children, color = C.teal, delay = 0 }) => (
  <Fade delay={delay}>
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 22, letterSpacing: "0.22em", textTransform: "uppercase", color: C.ink2 }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: color, boxShadow: `0 0 18px ${color}` }} />
      {children}
    </div>
  </Fade>
);

/** Kartu keterangan kecil (pill) dengan ikon emoji/teks. */
export const Callout: React.FC<{ text: string; color?: string; delay?: number; style?: React.CSSProperties; icon?: string }> = ({ text, color = C.teal, delay = 0, style, icon = "●" }) => {
  const s = useSpring(delay, 14);
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 24px",
        borderRadius: 18,
        background: "rgba(16,20,28,0.86)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: `0 24px 60px -20px rgba(0,0,0,0.8), 0 0 40px -18px ${color}`,
        backdropFilter: "blur(12px)",
        fontFamily: FONT,
        fontSize: 26,
        fontWeight: 600,
        color: C.ink,
        transform: `scale(${0.6 + 0.4 * s}) translateY(${(1 - s) * 30}px)`,
        opacity: s,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ color, fontSize: 24 }}>{icon}</span>
      {text}
    </div>
  );
};

/** Kursor mouse yang bergerak antar titik lalu "klik". */
export const Cursor: React.FC<{ path: { f: number; x: number; y: number; click?: boolean }[] }> = ({ path }) => {
  const frame = useCurrentFrame();
  const fs = path.map((p) => p.f);
  const x = interpolate(frame, fs, path.map((p) => p.x), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const y = interpolate(frame, fs, path.map((p) => p.y), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const clickAt = path.filter((p) => p.click).map((p) => p.f);
  const pressed = clickAt.some((f) => frame >= f && frame < f + 6);
  const ring = clickAt.map((f) => frame - f).find((d) => d >= 0 && d < 18);
  const opacity = interpolate(frame, [fs[0], fs[0] + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, pointerEvents: "none" }}>
      {ring !== undefined && (
        <div
          style={{
            position: "absolute",
            left: -26 - ring * 1.4,
            top: -26 - ring * 1.4,
            width: 52 + ring * 2.8,
            height: 52 + ring * 2.8,
            borderRadius: "50%",
            border: `3px solid ${C.teal}`,
            opacity: 1 - ring / 18,
          }}
        />
      )}
      <svg width="40" height="40" viewBox="0 0 24 24" style={{ transform: `scale(${pressed ? 0.85 : 1})`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.6))" }}>
        <path d="M4 2l15 9.5-6.6 1.3L9 19.5z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export const Logo: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile("logo.png")} style={{ width: size, height: size, filter: `drop-shadow(0 20px 50px rgba(63,208,180,0.45))`, ...style }} />
);

export const AppleIcon: React.FC<{ size?: number; color?: string }> = ({ size = 30, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "inline-block", verticalAlign: "-0.12em" }}>
    <path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.2 1-4.1 2.5-1.8 3-.5 7.5 1.2 10 .8 1.2 1.8 2.6 3.1 2.5 1.3 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.6-4zM14 5.2c.7-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4z" />
  </svg>
);

export const WindowsIcon: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: "inline-block", verticalAlign: "-0.1em" }}>
    <path d="M3 5.6 10.4 4.6v6.9H3zM11.4 4.4 21 3v8.5h-9.6zM3 12.5h7.4v6.9L3 18.4zM11.4 12.5H21V21l-9.6-1.4z" />
  </svg>
);

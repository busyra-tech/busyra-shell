import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { AppleIcon, AppWindow, Background, C, Callout, Cursor, Eyebrow, Fade, FONT, GRAD, Kinetic, Logo, MONO, useProgress, useSpring, WindowsIcon } from "./ui";

// Durasi tiap scene (frame, 30 fps). Scene bertumpuk 14 frame agar transisinya crossfade.
const SCENES: [string, number][] = [
  ["problem", 150],
  ["logo", 120],
  ["hosts", 210],
  ["terminal", 180],
  ["sftp", 170],
  ["database", 240],
  ["tools", 190],
  ["security", 160],
  ["platforms", 160],
  ["cta", 190],
];
const OVERLAP = 14;
export const TOTAL = SCENES.reduce((a, [, d]) => a + d, 0) - OVERLAP * (SCENES.length - 1);

export const Promo: React.FC = () => {
  let start = 0;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <Background />
      {SCENES.map(([name, d]) => {
        const from = start;
        start += d - OVERLAP;
        const Comp = COMPONENTS[name];
        return (
          <Sequence key={name} from={from} durationInFrames={d} name={name}>
            <Comp d={d} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

type P = { d: number };
const Wrap: React.FC<{ d: number; children: React.ReactNode }> = ({ d, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, OVERLAP, d - OVERLAP, d], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

// 1. Masalah: terlalu banyak aplikasi
const Problem: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const chips: [string, string, number, number][] = [
    ["Terminal", "⌨", 16, 22],
    ["Klien FTP", "📁", 78, 18],
    ["phpMyAdmin", "🗄", 12, 70],
    ["Catatan password", "🔑", 80, 72],
    ["Proxy & VPN", "🌐", 50, 12],
    ["Tunnel SSH", "⇄", 30, 86],
    ["Snippet di notes", "{ }", 68, 88],
  ];
  const gather = useProgress(d - 40, d - 6);
  return (
    <Wrap d={d}>
      {chips.map(([label, icon, x, y], i) => {
        const s = useSpring(6 + i * 5, 12);
        const wob = Math.sin(frame / 14 + i) * 10;
        const cx = interpolate(gather, [0, 1], [x, 50]);
        const cy = interpolate(gather, [0, 1], [y, 50]);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              transform: `translate(-50%,-50%) translateY(${wob}px) rotate(${Math.sin(i * 2.3) * 6 * (1 - gather)}deg) scale(${s * (1 - gather * 0.7)})`,
              opacity: s * (1 - gather),
              padding: "18px 28px",
              borderRadius: 20,
              background: "rgba(20,24,33,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 30px 60px -20px rgba(0,0,0,0.8)",
              color: C.ink,
              fontSize: 30,
              fontWeight: 600,
              display: "flex",
              gap: 14,
              alignItems: "center",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 30 }}>{icon}</span>
            {label}
          </div>
        );
      })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - gather }}>
        <Kinetic text="Satu server, terlalu banyak aplikasi?" delay={30} size={88} gradientWords={["banyak", "aplikasi?"]} />
      </AbsoluteFill>
    </Wrap>
  );
};

// 2. Logo
const LogoScene: React.FC<P> = ({ d }) => {
  const s = useSpring(0, 11, 0.8);
  const ring = useProgress(0, 40);
  return (
    <Wrap d={d}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "absolute",
            width: 300 + ring * 900,
            height: 300 + ring * 900,
            borderRadius: "50%",
            border: `2px solid ${C.teal}`,
            opacity: 0.5 * (1 - ring),
          }}
        />
        <div style={{ transform: `scale(${0.3 + 0.7 * s}) rotate(${(1 - s) * -20}deg)`, opacity: s, marginBottom: 40 }}>
          <Logo size={220} />
        </div>
        <Kinetic text="Djie Shell" delay={14} size={128} />
        <Fade delay={30} style={{ marginTop: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 36, color: C.ink2 }}>Semua servermu, satu terminal.</div>
        </Fade>
      </AbsoluteFill>
    </Wrap>
  );
};

/** Tata letak fitur: teks kiri + jendela app kanan. */
const FeatureLayout: React.FC<{
  d: number;
  eyebrow: string;
  color?: string;
  title: string;
  grad: string[];
  lines: string[];
  children: React.ReactNode;
}> = ({ d, eyebrow, color = C.teal, title, grad, lines, children }) => (
  <Wrap d={d}>
    <div style={{ position: "absolute", left: 110, top: 0, bottom: 0, width: 640, display: "flex", flexDirection: "column", justifyContent: "center", gap: 30 }}>
      <Eyebrow color={color}>{eyebrow}</Eyebrow>
      <Kinetic text={title} delay={6} size={74} gradientWords={grad} align="left" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
        {lines.map((l, i) => (
          <Fade key={l} delay={26 + i * 8}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", fontSize: 29, color: C.ink2, lineHeight: 1.35 }}>
              <span style={{ color, marginTop: 2 }}>✓</span>
              {l}
            </div>
          </Fade>
        ))}
      </div>
    </div>
    {children}
  </Wrap>
);

/** Jendela yang masuk dari kanan lalu melayang pelan. */
const SlideWindow: React.FC<{ src: string; d: number; width?: number; aspect?: number; zoomTo?: number; origin?: string; glow?: string; top?: number }> = ({
  src,
  d,
  width = 1180,
  aspect,
  zoomTo = 1,
  origin,
  glow,
  top = 160,
}) => {
  const frame = useCurrentFrame();
  const s = useSpring(4, 18);
  const zoom = interpolate(frame, [40, d - 20], [1, zoomTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 820 + (1 - s) * 500, top: top + Math.sin(frame / 40) * 6, opacity: s }}>
      <AppWindow src={src} width={width} aspect={aspect} rotateY={-14 + (1 - s) * -20} rotateX={4} zoom={zoom} origin={origin} glow={glow} />
    </div>
  );
};

// 3. Hosts
const Hosts: React.FC<P> = ({ d }) => (
  <FeatureLayout
    d={d}
    eyebrow="Hosts"
    title="Semua server, rapi dalam satu layar."
    grad={["rapi"]}
    lines={["Grup, tag & warna kartu bebas", "Pilih banyak host, connect sekaligus", "Password, SSH key, atau agent"]}
  >
    <SlideWindow src="hosts.jpg" d={d} />
    <Callout text="Connect semua" icon="⚡" delay={70} style={{ left: 1290, top: 820 }} />
    <Callout text="Production · Staging" icon="▦" color={C.blue} delay={84} style={{ left: 1560, top: 300 }} />
    <Cursor path={[{ f: 50, x: 1900, y: 900 }, { f: 80, x: 1520, y: 560, click: true }, { f: 120, x: 1700, y: 690, click: true }]} />
  </FeatureLayout>
);

// 4. Terminal (SSH + lokal)
const Terminal: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const cmd = "ssh deploy@prod-api";
  const typed = cmd.slice(0, Math.max(0, Math.floor((frame - 40) / 2)));
  return (
    <FeatureLayout
      d={d}
      eyebrow="Terminal"
      color={C.blue}
      title="SSH & terminal lokal, satu tab bar."
      grad={["lokal,"]}
      lines={["zsh di Mac · PowerShell, CMD, WSL di Windows", "Autocomplete dari riwayat & snippet", "7 tema terminal, multi-tab"]}
    >
      <SlideWindow src="local-mac.png" d={d} aspect={903 / 1400} glow={C.blue} />
      <Fade delay={36} style={{ position: "absolute", left: 1000, top: 830 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: C.ink,
            padding: "18px 26px",
            borderRadius: 16,
            background: "rgba(8,10,14,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: `0 30px 80px -20px rgba(0,0,0,0.9), 0 0 50px -20px ${C.blue}`,
          }}
        >
          <span style={{ color: C.green }}>➜</span> <span style={{ color: C.teal }}>~</span> {typed}
          <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: C.teal }}>▍</span>
        </div>
      </Fade>
    </FeatureLayout>
  );
};

// 5. SFTP
const Sftp: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  return (
    <FeatureLayout
      d={d}
      eyebrow="SFTP"
      color={C.teal}
      title="File server, semudah seret & lepas."
      grad={["seret", "lepas."]}
      lines={["Dua panel: lokal ↔ server", "Upload & download folder, paralel", "Progress, kecepatan, chmod"]}
    >
      <SlideWindow src="sftp.jpg" d={d} aspect={838 / 1300} />
      {[0, 1, 2].map((i) => {
        const t = interpolate(frame, [60 + i * 18, 110 + i * 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 1060 + t * 560,
              top: 480 + i * 70 - Math.sin(t * Math.PI) * 120,
              opacity: t > 0 && t < 1 ? 1 : 0,
              fontSize: 48,
              filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.6))",
            }}
          >
            {["📄", "🗂", "🖼"][i]}
          </div>
        );
      })}
      <Callout text="3 file · 12,4 MB/s" icon="⇅" delay={100} style={{ left: 1420, top: 860 }} />
    </FeatureLayout>
  );
};

// 6. Database
const Database: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const swap = interpolate(frame, [130, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <FeatureLayout
      d={d}
      eyebrow="Database"
      color={C.orange}
      title="Database ala phpMyAdmin, di dalam app."
      grad={["phpMyAdmin,"]}
      lines={["MySQL, PostgreSQL, SQL Server, SQLite, Redis, MongoDB", "Cari per kolom: =, LIKE %…%, IN, BETWEEN", "Cari cepat & daftar tabel bisa disembunyikan"]}
    >
      <div style={{ opacity: 1 - swap }}>
        <SlideWindow src="database.jpg" d={d} zoomTo={1.18} origin="78% 45%" glow={C.orange} />
      </div>
      <div style={{ opacity: swap }}>
        <SlideWindow src="database-search.jpg" d={d} glow={C.orange} />
      </div>
      <Cursor path={[{ f: 60, x: 1900, y: 1000 }, { f: 95, x: 1690, y: 700 }, { f: 120, x: 1790, y: 940, click: true }]} />
      <Callout text="“kopi” di semua kolom" icon="⌕" color={C.orange} delay={150} style={{ left: 1300, top: 860 }} />
    </FeatureLayout>
  );
};

// 7. Keychain, tunnel, proxy
const Tools: React.FC<P> = ({ d }) => {
  const cards: [string, string, string, string, number][] = [
    ["keychain.jpg", "SSH Key", "Ed25519 sekali klik", C.orange, 1032 / 1600],
    ["forwarding.jpg", "Port Forwarding", "Local, remote, SOCKS", C.green, 1032 / 1600],
    ["proxy-win.png", "Proxy", "SOCKS5 & HTTP kantor", C.purple, 1640 / 900],
  ];
  return (
    <Wrap d={d}>
      <div style={{ position: "absolute", top: 90, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Eyebrow color={C.purple}>Keychain · Tunnel · Proxy</Eyebrow>
        <Kinetic text="Semua alat jaringan, siap pakai." delay={6} size={74} gradientWords={["siap", "pakai."]} />
      </div>
      <div style={{ position: "absolute", top: 360, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 46 }}>
        {cards.map(([src, title, sub, color, aspect], i) => {
          const s = useSpring(20 + i * 10, 15);
          const w = aspect > 1 ? 300 : 520;
          return (
            <div key={src} style={{ transform: `translateY(${(1 - s) * 140}px)`, opacity: s, display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
              <AppWindow src={src} width={w} aspect={aspect > 1 ? 1.12 : aspect} glow={color} position={aspect > 1 ? "50% 86%" : "50% 50%"} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 34, fontWeight: 700, color: C.ink }}>{title}</div>
                <div style={{ fontSize: 24, color: C.ink2, marginTop: 6 }}>{sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Wrap>
  );
};

// 8. Keamanan
const Security: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const lock = useSpring(4, 10);
  const shackle = interpolate(frame, [40, 56], [-26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const items: [string, string][] = [
    ["Argon2id + XChaCha20-Poly1305", C.teal],
    ["Sync terenkripsi lewat Google Drive-mu", C.blue],
    ["Touch ID · Windows Hello", C.purple],
    ["Tanpa akun, tanpa server kami", C.green],
  ];
  return (
    <Wrap d={d}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
        <div style={{ transform: `scale(${lock})`, opacity: lock, position: "relative", width: 170, height: 190 }}>
          <div
            style={{
              position: "absolute",
              left: 35,
              top: 0 + shackle,
              width: 100,
              height: 110,
              borderRadius: "50px 50px 0 0",
              border: "16px solid #cfd8e3",
              borderBottom: "none",
            }}
          />
          <div style={{ position: "absolute", left: 0, top: 80, width: 170, height: 110, borderRadius: 26, background: GRAD, boxShadow: `0 30px 80px -20px ${C.teal}` }} />
        </div>
        <Kinetic text="Kuncinya cuma kamu yang pegang." delay={20} size={78} gradientWords={["kamu"]} />
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center", maxWidth: 1500 }}>
          {items.map(([t, c], i) => (
            <Fade key={t} delay={50 + i * 7}>
              <div
                style={{
                  padding: "14px 26px",
                  borderRadius: 999,
                  border: `1px solid ${c}55`,
                  background: `${c}14`,
                  color: C.ink,
                  fontSize: 27,
                  fontWeight: 600,
                }}
              >
                {t}
              </div>
            </Fade>
          ))}
        </div>
      </AbsoluteFill>
    </Wrap>
  );
};

// 9. Mac & Windows
const Platforms: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const a = useSpring(6, 16);
  const b = useSpring(16, 16);
  return (
    <Wrap d={d}>
      <div style={{ position: "absolute", top: 90, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Eyebrow color={C.blue}>macOS · Windows</Eyebrow>
        <Kinetic text="Native di Mac & Windows." delay={4} size={80} gradientWords={["Mac", "Windows."]} />
      </div>
      <div style={{ position: "absolute", left: 140, top: 370 + Math.sin(frame / 35) * 6, transform: `translateX(${(1 - a) * -300}px)`, opacity: a }}>
        <AppWindow src="hosts.jpg" width={800} rotateY={12} glow={C.teal} />
        <div style={{ marginTop: 28, textAlign: "center", fontSize: 30, fontWeight: 700, color: C.ink, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}><AppleIcon /> macOS · SwiftUI</div>
      </div>
      <div style={{ position: "absolute", right: 140, top: 370 + Math.cos(frame / 35) * 6, transform: `translateX(${(1 - b) * 300}px)`, opacity: b }}>
        <AppWindow src="db-win.png" width={800} aspect={1640 / 2560} rotateY={-12} glow={C.blue} />
        <div style={{ marginTop: 28, textAlign: "center", fontSize: 30, fontWeight: 700, color: C.ink, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}><WindowsIcon /> Windows · WinUI 3</div>
      </div>
      <Fade delay={40} style={{ position: "absolute", left: 0, right: 0, bottom: 70, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 26, color: C.ink2 }}>Satu inti Rust · vault yang sama di semua perangkat</div>
      </Fade>
    </Wrap>
  );
};

// 10. Ajakan
const Cta: React.FC<P> = ({ d }) => {
  const s = useSpring(0, 12);
  const btn = useSpring(34, 14);
  return (
    <Wrap d={d}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${0.5 + 0.5 * s})`, opacity: s, marginBottom: 30 }}>
          <Logo size={170} />
        </div>
        <Kinetic text="Djie Shell" delay={8} size={120} />
        <Fade delay={22} style={{ marginTop: 16 }}>
          <div style={{ fontSize: 36, color: C.ink2 }}>Gratis · open source · tanpa iklan</div>
        </Fade>
        <div style={{ display: "flex", gap: 26, marginTop: 56, transform: `scale(${0.7 + 0.3 * btn})`, opacity: btn }}>
          <div style={{ padding: "26px 44px", borderRadius: 20, background: GRAD, color: "#06110f", fontSize: 32, fontWeight: 700, boxShadow: `0 30px 70px -20px ${C.teal}`, display: "flex", gap: 14, alignItems: "center" }}>
            <AppleIcon size={32} /> Download untuk Mac
          </div>
          <div style={{ padding: "26px 44px", borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: C.ink, fontSize: 32, fontWeight: 700, display: "flex", gap: 14, alignItems: "center" }}>
            <WindowsIcon size={30} /> Download untuk Windows
          </div>
        </div>
        <Fade delay={56} style={{ marginTop: 48 }}>
          <div style={{ fontFamily: MONO, fontSize: 30, color: C.teal }}>masadjie.github.io/djie-shell</div>
        </Fade>
      </AbsoluteFill>
    </Wrap>
  );
};

const COMPONENTS: Record<string, React.FC<P>> = {
  problem: Problem,
  logo: LogoScene,
  hosts: Hosts,
  terminal: Terminal,
  sftp: Sftp,
  database: Database,
  tools: Tools,
  security: Security,
  platforms: Platforms,
  cta: Cta,
};

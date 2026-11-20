import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import VO from "./vo-durations.json";
import WORDS from "./words.json";
import { AppleIcon, AppWindow, Background, C, Callout, Cursor, Eyebrow, Fade, FONT, GRAD, Kinetic, Logo, MONO, useProgress, useSpring, WindowsIcon } from "./ui";

// Durasi minimum tiap scene (frame, 30 fps); diperpanjang agar narasi (public/vo/*.mp3) muat.
// Scene bertumpuk 14 frame agar transisinya crossfade.
const BASE: [string, number][] = [
  ["chaos", 150],
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
export const OVERLAP = 14;
/** Narasi mulai sekian frame setelah scene muncul. */
export const VO_DELAY = 12;
const SCENES: [string, number][] = BASE.map(([n, d]) => {
  const vo = (VO as Record<string, number>)[n] ?? 0;
  return [n, Math.max(d, Math.ceil(vo * 30) + VO_DELAY + 22 + OVERLAP)];
});
export const TOTAL = SCENES.reduce((a, [, d]) => a + d, 0) - OVERLAP * (SCENES.length - 1);

export const Promo: React.FC = () => {
  let start = 0;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <Background />
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          // Musik memudar di akhir video
          interpolate(f, [0, 20, TOTAL - 90, TOTAL - 4], [0, 0.13, 0.13, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      {SCENES.map(([name, d]) => {
        const from = start;
        start += d - OVERLAP;
        const Comp = COMPONENTS[name];
        return (
          <Sequence key={name} from={from} durationInFrames={d} name={name}>
            <Comp d={d} />
            <Sequence from={VO_DELAY} name={`vo-${name}`}>
              <Audio src={staticFile(`vo/${name}.mp3`)} volume={0.8} />
              <Captions name={name} />
            </Sequence>
            {(SFX[name]?.(d) ?? []).map(([f, sfx, vol], i) => (
              <Sequence key={i} from={Math.max(0, Math.round(f))} name={`sfx-${sfx}`}>
                <Audio src={staticFile(`sfx/${sfx}.mp3`)} volume={Math.min(1, vol * (SFX_GAIN[sfx] ?? 1))} />
              </Sequence>
            ))}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

type P = { d: number };

/** Video vertikal (9:16)? */
export const useV = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

// Caption karaoke: timing tiap kata dari forced alignment ElevenLabs (src/words.json)
export type Word = { w: string; s: number; e: number };
function lines(words: Word[], max: number): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const punct = /[.,!?]$/.test(w.w);
    const rest = words.length - i - 1;
    // Putus di tanda baca atau saat penuh; hindari sisa satu kata sendirian
    if ((punct && cur.length >= 2) || cur.length >= max || (punct && rest === 0)) {
      if (rest === 1 && cur.length < max + 1) return;
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}
export const Captions: React.FC<{ name: string; words?: Record<string, Word[]> }> = ({ name, words: source }) => {
  const frame = useCurrentFrame();
  const v = useV();
  const words = (source ?? (WORDS as Record<string, Word[]>))[name];
  if (!words?.length) return null;
  const t = frame / 30;
  const ls = lines(words, v ? 4 : 6);
  const idx = ls.findIndex((l, i) => {
    const start = l[0].s - 0.08;
    const end = i + 1 < ls.length ? ls[i + 1][0].s - 0.08 : l[l.length - 1].e + 0.5;
    return t >= start && t < end;
  });
  if (idx < 0) return null;
  const line = ls[idx];
  const local = t - (line[0].s - 0.08);
  const end = idx + 1 < ls.length ? ls[idx + 1][0].s - 0.08 : line[line.length - 1].e + 0.5;
  const o = Math.min(1, local / 0.12) * (idx + 1 < ls.length ? 1 : Math.min(1, (end - t) / 0.2));
  const pop = interpolate(local, [0, 0.15], [0.94, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: v ? 250 : 54, pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: v ? 960 : 1560,
          padding: v ? "18px 30px" : "14px 30px",
          borderRadius: 20,
          background: "rgba(5,7,10,0.74)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(10px)",
          fontFamily: FONT,
          fontSize: v ? 56 : 42,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          textAlign: "center",
          lineHeight: 1.22,
          opacity: o,
          transform: `scale(${pop})`,
          boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)",
        }}
      >
        {line.map((w, i) => {
          const active = t >= w.s - 0.03 && t < w.e + 0.05;
          const spoken = t >= w.e;
          return (
            <span key={i} style={{ color: active ? C.teal : spoken ? "#fff" : "rgba(255,255,255,0.55)", transition: "none" }}>
              {w.w}
              {i < line.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
export const Wrap: React.FC<{ d: number; children: React.ReactNode }> = ({ d, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, OVERLAP, d - OVERLAP, d], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

// Efek suara per scene: [frame relatif scene, nama file di public/sfx, volume]
export type Cue = [number, string, number];
/** Penyeimbang level tiap file SFX (riser & whoosh hasil generator jauh lebih keras). */
export const SFX_GAIN: Record<string, number> = { riser: 0.35, whoosh: 0.45, typing: 0.7, error: 0.7, lock: 0.7, pop: 0.9, ding: 0.8, click: 0.9 };
const SFX: Record<string, (d: number) => Cue[]> = {
  chaos: (d) => [
    ...TERMS.map((_, i): Cue => [TERM_AT(i), i % 3 === 1 ? "error" : "pop", i % 3 === 1 ? 0.35 : 0.4]),
    ...NOTES.map((_, i): Cue => [NOTE_AT(i), "pop", 0.35]),
    [d - 95, "error", 0.4],
    [d - 22, "whoosh", 0.5],
  ],
  problem: (d) => [...[0, 1, 2, 3, 4, 5, 6].map((i): Cue => [6 + i * 5, "pop", 0.3]), [d - 42, "whoosh", 0.55]],
  logo: () => [[0, "riser", 0.6], [16, "ding", 0.35]],
  hosts: () => [[2, "whoosh", 0.45], [70, "pop", 0.4], [80, "click", 0.6], [84, "pop", 0.35], [120, "click", 0.6]],
  terminal: () => [[2, "whoosh", 0.45], [38, "typing", 0.45]],
  sftp: () => [[2, "whoosh", 0.45], [60, "whoosh", 0.25], [78, "whoosh", 0.25], [96, "whoosh", 0.25], [100, "pop", 0.4]],
  database: () => [[2, "whoosh", 0.45], [120, "click", 0.6], [130, "whoosh", 0.3], [150, "pop", 0.4]],
  tools: () => [[6, "whoosh", 0.4], [20, "pop", 0.35], [30, "pop", 0.35], [40, "pop", 0.35]],
  security: () => [[4, "whoosh", 0.35], [52, "lock", 0.7], [50, "pop", 0.25], [64, "pop", 0.25]],
  platforms: () => [[6, "whoosh", 0.45], [16, "whoosh", 0.35]],
  cta: () => [[0, "riser", 0.45], [34, "pop", 0.45], [56, "ding", 0.4]],
};

// 0. Hook: ribetnya ngurus banyak server — terminal di mana-mana, error, password tercecer
const TERMS: [number, number, number, string, string, string][] = [
  // x%, y%, rotasi, judul, baris 1, baris error/terakhir
  [14, 20, -4, "root@10.0.1.10", "$ ssh root@10.0.1.10", "ssh: connect to host 10.0.1.10 port 22: Connection timed out"],
  [52, 14, 3, "deploy@staging", "deploy@staging's password:", "Permission denied, please try again."],
  [80, 30, -2, "admin@db-prod", "$ ssh -i ~/keys/old.pem admin@db-prod", "Permission denied (publickey)."],
  [26, 58, 2, "ubuntu@api-2", "$ ssh ubuntu@api-2", "Host key verification failed."],
  [62, 52, -3, "root@10.0.3.7", "root@10.0.3.7's password:", "Too many authentication failures"],
  [42, 82, 4, "pi@homelab", "$ ssh pi@192.168.1.5 -p 2222", "Could not resolve hostname"],
  [86, 76, -5, "ec2-user@web-1", "$ ssh -i ???.pem ec2-user@web-1", "Warning: Identity file ???.pem not accessible"],
  [10, 86, 3, "root@vps-lama", "$ ssh root@103.21.xx.xx", "Connection refused"],
];
const NOTES: [number, number, number, string][] = [
  [30, 36, -7, "prod-db: 10.0.1.20\npw: ???"],
  [72, 62, 6, "pw staging\nada di grup WA"],
  [50, 70, -4, "key .pem-nya\ndi laptop siapa?"],
];
// Posisi untuk video vertikal (x%, y%)
const TERMS_V: [number, number][] = [[30, 10], [70, 17], [34, 27], [66, 38], [32, 50], [68, 61], [30, 72], [66, 82]];
const NOTES_V: [number, number][] = [[74, 30], [24, 41], [72, 70]];
const TERM_AT = (i: number) => 6 + i * 11;
const NOTE_AT = (i: number) => 70 + i * 14;

const Chaos: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const v = useV();
  const textAt = d - 95;
  const dim = interpolate(frame, [textAt - 10, textAt + 10], [1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Wrap d={d}>
      <AbsoluteFill style={{ opacity: dim }}>
        {TERMS.map(([hx, hy, rot, title, l1, l2], i) => {
          const [x, y] = v ? TERMS_V[i] : [hx, hy];
          const at = TERM_AT(i);
          const s = useSpring(at, 11);
          const shake = frame >= at && frame < at + 10 ? Math.sin((frame - at) * 2.6) * (10 - (frame - at)) * 0.8 : 0;
          const showErr = frame > at + 12;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: v ? 500 : 520,
                transform: `translate(-50%,-50%) translateX(${shake}px) rotate(${rot}deg) scale(${(0.5 + 0.5 * s) * (v ? 0.92 : 1)})`,
                opacity: s,
                borderRadius: 14,
                overflow: "hidden",
                background: "rgba(10,12,16,0.96)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 30px 70px -20px rgba(0,0,0,0.9)",
                fontFamily: MONO,
                fontSize: 17,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", background: "rgba(255,255,255,0.05)", color: C.ink3, fontSize: 14 }}>
                {[C.red, C.orange, C.green].map((c) => (
                  <span key={c} style={{ width: 10, height: 10, borderRadius: 5, background: c }} />
                ))}
                <span style={{ marginLeft: 8 }}>{title}</span>
              </div>
              <div style={{ padding: "12px 14px 14px", lineHeight: 1.5 }}>
                <div style={{ color: C.ink2 }}>{l1}</div>
                <div style={{ color: showErr ? C.red : "transparent" }}>{l2}</div>
              </div>
            </div>
          );
        })}
        {NOTES.map(([hx, hy, rot, text], i) => {
          const [x, y] = v ? NOTES_V[i] : [hx, hy];
          const s = useSpring(NOTE_AT(i), 10);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${1.4 - 0.4 * s})`,
                opacity: s,
                width: 250,
                padding: "22px 20px",
                background: "linear-gradient(160deg, #FFE58A, #F7CF4C)",
                color: "#3b2f00",
                fontFamily: '"Marker Felt", "Comic Sans MS", cursive',
                fontSize: 27,
                lineHeight: 1.25,
                whiteSpace: "pre-line",
                boxShadow: "0 24px 40px -12px rgba(0,0,0,0.7)",
              }}
            >
              {text}
            </div>
          );
        })}
      </AbsoluteFill>
      {frame >= textAt - 4 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
          <Kinetic text="Ribet, kan?" delay={textAt} size={v ? 140 : 150} gradientWords={["Ribet,"]} />
          <Fade delay={textAt + 14}>
            <div style={{ fontFamily: MONO, fontSize: v ? 34 : 32, color: C.ink2, textAlign: "center", maxWidth: v ? 820 : undefined, lineHeight: 1.4 }}>12 server · 12 password · akses SSH di mana-mana</div>
          </Fade>
        </AbsoluteFill>
      )}
    </Wrap>
  );
};

// 1. Masalah: terlalu banyak aplikasi
const Problem: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const v = useV();
  const chips: [string, string, number, number][] = v
    ? [
        ["Terminal", "⌨", 28, 14],
        ["Klien FTP", "📁", 72, 22],
        ["phpMyAdmin", "🗄", 30, 31],
        ["Catatan password", "🔑", 64, 62],
        ["Proxy & VPN", "🌐", 72, 70],
        ["Tunnel SSH", "⇄", 28, 67],
        ["Snippet di notes", "{ }", 50, 90],
      ]
    : [
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
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - gather, padding: v ? "0 70px" : 0 }}>
        <Kinetic text="Satu server, terlalu banyak aplikasi?" delay={30} size={v ? 92 : 88} gradientWords={["banyak", "aplikasi?"]} />
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
export const FeatureLayout: React.FC<{
  d: number;
  eyebrow: string;
  color?: string;
  title: string;
  grad: string[];
  lines: string[];
  children: React.ReactNode;
}> = ({ d, eyebrow, color = C.teal, title, grad, lines, children }) => {
  const v = useV();
  const bullets = (
    <div style={{ display: "flex", flexDirection: "column", gap: v ? 14 : 16, marginTop: 8 }}>
      {lines.map((l, i) => (
        <Fade key={l} delay={26 + i * 8}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", fontSize: v ? 32 : 29, color: C.ink2, lineHeight: 1.35 }}>
            <span style={{ color, marginTop: 2 }}>✓</span>
            {l}
          </div>
        </Fade>
      ))}
    </div>
  );
  if (v)
    return (
      <Wrap d={d}>
        <div style={{ position: "absolute", left: 70, right: 70, top: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
          <Eyebrow color={color}>{eyebrow}</Eyebrow>
          <Kinetic text={title} delay={6} size={78} gradientWords={grad} align="center" />
        </div>
        <div style={{ position: "absolute", left: 100, right: 100, top: 1250 }}>{bullets}</div>
        {children}
      </Wrap>
    );
  return (
    <Wrap d={d}>
      <div style={{ position: "absolute", left: 110, top: 0, bottom: 0, width: 640, display: "flex", flexDirection: "column", justifyContent: "center", gap: 30 }}>
        <Eyebrow color={color}>{eyebrow}</Eyebrow>
        <Kinetic text={title} delay={6} size={74} gradientWords={grad} align="left" />
        {bullets}
      </div>
      {children}
    </Wrap>
  );
};

/** Jendela yang masuk dari kanan lalu melayang pelan. */
export const SlideWindow: React.FC<{ src: string; d: number; width?: number; aspect?: number; zoomTo?: number; origin?: string; glow?: string; top?: number }> = ({
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
  const v = useV();
  const s = useSpring(4, 18);
  const zoom = interpolate(frame, [40, d - 20], [1, zoomTo], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (v) {
    // Vertikal: jendela di tengah, masuk dari bawah
    return (
      <div style={{ position: "absolute", left: 40, top: 560 + (1 - s) * 260 + Math.sin(frame / 40) * 6, opacity: s }}>
        <AppWindow src={src} width={1000} aspect={aspect} rotateX={6 - s * 3} zoom={zoom} origin={origin} glow={glow} />
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: 820 + (1 - s) * 500, top: top + Math.sin(frame / 40) * 6, opacity: s }}>
      <AppWindow src={src} width={width} aspect={aspect} rotateY={-14 + (1 - s) * -20} rotateX={4} zoom={zoom} origin={origin} glow={glow} />
    </div>
  );
};

// 3. Hosts
const Hosts: React.FC<P> = ({ d }) => {
  const v = useV();
  return (
  <FeatureLayout
    d={d}
    eyebrow="Hosts"
    title="Semua server, rapi dalam satu layar."
    grad={["rapi"]}
    lines={["Grup, tag & warna kartu bebas", "Pilih banyak host, connect sekaligus", "Password, SSH key, atau agent"]}
  >
    <SlideWindow src="hosts.jpg" d={d} />
    <Callout text="Connect semua" icon="⚡" delay={70} style={v ? { left: 560, top: 1080 } : { left: 1290, top: 820 }} />
    <Callout text="Production · Staging" icon="▦" color={C.blue} delay={84} style={v ? { left: 90, top: 520 } : { left: 1560, top: 300 }} />
    {!v && <Cursor path={[{ f: 50, x: 1900, y: 900 }, { f: 80, x: 1520, y: 560, click: true }, { f: 120, x: 1700, y: 690, click: true }]} />}
  </FeatureLayout>
  );
};

// 4. Terminal (SSH + lokal)
const Terminal: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const v = useV();
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
      <Fade delay={36} style={{ position: "absolute", left: v ? 150 : 1000, top: v ? 1060 : 830 }}>
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
  const v = useV();
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
              left: v ? 200 + t * 600 : 1060 + t * 560,
              top: (v ? 760 : 480) + i * 70 - Math.sin(t * Math.PI) * 120,
              opacity: t > 0 && t < 1 ? 1 : 0,
              fontSize: 48,
              filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.6))",
            }}
          >
            {["📄", "🗂", "🖼"][i]}
          </div>
        );
      })}
      <Callout text="3 file · 12,4 MB/s" icon="⇅" delay={100} style={v ? { left: 560, top: 1060 } : { left: 1420, top: 860 }} />
    </FeatureLayout>
  );
};

// 6. Database
const Database: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const v = useV();
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
      {!v && <Cursor path={[{ f: 60, x: 1900, y: 1000 }, { f: 95, x: 1690, y: 700 }, { f: 120, x: 1790, y: 940, click: true }]} />}
      <Callout text="“kopi” di semua kolom" icon="⌕" color={C.orange} delay={150} style={v ? { left: 480, top: 1080 } : { left: 1300, top: 860 }} />
    </FeatureLayout>
  );
};

// 7. Keychain, tunnel, proxy
const Tools: React.FC<P> = ({ d }) => {
  const v = useV();
  const cards: [string, string, string, string, number][] = [
    ["keychain.jpg", "SSH Key", "Ed25519 sekali klik", C.orange, 1032 / 1600],
    ["forwarding.jpg", "Port Forwarding", "Local, remote, SOCKS", C.green, 1032 / 1600],
    ["proxy-win.png", "Proxy", "SOCKS5 & HTTP kantor", C.purple, 1640 / 900],
  ];
  return (
    <Wrap d={d}>
      <div style={{ position: "absolute", top: v ? 150 : 90, left: v ? 70 : 0, right: v ? 70 : 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Eyebrow color={C.purple}>Keychain · Tunnel · Proxy</Eyebrow>
        <Kinetic text="Semua alat jaringan, siap pakai." delay={6} size={v ? 78 : 74} gradientWords={["siap", "pakai."]} />
      </div>
      <div
        style={{
          position: "absolute",
          top: v ? 520 : 360,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: v ? "column" : "row",
          justifyContent: "center",
          alignItems: v ? "center" : "flex-start",
          gap: v ? 34 : 46,
        }}
      >
        {cards.map(([src, title, sub, color, aspect], i) => {
          const s = useSpring(20 + i * 10, 15);
          const w = v ? (aspect > 1 ? 240 : 440) : aspect > 1 ? 300 : 520;
          return (
            <div
              key={src}
              style={{
                transform: `translateY(${(1 - s) * 140}px)`,
                opacity: s,
                display: "flex",
                flexDirection: v ? "row" : "column",
                gap: v ? 34 : 22,
                alignItems: "center",
                width: v ? 900 : undefined,
              }}
            >
              <AppWindow src={src} width={w} aspect={aspect > 1 ? 1.12 : aspect} glow={color} position={aspect > 1 ? "50% 86%" : "50% 50%"} />
              <div style={{ textAlign: v ? "left" : "center" }}>
                <div style={{ fontSize: v ? 40 : 34, fontWeight: 700, color: C.ink }}>{title}</div>
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
  const v = useV();
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
      <AbsoluteFill style={{ alignItems: "center", justifyContent: v ? "flex-start" : "center", gap: 40, padding: v ? "330px 70px 0" : 0 }}>
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
        <Kinetic text="Kuncinya cuma kamu yang pegang." delay={20} size={v ? 84 : 78} gradientWords={["kamu"]} />
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center", maxWidth: v ? 900 : 1500, flexDirection: v ? "column" : "row", alignItems: "center" }}>
          {items.map(([t, c], i) => (
            <Fade key={t} delay={50 + i * 7}>
              <div
                style={{
                  padding: "14px 26px",
                  borderRadius: 999,
                  border: `1px solid ${c}55`,
                  background: `${c}14`,
                  color: C.ink,
                  fontSize: v ? 32 : 27,
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
  const v = useV();
  const a = useSpring(6, 16);
  const b = useSpring(16, 16);
  const label = { marginTop: 22, textAlign: "center" as const, fontSize: 30, fontWeight: 700, color: C.ink, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" };
  if (v)
    return (
      <Wrap d={d}>
        <div style={{ position: "absolute", top: 150, left: 70, right: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <Eyebrow color={C.blue}>macOS · Windows</Eyebrow>
          <Kinetic text="Native di Mac & Windows." delay={4} size={82} gradientWords={["Mac", "Windows."]} />
        </div>
        <div style={{ position: "absolute", left: 150, top: 420 + Math.sin(frame / 35) * 6, transform: `translateX(${(1 - a) * -300}px)`, opacity: a }}>
          <AppWindow src="hosts.jpg" width={780} glow={C.teal} />
          <div style={label}><AppleIcon /> macOS · SwiftUI</div>
        </div>
        <div style={{ position: "absolute", left: 150, top: 1010 + Math.cos(frame / 35) * 6, transform: `translateX(${(1 - b) * 300}px)`, opacity: b }}>
          <AppWindow src="db-win.png" width={780} aspect={1640 / 2560} glow={C.blue} />
          <div style={label}><WindowsIcon /> Windows · WinUI 3</div>
        </div>
      </Wrap>
    );
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
  const v = useV();
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
          <div style={{ fontSize: v ? 40 : 36, color: C.ink2 }}>Gratis · open source · tanpa iklan</div>
        </Fade>
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", gap: 26, marginTop: 56, transform: `scale(${0.7 + 0.3 * btn})`, opacity: btn }}>
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
  chaos: Chaos,
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

import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import VO from "./vo-durations-v04.json";
import WORDS from "./words-v04.json";
import { Captions, Cue, FeatureLayout, OVERLAP, SFX_GAIN, SlideWindow, useV, VO_DELAY, Word, Wrap } from "./Promo";
import { AppleIcon, AppWindow, Background, C, Callout, Eyebrow, Fade, FONT, GRAD, Kinetic, Logo, MONO, useProgress, useSpring, WindowsIcon } from "./ui";

// Video pengenalan update Djie Shell 0.4: Server Lokal, Tim, edit file SFTP.
const BASE: [string, number][] = [
  ["u_intro", 150],
  ["u_local", 220],
  ["u_team", 210],
  ["u_sftp", 210],
  ["u_cta", 170],
];
const SCENES: [string, number][] = BASE.map(([n, d]) => {
  const vo = (VO as Record<string, number>)[n] ?? 0;
  return [n, Math.max(d, Math.ceil(vo * 30) + VO_DELAY + 26 + OVERLAP)];
});
export const UPDATE_TOTAL = SCENES.reduce((a, [, d]) => a + d, 0) - OVERLAP * (SCENES.length - 1);

type P = { d: number };

export const Update: React.FC = () => {
  let start = 0;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <Background hue={1.3} />
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) => interpolate(f, [0, 20, UPDATE_TOTAL - 80, UPDATE_TOTAL - 4], [0, 0.13, 0.13, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
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
              <Captions name={name} words={WORDS as Record<string, Word[]>} />
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

const SFX: Record<string, (d: number) => Cue[]> = {
  u_intro: () => [[0, "riser", 0.6], [18, "ding", 0.35], [88, "pop", 0.4], [98, "pop", 0.4], [108, "pop", 0.4]],
  u_local: () => [[2, "whoosh", 0.45], [272, "click", 0.6], [345, "pop", 0.45], [349, "ding", 0.35], [362, "pop", 0.35]],
  u_team: () => [[2, "whoosh", 0.45], [20, "whoosh", 0.35], [118, "whoosh", 0.4], [152, "pop", 0.45], [252, "lock", 0.6]],
  u_sftp: () => [[2, "whoosh", 0.45], [165, "click", 0.6], [170, "pop", 0.35], [190, "typing", 0.4], [256, "ding", 0.4]],
  u_cta: () => [[0, "riser", 0.45], [34, "pop", 0.45], [56, "ding", 0.4]],
};

const FEATURES: [string, string, string][] = [
  ["🧱", "Server Lokal", C.orange],
  ["👥", "Tim", C.green],
  ["📝", "Edit file SFTP", C.teal],
];

// 0. Pembuka: "Djie Shell 0.4" + tiga fitur baru
const Intro: React.FC<P> = ({ d }) => {
  const v = useV();
  const s = useSpring(0, 11, 0.8);
  const ring = useProgress(0, 40);
  const badge = useSpring(26, 12);
  return (
    <Wrap d={d}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 300 + ring * 900, height: 300 + ring * 900, borderRadius: "50%", border: `2px solid ${C.teal}`, opacity: 0.5 * (1 - ring) }} />
        <div style={{ transform: `scale(${0.3 + 0.7 * s}) rotate(${(1 - s) * -20}deg)`, opacity: s, marginBottom: 34 }}>
          <Logo size={v ? 200 : 180} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexDirection: v ? "column" : "row" }}>
          <Kinetic text="Djie Shell" delay={12} size={v ? 120 : 124} />
          <div
            style={{
              transform: `scale(${0.4 + 0.6 * badge}) rotate(${(1 - badge) * 12}deg)`,
              opacity: badge,
              padding: v ? "12px 30px" : "10px 28px",
              borderRadius: 999,
              background: GRAD,
              color: "#06110f",
              fontFamily: MONO,
              fontWeight: 800,
              fontSize: v ? 64 : 62,
              boxShadow: `0 20px 60px -20px ${C.teal}`,
            }}
          >
            v0.4
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: v ? "column" : "row", gap: v ? 22 : 26, marginTop: v ? 70 : 64, alignItems: "center" }}>
          {FEATURES.map(([icon, label, color], i) => {
            const c = useSpring(88 + i * 10, 13);
            return (
              <div
                key={label}
                style={{
                  transform: `translateY(${(1 - c) * 40}px) scale(${0.8 + 0.2 * c})`,
                  opacity: c,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: v ? "22px 36px" : "18px 30px",
                  borderRadius: 20,
                  background: "rgba(16,20,28,0.86)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: `0 24px 60px -24px rgba(0,0,0,0.9), 0 0 44px -20px ${color}`,
                  fontSize: v ? 40 : 32,
                  fontWeight: 700,
                  color: C.ink,
                }}
              >
                <span>{icon}</span>
                {label}
                <span style={{ fontFamily: MONO, fontSize: v ? 22 : 18, color, letterSpacing: "0.14em", marginLeft: 6 }}>BARU</span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Wrap>
  );
};

/** Kartu unduhan komponen: progress bar terisi lalu centang. */
const DownloadPill: React.FC<{ at: number; done: number; style: React.CSSProperties }> = ({ at, done, style }) => {
  const frame = useCurrentFrame();
  const s = useSpring(at, 14);
  const p = interpolate(frame, [at + 8, done], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ok = frame >= done;
  return (
    <div
      style={{
        position: "absolute",
        width: 470,
        padding: "20px 24px",
        borderRadius: 20,
        background: "rgba(16,20,28,0.9)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: `0 30px 70px -20px rgba(0,0,0,0.9), 0 0 50px -20px ${ok ? C.green : C.blue}`,
        opacity: s,
        transform: `scale(${0.7 + 0.3 * s}) translateY(${(1 - s) * 30}px)`,
        fontFamily: FONT,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 700, color: C.ink }}>
        <span style={{ color: ok ? C.green : C.blue }}>{ok ? "✓" : "↓"}</span>
        {ok ? "MySQL 8.4 · Berjalan" : "Mengunduh MySQL 8.4"}
      </div>
      <div style={{ marginTop: 14, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: ok ? C.green : GRAD, borderRadius: 5 }} />
      </div>
      <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 18, color: C.ink2 }}>
        {ok ? "127.0.0.1:3306 · user root" : `${Math.round(p * 160)} / 160 MB`}
      </div>
    </div>
  );
};

// 1. Server Lokal
const Local: React.FC<P> = ({ d }) => {
  const v = useV();
  return (
    <FeatureLayout
      d={d}
      eyebrow="Baru · Server Lokal"
      color={C.orange}
      title="Server lokal, sekali klik."
      grad={["sekali", "klik."]}
      lines={["Apache atau Nginx + PHP 8.4", "MySQL · PostgreSQL · MongoDB", "Diunduh otomatis, tanpa install manual"]}
    >
      <SlideWindow src="local-server.jpg" d={d} aspect={900 / 1600} glow={C.orange} top={200} />
      <DownloadPill at={270} done={345} style={v ? { left: 300, top: 1060 } : { left: 1310, top: 760 }} />
      <Callout text="localhost:8080 · PHP 8.4" icon="●" color={C.green} delay={360} style={v ? { left: 120, top: 470 } : { left: 1480, top: 140 }} />
    </FeatureLayout>
  );
};

// 2. Tim: admin di Mac mengundang, anggota di Windows menerima host
const Team: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const v = useV();
  const a = useSpring(8, 16);
  const b = useSpring(20, 16);
  const fly = interpolate(frame, [118, 152], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const label = { marginTop: 22, textAlign: "center" as const, fontSize: 28, fontWeight: 700, color: C.ink, display: "flex", gap: 12, justifyContent: "center", alignItems: "center" };
  const envelope = (
    <div
      style={{
        position: "absolute",
        left: v ? 470 : 860 + fly * 200,
        top: v ? 760 + fly * 240 - Math.sin(fly * Math.PI) * 60 : 520 - Math.sin(fly * Math.PI) * 160,
        fontSize: 84,
        opacity: fly > 0 && fly < 1 ? 1 : 0,
        transform: `rotate(${(fly - 0.5) * 30}deg)`,
        filter: "drop-shadow(0 16px 30px rgba(0,0,0,0.7))",
      }}
    >
      ✉️
    </div>
  );
  const lock = (
    <Callout
      text="Terenkripsi end-to-end"
      icon="🔒"
      color={C.green}
      delay={250}
      style={v ? { left: 330, top: 1006 } : { left: 770, top: 236 }}
    />
  );
  if (v)
    return (
      <Wrap d={d}>
        <div style={{ position: "absolute", top: 150, left: 70, right: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, textAlign: "center" }}>
          <Eyebrow color={C.green}>Baru · Tim</Eyebrow>
          <Kinetic text="Bagikan server ke tim, lewat email." delay={6} size={74} gradientWords={["tim,"]} />
        </div>
        <div style={{ position: "absolute", left: 180, top: 470 + Math.sin(frame / 35) * 6, transform: `translateX(${(1 - a) * -300}px)`, opacity: a }}>
          <AppWindow src="team.jpg" width={720} aspect={838 / 1300} glow={C.green} />
          <div style={label}><AppleIcon /> Admin mengundang</div>
        </div>
        <div style={{ position: "absolute", left: 180, top: 1070 + Math.cos(frame / 35) * 6, transform: `translateX(${(1 - b) * 300}px)`, opacity: b }}>
          <AppWindow src="team-win.jpg" width={720} aspect={1026 / 1600} glow={C.blue} />
          <div style={label}><WindowsIcon /> Rekan langsung dapat host</div>
        </div>
        {envelope}
        {lock}
      </Wrap>
    );
  return (
    <Wrap d={d}>
      <div style={{ position: "absolute", top: 80, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Eyebrow color={C.green}>Baru · Tim</Eyebrow>
        <Kinetic text="Bagikan server ke tim, lewat email." delay={6} size={72} gradientWords={["tim,"]} />
      </div>
      <div style={{ position: "absolute", left: 120, top: 330 + Math.sin(frame / 35) * 6, transform: `translateX(${(1 - a) * -300}px)`, opacity: a }}>
        <AppWindow src="team.jpg" width={760} aspect={838 / 1300} rotateY={12} glow={C.green} />
        <div style={label}><AppleIcon /> Admin mengundang</div>
      </div>
      <div style={{ position: "absolute", right: 120, top: 330 + Math.cos(frame / 35) * 6, transform: `translateX(${(1 - b) * 300}px)`, opacity: b }}>
        <AppWindow src="team-win.jpg" width={760} aspect={1026 / 1600} rotateY={-12} glow={C.blue} />
        <div style={label}><WindowsIcon /> Rekan langsung dapat host</div>
      </div>
      {envelope}
      {lock}
    </Wrap>
  );
};

// 3. SFTP: editor bawaan & buka dengan VS Code
const Sftp: React.FC<P> = ({ d }) => {
  const frame = useCurrentFrame();
  const v = useV();
  const line = "listen 443 ssl;";
  const typed = line.slice(0, Math.max(0, Math.floor((frame - 190) / 2)));
  return (
    <FeatureLayout
      d={d}
      eyebrow="Baru · SFTP"
      color={C.teal}
      title="Edit file langsung di server."
      grad={["langsung"]}
      lines={["Editor bawaan · nomor baris · cari", "Buka dengan VS Code, Sublime, Notepad++", "Simpan → otomatis ter-upload"]}
    >
      <SlideWindow src="sftp-editor.jpg" d={d} glow={C.teal} />
      <Callout text="Buka dengan VS Code" icon="↗" color={C.blue} delay={165} style={v ? { left: 90, top: 470 } : { left: 1440, top: 120 }} />
      <Fade delay={182} style={{ position: "absolute", left: v ? 140 : 1000, top: v ? 1080 : 800 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 28,
            color: C.ink,
            padding: "16px 24px",
            borderRadius: 14,
            background: "rgba(8,10,14,0.94)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: `0 30px 80px -20px rgba(0,0,0,0.9), 0 0 50px -20px ${C.teal}`,
          }}
        >
          <span style={{ color: C.ink3 }}>17 </span>
          <span style={{ color: C.purple }}>{typed}</span>
          <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: C.teal }}>▍</span>
        </div>
      </Fade>
      <Callout text="Tersimpan otomatis ke server" icon="✓" color={C.green} delay={255} style={v ? { left: 560, top: 1088 } : { left: 1300, top: 900 }} />
    </FeatureLayout>
  );
};

// 4. Ajakan update
const Cta: React.FC<P> = ({ d }) => {
  const v = useV();
  const s = useSpring(0, 12);
  const btn = useSpring(34, 14);
  return (
    <Wrap d={d}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${0.5 + 0.5 * s})`, opacity: s, marginBottom: 30 }}>
          <Logo size={160} />
        </div>
        <Kinetic text="Djie Shell 0.4" delay={8} size={v ? 110 : 116} gradientWords={["0.4"]} />
        <Fade delay={22} style={{ marginTop: 16 }}>
          <div style={{ fontSize: v ? 38 : 34, color: C.ink2 }}>Server Lokal · Tim · Edit file SFTP</div>
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
  u_intro: Intro,
  u_local: Local,
  u_team: Team,
  u_sftp: Sftp,
  u_cta: Cta,
};

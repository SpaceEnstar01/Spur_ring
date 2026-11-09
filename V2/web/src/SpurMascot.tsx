import { useEffect, useRef, useState, type CSSProperties } from "react";
export const palettes = {
  red: ["红色", "#fff1f2", "#ffb4c0", "#f17488", "#ffe1e6"],
  orange: ["橙色", "#fff6e9", "#ffd0a4", "#f1a05b", "#ffe8d1"],
  yellow: ["黄色", "#fffbe9", "#ffe7a2", "#eac65c", "#fff0c2"],
  green: ["绿色", "#f1fff7", "#b4e7c9", "#64bb8b", "#d8f6e3"],
  cyan: ["青色", "#efffff", "#afe9ed", "#65c6d3", "#d5f8fb"],
  blue: ["蓝色", "#ffffff", "#dce7ff", "#92b0ff", "#dbe4ff"],
  purple: ["紫色", "#faf4ff", "#d8c5fa", "#a18ae7", "#e9dfff"],
} as const;
export type MascotColor = keyof typeof palettes;
export function useMascotColor() {
  const [color, setColor] = useState<MascotColor>(() => {
    try {
      const value = localStorage.getItem("spur-mascot-color");
      return value && Object.prototype.hasOwnProperty.call(palettes, value)
        ? (value as MascotColor)
        : "blue";
    } catch {
      return "blue";
    }
  });
  function choose(value: MascotColor) {
    setColor(value);
    try {
      localStorage.setItem("spur-mascot-color", value);
    } catch {}
  }
  const c = palettes[color];
  const style = {
    "--mascot-light": c[1],
    "--mascot-mid": c[2],
    "--mascot-main": c[3],
    "--mascot-glow": c[4],
  } as CSSProperties;
  return { color, choose, style };
}
export function SpurMascot({
  color,
  onColor,
}: {
  color: MascotColor;
  onColor: (c: MascotColor) => void;
}) {
  const face = useRef<HTMLDivElement>(null),
    eyes = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      fine = matchMedia("(pointer: fine)");
    let frame = 0,
      reset: ReturnType<typeof setTimeout> | undefined;
    function move(e: PointerEvent) {
      if (media.matches || !fine.matches || e.pointerType === "touch" || frame)
        return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = face.current?.getBoundingClientRect();
        if (!r || !eyes.current) return;
        const x = Math.max(
            -4,
            Math.min(4, (e.clientX - r.left - r.width / 2) / 85)
          ),
          y = Math.max(
            -3,
            Math.min(3, (e.clientY - r.top - r.height / 2) / 85)
          );
        eyes.current.style.transform = `translate(${x}px,${y + 1}px)`;
      });
      clearTimeout(reset);
      reset = setTimeout(() => {
        if (eyes.current) eyes.current.style.transform = "translate(0,1px)";
      }, 1100);
    }
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
      clearTimeout(reset);
    };
  }, []);
  return (
    <>
      <div ref={face} className="spur-mascot" role="img" aria-label="Spur 小球">
        <div ref={eyes} className="mascot-eyes">
          <i />
          <i />
        </div>
      </div>
      <h1>Hi, I'm Spur.</h1>
      <p className="v5-tagline">Every great idea begins with a small intent.</p>
      <div className="color-picker" role="group" aria-label="选择 Spur 的颜色">
        {(Object.keys(palettes) as MascotColor[]).map((name) => (
          <button
            type="button"
            key={name}
            className="color-dot"
            style={{ background: palettes[name][3] }}
            aria-label={palettes[name][0]}
            title={palettes[name][0]}
            aria-pressed={color === name}
            onClick={() => onColor(name)}
          />
        ))}
      </div>
    </>
  );
}

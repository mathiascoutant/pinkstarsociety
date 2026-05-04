import { useEffect, useRef } from "react";

export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (dot.current) {
        dot.current.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      }
      document.documentElement.style.setProperty("--mx", `${mx}px`);
      document.documentElement.style.setProperty("--my", `${my}px`);
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const interactive = t.closest("a,button,[data-cursor='hover']");
      if (ring.current) {
        ring.current.style.width = interactive ? "70px" : "38px";
        ring.current.style.height = interactive ? "70px" : "38px";
        ring.current.style.borderColor = interactive
          ? "rgba(255,43,177,0.9)"
          : "rgba(255,255,255,0.7)";
      }
    };

    const tick = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ring.current) {
        ring.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      }
      requestAnimationFrame(tick);
    };
    tick();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, []);

  return (
    <>
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
      <div className="spotlight" />
    </>
  );
}

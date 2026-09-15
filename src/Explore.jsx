import React, { useEffect, useMemo, useRef, useState } from "react";
import assets from "./community-assets.json";
// Star palette from the Figma star field (node 572-32948): eight hues, each
// reused across the depth tiers rather than one colour per person.
export const STAR_COLORS = [
  "#FF5E6C",
  "#FF9F43",
  "#FFD93D",
  "#39D98A",
  "#2EC5CE",
  "#F15BB5",
  "#4C7DFF",
  "#9B6DFF",
];
// Depth tiers measured off the same frame: dots run 13px down to 3px and
// fade 1.0 to 0.12, labels run 12px down to 5px. The design quantises these
// into discrete steps; interpolating between the end points keeps the
// changes continuous while rotating, which is what the motion calls for.
const DOT_MAX = 13,
  DOT_MIN = 3,
  OPACITY_MAX = 1,
  OPACITY_MIN = 0.12,
  LABEL_MAX = 12,
  LABEL_MIN = 5;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const lerp = (a, b, t) => a + (b - a) * t;
// Even coverage of a sphere without clumping, and deterministic so the
// constellation looks the same on every load.
function spherePoints(count) {
  return Array.from({ length: count }, (_, i) => {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * GOLDEN_ANGLE;
    return [Math.cos(theta) * ring, y, Math.sin(theta) * ring];
  });
}
function project([x, y, z], yaw, pitch) {
  const cosYaw = Math.cos(yaw),
    sinYaw = Math.sin(yaw);
  const x1 = x * cosYaw + z * sinYaw;
  const z1 = -x * sinYaw + z * cosYaw;
  const cosPitch = Math.cos(pitch),
    sinPitch = Math.sin(pitch);
  const y1 = y * cosPitch - z1 * sinPitch;
  const z2 = y * sinPitch + z1 * cosPitch;
  return [x1, y1, z2];
}
// Idle drift in rad/s. 0.12 turns the globe once in roughly 52s: slow enough
// to stay calm behind the labels, fast enough to read as alive. The previous
// floor was re-decayed every frame, which bled it down to about a 12 minute
// revolution — indistinguishable from a static sphere.
const IDLE_SPIN = 0.12;
// Beat after the sphere unfolds before the drift starts, so it settles into
// place first. Deliberately only set once: a throw should coast straight
// into the drift instead of stopping dead the moment the finger lifts.
const IDLE_GRACE = 1400;
export function Planet({ people, active = true, onSelect, onCollapse }) {
  const rootRef = useRef(null);
  const starRefs = useRef([]);
  const points = useMemo(() => spherePoints(people.length), [people.length]);
  const spin = useRef({
    yaw: 0.4,
    pitch: -0.16,
    yawVelocity: 0,
    pitchVelocity: 0,
    dragging: false,
    moved: 0,
    lastY: 0,
    pointerX: 0,
    pointerId: 0,
    captured: false,
    idleAt: 0,
    samples: [],
    box: null,
  });
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  // Layout is measured rather than hard-coded: the preview frame is
  // resizable (375/402/430) and the sphere is sized off its own box.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      spin.current.box = {
        cx: rect.width / 2,
        // The field sits slightly above centre in the design so the labels
        // that hang under each dot stay inside the block.
        cy: rect.height * 0.49,
        r: Math.min(rect.width, rect.height) * 0.42,
      };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const current = spin.current;
    let last = performance.now();
    const frame = (now) => {
      current.raf = requestAnimationFrame(frame);
      // Clamp dt so a backgrounded tab doesn't jump the sphere on return.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!current.idleAt) current.idleAt = now + IDLE_GRACE;
      if (!current.dragging) {
        if (reduced.current) {
          current.yawVelocity = 0;
          current.pitchVelocity = 0;
        } else {
          // Frame-rate independent decay — 0.94 per frame at 60fps, so the
          // coast feels the same on a 120Hz display as on a 60Hz one.
          const decay = Math.pow(0.94, dt * 60);
          current.yawVelocity *= decay;
          current.pitchVelocity *= decay;
          if (now >= current.idleAt) {
            // A thrown sphere coasts down to the drift instead of stalling,
            // because the floor is the drift itself rather than zero — and
            // it keeps whichever direction the gesture was going, so the
            // handoff reads as one continuous motion.
            if (Math.abs(current.yawVelocity) < IDLE_SPIN)
              current.yawVelocity =
                Math.sign(current.yawVelocity || 1) * IDLE_SPIN;
            // Vertical motion still settles flat: a permanent pitch drift
            // would wander into the clamp and tilt the globe off-axis.
            if (Math.abs(current.pitchVelocity) < 0.01)
              current.pitchVelocity = 0;
          }
        }
        current.yaw += current.yawVelocity * dt;
        current.pitch += current.pitchVelocity * dt;
      }
      current.pitch = Math.max(-1.15, Math.min(1.15, current.pitch));
      const box = current.box;
      if (!box) return;
      for (let i = 0; i < points.length; i++) {
        const node = starRefs.current[i];
        if (!node) continue;
        const [x, y, depth] = project(points[i], current.yaw, current.pitch);
        // depth +1 is nearest the viewer, -1 is the far side of the globe.
        const near = (depth + 1) / 2;
        node.style.transform = `translate3d(${(box.cx + x * box.r).toFixed(2)}px, ${(box.cy - y * box.r).toFixed(2)}px, 0)`;
        node.style.zIndex = String(Math.round(near * 40));
        node.style.setProperty("--dot", `${lerp(DOT_MIN, DOT_MAX, near).toFixed(2)}px`);
        node.style.setProperty("--dot-opacity", near.toFixed(3));
        node.style.setProperty("--label-size", `${lerp(LABEL_MIN, LABEL_MAX, near).toFixed(2)}px`);
        // Flat opacity: the design's label colour already carries 0.41 alpha
        // and depth is expressed through the font size alone. Fading it
        // further only made the far labels disappear.
        node.style.setProperty("--label-opacity", "1");
      }
    };
    current.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(current.raf);
  }, [points]);
  function down(e) {
    const current = spin.current;
    current.dragging = true;
    current.moved = 0;
    current.yawVelocity = 0;
    current.pitchVelocity = 0;
    current.captured = false;
    current.pointerId = e.pointerId;
    current.lastY = e.clientY;
    current.pointerX = e.clientX;
    current.samples = [{ time: performance.now(), x: e.clientX, y: e.clientY }];
  }
  function move(e) {
    const current = spin.current;
    if (!current.dragging) return;
    const turn = 0.006;
    const dx = e.clientX - current.pointerX;
    const dy = e.clientY - current.lastY;
    current.moved += Math.abs(dx) + Math.abs(dy);
    current.yaw += dx * turn;
    current.pitch += dy * turn;
    current.pointerX = e.clientX;
    current.lastY = e.clientY;
    // Capture only once the gesture is unmistakably a drag. Capturing on
    // pointerdown retargets the following click to this element and the star
    // buttons never see their own onClick — which is what made the sphere
    // look inert to a tap.
    if (!current.captured && current.moved > 6) {
      current.captured = true;
      try {
        rootRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    }
    // Speed is read off a short trailing window rather than the last event
    // alone. The first move after touch-down often lands a millisecond
    // later, and dividing by that tiny gap invents an enormous speed, which
    // would fling the sphere off on any drag at all.
    const now = performance.now();
    current.samples.push({ time: now, x: e.clientX, y: e.clientY });
    while (current.samples.length > 2 && now - current.samples[0].time > 140)
      current.samples.shift();
    const first = current.samples[0];
    const span = (now - first.time) / 1000;
    if (span >= 0.012) {
      current.yawVelocity = ((e.clientX - first.x) * turn) / span;
      current.pitchVelocity = ((e.clientY - first.y) * turn) / span;
    }
  }
  function up() {
    const current = spin.current;
    if (!current.dragging) return;
    current.dragging = false;
    if (current.captured) {
      current.captured = false;
      try {
        rootRef.current?.releasePointerCapture?.(current.pointerId);
      } catch {
        /* already released */
      }
    }
    // No dead-stop window here on purpose: setting idleAt from the release
    // used to zero the velocity for 3.5s, so every throw died instantly and
    // the sphere then sat frozen before resuming. The drift is slow enough
    // that a star is still an easy target while it turns.
    //
    // Deliberately no flick-to-dismiss here. Speed used to decide whether a
    // drag rotated the sphere or folded it away, which meant the same
    // gesture had two outcomes and a quick rotation kept dismissing the
    // globe by accident. Dismissing now belongs to the list below, so a
    // drag on the sphere can only ever mean one thing: turn it.
  }
  return (
    <div
      className="planet"
      ref={rootRef}
      role="group"
      aria-label="Hi 人物星球，拖动可旋转，下滑下方列表可收起"
      tabIndex={0}
      data-active={active || undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => {
        const current = spin.current;
        const step = 0.12;
        if (e.key === "ArrowLeft") current.yaw += step;
        else if (e.key === "ArrowRight") current.yaw -= step;
        else if (e.key === "ArrowUp") current.pitch -= step;
        else if (e.key === "ArrowDown") current.pitch += step;
        else if (e.key === "Escape") onCollapse?.();
        else return;
        e.preventDefault();
      }}
    >
      {people.map((p, i) => (
        <button
          key={p.id}
          className="planet-star"
          ref={(node) => {
            starRefs.current[i] = node;
          }}
          style={{
            "--star-color": STAR_COLORS[i % STAR_COLORS.length],
            // The design's labels are hand-placed at slightly different
            // offsets around each dot rather than centred on it. A small
            // deterministic scatter keeps that hand-made feel; being a fixed
            // screen offset it still rides along as the sphere turns.
            "--label-x": `${((i * 7) % 11) - 5}px`,
            "--label-y": `${((i * 5) % 9) - 4}px`,
          }}
          aria-label={`认识${p.name}`}
          title={`${p.name} · ${p.reason || ""}`}
          onClick={(e) => {
            // A drag that happens to end on a star must not open it.
            if (e.detail !== 0 && spin.current.moved > 8) return;
            onSelect(
              { ...p, color: STAR_COLORS[i % STAR_COLORS.length] },
              e.currentTarget,
            );
          }}
        >
          <span className="star-light" />
          <span className="star-name">{p.name}</span>
        </button>
      ))}
      <span className="planet-hint">拖动旋转 · 下滑列表收起</span>
    </div>
  );
}
// User-described three-stage interaction. Figma supplies static frames, not keyframes.
export function Encounter({ person, origin, onComplete, onCancel }) {
  const [phase, setPhase] = useState("zoom");
  const completed = useRef(false);
  const root = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    completeRef.current();
  };
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = [
      setTimeout(() => setPhase("traits"), reduce ? 0 : 650),
      setTimeout(() => setPhase("dissolve"), reduce ? 1700 : 2900),
      setTimeout(finish, reduce ? 1900 : 3650),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.querySelector("button")?.focus({ preventScroll: true });
    const handler = (e) => {
      if (e.key === "Escape") cancelRef.current();
      if (e.key === "Tab") {
        const buttons = [...root.current.querySelectorAll("button")];
        if (e.shiftKey && document.activeElement === buttons[0]) {
          e.preventDefault();
          buttons.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === buttons.at(-1)) {
          e.preventDefault();
          buttons[0].focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className={"encounter phase-" + phase}
      ref={root}
      role="dialog"
      aria-modal="true"
      style={{
        "--origin-x": origin.x + "px",
        "--origin-y": origin.y + "px",
        "--encounter-color": person.color || STAR_COLORS[0],
      }}
      aria-label="正在认识新朋友"
    >
      <span className="encounter-source" />
      <div className="encounter-card">
        <h1>{person.name}</h1>
        <span
          className="encounter-haze"
          aria-hidden="true"
          style={{
            "--haze-mask": `url(${assets["reveal-imgEllipse6"]})`,
          }}
        />
        {person.tags.map((t, i) => (
          <span key={t} className={"encounter-trait trait-" + i}>
            {t}
          </span>
        ))}
      </div>
      <p className="sr-only" role="status">
        正在认识{person.name}，{person.tags.join("，")}，即将进入个人资料。
      </p>
      <div className="encounter-controls">
        <button onClick={onCancel}>返回星球</button>
        <button onClick={finish}>查看资料</button>
      </div>
    </div>
  );
}

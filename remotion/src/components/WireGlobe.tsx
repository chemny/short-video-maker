import {useCurrentFrame, useVideoConfig} from 'remotion';

type P3 = {x: number; y: number; z: number};

const rotY = (p: P3, a: number): P3 => ({
  x: p.x * Math.cos(a) + p.z * Math.sin(a),
  y: p.y,
  z: -p.x * Math.sin(a) + p.z * Math.cos(a),
});

const rotX = (p: P3, a: number): P3 => ({
  x: p.x,
  y: p.y * Math.cos(a) - p.z * Math.sin(a),
  z: p.y * Math.sin(a) + p.z * Math.cos(a),
});

/**
 * 线框球体 — 纯 SVG + 帧驱动旋转，无外部依赖。
 * 深度着色：前半球（z>0）不透明度高，后半球低，产生半透明球体感。
 */
export const WireGlobe = ({
  frame: externalFrame,
  cx = 540,
  cy = 500,
  radius = 420,
  color = '#F59E0B',
  maxOpacity = 0.28,
  speed = 0.20,       // rad/s
  tilt = Math.PI / 9, // X 轴倾斜（静态）
  latCount = 9,
  lonCount = 14,
  segments = 72,      // 每条线的分段数
  polarCapDeg = 18,   // 极点附近跳过的角度（消除汇聚）
}: {
  frame?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  color?: string;
  maxOpacity?: number;
  speed?: number;
  tilt?: number;
  latCount?: number;
  lonCount?: number;
  segments?: number;
  polarCapDeg?: number;
}) => {
  const localFrame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frame = externalFrame ?? localFrame;
  const angle = (frame / fps) * speed;

  // 将一个球面点变换到屏幕空间，返回投影坐标和 z 深度
  const xform = (p: P3): P3 & {sx: number; sy: number} => {
    const r1 = rotY(p, angle);
    const r2 = rotX(r1, tilt);
    return {...r2, sx: r2.x + cx, sy: r2.y + cy};
  };

  // 深度 → 线段不透明度：前半球清晰，后半球隐约
  const depthOpacity = (z: number) => {
    const t = (z / radius + 1) / 2; // 0(后) → 1(前)
    return maxOpacity * (0.15 + 0.85 * t);
  };

  type Seg = {x1: number; y1: number; x2: number; y2: number; op: number};
  const segs: Seg[] = [];

  // ── 纬线 ──────────────────────────────────────────────────────────────────
  for (let i = 1; i < latCount; i++) {
    const phi = (i / latCount) * Math.PI;
    const ry = radius * Math.cos(phi);
    const rh = radius * Math.sin(phi);
    let prev = xform({x: rh, y: ry, z: 0});
    for (let j = 1; j <= segments; j++) {
      const theta = (j / segments) * 2 * Math.PI;
      const cur = xform({x: rh * Math.cos(theta), y: ry, z: rh * Math.sin(theta)});
      const midZ = (prev.z + cur.z) / 2;
      segs.push({x1: prev.sx, y1: prev.sy, x2: cur.sx, y2: cur.sy, op: depthOpacity(midZ)});
      prev = cur;
    }
  }

  // ── 经线 ──────────────────────────────────────────────────────────────────
  const capRad = (polarCapDeg / 180) * Math.PI;
  for (let i = 0; i < lonCount; i++) {
    const theta = (i / lonCount) * 2 * Math.PI;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    let prev: (P3 & {sx: number; sy: number}) | null = null;
    for (let j = 0; j <= segments; j++) {
      const phi = (j / segments) * Math.PI;
      if (phi < capRad || phi > Math.PI - capRad) { prev = null; continue; }
      const sp = Math.sin(phi);
      const cur = xform({x: radius * sp * ct, y: radius * Math.cos(phi), z: radius * sp * st});
      if (prev !== null) {
        const midZ = (prev.z + cur.z) / 2;
        segs.push({x1: prev.sx, y1: prev.sy, x2: cur.sx, y2: cur.sy, op: depthOpacity(midZ)});
      }
      prev = cur;
    }
  }

  return (
    <svg
      width={1080}
      height={1920}
      style={{position: 'absolute', top: 0, left: 0, pointerEvents: 'none'}}
    >
      {segs.map((s, i) => (
        <line
          key={i}
          x1={s.x1.toFixed(1)}
          y1={s.y1.toFixed(1)}
          x2={s.x2.toFixed(1)}
          y2={s.y2.toFixed(1)}
          stroke={color}
          strokeWidth={0.9}
          strokeOpacity={s.op}
        />
      ))}
    </svg>
  );
};

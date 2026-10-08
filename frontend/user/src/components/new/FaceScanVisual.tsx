'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { LandmarkPoint } from './useFaceLandmarks';

/**
 * 분석 중 화면의 얼굴 모션그래픽. (2026-10-09)
 * 같은 3단계(랜드마크 추출 → 비율 계산 → 타입 도출)를 다섯 가지 연출로 보여준다.
 * 어떤 연출을 쓸지 고르기 위해 /dev/face-motion 에서 나란히 비교한다.
 *
 *   1 메쉬 스캔   — 스캔선이 훑고 코끝에서 점·메쉬가 퍼진다
 *   2 레이더      — 코끝을 중심으로 빛이 돌며 지나간 자리에 점이 켜진다
 *   3 라인 드로잉 — 눈썹·눈·코·입·윤곽을 펜으로 그리듯 따라간다
 *   4 실측 그리드 — 격자 위에 3등분 비율과 가로세로 비를 실제 값으로 적는다
 *   5 포커스 줌   — 눈 → 코 → 입 순서로 확대해 훑고 전체로 돌아온다
 */
export type FaceScanVariant = 1 | 2 | 3 | 4 | 5;

export const FACE_SCAN_VARIANTS: { id: FaceScanVariant; name: string; desc: string }[] = [
  { id: 1, name: '메쉬 스캔', desc: '스캔선 + 점·메쉬 확산' },
  { id: 2, name: '레이더', desc: '회전하는 빛이 지나가며 점 점등' },
  { id: 3, name: '라인 드로잉', desc: '이목구비를 펜으로 따라 그림' },
  { id: 4, name: '실측 그리드', desc: '격자 + 실제 비율 수치' },
  { id: 5, name: '포커스 줌', desc: '눈 → 코 → 입 확대 후 전체' },
];

const IDX = {
  faceOval: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109,
  ],
  browL: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  browR: [336, 296, 334, 293, 300, 276, 283, 282, 295, 285],
  eyeL: [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  eyeR: [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],
  noseLine: [168, 6, 197, 195, 5, 4],
  noseBase: [129, 98, 97, 2, 326, 327, 358],
  lips: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146],
  noseTip: 1,
};

/** viewBox 가로를 1000 으로 고정한다 — 사진 해상도와 무관하게 같은 굵기로 그리기 위해 */
const VB_W = 1000;
const WHITE = '#FFFFFF';
const LINE = { vectorEffect: 'non-scaling-stroke' as const, fill: 'none', stroke: WHITE };

type Pt = { x: number; y: number };

interface Props {
  photoUrl: string | null | undefined;
  points: LandmarkPoint[] | null;
  /** 0 랜드마크 추출 · 1 비율 계산 · 2 타입 도출 */
  step: number;
  variant: FaceScanVariant;
  tessellation?: { start: number; end: number }[] | null;
  /** 사진 최대 크기 (tailwind 클래스) */
  sizeClass?: string;
}

export function FaceScanVisual({
  photoUrl, points, step, variant, tessellation,
  sizeClass = 'max-w-[min(280px,78vw)] max-h-[44vh]',
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [aspect, setAspect] = useState(4 / 3); // 세로/가로
  const [k, setK] = useState(4);               // 화면 1px 가 viewBox 몇 단위인지

  const measure = () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.clientWidth) return;
    setAspect(img.naturalHeight / img.naturalWidth);
    setK(VB_W / img.clientWidth);
  };
  useEffect(() => {
    // 캐시된 사진은 화면이 붙기 전에 onLoad 가 끝나 버려 측정이 빠진다 — 이미 로드됐으면 바로 잰다
    if (imgRef.current?.complete) measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [photoUrl]);

  const vbH = VB_W * aspect;
  const at = (i: number): Pt => ({ x: points![i].x * VB_W, y: points![i].y * vbH });
  const g: Geo | null = points ? { at, k, vbH } : null;

  // 5번 포커스 줌: 단계마다 확대할 부위
  const zoom = variant === 5 && g ? zoomFor(g, step) : null;

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-2xl bg-[#1E1C1B]">
        <motion.div
          className="relative"
          animate={zoom?.target ?? { scale: 1, x: '0%', y: '0%' }}
          transition={{ duration: zoom?.times.length === 3 ? 1.8 : 0.9, ease: [0.65, 0, 0.35, 1], times: zoom?.times }}
        >
          {photoUrl ? (
            <motion.img
              ref={imgRef}
              src={photoUrl}
              alt=""
              onLoad={measure}
              className={`block w-auto h-auto ${sizeClass}`}
              animate={{
                filter: variant === 3 && step === 2 ? 'grayscale(1) brightness(0.55)' : 'grayscale(0) brightness(1)',
              }}
              transition={{ duration: 0.8 }}
            />
          ) : (
            <div className="w-[min(240px,70vw)] aspect-[3/4]" />
          )}

          {/* 흰 선이 잘 보이게 사진을 살짝 어둡게 */}
          <motion.div
            className="absolute inset-0 bg-black pointer-events-none"
            initial={{ opacity: 0.1 }}
            animate={{ opacity: variant === 4 ? 0.45 : step === 2 ? 0.15 : 0.35 }}
            transition={{ duration: 0.8 }}
          />

          {g && (
            <svg
              viewBox={`0 0 ${VB_W} ${vbH}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
            >
              <defs>
                <filter id={`fsGlow${variant}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation={3 * k} result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {variant === 1 && <MeshScan g={g} step={step} tessellation={tessellation} />}
              {variant === 2 && <Radar g={g} step={step} />}
              {variant === 3 && <LineDrawing g={g} step={step} />}
              {variant === 4 && <MeasureGrid g={g} step={step} />}
              {variant === 5 && <FocusZoom g={g} step={step} />}
            </svg>
          )}

          {/* 1번: 스캔선 */}
          <AnimatePresence>
            {variant === 1 && step === 0 && (
              <motion.div
                key="scan"
                className="absolute left-0 right-0 h-16 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 85%, rgba(255,255,255,0.9) 100%)' }}
                initial={{ top: '-15%' }}
                animate={{ top: ['-15%', '100%'] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </AnimatePresence>

          {/* 2번: 레이더 빛 */}
          <AnimatePresence>
            {variant === 2 && g && step < 2 && (
              <motion.div
                key="radar"
                className="absolute pointer-events-none"
                style={{
                  left: `${(g.at(IDX.noseTip).x / VB_W) * 100}%`,
                  top: `${(g.at(IDX.noseTip).y / vbH) * 100}%`,
                  width: '260%', aspectRatio: '1', translateX: '-50%', translateY: '-50%',
                  background: 'conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0) 300deg, rgba(255,255,255,0.4) 360deg)',
                  borderRadius: '50%',
                }}
                initial={{ rotate: 0, opacity: 0 }}
                animate={{ rotate: 360, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 2, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.4 } }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* 마지막 단계: 빛이 한 번 대각선으로 지나간다 */}
        {step === 2 && (
          <motion.div
            className="absolute inset-y-0 w-1/2 pointer-events-none"
            style={{ background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)' }}
            initial={{ left: '-60%' }}
            animate={{ left: '120%' }}
            transition={{ duration: 1.1, delay: 1, ease: 'easeInOut' }}
          />
        )}
      </div>

      {/* 뷰파인더 모서리 */}
      {[
        'top-0 left-0 border-t border-l rounded-tl-2xl',
        'top-0 right-0 border-t border-r rounded-tr-2xl',
        'bottom-0 left-0 border-b border-l rounded-bl-2xl',
        'bottom-0 right-0 border-b border-r rounded-br-2xl',
      ].map((pos, i) => (
        <motion.span
          key={pos}
          className={`absolute w-6 h-6 border-black ${pos}`}
          style={{ margin: -6 }}
          initial={{ opacity: 0, scale: 1.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }}
        />
      ))}
    </div>
  );
}

/* ───────── 공통 ───────── */

interface Geo { at: (i: number) => Pt; k: number; vbH: number }

const pathOf = (pts: Pt[], close = false) =>
  pts.map((p, n) => `${n ? 'L' : 'M'}${p.x} ${p.y}`).join('') + (close ? 'Z' : '');

/** 이마 점(10)은 헤어라인보다 아래라 미간 → 이마 방향으로 조금 올린다 (faceGuides 와 같은 방식) */
function keyLevels({ at }: Geo) {
  const top = at(10), bridge = at(168), chin = at(152);
  return {
    hairY: top.y + (top.y - bridge.y) * 0.6,
    browY: (at(105).y + at(334).y) / 2,
    noseY: at(2).y,
    chinY: chin.y,
    left: at(234).x,
    right: at(454).x,
    midX: (top.x + chin.x) / 2,
  };
}

function Dots({ g, delayOf, r = 1.3, every = 2 }: { g: Geo; delayOf: (p: Pt) => number; r?: number; every?: number }) {
  const out = [];
  for (let i = 0; i < 468; i++) {
    if (i % every && !IDX.faceOval.includes(i)) continue;
    const p = g.at(i);
    out.push(
      <motion.circle
        key={i}
        cx={p.x} cy={p.y} r={r * g.k} fill={WHITE}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 0.85], scale: [0, 1.8, 1] }}
        transition={{ duration: 0.45, delay: delayOf(p) }}
      />,
    );
  }
  return <g>{out}</g>;
}

function Oval({ g, glowId, delay = 0 }: { g: Geo; glowId: string; delay?: number }) {
  return (
    <motion.path
      d={pathOf(IDX.faceOval.map(g.at), true)}
      {...LINE} strokeWidth={2} strokeLinejoin="round"
      filter={`url(#${glowId})`}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 1.2, delay, ease: 'easeInOut' }}
    />
  );
}

function RatioLines({ g, opacity = 0.85 }: { g: Geo; opacity?: number }) {
  const { hairY, browY, noseY, chinY, left, right, midX } = keyLevels(g);
  const pad = (right - left) * 0.08;
  const lines: { a: Pt; b: Pt; faint?: boolean }[] = [
    { a: { x: midX, y: hairY }, b: { x: midX, y: chinY }, faint: true },
    ...[hairY, browY, noseY, chinY].map((y) => ({ a: { x: left - pad, y }, b: { x: right + pad, y } })),
    { a: g.at(234), b: g.at(454) },
    { a: g.at(33), b: g.at(133) },
    { a: g.at(362), b: g.at(263) },
  ];
  const nodes = [234, 454, 33, 133, 362, 263].map(g.at);
  return (
    <g>
      {lines.map((l, i) => (
        <motion.line
          key={i}
          x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y}
          {...LINE} strokeWidth={1} strokeOpacity={l.faint ? opacity * 0.6 : opacity}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: i * 0.12, ease: 'easeOut' }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.x} cy={n.y} r={3.2 * g.k}
          fill="#292625" stroke={WHITE} strokeWidth={1.2} vectorEffect="non-scaling-stroke"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.35, delay: 0.5 + i * 0.1 }}
        />
      ))}
    </g>
  );
}

/* ───────── 1 메쉬 스캔 ───────── */

function MeshScan({ g, step, tessellation }: { g: Geo; step: number; tessellation?: { start: number; end: number }[] | null }) {
  const c = g.at(IDX.noseTip);
  return (
    <g>
      {tessellation && (
        <motion.path
          d={tessellation.map(({ start, end }) => {
            const a = g.at(start), b = g.at(end);
            return `M${a.x} ${a.y}L${b.x} ${b.y}`;
          }).join('')}
          {...LINE} strokeWidth={0.5}
          initial={{ opacity: 0 }}
          animate={{ opacity: step === 0 ? 0.28 : 0.12 }}
          transition={{ duration: 1 }}
        />
      )}
      <Dots g={g} delayOf={(p) => 0.2 + (Math.hypot(p.x - c.x, p.y - c.y) / VB_W) * 2.2} />
      {step >= 1 && <RatioLines g={g} />}
      {step >= 2 && <Oval g={g} glowId="fsGlow1" />}
    </g>
  );
}

/* ───────── 2 레이더 ───────── */

function Radar({ g, step }: { g: Geo; step: number }) {
  const c = g.at(IDX.noseTip);
  // 빛이 2초에 한 바퀴 돈다. 각도 순서대로 점을 켜서 빛이 지나간 자리에 점이 남게 한다
  const angleDelay = (p: Pt) => {
    const a = Math.atan2(p.y - c.y, p.x - c.x); // -π ~ π, 0 = 오른쪽
    const t = ((a + Math.PI * 2 + Math.PI / 2) % (Math.PI * 2)) / (Math.PI * 2); // 위쪽부터 시계방향
    return 0.15 + t * 1.8;
  };
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={c.x} cy={c.y} r={VB_W * 0.5}
          {...LINE} strokeWidth={1}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 1.1, opacity: 0 }}
          transition={{ duration: 2.4, delay: i * 0.8, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      <Dots g={g} delayOf={angleDelay} />
      {step >= 1 && <RatioLines g={g} />}
      {step >= 2 && <Oval g={g} glowId="fsGlow2" />}
    </g>
  );
}

/* ───────── 3 라인 드로잉 ───────── */

function LineDrawing({ g, step }: { g: Geo; step: number }) {
  const parts: { pts: number[]; close?: boolean }[] = [
    { pts: IDX.browL, close: true }, { pts: IDX.browR, close: true },
    { pts: IDX.eyeL, close: true }, { pts: IDX.eyeR, close: true },
    { pts: IDX.noseLine }, { pts: IDX.noseBase },
    { pts: IDX.lips, close: true },
  ];
  // 펜 끝 — 그려지는 선을 따라다니는 밝은 점 대신, 각 부위가 끝날 때 반짝인다
  return (
    <g>
      {parts.map((p, i) => (
        <motion.path
          key={i}
          d={pathOf(p.pts.map(g.at), p.close)}
          {...LINE} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round"
          filter="url(#fsGlow3)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.25 + i * 0.24, ease: 'easeInOut' }}
        />
      ))}
      {step >= 1 && <RatioLines g={g} opacity={0.5} />}
      {step >= 2 && <Oval g={g} glowId="fsGlow3" />}
    </g>
  );
}

/* ───────── 4 실측 그리드 ───────── */

function MeasureGrid({ g, step }: { g: Geo; step: number }) {
  const { hairY, browY, noseY, chinY, left, right } = keyLevels(g);
  const total = chinY - hairY;
  const thirds = [browY - hairY, noseY - browY, chinY - noseY].map((v) => Math.round((v / total) * 100));
  const ratio = (total / (right - left)).toFixed(2);
  const gap = VB_W / 12;
  const fs = 10 * g.k;
  // 자는 얼굴 왼쪽에 둔다 — 오른쪽에 두면 숫자가 사진 밖으로 잘린다
  const tickX = left - (right - left) * 0.06;
  const ys = [hairY, browY, noseY, chinY];

  return (
    <g>
      {/* 격자 */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 0.18 }} transition={{ duration: 0.8 }}>
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} x1={i * gap} y1={0} x2={i * gap} y2={g.vbH} {...LINE} strokeWidth={0.5} />
        ))}
        {Array.from({ length: Math.ceil(g.vbH / gap) + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * gap} x2={VB_W} y2={i * gap} {...LINE} strokeWidth={0.5} />
        ))}
      </motion.g>
      {/* 1단계: 기준점만 크게 */}
      {[10, 168, 2, 152, 234, 454, 33, 263].map((i, n) => {
        const p = g.at(i);
        return (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + n * 0.12 }}>
            <line x1={p.x - 6 * g.k} y1={p.y} x2={p.x + 6 * g.k} y2={p.y} {...LINE} strokeWidth={1} />
            <line x1={p.x} y1={p.y - 6 * g.k} x2={p.x} y2={p.y + 6 * g.k} {...LINE} strokeWidth={1} />
          </motion.g>
        );
      })}
      {/* 2단계: 가로 기준선 + 오른쪽 자 + 실제 비율 */}
      {step >= 1 && (
        <g>
          {ys.map((y, i) => (
            <motion.line
              key={i}
              x1={tickX} y1={y} x2={right + (right - left) * 0.05} y2={y}
              {...LINE} strokeWidth={1} strokeOpacity={0.8}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            />
          ))}
          <motion.line
            x1={tickX} y1={hairY} x2={tickX} y2={chinY} {...LINE} strokeWidth={1}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.4 }}
          />
          {thirds.map((v, i) => (
            // 여백이 좁아 숫자만 적는다. (motion 의 x 는 SVG 좌표가 아니라 transform 이라 위치는 속성으로 고정)
            <motion.text
              key={i}
              x={tickX - 4 * g.k} y={(ys[i] + ys[i + 1]) / 2 + fs * 0.35}
              fontSize={fs} fill={WHITE} textAnchor="end"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.7 + i * 0.15 }}
            >
              {v}%
            </motion.text>
          ))}
        </g>
      )}
      {/* 3단계: 가로세로 비 */}
      {step >= 2 && (
        <g>
          <Oval g={g} glowId="fsGlow4" />
          <motion.text
            x={(left + right) / 2} y={chinY + 20 * g.k}
            fontSize={fs * 1.2} fill={WHITE} textAnchor="middle" letterSpacing={1 * g.k}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          >
            가로 : 세로 = 1 : {ratio}
          </motion.text>
        </g>
      )}
    </g>
  );
}

/* ───────── 5 포커스 줌 ───────── */

function centerOf(g: Geo, idx: number[]): Pt {
  const ps = idx.map(g.at);
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
}

/** 확대할 부위 중심을 화면 가운데로 가져오는 이동량. x/y 는 요소 크기 대비 % */
function zoomFor(g: Geo, step: number) {
  const to = (c: Pt, s: number) => ({
    scale: s,
    x: `${-s * (c.x / VB_W - 0.5) * 100}%`,
    y: `${-s * (c.y / g.vbH - 0.5) * 100}%`,
  });
  const eyes = to(centerOf(g, [33, 133, 362, 263]), 2.2);
  const nose = to(centerOf(g, IDX.noseBase), 2.4);
  const lips = to(centerOf(g, IDX.lips), 2.4);
  const full = { scale: 1, x: '0%', y: '0%' };
  const seq = step === 0 ? [full, eyes] : step === 1 ? [eyes, nose, lips] : [lips, full];
  return {
    target: { scale: seq.map((s) => s.scale), x: seq.map((s) => s.x), y: seq.map((s) => s.y) },
    times: seq.length === 3 ? [0, 0.5, 1] : [0, 1],
  };
}

function FocusZoom({ g, step }: { g: Geo; step: number }) {
  const parts = step === 0 ? [IDX.eyeL, IDX.eyeR, IDX.browL, IDX.browR] : step === 1 ? [IDX.noseLine, IDX.noseBase, IDX.lips] : [];
  return (
    <g>
      <Dots g={g} every={3} r={0.9} delayOf={() => 0} />
      {parts.map((p, i) => (
        <motion.path
          key={`${step}-${i}`}
          d={pathOf(p.map(g.at), p !== IDX.noseLine && p !== IDX.noseBase)}
          {...LINE} strokeWidth={1.4} strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 + i * 0.2 }}
        />
      ))}
      {step >= 2 && <Oval g={g} glowId="fsGlow5" delay={0.6} />}
    </g>
  );
}

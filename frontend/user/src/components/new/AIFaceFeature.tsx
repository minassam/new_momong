import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandHeader } from './BrandHeader';
import { FORM, PROP, MONO, dominantOf, type MItem } from './faceAnalysisData';
import { FaceOverlay } from './FaceOverlay';
import { useFaceLandmarks } from './useFaceLandmarks';
import { LandmarkGuideImage } from './LandmarkGuideImage';
import { ANALYZED_ITEM_IDS } from './faceAnalysisToPosMap';
import type { Measurement } from '@/utils/face-analysis-api';

// 촬영 사진이 없을 때만 쓰는 예시 이미지 (개발 중 건너뛰기로 넘어온 경우)
const FALLBACK_PHOTO = '/new/face-photo.jpg';

interface Props {
  onNext: (posMap: Record<string, number>) => void;
  onBack?: () => void;
  /** 얼굴 촬영에서 S3 에 올린 실제 고객 사진. 없으면 예시 이미지로 떨어진다. */
  facePhotoUrl?: string | null;
  /** 실제 분석 결과에서 만든 항목별 위치값. 비어 있으면 시안 기본값이 쓰인다. */
  initialPosMap?: Record<string, number>;
  /** 항목별 실측 도형. 있으면 하드코딩 오버레이 대신 이걸 그린다. */
  measurements?: Record<string, Measurement | null>;
  /** 항목별 실측 표시값(Python description). 없으면 위치에서 문구를 만든다. */
  values?: Record<string, string>;
}

// ── Overlays ──────────────────────────────────────────────────────────
/**
 * 얼굴 좌표를 못 찾았을 때 떨어지는 시안 고정 오버레이.
 * 굵은 검정 실선으로 그려져 있어 랜드마크 가이드선(흰 점선)과 따로 놀았다.
 * 도형은 그대로 두고 색·굵기만 덮어써 같은 스타일로 맞춘다. (2026-09-12)
 */
const LEGACY_GUIDE_CSS = `
.mm-legacy-halo path, .mm-legacy-halo line {
  stroke: #000000; stroke-width: 2.7px; stroke-opacity: 0.22; fill: none;
  stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; opacity: 1;
}
.mm-legacy-halo circle { display: none; }
.mm-legacy-guide path, .mm-legacy-guide line {
  stroke: #FFFFFF; stroke-width: 1.5px; fill: none;
  stroke-dasharray: 4 5; vector-effect: non-scaling-stroke; opacity: 1;
}
.mm-legacy-guide circle {
  fill: #1A1A1A; stroke: none; opacity: 1;
}
`;

function LegacyGuide({ node }: { node: React.ReactNode }) {
  return (
    <g opacity={0.6}>
      <style>{LEGACY_GUIDE_CSS}</style>
      <g className="mm-legacy-halo">{node}</g>
      <g className="mm-legacy-guide">{node}</g>
    </g>
  );
}

const OVERLAYS: Record<string, React.ReactNode> = {
  faceline: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"
        d="M707 470 C880 470 1150 598 1238 676 C1326 754 1258 828 1232 936 C1206 1044 1172 1198 1082 1316 C992 1434 832 1636 707 1636 C582 1635 420 1430 330 1312 C240 1194 206 1042 182 934 C158 826 92 752 180 676 C268 600 534 470 707 470 Z"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="180" cy="676" r="11"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="1238" cy="676" r="11"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="1636" r="11"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="470" r="11"/>
    </g>
  ),
  cheek: (
    <g>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="182" cy="990" r="11"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="1232" cy="990" r="11"/>
      <line stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 8" opacity="0.5" x1="182" y1="930" x2="182" y2="1060"/>
      <line stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 8" opacity="0.5" x1="1232" y1="930" x2="1232" y2="1060"/>
    </g>
  ),
  browdir: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M360 768 Q446 744 570 770"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M862 770 Q994 744 1068 768"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="360" cy="768" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="570" cy="770" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="862" cy="770" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="1068" cy="768" r="9"/>
    </g>
  ),
  browshape: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" d="M360 768 L446 744 L570 770"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" d="M862 770 L994 744 L1068 768"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="446" cy="744" r="10"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="994" cy="744" r="10"/>
    </g>
  ),
  eyeshape: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M390 876 Q484 808 584 860 Q484 918 390 876 Z"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M1040 878 Q946 808 844 862 Q946 918 1040 878 Z"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="390" cy="876" r="9"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="584" cy="860" r="9"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="844" cy="862" r="9"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="1040" cy="878" r="9"/>
    </g>
  ),
  eyetail: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M390 876 Q484 808 584 860 Q484 918 390 876 Z"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M1040 878 Q946 808 844 862 Q946 918 1040 878 Z"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="390" cy="876" r="11"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="1040" cy="878" r="11"/>
    </g>
  ),
  eyefront: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M390 876 Q484 808 584 860 Q484 918 390 876 Z"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M1040 878 Q946 808 844 862 Q946 918 1040 878 Z"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="584" cy="860" r="11"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="844" cy="862" r="11"/>
    </g>
  ),
  nosewidth: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="2" strokeDasharray="6 9" opacity="0.4" strokeLinecap="round" x1="707" y1="868" x2="707" y2="1210"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M614 1198 Q707 1238 800 1202"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="614" cy="1198" r="9"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="800" cy="1202" r="9"/>
    </g>
  ),
  lips: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" d="M594 1376 Q651 1328 707 1334 Q763 1328 820 1378"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" d="M594 1376 Q707 1458 820 1378"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="594" cy="1376" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="820" cy="1378" r="9"/>
    </g>
  ),
  facelen: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="707" y1="470" x2="707" y2="1636"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="686" y1="470" x2="728" y2="470"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="686" y1="1636" x2="728" y2="1636"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="470" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="1636" r="9"/>
    </g>
  ),
  broweye: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="360" y1="744" x2="360" y2="820"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="348" y1="744" x2="372" y2="744"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="348" y1="820" x2="372" y2="820"/>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="1068" y1="744" x2="1068" y2="820"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="1056" y1="744" x2="1080" y2="744"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="1056" y1="820" x2="1080" y2="820"/>
    </g>
  ),
  intereye: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="584" y1="860" x2="844" y2="862"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="584" cy="860" r="9"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="844" cy="862" r="9"/>
    </g>
  ),
  thirds: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 8" opacity="0.35" x1="160" y1="618" x2="1254" y2="618"/>
      <line stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 8" opacity="0.35" x1="160" y1="994" x2="1254" y2="994"/>
      <line stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 8" opacity="0.35" x1="160" y1="1430" x2="1254" y2="1430"/>
    </g>
  ),
  midface: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="707" y1="744" x2="707" y2="1238"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="744" x2="720" y2="744"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="1238" x2="720" y2="1238"/>
    </g>
  ),
  philtrum: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="707" y1="1238" x2="707" y2="1334"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="1238" x2="720" y2="1238"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="1334" x2="720" y2="1334"/>
    </g>
  ),
  mouthwidth: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="594" y1="1404" x2="820" y2="1406"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="594" cy="1376" r="9"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="4" cx="820" cy="1378" r="9"/>
    </g>
  ),
  chinlen: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="707" y1="1456" x2="707" y2="1636"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="1456" x2="720" y2="1456"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="1636" x2="720" y2="1636"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="1636" r="9"/>
    </g>
  ),
  nosehigh: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="707" y1="868" x2="707" y2="1198"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="868" x2="720" y2="868"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="1198" x2="720" y2="1198"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="868" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="1198" r="9"/>
    </g>
  ),
  eyelid: (
    <g>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M390 876 Q484 808 584 860 Q484 918 390 876 Z"/>
      <path stroke="#1A1A1A" strokeWidth="4" fill="none" strokeLinecap="round" d="M1040 878 Q946 808 844 862 Q946 918 1040 878 Z"/>
      <path stroke="#1A1A1A" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="5 5" opacity="0.6" d="M414 858 Q484 828 556 846"/>
      <path stroke="#1A1A1A" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="5 5" opacity="0.6" d="M856 848 Q946 826 1016 860"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="3" cx="390" cy="876" r="8"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="3" cx="584" cy="860" r="8"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="3" cx="844" cy="862" r="8"/>
      <circle fill="#FFF" stroke="#1A1A1A" strokeWidth="3" cx="1040" cy="878" r="8"/>
    </g>
  ),
  eyeouter: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="390" y1="876" x2="182" y2="876"/>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="1040" y1="878" x2="1238" y2="878"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="390" cy="876" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="182" cy="876" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="1040" cy="878" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="1238" cy="878" r="9"/>
    </g>
  ),
  noselen: (
    <g>
      <line stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" x1="707" y1="744" x2="707" y2="1238"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="744" x2="720" y2="744"/>
      <line stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" x1="694" y1="1238" x2="720" y2="1238"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="744" r="9"/>
      <circle fill="#1A1A1A" stroke="#FFF" strokeWidth="3" cx="707" cy="1238" r="9"/>
    </g>
  ),
};

/**
 * 형태·비율 타입 예시 사진 슬롯.
 * 사진이 준비되면 photo 에 경로(예: '/new/type-form-warm.jpg')만 넣으면 된다. 비어 있으면 자리만 보인다.
 */
const TYPE_EXAMPLES: { zone: string; cols: number; types: { label: string; photo: string }[] }[] = [
  { zone: '형태', cols: 2, types: [{ label: '귀여운', photo: '/new/type-form-warm.jpg' }, { label: '세련된', photo: '/new/type-form-cool.jpg' }] },
  { zone: '비율', cols: 2, types: [{ label: '귀여운 · 순진한', photo: '/new/type-prop-left.jpg' }, { label: '부드러운 · 여성스러운', photo: '/new/type-prop-right.jpg' },
    { label: '산뜻한 · 청초한', photo: '/new/type-prop-left2.jpg' }, { label: '현대적인 · 지적인', photo: '/new/type-prop-right2.jpg' }] },
  // 형태/비율은 가로 Warm–Cool, 세로 위 Soft · 아래 Hard 의 2×2
  { zone: '형태/비율', cols: 2, types: [
    { label: '귀여운 · 순진한', photo: '/new/type-warm-soft.jpg' }, { label: '청초한 · 산뜻한', photo: '/new/type-cool-soft.jpg' },
    { label: '부드러운 · 여성스러운', photo: '/new/type-warm-hard.jpg' }, { label: '현대적인 · 지적인', photo: '/new/type-cool-hard.jpg' },
  ] },
];

const ZONES = [
  { tag: 'A', name: '형태 분석', count: '10항목', items: FORM },
  { tag: 'B', name: '비율 분석', count: '10항목', items: PROP },
];

/**
 * 얼굴 가이드선 — 세로 중심선과 가로 눈높이선.
 *
 * 예전에는 시안 예시 사진(1414×2000)의 절대 좌표로 그려서 실제 촬영 사진에서는 얼굴과 어긋났고,
 * 실측 도형이 있는 화면에는 아예 그려지지도 않았다.
 * 지금은 사진 크기와 무관하게 비율로 얹는다 — 어떤 사진에서도 같은 자리에 온다.
 *   세로 50%  = 좌우 대칭 기준선
 *   가로 52.6% = 시안이 눈높이로 잡았던 위치(1053/2000)와 같은 비율
 */
function GuideLines() {
  const line = 'absolute pointer-events-none';
  const style = { borderColor: 'rgba(26,26,26,0.35)', borderStyle: 'dashed' as const };
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className={line} style={{ ...style, left: '50%', top: '8%', bottom: '8%', borderLeftWidth: 1 }} />
      <div className={line} style={{ ...style, top: '52.6%', left: '6%', right: '6%', borderTopWidth: 1 }} />
    </div>
  );
}

function PctBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-[12px] text-[#1A1A1A] w-14 shrink-0">{label}</span>
      <div className="flex-1 h-[3px] bg-[#E8E8E4] rounded-full overflow-hidden">
        <motion.div className="h-full bg-[#1A1A1A] rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <span className="text-[11px] text-[#A6A6A2] w-7 text-right" style={{ fontFamily: MONO }}>{pct}%</span>
    </div>
  );
}

function AdjustSlider({ pos, l, r, onChange }: { pos: number; l: string; r: string; onChange: (v: number) => void }) {
  return (
    <div className="mt-3 mb-1">
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-[3px] bg-[#E8E8E4] rounded-full" />
        <div className="absolute left-0 h-[3px] bg-[#1A1A1A] rounded-full" style={{ width: `${pos * 100}%` }} />
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round(pos * 100)}
          onChange={e => onChange(Number(e.target.value) / 100)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: 20 }}
        />
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-[#1A1A1A] border-2 border-white shadow pointer-events-none"
          style={{ left: `${pos * 100}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      {/* 양끝 단어와 가운데 수치의 폰트를 맞춘다 — 예전에는 단어만 본문 폰트라 따로 놀았다 (2026-09-11) */}
      <div className="flex justify-between mt-1.5" style={{ fontFamily: MONO }}>
        <span className="text-[10px] text-[#AAAAAA]" style={{ letterSpacing: '0.04em' }}>{l}</span>
        <span className="text-[10px] text-[#1A1A1A] font-semibold" style={{ letterSpacing: '0.04em' }}>{Math.round(pos * 100)}</span>
        <span className="text-[10px] text-[#AAAAAA]" style={{ letterSpacing: '0.04em' }}>{r}</span>
      </div>
    </div>
  );
}

export function AIFaceFeature({ onNext, onBack, facePhotoUrl, initialPosMap, measurements, values }: Props) {
  const [zoneIdx, setZoneIdx]     = useState(0);
  // 타입 예시 섹션의 상단 바 선택 (위쪽 형태/비율 분석 탭과는 따로 움직인다)
  const [exampleIdx, setExampleIdx] = useState(0);
  const [stepIdx, setStepIdx]     = useState(0);
  const [guideline, setGuideline] = useState(false);
  const [done, setDone]           = useState<Record<string, boolean>>({});
  // 자동 측정 도형이 얼굴과 잘 맞는지 크게 놓고 확인한다 (보기 전용).
  const [zoomOpen, setZoomOpen] = useState(false);
  // 분석 결과(측정선)를 끄고 맨 얼굴만 볼 수 있게 한다. 작은 화면·확대 화면 모두에 적용된다.
  const [overlayOn, setOverlayOn] = useState(true);
  // 가이드선을 실제 얼굴에 맞추기 위한 좌표. 파이썬 모듈 유무와 무관하게 전 항목에 쓴다.
  const { points: landmarks } = useFaceLandmarks(facePhotoUrl || FALLBACK_PHOTO);

  // 실제 분석 결과를 출발점으로 잡는다. 디자이너가 슬라이더로 고치면 그 값이 이긴다.
  const [posMap, setPosMap]       = useState<Record<string, number>>(initialPosMap ?? {});

  const formDominant = dominantOf(FORM, posMap);
  const propDominant = dominantOf(PROP, posMap);

  const zone    = ZONES[zoneIdx];
  const items   = zone.items;
  const current = items[stepIdx] ?? null;

  const getPos = (id: string, def: number) => posMap[id] ?? def;

  // 값이 아직 없는 항목. 분석 모듈이 없거나(눈썹 방향·눈 앞머리·코 높이) 분석이 등급을 못 준 경우다.
  // 이 항목들은 판정에서 빠지므로, 다 채우기 전에는 최종 이미지타입으로 넘어가지 못하게 막는다.
  const pendingItems = [...FORM, ...PROP].filter(it => posMap[it.id] == null);

  // 20항목을 한 줄로 세워 두고 확대 화면에서 ‹ › 로 넘긴다 (존 경계도 넘어간다).
  const flatItems = ZONES.flatMap((z, zi) => z.items.map((it, si) => ({ zi, si, it })));
  const flatIdx = flatItems.findIndex((f) => f.zi === zoneIdx && f.si === stepIdx);
  const goItem = (delta: number) => {
    if (flatIdx < 0) return;
    const next = flatItems[flatIdx + delta];
    if (!next) return;
    setZoneIdx(next.zi);
    setStepIdx(next.si);
  };

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goItem(-1);
      else if (e.key === 'ArrowRight') goItem(1);
      else if (e.key === 'Escape') setZoomOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomOpen, flatIdx]);

  const FORM_AXIS = ['Warm', 'Neutral', 'Cool'];
  const PROP_AXIS = ['Soft', 'Neutral', 'Hard'];

  const deriveType = (item: MItem, pos: number): string => {
    const axis = FORM.find(it => it.id === item.id) ? FORM_AXIS : PROP_AXIS;
    if (pos < 0.33) return axis[0];
    if (pos < 0.67) return axis[1];
    return axis[2];
  };

  const deriveDesc = (item: MItem, pos: number): string => {
    const type = deriveType(item, pos);
    const side = pos < 0.33 ? item.l : pos > 0.67 ? item.r : '균형';
    if (pos >= 0.33 && pos < 0.67) {
      return `${item.title}이(가) 균형 잡힌 범위입니다. ${type} 성향으로 인상을 중립적으로 유지합니다.`;
    }
    return `${item.title}이(가) ${side} 편에 해당합니다. ${type} 성향으로 이미지에 영향을 줍니다.`;
  };

  // 우리 분석에 대응 모듈이 없는 항목. 자동 측정값이 없어 디자이너가 직접 잡아야 한다.
  const isUnmeasured = (id: string) => !ANALYZED_ITEM_IDS.includes(id);

  // 시안의 defaultValue 는 예시 사진 기준 고정 문구라 실제 위치와 어긋난다.
  // 실측값이 있으면 그걸 쓰고, 없으면 현재 위치에서 문구를 만든다.
  const deriveValue = (item: MItem, pos: number): string => {
    if (values?.[item.id]) return values[item.id];
    if (pos < 0.33) return `${item.l} 편`;
    if (pos > 0.67) return `${item.r} 편`;
    return '표준';
  };

  const deriveTags: Record<string, string[]> = {
    Cool:    ['#세련된', '#도시적인', '#지적인', '#성숙한'],
    Neutral: ['#자연스러운', '#균형잡힌', '#편안한'],
    Warm:    ['#따뜻한', '#부드러운', '#친근한'],
    Soft:    ['#온화한', '#부드러운', '#여성적인'],
    Hard:    ['#강한', '#또렷한', '#입체적인'],
  };

  const deriveBreakdown = (type: string, pos: number) => {
    const axis = ['Cool', 'Neutral', 'Warm'].includes(type) ? FORM_AXIS : PROP_AXIS;
    const [lo, mid, hi] = axis;
    const intensity = Math.abs(pos - 0.5) * 2;
    if (type === mid) return [{ label: mid, pct: 55 }, { label: lo, pct: 25 }, { label: hi, pct: 20 }];
    if (type === hi)  return [{ label: hi, pct: Math.round(35 + intensity * 25) }, { label: mid, pct: Math.round(35 - intensity * 10) }, { label: lo, pct: Math.round(30 - intensity * 15) }];
    return [{ label: lo, pct: Math.round(35 + intensity * 25) }, { label: mid, pct: Math.round(35 - intensity * 10) }, { label: hi, pct: Math.round(30 - intensity * 15) }];
  };

  const handleZone = (i: number) => { setZoneIdx(i); setStepIdx(0); };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Pretendard Variable','Inter',-apple-system,sans-serif" }}>
      <BrandHeader />

      <div className="pt-20 pb-40 max-w-3xl mx-auto px-6">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-[11px] tracking-[0.2em] text-[#AAAAAA] mb-1.5" style={{ fontFamily: MONO }}>STEP 02</p>
          <div className="flex items-end justify-between">
            <h1 className="text-[1.6rem] font-light text-[#111111] tracking-tight">이목구비 집중 분석</h1>
            {/* 다른 화면과 같은 모양의 뒤로가기. onBack 이 없으면 그리지 않는다. */}
            <div className="mb-1 flex items-center gap-2">
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-3 py-2 text-[11px] tracking-[0.04em] rounded-sm border border-[#E8E8E4] text-[#888888]"
                  style={{ background: 'transparent', cursor: 'pointer' }}>
                  ← 돌아가기
                </button>
              )}
              <button
                onClick={() => {
                  if (pendingItems.length) {
                    // 남은 첫 항목으로 데려간다
                    const first = pendingItems[0];
                    const zi = FORM.some(f => f.id === first.id) ? 0 : 1;
                    setZoneIdx(zi);
                    setStepIdx(ZONES[zi].items.findIndex(i => i.id === first.id));
                    return;
                  }
                  onNext(posMap);
                }}
                className="px-4 py-2.5 text-[11.5px] tracking-[0.06em] rounded-sm"
                style={{
                  background: pendingItems.length ? '#DDDDDD' : '#1A1A1A',
                  color: pendingItems.length ? '#777777' : '#FFFFFF',
                  border: 'none', cursor: 'pointer', fontWeight: 500,
                }}
                title={pendingItems.length ? `아직 값이 없는 항목: ${pendingItems.map(i => i.title).join(', ')}` : ''}>
                {pendingItems.length ? `미측정 ${pendingItems.length}개 남음 →` : '결과 도출 →'}
              </button>

              {/* 남은 항목을 한 번에 확정 — 항목마다 '측정 완료' 를 누르는 게 번거롭다는 요청.
                  자동 분석이 값을 주지 못한 항목(눈썹 방향·눈 앞머리·코 높이 등)만 남는다.
                  각 항목의 현재 슬라이더 위치를 그대로 값으로 확정한다. (2026-09-11) */}
              {pendingItems.length > 0 && (
                <button
                  onClick={() => {
                    setPosMap(m => {
                      const next = { ...m };
                      pendingItems.forEach(it => {
                        if (next[it.id] == null) next[it.id] = it.defaultPos;
                      });
                      return next;
                    });
                    setDone(d => {
                      const next = { ...d };
                      pendingItems.forEach(it => { next[it.id] = true; });
                      return next;
                    });
                  }}
                  className="px-3.5 py-2.5 text-[11.5px] tracking-[0.06em] rounded-sm"
                  style={{
                    background: '#FFFFFF', color: '#555550',
                    border: '1px solid #CCCCCA', cursor: 'pointer', fontWeight: 500,
                  }}
                  title={`남은 ${pendingItems.length}개를 지금 슬라이더 위치로 한 번에 확정합니다`}>
                  남은 {pendingItems.length}개 한 번에 확정
                </button>
              )}
            </div>
          </div>

          {/* Zone tabs */}
          <div className="flex border-b border-[#E0E0E0] mt-4">
            {ZONES.map((z, i) => (
              <button key={z.tag} onClick={() => handleZone(i)}
                className="relative pb-3 mr-8 text-[14px] tracking-tight"
                style={{ fontWeight: i === zoneIdx ? 600 : 400, color: i === zoneIdx ? '#1A1A1A' : '#AAAAAA', background: 'none', border: 'none', cursor: 'pointer' }}>
                {z.name}
                <span className="ml-1.5 text-[10px]" style={{ color: '#CCCCCC', fontFamily: MONO }}>{z.count}</span>
                {i === zoneIdx && <motion.div layoutId="ztab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1A1A1A]" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Photo | Item list | Detail (3 columns) ───────────────── */}
        {(() => {
          const axisLabels = zoneIdx === 0
            ? ['Warm', 'Neutral', 'Cool']
            : ['Soft', 'Neutral', 'Hard'];
          const axisCounts = items.reduce((acc, it) => {
            const t = deriveType(it, getPos(it.id, it.defaultPos));
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const pos      = current ? getPos(current.id, current.defaultPos) : 0.5;
          const liveType = current ? deriveType(current, pos) : '';
          const liveDesc = current ? deriveDesc(current, pos) : '';
          const liveTags = current ? (deriveTags[liveType] ?? current.tags) : [];
          const liveBd   = current ? deriveBreakdown(liveType, pos) : [];
          // 선택된 항목의 실측 도형. 매핑되지 않은 항목이면 undefined 가 되어 하드코딩 오버레이로 떨어진다.
          const currentMeasurement = current ? measurements?.[current.id] : null;


          return (
            <>
            {/* ── 확대 편집 ─────────────────────────────────────────
                작은 사진에서는 점을 정확히 잡기 어렵다. 크게 놓고 끈 뒤
                여기서 바로 재분석까지 하고 닫는다. */}
            {zoomOpen && current && (
              <div
                className="fixed inset-0 z-[9998] flex items-center justify-center p-6"
                style={{ background: 'rgba(20,20,20,0.82)' }}
                onClick={() => setZoomOpen(false)}
              >
                <div
                  className="bg-white rounded-sm overflow-hidden max-h-[92vh] flex flex-col"
                  style={{ width: 'min(92vw, 760px)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E8E4]">
                    <div className="flex items-center gap-3">
                      {/* 항목 이동 — 존(형태/비율)을 넘어서 20항목을 오간다. ← → 키도 된다 */}
                      <button
                        onClick={() => goItem(-1)}
                        disabled={flatIdx <= 0}
                        className="px-2 py-1 text-[13px] rounded-sm"
                        style={{ background: 'transparent', border: '1px solid #DDDDDD',
                                 color: flatIdx <= 0 ? '#CCCCCC' : '#444444',
                                 cursor: flatIdx <= 0 ? 'default' : 'pointer' }}>‹</button>
                      <div>
                        <p className="text-[9px] tracking-[0.18em] text-[#AAAAAA]" style={{ fontFamily: MONO }}>
                          ADJUST POINTS · {flatIdx + 1}/{flatItems.length}
                        </p>
                        <p className="text-[14px] text-[#1A1A1A] mt-0.5">
                          {current.num}. {current.title}
                          {isUnmeasured(current.id) && (
                            <span className="ml-2 text-[10px] text-[#B08A3E]">미측정</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => goItem(1)}
                        disabled={flatIdx >= flatItems.length - 1}
                        className="px-2 py-1 text-[13px] rounded-sm"
                        style={{ background: 'transparent', border: '1px solid #DDDDDD',
                                 color: flatIdx >= flatItems.length - 1 ? '#CCCCCC' : '#444444',
                                 cursor: flatIdx >= flatItems.length - 1 ? 'default' : 'pointer' }}>›</button>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 분석 결과 on/off — 작은 화면과 같은 스위치를 쓴다 */}
                      <button
                        onClick={() => setOverlayOn(v => !v)}
                        className="px-2.5 py-1.5 text-[11px] rounded-sm"
                        style={{ background: overlayOn ? '#1A1A1A' : 'transparent',
                                 color: overlayOn ? '#FFFFFF' : '#666666',
                                 border: '1px solid ' + (overlayOn ? '#1A1A1A' : '#DDDDDD'), cursor: 'pointer' }}>
                        분석 결과 {overlayOn ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => setZoomOpen(false)}
                        className="px-3 py-1.5 text-[11px] text-[#666666] rounded-sm"
                        style={{ background: 'transparent', border: '1px solid #DDDDDD', cursor: 'pointer' }}>
                        닫기
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-5 flex justify-center bg-[#F9F9F7]">
                    {landmarks ? (
                      <LandmarkGuideImage
                        imageUrl={facePhotoUrl || FALLBACK_PHOTO}
                        points={landmarks}
                        itemId={overlayOn && current ? current.id : null}
                        maxWidth={640}
                        alt="얼굴 분석 확대"
                      />
                    ) : (
                      // 대응 모듈이 없는 항목 — 실측 도형이 없다. 사진만 크게 보고 직접 잡는다.
                      <div className="relative" style={{ maxWidth: 640 }}>
                        <img src={facePhotoUrl || FALLBACK_PHOTO} alt="얼굴 확대" className="block w-full h-auto" />
                        {overlayOn && current && OVERLAYS[current.id] && (
                          <svg viewBox="0 0 1414 2000" preserveAspectRatio="xMidYMid meet"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute inset-0 w-full h-full pointer-events-none">
                            <LegacyGuide node={OVERLAYS[current.id]} />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-3 border-t border-[#E8E8E4]">
                    <p className="text-[10px] text-[#999999] leading-relaxed">
                      {landmarks
                        ? '얼굴 좌표로 그린 가이드선입니다. 값은 오른쪽 슬라이더로 조정해주세요.'
                        : '얼굴을 찾지 못했습니다. 사진을 보고 오른쪽 슬라이더로 직접 잡아주세요.'}
                      {' '}‹ › 또는 ← → 키로 항목을 넘길 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-center" style={{ height: 580 }}>

              {/* ── Col 1: Face photo + type display ─────────────────── */}
              <div className="flex flex-col shrink-0" style={{ width: 252 }}>
              <div className="relative overflow-hidden bg-[#F9F9F7] rounded-sm flex items-center justify-center" style={{ height: 516 }}>
                {/* 실측 도형이 있으면 그걸 그린다 — 좌표가 실제 사진 기준이라 얼굴이 바뀌어도 맞는다.
                    없으면(건너뛰기·미매핑 항목) 시안이 예시 사진에 맞춰 그려둔 오버레이로 떨어진다. */}
                {landmarks ? (
                  <div className="relative">
                    <LandmarkGuideImage
                      imageUrl={facePhotoUrl || FALLBACK_PHOTO}
                      points={landmarks}
                      itemId={overlayOn && current ? current.id : null}
                      maxWidth={252}
                    />
                    {guideline && <GuideLines />}
                    {(
                      <button
                        onClick={() => setZoomOpen(true)}
                        className="absolute bottom-2 right-2 px-2 py-1 rounded-sm text-[10px] tracking-[0.04em] text-white"
                        style={{ background: 'rgba(26,26,26,0.75)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer' }}>
                        크게 보기 ⤢
                      </button>
                    )}
                  </div>
                ) : (
                <>
                <img src={facePhotoUrl || FALLBACK_PHOTO} alt="얼굴 분석" className="w-full h-full object-contain" />
                <svg viewBox="0 0 1414 2000" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet"
                  className="absolute inset-0 w-full h-full pointer-events-none">
                  <AnimatePresence mode="wait">
                    {overlayOn && current && OVERLAYS[current.id] && (
                      <motion.g key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                        <LegacyGuide node={OVERLAYS[current.id]} />
                      </motion.g>
                    )}
                  </AnimatePresence>
                </svg>
                {guideline && <GuideLines />}
                {/* 대응 모듈이 없는 항목도 사진을 크게 보고 직접 잡을 수 있어야 한다 */}
                {(
                  <button
                    onClick={() => setZoomOpen(true)}
                    className="absolute bottom-2 right-2 px-2 py-1 rounded-sm text-[10px] tracking-[0.04em] text-white"
                    style={{ background: 'rgba(26,26,26,0.75)', backdropFilter: 'blur(6px)', border: 'none', cursor: 'pointer' }}>
                    크게 보기 ⤢
                  </button>
                )}
                </>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-sm"
                  style={{ background: 'rgba(26,26,26,0.75)', backdropFilter: 'blur(6px)' }}>
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-white"
                    animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 2.2, repeat: Infinity }} />
                  <span className="text-[8px] tracking-[0.16em] text-white" style={{ fontFamily: MONO }}>ANALYZING</span>
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-1 rounded-sm"
                  style={{ background: 'rgba(26,26,26,0.75)', backdropFilter: 'blur(6px)' }}>
                  <span className="text-[8px] tracking-[0.12em] text-white" style={{ fontFamily: MONO }}>
                    {stepIdx + 1}/{items.length}
                  </span>
                </div>
                <button onClick={() => setGuideline(g => !g)}
                  className="absolute bottom-2 left-2 px-2 py-1 rounded-sm text-[9px] tracking-wider transition-colors"
                  style={{
                    fontFamily: MONO,
                    background: guideline ? '#1A1A1A' : 'rgba(255,255,255,0.85)',
                    color: guideline ? '#FFFFFF' : '#6E6E6B',
                    border: '1px solid rgba(0,0,0,0.12)',
                    cursor: 'pointer',
                  }}>
                  가이드
                </button>
                {/* 측정선을 끄고 맨 얼굴을 볼 수 있게 한다. 크게 보기에서도 같은 상태가 유지된다 */}
                <button onClick={() => setOverlayOn(v => !v)}
                  className="absolute bottom-2 left-[70px] px-2 py-1 rounded-sm text-[9px] tracking-wider transition-colors"
                  style={{
                    fontFamily: MONO,
                    background: overlayOn ? '#1A1A1A' : 'rgba(255,255,255,0.85)',
                    color: overlayOn ? '#FFFFFF' : '#6E6E6B',
                    border: '1px solid rgba(0,0,0,0.12)',
                    cursor: 'pointer',
                  }}>
                  분석 {overlayOn ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Type display — centered below photo */}
              <div className="flex flex-col items-center text-center pt-3">
                <p style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: '#AAAAAA', marginBottom: 4 }}>
                  최종  이미지타입
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#111111', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                  {formDominant} × {propDominant}
                </p>
              </div>
              </div>

              {/* ── Col 2: Vertical item list + axis count ────────────── */}
              <div className="flex flex-col shrink-0" style={{ width: 158, height: 516 }}>
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {items.map((it, i) => {
                    const liveT = deriveType(it, getPos(it.id, it.defaultPos));
                    const isSel = i === stepIdx;
                    const initial = liveT.charAt(0);
                    return (
                      <button key={it.id} onClick={() => setStepIdx(i)}
                        className="w-full flex items-center justify-between px-2.5 py-2 transition-colors"
                        style={{
                          background: isSel ? '#1A1A1A' : 'transparent',
                          borderBottom: '1px solid #F0F0EE',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {done[it.id] && (
                            <span style={{ fontSize: 8, color: isSel ? 'rgba(255,255,255,0.5)' : '#AAAAAA', flexShrink: 0 }}>✓</span>
                          )}
                          <span className="text-[11px] truncate"
                            style={{ color: isSel ? '#FFFFFF' : '#333333', fontWeight: isSel ? 500 : 400 }}>
                            {it.num}. {it.title}
                          </span>
                        </div>
                        {(() => {
                          // 자동 분석 모듈이 없는 항목은 처음엔 '—'.
                          // 디자이너가 슬라이더로 잡고 '측정 완료' 를 누르면 그때부터 등급을 보여준다.
                          // '—' 는 실제로 값이 없을 때만 띄운다 (버튼의 '미측정 N개' 와 같은 기준).
                          // 예전에는 매핑표(ANALYZED_ITEM_IDS)만 봐서, 모듈은 있는데 등급을 못 받은 항목이
                          // 등급 글자를 달고도 미측정으로 세어졌다.
                          const pending = posMap[it.id] == null;
                          return (
                            <span className="text-[9px] w-5 text-center shrink-0 ml-1 rounded-sm py-0.5"
                              title={
                                pending
                                  ? (isUnmeasured(it.id)
                                      ? '자동 분석 모듈이 없는 항목 — 슬라이더로 조정 후 측정 완료'
                                      : '분석이 이 항목의 등급을 내지 못했습니다 — 슬라이더로 조정 후 측정 완료')
                                  : undefined
                              }
                              style={{
                                fontFamily: MONO,
                                background: isSel ? 'rgba(255,255,255,0.15)' : '#F0F0EE',
                                color: isSel ? 'rgba(255,255,255,0.75)' : '#999999',
                                opacity: pending ? 0.45 : 1,
                              }}>
                              {pending ? '—' : initial}
                            </span>
                          );
                        })()}
                      </button>
                    );
                  })}
                </div>

                {/* Axis count summary */}
                <div className="pt-2.5 border-t border-[#E8E8E4]" style={{ paddingBottom: 2 }}>
                  <p className="text-[8px] tracking-[0.16em] text-[#AAAAAA] mb-1.5" style={{ fontFamily: MONO }}>
                    {axisLabels.join(' · ')}
                  </p>
                  <div className="flex gap-2">
                    {axisLabels.map(label => (
                      <div key={label} className="flex items-baseline gap-1">
                        <span className="text-[10px] text-[#888888]">{label}</span>
                        <span className="text-[16px] font-light text-[#1A1A1A]" style={{ fontFamily: MONO }}>
                          {axisCounts[label] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Col 3: Detail panel ───────────────────────────────── */}
              <div className="flex-1 min-w-0 overflow-y-auto" style={{ height: 516, scrollbarWidth: 'none' }}>
                {current && (
                  <AnimatePresence mode="wait">
                    <motion.div key={current.id}
                      initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}>

                      <div className="flex items-start justify-between mb-1">
                        <p className="text-[13px] font-semibold tracking-tight leading-tight">{current.num}. {current.title}</p>
                        <AnimatePresence mode="wait">
                          <motion.span key={liveType}
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="text-[9px] px-1.5 py-px bg-[#1A1A1A] rounded-sm text-white shrink-0 mt-0.5 ml-2"
                            style={{ fontFamily: MONO }}>
                            {liveType}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                      <p className="text-[10px] text-[#888888] mb-3">
                        현재 값 — <span className="text-[#1A1A1A] font-medium">{deriveValue(current, pos)}</span>
                      </p>

                      {/* 자동 분석 대상이 아닌 항목임을 분명히 알린다 — 값이 실측이 아니라 기본값이다 */}
                      {/* 값이 없는 항목 안내. 이유가 둘이라 문구를 나눈다 —
                          (1) 우리 분석에 대응 모듈이 아예 없는 항목
                          (2) 모듈은 있는데 이 사진에서 등급이 안 나온 항목 */}
                      {posMap[current.id] == null && (
                        <div className="mb-3 px-2.5 py-2 rounded-sm border border-[#E8E4D8] bg-[#FBF8F0]">
                          <p className="text-[10px] text-[#8A7645] leading-relaxed">
                            {isUnmeasured(current.id)
                              ? '자동 분석 모듈이 없는 항목입니다.'
                              : '이 사진에서는 자동 분석이 등급을 내지 못했습니다.'}
                            {' '}아래 값은 측정값이 아닌 기본값이므로 슬라이더로 조정한 뒤{' '}
                            <b>측정 완료</b>를 눌러주세요.
                          </p>
                        </div>
                      )}
                      {posMap[current.id] != null && isUnmeasured(current.id) && (
                        <div className="mb-3 px-2.5 py-2 rounded-sm border border-[#DDE6DD] bg-[#F3F7F3]">
                          <p className="text-[10px] text-[#4C7A55] leading-relaxed">
                            디자이너가 직접 정한 값입니다. 자동 분석 결과가 아닙니다.
                          </p>
                        </div>
                      )}

                      <AdjustSlider pos={pos} l={current.l} r={current.r}
                        onChange={v => {
                          setPosMap(m => ({ ...m, [current.id]: v }));
                          // 손으로 움직인 순간부터는 자동 분석값이 아니라 디자이너가 정한 값이다.
                          setDone(d => ({ ...d, [current.id]: true }));
                        }} />

                      <div className="my-3 h-px bg-[#E8E8E4]" />

                      <p className="text-[9px] tracking-[0.2em] text-[#AAAAAA] mb-1" style={{ fontFamily: MONO }}>이미지 영향</p>
                      <AnimatePresence mode="wait">
                        <motion.p key={liveDesc}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[11px] leading-[1.75] mb-3"
                          style={{ color: liveType === 'Cool' ? '#1C3070' : liveType === 'Hard' ? '#7A3A10' : '#333333' }}>
                          {liveDesc}
                        </motion.p>
                      </AnimatePresence>

                      <div className="bg-[#F7F7F5] rounded-sm p-3 mb-4">
                        <p className="text-[9px] tracking-[0.2em] text-[#AAAAAA] mb-1" style={{ fontFamily: MONO }}>대표 성향</p>
                        <AnimatePresence mode="wait">
                          <motion.p key={liveType}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="text-[18px] font-light tracking-tight text-[#1A1A1A] mb-1">
                            {liveType}
                          </motion.p>
                        </AnimatePresence>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {liveTags.map(t => <span key={t} className="text-[10px] text-[#888888]">{t}</span>)}
                        </div>
                        {liveBd.map(b => <PctBar key={b.label} {...b} />)}
                      </div>

                      {/* 값이 없는 항목에서만 '측정 완료' 를 띄운다.
                          값이 이미 있으면(자동 분석 or 디자이너 확정) 버튼 대신 출처만 표시한다 —
                          슬라이더는 계속 움직일 수 있고, 움직이면 '디자이너 확정' 으로 바뀐다. */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#E8E8E4]">
                        <p className="text-[9px] tracking-[0.16em] text-[#AAAAAA]" style={{ fontFamily: MONO }}>MEASUREMENT</p>
                        {posMap[current.id] == null ? (
                          <button
                            onClick={() => {
                              // 슬라이더를 안 움직였어도 지금 위치를 값으로 확정한다 —
                              // 그래야 판정에 들어가고 '미측정 남음' 이 풀린다.
                              setPosMap(m => ({ ...m, [current.id]: m[current.id] ?? pos }));
                              setDone(d => ({ ...d, [current.id]: true }));
                              // 확정했으면 손이 멈추지 않게 다음 항목으로 넘긴다.
                              goItem(1);
                            }}
                            className="px-3 py-1.5 text-[11px] tracking-[0.06em] rounded-sm transition-colors"
                            style={{ background: '#1A1A1A', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}>
                            측정 완료 →
                          </button>
                        ) : (
                          <span
                            className="px-2.5 py-1.5 text-[10px] tracking-[0.06em] rounded-sm"
                            style={{ background: '#F2F4F2', color: '#4C7A55' }}>
                            {done[current.id] || isUnmeasured(current.id) ? '✓ 디자이너 확정' : '✓ 자동 측정됨'}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

            </div>
            </>
          );
        })()}

        {/* ── 타입 예시 사진 ─────────────────────────────────────────── */}
        <section className="mt-12 pt-8 border-t border-[#DCE4E9]">
          <p className="text-[12px] tracking-[0.2em] text-[#777777] mb-1.5" style={{ fontFamily: MONO }}>TYPE EXAMPLES</p>
          <h2 className="text-[1.1rem] font-light text-[#292625] tracking-tight mb-1">타입 예시</h2>
          <p className="text-[12px] text-[#777777] mb-4">타입별로 어떤 인상인지 예시 사진으로 비교해 보세요.</p>

          {/* 상단 바 — 형태 / 비율을 누르면 해당 예시가 보인다 */}
          <div className="flex border-b border-[#E0E0E0] mb-4">
            {TYPE_EXAMPLES.map((ex, i) => (
              <button key={ex.zone} onClick={() => setExampleIdx(i)}
                className="relative pb-3 mr-8 text-[14px] tracking-tight"
                style={{ fontWeight: i === exampleIdx ? 600 : 400, color: i === exampleIdx ? '#292625' : '#AAAAAA', background: 'none', border: 'none', cursor: 'pointer' }}>
                {ex.zone}
                {i === exampleIdx && <motion.div layoutId="extab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#4B2928]" />}
              </button>
            ))}
          </div>
          <div className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${TYPE_EXAMPLES[exampleIdx].cols}, minmax(0, 1fr))` }}>
            {TYPE_EXAMPLES[exampleIdx].types.map(t => (
              <figure key={t.label} className="m-0">
                <div className="relative overflow-hidden bg-[#F9F9F7] rounded-sm flex items-center justify-center"
                  style={{ aspectRatio: '3 / 4', border: t.photo ? 'none' : '1px dashed #CCCCCA' }}>
                  {t.photo
                    ? <img src={t.photo} alt={`${TYPE_EXAMPLES[exampleIdx].zone} ${t.label} 예시`} className="w-full h-full object-cover" />
                    : <span className="text-[12px] text-[#AAAAAA]">예시 사진 준비 중</span>}
                </div>
                <figcaption className="mt-2 text-center text-[14px] text-[#292625]">{t.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

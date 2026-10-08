'use client';

/**
 * 분석 중 화면 모션그래픽 5종 비교용 개발 페이지. (2026-10-09)
 * 로그인 없이 예시 사진으로 다섯 연출을 동시에 반복 재생한다. 운영 빌드에서는 열리지 않는다.
 */

import { Suspense, useEffect, useState } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import { FaceScanVisual, FACE_SCAN_VARIANTS } from '@/components/new/FaceScanVisual';
import { STEP_MS, useTessellation } from '@/components/new/FaceAnalysisProcessing';
import { useFaceLandmarks } from '@/components/new/useFaceLandmarks';

const PHOTO = '/new/face-photo.jpg';
const STEP_LABELS = ['랜드마크 추출', '비율 계산', '이미지 타입 도출'];
/** 3단계 + 끝난 모습 잠깐 보여주기 */
const HOLD_MS = 1500;

export default function FaceMotionPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><FaceMotionPreview /></Suspense>;
}

function FaceMotionPreview() {
  const { points, loading, error } = useFaceLandmarks(PHOTO);
  const tessellation = useTessellation(true);
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  // ?step=0|1|2 로 열면 그 단계에서 멈춘다 (캡처용)
  const s = useSearchParams().get('step');
  const frozen = s !== null && [0, 1, 2].includes(Number(s)) ? Number(s) : null;

  useEffect(() => {
    if (!points || frozen !== null) return;
    const t = setTimeout(() => {
      if (step < 2) setStep(step + 1);
      else { setStep(0); setRound((r) => r + 1); }
    }, step < 2 ? STEP_MS : STEP_MS + HOLD_MS);
    return () => clearTimeout(t);
  }, [step, points, round, frozen]);

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <h1 className="text-xl font-light tracking-wide text-black text-center mb-2">
        분석 중 화면 모션그래픽 — 5가지 시안
      </h1>
      <p className="text-sm text-gray-500 text-center mb-8">
        {loading ? '얼굴 점 찾는 중…' : error ? error : `지금 단계: ${STEP_LABELS[frozen ?? step]}`}
      </p>
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-10">
        {FACE_SCAN_VARIANTS.map((v) => (
          <div key={v.id} className="flex flex-col items-center gap-3">
            <FaceScanVisual
              key={round}
              photoUrl={PHOTO}
              points={points}
              step={frozen ?? step}
              variant={v.id}
              tessellation={tessellation}
              sizeClass="max-w-[240px] max-h-[340px]"
            />
            <div className="text-center">
              <p className="text-sm text-black">{v.id}. {v.name}</p>
              <p className="text-xs text-gray-500">{v.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

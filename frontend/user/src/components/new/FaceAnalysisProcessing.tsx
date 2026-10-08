'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock } from 'lucide-react';
import { useFaceLandmarks } from './useFaceLandmarks';
import { FaceScanVisual, type FaceScanVariant } from './FaceScanVisual';

interface FaceAnalysisProcessingProps {
  /** 방금 찍은 얼굴 사진. 없으면(개발용 건너뛰기 등) 사진 없이 단계 글자만 진행된다 */
  facePhotoUrl?: string | null;
  /** 얼굴 모션그래픽 연출 (FaceScanVisual 참고) */
  variant?: FaceScanVariant;
  onComplete: () => void;
}

/**
 * 분석 중 화면. 예전에는 글자 3줄과 빙글 도는 원뿐이라 "무엇을 분석하는지" 보이지 않아
 * 고객 얼굴 위에 단계별 모션그래픽을 얹었다. (2026-10-09)
 * 여기서 불러온 랜드마크 모델은 다음 화면(이목구비)이 그대로 재사용하므로 그쪽 대기도 줄어든다.
 */

export const STEP_MS = 2000;
/** 첫 진입 때 모델 내려받기가 길어지면 이만큼까지만 더 기다린다 */
const MAX_EXTRA_WAIT_MS = 4000;

/** 메쉬 연결선 목록은 라이브러리에 상수로 들어 있다. 훅이 이미 같은 모듈을 불러오므로 추가 비용이 없다 */
export function useTessellation(enabled: boolean) {
  const [tess, setTess] = useState<{ start: number; end: number }[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    import('@mediapipe/tasks-vision')
      .then((m) => { if (alive) setTess(m.FaceLandmarker.FACE_LANDMARKS_TESSELATION); })
      .catch(() => {});
    return () => { alive = false; };
  }, [enabled]);
  return tess;
}

export function FaceAnalysisProcessing({ facePhotoUrl, variant = 1, onComplete }: FaceAnalysisProcessingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = ['랜드마크 추출 중…', '비율 계산 중…', '이미지 타입 도출 중…'];

  const { points, loading } = useFaceLandmarks(facePhotoUrl);
  const tessellation = useTessellation(!!facePhotoUrl && variant === 1);

  // 단계 진행. 마지막 단계에서는 랜드마크가 다 나올 때까지(최대 MAX_EXTRA_WAIT_MS) 기다린다
  const [lastStepDone, setLastStepDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
      else setLastStepDone(true);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [currentStep, steps.length]);

  const [forceDone, setForceDone] = useState(false);
  useEffect(() => {
    if (!lastStepDone) return;
    const t = setTimeout(() => setForceDone(true), MAX_EXTRA_WAIT_MS);
    return () => clearTimeout(t);
  }, [lastStepDone]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (!lastStepDone || completedRef.current) return;
    if (loading && !forceDone) return;
    completedRef.current = true;
    onComplete();
  }, [lastStepDone, loading, forceDone, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10"
    >
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mb-3 text-xs tracking-[0.25em] text-gray-500 font-normal uppercase text-center"
      >
        AI Face Analysis
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="text-xl md:text-2xl font-light tracking-wide text-black mb-8 text-center"
      >
        얼굴, 이목구비 정밀 분석을 진행 중입니다
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
        className="mb-8"
      >
        <FaceScanVisual
          photoUrl={facePhotoUrl}
          points={points}
          step={currentStep}
          variant={variant}
          tessellation={tessellation}
        />
      </motion.div>

      {/* 단계별 텍스트 */}
      <div className="min-h-[96px] flex flex-col items-center justify-start space-y-3 mb-8">
        {steps.map((step, index) => (
          <AnimatePresence key={index}>
            {index <= currentStep && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: index === currentStep ? 1 : 0.4, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <p
                  className={`text-sm md:text-base font-normal tracking-wide flex items-center gap-1 ${
                    index === currentStep ? 'text-black' : 'text-gray-500'
                  }`}
                >
                  {step.replace('…', '')}
                  {index === currentStep && (
                    <span className="inline-flex gap-0.5">
                      {[0, 0.2, 0.4].map((delay) => (
                        <motion.span
                          key={delay}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay }}
                        >
                          .
                        </motion.span>
                      ))}
                    </span>
                  )}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="flex items-center gap-2 text-xs text-gray-500 font-normal"
      >
        <Lock className="w-3 h-3" strokeWidth={1.5} />
        <span className="tracking-wide">사진 데이터는 분석 외 용도로 저장되지 않습니다.</span>
      </motion.div>
    </motion.div>
  );
}

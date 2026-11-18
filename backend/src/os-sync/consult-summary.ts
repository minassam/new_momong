/**
 * 컨설팅 기록 → 모몽 OS 고객 기록에 남길 짧은 요약.
 *
 * FIT 은 칸마다 한글 값이 그대로 저장되고, 3WAY · 1WAY 는 client_info.threeWay 안에
 * 화면 상태가 통째로 들어 있다(스타일은 id 로). 여기서 둘 다 읽어 사람이 읽는 글로 만든다.
 * 1WAY 스타일 id → 이름 표는 frontend/user/src/components/new/HairConsulting.tsx 의
 * *_OPTIONS 와 같아야 한다 — 그쪽에 옵션을 더하면 여기도 같이 더할 것.
 */

export interface OsSummary {
  imageType?: string;
  target?: string;
  keywords?: string[];
  condition?: string[];
  design?: string[];
  next?: string[];
  cycle?: string[];
  note?: string;
}

const STYLE_LABEL: Record<string, Record<string, string>> = {
  bangs: { full: '풀뱅', choppy: '처피뱅', seethrough: '시스루뱅', side: '사이드뱅', wispy: '잔머리', stick: '스틱뱅' },
  parting: { '55': '5:5 가르마', '64': '6:4 가르마', '73': '7:3 가르마' },
  length: { short: '숏', bob: '단발', medium: '미디움', long: '롱' },
  curl: { straight: '스트레이트', wave: '웨이브', ccurl: 'C컬', scurl: 'S컬', cscurl: 'CS컬' },
  color: { tonedown: '톤다운', toneup: '톤업', roots: '뿌리', bleach: '탈색', keep: '현재 상태 유지' },
};
const AXIS_KO: Record<string, string> = { bangs: '앞머리', parting: '가르마', length: '길이', curl: '컬', color: '컬러' };
const SERVICE_KO: Record<string, string> = {
  CUT: '커트', BANG: '앞머리', PERM: '펌', ROOT_PERM: '뿌리펌', STRAIGHT: '매직/스트레이트',
  COLOR: '전체 염색', ROOT_COLOR: '뿌리 염색', BLEACH: '탈색', CLINIC: '클리닉', SCALP: '두피 관리',
  cut: '커트', perm: '펌', color: '염색', clinic: '클리닉',
};
const FACE_TYPE_KO: Record<string, string> = { warm: 'WARM 타입', neutral: 'NEUTRAL 타입', cool: 'COOL 타입' };

const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v ? [v] : []).map((x) => str(x)).filter(Boolean);
const joinMemo = (vals: unknown, memo: unknown) => {
  const a = list(vals).join(', ');
  const m = str(memo);
  return [a, m].filter(Boolean).join(' — ');
};
const typeName = (t: any): string => {
  if (!t) return '';
  if (typeof t === 'string') return t;
  const ko = str(t.ko), en = str(t.en);
  return ko && en ? `${ko} (${en})` : ko || en;
};

export function buildOsSummary(c: {
  client_info?: any; face_image_type?: any; today_keyword?: any; fashion_style?: any;
  hair_condition?: any; today_design?: any; next_direction?: any; design_cycle_guide?: any; after_note?: string;
}): OsSummary {
  const tw: any = c.client_info?.threeWay || {};
  const hc: any = tw.hairConsulting || {};
  const out: OsSummary = {};

  // 이미지 타입: 1WAY 최종 타입 → 헤어컨설팅 현재 타입 → 3WAY 얼굴 분석 → FIT
  out.imageType =
    typeName(tw.finalImageType) || typeName(hc.currentType) || str(tw.faceAnalysis?.imageType) ||
    FACE_TYPE_KO[str(c.face_image_type?.type)] || str(c.face_image_type?.type);
  out.target = typeName(hc.targetType);

  const tk = c.today_keyword || {};
  out.keywords = [...list(tk.faceConcerns), ...list(tk.hairConcerns), ...list(tk.imageKeywords), ...list(c.fashion_style?.selected)];

  // 모발 상태 (FIT 은 한글 값, 1WAY 는 단계 id 라 FIT 쪽만)
  const h = c.hair_condition || {};
  out.condition = [
    str(h.damageLevel) && `손상도 ${str(h.damageLevel)}`, str(h.thickness) && `굵기 ${str(h.thickness)}`,
    str(h.density) && `숱 ${str(h.density)}`, str(h.curl) && `곱슬 ${str(h.curl)}`,
  ].filter(Boolean) as string[];

  // 오늘 디자인: FIT TODAY DESIGN / 1WAY 스타일 제안 5축 / 3WAY 오늘 시술
  const td = c.today_design || {};
  const design: string[] = [];
  ([['길이', td.length, td.lengthMemo], ['앞머리', td.bangs, td.bangsMemo], ['컬/질감', td.curlTexture, td.curlTextureMemo], ['컬러', td.color, td.colorMemo]] as const)
    .forEach(([k, v, m]) => { const t = joinMemo(v, m); if (t) design.push(`${k} ${t}`); });
  if (hc.style && typeof hc.style === 'object') {
    Object.keys(AXIS_KO).forEach((axis) => {
      const ids = list(hc.style[axis]);
      if (ids.length) design.push(`${AXIS_KO[axis]} ${ids.map((id) => STYLE_LABEL[axis]?.[id] || id).join(', ')}`);
    });
  }
  const cyc: any = tw.cycleData || {};
  const today = list(cyc.todayServices).map((s) => SERVICE_KO[s] || s);
  if (today.length) design.push(`오늘 시술 ${today.join(', ')}`);
  out.design = design;

  // 다음 방향
  const nd = c.next_direction || {};
  const next = [...list(nd.lengthChange), ...list(nd.colorChange), ...list(nd.others)];
  if (Array.isArray(cyc.directions)) cyc.directions.forEach((d: any) => { const t = str(d?.label) || str(d); if (t) next.push(t); });
  if (cyc.subSelections && typeof cyc.subSelections === 'object') Object.values(cyc.subSelections).forEach((v) => { const t = str(v); if (t) next.push(t); });
  if (cyc.nextDesign) next.push(`다음 디자인 약 ${cyc.nextDesign.minWeeks}–${cyc.nextDesign.maxWeeks}주 후${list(cyc.nextDesign.services).length ? ' · ' + list(cyc.nextDesign.services).join(', ') : ''}`);
  out.next = [...new Set(next)];

  // 관리 주기: 1WAY 주 단위 일정 → 월 단위(FIT · 3WAY)
  const cycle: string[] = [];
  if (Array.isArray(cyc.cycleEvents)) cyc.cycleEvents.forEach((e: any) => {
    const when = [str(e?.monthHint), str(e?.label)].filter(Boolean).join(' · ');
    const what = [list(e?.services).join(', '), str(e?.purpose)].filter(Boolean).join(' — ');
    if (when || what) cycle.push([when, what].filter(Boolean).join(' '));
  });
  const months = Array.isArray(c.design_cycle_guide?.selectedMonths) && c.design_cycle_guide.selectedMonths.length
    ? c.design_cycle_guide.selectedMonths : !cycle.length && Array.isArray(cyc.selectedMonths) ? cyc.selectedMonths : [];
  months.forEach((m: any) => {
    const mon = str(m?.month); const sv = list(m?.services).map((s) => SERVICE_KO[s] || s).join(', ');
    const t = [mon && (/월$/.test(mon) ? mon : mon + '월'), sv, str(m?.memo)].filter(Boolean).join(' ');
    if (t) cycle.push(t);
  });
  out.cycle = cycle.slice(0, 12);
  out.note = str(c.after_note);

  (Object.keys(out) as (keyof OsSummary)[]).forEach((k) => {
    const v = out[k];
    if (!v || (Array.isArray(v) && !v.length)) delete out[k];
  });
  return out;
}

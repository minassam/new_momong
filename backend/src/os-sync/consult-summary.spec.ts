import { buildOsSummary } from './consult-summary';

describe('buildOsSummary', () => {
  it('FIT 기록을 읽는다', () => {
    const s = buildOsSummary({
      client_info: { name: '홍길동', course: 'FIT' },
      face_image_type: { type: 'warm' },
      today_keyword: { faceConcerns: ['광대'], hairConcerns: ['앞머리'], imageKeywords: ['부드러운'] },
      hair_condition: { damageLevel: '중손상', thickness: '보통' },
      today_design: { length: ['미디움'], lengthMemo: '쇄골선', bangs: ['시스루뱅'], bangsMemo: '', curlTexture: [], color: [] },
      next_direction: { lengthChange: ['길이 변화'], colorChange: [], others: [] },
      design_cycle_guide: { selectedMonths: [{ month: '12', services: ['커트'], memo: '' }] },
      after_note: '옆볼륨은 눌러 말리기',
    });
    expect(s.imageType).toBe('WARM 타입');
    expect(s.design).toEqual(['길이 미디움 — 쇄골선', '앞머리 시스루뱅']);
    expect(s.condition).toEqual(['손상도 중손상', '굵기 보통']);
    expect(s.cycle).toEqual(['12월 커트']);
    expect(s.note).toBe('옆볼륨은 눌러 말리기');
  });

  it('1WAY 기록(threeWay)을 읽고 스타일 id 를 이름으로 바꾼다', () => {
    const s = buildOsSummary({
      client_info: {
        threeWay: {
          finalImageType: { en: 'FRESH', ko: '프레시한' },
          hairConsulting: { targetType: { en: 'CHIC', ko: '시크한' }, style: { bangs: ['seethrough'], length: 'medium', curl: [], color: ['toneup'] } },
          cycleData: { todayServices: ['CUT', 'COLOR'], cycleEvents: [{ monthHint: '1월', label: '약 8주 후', services: ['커트'], purpose: '라인 점검' }] },
        },
      },
    });
    expect(s.imageType).toBe('프레시한 (FRESH)');
    expect(s.target).toBe('시크한 (CHIC)');
    expect(s.design).toEqual(['앞머리 시스루뱅', '길이 미디움', '컬러 톤업', '오늘 시술 커트, 전체 염색']);
    expect(s.cycle).toEqual(['1월 · 약 8주 후 커트 — 라인 점검']);
  });

  it('빈 기록은 빈 요약', () => {
    expect(buildOsSummary({ client_info: {} })).toEqual({});
  });
});

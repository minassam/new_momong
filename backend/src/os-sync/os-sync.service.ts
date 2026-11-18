import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation } from '../consultations/consultations.entity';
import { User } from '../auth/users.entity';
import { ConsultationShare } from '../shares/shares.entity';
import { buildOsSummary } from './consult-summary';

/**
 * 모몽 OS(메르시모몽 직원 앱) 고객 기록으로 컨설팅 리포트를 보낸다.
 *
 * - 상담 저장 · 수정 · 삭제, 공유 링크 만들기 때 부른다. 기다리지 않고(fire-and-forget) 실패해도
 *   컨설팅 저장은 그대로 — 다음에 같은 상담을 저장하면 다시 보낸다.
 * - env `MOMONG_OS_URL`(예: https://merci-care.<계정>.workers.dev) 과 `MOMONG_OS_KEY`
 *   (모몽 OS 시크릿 CONSULT_REPORT_KEY 와 같은 값) 둘 다 있어야 동작한다. 없으면 아무것도 안 함.
 * - 모몽 OS 는 전화번호 + 이름으로 자기 고객을 찾아 붙인다.
 */
@Injectable()
export class OsSyncService {
  private readonly log = new Logger('OsSync');

  constructor(
    @InjectRepository(Consultation) private readonly consultRepo: Repository<Consultation>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ConsultationShare) private readonly shareRepo: Repository<ConsultationShare>,
  ) {}

  private get target() {
    const url = (process.env.MOMONG_OS_URL || '').replace(/\/+$/, '');
    const key = process.env.MOMONG_OS_KEY || '';
    return url && key ? { url, key } : null;
  }

  /** 상담 한 건을 보낸다 (id 로 다시 읽어 최신 값 + 공유 링크까지) */
  pushConsultation(id: string): void {
    if (!this.target) return;
    this.send(id).catch((err) => this.log.warn(`push ${id} failed: ${err?.message || err}`));
  }

  pushDelete(id: string): void {
    const t = this.target;
    if (!t) return;
    this.post({ id, del: 1 }).catch((err) => this.log.warn(`delete ${id} failed: ${err?.message || err}`));
  }

  private async send(id: string) {
    const c = await this.consultRepo.findOne({ where: { id } });
    if (!c) return;
    const user = c.user_id ? await this.userRepo.findOne({ where: { id: c.user_id } }) : null;
    const share = await this.shareRepo.findOne({ where: { consultation_id: id } });
    const base = process.env.FRONTEND_URL || '';
    const ci: any = c.client_info || {};
    await this.post({
      id: c.id,
      store: user?.store_name || '',
      designer: c.designer_name || user?.owner_name || '',
      date: c.visit_date,
      course: ci.course || 'FIT',
      customer: { name: ci.name || '', phone: ci.phone || '', gender: ci.gender || '', ageGroup: ci.ageGroup || '' },
      summary: buildOsSummary(c),
      shareUrl: share && base ? `${base}/share/${share.token}` : '',
      sharePw: share?.password_plain || '',
    });
  }

  private async post(body: Record<string, unknown>) {
    const t = this.target;
    if (!t) return;
    const res = await fetch(`${t.url}/api/consult-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-merci-key': t.key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 200));
  }
}

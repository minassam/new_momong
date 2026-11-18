import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ConsultationShare } from './shares.entity';
import { Consultation } from '../consultations/consultations.entity';
import { OsSyncService } from '../os-sync/os-sync.service';

@Injectable()
export class SharesService {
  constructor(
    @InjectRepository(ConsultationShare)
    private readonly shareRepo: Repository<ConsultationShare>,
    @InjectRepository(Consultation)
    private readonly consultationRepo: Repository<Consultation>,
    private readonly osSync: OsSyncService,
  ) {}

  async createShare(
    consultationId: string,
    password: string,
    userId: string,
  ): Promise<{ token: string }> {
    const consultation = await this.consultationRepo.findOne({
      where: { id: consultationId, user_id: userId },
    });
    if (!consultation) throw new NotFoundException('컨설팅을 찾을 수 없습니다');

    // 기존 share 있으면 삭제 후 새로 생성
    await this.shareRepo.delete({ consultation_id: consultationId });

    const token = randomBytes(32).toString('hex');
    const password_hash = await bcrypt.hash(password, 10);

    const share = this.shareRepo.create({
      token,
      consultation_id: consultationId,
      password_hash,
      password_plain: password,
    });
    await this.shareRepo.save(share);
    this.osSync.pushConsultation(consultationId); // 모몽 OS 고객 기록에 리포트 링크도

    return { token };
  }

  async getShareByConsultation(consultationId: string, userId: string) {
    const consultation = await this.consultationRepo.findOne({
      where: { id: consultationId, user_id: userId },
    });
    if (!consultation) throw new NotFoundException('컨설팅을 찾을 수 없습니다');

    const share = await this.shareRepo.findOne({
      where: { consultation_id: consultationId },
    });
    if (!share) return null;

    const baseUrl = process.env.FRONTEND_URL || '';
    return {
      token: share.token,
      password: share.password_plain,
      url: baseUrl ? `${baseUrl}/share/${share.token}` : `/share/${share.token}`,
    };
  }

  async verifyAndGetConsultation(token: string, password: string) {
    const share = await this.shareRepo.findOne({
      where: { token },
      relations: ['consultation'],
    });
    if (!share) throw new NotFoundException('링크를 찾을 수 없습니다');

    if (share.expires_at && share.expires_at < new Date()) {
      throw new UnauthorizedException('만료된 링크입니다');
    }

    const isValid = await bcrypt.compare(password, share.password_hash);
    if (!isValid) throw new UnauthorizedException('비밀번호가 올바르지 않습니다');

    const c = share.consultation;
    return {
      id: c.id,
      visitDate: c.visit_date,
      designerName: c.designer_name,
      afterNote: c.after_note,
      clientInfo: c.client_info,
      todayKeyword: c.today_keyword,
      fashionStyle: c.fashion_style,
      faceImageType: c.face_image_type,
      hairCondition: c.hair_condition,
      hairStyleProposal: c.hair_style_proposal,
      todayDesign: c.today_design,
      nextDirection: c.next_direction,
      designCycleGuide: c.design_cycle_guide,
    };
  }
}

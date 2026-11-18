import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation } from './consultations.entity';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { CustomersService } from '../customers/customers.service';
import { OsSyncService } from '../os-sync/os-sync.service';

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectRepository(Consultation)
    private readonly repo: Repository<Consultation>,
    private readonly customersService: CustomersService,
    private readonly osSync: OsSyncService,
  ) {}

  private generateId(): string {
    return `consult_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private toRecord(consultation: Consultation) {
    return {
      id: consultation.id,
      createdAt: consultation.created_at,
      visitDate: consultation.visit_date,
      designerName: consultation.designer_name,
      afterNote: consultation.after_note,
      clientInfo: consultation.client_info,
      todayKeyword: consultation.today_keyword,
      fashionStyle: consultation.fashion_style,
      faceImageType: consultation.face_image_type,
      hairCondition: consultation.hair_condition,
      hairStyleProposal: consultation.hair_style_proposal,
      todayDesign: consultation.today_design,
      nextDirection: consultation.next_direction,
      designCycleGuide: consultation.design_cycle_guide,
    };
  }

  async create(userId: string, dto: CreateConsultationDto) {
    const id = dto.id || this.generateId();
    const { clientInfo } = dto;

    // 고객 연결: customerId 가 오면 그대로 사용(소유 검증), 없으면 레거시로 전화번호 upsert
    let customerId: string | undefined;
    if (dto.customerId) {
      try {
        const owned = await this.customersService.findOne(userId, dto.customerId);
        customerId = owned.id;
      } catch {
        // 내 고객이 아니거나 없는 id → 아래 전화번호 폴백
      }
    }
    if (!customerId && clientInfo?.name) {
      try {
        const customer = await this.customersService.upsertByPhone(userId, {
          name: clientInfo.name,
          phone: clientInfo.phone,
          gender: clientInfo.gender,
          age_group: clientInfo.ageGroup,
        });
        customerId = customer.id;
      } catch (err) {
        console.warn('Customer upsert failed (non-fatal):', err);
      }
    }

    const consultation = this.repo.create({
      id,
      user_id: userId,
      customer_id: customerId,
      visit_date: dto.visitDate || new Date().toLocaleDateString('ko-KR'),
      designer_name: dto.designerName,
      after_note: dto.afterNote,
      client_info: dto.clientInfo || {},
      today_keyword: dto.todayKeyword || {},
      fashion_style: dto.fashionStyle || {},
      face_image_type: dto.faceImageType || {},
      hair_condition: dto.hairCondition || {},
      hair_style_proposal: dto.hairStyleProposal || {},
      today_design: dto.todayDesign || {},
      next_direction: dto.nextDirection || {},
      design_cycle_guide: dto.designCycleGuide || {},
    });

    const saved = await this.repo.save(consultation);
    this.osSync.pushConsultation(id); // 모몽 OS 고객 기록으로 (실패해도 저장은 그대로)
    return { id, consultation: this.toRecord(saved) };
  }

  async findAll(userId: string) {
    const records = await this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
    return records.map((r) => this.toRecord(r));
  }

  async findOne(userId: string, id: string) {
    const record = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!record) throw new NotFoundException('컨설팅을 찾을 수 없습니다');
    return this.toRecord(record);
  }

  async findByCustomerPhone(userId: string, phone: string) {
    const records = await this.repo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere("c.client_info->>'phone' = :phone", { phone })
      .orderBy('c.created_at', 'DESC')
      .getMany();
    return records.map((r) => this.toRecord(r));
  }

  async findByCustomerId(userId: string, customerId: string) {
    const records = await this.repo.find({
      where: { user_id: userId, customer_id: customerId },
      order: { created_at: 'DESC' },
    });
    return records.map((r) => this.toRecord(r));
  }

  async update(userId: string, id: string, dto: CreateConsultationDto) {
    const record = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!record) throw new NotFoundException('컨설팅을 찾을 수 없습니다');

    if (dto.clientInfo !== undefined) record.client_info = dto.clientInfo;
    if (dto.todayKeyword !== undefined) record.today_keyword = dto.todayKeyword;
    if (dto.fashionStyle !== undefined) record.fashion_style = dto.fashionStyle;
    if (dto.faceImageType !== undefined) record.face_image_type = dto.faceImageType;
    if (dto.hairCondition !== undefined) record.hair_condition = dto.hairCondition;
    if (dto.hairStyleProposal !== undefined) record.hair_style_proposal = dto.hairStyleProposal;
    if (dto.todayDesign !== undefined) record.today_design = dto.todayDesign;
    if (dto.nextDirection !== undefined) record.next_direction = dto.nextDirection;
    if (dto.designCycleGuide !== undefined) record.design_cycle_guide = dto.designCycleGuide;
    if (dto.designerName !== undefined) record.designer_name = dto.designerName;
    if (dto.visitDate !== undefined) record.visit_date = dto.visitDate;
    if (dto.afterNote !== undefined) record.after_note = dto.afterNote;

    const saved = await this.repo.save(record);
    this.osSync.pushConsultation(id);
    return { consultation: this.toRecord(saved) };
  }

  async remove(userId: string, id: string): Promise<void> {
    const record = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!record) throw new NotFoundException('컨설팅을 찾을 수 없습니다');
    await this.repo.remove(record);
    this.osSync.pushDelete(id);
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consultation } from '../consultations/consultations.entity';
import { User } from '../auth/users.entity';
import { ConsultationShare } from '../shares/shares.entity';
import { OsSyncService } from './os-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Consultation, User, ConsultationShare])],
  providers: [OsSyncService],
  exports: [OsSyncService],
})
export class OsSyncModule {}

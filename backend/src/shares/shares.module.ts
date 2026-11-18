import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultationShare } from './shares.entity';
import { Consultation } from '../consultations/consultations.entity';
import { SharesService } from './shares.service';
import { SharesController } from './shares.controller';
import { OsSyncModule } from '../os-sync/os-sync.module';

@Module({
  imports: [TypeOrmModule.forFeature([ConsultationShare, Consultation]), OsSyncModule],
  controllers: [SharesController],
  providers: [SharesService],
})
export class SharesModule {}

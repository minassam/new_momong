import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consultation } from './consultations.entity';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';
import { CustomersModule } from '../customers/customers.module';
import { OsSyncModule } from '../os-sync/os-sync.module';

@Module({
  imports: [TypeOrmModule.forFeature([Consultation]), CustomersModule, OsSyncModule],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
})
export class ConsultationsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CotizacionesController } from './cotizaciones.controller';
import { PagosController } from './pagos.controller';
import { CotizacionesService } from './cotizaciones.service';
import { PagosService } from './pagos.service';
import { CotizacionPdfService } from './cotizacion-pdf.service';
import { PayPhoneService } from './payphone.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [CotizacionesController, PagosController],
  providers: [CotizacionesService, PagosService, CotizacionPdfService, PayPhoneService],
  exports: [CotizacionesService, PagosService, CotizacionPdfService, PayPhoneService],
})
export class PagosModule {}

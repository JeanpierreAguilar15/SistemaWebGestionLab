import { Module, forwardRef } from '@nestjs/common';
import { ResultadosController } from './resultados.controller';
import { ResultadosService } from './resultados.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => EventsModule),
    forwardRef(() => InventarioModule),
  ],
  controllers: [ResultadosController],
  providers: [ResultadosService, PdfGeneratorService],
  exports: [ResultadosService, PdfGeneratorService],
})
export class ResultadosModule {}

import { Module, forwardRef } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => EventsModule),
    InventarioModule, // Para descuento automático de insumos
  ],
  controllers: [AgendaController],
  providers: [AgendaService],
  exports: [AgendaService],
})
export class AgendaModule {}

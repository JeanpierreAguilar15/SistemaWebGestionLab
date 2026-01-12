import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { CatalogoAdminEventsListener } from './listeners/admin-events.listener';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';

@Module({
  imports: [forwardRef(() => EventsModule)],
  controllers: [CatalogoController],
  providers: [CatalogoService, CatalogoAdminEventsListener],
  exports: [CatalogoService],
})
export class CatalogoModule {}

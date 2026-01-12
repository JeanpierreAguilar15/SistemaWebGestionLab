import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AdminEventsListener } from './listeners/admin-events.listener';
import { SecurityLoggingService } from './services/security-logging.service';
import { SecurityController } from './controllers/security.controller';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => EventsModule),
  ],
  controllers: [SecurityController],
  providers: [AdminEventsListener, SecurityLoggingService],
  exports: [SecurityLoggingService],
})
export class AuditoriaModule {}

import { Module, Global } from '@nestjs/common';
import { ComunicacionesService } from './comunicaciones.service';
import { WhatsAppService } from './whatsapp.service';
import { PrismaModule } from '@prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ComunicacionesService, WhatsAppService],
  exports: [ComunicacionesService, WhatsAppService],
})
export class ComunicacionesModule {}

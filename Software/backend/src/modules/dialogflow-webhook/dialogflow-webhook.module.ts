import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

// Controllers
import { DialogflowController } from './controllers/dialogflow.controller';

// Services
import { DialogflowService } from './services/dialogflow.service';
import { LiveChatService } from './services/livechat.service';

// Gateways
import { ChatGateway } from './gateways/chat.gateway';

/**
 * DialogflowWebhookModule
 *
 * Módulo integrado para:
 * - API REST para Dialogflow CX (precios, citas, disponibilidad)
 * - WebSocket para chat en tiempo real
 * - Handoff a operador humano
 */
@Module({
  imports: [PrismaModule],
  controllers: [DialogflowController],
  providers: [
    DialogflowService,
    LiveChatService,
    ChatGateway,
  ],
  exports: [
    DialogflowService,
    LiveChatService,
    ChatGateway,
  ],
})
export class DialogflowWebhookModule {}

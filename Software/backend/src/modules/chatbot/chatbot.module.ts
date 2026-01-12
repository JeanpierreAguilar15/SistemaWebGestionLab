import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { ChatbotService } from './services/chatbot.service';
import { ChatbotLoggingService } from './services/chatbot-logging.service';
import { LiveChatService } from './services/livechat.service';
import { ChatbotAgendaService } from './services/chatbot-agenda.service';
import { LabResultsInterpreterService } from './services/lab-results-interpreter.service';
import { ChatbotController } from './controllers/chatbot.controller';
import { ChatbotLoggingController } from './controllers/chatbot-logging.controller';
import { LiveChatController } from './controllers/livechat.controller';
import { ChatGateway } from './gateways/chat.gateway';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        forwardRef(() => EventsModule),
    ],
    controllers: [ChatbotController, ChatbotLoggingController, LiveChatController],
    providers: [
        ChatbotAgendaService,
        ChatbotService,
        ChatbotLoggingService,
        LiveChatService,
        LabResultsInterpreterService,
        ChatGateway,
    ],
    exports: [ChatbotService, ChatbotLoggingService, LiveChatService, ChatGateway, ChatbotAgendaService, LabResultsInterpreterService],
})
export class ChatbotModule { }

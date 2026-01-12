import { Controller, Post, Get, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatbotLoggingService } from '../services/chatbot-logging.service';
import { LogChatMessageDto } from '../dto/log-chat-message.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { Roles } from '@modules/auth/decorators/roles.decorator';

@ApiTags('Chatbot Logging')
@Controller('chatbot')
export class ChatbotLoggingController {
    constructor(private readonly loggingService: ChatbotLoggingService) { }

    @Post('log')
    @ApiOperation({ summary: 'Guardar mensaje del chatbot' })
    async logMessage(@Body() dto: LogChatMessageDto) {
        await this.loggingService.logMessage(dto);
        return { success: true };
    }

    @Get('admin/conversations')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar todas las conversaciones (Admin)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'codigoPaciente', required: false, type: Number })
    @ApiQuery({ name: 'activa', required: false, type: Boolean })
    async getAllConversations(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('codigoPaciente') codigoPaciente?: number,
        @Query('activa') activa?: boolean,
    ) {
        return this.loggingService.getAllConversations({
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
            codigoPaciente: codigoPaciente ? +codigoPaciente : undefined,
            activa: activa !== undefined ? activa === true : undefined,
        });
    }

    @Get('admin/conversations/:id/messages')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener mensajes de una conversación específica (Admin)' })
    async getConversationMessages(@Param('id', ParseIntPipe) id: number) {
        return this.loggingService.getConversationMessages(id);
    }

    @Get('admin/analytics')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener estadísticas del chatbot (Admin)' })
    async getAnalytics() {
        return this.loggingService.getChatbotAnalytics();
    }
}

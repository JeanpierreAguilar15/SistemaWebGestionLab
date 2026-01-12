import {
    Controller,
    Get,
    Post,
    Put,
    Param,
    Body,
    UseGuards,
    Request,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { LiveChatService } from '../services/livechat.service';

/**
 * LiveChatController
 *
 * Endpoints REST para gestión del chat en vivo (handoff)
 * Usado por el panel de operadores
 */
@ApiTags('Live Chat')
@Controller('livechat')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LiveChatController {
    constructor(private readonly liveChatService: LiveChatService) {}

    /**
     * Obtener conversaciones pendientes (esperando operador)
     */
    @Get('pending')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Obtener conversaciones pendientes' })
    async getPendingConversations() {
        return this.liveChatService.getPendingConversations();
    }

    /**
     * Obtener conversaciones activas del operador actual
     */
    @Get('my-conversations')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Obtener mis conversaciones activas' })
    async getMyConversations(@Request() req: any) {
        return this.liveChatService.getOperatorConversations(req.user.codigo_usuario);
    }

    /**
     * Obtener estadísticas del chat en vivo
     */
    @Get('stats')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Obtener estadísticas del live chat' })
    async getStats() {
        return this.liveChatService.getLiveChatStats();
    }

    /**
     * Tomar una conversación
     */
    @Post('take/:conversationId')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Tomar una conversación' })
    async takeConversation(
        @Param('conversationId', ParseIntPipe) conversationId: number,
        @Request() req: any,
    ) {
        return this.liveChatService.assignOperator(conversationId, req.user.codigo_usuario);
    }

    /**
     * Obtener mensajes de una conversación
     */
    @Get('conversation/:conversationId/messages')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Obtener mensajes de una conversación' })
    async getConversationMessages(
        @Param('conversationId', ParseIntPipe) conversationId: number,
    ) {
        return this.liveChatService.getConversationMessages(conversationId);
    }

    /**
     * Enviar mensaje como operador
     */
    @Post('conversation/:conversationId/message')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Enviar mensaje como operador' })
    async sendMessage(
        @Param('conversationId', ParseIntPipe) conversationId: number,
        @Body() body: { content: string },
        @Request() req: any,
    ) {
        return this.liveChatService.sendMessage({
            conversationId,
            senderId: req.user.codigo_usuario,
            senderType: 'OPERATOR',
            content: body.content,
        });
    }

    /**
     * Cerrar una conversación
     */
    @Put('conversation/:conversationId/close')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Cerrar una conversación' })
    async closeConversation(
        @Param('conversationId', ParseIntPipe) conversationId: number,
        @Request() req: any,
    ) {
        await this.liveChatService.closeConversation(conversationId, req.user.codigo_usuario);
        return { message: 'Conversación cerrada exitosamente' };
    }

    /**
     * Marcar mensajes como leídos
     */
    @Put('conversation/:conversationId/read')
    @Roles('ADMIN', 'OPERADOR')
    @ApiOperation({ summary: 'Marcar mensajes como leídos' })
    async markAsRead(
        @Param('conversationId', ParseIntPipe) conversationId: number,
    ) {
        await this.liveChatService.markMessagesAsRead(conversationId, 'OPERATOR');
        return { message: 'Mensajes marcados como leídos' };
    }
}

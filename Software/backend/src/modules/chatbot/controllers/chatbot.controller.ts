import { Controller, Post, Body, Get, Put, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChatbotService } from '../services/chatbot.service';
import { LabResultsInterpreterService } from '../services/lab-results-interpreter.service';
import { CreateMessageDto, UpdateChatbotConfigDto } from '../dto/chatbot.dto';
import { InterpretResultsDto, InterpretResultsResponseDto } from '../dto/interpret-results.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
    constructor(
        private readonly chatbotService: ChatbotService,
        private readonly labResultsInterpreter: LabResultsInterpreterService,
    ) { }

    @Public()
    @Post('message')
    @ApiOperation({ summary: 'Enviar mensaje al chatbot (REST)' })
    @ApiResponse({ status: 200, description: 'Respuesta del bot' })
    async sendMessage(@Body() createMessageDto: CreateMessageDto) {
        const sessionId = createMessageDto.sessionId || uuidv4();
        const response = await this.chatbotService.processMessage(
            sessionId,
            createMessageDto.content,
            createMessageDto.userId, // HU-26: Pasar userId para gestión de citas
        );
        return { ...response, sessionId };
    }

    @Get('config')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener configuración del chatbot' })
    async getConfig() {
        return this.chatbotService.getConfig();
    }

    @Put('config')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Actualizar configuración del chatbot' })
    async updateConfig(@Body() configDto: UpdateChatbotConfigDto) {
        return this.chatbotService.updateConfig(configDto);
    }

    @Public()
    @Post('webhook/interpretar')
    @ApiOperation({ summary: 'Webhook para interpretar resultados (Dialogflow)' })
    async handleWebhook(@Body() body: { examen: string; valor: number }, @Req() req: any) {
        const apiKey = req.headers['x-api-key'];
        // Simple hardcoded check for the demo/MVP phase as requested by user
        if (apiKey !== '123456') {
            throw new UnauthorizedException('Invalid API Key');
        }
        return this.chatbotService.interpretarResultado(body.examen, body.valor);
    }

    @Public()
    @Post('webhook/consultar-precio')
    @ApiOperation({ summary: 'Webhook para consultar precio de examen (Dialogflow)' })
    @ApiResponse({ status: 200, description: 'Precio del examen' })
    async consultarPrecio(@Body() body: { examen: string }, @Req() req: any) {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== '123456') {
            throw new UnauthorizedException('Invalid API Key');
        }
        return this.chatbotService.consultarPrecio(body.examen);
    }

    @Public()
    @Post('webhook/consultar-sedes')
    @ApiOperation({ summary: 'Webhook para consultar sedes disponibles (Dialogflow)' })
    @ApiResponse({ status: 200, description: 'Lista de sedes' })
    async consultarSedes(@Req() req: any) {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== '123456') {
            throw new UnauthorizedException('Invalid API Key');
        }
        return this.chatbotService.consultarSedes();
    }

    @Public()
    @Post('webhook/consultar-servicios')
    @ApiOperation({ summary: 'Webhook para consultar servicios disponibles (Dialogflow)' })
    @ApiResponse({ status: 200, description: 'Lista de servicios' })
    async consultarServicios(@Req() req: any) {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== '123456') {
            throw new UnauthorizedException('Invalid API Key');
        }
        return this.chatbotService.consultarServicios();
    }

    // =====================================================
    // INTERPRETACIÓN DE RESULTADOS CON GEMINI
    // =====================================================

    @Public()
    @Post('interpret-results')
    @ApiOperation({
        summary: 'Interpretar resultados de laboratorio desde PDF',
        description: 'Recibe un PDF en base64 y usa Gemini 2.5 para interpretar los resultados',
    })
    @ApiResponse({
        status: 200,
        description: 'Interpretación de los resultados',
        type: InterpretResultsResponseDto,
    })
    async interpretResults(@Body() dto: InterpretResultsDto): Promise<InterpretResultsResponseDto> {
        const mimeType = dto.mimeType || 'application/pdf';

        // Interpretar con Gemini
        const interpretation = await this.labResultsInterpreter.interpretLabResults(
            dto.file,
            mimeType,
        );

        // Generar mensaje para el chat
        const chatMessage = await this.labResultsInterpreter.generateChatResponse(interpretation);

        return {
            success: interpretation.success,
            chatMessage,
            data: interpretation.success ? {
                paciente: interpretation.paciente,
                fecha_examen: interpretation.fecha_examen,
                laboratorio: interpretation.laboratorio,
                resultados: interpretation.resultados,
                resumen_general: interpretation.resumen_general,
                recomendaciones: interpretation.recomendaciones,
                advertencias: interpretation.advertencias,
            } : undefined,
            error: interpretation.error,
        };
    }

    @Get('interpret-results/status')
    @ApiOperation({ summary: 'Verificar si el servicio de interpretación está disponible' })
    async getInterpreterStatus() {
        return {
            available: this.labResultsInterpreter.isConfigured(),
            message: this.labResultsInterpreter.isConfigured()
                ? 'Servicio de interpretación disponible'
                : 'GEMINI_API_KEY no configurada',
        };
    }
}

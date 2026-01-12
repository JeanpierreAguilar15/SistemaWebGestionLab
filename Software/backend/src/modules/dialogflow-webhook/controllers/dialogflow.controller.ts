import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DialogflowService } from '../services/dialogflow.service';
import { LiveChatService } from '../services/livechat.service';
import {
  DialogflowResponse,
  ExamenInfoDto,
  RangoReferenciaDto,
  DisponibilidadDto,
  CitaInfoDto,
  AgendarCitaDto,
  SolicitarHandoffDto,
  HandoffInfoDto,
  DialogflowWebhookRequestDto,
} from '../dto/dialogflow.dto';

@ApiTags('Dialogflow / Chatbot')
@Controller('dialogflow')
export class DialogflowController {
  private readonly logger = new Logger(DialogflowController.name);

  constructor(
    private readonly dialogflowService: DialogflowService,
    private readonly liveChatService: LiveChatService,
  ) {}

  // =====================================================
  // EXÁMENES
  // =====================================================

  @Get('examenes')
  @ApiOperation({ summary: 'Listar exámenes disponibles con precios' })
  @ApiResponse({ status: 200, description: 'Lista de exámenes' })
  async listarExamenes(): Promise<any> {
    const result = await this.dialogflowService.listarExamenes();
    const response = JSON.parse(JSON.stringify(result));
    this.logger.log(`Respuesta listarExamenes: ${result.data?.length || 0} exámenes`);
    return response;
  }

  @Get('examenes/precio/:nombre')
  @ApiOperation({ summary: 'Consultar precio de un examen' })
  @ApiParam({ name: 'nombre', description: 'Nombre del examen', example: 'hemograma' })
  @ApiResponse({ status: 200, description: 'Precio del examen' })
  async consultarPrecio(
    @Param('nombre') nombre: string,
  ): Promise<any> {
    const result = await this.dialogflowService.consultarPrecio(nombre);
    // Asegurar que sea un objeto plano para serialización
    const response = JSON.parse(JSON.stringify(result));
    this.logger.log(`Respuesta consultarPrecio: ${JSON.stringify(response)}`);
    return response;
  }

  @Get('examenes/rango/:nombre')
  @ApiOperation({ summary: 'Consultar valores de referencia de un examen' })
  @ApiParam({ name: 'nombre', description: 'Nombre del examen', example: 'glucosa' })
  @ApiResponse({ status: 200, description: 'Valores de referencia' })
  async consultarRango(
    @Param('nombre') nombre: string,
  ): Promise<any> {
    const result = await this.dialogflowService.consultarRango(nombre);
    const response = JSON.parse(JSON.stringify(result));
    this.logger.log(`Respuesta consultarRango: ${JSON.stringify(response)}`);
    return response;
  }

  // =====================================================
  // CITAS
  // =====================================================

  @Get('citas/disponibilidad')
  @ApiOperation({ summary: 'Consultar horarios disponibles para una fecha' })
  @ApiQuery({ name: 'fecha', description: 'Fecha YYYY-MM-DD', example: '2025-01-15' })
  @ApiQuery({ name: 'servicio', required: false, description: 'Código de servicio' })
  @ApiResponse({ status: 200, description: 'Horarios disponibles' })
  async consultarDisponibilidad(
    @Query('fecha') fecha: string,
    @Query('servicio') servicio?: string,
  ): Promise<DialogflowResponse<DisponibilidadDto>> {
    const codigoServicio = servicio ? parseInt(servicio, 10) : undefined;
    return this.dialogflowService.consultarDisponibilidad(fecha, codigoServicio);
  }

  @Post('citas/agendar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agendar una cita' })
  @ApiResponse({ status: 200, description: 'Cita agendada' })
  async agendarCita(@Body() dto: AgendarCitaDto): Promise<DialogflowResponse<CitaInfoDto>> {
    return this.dialogflowService.agendarCita(dto);
  }

  @Get('citas/paciente/:cedula')
  @ApiOperation({ summary: 'Consultar citas de un paciente' })
  @ApiParam({ name: 'cedula', description: 'Cédula del paciente', example: '1234567890' })
  @ApiResponse({ status: 200, description: 'Citas del paciente' })
  async consultarCitas(
    @Param('cedula') cedula: string,
  ): Promise<DialogflowResponse<CitaInfoDto[]>> {
    return this.dialogflowService.consultarCitas(cedula);
  }

  // =====================================================
  // HANDOFF / OPERADOR
  // =====================================================

  @Post('handoff/solicitar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar transferencia a operador humano' })
  @ApiResponse({ status: 200, description: 'Handoff iniciado' })
  async solicitarHandoff(@Body() dto: SolicitarHandoffDto): Promise<HandoffInfoDto> {
    return this.liveChatService.solicitarHandoff(dto);
  }

  @Get('handoff/pendientes')
  @ApiOperation({ summary: 'Obtener conversaciones pendientes (para operadores)' })
  @ApiResponse({ status: 200, description: 'Lista de conversaciones pendientes' })
  async obtenerPendientes() {
    return this.liveChatService.obtenerConversacionesPendientes();
  }

  @Get('handoff/estadisticas')
  @ApiOperation({ summary: 'Estadísticas del chat en vivo' })
  @ApiResponse({ status: 200, description: 'Estadísticas' })
  async obtenerEstadisticas() {
    return this.liveChatService.obtenerEstadisticas();
  }

  // =====================================================
  // WEBHOOK DIALOGFLOW CX
  // =====================================================

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook para Dialogflow CX fulfillment' })
  @ApiResponse({ status: 200, description: 'Respuesta de fulfillment' })
  async handleWebhook(@Body() body: DialogflowWebhookRequestDto): Promise<any> {
    const tag = body.fulfillmentInfo?.tag || '';
    const params = body.sessionInfo?.parameters || {};

    let textoRespuesta = 'No entendí tu solicitud.';
    let payload: any = {};

    try {
      switch (tag) {
        case 'listar-examenes': {
          const result = await this.dialogflowService.listarExamenes();
          textoRespuesta = result.mensaje;
          payload = result.data || [];
          break;
        }

        case 'consultar-precio': {
          const nombre = params.examen || params['examen.original'] || '';
          if (nombre) {
            const result = await this.dialogflowService.consultarPrecio(nombre);
            textoRespuesta = result.mensaje;
            payload = result.data || {};
          } else {
            const result = await this.dialogflowService.listarExamenes();
            textoRespuesta = result.mensaje;
            payload = result.data || [];
          }
          break;
        }

        case 'consultar-rango': {
          const nombre = params.examen || '';
          if (nombre) {
            const result = await this.dialogflowService.consultarRango(nombre);
            textoRespuesta = result.mensaje;
            payload = result.data || {};
          } else {
            textoRespuesta = 'Por favor, indica el nombre del examen.';
          }
          break;
        }

        case 'consultar-disponibilidad': {
          const fecha = params.fecha || new Date().toISOString().split('T')[0];
          const servicio = params.servicio ? parseInt(params.servicio) : undefined;
          const result = await this.dialogflowService.consultarDisponibilidad(fecha, servicio);
          textoRespuesta = result.mensaje;
          payload = result.data || {};
          break;
        }

        case 'agendar-cita': {
          if (params.fecha && params.hora && params.cedula) {
            const result = await this.dialogflowService.agendarCita({
              fecha: params.fecha,
              hora: params.hora,
              cedula_paciente: params.cedula,
              examen: params.examen,
              codigo_servicio: params.servicio ? parseInt(params.servicio) : undefined,
            });
            textoRespuesta = result.mensaje;
            payload = result.data || {};
          } else {
            textoRespuesta = 'Para agendar necesito: fecha, hora y cédula.';
          }
          break;
        }

        case 'consultar-citas': {
          const cedula = params.cedula || '';
          if (cedula) {
            const result = await this.dialogflowService.consultarCitas(cedula);
            textoRespuesta = result.mensaje;
            payload = result.data || [];
          } else {
            textoRespuesta = 'Por favor, proporciona tu cédula.';
          }
          break;
        }

        case 'solicitar-operador': {
          textoRespuesta = 'Te transferiré con un operador. Por favor espera...';
          payload = { accion: 'HANDOFF' };
          break;
        }

        default:
          textoRespuesta =
            '¿En qué puedo ayudarte? Puedo informarte sobre precios, disponibilidad o ayudarte a agendar una cita.';
      }
    } catch (error) {
      textoRespuesta = 'Ocurrió un error. Por favor, intenta de nuevo.';
    }

    // Formato de respuesta para Dialogflow CX
    return {
      fulfillment_response: {
        messages: [
          {
            text: {
              text: [textoRespuesta],
            },
          },
        ],
      },
      sessionInfo: {
        parameters: {
          ...params,
          ultimaRespuesta: payload,
        },
      },
    };
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';

// =====================================================
// RESPUESTA BASE PARA DIALOGFLOW
// =====================================================

export class DialogflowResponse<T = any> {
  @ApiProperty({ description: 'Indica si la operación fue exitosa' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Datos de la respuesta' })
  data?: T;

  @ApiProperty({ description: 'Mensaje descriptivo para el chatbot' })
  mensaje: string;

  @ApiPropertyOptional({ description: 'Acción sugerida para el frontend' })
  accion?: string;

  @ApiPropertyOptional({ description: 'Código de error si aplica' })
  error_code?: string;
}

// =====================================================
// EXÁMENES
// =====================================================

export class ExamenInfoDto {
  @ApiProperty()
  codigo: number;

  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  categoria?: string;

  @ApiProperty()
  precio: number;

  @ApiProperty({ default: 'USD' })
  moneda: string;

  @ApiPropertyOptional()
  requiere_ayuno?: boolean;

  @ApiPropertyOptional()
  horas_ayuno?: number;

  @ApiPropertyOptional()
  tiempo_entrega_horas?: number;
}

export class RangoReferenciaDto {
  @ApiProperty()
  nombre: string;

  @ApiPropertyOptional()
  valor_min?: number;

  @ApiPropertyOptional()
  valor_max?: number;

  @ApiPropertyOptional()
  unidad_medida?: string;

  @ApiPropertyOptional()
  valores_texto?: string;
}

// =====================================================
// CITAS Y DISPONIBILIDAD
// =====================================================

export class HorarioDisponibleDto {
  @ApiProperty()
  slot_id: number;

  @ApiProperty({ example: '09:00' })
  hora: string;

  @ApiProperty()
  cupos: number;

  @ApiProperty()
  sede: string;

  @ApiProperty()
  servicio: string;
}

export class DisponibilidadDto {
  @ApiProperty()
  fecha: string;

  @ApiProperty()
  total_horarios: number;

  @ApiProperty({ type: [HorarioDisponibleDto] })
  horarios: HorarioDisponibleDto[];
}

export class AgendarCitaDto {
  @ApiProperty({ example: '2025-01-15' })
  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  hora: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  cedula_paciente: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  examen?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  codigo_servicio?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  codigo_sede?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observaciones?: string;
}

export class CitaInfoDto {
  @ApiProperty()
  codigo_cita: number;

  @ApiProperty()
  fecha: string;

  @ApiProperty()
  hora: string;

  @ApiProperty()
  servicio: string;

  @ApiProperty()
  sede: string;

  @ApiProperty()
  estado: string;
}

// =====================================================
// HANDOFF / LIVE CHAT
// =====================================================

export enum ConversacionEstado {
  ACTIVA = 'ACTIVA',
  ESPERANDO_OPERADOR = 'ESPERANDO_OPERADOR',
  ATENDIDA = 'ATENDIDA',
  CERRADA = 'CERRADA',
}

export class SolicitarHandoffDto {
  @ApiProperty({ description: 'ID de sesión del chat' })
  @IsString()
  @IsNotEmpty()
  session_id: string;

  @ApiPropertyOptional({ description: 'Cédula del paciente si está identificado' })
  @IsString()
  @IsOptional()
  cedula?: string;

  @ApiPropertyOptional({ description: 'Nombre del usuario' })
  @IsString()
  @IsOptional()
  nombre_usuario?: string;

  @ApiPropertyOptional({ description: 'Motivo de la solicitud' })
  @IsString()
  @IsOptional()
  motivo?: string;
}

export class HandoffInfoDto {
  @ApiProperty()
  conversacion_id: number;

  @ApiProperty()
  posicion_cola: number;

  @ApiProperty()
  estado: ConversacionEstado;

  @ApiPropertyOptional()
  operador_nombre?: string;

  @ApiProperty()
  mensaje: string;
}

export class MensajeChatDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contenido: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  session_id: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  conversacion_id?: number;
}

export class MensajeInfoDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  contenido: string;

  @ApiProperty({ enum: ['USER', 'BOT', 'OPERATOR', 'SYSTEM'] })
  remitente: string;

  @ApiPropertyOptional()
  nombre_remitente?: string;

  @ApiProperty()
  timestamp: Date;
}

// =====================================================
// WEBHOOK DIALOGFLOW CX
// =====================================================

export class DialogflowWebhookRequestDto {
  @ApiPropertyOptional()
  fulfillmentInfo?: {
    tag?: string;
  };

  @ApiPropertyOptional()
  sessionInfo?: {
    session?: string;
    parameters?: Record<string, any>;
  };

  @ApiPropertyOptional()
  text?: string;
}

import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
    @ApiProperty({ description: 'Contenido del mensaje' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiProperty({ description: 'ID de sesión (opcional, si no se envía se genera uno)' })
    @IsString()
    @IsOptional()
    sessionId?: string;

    @ApiProperty({ description: 'ID del usuario autenticado (opcional, para gestión de citas)' })
    @IsNumber()
    @IsOptional()
    userId?: number;
}

export class UpdateChatbotConfigDto {
    @ApiProperty({ description: 'Activar o desactivar el chatbot' })
    @IsBoolean()
    @IsOptional()
    activo?: boolean;

    @ApiProperty({ description: 'Nombre del agente virtual' })
    @IsString()
    @IsOptional()
    nombre_agente?: string;

    @ApiProperty({ description: 'Mensaje de bienvenida' })
    @IsString()
    @IsOptional()
    mensaje_bienvenida?: string;

    @ApiProperty({ description: 'Disclaimer legal' })
    @IsString()
    @IsOptional()
    disclaimer_legal?: string;

    @ApiProperty({ description: 'Umbral de confianza (0.0 - 1.0)' })
    @IsNumber()
    @Min(0)
    @Max(1)
    @IsOptional()
    umbral_confianza?: number;

    @ApiProperty({ description: 'Permitir acceso a resultados reales' })
    @IsBoolean()
    @IsOptional()
    permitir_acceso_resultados?: boolean;

    @ApiProperty({ description: 'Mensaje de fallo' })
    @IsString()
    @IsOptional()
    mensaje_fallo?: string;

    @ApiProperty({ description: 'Contacto de soporte' })
    @IsString()
    @IsOptional()
    contacto_soporte?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min, Max } from 'class-validator';

export enum Remitente {
    USER = 'USER',
    BOT = 'BOT',
}

export class LogChatMessageDto {
    @ApiProperty({
        description: 'ID de sesión único',
        example: 'session-1234567890',
    })
    @IsString()
    @IsNotEmpty()
    sessionId: string;

    @ApiProperty({
        description: 'Mensaje enviado/recibido',
        example: 'Hola, ¿cuál es el precio del examen de hemograma?',
    })
    @IsString()
    @IsNotEmpty()
    message: string;

    @ApiProperty({
        description: 'Remitente del mensaje',
        enum: Remitente,
        example: 'USER',
    })
    @IsEnum(Remitente)
    @IsNotEmpty()
    sender: Remitente;

    @ApiProperty({
        description: 'ID del usuario/paciente (opcional si no está autenticado)',
        example: 123,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    userId?: number;

    @ApiProperty({
        description: 'Intent detectado por Dialogflow',
        example: 'consultar_precio',
        required: false,
    })
    @IsOptional()
    @IsString()
    intent?: string;

    @ApiProperty({
        description: 'Confianza del intent (0-1)',
        example: 0.95,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    confidence?: number;
}

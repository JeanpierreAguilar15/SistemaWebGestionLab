import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InterpretResultsDto {
  @ApiProperty({
    description: 'Archivo PDF en base64',
    example: 'JVBERi0xLjQKJeLjz9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'El archivo es requerido' })
  file: string;

  @ApiProperty({
    description: 'Tipo MIME del archivo',
    example: 'application/pdf',
    default: 'application/pdf',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiProperty({
    description: 'ID de sesión del chat (opcional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  sessionId?: string;
}

export class InterpretResultsResponseDto {
  @ApiProperty({ description: 'Si la interpretación fue exitosa' })
  success: boolean;

  @ApiProperty({ description: 'Mensaje formateado para el chat' })
  chatMessage: string;

  @ApiProperty({ description: 'Datos estructurados de la interpretación', required: false })
  data?: {
    paciente?: {
      nombre?: string;
      cedula?: string;
    };
    fecha_examen?: string;
    laboratorio?: string;
    resultados: Array<{
      examen: string;
      valor: string | number;
      unidad?: string;
      valor_referencia?: string;
      estado: string;
      interpretacion: string;
    }>;
    resumen_general: string;
    recomendaciones: string[];
    advertencias: string[];
  };

  @ApiProperty({ description: 'Mensaje de error si falló', required: false })
  error?: string;
}

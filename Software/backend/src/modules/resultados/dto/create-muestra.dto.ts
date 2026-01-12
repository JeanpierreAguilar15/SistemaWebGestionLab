import { IsInt, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMuestraDto {
  @ApiProperty({
    description: 'Código del paciente',
    example: 1,
  })
  @IsInt()
  codigo_paciente: number;

  @ApiProperty({
    description: 'Código de la cita (opcional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  codigo_cita?: number;

  @ApiProperty({
    description: 'ID único de la muestra',
    example: 'MUE-2025-001',
  })
  @IsString()
  id_muestra: string;

  @ApiProperty({
    description: 'Tipo de muestra',
    example: 'Sangre venosa',
    required: false,
  })
  @IsOptional()
  @IsString()
  tipo_muestra?: string;

  @ApiProperty({
    description: 'Fecha de toma (ISO 8601)',
    example: '2025-01-17T10:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_toma?: string;

  @ApiProperty({
    description: 'Observaciones',
    example: 'Paciente en ayunas',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

import { IsInt, IsString, IsOptional, IsDecimal, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateResultadoDto {
  @ApiProperty({
    description: 'Código de la muestra',
    example: 1,
  })
  @IsInt()
  codigo_muestra: number;

  @ApiProperty({
    description: 'Código del examen',
    example: 1,
  })
  @IsInt()
  codigo_examen: number;

  @ApiProperty({
    description: 'Valor numérico del resultado',
    example: 150.5,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  valor_numerico?: number;

  @ApiProperty({
    description: 'Valor de texto del resultado',
    example: 'Negativo',
    required: false,
  })
  @IsOptional()
  @IsString()
  valor_texto?: string;

  @ApiProperty({
    description: 'Unidad de medida',
    example: 'mg/dL',
    required: false,
  })
  @IsOptional()
  @IsString()
  unidad_medida?: string;

  @ApiProperty({
    description: 'Valor mínimo de referencia',
    example: 70,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  valor_referencia_min?: number;

  @ApiProperty({
    description: 'Valor máximo de referencia',
    example: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  valor_referencia_max?: number;

  @ApiProperty({
    description: 'Valores de referencia en texto',
    example: 'Normal: Negativo',
    required: false,
  })
  @IsOptional()
  @IsString()
  valores_referencia_texto?: string;

  @ApiProperty({
    description: 'Observaciones técnicas',
    example: 'Muestra hemolizada',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones_tecnicas?: string;

  @ApiProperty({
    description: 'Nivel del resultado',
    enum: ['NORMAL', 'ALTO', 'BAJO', 'CRITICO'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['NORMAL', 'ALTO', 'BAJO', 'CRITICO'])
  nivel?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para un examen seleccionado en la cotización
 */
export class ExamenCotizadoDto {
  @ApiProperty({
    description: 'Código del examen',
    example: 1,
  })
  @IsInt()
  codigo_examen: number;

  @ApiProperty({
    description: 'Cantidad de exámenes (normalmente 1)',
    example: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  cantidad: number = 1;
}

/**
 * DTO para crear una cotización
 * El paciente selecciona exámenes tipo checklist y el sistema calcula el precio automáticamente
 */
export class CreateCotizacionDto {
  @ApiProperty({
    description: 'Lista de exámenes seleccionados con sus cantidades',
    type: [ExamenCotizadoDto],
    example: [
      { codigo_examen: 1, cantidad: 1 },
      { codigo_examen: 5, cantidad: 1 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un examen' })
  @ValidateNested({ each: true })
  @Type(() => ExamenCotizadoDto)
  examenes: ExamenCotizadoDto[];

  @ApiProperty({
    description: 'Descuento a aplicar (opcional, solo Admin)',
    example: 10.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiProperty({
    description: 'Observaciones adicionales',
    example: 'Solicitud de exámenes pre-operatorios',
    required: false,
  })
  @IsOptional()
  observaciones?: string;
}

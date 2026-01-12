import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Estados posibles de una cotización
 */
export enum EstadoCotizacion {
  PENDIENTE = 'PENDIENTE',
  ACEPTADA = 'ACEPTADA',
  RECHAZADA = 'RECHAZADA',
  PAGADA = 'PAGADA',
  EXPIRADA = 'EXPIRADA',
}

/**
 * DTO para actualizar estado de cotización (Admin)
 */
export class UpdateCotizacionDto {
  @ApiProperty({
    description: 'Nuevo estado de la cotización',
    enum: EstadoCotizacion,
    example: EstadoCotizacion.ACEPTADA,
    required: false,
  })
  @IsOptional()
  @IsEnum(EstadoCotizacion)
  estado?: EstadoCotizacion;

  @ApiProperty({
    description: 'Observaciones actualizadas',
    example: 'Cotización aprobada por el paciente',
    required: false,
  })
  @IsOptional()
  observaciones?: string;
}

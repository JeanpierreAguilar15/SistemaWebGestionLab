import { IsInt, IsDateString, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSlotDto {
  @ApiProperty({
    description: 'Código del servicio',
    example: 1,
  })
  @IsInt()
  codigo_servicio: number;

  @ApiProperty({
    description: 'Código de la sede',
    example: 1,
  })
  @IsInt()
  codigo_sede: number;

  @ApiProperty({
    description: 'Fecha del slot (YYYY-MM-DD)',
    example: '2025-01-20',
  })
  @IsDateString()
  fecha: string;

  @ApiProperty({
    description: 'Hora de inicio (HH:mm)',
    example: '09:00',
  })
  hora_inicio: string;

  @ApiProperty({
    description: 'Hora de fin (HH:mm)',
    example: '09:30',
  })
  hora_fin: string;

  @ApiProperty({
    description: 'Cupos totales disponibles',
    example: 5,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  cupos_totales?: number;

  @ApiProperty({
    description: 'Slot activo',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

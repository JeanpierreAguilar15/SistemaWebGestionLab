import { IsOptional, IsInt, IsDateString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QuerySlotsDto {
  @ApiProperty({
    description: 'Código del servicio',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  codigo_servicio?: number;

  @ApiProperty({
    description: 'Código de la sede',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  codigo_sede?: number;

  @ApiProperty({
    description: 'Fecha desde (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiProperty({
    description: 'Fecha hasta (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiProperty({
    description: 'Fecha específica (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiProperty({
    description: 'Solo slots con cupos disponibles',
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  disponibles_solo?: boolean;
}

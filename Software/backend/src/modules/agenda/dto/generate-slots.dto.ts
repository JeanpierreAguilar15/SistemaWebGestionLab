import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  IsArray,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateSlotsDto {
  @ApiProperty({ description: 'Código del servicio' })
  @IsInt()
  @IsNotEmpty()
  codigo_servicio: number;

  @ApiProperty({ description: 'Código de la sede' })
  @IsInt()
  @IsNotEmpty()
  codigo_sede: number;

  @ApiProperty({ description: 'Fecha de inicio (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  fecha_inicio: string;

  @ApiProperty({ description: 'Fecha de fin (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  fecha_fin: string;

  @ApiProperty({ description: 'Hora de inicio diaria (HH:MM)' })
  @IsString()
  @IsNotEmpty()
  hora_inicio: string;

  @ApiProperty({ description: 'Hora de fin diaria (HH:MM)' })
  @IsString()
  @IsNotEmpty()
  hora_fin: string;

  @ApiProperty({ description: 'Duración del slot en minutos' })
  @IsInt()
  @Min(5)
  duracion_minutos: number;

  @ApiProperty({ description: 'Días de la semana (0=Domingo, 1=Lunes, ...)' })
  @IsArray()
  @IsInt({ each: true })
  dias_semana: number[];

  @ApiProperty({ description: 'Cupos por slot', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  cupos_por_slot?: number;
}

import { IsString, IsOptional, IsIn, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCitaDto {
  @ApiProperty({
    description: 'Nuevo estado de la cita',
    enum: ['AGENDADA', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'NO_ASISTIO'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['AGENDADA', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'NO_ASISTIO'])
  estado?: string;

  @ApiProperty({
    description: 'Observaciones',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({
    description: 'Motivo de cancelación',
    required: false,
  })
  @IsOptional()
  @IsString()
  motivo_cancelacion?: string;

  @ApiProperty({
    description: 'Nuevo slot para reagendar',
    required: false,
  })
  @IsOptional()
  @IsInt()
  codigo_slot?: number;
}

import { IsInt, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCitaDto {
  @ApiProperty({
    description: 'Código del slot a reservar',
    example: 1,
  })
  @IsInt()
  codigo_slot: number;

  @ApiProperty({
    description: 'Observaciones del paciente',
    example: 'Tengo alergia a la penicilina',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({
    description: 'Código de la cotización asociada (opcional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  codigo_cotizacion?: number;
}

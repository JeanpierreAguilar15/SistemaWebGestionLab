import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateResultadoDto {
  @ApiProperty({
    description: 'Estado del resultado',
    enum: ['EN_PROCESO', 'LISTO', 'VALIDADO', 'ENTREGADO'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['EN_PROCESO', 'LISTO', 'VALIDADO', 'ENTREGADO'])
  estado?: string;

  @ApiProperty({
    description: 'Observaciones técnicas',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones_tecnicas?: string;
}

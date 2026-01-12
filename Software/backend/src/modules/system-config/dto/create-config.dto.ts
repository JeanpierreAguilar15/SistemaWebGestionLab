import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ConfigType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
}

export class CreateConfigDto {
  @ApiProperty({ description: 'Clave única de la configuración' })
  @IsString()
  @IsNotEmpty()
  clave: string;

  @ApiProperty({ description: 'Valor de la configuración' })
  @IsString()
  @IsNotEmpty()
  valor: string;

  @ApiProperty({ description: 'Descripción de la configuración' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ description: 'Grupo al que pertenece la configuración' })
  @IsString()
  @IsNotEmpty()
  grupo: string;

  @ApiProperty({ enum: ConfigType, description: 'Tipo de dato del valor' })
  @IsEnum(ConfigType)
  @IsOptional()
  tipo_dato?: ConfigType;

  @ApiProperty({ description: 'Indica si la configuración es pública' })
  @IsBoolean()
  @IsOptional()
  es_publico?: boolean;
}
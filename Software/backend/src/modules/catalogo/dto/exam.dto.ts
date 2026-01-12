import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExamDto {
  @IsOptional()
  @IsInt()
  codigo_categoria?: number;

  @IsString()
  @IsNotEmpty({ message: 'El código interno es requerido' })
  @MinLength(2, { message: 'El código interno debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El código interno no puede exceder 50 caracteres' })
  codigo_interno: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del examen es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La descripción no puede exceder 2000 caracteres' })
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  requiere_ayuno?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Las horas de ayuno no pueden ser negativas' })
  horas_ayuno?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Las instrucciones no pueden exceder 2000 caracteres' })
  instrucciones_preparacion?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El tiempo de entrega debe ser al menos 1 hora' })
  tiempo_entrega_horas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El tipo de muestra no puede exceder 100 caracteres' })
  tipo_muestra?: string;

  @IsOptional()
  @IsNumber()
  valor_referencia_min?: number;

  @IsOptional()
  @IsNumber()
  valor_referencia_max?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Los valores de referencia no pueden exceder 1000 caracteres' })
  valores_referencia_texto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'La unidad de medida no puede exceder 50 caracteres' })
  unidad_medida?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateExamDto {
  @IsOptional()
  @IsInt()
  codigo_categoria?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  codigo_interno?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  requiere_ayuno?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  horas_ayuno?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instrucciones_preparacion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  tiempo_entrega_horas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipo_muestra?: string;

  @IsOptional()
  @IsNumber()
  valor_referencia_min?: number;

  @IsOptional()
  @IsNumber()
  valor_referencia_max?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  valores_referencia_texto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unidad_medida?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

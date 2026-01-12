import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInventoryItemDto {
  @IsOptional()
  @IsInt()
  codigo_categoria?: number;

  @IsString()
  @IsNotEmpty({ message: 'El código interno es requerido' })
  @MinLength(2, { message: 'El código interno debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El código interno no puede exceder 50 caracteres' })
  codigo_interno: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del item es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede exceder 1000 caracteres' })
  descripcion?: string;

  @IsString()
  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  @MaxLength(50, { message: 'La unidad de medida no puede exceder 50 caracteres' })
  unidad_medida: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El stock actual no puede ser negativo' })
  stock_actual?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  stock_minimo?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'El stock máximo no puede ser negativo' })
  stock_maximo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El costo unitario no puede ser negativo' })
  costo_unitario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El precio de venta no puede ser negativo' })
  precio_venta?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // Campos para control de reactivos
  @IsOptional()
  @IsBoolean()
  es_reactivo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La vida util debe ser al menos 1 dia' })
  vida_util_dias_abierto?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'La capacidad de pruebas debe ser al menos 1' })
  capacidad_pruebas?: number;
}

export class UpdateInventoryItemDto {
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
  @MaxLength(1000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unidad_medida?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock_actual?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock_minimo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock_maximo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costo_unitario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_venta?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // Campos para control de reactivos
  @IsOptional()
  @IsBoolean()
  es_reactivo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  vida_util_dias_abierto?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidad_pruebas?: number;
}

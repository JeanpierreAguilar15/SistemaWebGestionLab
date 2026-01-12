import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsArray,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CreatePackageDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del paquete es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede exceder 1000 caracteres' })
  descripcion?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'El precio del paquete es requerido' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  precio_paquete: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El descuento no puede ser negativo' })
  descuento?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray({ message: 'Los exámenes deben ser un array' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos un examen' })
  @IsInt({ each: true, message: 'Cada código de examen debe ser un número entero' })
  examenes?: number[];
}

export class UpdatePackageDto {
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
  @IsNumber()
  @Min(0)
  precio_paquete?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  examenes?: number[];
}

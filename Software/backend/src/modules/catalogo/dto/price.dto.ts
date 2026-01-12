import { IsInt, IsNumber, IsOptional, IsBoolean, IsNotEmpty, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePriceDto {
  @IsInt()
  @IsNotEmpty({ message: 'El código del examen es requerido' })
  codigo_examen: number;

  @IsNumber()
  @IsNotEmpty({ message: 'El precio es requerido' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  precio: number;

  @IsDate({ message: 'La fecha de inicio debe ser válida' })
  @IsNotEmpty({ message: 'La fecha de inicio es requerida' })
  @Type(() => Date)
  fecha_inicio: Date;

  @IsOptional()
  @IsDate({ message: 'La fecha de fin debe ser válida' })
  @Type(() => Date)
  fecha_fin?: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdatePriceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  precio?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fecha_inicio?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fecha_fin?: Date;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

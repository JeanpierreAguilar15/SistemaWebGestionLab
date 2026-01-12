import { IsInt, IsNotEmpty, IsPositive, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateExamenInsumoDto {
  @IsOptional()
  @IsInt({ message: 'El código del examen debe ser un número entero' })
  codigo_examen?: number;

  @IsInt({ message: 'El código del item debe ser un número entero' })
  @IsNotEmpty({ message: 'El código del item es requerido' })
  codigo_item: number;

  @IsNumber({}, { message: 'La cantidad requerida debe ser un número' })
  @IsPositive({ message: 'La cantidad requerida debe ser un número positivo' })
  @IsNotEmpty({ message: 'La cantidad requerida es requerida' })
  cantidad_requerida: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateExamenInsumoDto {
  @IsOptional()
  @IsNumber({}, { message: 'La cantidad requerida debe ser un número' })
  @IsPositive({ message: 'La cantidad requerida debe ser un número positivo' })
  cantidad_requerida?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

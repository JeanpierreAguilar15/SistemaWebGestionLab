import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsPositive,
  MaxLength,
} from 'class-validator';

/**
 * Tipos de movimiento de inventario
 */
export enum TipoMovimiento {
  ENTRADA = 'ENTRADA',           // Entrada de stock (compra, devolución)
  SALIDA = 'SALIDA',             // Salida de stock (uso, venta, merma)
  AJUSTE_POSITIVO = 'AJUSTE_POSITIVO',  // Ajuste de inventario (aumento)
  AJUSTE_NEGATIVO = 'AJUSTE_NEGATIVO',  // Ajuste de inventario (disminución)
  TRANSFERENCIA = 'TRANSFERENCIA',      // Transferencia entre sedes
}

/**
 * DTO para crear un movimiento de stock
 */
export class CreateMovimientoDto {
  @IsInt()
  @IsNotEmpty({ message: 'El código del item es requerido' })
  codigo_item: number;

  @IsOptional()
  @IsInt()
  codigo_lote?: number; // Opcional - para trazabilidad por lote

  @IsEnum(TipoMovimiento, {
    message: 'El tipo de movimiento debe ser: ENTRADA, SALIDA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO, o TRANSFERENCIA',
  })
  @IsNotEmpty({ message: 'El tipo de movimiento es requerido' })
  tipo_movimiento: TipoMovimiento;

  @IsInt()
  @IsPositive({ message: 'La cantidad debe ser un número positivo' })
  @IsNotEmpty({ message: 'La cantidad es requerida' })
  cantidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
  motivo?: string; // Motivo del movimiento (ej: "Compra factura #123", "Uso en examen", "Merma por vencimiento")
}

/**
 * DTO para filtrar movimientos
 */
export class FilterMovimientosDto {
  @IsOptional()
  @IsInt()
  codigo_item?: number;

  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipo_movimiento?: TipoMovimiento;

  @IsOptional()
  @IsString()
  fecha_desde?: string; // ISO date string

  @IsOptional()
  @IsString()
  fecha_hasta?: string; // ISO date string

  @IsOptional()
  @IsInt()
  realizado_por?: number; // Filtrar por usuario que realizó el movimiento
}

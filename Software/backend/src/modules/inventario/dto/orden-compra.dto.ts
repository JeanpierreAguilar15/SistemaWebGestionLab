import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsPositive,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Estados de la orden de compra
 */
export enum EstadoOrdenCompra {
  BORRADOR = 'BORRADOR', // Creada pero no enviada
  EMITIDA = 'EMITIDA', // Enviada al proveedor
  RECIBIDA = 'RECIBIDA', // Productos recibidos y stock actualizado
  CANCELADA = 'CANCELADA', // Orden cancelada
}

/**
 * DTO para item individual en orden de compra
 */
export class ItemOrdenCompraDto {
  @IsInt()
  @IsNotEmpty({ message: 'El código del item es requerido' })
  codigo_item: number;

  @IsNumber()
  @IsPositive({ message: 'La cantidad debe ser un número positivo' })
  @IsNotEmpty({ message: 'La cantidad es requerida' })
  cantidad: number;

  @IsNumber()
  @Min(0, { message: 'El precio unitario no puede ser negativo' })
  @IsNotEmpty({ message: 'El precio unitario es requerido' })
  precio_unitario: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Las observaciones no pueden exceder 200 caracteres' })
  observaciones?: string;
}

/**
 * DTO para crear una orden de compra
 */
export class CreateOrdenCompraDto {
  @IsInt()
  @IsNotEmpty({ message: 'El código del proveedor es requerido' })
  codigo_proveedor: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Las observaciones no pueden exceder 500 caracteres' })
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenCompraDto)
  @IsNotEmpty({ message: 'Debe incluir al menos un item en la orden' })
  items: ItemOrdenCompraDto[];
}

/**
 * DTO para actualizar una orden de compra
 */
export class UpdateOrdenCompraDto {
  @IsOptional()
  @IsInt()
  codigo_proveedor?: number;

  @IsOptional()
  @IsEnum(EstadoOrdenCompra)
  estado?: EstadoOrdenCompra;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemOrdenCompraDto)
  items?: ItemOrdenCompraDto[];
}

/**
 * DTO para filtrar órdenes de compra
 */
export class FilterOrdenesCompraDto {
  @IsOptional()
  @IsInt()
  codigo_proveedor?: number;

  @IsOptional()
  @IsEnum(EstadoOrdenCompra)
  estado?: EstadoOrdenCompra;

  @IsOptional()
  @IsString()
  fecha_desde?: string; // ISO date string

  @IsOptional()
  @IsString()
  fecha_hasta?: string; // ISO date string

  @IsOptional()
  @IsInt()
  creado_por?: number; // Filtrar por usuario que creó la orden
}

/**
 * DTO para recibir orden de compra (marcarla como recibida)
 */
export class RecibirOrdenCompraDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas_recepcion?: string; // Notas sobre la recepción (ej: faltaron productos, llegaron dañados, etc.)

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemRecepcionDto)
  items_recibidos?: ItemRecepcionDto[]; // Cantidades realmente recibidas (puede diferir de lo ordenado)
}

/**
 * DTO para item recibido (puede tener cantidad diferente a la ordenada)
 */
export class ItemRecepcionDto {
  @IsInt()
  @IsNotEmpty()
  codigo_item: number;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  cantidad_recibida: number; // Cantidad real recibida

  @IsOptional()
  @IsString()
  numero_lote?: string; // Número de lote del producto recibido

  @IsOptional()
  @IsString()
  fecha_vencimiento?: string; // Fecha de vencimiento (ISO date)

  @IsOptional()
  @IsString()
  @MaxLength(200)
  observaciones?: string;
}

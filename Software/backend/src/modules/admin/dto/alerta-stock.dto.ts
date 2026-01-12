import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  IsPositive,
} from 'class-validator';

/**
 * Tipos de alerta de stock
 */
export enum TipoAlerta {
  STOCK_BAJO = 'STOCK_BAJO',           // Stock por debajo del mínimo
  STOCK_CRITICO = 'STOCK_CRITICO',     // Stock en 0
  PROXIMO_VENCER = 'PROXIMO_VENCER',   // Producto próximo a vencer (30 días)
  VENCIDO = 'VENCIDO',                 // Producto vencido
}

/**
 * DTO para filtrar alertas de stock
 */
export class FilterAlertasDto {
  @IsOptional()
  @IsEnum(TipoAlerta)
  tipo?: TipoAlerta;

  @IsOptional()
  @IsInt()
  codigo_item?: number;

  @IsOptional()
  @IsString()
  activo?: string; // 'true' o 'false'
}

/**
 * Interfaz para respuesta de alerta
 */
export interface AlertaStock {
  codigo_item: number;
  codigo_interno: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number | null;
  unidad_medida: string;
  tipo_alerta: TipoAlerta;
  mensaje: string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  codigo_lote?: number;
  numero_lote?: string;
  fecha_vencimiento?: Date;
  dias_hasta_vencimiento?: number;
}

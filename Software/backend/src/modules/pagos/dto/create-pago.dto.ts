import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

/**
 * Métodos de pago disponibles
 */
export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA_CREDITO = 'TARJETA_CREDITO',
  TARJETA_DEBITO = 'TARJETA_DEBITO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  PAYPAL = 'PAYPAL',
  OTRO = 'OTRO',
}

/**
 * DTO para registrar un pago
 */
export class CreatePagoDto {
  @ApiProperty({
    description: 'Código de la cotización asociada (opcional)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  codigo_cotizacion?: number;

  @ApiProperty({
    description: 'Monto total del pago',
    example: 150.75,
  })
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto_total: number;

  @ApiProperty({
    description: 'Método de pago utilizado',
    enum: MetodoPago,
    example: MetodoPago.TRANSFERENCIA,
  })
  @IsEnum(MetodoPago)
  metodo_pago: MetodoPago;

  @ApiProperty({
    description: 'Proveedor de pasarela de pago (PayPal, Stripe, etc.)',
    example: 'PayPal',
    required: false,
  })
  @IsOptional()
  @IsString()
  proveedor_pasarela?: string;

  @ApiProperty({
    description: 'ID de transacción externa (de la pasarela de pago)',
    example: 'PAY-1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  id_transaccion_externa?: string;

  @ApiProperty({
    description: 'URL del comprobante de pago',
    example: '/uploads/pagos/comprobante-123.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  url_comprobante?: string;

  @ApiProperty({
    description: 'Observaciones adicionales',
    example: 'Pago confirmado por transferencia bancaria',
    required: false,
  })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

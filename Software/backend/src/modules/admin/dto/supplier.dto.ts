import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

// Validador personalizado para RUC ecuatoriano
export function ValidateRucEcuador(ruc: string): boolean {
  if (!ruc || ruc.length !== 13) return false;

  const codigoProvincia = parseInt(ruc.substring(0, 2));
  if (codigoProvincia < 1 || codigoProvincia > 24) return false;

  const tercerDigito = parseInt(ruc.charAt(2));

  // Validar según el tipo de RUC (persona natural, sociedad privada, pública)
  if (tercerDigito < 0 || tercerDigito > 9) return false;

  // Los últimos 3 dígitos deben ser 001 para sociedades o 000 para personas naturales
  const ultimos3 = ruc.substring(10, 13);
  if (ultimos3 !== '001' && ultimos3 !== '000') return false;

  return true;
}

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'El RUC es requerido' })
  @MinLength(13, { message: 'El RUC debe tener 13 dígitos' })
  @MaxLength(13, { message: 'El RUC debe tener 13 dígitos' })
  @Matches(/^\d{13}$/, { message: 'El RUC debe contener solo números' })
  ruc: string;

  @IsString()
  @IsNotEmpty({ message: 'La razón social es requerida' })
  @MinLength(2, { message: 'La razón social debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'La razón social no puede exceder 200 caracteres' })
  razon_social: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El nombre comercial no puede exceder 200 caracteres' })
  nombre_comercial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{1,3}[- ]?)?\d{7,15}$/, { message: 'El teléfono debe ser válido' })
  @MaxLength(15, { message: 'El teléfono no puede exceder 15 caracteres' })
  telefono?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser válido' })
  @MaxLength(100, { message: 'El email no puede exceder 100 caracteres' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La dirección no puede exceder 500 caracteres' })
  direccion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MinLength(13)
  @MaxLength(13)
  @Matches(/^\d{13}$/, { message: 'El RUC debe contener solo números' })
  ruc?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  razon_social?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre_comercial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{1,3}[- ]?)?\d{7,15}$/, { message: 'El teléfono debe ser válido' })
  @MaxLength(15)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  direccion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

import {
  IsString,
  IsEmail,
  IsInt,
  IsOptional,
  IsBoolean,
  IsDate,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

import { ValidateCedulaEcuatoriana } from '../../../common/utils/validation.utils';

export class CreateUserDto {
  @IsInt()
  @IsNotEmpty({ message: 'El código de rol es requerido' })
  codigo_rol: number;

  @IsString()
  @IsNotEmpty({ message: 'La cédula es requerida' })
  @MinLength(10, { message: 'La cédula debe tener 10 dígitos' })
  @MaxLength(10, { message: 'La cédula debe tener 10 dígitos' })
  @Matches(/^\d{10}$/, { message: 'La cédula debe contener solo números' })
  cedula: string;

  @IsString()
  @IsNotEmpty({ message: 'Los nombres son requeridos' })
  @MinLength(2, { message: 'Los nombres deben tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'Los nombres no pueden exceder 100 caracteres' })
  nombres: string;

  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son requeridos' })
  @MinLength(2, { message: 'Los apellidos deben tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'Los apellidos no pueden exceder 100 caracteres' })
  apellidos: string;

  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  @MaxLength(100, { message: 'El email no puede exceder 100 caracteres' })
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{1,3}[- ]?)?\d{7,15}$/, { message: 'El teléfono debe ser válido' })
  @MaxLength(15, { message: 'El teléfono no puede exceder 15 caracteres' })
  telefono?: string;

  @IsOptional()
  @IsDate({ message: 'La fecha de nacimiento debe ser válida' })
  @Type(() => Date)
  fecha_nacimiento?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El género no puede exceder 20 caracteres' })
  genero?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    { message: 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial' }
  )
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El nombre del contacto de emergencia no puede exceder 200 caracteres' })
  contacto_emergencia_nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{1,3}[- ]?)?\d{7,15}$/, { message: 'El teléfono debe ser válido' })
  @MaxLength(15, { message: 'El teléfono no puede exceder 15 caracteres' })
  contacto_emergencia_telefono?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsInt()
  codigo_rol?: number;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  @Matches(/^\d{10}$/, { message: 'La cédula debe contener solo números' })
  cedula?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombres?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellidos?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{1,3}[- ]?)?\d{7,15}$/, { message: 'El teléfono debe ser válido' })
  @MaxLength(15)
  telefono?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fecha_nacimiento?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  genero?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contacto_emergencia_nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\+?\d{1,3}[- ]?)?\d{7,15}$/, { message: 'El teléfono debe ser válido' })
  @MaxLength(15)
  contacto_emergencia_telefono?: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    { message: 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial' }
  )
  newPassword: string;
}

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

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la sede es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200, { message: 'El nombre no puede exceder 200 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es requerida' })
  @MaxLength(500, { message: 'La dirección no puede exceder 500 caracteres' })
  direccion: string;

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
  @IsBoolean()
  activo?: boolean;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  direccion?: string;

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
  @IsBoolean()
  activo?: boolean;
}

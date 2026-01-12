import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Cédula ecuatoriana (10 dígitos)',
    example: '1234567890',
    minLength: 10,
    maxLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'La cédula debe tener 10 dígitos' })
  @MaxLength(10, { message: 'La cédula debe tener 10 dígitos' })
  @Matches(/^\d{10}$/, { message: 'La cédula debe contener solo números' })
  cedula: string;

  @ApiProperty({
    description: 'Nombres del paciente',
    example: 'Juan Carlos',
  })
  @IsString()
  @MinLength(2, { message: 'Los nombres deben tener al menos 2 caracteres' })
  @MaxLength(100)
  nombres: string;

  @ApiProperty({
    description: 'Apellidos del paciente',
    example: 'Pérez García',
  })
  @IsString()
  @MinLength(2, { message: 'Los apellidos deben tener al menos 2 caracteres' })
  @MaxLength(100)
  apellidos: string;

  @ApiProperty({
    description: 'Correo electrónico',
    example: 'juan.perez@example.com',
  })
  @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido' })
  email: string;

  @ApiPropertyOptional({
    description: 'Teléfono celular (09XXXXXXXX) o convencional (02XXXXXXX)',
    example: '0987654321',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(09\d{8}|0[2-7]\d{7})$/, {
    message: 'Teléfono debe ser formato ecuatoriano (09XXXXXXXX o 02XXXXXXX)',
  })
  telefono?: string;

  @ApiPropertyOptional({
    description: 'Fecha de nacimiento (ISO 8601)',
    example: '1990-05-15',
  })
  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string;

  @ApiPropertyOptional({
    description: 'Género del paciente',
    example: 'MASCULINO',
    enum: ['MASCULINO', 'FEMENINO', 'OTRO'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['MASCULINO', 'FEMENINO', 'OTRO'])
  genero?: string;

  @ApiProperty({
    description: 'Contraseña (mínimo 8 caracteres, debe incluir mayúsculas, minúsculas y números)',
    example: 'Password123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe incluir mayúsculas, minúsculas y números',
  })
  password: string;
}

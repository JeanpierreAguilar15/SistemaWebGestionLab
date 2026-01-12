import { Controller, Post, Body, Req, UseGuards, Get, Put, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo paciente' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Usuario ya existe' })
  async register(@Body() registerDto: RegisterDto, @Req() request: Request) {
    const ipAddress = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto, @Req() request: Request) {
    const ipAddress = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar token de acceso' })
  @ApiResponse({ status: 200, description: 'Token renovado exitosamente' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    const ipAddress = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.authService.refreshToken(refreshTokenDto.refresh_token, ipAddress, userAgent);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  async logout(@CurrentUser('codigo_usuario') codigo_usuario: number, @Body() body?: { refresh_token?: string }) {
    return this.authService.logout(codigo_usuario, body?.refresh_token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener información del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Información del usuario' })
  async getMe(@CurrentUser() user: any) {
    return {
      user,
    };
  }

  // ==================== PERFIL ====================

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener perfil completo del usuario' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  async getProfile(@CurrentUser('codigo_usuario') codigo_usuario: number) {
    return this.authService.getProfile(codigo_usuario);
  }

  @Put('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar perfil del usuario' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado' })
  @ApiResponse({ status: 409, description: 'Email ya en uso' })
  async updateProfile(
    @CurrentUser('codigo_usuario') codigo_usuario: number,
    @Body() data: {
      nombres?: string;
      apellidos?: string;
      email?: string;
      telefono?: string;
      direccion?: string;
      fecha_nacimiento?: string;
      genero?: 'M' | 'F' | 'O';
      contacto_emergencia_nombre?: string;
      contacto_emergencia_telefono?: string;
    },
  ) {
    return this.authService.updateProfile(codigo_usuario, data);
  }

  // ==================== CAMBIAR CONTRASEÑA ====================

  @Post('cambiar-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada correctamente' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta o nueva contraseña inválida' })
  async changePassword(
    @CurrentUser('codigo_usuario') codigo_usuario: number,
    @Body() data: { currentPassword: string; newPassword: string },
    @Req() request: Request,
  ) {
    const ipAddress = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.authService.changePassword(
      codigo_usuario,
      data.currentPassword,
      data.newPassword,
      ipAddress,
      userAgent,
    );
  }

  // ==================== CONSENTIMIENTOS ====================

  @Get('consentimientos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obtener consentimientos del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de consentimientos' })
  async getConsentimientos(@CurrentUser('codigo_usuario') codigo_usuario: number) {
    return this.authService.getConsentimientos(codigo_usuario);
  }

  @Post('consentimientos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Actualizar consentimientos del usuario' })
  @ApiResponse({ status: 200, description: 'Consentimientos actualizados' })
  async updateConsentimientos(
    @CurrentUser('codigo_usuario') codigo_usuario: number,
    @Body() consentimientos: Array<{ tipo: string; aceptado: boolean }>,
  ) {
    return this.authService.updateConsentimientos(codigo_usuario, consentimientos);
  }
}

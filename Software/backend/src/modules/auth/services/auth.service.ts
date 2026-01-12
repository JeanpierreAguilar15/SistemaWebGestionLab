import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { SecurityLoggingService, LoginFailReason } from '../../auditoria/services/security-logging.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly securityLogging: SecurityLoggingService,
  ) {}

  /**
   * Register a new patient user
   */
  async register(registerDto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const { cedula, email, password, nombres, apellidos, telefono, fecha_nacimiento, genero } =
      registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ cedula }, { email }],
      },
    });

    if (existingUser) {
      if (existingUser.cedula === cedula) {
        throw new ConflictException('La cédula ya está registrada');
      }
      if (existingUser.email === email) {
        throw new ConflictException('El correo electrónico ya está registrado');
      }
    }

    // Get PACIENTE role
    const pacienteRole = await this.prisma.rol.findFirst({
      where: { nombre: 'PACIENTE' },
    });

    if (!pacienteRole) {
      throw new BadRequestException('Rol PACIENTE no encontrado en el sistema');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const usuario = await this.prisma.usuario.create({
      data: {
        codigo_rol: pacienteRole.codigo_rol,
        cedula,
        email,
        nombres,
        apellidos,
        telefono,
        fecha_nacimiento: fecha_nacimiento ? new Date(fecha_nacimiento) : null,
        genero,
        password_hash,
        salt,
        ip_ultima_conexion: ipAddress,
      },
      include: {
        rol: true,
      },
    });

    // Create default medical profile
    await this.prisma.perfilMedico.create({
      data: {
        codigo_usuario: usuario.codigo_usuario,
      },
    });

    // Create default consents
    await this.prisma.consentimiento.createMany({
      data: [
        {
          codigo_usuario: usuario.codigo_usuario,
          tipo_consentimiento: 'USO_DATOS',
          aceptado: true,
          version_politica: '1.0',
        },
        {
          codigo_usuario: usuario.codigo_usuario,
          tipo_consentimiento: 'NOTIFICACIONES',
          aceptado: true,
          version_politica: '1.0',
        },
        {
          codigo_usuario: usuario.codigo_usuario,
          tipo_consentimiento: 'NOTIFICACIONES_WHATSAPP',
          aceptado: false, // Por defecto deshabilitado, el usuario debe optar
          version_politica: '1.0',
        },
        {
          codigo_usuario: usuario.codigo_usuario,
          tipo_consentimiento: 'COMPARTIR_INFO',
          aceptado: false,
          version_politica: '1.0',
        },
      ],
    });

    // Generate tokens
    const tokens = await this.generateTokens(usuario.codigo_usuario, ipAddress, userAgent);

    // Log activity
    await this.logActivity(
      usuario.codigo_usuario,
      'REGISTRO',
      'Usuario',
      usuario.codigo_usuario,
      'Usuario registrado exitosamente',
      ipAddress,
      userAgent,
      null,
      {
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
      },
    );

    return {
      user: {
        codigo_usuario: usuario.codigo_usuario,
        cedula: usuario.cedula,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rol.nombre,
      },
      ...tokens,
    };
  }

  /**
   * Obtiene la configuración de seguridad del sistema
   */
  private async getSecurityConfig(): Promise<{ maxIntentos: number; minutosBloqueo: number }> {
    try {
      const [maxIntentosConfig, minutosBloqueoConfig] = await Promise.all([
        this.prisma.configuracionSistema.findUnique({
          where: { clave: 'LOGIN_MAX_INTENTOS' },
        }),
        this.prisma.configuracionSistema.findUnique({
          where: { clave: 'LOGIN_MINUTOS_BLOQUEO' },
        }),
      ]);

      return {
        maxIntentos: maxIntentosConfig ? parseInt(maxIntentosConfig.valor) : 5,
        minutosBloqueo: minutosBloqueoConfig ? parseInt(minutosBloqueoConfig.valor) : 5,
      };
    } catch {
      return { maxIntentos: 5, minutosBloqueo: 5 };
    }
  }

  /**
   * Verifica si el bloqueo temporal ha expirado
   */
  private isBlockExpired(fechaBloqueo: Date | null, minutos: number): boolean {
    if (!fechaBloqueo) return true;
    const tiempoBloqueo = new Date(fechaBloqueo);
    const ahora = new Date();
    const diferenciaMins = (ahora.getTime() - tiempoBloqueo.getTime()) / (1000 * 60);
    return diferenciaMins >= minutos;
  }

  /**
   * Login user (email or cedula + password)
   * Incluye logging de seguridad para detectar ataques de fuerza bruta
   * Bloqueo temporal configurable: después de X intentos, bloquea por Y minutos
   */
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const { identifier, password } = loginDto;

    // Obtener configuración de seguridad
    const { maxIntentos, minutosBloqueo } = await this.getSecurityConfig();

    // Find user by email or cedula
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ email: identifier }, { cedula: identifier }],
      },
      include: {
        rol: true,
      },
    });

    if (!usuario) {
      // Registrar intento fallido - usuario no existe
      await this.securityLogging.logLoginAttempt({
        identificador: identifier,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        exitoso: false,
        motivoFallo: LoginFailReason.USUARIO_NO_EXISTE,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Check if account is blocked - AHORA CON BLOQUEO TEMPORAL
    if (usuario.cuenta_bloqueada) {
      // Verificar si el bloqueo ya expiró
      if (this.isBlockExpired(usuario.fecha_bloqueo, minutosBloqueo)) {
        // Desbloquear automáticamente y resetear intentos
        await this.prisma.usuario.update({
          where: { codigo_usuario: usuario.codigo_usuario },
          data: {
            cuenta_bloqueada: false,
            intentos_fallidos: 0,
            fecha_bloqueo: null,
          },
        });
        // Continuar con el login normal (no lanzar error)
      } else {
        // Calcular tiempo restante
        const tiempoRestante = Math.ceil(
          minutosBloqueo -
          (new Date().getTime() - new Date(usuario.fecha_bloqueo!).getTime()) / (1000 * 60)
        );

        // Registrar intento fallido - cuenta bloqueada
        await this.securityLogging.logLoginAttempt({
          identificador: identifier,
          ipAddress: ipAddress || 'unknown',
          userAgent,
          exitoso: false,
          motivoFallo: LoginFailReason.CUENTA_BLOQUEADA,
          codigoUsuario: usuario.codigo_usuario,
        });
        throw new UnauthorizedException(
          `Cuenta bloqueada temporalmente. Intente nuevamente en ${tiempoRestante} minuto(s)`,
        );
      }
    }

    // Check if account is active
    if (!usuario.activo) {
      // Registrar intento fallido - cuenta inactiva
      await this.securityLogging.logLoginAttempt({
        identificador: identifier,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        exitoso: false,
        motivoFallo: LoginFailReason.CUENTA_INACTIVA,
        codigoUsuario: usuario.codigo_usuario,
      });
      throw new UnauthorizedException('Cuenta desactivada. Contacte al administrador');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, usuario.password_hash);

    if (!isPasswordValid) {
      // Increment failed attempts usando configuración dinámica
      const intentos = usuario.intentos_fallidos + 1;
      const bloqueado = intentos >= maxIntentos;

      await this.prisma.usuario.update({
        where: { codigo_usuario: usuario.codigo_usuario },
        data: {
          intentos_fallidos: intentos,
          cuenta_bloqueada: bloqueado,
          fecha_bloqueo: bloqueado ? new Date() : null,
        },
      });

      // Registrar intento fallido - credenciales inválidas
      await this.securityLogging.logLoginAttempt({
        identificador: identifier,
        ipAddress: ipAddress || 'unknown',
        userAgent,
        exitoso: false,
        motivoFallo: LoginFailReason.CREDENCIALES_INVALIDAS,
        codigoUsuario: usuario.codigo_usuario,
      });

      // Si la cuenta fue bloqueada, registrar alerta adicional
      if (bloqueado) {
        await this.securityLogging.logAccountBlocked(
          usuario.codigo_usuario,
          identifier,
          ipAddress || 'unknown',
        );
      }

      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Reset failed attempts
    await this.prisma.usuario.update({
      where: { codigo_usuario: usuario.codigo_usuario },
      data: {
        intentos_fallidos: 0,
        cuenta_bloqueada: false,
        fecha_bloqueo: null,
        ultima_conexion: new Date(),
        ip_ultima_conexion: ipAddress,
      },
    });

    // Registrar login exitoso
    await this.securityLogging.logLoginAttempt({
      identificador: identifier,
      ipAddress: ipAddress || 'unknown',
      userAgent,
      exitoso: true,
      codigoUsuario: usuario.codigo_usuario,
    });

    // Generate tokens
    const tokens = await this.generateTokens(usuario.codigo_usuario, ipAddress, userAgent);

    // Log activity
    await this.logActivity(
      usuario.codigo_usuario,
      'LOGIN',
      'Usuario',
      usuario.codigo_usuario,
      'Inicio de sesión exitoso',
      ipAddress,
      userAgent,
    );

    return {
      user: {
        codigo_usuario: usuario.codigo_usuario,
        cedula: usuario.cedula,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rol.nombre,
        nivel_acceso: usuario.rol.nivel_acceso,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const sesion = await this.prisma.sesion.findFirst({
        where: {
          refresh_token: refreshToken,
          codigo_usuario: payload.sub,
          activo: true,
          revocado: false,
        },
      });

      if (!sesion) {
        throw new UnauthorizedException('Sesión inválida');
      }

      // Check if session expired
      if (new Date() > sesion.fecha_expiracion) {
        await this.prisma.sesion.update({
          where: { codigo_sesion: sesion.codigo_sesion },
          data: { activo: false },
        });
        throw new UnauthorizedException('Sesión expirada');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(payload.sub, ipAddress, userAgent);

      // Revoke old session
      await this.prisma.sesion.update({
        where: { codigo_sesion: sesion.codigo_sesion },
        data: {
          activo: false,
          revocado: true,
          fecha_revocacion: new Date(),
        },
      });

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Token de actualización inválido');
    }
  }

  /**
   * Logout user
   */
  async logout(codigo_usuario: number, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.sesion.updateMany({
        where: {
          codigo_usuario,
          refresh_token: refreshToken,
        },
        data: {
          activo: false,
          revocado: true,
          fecha_revocacion: new Date(),
        },
      });
    } else {
      // Logout from all sessions
      await this.prisma.sesion.updateMany({
        where: {
          codigo_usuario,
          activo: true,
        },
        data: {
          activo: false,
          revocado: true,
          fecha_revocacion: new Date(),
        },
      });
    }

    // Log activity
    await this.logActivity(
      codigo_usuario,
      'LOGOUT',
      'Usuario',
      codigo_usuario,
      'Cierre de sesión',
    );

    return { message: 'Sesión cerrada exitosamente' };
  }

  /**
   * Validate user by codigo_usuario (used by JWT strategy)
   */
  async validateUser(codigo_usuario: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { codigo_usuario },
      include: { rol: true },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      codigo_usuario: usuario.codigo_usuario,
      cedula: usuario.cedula,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      email: usuario.email,
      rol: usuario.rol.nombre,
      nivel_acceso: usuario.rol.nivel_acceso,
    };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(codigo_usuario: number, ipAddress?: string, userAgent?: string) {
    const jti = uuidv4();

    const accessTokenPayload = {
      sub: codigo_usuario,
      jti,
      type: 'access',
    };

    const refreshTokenPayload = {
      sub: codigo_usuario,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION') || '15m',
    });

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION') || '7d',
    });

    // Calculate expiration date
    const expirationDays = 7; // 7 days for refresh token
    const fecha_expiracion = new Date();
    fecha_expiracion.setDate(fecha_expiracion.getDate() + expirationDays);

    // Store session in database
    await this.prisma.sesion.create({
      data: {
        codigo_usuario,
        refresh_token: refreshToken,
        access_token_jti: jti,
        ip_address: ipAddress,
        user_agent: userAgent,
        fecha_expiracion,
        activo: true,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 minutes in seconds
    };
  }

  // ==================== PERFIL ====================

  /**
   * Obtener perfil completo del usuario
   */
  async getProfile(codigo_usuario: number) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { codigo_usuario },
      select: {
        codigo_usuario: true,
        cedula: true,
        nombres: true,
        apellidos: true,
        email: true,
        telefono: true,
        direccion: true,
        fecha_nacimiento: true,
        genero: true,
        contacto_emergencia_nombre: true,
        contacto_emergencia_telefono: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return usuario;
  }

  /**
   * Actualizar perfil del usuario
   */
  async updateProfile(codigo_usuario: number, data: {
    nombres?: string;
    apellidos?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    fecha_nacimiento?: string;
    genero?: 'M' | 'F' | 'O';
    contacto_emergencia_nombre?: string;
    contacto_emergencia_telefono?: string;
  }) {
    // Verificar email único si se está actualizando
    if (data.email) {
      const existingUser = await this.prisma.usuario.findFirst({
        where: {
          email: data.email,
          codigo_usuario: { not: codigo_usuario },
        },
      });

      if (existingUser) {
        throw new ConflictException('El correo electrónico ya está en uso');
      }
    }

    const usuario = await this.prisma.usuario.update({
      where: { codigo_usuario },
      data: {
        nombres: data.nombres,
        apellidos: data.apellidos,
        email: data.email,
        telefono: data.telefono,
        direccion: data.direccion,
        fecha_nacimiento: data.fecha_nacimiento ? new Date(data.fecha_nacimiento) : undefined,
        genero: data.genero,
        contacto_emergencia_nombre: data.contacto_emergencia_nombre,
        contacto_emergencia_telefono: data.contacto_emergencia_telefono,
      },
      select: {
        codigo_usuario: true,
        cedula: true,
        nombres: true,
        apellidos: true,
        email: true,
        telefono: true,
        direccion: true,
        fecha_nacimiento: true,
        genero: true,
        contacto_emergencia_nombre: true,
        contacto_emergencia_telefono: true,
      },
    });

    return usuario;
  }

  // ==================== CAMBIAR CONTRASEÑA ====================

  /**
   * Cambiar contraseña del usuario autenticado
   * Requiere la contraseña actual para verificación
   */
  async changePassword(
    codigo_usuario: number,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Obtener usuario con su password hash
    const usuario = await this.prisma.usuario.findUnique({
      where: { codigo_usuario },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, usuario.password_hash);

    if (!isCurrentPasswordValid) {
      // Registrar intento fallido
      await this.logActivity(
        codigo_usuario,
        'CAMBIO_PASSWORD_FALLIDO',
        'Usuario',
        codigo_usuario,
        'Intento fallido de cambio de contraseña - contraseña actual incorrecta',
        ipAddress,
        userAgent,
      );
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    // Validar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, usuario.password_hash);
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    // Validar fortaleza de la nueva contraseña
    if (newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    // Hash de la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña
    await this.prisma.usuario.update({
      where: { codigo_usuario },
      data: {
        password_hash: newPasswordHash,
        salt,
      },
    });

    // Revocar todas las sesiones excepto la actual (seguridad)
    await this.prisma.sesion.updateMany({
      where: {
        codigo_usuario,
        activo: true,
      },
      data: {
        activo: false,
        revocado: true,
        fecha_revocacion: new Date(),
      },
    });

    // Registrar cambio exitoso
    await this.logActivity(
      codigo_usuario,
      'CAMBIO_PASSWORD',
      'Usuario',
      codigo_usuario,
      'Contraseña cambiada exitosamente',
      ipAddress,
      userAgent,
    );

    // Generar nuevos tokens para la sesión actual
    const tokens = await this.generateTokens(codigo_usuario, ipAddress, userAgent);

    return {
      message: 'Contraseña actualizada correctamente',
      ...tokens,
    };
  }

  // ==================== CONSENTIMIENTOS ====================

  /**
   * Obtener consentimientos del usuario
   */
  async getConsentimientos(codigo_usuario: number) {
    const consentimientos = await this.prisma.consentimiento.findMany({
      where: { codigo_usuario },
      orderBy: { fecha_consentimiento: 'desc' },
    });

    // Devolver solo el consentimiento más reciente de cada tipo
    const consentimientosMap = new Map();
    for (const consent of consentimientos) {
      if (!consentimientosMap.has(consent.tipo_consentimiento)) {
        consentimientosMap.set(consent.tipo_consentimiento, consent);
      }
    }

    return Array.from(consentimientosMap.values());
  }

  /**
   * Actualizar consentimientos del usuario
   * Crea nuevos registros con la fecha actual (mantiene historial)
   */
  async updateConsentimientos(codigo_usuario: number, consentimientos: Array<{
    tipo: string;
    aceptado: boolean;
  }>) {
    // Crear nuevos registros para cada consentimiento (mantiene historial)
    for (const consent of consentimientos) {
      await this.prisma.consentimiento.create({
        data: {
          codigo_usuario,
          tipo_consentimiento: consent.tipo,
          aceptado: consent.aceptado,
          version_politica: '1.0',
        },
      });
    }

    return { message: 'Consentimientos actualizados correctamente' };
  }

  /**
   * Log user activity
   */
  private async logActivity(
    codigo_usuario: number,
    accion: string,
    entidad?: string,
    codigo_entidad?: number,
    descripcion?: string,
    ipAddress?: string,
    userAgent?: string,
    datos_anteriores?: any,
    datos_nuevos?: any,
  ) {
    try {
      await this.prisma.logActividad.create({
        data: {
          codigo_usuario,
          accion,
          entidad,
          codigo_entidad,
          descripcion,
          ip_address: ipAddress,
          user_agent: userAgent,
          datos_anteriores,
          datos_nuevos,
        },
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }
}

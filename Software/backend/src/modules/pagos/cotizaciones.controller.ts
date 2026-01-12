import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionPdfService } from './cotizacion-pdf.service';
import { PayPhoneService } from './payphone.service';
import {
  CreateCotizacionDto,
  UpdateCotizacionDto,
  EstadoCotizacion,
} from './dto';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@ApiTags('Cotizaciones')
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(
    private readonly cotizacionesService: CotizacionesService,
    private readonly pdfService: CotizacionPdfService,
    private readonly payPhoneService: PayPhoneService,
  ) {}

  // ==================== EXÁMENES PARA COTIZACIÓN ====================

  @Get('examenes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Obtener exámenes agrupados por categoría con precios y requisitos',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de categorías con exámenes disponibles',
  })
  async getExamenesParaCotizacion() {
    return this.cotizacionesService.getExamenesParaCotizacion();
  }

  // ==================== COTIZACIONES (Paciente) ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Crear cotización seleccionando exámenes (Paciente)',
  })
  @ApiResponse({ status: 201, description: 'Cotización creada con éxito' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o examen sin precio' })
  @ApiResponse({ status: 404, description: 'Examen no encontrado' })
  async createCotizacion(
    @Body() data: CreateCotizacionDto,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.cotizacionesService.createCotizacion(data, codigo_paciente);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mis cotizaciones (Paciente)' })
  @ApiResponse({ status: 200, description: 'Lista de cotizaciones del paciente' })
  async getMyCotizaciones(@CurrentUser('codigo_usuario') codigo_paciente: number) {
    return this.cotizacionesService.getMyCotizaciones(codigo_paciente);
  }

  @Get('mis-cotizaciones')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mis cotizaciones (Paciente) - Alias' })
  @ApiResponse({ status: 200, description: 'Lista de cotizaciones del paciente' })
  async getMisCotizaciones(@CurrentUser('codigo_usuario') codigo_paciente: number) {
    return this.cotizacionesService.getMyCotizaciones(codigo_paciente);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener cotización específica (Paciente)' })
  @ApiResponse({ status: 200, description: 'Detalle de la cotización' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  async getCotizacion(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.cotizacionesService.getCotizacion(id, codigo_paciente);
  }

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Descargar PDF de cotización (Paciente)' })
  @ApiResponse({ status: 200, description: 'PDF de la cotización' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  async downloadCotizacionPdf(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Obtener cotización con verificación de propiedad
    const cotizacion = await this.cotizacionesService.getCotizacion(
      id,
      codigo_paciente,
    );

    // Generar PDF
    const pdfPath = await this.pdfService.generateCotizacionPdf(cotizacion);

    if (!existsSync(pdfPath)) {
      throw new Error('Error generando PDF');
    }

    const file = createReadStream(pdfPath);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=cotizacion-${cotizacion.numero_cotizacion}.pdf`,
    });

    return new StreamableFile(file);
  }

  // ==================== SELECCIÓN DE MÉTODO DE PAGO (Paciente) ====================

  @Post(':id/seleccionar-pago')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Seleccionar método de pago para cotización (Paciente)',
    description: 'Permite al paciente elegir si pagará ONLINE (Stripe) o en VENTANILLA (presencial)',
  })
  @ApiResponse({ status: 200, description: 'Método de pago seleccionado' })
  @ApiResponse({ status: 400, description: 'Estado de cotización no válido para selección' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  async seleccionarMetodoPago(
    @Param('id', ParseIntPipe) id: number,
    @Body('metodo_pago') metodo_pago: 'ONLINE' | 'VENTANILLA',
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    if (!['ONLINE', 'VENTANILLA'].includes(metodo_pago)) {
      throw new Error('Método de pago debe ser ONLINE o VENTANILLA');
    }
    return this.cotizacionesService.seleccionarMetodoPago(id, metodo_pago, codigo_paciente);
  }

  @Get(':id/puede-agendar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verificar si se puede agendar cita con esta cotización',
  })
  @ApiResponse({ status: 200, description: 'Resultado de verificación' })
  async puedeAgendarCita(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cotizacionesService.puedeAgendarCita(id);
  }

  // ==================== COTIZACIONES (Admin) ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todas las cotizaciones (Admin)' })
  @ApiResponse({ status: 200, description: 'Lista de todas las cotizaciones' })
  async getAllCotizaciones(
    @Query('codigo_paciente') codigo_paciente?: string,
    @Query('estado') estado?: string,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};

    if (codigo_paciente) filters.codigo_paciente = parseInt(codigo_paciente);
    if (estado) filters.estado = estado;
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.cotizacionesService.getAllCotizaciones(filters);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar estado de cotización (Admin)' })
  @ApiResponse({ status: 200, description: 'Cotización actualizada' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  async updateCotizacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateCotizacionDto,
  ) {
    return this.cotizacionesService.updateCotizacion(
      id,
      data.estado || EstadoCotizacion.PENDIENTE,
      data.observaciones,
    );
  }

  @Get('admin/estadisticas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de cotizaciones (Admin)' })
  @ApiResponse({ status: 200, description: 'Estadísticas de cotizaciones' })
  async getEstadisticas(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.cotizacionesService.getEstadisticas(filters);
  }

  // ==================== PAGOS EN VENTANILLA (Admin) ====================

  @Get('admin/pendientes-ventanilla')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LABORATORISTA')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener cotizaciones pendientes de pago en ventanilla (Admin/Lab)',
    description: 'Lista de cotizaciones donde el paciente eligió pagar presencialmente',
  })
  @ApiResponse({ status: 200, description: 'Lista de cotizaciones pendientes de pago' })
  async getCotizacionesPendientesVentanilla() {
    return this.cotizacionesService.getCotizacionesPendientesVentanilla();
  }

  @Post('admin/:id/confirmar-pago-ventanilla')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'LABORATORISTA')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirmar pago en ventanilla (Admin/Lab)',
    description: 'Confirma que el paciente pagó en el laboratorio y actualiza estado a PAGADA',
  })
  @ApiResponse({ status: 200, description: 'Pago confirmado, cotización actualizada' })
  @ApiResponse({ status: 400, description: 'Estado de cotización no válido' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  async confirmarPagoVentanilla(
    @Param('id', ParseIntPipe) id: number,
    @Body('observaciones') observaciones: string,
    @CurrentUser('codigo_usuario') admin_id: number,
  ) {
    return this.cotizacionesService.confirmarPagoVentanilla(id, admin_id, observaciones);
  }

  // ==================== PAYPHONE - PAGOS ONLINE ====================

  @Get('payphone/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verificar si PayPhone está configurado',
    description: 'Retorna true si la pasarela de pago está habilitada',
  })
  @ApiResponse({ status: 200, description: 'Estado de configuración de PayPhone' })
  async getPayPhoneStatus() {
    return {
      configured: this.payPhoneService.isConfigured(),
      provider: 'PayPhone',
      description: 'Pasarela de pagos para Ecuador',
    };
  }

  @Post(':id/payphone/iniciar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Iniciar pago con PayPhone (Paciente)',
    description: 'Genera un link de pago y retorna la URL para redirigir al paciente',
  })
  @ApiResponse({
    status: 200,
    description: 'URL de pago generada',
    schema: {
      properties: {
        paymentUrl: { type: 'string', description: 'URL de redirección a PayPhone' },
        paymentId: { type: 'number', description: 'ID del pago en PayPhone' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cotización no válida para pago' })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  async iniciarPagoPayPhone(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.payPhoneService.iniciarPago(id, codigo_paciente);
  }

  @Post('payphone/confirmar')
  @Public()
  @ApiOperation({
    summary: 'Confirmar pago de PayPhone (Callback)',
    description: 'Endpoint llamado después de que el usuario regresa de PayPhone',
  })
  @ApiResponse({ status: 200, description: 'Pago confirmado' })
  @ApiResponse({ status: 400, description: 'Error en confirmación' })
  async confirmarPagoPayPhone(
    @Body('id') id: string,
    @Body('clientTransactionId') clientTransactionId: string,
  ) {
    if (!id || !clientTransactionId) {
      throw new BadRequestException('Parámetros de confirmación requeridos');
    }
    return this.payPhoneService.confirmarPago(id, clientTransactionId);
  }

  @Get('payphone/verificar/:clientTransactionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verificar estado de pago PayPhone',
    description: 'Consulta el estado de un pago específico',
  })
  @ApiResponse({ status: 200, description: 'Estado del pago' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  async verificarPagoPayPhone(
    @Param('clientTransactionId') clientTransactionId: string,
  ) {
    return this.payPhoneService.verificarEstadoPago(clientTransactionId);
  }
}

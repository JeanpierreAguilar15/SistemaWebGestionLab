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
} from '@nestjs/common';
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
import { PagosService } from './pagos.service';
import { CreatePagoDto } from './dto';

@ApiTags('Pagos')
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  // ==================== PAGOS (Paciente) ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar un pago (Paciente)' })
  @ApiResponse({ status: 201, description: 'Pago registrado con éxito' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o cotización expirada',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  async createPago(
    @Body() data: CreatePagoDto,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.pagosService.createPago(data, codigo_paciente);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mis pagos (Paciente)' })
  @ApiResponse({ status: 200, description: 'Lista de pagos del paciente' })
  async getMyPagos(@CurrentUser('codigo_usuario') codigo_paciente: number) {
    return this.pagosService.getMyPagos(codigo_paciente);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener pago específico (Paciente)' })
  @ApiResponse({ status: 200, description: 'Detalle del pago' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  async getPago(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.pagosService.getPago(id, codigo_paciente);
  }

  // ==================== PAGOS (Admin) ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los pagos (Admin)' })
  @ApiResponse({ status: 200, description: 'Lista de todos los pagos' })
  async getAllPagos(
    @Query('codigo_paciente') codigo_paciente?: string,
    @Query('codigo_cotizacion') codigo_cotizacion?: string,
    @Query('metodo_pago') metodo_pago?: string,
    @Query('estado') estado?: string,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};

    if (codigo_paciente) filters.codigo_paciente = parseInt(codigo_paciente);
    if (codigo_cotizacion)
      filters.codigo_cotizacion = parseInt(codigo_cotizacion);
    if (metodo_pago) filters.metodo_pago = metodo_pago;
    if (estado) filters.estado = estado;
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.pagosService.getAllPagos(filters);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar estado de pago (Admin)' })
  @ApiResponse({ status: 200, description: 'Pago actualizado' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  async updatePago(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { estado: string; observaciones?: string },
  ) {
    return this.pagosService.updatePago(id, data.estado, data.observaciones);
  }

  @Get('admin/estadisticas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de pagos (Admin)' })
  @ApiResponse({ status: 200, description: 'Estadísticas de pagos' })
  async getEstadisticas(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.pagosService.getEstadisticas(filters);
  }
}

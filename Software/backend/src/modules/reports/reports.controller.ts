import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reportes')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard general con KPIs principales' })
  @ApiResponse({ status: 200, description: 'KPIs del dashboard' })
  async getDashboard() {
    return this.reportsService.getDashboardGeneral();
  }

  @Get('ventas')
  @ApiOperation({ summary: 'Reporte de ventas e ingresos' })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiResponse({ status: 200, description: 'Reporte de ventas' })
  async getVentasReport(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.reportsService.getVentasReport(fecha_desde, fecha_hasta);
  }

  @Get('examenes')
  @ApiOperation({ summary: 'Reporte de examenes mas solicitados' })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiResponse({ status: 200, description: 'Ranking de examenes' })
  async getExamenesReport(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.reportsService.getExamenesPopularesReport(fecha_desde, fecha_hasta);
  }

  @Get('citas')
  @ApiOperation({ summary: 'Reporte de citas por estado, servicio y sede' })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiResponse({ status: 200, description: 'Estadisticas de citas' })
  async getCitasReport(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.reportsService.getCitasReport(fecha_desde, fecha_hasta);
  }

  @Get('cotizaciones')
  @ApiOperation({ summary: 'Reporte de cotizaciones y tasa de conversion' })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiResponse({ status: 200, description: 'Estadisticas de cotizaciones' })
  async getCotizacionesReport(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.reportsService.getCotizacionesReport(fecha_desde, fecha_hasta);
  }

  @Get('kardex')
  @ApiOperation({ summary: 'Reporte Kardex de inventario completo' })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiResponse({ status: 200, description: 'Kardex de inventario' })
  async getKardexReport(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.reportsService.getKardexCompleto(fecha_desde, fecha_hasta);
  }

  @Get('pacientes')
  @ApiOperation({ summary: 'Reporte de pacientes registrados y activos' })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiResponse({ status: 200, description: 'Estadisticas de pacientes' })
  async getPacientesReport(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.reportsService.getPacientesReport(fecha_desde, fecha_hasta);
  }

  @Get('resultados')
  @ApiOperation({ summary: 'Reporte de resultados y descargas PDF' })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiResponse({ status: 200, description: 'Estadisticas de resultados y descargas' })
  async getResultadosReport(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.reportsService.getResultadosReport(fecha_desde, fecha_hasta);
  }
}

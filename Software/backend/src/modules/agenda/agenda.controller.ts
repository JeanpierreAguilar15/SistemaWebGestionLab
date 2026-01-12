import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AgendaService } from './agenda.service';
import {
  CreateSlotDto,
  CreateCitaDto,
  UpdateCitaDto,
  QuerySlotsDto,
} from './dto';

@ApiTags('Agenda')
@Controller('agenda')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) { }

  // ==================== SLOTS (Admin) ====================

  @Get('services')
  @ApiOperation({ summary: 'Obtener todos los servicios (Público)' })
  @ApiResponse({ status: 200, description: 'Lista de servicios' })
  async getServices() {
    return this.agendaService.getAllServices();
  }

  @Post('slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear slot de disponibilidad (Admin)' })
  @ApiResponse({ status: 201, description: 'Slot creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Servicio o sede no encontrados' })
  async createSlot(
    @Body() data: CreateSlotDto,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.agendaService.createSlot(data, adminId);
  }

  @Get('slots/available')
  @ApiOperation({ summary: 'Obtener slots disponibles (Público)' })
  @ApiResponse({ status: 200, description: 'Lista de slots disponibles' })
  async getAvailableSlots(@Query() filters: QuerySlotsDto) {
    return this.agendaService.getAvailableSlots(filters);
  }

  @Get('slots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener slot por ID (Admin)' })
  @ApiResponse({ status: 200, description: 'Slot encontrado' })
  @ApiResponse({ status: 404, description: 'Slot no encontrado' })
  async getSlotById(@Param('id', ParseIntPipe) id: number) {
    return this.agendaService.getSlotById(id);
  }

  @Put('slots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar slot (Admin)' })
  @ApiResponse({ status: 200, description: 'Slot actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o slot con citas' })
  @ApiResponse({ status: 404, description: 'Slot no encontrado' })
  async updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<CreateSlotDto>,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.agendaService.updateSlot(id, data, adminId);
  }

  @Delete('slots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar slot (Admin)' })
  @ApiResponse({ status: 200, description: 'Slot eliminado o desactivado' })
  @ApiResponse({ status: 404, description: 'Slot no encontrado' })
  async deleteSlot(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.agendaService.deleteSlot(id, adminId);
  }

  @Post('admin/generate-slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generar slots masivamente (Admin)' })
  @ApiResponse({ status: 201, description: 'Slots generados exitosamente' })
  async generateSlots(
    @Body() body: { startDate: string; endDate: string },
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.agendaService.generateDailySlots(body.startDate, body.endDate, adminId);
  }

  @Delete('admin/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar slots masivamente por rango (Admin)' })
  @ApiResponse({ status: 200, description: 'Slots eliminados exitosamente' })
  async deleteSlotsByRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    if (!startDate || !endDate) {
      throw new Error('startDate y endDate son requeridos');
    }
    return this.agendaService.deleteSlotsByRange(startDate, endDate, adminId);
  }

  // ==================== CITAS (Paciente) ====================

  @Post('citas')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agendar cita (Paciente)' })
  @ApiResponse({ status: 201, description: 'Cita agendada exitosamente' })
  @ApiResponse({ status: 400, description: 'Slot no disponible o ya tiene cita' })
  @ApiResponse({ status: 404, description: 'Slot no encontrado' })
  async createCita(
    @Body() data: CreateCitaDto,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.agendaService.createCita(data, codigo_paciente);
  }

  @Get('citas/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mis citas (Paciente)' })
  @ApiResponse({ status: 200, description: 'Lista de citas del paciente' })
  async getMyCitas(@CurrentUser('codigo_usuario') codigo_paciente: number) {
    return this.agendaService.getMyCitas(codigo_paciente);
  }

  @Get('dashboard/patient')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas del dashboard del paciente' })
  @ApiResponse({ status: 200, description: 'Estadísticas del dashboard del paciente' })
  async getPatientDashboard(@CurrentUser('codigo_usuario') codigoPaciente: number) {
    return this.agendaService.getPatientDashboardStats(codigoPaciente);
  }

  @Get('citas/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener cita por ID (Paciente/Admin)' })
  @ApiResponse({ status: 200, description: 'Cita encontrada' })
  @ApiResponse({ status: 404, description: 'Cita no encontrada' })
  async getCitaById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') codigo_usuario: number,
    @CurrentUser('rol') rol: string,
  ) {
    const isAdmin = rol === 'ADMIN';
    return this.agendaService.getCitaById(id, isAdmin ? undefined : codigo_usuario);
  }

  @Put('citas/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar cita (Paciente)' })
  @ApiResponse({ status: 200, description: 'Cita cancelada' })
  @ApiResponse({ status: 404, description: 'Cita no encontrada' })
  async cancelarCita(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { motivo_cancelacion: string },
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.agendaService.cancelarCita(
      id,
      body.motivo_cancelacion,
      codigo_paciente,
    );
  }

  @Put('citas/:id/reschedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reagendar cita (Paciente)' })
  @ApiResponse({ status: 200, description: 'Cita reagendada' })
  @ApiResponse({ status: 400, description: 'Nuevo slot no disponible' })
  @ApiResponse({ status: 404, description: 'Cita o slot no encontrado' })
  async reagendarCita(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { codigo_slot: number },
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.agendaService.updateCita(
      id,
      { codigo_slot: body.codigo_slot },
      codigo_paciente,
      false,
    );
  }

  @Put('citas/:id/confirmar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar asistencia a cita (Paciente)' })
  @ApiResponse({ status: 200, description: 'Cita confirmada exitosamente' })
  @ApiResponse({ status: 400, description: 'No se puede confirmar cita en este estado' })
  @ApiResponse({ status: 404, description: 'Cita no encontrada' })
  async confirmarMiCita(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
  ) {
    return this.agendaService.confirmarCitaPaciente(id, codigo_paciente);
  }

  // ==================== CITAS (Admin) ====================

  @Get('admin/citas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todas las citas (Admin)' })
  @ApiResponse({ status: 200, description: 'Lista de todas las citas' })
  async getAllCitas(
    @Query('codigo_paciente') codigo_paciente?: string,
    @Query('codigo_servicio') codigo_servicio?: string,
    @Query('codigo_sede') codigo_sede?: string,
    @Query('estado') estado?: string,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};

    if (codigo_paciente) filters.codigo_paciente = parseInt(codigo_paciente);
    if (codigo_servicio) filters.codigo_servicio = parseInt(codigo_servicio);
    if (codigo_sede) filters.codigo_sede = parseInt(codigo_sede);
    if (estado) filters.estado = estado;
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.agendaService.getAllCitas(filters);
  }

  @Put('admin/citas/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar cita (Admin)' })
  @ApiResponse({ status: 200, description: 'Cita confirmada' })
  @ApiResponse({ status: 404, description: 'Cita no encontrada' })
  async confirmarCita(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.agendaService.confirmarCita(id, adminId);
  }

  @Put('admin/citas/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar cita (Admin)' })
  @ApiResponse({ status: 200, description: 'Cita actualizada' })
  @ApiResponse({ status: 404, description: 'Cita no encontrada' })
  async updateCitaAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateCitaDto,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.agendaService.updateCita(id, data, adminId, true);
  }

  @Get('admin/estadisticas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de citas (Admin)' })
  @ApiResponse({ status: 200, description: 'Estadísticas de citas' })
  async getEstadisticas(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.agendaService.getEstadisticas(filters);
  }
}

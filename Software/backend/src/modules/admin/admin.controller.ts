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
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  NotFoundException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { InventarioService } from '../inventario/inventario.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { getAllRoleLevels, getPermissionsForLevel } from './constants/role-permissions';
import {
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  CreateRoleDto,
  UpdateRoleDto,
  CreateServiceDto,
  UpdateServiceDto,
  CreateLocationDto,
  UpdateLocationDto,
  CreateExamDto,
  UpdateExamDto,
  CreatePriceDto,
  UpdatePriceDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreatePackageDto,
  UpdatePackageDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateMovimientoDto,
  FilterMovimientosDto,
} from './dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly inventarioService: InventarioService,
  ) { }
  @Get('users')
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      filters,
    );
  }

  @Get('users/:id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateUserDto,
  ) {
    return this.usersService.create(data, adminId);
  }

  @Put('users/:id')
  async updateUser(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateUserDto,
  ) {
    return this.usersService.update(id, data, adminId);
  }

  @Delete('users/:id')
  async deleteUser(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.delete(id, adminId);
  }

  @Put('users/:id/toggle-status')
  async toggleUserStatus(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usersService.toggleStatus(id, adminId);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(id, data.newPassword, adminId);
  }

  // ==================== ROLES ====================

  @Get('roles/permissions')
  async getRolePermissions() {
    return getAllRoleLevels();
  }

  @Get('roles/permissions/:nivel')
  async getPermissionsByLevel(@Param('nivel', ParseIntPipe) nivel: number) {
    const permissions = getPermissionsForLevel(nivel);
    if (!permissions) {
      throw new NotFoundException(`No se encontraron permisos para el nivel ${nivel}`);
    }
    return permissions;
  }

  @Get('roles')
  async getAllRoles() {
    return this.adminService.getAllRoles();
  }

  @Get('roles/:id')
  async getRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getRoleById(id);
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  async createRole(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateRoleDto,
  ) {
    return this.adminService.createRole(data, adminId);
  }

  @Put('roles/:id')
  async updateRole(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateRoleDto,
  ) {
    return this.adminService.updateRole(id, data, adminId);
  }

  @Delete('roles/:id')
  async deleteRole(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteRole(id, adminId);
  }

  // ==================== SERVICIOS ====================

  @Get('services')
  async getAllServices() {
    return this.adminService.getAllServices();
  }

  @Get('services/:id')
  async getServiceById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getServiceById(id);
  }

  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  async createService(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateServiceDto,
  ) {
    return this.adminService.createService(data, adminId);
  }

  @Put('services/:id')
  async updateService(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateServiceDto,
  ) {
    return this.adminService.updateService(id, data, adminId);
  }

  @Delete('services/:id')
  async deleteService(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteService(id, adminId);
  }

  // ==================== SEDES ====================

  @Get('locations')
  async getAllLocations() {
    return this.adminService.getAllLocations();
  }

  @Get('locations/:id')
  async getLocationById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getLocationById(id);
  }

  @Post('locations')
  @HttpCode(HttpStatus.CREATED)
  async createLocation(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateLocationDto,
  ) {
    return this.adminService.createLocation(data, adminId);
  }

  @Put('locations/:id')
  async updateLocation(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateLocationDto,
  ) {
    return this.adminService.updateLocation(id, data, adminId);
  }

  @Delete('locations/:id')
  async deleteLocation(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteLocation(id, adminId);
  }

  // ==================== EXAMENES ====================

  @Get('exams')
  async getAllExams(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.adminService.getAllExams(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      filters,
    );
  }

  @Get('exams/:id')
  async getExamById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getExamById(id);
  }

  @Post('exams')
  @HttpCode(HttpStatus.CREATED)
  async createExam(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateExamDto,
  ) {
    return this.adminService.createExam(data, adminId);
  }

  @Put('exams/:id')
  async updateExam(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateExamDto,
  ) {
    return this.adminService.updateExam(id, data, adminId);
  }

  @Delete('exams/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExam(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteExam(id, adminId);
  }

  // ==================== PRECIOS ====================

  @Get('prices')
  async getAllPrices(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.adminService.getAllPrices(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      filters,
    );
  }

  @Get('prices/:id')
  async getPriceById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getPriceById(id);
  }

  @Post('prices')
  @HttpCode(HttpStatus.CREATED)
  async createPrice(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreatePriceDto,
  ) {
    return this.adminService.createPrice(data, adminId);
  }

  @Put('prices/:id')
  async updatePrice(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdatePriceDto,
  ) {
    return this.adminService.updatePrice(id, data, adminId);
  }

  @Delete('prices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePrice(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deletePrice(id, adminId);
  }

  // ==================== CATEGORIAS ====================

  @Get('exam-categories')
  async getAllExamCategories() {
    return this.adminService.getAllExamCategories();
  }

  @Post('exam-categories')
  @HttpCode(HttpStatus.CREATED)
  async createExamCategory(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateCategoryDto,
  ) {
    return this.adminService.createExamCategory(data, adminId);
  }

  @Put('exam-categories/:id')
  async updateExamCategory(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateCategoryDto,
  ) {
    return this.adminService.updateExamCategory(id, data, adminId);
  }

  @Delete('exam-categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExamCategory(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteExamCategory(id, adminId);
  }

  // ==================== PAQUETES ====================

  @Get('packages')
  async getAllPackages() {
    return this.adminService.getAllPackages();
  }

  @Get('packages/:id')
  async getPackageById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getPackageById(id);
  }

  @Post('packages')
  @HttpCode(HttpStatus.CREATED)
  async createPackage(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreatePackageDto,
  ) {
    return this.adminService.createPackage(data, adminId);
  }

  @Put('packages/:id')
  async updatePackage(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdatePackageDto,
  ) {
    return this.adminService.updatePackage(id, data, adminId);
  }

  @Delete('packages/:id')
  async deletePackage(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deletePackage(id, adminId);
  }

  // ==================== INVENTARIO ====================

  @Get('inventory/items')
  async getAllInventoryItems(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.inventarioService.getAllInventoryItems(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      filters,
    );
  }

  @Get('inventory/items/:id')
  async getInventoryItemById(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.getInventoryItemById(id);
  }

  @Post('inventory/items')
  @HttpCode(HttpStatus.CREATED)
  async createInventoryItem(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateInventoryItemDto,
  ) {
    return this.inventarioService.createInventoryItem(data, adminId);
  }

  @Put('inventory/items/:id')
  async updateInventoryItem(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateInventoryItemDto,
  ) {
    return this.inventarioService.updateInventoryItem(id, data, adminId);
  }

  @Delete('inventory/items/:id')
  async deleteInventoryItem(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventarioService.deleteInventoryItem(id, adminId);
  }

  // ==================== MOVIMIENTOS DE STOCK ====================

  @Post('inventory/movements')
  @HttpCode(HttpStatus.CREATED)
  async createMovimiento(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateMovimientoDto,
  ) {
    return this.inventarioService.createMovimiento(data, adminId);
  }

  @Get('inventory/movements')
  async getAllMovimientos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.inventarioService.getAllMovimientos(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      filters,
    );
  }

  @Get('inventory/kardex/:itemId')
  async getKardexByItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    return this.inventarioService.getKardexByItem(itemId, fecha_desde, fecha_hasta);
  }

  // ==================== ALERTAS DE STOCK ====================

  @Get('inventory/alertas')
  async getAlertasStock(
    @Query('tipo') tipo?: string,
    @Query('codigo_item') codigo_item?: string,
    @Query('activo') activo?: string,
  ) {
    const filters: any = {};
    if (tipo) filters.tipo = tipo;
    if (codigo_item) filters.codigo_item = parseInt(codigo_item);
    if (activo) filters.activo = activo;

    return this.inventarioService.getAlertasStock(filters);
  }

  @Get('inventory/alertas/estadisticas')
  async getEstadisticasAlertas() {
    return this.inventarioService.getEstadisticasAlertas();
  }

  // ==================== PROVEEDORES ====================

  @Get('suppliers')
  async getAllSuppliers(@Query('includeInactive') includeInactive?: string) {
    // Convertir string a boolean (los query params llegan como strings)
    const incluirInactivos = includeInactive === 'true';
    return this.inventarioService.getAllSuppliers(incluirInactivos);
  }

  @Get('suppliers/:id')
  async getSupplierById(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.getSupplierById(id);
  }

  @Post('suppliers')
  @HttpCode(HttpStatus.CREATED)
  async createSupplier(
    @CurrentUser('codigo_usuario') adminId: number,
    @Body() data: CreateSupplierDto,
  ) {
    return this.inventarioService.createSupplier(data, adminId);
  }

  @Put('suppliers/:id')
  async updateSupplier(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateSupplierDto,
  ) {
    return this.inventarioService.updateSupplier(id, data, adminId);
  }

  @Delete('suppliers/:id')
  async deleteSupplier(
    @CurrentUser('codigo_usuario') adminId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventarioService.deleteSupplier(id, adminId);
  }

  // ==================== AUDITORIA ====================

  @Get('audit/activity-logs')
  async getActivityLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.adminService.getActivityLogs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      filters,
    );
  }

  @Get('audit/activity-logs/pdf')
  async getActivityLogsPdf(
    @Query() filters: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdfBuffer = await this.adminService.generateAuditPdf(filters);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=reporte-auditoria-${new Date().toISOString().split('T')[0]}.pdf`,
    });

    return new StreamableFile(pdfBuffer);
  }

  @Get('audit/error-logs')
  async getErrorLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.adminService.getErrorLogs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      filters,
    );
  }

  // ==================== ESTADÍSTICAS ====================

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ==================== ÓRDENES DE COMPRA ====================

  @Post('purchase-orders')
  @ApiOperation({ summary: 'Crear orden de compra' })
  async createPurchaseOrder(
    @Body() data: any,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.inventarioService.createOrdenCompra(data, adminId);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Obtener todas las órdenes de compra' })
  async getAllPurchaseOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query() filters?: any,
  ) {
    return this.inventarioService.getAllOrdenesCompra(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      filters,
    );
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Obtener orden de compra por ID' })
  async getPurchaseOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.getOrdenCompraById(id);
  }

  @Put('purchase-orders/:id')
  @ApiOperation({ summary: 'Actualizar orden de compra' })
  async updatePurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.inventarioService.updateOrdenCompra(id, data, adminId);
  }

  @Delete('purchase-orders/:id')
  @ApiOperation({ summary: 'Eliminar orden de compra' })
  async deletePurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.inventarioService.deleteOrdenCompra(id, adminId);
  }

  @Post('purchase-orders/:id/emit')
  @ApiOperation({ summary: 'Emitir orden de compra' })
  async emitPurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.inventarioService.emitirOrdenCompra(id, adminId);
  }

  @Post('purchase-orders/:id/receive')
  @ApiOperation({ summary: 'Recibir orden de compra' })
  async receivePurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.inventarioService.recibirOrdenCompra(id, data, adminId);
  }

  @Post('purchase-orders/:id/cancel')
  @ApiOperation({ summary: 'Cancelar orden de compra' })
  async cancelPurchaseOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.inventarioService.cancelarOrdenCompra(id, adminId);
  }

  // ==================== CONFIGURACIÓN DEL SISTEMA ====================

  @Get('config')
  @ApiOperation({ summary: 'Obtener todas las configuraciones del sistema' })
  async getSystemConfig(@Query('grupo') grupo?: string) {
    return this.adminService.getSystemConfig(grupo);
  }

  @Get('config/security')
  @ApiOperation({ summary: 'Obtener configuración de seguridad de login' })
  async getSecurityConfig() {
    return this.adminService.getSecurityConfig();
  }

  @Put('config/:clave')
  @ApiOperation({ summary: 'Actualizar una configuración del sistema' })
  async updateSystemConfig(
    @Param('clave') clave: string,
    @Body('valor') valor: string,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.adminService.updateSystemConfig(clave, valor, adminId);
  }

  @Post('config/security/init')
  @ApiOperation({ summary: 'Inicializar configuraciones de seguridad por defecto' })
  async initSecurityConfigs() {
    return this.adminService.ensureSecurityConfigs();
  }

  // ==================== GESTIÓN DE CUENTAS BLOQUEADAS ====================

  @Get('users/blocked')
  @ApiOperation({ summary: 'Obtener usuarios con cuentas bloqueadas' })
  async getBlockedUsers() {
    return this.adminService.getBlockedUsers();
  }

  @Post('users/:id/unlock')
  @ApiOperation({ summary: 'Desbloquear cuenta de usuario' })
  async unlockUserAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.adminService.unlockUserAccount(id, adminId);
  }
}

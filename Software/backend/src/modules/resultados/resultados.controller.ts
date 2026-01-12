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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ResultadosService } from './resultados.service';
import { CreateResultadoDto, UpdateResultadoDto, CreateMuestraDto } from './dto';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@ApiTags('Resultados')
@Controller('resultados')
export class ResultadosController {
  constructor(private readonly resultadosService: ResultadosService) {}

  // ==================== MUESTRAS (Admin/Técnico) ====================

  @Post('muestras')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nueva muestra (Admin/Técnico)' })
  @ApiResponse({ status: 201, description: 'Muestra creada' })
  @ApiResponse({ status: 400, description: 'ID de muestra duplicado' })
  async createMuestra(
    @Body() data: CreateMuestraDto,
    @CurrentUser('codigo_usuario') tomada_por: number,
  ) {
    return this.resultadosService.createMuestra(data, tomada_por);
  }

  @Get('muestras')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener muestras con filtros (Admin/Técnico)' })
  @ApiResponse({ status: 200, description: 'Lista de muestras' })
  async getMuestras(
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

    return this.resultadosService.getMuestras(filters);
  }

  // ==================== RESULTADOS (Admin/Técnico) ====================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear resultado para muestra (Admin/Técnico)' })
  @ApiResponse({ status: 201, description: 'Resultado creado' })
  @ApiResponse({ status: 404, description: 'Muestra o examen no encontrado' })
  async createResultado(
    @Body() data: CreateResultadoDto,
    @CurrentUser('codigo_usuario') procesado_por: number,
  ) {
    return this.resultadosService.createResultado(data, procesado_por);
  }

  @Put(':id/validar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validar resultado y generar PDF (Admin/Técnico)' })
  @ApiResponse({ status: 200, description: 'Resultado validado y PDF generado' })
  @ApiResponse({ status: 404, description: 'Resultado no encontrado' })
  async validarResultado(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') validado_por: number,
  ) {
    return this.resultadosService.validarResultado(id, validado_por);
  }

  @Post(':id/upload-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'resultados'),
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `resultado_${req.params.id}_${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Solo se permiten archivos PDF'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
      },
    }),
  )
  @ApiOperation({ summary: 'Subir PDF de resultado manualmente (Admin/Técnico)' })
  @ApiResponse({ status: 200, description: 'PDF subido correctamente' })
  @ApiResponse({ status: 400, description: 'Archivo inválido' })
  @ApiResponse({ status: 404, description: 'Resultado no encontrado' })
  async uploadPdf(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @CurrentUser('codigo_usuario') validado_por: number,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    return this.resultadosService.uploadPdfManually(id, file.filename, validado_por);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los resultados (Admin)' })
  @ApiResponse({ status: 200, description: 'Lista de resultados' })
  async getAllResultados(
    @Query('codigo_paciente') codigo_paciente?: string,
    @Query('codigo_examen') codigo_examen?: string,
    @Query('estado') estado?: string,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};

    if (codigo_paciente) filters.codigo_paciente = parseInt(codigo_paciente);
    if (codigo_examen) filters.codigo_examen = parseInt(codigo_examen);
    if (estado) filters.estado = estado;
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.resultadosService.getAllResultados(filters);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar resultado (Admin)' })
  @ApiResponse({ status: 200, description: 'Resultado actualizado' })
  async updateResultado(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateResultadoDto,
    @CurrentUser('codigo_usuario') adminId: number,
  ) {
    return this.resultadosService.updateResultado(id, data, adminId);
  }

  @Get('admin/estadisticas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de resultados (Admin)' })
  @ApiResponse({ status: 200, description: 'Estadísticas' })
  async getEstadisticas(
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
  ) {
    const filters: any = {};
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;

    return this.resultadosService.getEstadisticas(filters);
  }

  @Get('admin/:id/descargar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'PERSONAL_LAB')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Descargar PDF del resultado (Admin)' })
  @ApiResponse({ status: 200, description: 'PDF del resultado' })
  @ApiResponse({ status: 404, description: 'Resultado no encontrado' })
  async downloadResultadoAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.resultadosService.getAllResultados({ codigo_resultado: id });

    if (!resultado || resultado.length === 0) {
      throw new NotFoundException('Resultado no encontrado');
    }

    const url_pdf = resultado[0].url_pdf;

    if (!url_pdf) {
      throw new NotFoundException('PDF no disponible');
    }

    // Construir path del archivo
    const filepath = join(process.cwd(), url_pdf);

    if (!existsSync(filepath)) {
      throw new Error('Archivo PDF no encontrado');
    }

    const file = createReadStream(filepath);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=resultado-${id}.pdf`,
    });

    return new StreamableFile(file);
  }

  // ==================== RESULTADOS (Paciente) ====================

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mis resultados (Paciente)' })
  @ApiResponse({ status: 200, description: 'Lista de resultados del paciente' })
  async getMyResultados(@CurrentUser('codigo_usuario') codigo_paciente: number) {
    return this.resultadosService.getMyResultados(codigo_paciente);
  }

  @Get(':id/descargar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Descargar PDF del resultado (Paciente)' })
  @ApiResponse({ status: 200, description: 'PDF del resultado' })
  @ApiResponse({ status: 404, description: 'Resultado no encontrado o no disponible' })
  async downloadResultado(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('codigo_usuario') codigo_paciente: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const url_pdf = await this.resultadosService.downloadResultado(
      id,
      codigo_paciente,
    );

    // Construir path del archivo
    const filepath = join(process.cwd(), url_pdf);

    if (!existsSync(filepath)) {
      throw new Error('Archivo PDF no encontrado');
    }

    const file = createReadStream(filepath);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=resultado-${id}.pdf`,
    });

    return new StreamableFile(file);
  }
}

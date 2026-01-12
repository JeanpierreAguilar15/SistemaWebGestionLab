import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('examenes')
@UseGuards(JwtAuthGuard)
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  /**
   * GET /examenes/catalogo
   * Obtiene el catálogo completo de exámenes con precios
   */
  @Get('catalogo')
  async getCatalogo() {
    return this.catalogoService.getCatalogo();
  }

  /**
   * GET /examenes/categorias
   * Obtiene las categorías de exámenes
   */
  @Get('categorias')
  async getCategorias() {
    return this.catalogoService.getCategorias();
  }

  /**
   * GET /examenes/:id
   * Obtiene un examen específico por su código
   */
  @Get(':id')
  async getExamenById(@Param('id', ParseIntPipe) id: number) {
    return this.catalogoService.getExamenById(id);
  }
}

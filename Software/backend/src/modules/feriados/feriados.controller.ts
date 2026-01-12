import {
    Controller,
    Get,
    Post,
    Body,
    Put,
    Param,
    Delete,
    UseGuards,
    ParseIntPipe,
} from '@nestjs/common';
import { FeriadosService } from './feriados.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Feriados')
@Controller('feriados')
export class FeriadosController {
    constructor(private readonly feriadosService: FeriadosService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Crear un nuevo feriado' })
    create(@Body() createFeriadoDto: { fecha: string; descripcion: string; activo?: boolean }) {
        return this.feriadosService.create(createFeriadoDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los feriados' })
    findAll() {
        return this.feriadosService.findAll();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obtener un feriado por ID' })
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.feriadosService.findOne(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Actualizar un feriado' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateFeriadoDto: { fecha?: string; descripcion?: string; activo?: boolean },
    ) {
        return this.feriadosService.update(id, updateFeriadoDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Eliminar un feriado' })
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.feriadosService.remove(id);
    }
}

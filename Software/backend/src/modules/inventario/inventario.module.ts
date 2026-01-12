import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';
import { OcrFacturaService } from './services/ocr-factura.service';
import { AlertasProgramadasService } from './services/alertas-programadas.service';
import { PdfInventarioService } from './services/pdf-inventario.service';
import { ReactivosService } from './services/reactivos.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ComunicacionesModule } from '../comunicaciones/comunicaciones.module';

@Module({
    imports: [PrismaModule, ConfigModule, ComunicacionesModule],
    controllers: [InventarioController],
    providers: [InventarioService, OcrFacturaService, AlertasProgramadasService, PdfInventarioService, ReactivosService],
    exports: [InventarioService, AlertasProgramadasService, PdfInventarioService, ReactivosService],
})
export class InventarioModule { }

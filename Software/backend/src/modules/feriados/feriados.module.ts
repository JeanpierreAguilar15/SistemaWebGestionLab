import { Module } from '@nestjs/common';
import { FeriadosService } from './feriados.service';
import { FeriadosController } from './feriados.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FeriadosController],
    providers: [FeriadosService],
    exports: [FeriadosService],
})
export class FeriadosModule { }

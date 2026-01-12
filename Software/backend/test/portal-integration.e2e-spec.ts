import { Test, TestingModule } from '@nestjs/testing';
import { AgendaController } from '../src/modules/agenda/agenda.controller';
import { CotizacionesController } from '../src/modules/pagos/cotizaciones.controller';
import { AgendaService } from '../src/modules/agenda/agenda.service';
import { CotizacionesService } from '../src/modules/pagos/cotizaciones.service';
import { CotizacionPdfService } from '../src/modules/pagos/cotizacion-pdf.service';

describe('Portal Integration', () => {
    let agendaController: AgendaController;
    let cotizacionesController: CotizacionesController;

    const mockAgendaService = {
        getAllServices: jest.fn(() => [
            { codigo_servicio: 1, nombre: 'Laboratorio General' },
        ]),
    };

    const mockCotizacionesService = {
        getExamenesParaCotizacion: jest.fn(() => [
            { nombre: 'HEMATOLOGIA', examenes: [] },
        ]),
    };

    const mockCotizacionPdfService = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AgendaController, CotizacionesController],
            providers: [
                { provide: AgendaService, useValue: mockAgendaService },
                { provide: CotizacionesService, useValue: mockCotizacionesService },
                { provide: CotizacionPdfService, useValue: mockCotizacionPdfService },
            ],
        }).compile();

        agendaController = module.get<AgendaController>(AgendaController);
        cotizacionesController = module.get<CotizacionesController>(CotizacionesController);
    });

    it('should return services from AgendaController (used by Portal Citas)', async () => {
        const result = await agendaController.getServices();
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result[0].nombre).toBe('Laboratorio General');
        expect(mockAgendaService.getAllServices).toHaveBeenCalled();
    });

    it('should return exams from CotizacionesController (used by Portal Cotizaciones)', async () => {
        const result = await cotizacionesController.getExamenesParaCotizacion();
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result[0].nombre).toBe('HEMATOLOGIA');
        expect(mockCotizacionesService.getExamenesParaCotizacion).toHaveBeenCalled();
    });
});

import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { createWriteStream, mkdirSync, existsSync } from 'fs';

/**
 * Servicio para generar PDFs de resultados de laboratorio
 *
 * IMPORTANTE: Requiere instalación de pdfkit
 * npm install pdfkit @types/pdfkit
 */
@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly outputDir = join(process.cwd(), 'uploads', 'resultados');

  constructor() {
    // Crear directorio si no existe
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
      this.logger.log(`📁 Created output directory: ${this.outputDir}`);
    }
  }

  /**
   * Generar PDF de resultado de laboratorio
   */
  async generateResultadoPdf(data: {
    resultado: any;
    paciente: any;
    examen: any;
    codigo_verificacion: string;
  }): Promise<string> {
    try {
      // Importación dinámica de PDFKit
      const PDFDocument = await this.importPDFKit();

      const filename = `resultado_${data.resultado.codigo_resultado}_${Date.now()}.pdf`;
      const filepath = join(this.outputDir, filename);

      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({
            size: 'LETTER',
            margins: {
              top: 50,
              bottom: 50,
              left: 50,
              right: 50,
            },
            info: {
              Title: `Resultado de Laboratorio - ${data.examen.nombre}`,
              Author: 'Laboratorio Clínico Franz',
              Subject: 'Resultado de Examen de Laboratorio',
              Creator: 'Sistema de Gestión Laboratorio Franz',
            },
          });

          const stream = createWriteStream(filepath);

          doc.pipe(stream);

          // Header con logo y datos del laboratorio
          this.addHeader(doc);

          // Información del paciente
          this.addPatientInfo(doc, data.paciente);

          // Información del examen
          this.addExamInfo(doc, data.examen, data.resultado);

          // Resultados
          this.addResults(doc, data.resultado, data.examen);

          // Footer con código de verificación
          this.addFooter(doc, data.codigo_verificacion);

          doc.end();

          stream.on('finish', () => {
            this.logger.log(`✅ PDF generated: ${filename}`);
            resolve(filepath);
          });

          stream.on('error', (error) => {
            this.logger.error(`❌ Error generating PDF: ${error.message}`);
            reject(error);
          });
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      this.logger.error(`❌ Failed to generate PDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Importar PDFKit dinámicamente
   */
  private async importPDFKit() {
    try {
      const PDFKit = await import('pdfkit');
      return (PDFKit.default as any) || PDFKit;
    } catch (error) {
      throw new Error(
        'PDFKit is not installed. Please run: npm install pdfkit @types/pdfkit',
      );
    }
  }

  /**
   * Agregar header con logo y datos del laboratorio
   */
  private addHeader(doc: any) {
    // Título del laboratorio
    doc
      .fontSize(20)
      .fillColor('#2563EB')
      .font('Helvetica-Bold')
      .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

    doc
      .fontSize(10)
      .fillColor('#666666')
      .font('Helvetica')
      .text('Av. Principal 123, Quito - Ecuador', { align: 'center' })
      .text('Tel: (02) 1234-5678 | Email: info@labfranz.com', {
        align: 'center',
      })
      .moveDown(1);

    // Línea separadora
    doc
      .strokeColor('#2563EB')
      .lineWidth(2)
      .moveTo(50, doc.y)
      .lineTo(562, doc.y)
      .stroke()
      .moveDown(1.5);

    // Título del documento
    doc
      .fontSize(16)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('RESULTADO DE LABORATORIO', { align: 'center' })
      .moveDown(2);
  }

  /**
   * Agregar información del paciente
   */
  private addPatientInfo(doc: any, paciente: any) {
    const startY = doc.y;

    // Sección de paciente
    doc
      .fontSize(12)
      .fillColor('#2563EB')
      .font('Helvetica-Bold')
      .text('DATOS DEL PACIENTE', { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Nombre: ', { continued: true })
      .font('Helvetica')
      .text(`${paciente.nombres} ${paciente.apellidos}`)
      .font('Helvetica-Bold')
      .text('Cédula: ', { continued: true })
      .font('Helvetica')
      .text(paciente.cedula || 'N/A')
      .font('Helvetica-Bold')
      .text('Fecha de Nacimiento: ', { continued: true })
      .font('Helvetica')
      .text(
        paciente.fecha_nacimiento
          ? new Date(paciente.fecha_nacimiento).toLocaleDateString('es-EC')
          : 'N/A',
      )
      .font('Helvetica-Bold')
      .text('Email: ', { continued: true })
      .font('Helvetica')
      .text(paciente.email || 'N/A')
      .font('Helvetica-Bold')
      .text('Teléfono: ', { continued: true })
      .font('Helvetica')
      .text(paciente.telefono || 'N/A')
      .moveDown(1.5);
  }

  /**
   * Agregar información del examen
   */
  private addExamInfo(doc: any, examen: any, resultado: any) {
    doc
      .fontSize(12)
      .fillColor('#2563EB')
      .font('Helvetica-Bold')
      .text('INFORMACIÓN DEL EXAMEN', { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Examen: ', { continued: true })
      .font('Helvetica')
      .text(examen.nombre)
      .font('Helvetica-Bold')
      .text('Código Interno: ', { continued: true })
      .font('Helvetica')
      .text(examen.codigo_interno || 'N/A')
      .font('Helvetica-Bold')
      .text('Fecha de Resultado: ', { continued: true })
      .font('Helvetica')
      .text(new Date(resultado.fecha_resultado).toLocaleDateString('es-EC'))
      .font('Helvetica-Bold')
      .text('Estado: ', { continued: true })
      .font('Helvetica')
      .text(resultado.estado)
      .moveDown(1.5);
  }

  /**
   * Agregar tabla de resultados
   */
  private addResults(doc: any, resultado: any, examen: any) {
    doc
      .fontSize(12)
      .fillColor('#2563EB')
      .font('Helvetica-Bold')
      .text('RESULTADOS', { underline: true })
      .moveDown(0.5);

    // Tabla de resultados
    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 200;
    const col3X = 350;
    const col4X = 480;

    // Encabezados
    doc
      .fontSize(10)
      .fillColor('#FFFFFF')
      .rect(col1X, tableTop, 512, 25)
      .fill('#2563EB');

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .text('Parámetro', col1X + 5, tableTop + 8, { width: 140 })
      .text('Resultado', col2X + 5, tableTop + 8, { width: 140 })
      .text('Unidad', col3X + 5, tableTop + 8, { width: 120 })
      .text('Ref.', col4X + 5, tableTop + 8, { width: 75 });

    // Contenido
    const rowY = tableTop + 30;

    doc
      .fillColor('#000000')
      .font('Helvetica')
      .text(examen.nombre, col1X + 5, rowY, { width: 140 });

    // Valor resultado
    const valor = resultado.valor_numerico
      ? resultado.valor_numerico.toString()
      : resultado.valor_texto || 'N/A';

    // Color según nivel
    let resultColor = '#000000';
    if (resultado.nivel === 'ALTO') resultColor = '#EF4444'; // Rojo
    if (resultado.nivel === 'BAJO') resultColor = '#F97316'; // Naranja
    if (resultado.nivel === 'CRITICO') resultColor = '#DC2626'; // Rojo oscuro

    doc
      .fillColor(resultColor)
      .font('Helvetica-Bold')
      .text(valor, col2X + 5, rowY, { width: 140 });

    doc
      .fillColor('#000000')
      .font('Helvetica')
      .text(resultado.unidad_medida || '-', col3X + 5, rowY, { width: 120 });

    // Valores de referencia
    const referencia =
      resultado.valores_referencia_texto ||
      (resultado.valor_referencia_min && resultado.valor_referencia_max
        ? `${resultado.valor_referencia_min} - ${resultado.valor_referencia_max}`
        : 'N/A');

    doc.text(referencia, col4X + 5, rowY, { width: 75 });

    doc.moveDown(3);

    // Observaciones técnicas
    if (resultado.observaciones_tecnicas) {
      doc
        .fontSize(10)
        .fillColor('#2563EB')
        .font('Helvetica-Bold')
        .text('OBSERVACIONES:', { underline: true })
        .moveDown(0.3);

      doc
        .fillColor('#000000')
        .font('Helvetica')
        .text(resultado.observaciones_tecnicas, { align: 'justify' })
        .moveDown(1);
    }

    // Nota importante
    doc
      .fontSize(8)
      .fillColor('#666666')
      .font('Helvetica-Oblique')
      .text(
        'NOTA: Este resultado debe ser interpretado por un médico calificado. Los valores de referencia pueden variar según edad, sexo y condición del paciente.',
        { align: 'justify' },
      )
      .moveDown(2);
  }

  /**
   * Agregar footer con código de verificación
   */
  private addFooter(doc: any, codigo_verificacion: string) {
    const bottomY = 700;

    // Línea separadora
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(1)
      .moveTo(50, bottomY)
      .lineTo(562, bottomY)
      .stroke();

    // Código de verificación
    doc
      .fontSize(8)
      .fillColor('#666666')
      .font('Helvetica')
      .text(
        `Código de verificación: ${codigo_verificacion}`,
        50,
        bottomY + 10,
        { align: 'center' },
      )
      .text(
        `Documento generado el ${new Date().toLocaleString('es-EC')}`,
        50,
        bottomY + 22,
        { align: 'center' },
      )
      .text(
        'Este documento es válido únicamente con el código de verificación',
        50,
        bottomY + 34,
        { align: 'center' },
      );
  }

  /**
   * Obtener la ruta del directorio de salida
   */
  getOutputDir(): string {
    return this.outputDir;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { createWriteStream, mkdirSync, existsSync } from 'fs';

/**
 * Servicio para generar PDFs de cotizaciones
 *
 * IMPORTANTE: Requiere instalación de pdfkit
 * npm install pdfkit @types/pdfkit
 */
@Injectable()
export class CotizacionPdfService {
  private readonly logger = new Logger(CotizacionPdfService.name);
  private readonly outputDir = join(process.cwd(), 'uploads', 'cotizaciones');

  constructor() {
    // Crear directorio si no existe
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
      this.logger.log(`📁 Created output directory: ${this.outputDir}`);
    }
  }

  /**
   * Generar PDF de cotización
   */
  async generateCotizacionPdf(cotizacion: any): Promise<string> {
    try {
      // Importación dinámica de PDFKit
      const PDFDocument = await this.importPDFKit();

      const filename = `cotizacion_${cotizacion.numero_cotizacion}_${Date.now()}.pdf`;
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
              Title: `Cotización ${cotizacion.numero_cotizacion}`,
              Author: 'Laboratorio Clínico Franz',
              Subject: 'Cotización de Exámenes de Laboratorio',
              Creator: 'Sistema de Gestión Laboratorio Franz',
            },
          });

          const stream = createWriteStream(filepath);
          doc.pipe(stream);

          // Header con logo y datos del laboratorio
          this.addHeader(doc);

          // Información de la cotización
          this.addCotizacionInfo(doc, cotizacion);

          // Información del paciente
          this.addPatientInfo(doc, cotizacion.paciente);

          // Tabla de exámenes
          this.addExamTable(doc, cotizacion);

          // Requisitos y preparación
          this.addRequirements(doc, cotizacion);

          // Totales
          this.addTotals(doc, cotizacion);

          // Footer con términos y condiciones
          this.addFooter(doc, cotizacion);

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
      .fontSize(22)
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
      .text('RUC: 1234567890001', { align: 'center' })
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
      .fontSize(18)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('COTIZACIÓN DE EXÁMENES', { align: 'center' })
      .moveDown(1.5);
  }

  /**
   * Agregar información de la cotización
   */
  private addCotizacionInfo(doc: any, cotizacion: any) {
    const startY = doc.y;

    // Información a la izquierda
    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica-Bold')
      .text('Nro. Cotización: ', 50, startY, { continued: true })
      .font('Helvetica')
      .text(cotizacion.numero_cotizacion);

    doc
      .font('Helvetica-Bold')
      .text('Fecha: ', 50, doc.y, { continued: true })
      .font('Helvetica')
      .text(new Date(cotizacion.fecha_cotizacion).toLocaleDateString('es-EC'));

    doc
      .font('Helvetica-Bold')
      .text('Válida hasta: ', 50, doc.y, { continued: true })
      .font('Helvetica')
      .fillColor('#DC2626')
      .text(new Date(cotizacion.fecha_expiracion).toLocaleDateString('es-EC'))
      .fillColor('#000000');

    // Estado a la derecha
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Estado: ', 350, startY, { continued: true })
      .fillColor(this.getEstadoColor(cotizacion.estado))
      .text(cotizacion.estado)
      .fillColor('#000000');

    doc.moveDown(1.5);
  }

  /**
   * Agregar información del paciente
   */
  private addPatientInfo(doc: any, paciente: any) {
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
      .text(`${paciente.nombres} ${paciente.apellidos}`);

    doc
      .font('Helvetica-Bold')
      .text('Cédula: ', { continued: true })
      .font('Helvetica')
      .text(paciente.cedula || 'N/A');

    doc
      .font('Helvetica-Bold')
      .text('Email: ', { continued: true })
      .font('Helvetica')
      .text(paciente.email || 'N/A');

    if (paciente.telefono) {
      doc
        .font('Helvetica-Bold')
        .text('Teléfono: ', { continued: true })
        .font('Helvetica')
        .text(paciente.telefono);
    }

    doc.moveDown(1.5);
  }

  /**
   * Agregar tabla de exámenes
   */
  private addExamTable(doc: any, cotizacion: any) {
    doc
      .fontSize(12)
      .fillColor('#2563EB')
      .font('Helvetica-Bold')
      .text('EXÁMENES SOLICITADOS', { underline: true })
      .moveDown(0.5);

    const tableTop = doc.y;
    const col1X = 50;
    const col2X = 320;
    const col3X = 400;
    const col4X = 460;
    const col5X = 520;

    // Encabezados
    doc
      .fontSize(9)
      .fillColor('#FFFFFF')
      .rect(col1X, tableTop, 512, 20)
      .fill('#2563EB');

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .text('EXAMEN', col1X + 5, tableTop + 6, { width: 260 })
      .text('CÓD.', col2X + 5, tableTop + 6, { width: 70 })
      .text('CANT.', col3X + 5, tableTop + 6, { width: 50 })
      .text('P.UNIT', col4X + 5, tableTop + 6, { width: 50 })
      .text('TOTAL', col5X + 5, tableTop + 6, { width: 40 });

    let currentY = tableTop + 25;

    // Filas de exámenes
    doc.fontSize(9).fillColor('#000000').font('Helvetica');

    cotizacion.detalles.forEach((detalle: any, index: number) => {
      // Fondo alternado
      if (index % 2 === 0) {
        doc.rect(col1X, currentY - 3, 512, 18).fill('#F9FAFB');
      }

      doc
        .fillColor('#000000')
        .text(detalle.examen.nombre, col1X + 5, currentY, { width: 260 })
        .text(detalle.examen.codigo_interno, col2X + 5, currentY, {
          width: 70,
        })
        .text(detalle.cantidad.toString(), col3X + 5, currentY, { width: 50 })
        .text(`$${Number(detalle.precio_unitario).toFixed(2)}`, col4X + 5, currentY, {
          width: 50,
        })
        .text(`$${Number(detalle.total_linea).toFixed(2)}`, col5X + 5, currentY, {
          width: 40,
        });

      currentY += 18;
    });

    doc.y = currentY + 10;
    doc.moveDown(1);
  }

  /**
   * Agregar requisitos y preparación
   */
  private addRequirements(doc: any, cotizacion: any) {
    // Filtrar exámenes que tienen requisitos
    const examenesConRequisitos = cotizacion.detalles.filter(
      (d: any) =>
        d.examen.requiere_ayuno || d.examen.instrucciones_preparacion,
    );

    if (examenesConRequisitos.length > 0) {
      doc
        .fontSize(12)
        .fillColor('#DC2626')
        .font('Helvetica-Bold')
        .text('⚠ REQUISITOS Y PREPARACIÓN', { underline: true })
        .moveDown(0.5);

      doc.fontSize(9).fillColor('#000000');

      examenesConRequisitos.forEach((detalle: any) => {
        doc.font('Helvetica-Bold').text(`• ${detalle.examen.nombre}:`, {
          continued: false,
        });

        if (detalle.examen.requiere_ayuno) {
          doc
            .font('Helvetica')
            .text(
              `  - Requiere ayuno de ${detalle.examen.horas_ayuno || 8} horas`,
              { indent: 20 },
            );
        }

        if (detalle.examen.instrucciones_preparacion) {
          doc
            .font('Helvetica')
            .text(`  - ${detalle.examen.instrucciones_preparacion}`, {
              indent: 20,
              align: 'justify',
            });
        }

        doc.moveDown(0.3);
      });

      doc.moveDown(1);
    }
  }

  /**
   * Agregar totales
   */
  private addTotals(doc: any, cotizacion: any) {
    const rightAlign = 450;
    const valueAlign = 520;

    // Línea separadora
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(1)
      .moveTo(350, doc.y)
      .lineTo(562, doc.y)
      .stroke();

    doc.moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor('#000000')
      .font('Helvetica')
      .text('SUBTOTAL:', rightAlign, doc.y, { width: 60 })
      .text(`$${Number(cotizacion.subtotal).toFixed(2)}`, valueAlign, doc.y - 12, {
        width: 40,
      });

    if (Number(cotizacion.descuento) > 0) {
      doc
        .text('DESCUENTO:', rightAlign, doc.y, { width: 60 })
        .fillColor('#DC2626')
        .text(`-$${Number(cotizacion.descuento).toFixed(2)}`, valueAlign, doc.y - 12, {
          width: 40,
        })
        .fillColor('#000000');
    }

    doc.moveDown(0.5);

    // Línea separadora
    doc
      .strokeColor('#2563EB')
      .lineWidth(2)
      .moveTo(350, doc.y)
      .lineTo(562, doc.y)
      .stroke();

    doc.moveDown(0.3);

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#2563EB')
      .text('TOTAL:', rightAlign, doc.y, { width: 60 })
      .text(`$${Number(cotizacion.total).toFixed(2)}`, valueAlign, doc.y - 16, {
        width: 40,
      });

    doc.moveDown(2);
  }

  /**
   * Agregar footer con términos y condiciones
   */
  private addFooter(doc: any, cotizacion: any) {
    const bottomY = 650;

    // Línea separadora
    doc
      .strokeColor('#CCCCCC')
      .lineWidth(1)
      .moveTo(50, bottomY)
      .lineTo(562, bottomY)
      .stroke();

    // Términos y condiciones
    doc
      .fontSize(8)
      .fillColor('#666666')
      .font('Helvetica-Bold')
      .text('TÉRMINOS Y CONDICIONES:', 50, bottomY + 10);

    doc
      .fontSize(7)
      .font('Helvetica')
      .text(
        `• Esta cotización tiene validez hasta el ${new Date(cotizacion.fecha_expiracion).toLocaleDateString('es-EC')}`,
        50,
        doc.y + 5,
      )
      .text('• Los precios incluyen IVA y pueden estar sujetos a cambios', 50, doc.y)
      .text(
        '• Los resultados estarán disponibles en el tiempo especificado para cada examen',
        50,
        doc.y,
      )
      .text(
        '• Es importante seguir las instrucciones de preparación para garantizar resultados precisos',
        50,
        doc.y,
      )
      .text(
        '• Para realizar los exámenes, debe presentar esta cotización y un documento de identificación',
        50,
        doc.y,
      );

    // Información de contacto
    doc
      .fontSize(8)
      .fillColor('#2563EB')
      .font('Helvetica-Bold')
      .text(
        `Cotización generada el ${new Date().toLocaleString('es-EC')}`,
        50,
        doc.y + 10,
        { align: 'center' },
      );

    doc
      .fontSize(7)
      .fillColor('#666666')
      .font('Helvetica')
      .text(
        'Para más información, contáctenos al (02) 1234-5678 o info@labfranz.com',
        50,
        doc.y + 5,
        { align: 'center' },
      );
  }

  /**
   * Obtener color según estado
   */
  private getEstadoColor(estado: string): string {
    const colors: { [key: string]: string } = {
      PENDIENTE: '#F59E0B',
      ACEPTADA: '#10B981',
      RECHAZADA: '#EF4444',
      PAGADA: '#2563EB',
      EXPIRADA: '#6B7280',
    };

    return colors[estado] || '#000000';
  }

  /**
   * Obtener la ruta del directorio de salida
   */
  getOutputDir(): string {
    return this.outputDir;
  }
}

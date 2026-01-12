import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import * as PDFDocument from 'pdfkit';
import { Response } from 'express';

@Injectable()
export class PdfInventarioService {
  private readonly logger = new Logger(PdfInventarioService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Genera PDF de una Orden de Compra
   */
  async generateOrdenCompraPdf(codigoOrden: number, res: Response): Promise<void> {
    const orden = await this.prisma.ordenCompra.findUnique({
      where: { codigo_orden_compra: codigoOrden },
      include: {
        proveedor: true,
        creador: {
          select: { nombres: true, apellidos: true },
        },
        detalles: {
          include: {
            item: {
              include: { categoria: true },
            },
          },
        },
      },
    });

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada');
    }

    // Crear documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Orden de Compra ${orden.numero_orden}`,
        Author: 'Sistema Laboratorio Franz',
      },
    });

    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=OC-${orden.numero_orden}.pdf`,
    );

    // Pipe al response
    doc.pipe(res);

    // === ENCABEZADO ===
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('ORDEN DE COMPRA', { align: 'center' });

    doc.moveDown();

    // Información de la orden
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`N° Orden: ${orden.numero_orden}`, { continued: true })
      .font('Helvetica')
      .text(`    Estado: ${this.getEstadoLabel(orden.estado)}`, { align: 'right' });

    doc
      .font('Helvetica')
      .text(`Fecha: ${this.formatDate(orden.fecha_orden)}`, { continued: true });

    if (orden.fecha_entrega_estimada) {
      doc.text(`    Entrega estimada: ${this.formatDate(orden.fecha_entrega_estimada)}`, { align: 'right' });
    } else {
      doc.text('');
    }

    doc.moveDown();

    // === DATOS DEL PROVEEDOR ===
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('DATOS DEL PROVEEDOR');

    doc.rect(50, doc.y, 495, 60).stroke();

    const provY = doc.y + 10;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('RUC:', 60, provY, { continued: true })
      .font('Helvetica')
      .text(` ${orden.proveedor.ruc}`);

    doc
      .font('Helvetica-Bold')
      .text('Razón Social:', { continued: true })
      .font('Helvetica')
      .text(` ${orden.proveedor.razon_social}`);

    if (orden.proveedor.telefono) {
      doc
        .font('Helvetica-Bold')
        .text('Teléfono:', { continued: true })
        .font('Helvetica')
        .text(` ${orden.proveedor.telefono}`, { continued: true });
    }

    if (orden.proveedor.email) {
      doc
        .font('Helvetica-Bold')
        .text('    Email:', { continued: true })
        .font('Helvetica')
        .text(` ${orden.proveedor.email}`);
    } else {
      doc.text('');
    }

    doc.y = provY + 65;
    doc.moveDown();

    // === DETALLE DE ÍTEMS ===
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('DETALLE DE ÍTEMS');

    // Headers de tabla
    const tableTop = doc.y + 5;
    const tableHeaders = ['#', 'Código', 'Descripción', 'Cantidad', 'P. Unit.', 'Total'];
    const colWidths = [30, 60, 195, 60, 70, 80];
    let xPos = 50;

    // Dibujar headers
    doc.rect(50, tableTop, 495, 20).fill('#f0f0f0');
    doc.fillColor('#000000');

    doc.fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, xPos + 5, tableTop + 5, {
        width: colWidths[i] - 10,
        align: i >= 3 ? 'right' : 'left',
      });
      xPos += colWidths[i];
    });

    // Filas de datos
    let rowY = tableTop + 20;
    doc.font('Helvetica').fontSize(9);

    orden.detalles.forEach((detalle, index) => {
      xPos = 50;
      const rowHeight = 20;

      // Alternar color de fondo
      if (index % 2 === 1) {
        doc.rect(50, rowY, 495, rowHeight).fill('#fafafa');
        doc.fillColor('#000000');
      }

      // Contenido de la fila
      const precioUnit = detalle.precio_unitario ? Number(detalle.precio_unitario) : 0;
      const totalLinea = detalle.total_linea ? Number(detalle.total_linea) : 0;
      const cantidad = detalle.cantidad ? Number(detalle.cantidad) : 0;
      const rowData = [
        (index + 1).toString(),
        detalle.item?.codigo_interno || '-',
        detalle.item?.nombre || '-',
        cantidad.toString(),
        `$${precioUnit.toFixed(2)}`,
        `$${totalLinea.toFixed(2)}`,
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos + 5, rowY + 5, {
          width: colWidths[i] - 10,
          align: i >= 3 ? 'right' : 'left',
        });
        xPos += colWidths[i];
      });

      rowY += rowHeight;
    });

    // Borde de la tabla
    doc.rect(50, tableTop, 495, rowY - tableTop).stroke();

    // Líneas verticales
    xPos = 50;
    colWidths.forEach((width) => {
      doc.moveTo(xPos, tableTop).lineTo(xPos, rowY).stroke();
      xPos += width;
    });
    doc.moveTo(545, tableTop).lineTo(545, rowY).stroke();

    // Línea horizontal del header
    doc.moveTo(50, tableTop + 20).lineTo(545, tableTop + 20).stroke();

    doc.y = rowY + 20;

    // === TOTALES ===
    const totalsLabelX = 380;
    const totalsValueX = 480;
    const subtotalNum = orden.subtotal ? Number(orden.subtotal) : 0;
    const ivaNum = orden.iva ? Number(orden.iva) : 0;
    const totalNum = orden.total ? Number(orden.total) : 0;

    let totalsY = doc.y;

    doc.fontSize(10).font('Helvetica');
    doc.text('Subtotal:', totalsLabelX, totalsY, { width: 80, align: 'right' });
    doc.text(`$${subtotalNum.toFixed(2)}`, totalsValueX, totalsY, { width: 65, align: 'right' });

    totalsY += 15;
    doc.text('IVA (0%):', totalsLabelX, totalsY, { width: 80, align: 'right' });
    doc.text(`$${ivaNum.toFixed(2)}`, totalsValueX, totalsY, { width: 65, align: 'right' });

    totalsY += 15;
    doc.font('Helvetica-Bold');
    doc.text('TOTAL:', totalsLabelX, totalsY, { width: 80, align: 'right' });
    doc.text(`$${totalNum.toFixed(2)}`, totalsValueX, totalsY, { width: 65, align: 'right' });

    doc.y = totalsY + 20;

    doc.moveDown(2);

    // === OBSERVACIONES ===
    if (orden.observaciones) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('OBSERVACIONES:');

      doc
        .font('Helvetica')
        .text(orden.observaciones, { width: 495 });
    }

    // === PIE DE PÁGINA ===
    doc.moveDown(3);
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        `Documento generado el ${this.formatDateTime(new Date())} por Sistema Laboratorio Franz`,
        { align: 'center' },
      );

    if (orden.creador) {
      doc.text(
        `Creado por: ${orden.creador.nombres} ${orden.creador.apellidos}`,
        { align: 'center' },
      );
    }

    // Finalizar documento
    doc.end();
  }

  /**
   * Genera PDF del reporte Kardex
   */
  async generateKardexPdf(
    data: any,
    res: Response,
    titulo: string = 'Reporte Kardex de Inventario',
  ): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      info: {
        Title: titulo,
        Author: 'Sistema Laboratorio Franz',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=kardex-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // === ENCABEZADO ===
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

    doc
      .fontSize(14)
      .text(titulo.toUpperCase(), { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, { align: 'center' });

    doc.moveDown();

    // === RESUMEN ===
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('RESUMEN GENERAL');

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total ítems: ${data.resumen.total_items}`, { continued: true })
      .text(`    Total entradas: ${data.resumen.total_entradas}`, { continued: true })
      .text(`    Total salidas: ${data.resumen.total_salidas}`, { continued: true })
      .text(`    Valor inventario: $${data.resumen.valor_total_inventario.toFixed(2)}`);

    doc.moveDown();

    // === TABLA DE ÍTEMS ===
    const tableTop = doc.y;
    const headers = [
      'Código',
      'Nombre',
      'Categoría',
      'U.M.',
      'Saldo Ini.',
      'Entradas',
      'Salidas',
      'Saldo Fin.',
      'Costo U.',
      'Valor Inv.',
    ];
    const colWidths = [55, 130, 80, 40, 55, 55, 55, 55, 55, 65];
    let xPos = 40;

    // Header
    doc.rect(40, tableTop, 712, 18).fill('#e0e0e0');
    doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');

    headers.forEach((header, i) => {
      doc.text(header, xPos + 2, tableTop + 4, {
        width: colWidths[i] - 4,
        align: i >= 4 ? 'right' : 'left',
      });
      xPos += colWidths[i];
    });

    // Filas
    let rowY = tableTop + 18;
    doc.font('Helvetica').fontSize(8);

    const maxItemsPerPage = 25;
    let itemCount = 0;

    for (const item of data.items) {
      if (itemCount > 0 && itemCount % maxItemsPerPage === 0) {
        doc.addPage();
        rowY = 40;
      }

      xPos = 40;
      if (itemCount % 2 === 1) {
        doc.rect(40, rowY, 712, 16).fill('#f8f8f8');
        doc.fillColor('#000000');
      }

      const rowData = [
        item.codigo_interno,
        item.nombre.substring(0, 30),
        item.categoria.substring(0, 18),
        item.unidad_medida,
        item.saldo_inicial.toString(),
        item.total_entradas.toString(),
        item.total_salidas.toString(),
        item.saldo_final.toString(),
        `$${item.costo_unitario.toFixed(2)}`,
        `$${item.valor_inventario.toFixed(2)}`,
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos + 2, rowY + 3, {
          width: colWidths[i] - 4,
          align: i >= 4 ? 'right' : 'left',
        });
        xPos += colWidths[i];
      });

      rowY += 16;
      itemCount++;
    }

    // Pie de página
    doc
      .fontSize(7)
      .fillColor('#666666')
      .text(
        `Generado: ${this.formatDateTime(new Date())} | Sistema Laboratorio Franz`,
        40,
        doc.page.height - 30,
      );

    doc.end();
  }

  /**
   * Genera PDF del reporte de compras por proveedor
   */
  async generateComprasProveedorPdf(data: any, res: Response): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Reporte de Compras por Proveedor',
        Author: 'Sistema Laboratorio Franz',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=compras-proveedor-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // Encabezado
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

    doc
      .fontSize(14)
      .text('REPORTE DE COMPRAS POR PROVEEDOR', { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, { align: 'center' });

    doc.moveDown();

    // Resumen
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('RESUMEN');

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total proveedores: ${data.resumen.total_proveedores}`)
      .text(`Total órdenes: ${data.resumen.total_ordenes}`)
      .text(`Monto total: $${data.resumen.monto_total.toFixed(2)}`);

    doc.moveDown();

    // Detalle por proveedor
    for (const prov of data.proveedores) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text(`${prov.razon_social} (RUC: ${prov.ruc})`);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#000000')
        .text(`Órdenes: ${prov.total_ordenes} | Recibidas: ${prov.ordenes_recibidas} | Pendientes: ${prov.ordenes_pendientes}`)
        .text(`Monto total: $${prov.monto_total.toFixed(2)}`);

      // Items comprados
      if (prov.items_comprados.length > 0) {
        doc.fontSize(8).text('  Ítems comprados:');
        prov.items_comprados.slice(0, 5).forEach((item: any) => {
          doc.text(`    - ${item.nombre}: ${item.cantidad_total} unid. ($${item.monto_total.toFixed(2)})`);
        });
        if (prov.items_comprados.length > 5) {
          doc.text(`    ... y ${prov.items_comprados.length - 5} más`);
        }
      }

      doc.moveDown(0.5);
    }

    // Pie
    doc
      .fontSize(7)
      .fillColor('#666666')
      .text(
        `Generado: ${this.formatDateTime(new Date())} | Sistema Laboratorio Franz`,
        50,
        doc.page.height - 30,
      );

    doc.end();
  }

  /**
   * Genera PDF del reporte de consumo por servicio
   */
  async generateConsumoPdf(data: any, res: Response): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: 'Reporte de Consumo por Servicio',
        Author: 'Sistema Laboratorio Franz',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=consumo-servicio-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // Encabezado
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

    doc
      .fontSize(14)
      .text('REPORTE DE CONSUMO POR SERVICIO/EXAMEN', { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, { align: 'center' });

    doc.moveDown();

    // Resumen
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('RESUMEN');

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total exámenes realizados: ${data.resumen.total_examenes_realizados}`)
      .text(`Total ítems consumidos: ${data.resumen.total_items_consumidos}`)
      .text(`Cantidad total consumida: ${data.resumen.cantidad_total_consumida}`)
      .text(`Costo total: $${data.resumen.costo_total.toFixed(2)}`);

    doc.moveDown();

    // Tabla de consumo
    const tableTop = doc.y;
    const headers = ['Código', 'Ítem', 'Categoría', 'Cantidad', 'Costo U.', 'Total'];
    const colWidths = [60, 160, 90, 60, 60, 65];
    let xPos = 50;

    // Header
    doc.rect(50, tableTop, 495, 18).fill('#e0e0e0');
    doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');

    headers.forEach((header, i) => {
      doc.text(header, xPos + 3, tableTop + 4, {
        width: colWidths[i] - 6,
        align: i >= 3 ? 'right' : 'left',
      });
      xPos += colWidths[i];
    });

    // Filas
    let rowY = tableTop + 18;
    doc.font('Helvetica').fontSize(8);

    data.items.forEach((item: any, index: number) => {
      if (rowY > doc.page.height - 80) {
        doc.addPage();
        rowY = 50;
      }

      xPos = 50;
      if (index % 2 === 1) {
        doc.rect(50, rowY, 495, 16).fill('#f8f8f8');
        doc.fillColor('#000000');
      }

      const rowData = [
        item.codigo_interno,
        item.nombre.substring(0, 35),
        item.categoria.substring(0, 18),
        item.cantidad_consumida.toFixed(2),
        `$${item.costo_unitario.toFixed(2)}`,
        `$${item.costo_total.toFixed(2)}`,
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos + 3, rowY + 3, {
          width: colWidths[i] - 6,
          align: i >= 3 ? 'right' : 'left',
        });
        xPos += colWidths[i];
      });

      rowY += 16;
    });

    // Pie
    doc
      .fontSize(7)
      .fillColor('#666666')
      .text(
        `Generado: ${this.formatDateTime(new Date())} | Sistema Laboratorio Franz`,
        50,
        doc.page.height - 30,
      );

    doc.end();
  }

  /**
   * Genera PDF del Kardex Global de Inventario
   */
  async generateKardexGlobalPdf(data: any, res: Response): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      info: {
        Title: 'Kardex Global de Inventario',
        Author: 'Sistema Laboratorio Franz',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=kardex-global-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // === ENCABEZADO ===
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

    doc
      .fontSize(14)
      .text('KARDEX GLOBAL DE INVENTARIO', { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generado: ${this.formatDateTime(new Date())}`, { align: 'center' });

    doc.moveDown();

    // === RESUMEN ===
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('RESUMEN GENERAL');

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Total ítems: ${data.resumen.total_items}`, { continued: true })
      .text(`    Entradas: ${data.resumen.total_entradas}`, { continued: true })
      .text(`    Salidas: ${data.resumen.total_salidas}`, { continued: true })
      .text(`    Valor total: $${data.resumen.valor_total_inventario.toFixed(2)}`);

    doc
      .text(`Ítems agotados: ${data.resumen.items_agotados}`, { continued: true })
      .text(`    Ítems críticos: ${data.resumen.items_criticos}`, { continued: true })
      .text(`    Ítems bajos: ${data.resumen.items_bajos}`);

    doc.moveDown();

    // === TABLA DE ÍTEMS ===
    const tableTop = doc.y;
    const headers = [
      'Código',
      'Nombre',
      'Categoría',
      'U.M.',
      'Stock',
      'Mín.',
      'Entradas',
      'Salidas',
      'Costo U.',
      'Valor Inv.',
      'Estado',
    ];
    const colWidths = [55, 120, 75, 40, 45, 40, 50, 50, 55, 60, 55];
    let xPos = 40;

    // Header de tabla
    doc.rect(40, tableTop, 745, 18).fill('#1e3a5f');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');

    headers.forEach((header, i) => {
      doc.text(header, xPos + 2, tableTop + 4, {
        width: colWidths[i] - 4,
        align: i >= 4 ? 'right' : 'left',
      });
      xPos += colWidths[i];
    });

    // Filas de datos
    let rowY = tableTop + 18;
    doc.font('Helvetica').fontSize(7);
    let itemCount = 0;

    for (const item of data.items) {
      if (rowY > doc.page.height - 60) {
        doc.addPage();
        rowY = 40;
        itemCount = 0;

        // Repetir header en nueva página
        xPos = 40;
        doc.rect(40, rowY, 745, 18).fill('#1e3a5f');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, xPos + 2, rowY + 4, {
            width: colWidths[i] - 4,
            align: i >= 4 ? 'right' : 'left',
          });
          xPos += colWidths[i];
        });
        rowY += 18;
        doc.font('Helvetica').fontSize(7);
      }

      xPos = 40;

      // Color de fondo según estado
      let bgColor = '#ffffff';
      if (item.estado_stock === 'AGOTADO') {
        bgColor = '#fee2e2'; // Rojo claro
      } else if (item.estado_stock === 'CRITICO') {
        bgColor = '#fef3c7'; // Amarillo claro
      } else if (item.estado_stock === 'BAJO') {
        bgColor = '#fef9c3'; // Amarillo muy claro
      } else if (itemCount % 2 === 1) {
        bgColor = '#f8fafc';
      }

      doc.rect(40, rowY, 745, 16).fill(bgColor);
      doc.fillColor('#000000');

      const estadoLabel = {
        NORMAL: 'Normal',
        BAJO: 'Bajo',
        CRITICO: 'Crítico',
        AGOTADO: 'Agotado',
      }[item.estado_stock] || item.estado_stock;

      const rowData = [
        item.codigo_interno || '-',
        item.nombre.substring(0, 25),
        (item.categoria || 'Sin cat.').substring(0, 15),
        item.unidad_medida || '-',
        item.stock_actual.toString(),
        item.stock_minimo.toString(),
        item.total_entradas.toString(),
        item.total_salidas.toString(),
        `$${item.costo_unitario.toFixed(2)}`,
        `$${item.valor_inventario.toFixed(2)}`,
        estadoLabel,
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos + 2, rowY + 3, {
          width: colWidths[i] - 4,
          align: i >= 4 ? 'right' : 'left',
        });
        xPos += colWidths[i];
      });

      rowY += 16;
      itemCount++;
    }

    // Pie de página
    doc
      .fontSize(7)
      .fillColor('#666666')
      .text(
        `Generado: ${this.formatDateTime(new Date())} | Sistema Laboratorio Franz | Total: ${data.items.length} ítems`,
        40,
        doc.page.height - 30,
      );

    doc.end();
  }

  /**
   * Genera PDF de Pedido de Reposición (formato para imprimir y llenar a mano)
   */
  async generatePedidoReposicionPdf(data: any, res: Response): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: 'Pedido de Reposición de Inventario',
        Author: 'Sistema Laboratorio Franz',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=pedido-reposicion-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // === ENCABEZADO ===
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('LABORATORIO CLÍNICO FRANZ', { align: 'center' });

    doc
      .fontSize(14)
      .text('PEDIDO DE REPOSICIÓN DE INVENTARIO', { align: 'center' });

    doc.moveDown(0.5);

    // === CAMPOS PARA LLENAR A MANO ===
    const fieldY = doc.y + 10;
    const leftCol = 50;
    const rightCol = 320;
    const lineWidth = 200;

    doc.fontSize(10).font('Helvetica');

    // Fila 1
    doc.text('Fecha:', leftCol, fieldY);
    doc.moveTo(leftCol + 40, fieldY + 12).lineTo(leftCol + 40 + lineWidth, fieldY + 12).stroke();

    doc.text('N° Pedido:', rightCol, fieldY);
    doc.moveTo(rightCol + 60, fieldY + 12).lineTo(rightCol + 60 + 120, fieldY + 12).stroke();

    // Fila 2
    const row2Y = fieldY + 35;
    doc.text('Proveedor:', leftCol, row2Y);
    doc.moveTo(leftCol + 60, row2Y + 12).lineTo(550, row2Y + 12).stroke();

    // Fila 3
    const row3Y = row2Y + 35;
    doc.text('Solicitado por:', leftCol, row3Y);
    doc.moveTo(leftCol + 80, row3Y + 12).lineTo(leftCol + 80 + lineWidth, row3Y + 12).stroke();

    doc.text('Cargo:', rightCol, row3Y);
    doc.moveTo(rightCol + 40, row3Y + 12).lineTo(rightCol + 40 + 140, row3Y + 12).stroke();

    doc.moveDown(4);

    // === RESUMEN DE ESTADO ===
    const summaryY = doc.y;
    doc.fontSize(9).font('Helvetica');

    const agotados = data.items.filter((i: any) => i.estado_stock === 'AGOTADO').length;
    const criticos = data.items.filter((i: any) => i.estado_stock === 'CRITICO').length;
    const bajos = data.items.filter((i: any) => i.estado_stock === 'BAJO').length;

    doc.rect(50, summaryY, 150, 40).stroke();
    doc.text(`Agotados: ${agotados}`, 60, summaryY + 8);
    doc.text(`Críticos: ${criticos}`, 60, summaryY + 20);
    doc.text(`Stock Bajo: ${bajos}`, 60, summaryY + 32);

    doc.rect(210, summaryY, 150, 40).stroke();
    doc.text(`Total Items: ${data.items.length}`, 220, summaryY + 14);
    doc.text(`Valor Est.: $${data.resumen?.valor_total_inventario?.toFixed(2) || '0.00'}`, 220, summaryY + 26);

    doc.moveDown(3);

    // === TABLA DE ITEMS ===
    const tableTop = doc.y + 10;
    const headers = ['#', 'Código', 'Descripción del Item', 'U.M.', 'Stock', 'Mín.', 'Cant. Pedir', 'Costo U.'];
    const colWidths = [25, 55, 180, 40, 45, 40, 65, 55];
    let xPos = 40;

    // Header de tabla
    doc.rect(40, tableTop, 515, 20).fill('#2c3e50');
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');

    headers.forEach((header, i) => {
      doc.text(header, xPos + 3, tableTop + 5, {
        width: colWidths[i] - 6,
        align: i >= 4 ? 'center' : 'left',
      });
      xPos += colWidths[i];
    });

    // Filas de datos
    let rowY = tableTop + 20;
    doc.font('Helvetica').fontSize(8);
    let itemNum = 1;

    for (const item of data.items) {
      if (rowY > doc.page.height - 120) {
        doc.addPage();
        rowY = 50;

        // Repetir header en nueva página
        xPos = 40;
        doc.rect(40, rowY, 515, 20).fill('#2c3e50');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, xPos + 3, rowY + 5, {
            width: colWidths[i] - 6,
            align: i >= 4 ? 'center' : 'left',
          });
          xPos += colWidths[i];
        });
        rowY += 20;
        doc.font('Helvetica').fontSize(8);
      }

      xPos = 40;

      // Fondo alternado y color según estado
      let bgColor = itemNum % 2 === 0 ? '#f8f9fa' : '#ffffff';
      if (item.estado_stock === 'AGOTADO') bgColor = '#ffebee';
      else if (item.estado_stock === 'CRITICO') bgColor = '#fff3e0';
      else if (item.estado_stock === 'BAJO') bgColor = '#fffde7';

      doc.rect(40, rowY, 515, 22).fill(bgColor);
      doc.fillColor('#000000');

      // Calcular cantidad sugerida
      const cantSugerida = Math.max(item.stock_minimo - item.stock_actual + 10, 1);

      const rowData = [
        itemNum.toString(),
        item.codigo_interno || '-',
        item.nombre.substring(0, 40),
        item.unidad_medida || '-',
        item.stock_actual.toString(),
        item.stock_minimo.toString(),
        cantSugerida.toString(),
        `$${(item.costo_unitario || 0).toFixed(2)}`,
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos + 3, rowY + 6, {
          width: colWidths[i] - 6,
          align: i >= 4 ? 'center' : 'left',
        });
        xPos += colWidths[i];
      });

      // Dibujar líneas verticales y caja para escribir cantidad real
      doc.rect(40, rowY, 515, 22).stroke('#dee2e6');

      rowY += 22;
      itemNum++;
    }

    // === SECCIÓN DE FIRMAS ===
    doc.moveDown(2);
    const signaturesY = Math.min(rowY + 40, doc.page.height - 100);

    doc.fontSize(9).font('Helvetica');

    // Firma solicitante
    doc.text('Solicitado por:', 50, signaturesY);
    doc.moveTo(50, signaturesY + 40).lineTo(200, signaturesY + 40).stroke();
    doc.text('Firma y Sello', 100, signaturesY + 45);

    // Firma aprobación
    doc.text('Aprobado por:', 230, signaturesY);
    doc.moveTo(230, signaturesY + 40).lineTo(380, signaturesY + 40).stroke();
    doc.text('Firma y Sello', 280, signaturesY + 45);

    // Firma recepción
    doc.text('Recibido por:', 410, signaturesY);
    doc.moveTo(410, signaturesY + 40).lineTo(555, signaturesY + 40).stroke();
    doc.text('Firma y Sello', 460, signaturesY + 45);

    // === NOTAS ===
    const notasY = signaturesY + 70;
    doc.fontSize(8).font('Helvetica');
    doc.text('Observaciones:', 50, notasY);
    doc.rect(50, notasY + 12, 505, 40).stroke();

    // === PIE DE PÁGINA ===
    doc
      .fontSize(7)
      .fillColor('#666666')
      .text(
        `Generado: ${this.formatDateTime(new Date())} | Sistema Laboratorio Franz | Este documento requiere firmas para ser válido`,
        40,
        doc.page.height - 25,
        { align: 'center' }
      );

    doc.end();
  }

  // === UTILIDADES ===

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getEstadoLabel(estado: string): string {
    const estados: Record<string, string> = {
      BORRADOR: 'Borrador',
      EMITIDA: 'Emitida',
      RECIBIDA: 'Recibida',
      CANCELADA: 'Cancelada',
    };
    return estados[estado] || estado;
  }
}

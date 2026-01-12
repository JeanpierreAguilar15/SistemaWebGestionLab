import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface FacturaOCRResult {
  success: boolean;
  proveedor?: {
    ruc?: string;
    razon_social?: string;
    direccion?: string;
    telefono?: string;
  };
  factura?: {
    numero?: string;
    fecha?: string;
    subtotal?: number;
    iva?: number;
    total?: number;
  };
  items: Array<{
    descripcion: string;
    cantidad: number;
    unidad?: string;
    precio_unitario?: number;
    total?: number;
    numero_lote?: string;
    fecha_vencimiento?: string;
  }>;
  raw_text?: string;
  error?: string;
}

@Injectable()
export class OcrFacturaService {
  private readonly logger = new Logger(OcrFacturaService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  // Lista de modelos a intentar en orden de preferencia (según docs oficiales)
  private readonly models = [
    'gemini-2.5-flash',      // Modelo recomendado actual
    'gemini-2.5-flash-lite', // Versión lite más rápida
    'gemini-2.0-flash',      // Generación anterior estable
  ];
  private readonly maxRetries = 2;
  private readonly retryDelayMs = 5000; // 5 segundos entre reintentos para evitar rate limit

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY no está configurada. El OCR de facturas no funcionará.');
    }
  }

  /**
   * Hace la llamada a Gemini API con reintentos y fallback de modelos
   */
  private async callGeminiWithRetry(body: object): Promise<any> {
    let lastError: Error | null = null;

    for (const model of this.models) {
      const apiUrl = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          this.logger.log(`Intentando con modelo ${model} (intento ${attempt}/${this.maxRetries})`);

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (response.ok) {
            this.logger.log(`Éxito con modelo ${model}`);
            return await response.json();
          }

          const errorData = await response.text();

          // Si es 503 (sobrecargado) o 429 (rate limit), reintentar
          if (response.status === 503 || response.status === 429) {
            this.logger.warn(`Modelo ${model} sobrecargado (${response.status}), reintentando en ${this.retryDelayMs * attempt}ms...`);
            await this.delay(this.retryDelayMs * attempt);
            continue;
          }

          // Si es 404 (modelo no existe), probar siguiente modelo
          if (response.status === 404) {
            this.logger.warn(`Modelo ${model} no disponible, probando siguiente...`);
            break;
          }

          // Otro error, lanzar
          this.logger.error(`Error de Gemini API: ${response.status} - ${errorData}`);
          throw new Error(`Error de API: ${response.status}`);

        } catch (error) {
          lastError = error;
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelayMs * attempt);
          }
        }
      }
    }

    // Si todos fallaron con rate limit, dar mensaje específico
    if (lastError?.message?.includes('429')) {
      throw new Error('Límite de solicitudes excedido. Espera 1-2 minutos e intenta de nuevo.');
    }
    throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Procesa una imagen de factura y extrae la información usando Gemini Vision
   */
  async processFacturaImage(imagePath: string): Promise<FacturaOCRResult> {
    if (!this.apiKey) {
      throw new BadRequestException('API Key de Gemini no configurada');
    }

    try {
      // Leer la imagen y convertirla a base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Determinar el tipo MIME
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = this.getMimeType(ext);

      // Prompt especializado para extraer datos de facturas de laboratorio/médicas
      const prompt = `Analiza esta imagen de factura de proveedor médico/laboratorio y extrae la información en formato JSON.

IMPORTANTE: Responde SOLO con el JSON, sin markdown, sin \`\`\`, solo el objeto JSON.

Estructura requerida:
{
  "proveedor": {
    "ruc": "número de RUC/NIT del proveedor",
    "razon_social": "nombre del proveedor",
    "direccion": "dirección si está visible",
    "telefono": "teléfono si está visible"
  },
  "factura": {
    "numero": "número de factura",
    "fecha": "fecha en formato YYYY-MM-DD",
    "subtotal": número,
    "iva": número,
    "total": número
  },
  "items": [
    {
      "descripcion": "nombre del producto/reactivo/insumo",
      "cantidad": número,
      "unidad": "unidad de medida (Unidad, ml, mg, Caja, etc.)",
      "precio_unitario": número,
      "total": número,
      "numero_lote": "número de lote si está visible",
      "fecha_vencimiento": "fecha en formato YYYY-MM-DD si está visible"
    }
  ]
}

Si algún campo no está visible o no puedes determinarlo, usa null.
Los números deben ser numéricos, no strings.
Extrae TODOS los items/productos que aparezcan en la factura.`;

      // Llamar a la API de Gemini con reintentos
      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      };

      const data = await this.callGeminiWithRetry(requestBody);

      // Extraer el texto de la respuesta
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new BadRequestException('No se pudo obtener respuesta de Gemini');
      }

      // Parsear el JSON de la respuesta
      const parsedData = this.parseGeminiResponse(responseText);

      return {
        success: true,
        proveedor: parsedData.proveedor,
        factura: parsedData.factura,
        items: parsedData.items || [],
        raw_text: responseText,
      };

    } catch (error) {
      this.logger.error(`Error procesando factura: ${error.message}`);
      return {
        success: false,
        items: [],
        error: error.message,
      };
    }
  }

  /**
   * Procesa una imagen en base64 directamente
   */
  async processFacturaBase64(base64Data: string, mimeType: string): Promise<FacturaOCRResult> {
    if (!this.apiKey) {
      throw new BadRequestException('API Key de Gemini no configurada');
    }

    try {
      // Remover el prefijo data:image/xxx;base64, si existe
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

      const prompt = `Analiza esta imagen de factura de proveedor médico/laboratorio y extrae la información en formato JSON.

IMPORTANTE: Responde SOLO con el JSON, sin markdown, sin \`\`\`, solo el objeto JSON.

Estructura requerida:
{
  "proveedor": {
    "ruc": "número de RUC/NIT del proveedor",
    "razon_social": "nombre del proveedor",
    "direccion": "dirección si está visible",
    "telefono": "teléfono si está visible"
  },
  "factura": {
    "numero": "número de factura",
    "fecha": "fecha en formato YYYY-MM-DD",
    "subtotal": número,
    "iva": número,
    "total": número
  },
  "items": [
    {
      "descripcion": "nombre del producto/reactivo/insumo",
      "cantidad": número,
      "unidad": "unidad de medida (Unidad, ml, mg, Caja, etc.)",
      "precio_unitario": número,
      "total": número,
      "numero_lote": "número de lote si está visible",
      "fecha_vencimiento": "fecha en formato YYYY-MM-DD si está visible"
    }
  ]
}

Si algún campo no está visible o no puedes determinarlo, usa null.
Los números deben ser numéricos, no strings.
Extrae TODOS los items/productos que aparezcan en la factura.`;

      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      };

      const data = await this.callGeminiWithRetry(requestBody);
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new BadRequestException('No se pudo obtener respuesta de Gemini');
      }

      const parsedData = this.parseGeminiResponse(responseText);

      return {
        success: true,
        proveedor: parsedData.proveedor,
        factura: parsedData.factura,
        items: parsedData.items || [],
        raw_text: responseText,
      };

    } catch (error) {
      this.logger.error(`Error procesando factura: ${error.message}`);
      return {
        success: false,
        items: [],
        error: error.message,
      };
    }
  }

  /**
   * Parsea la respuesta de Gemini y extrae el JSON
   */
  private parseGeminiResponse(responseText: string): Partial<FacturaOCRResult> {
    try {
      // Intentar limpiar el texto si tiene markdown
      let cleanText = responseText.trim();

      // Remover bloques de código markdown si existen
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanText);

      return {
        proveedor: parsed.proveedor || undefined,
        factura: parsed.factura || undefined,
        items: Array.isArray(parsed.items) ? parsed.items : [],
      };
    } catch (error) {
      this.logger.warn(`Error parseando respuesta JSON: ${error.message}`);
      // Si no se puede parsear como JSON, retornar estructura vacía
      return {
        items: [],
      };
    }
  }

  /**
   * Obtiene el tipo MIME basado en la extensión del archivo
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Verifica si el servicio está configurado correctamente
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

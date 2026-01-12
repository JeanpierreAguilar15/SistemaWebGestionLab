import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Servicio de Interpretación de Resultados de Laboratorio con Gemini 2.5
 *
 * Permite a los pacientes subir PDFs de sus resultados y recibir
 * una explicación en lenguaje sencillo de los valores.
 */

export interface LabResultInterpretation {
  success: boolean;
  paciente?: {
    nombre?: string;
    cedula?: string;
    fecha_nacimiento?: string;
    edad?: string;
  };
  fecha_examen?: string;
  laboratorio?: string;
  resultados: Array<{
    examen: string;
    valor: string | number;
    unidad?: string;
    valor_referencia?: string;
    estado: 'NORMAL' | 'ALTO' | 'BAJO' | 'CRITICO' | 'INDETERMINADO';
    interpretacion: string;
  }>;
  resumen_general: string;
  recomendaciones: string[];
  advertencias: string[];
  raw_response?: string;
  error?: string;
}

@Injectable()
export class LabResultsInterpreterService {
  private readonly logger = new Logger(LabResultsInterpreterService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  // Modelos en orden de preferencia (más modelos para fallback cuando se agotan cuotas)
  private readonly models = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
  ];

  private readonly maxRetries = 2;
  private readonly retryDelayMs = 5000;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY no está configurada. La interpretación de resultados no funcionará.');
    }
  }

  /**
   * Llama a Gemini API con reintentos y fallback de modelos
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

          if (response.status === 503 || response.status === 429) {
            this.logger.warn(`Modelo ${model} sobrecargado (${response.status}), reintentando...`);
            await this.delay(this.retryDelayMs * attempt);
            continue;
          }

          if (response.status === 404) {
            this.logger.warn(`Modelo ${model} no disponible, probando siguiente...`);
            break;
          }

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

    throw lastError || new Error('No se pudo conectar con ningún modelo de Gemini');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Interpreta un PDF de resultados de laboratorio
   */
  async interpretLabResults(base64Data: string, mimeType: string = 'application/pdf'): Promise<LabResultInterpretation> {
    if (!this.apiKey) {
      throw new BadRequestException('API Key de Gemini no configurada');
    }

    try {
      // Limpiar el base64 si tiene prefijo
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

      const prompt = `Eres un asistente médico especializado en interpretar resultados de laboratorio clínico.
Analiza este documento de resultados de laboratorio y proporciona una interpretación clara y educativa.

IMPORTANTE:
- Responde SOLO con JSON válido, sin markdown, sin \`\`\`
- Usa lenguaje sencillo que un paciente pueda entender
- NO des diagnósticos definitivos, solo interpretaciones educativas
- Siempre recomienda consultar con un médico

Estructura JSON requerida:
{
  "paciente": {
    "nombre": "nombre si está visible o null",
    "cedula": "cédula/identificación si está visible o null",
    "fecha_nacimiento": "fecha si está visible o null",
    "edad": "edad si está visible o null"
  },
  "fecha_examen": "fecha del examen en formato YYYY-MM-DD o null",
  "laboratorio": "nombre del laboratorio si está visible o null",
  "resultados": [
    {
      "examen": "nombre del examen/parámetro",
      "valor": "valor obtenido (número o texto)",
      "unidad": "unidad de medida",
      "valor_referencia": "rango de referencia normal",
      "estado": "NORMAL|ALTO|BAJO|CRITICO|INDETERMINADO",
      "interpretacion": "explicación breve en lenguaje sencillo de qué significa este valor"
    }
  ],
  "resumen_general": "Un párrafo resumiendo los hallazgos principales en lenguaje sencillo. Menciona qué valores están bien y cuáles requieren atención.",
  "recomendaciones": [
    "Lista de recomendaciones generales basadas en los resultados"
  ],
  "advertencias": [
    "Lista de advertencias importantes si hay valores críticos o fuera de rango significativo"
  ]
}

REGLAS PARA ESTADO:
- NORMAL: valor dentro del rango de referencia
- ALTO: valor por encima del rango normal
- BAJO: valor por debajo del rango normal
- CRITICO: valor muy por encima o por debajo, requiere atención urgente
- INDETERMINADO: no se puede determinar (ej: resultado cualitativo)

IMPORTANTE EN EL RESUMEN:
- Siempre incluye: "Esta interpretación es educativa y no reemplaza la consulta con su médico."
- Si hay valores críticos, enfatiza la importancia de consultar pronto.`;

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
          temperature: 0.2, // Bajo para respuestas más consistentes
          maxOutputTokens: 8192, // PDFs pueden tener muchos resultados
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
        paciente: parsedData.paciente,
        fecha_examen: parsedData.fecha_examen,
        laboratorio: parsedData.laboratorio,
        resultados: parsedData.resultados || [],
        resumen_general: parsedData.resumen_general || 'No se pudo generar un resumen.',
        recomendaciones: parsedData.recomendaciones || [],
        advertencias: parsedData.advertencias || [],
        raw_response: responseText,
      };

    } catch (error) {
      this.logger.error(`Error interpretando resultados: ${error.message}`);
      return {
        success: false,
        resultados: [],
        resumen_general: '',
        recomendaciones: [],
        advertencias: [],
        error: error.message,
      };
    }
  }

  /**
   * Genera una respuesta conversacional para el chatbot
   */
  async generateChatResponse(interpretation: LabResultInterpretation): Promise<string> {
    if (!interpretation.success) {
      return `Lo siento, no pude analizar el documento. ${interpretation.error || 'Por favor, asegurate de que sea un PDF legible con resultados de laboratorio.'}`;
    }

    let response = 'INTERPRETACION DE TUS RESULTADOS DE LABORATORIO\n';
    response += '----------------------------------------\n\n';

    // Resumen general
    response += `RESUMEN:\n${interpretation.resumen_general}\n\n`;

    // Advertencias (si hay)
    if (interpretation.advertencias && interpretation.advertencias.length > 0) {
      response += 'ATENCION:\n';
      interpretation.advertencias.forEach(adv => {
        response += `  - ${adv}\n`;
      });
      response += '\n';
    }

    // Resultados destacados (fuera de rango)
    const outOfRange = interpretation.resultados.filter(r =>
      r.estado === 'ALTO' || r.estado === 'BAJO' || r.estado === 'CRITICO'
    );

    if (outOfRange.length > 0) {
      response += 'VALORES FUERA DE RANGO:\n';
      outOfRange.forEach(r => {
        const indicator = r.estado === 'CRITICO' ? '[!]' : r.estado === 'ALTO' ? '[+]' : '[-]';
        response += `\n${indicator} ${r.examen}: ${r.valor} ${r.unidad || ''} (Ref: ${r.valor_referencia || 'N/A'})\n`;
        response += `    ${r.interpretacion}\n`;
      });
      response += '\n';
    }

    // Recomendaciones
    if (interpretation.recomendaciones && interpretation.recomendaciones.length > 0) {
      response += 'RECOMENDACIONES:\n';
      interpretation.recomendaciones.forEach(rec => {
        response += `  - ${rec}\n`;
      });
    }

    response += '\n----------------------------------------\n';
    response += 'Nota: Esta interpretacion es educativa. Consulta siempre con tu medico para un diagnostico profesional.';

    return response;
  }

  /**
   * Parsea la respuesta JSON de Gemini
   */
  private parseGeminiResponse(responseText: string): Partial<LabResultInterpretation> {
    try {
      let cleanText = responseText.trim();

      // Remover bloques de código markdown si existen
      if (cleanText.includes('```json')) {
        const match = cleanText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          cleanText = match[1];
        }
      } else if (cleanText.includes('```')) {
        const match = cleanText.match(/```\s*([\s\S]*?)\s*```/);
        if (match) {
          cleanText = match[1];
        }
      }

      // Intentar encontrar el objeto JSON completo si hay texto extra
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
      }

      // Limpiar caracteres problemáticos que a veces agrega Gemini
      cleanText = cleanText
        .replace(/[\x00-\x1F\x7F]/g, ' ') // Caracteres de control
        .replace(/,\s*}/g, '}') // Comas trailing antes de }
        .replace(/,\s*]/g, ']'); // Comas trailing antes de ]

      const parsed = JSON.parse(cleanText);

      return {
        paciente: parsed.paciente || undefined,
        fecha_examen: parsed.fecha_examen || undefined,
        laboratorio: parsed.laboratorio || undefined,
        resultados: Array.isArray(parsed.resultados) ? parsed.resultados : [],
        resumen_general: parsed.resumen_general || '',
        recomendaciones: Array.isArray(parsed.recomendaciones) ? parsed.recomendaciones : [],
        advertencias: Array.isArray(parsed.advertencias) ? parsed.advertencias : [],
      };
    } catch (error) {
      this.logger.warn(`Error parseando respuesta JSON: ${error.message}`);

      // Intentar extraer información básica del texto si el JSON falla
      const resumenMatch = responseText.match(/resumen[_\s]?general["']?\s*:\s*["']([^"']+)["']/i);
      const resumen = resumenMatch ? resumenMatch[1] : 'No se pudo procesar la respuesta de manera estructurada. Por favor, intenta de nuevo.';

      return {
        resultados: [],
        resumen_general: resumen,
        recomendaciones: ['Consulta con tu medico para una interpretacion profesional de tus resultados.'],
        advertencias: [],
      };
    }
  }

  /**
   * Verifica si el servicio está configurado
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

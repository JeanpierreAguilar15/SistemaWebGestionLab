# Módulo de Resultados - Sistema de Laboratorio

## 📋 Descripción

Módulo completo para gestión de muestras y resultados de laboratorio con **generación de PDFs profesionales** y **notificaciones en tiempo real** cuando los resultados están listos.

## 🚨 IMPORTANTE: Instalación de Dependencias

Este módulo requiere la instalación de `pdfkit` para la generación de PDFs:

```bash
cd backend
npm install pdfkit @types/pdfkit
```

## 🏗️ Arquitectura

```
Técnico toma muestra → Técnico procesa resultado →
Técnico/Admin valida → Sistema genera PDF →
WebSocket notifica a paciente → Paciente descarga PDF
```

### Flujos Bidireccionales

#### Admin/Técnico → Paciente
- Técnico valida resultado → Sistema genera PDF automáticamente
- WebSocket notifica al paciente: "Tu resultado está listo"
- Paciente puede descargar PDF inmediatamente

#### Paciente → Admin
- Paciente descarga resultado → Admin ve registro de descarga
- Estado cambia de LISTO → ENTREGADO automáticamente

## 🗃️ Modelo de Datos

### Muestra
```typescript
{
  codigo_muestra: number;
  codigo_paciente: number;
  codigo_cita?: number;           // Opcional, si viene de una cita
  id_muestra: string;              // ID único (ej: "MUE-2025-001")
  fecha_toma: Date;
  tipo_muestra: string;            // "Sangre venosa", "Orina", etc.
  estado: string;                  // RECOLECTADA, EN_PROCESO, PROCESADA
  observaciones?: string;
  tomada_por: number;              // Usuario que tomó la muestra
}
```

### Resultado
```typescript
{
  codigo_resultado: number;
  codigo_muestra: number;
  codigo_examen: number;

  // Valores del resultado
  valor_numerico?: number;         // Para valores numéricos
  valor_texto?: string;            // Para valores cualitativos
  unidad_medida?: string;          // "mg/dL", "UI/L", etc.

  // Rangos de referencia
  valor_referencia_min?: number;
  valor_referencia_max?: number;
  valores_referencia_texto?: string;

  // Análisis automático
  dentro_rango_normal?: boolean;   // Calculado automáticamente
  nivel?: string;                  // NORMAL | ALTO | BAJO | CRITICO

  // Metadatos
  estado: string;                  // EN_PROCESO | LISTO | VALIDADO | ENTREGADO
  procesado_por: number;           // Técnico que procesó
  validado_por?: number;           // Quien validó
  fecha_validacion?: Date;

  // PDF y verificación
  url_pdf?: string;                // Generado automáticamente
  codigo_verificacion?: string;    // Código único para validar autenticidad

  observaciones_tecnicas?: string;
}
```

## 📡 API Endpoints

### Muestras (Admin/Técnico)

#### `POST /resultados/muestras`
Registrar nueva muestra tomada de un paciente.

**Request:**
```json
{
  "codigo_paciente": 10,
  "codigo_cita": 5,
  "id_muestra": "MUE-2025-001",
  "tipo_muestra": "Sangre venosa",
  "fecha_toma": "2025-01-17T10:30:00Z",
  "observaciones": "Paciente en ayunas"
}
```

**Response:**
```json
{
  "codigo_muestra": 1,
  "id_muestra": "MUE-2025-001",
  "codigo_paciente": 10,
  "estado": "RECOLECTADA",
  "fecha_toma": "2025-01-17T10:30:00.000Z",
  "paciente": {
    "codigo_usuario": 10,
    "nombres": "Juan",
    "apellidos": "Pérez",
    "cedula": "1234567890"
  }
}
```

---

#### `GET /resultados/muestras`
Obtener muestras con filtros.

**Query Params:**
- `codigo_paciente`: Filtrar por paciente
- `estado`: Filtrar por estado
- `fecha_desde`: Desde fecha
- `fecha_hasta`: Hasta fecha

**Response:**
```json
[
  {
    "codigo_muestra": 1,
    "id_muestra": "MUE-2025-001",
    "estado": "RECOLECTADA",
    "paciente": {
      "nombres": "Juan",
      "apellidos": "Pérez"
    },
    "resultados": [
      {
        "codigo_resultado": 1,
        "examen": {
          "nombre": "Hemograma Completo"
        },
        "estado": "EN_PROCESO"
      }
    ]
  }
]
```

---

### Resultados (Admin/Técnico)

#### `POST /resultados`
Crear resultado para una muestra.

**Request:**
```json
{
  "codigo_muestra": 1,
  "codigo_examen": 1,
  "valor_numerico": 150.5,
  "unidad_medida": "mg/dL",
  "valor_referencia_min": 70,
  "valor_referencia_max": 100,
  "observaciones_tecnicas": "Valor elevado, repetir en 2 semanas"
}
```

**Cálculo Automático:**
El sistema calcula automáticamente:
- `dentro_rango_normal`: false (150.5 > 100)
- `nivel`: "ALTO"
- Si el valor estuviera <50% del mínimo o >150% del máximo → `nivel`: "CRITICO"

**Response:**
```json
{
  "codigo_resultado": 1,
  "codigo_muestra": 1,
  "codigo_examen": 1,
  "valor_numerico": 150.5,
  "unidad_medida": "mg/dL",
  "dentro_rango_normal": false,
  "nivel": "ALTO",
  "estado": "EN_PROCESO",
  "muestra": {
    "id_muestra": "MUE-2025-001",
    "paciente": {
      "nombres": "Juan",
      "apellidos": "Pérez"
    }
  },
  "examen": {
    "nombre": "Glicemia"
  }
}
```

---

#### `PUT /resultados/:id/validar` 🔥 **GENERA PDF**
Validar resultado y generar PDF automáticamente.

**Efecto:**
1. Cambia estado a LISTO
2. Genera código de verificación único
3. **Genera PDF profesional** con:
   - Logo del laboratorio
   - Datos del paciente
   - Nombre del examen
   - Resultados con colores (verde=normal, rojo=alto/bajo)
   - Valores de referencia
   - Observaciones técnicas
   - Código de verificación en footer
4. Guarda URL del PDF en la base de datos
5. **Notifica al paciente vía WebSocket**
6. Notifica a admins

**Response:**
```json
{
  "codigo_resultado": 1,
  "estado": "LISTO",
  "codigo_verificacion": "VER-A1B2C3D4",
  "url_pdf": "/uploads/resultados/resultado_1_1234567890.pdf",
  "fecha_validacion": "2025-01-17T15:00:00.000Z",
  "validado_por": 2
}
```

**WebSocket Notifications:**
```json
// Al paciente: result:update
{
  "resultId": 1,
  "patientId": 10,
  "examName": "Glicemia",
  "status": "ready",
  "timestamp": "..."
}

// A admins: admin:event
{
  "eventType": "resultados.resultado.validado",
  "entityType": "resultado",
  "entityId": 1,
  "action": "validated",
  "data": {
    "paciente": "Juan Pérez",
    "examen": "Glicemia"
  }
}
```

---

#### `GET /resultados/admin/all`
Obtener todos los resultados (Admin).

**Query Params:**
- `codigo_paciente`
- `codigo_examen`
- `estado`
- `fecha_desde`
- `fecha_hasta`

**Response:**
```json
[
  {
    "codigo_resultado": 1,
    "estado": "LISTO",
    "valor_numerico": 150.5,
    "nivel": "ALTO",
    "muestra": {
      "id_muestra": "MUE-2025-001",
      "paciente": {
        "nombres": "Juan",
        "apellidos": "Pérez",
        "cedula": "1234567890"
      }
    },
    "examen": {
      "nombre": "Glicemia"
    },
    "procesador": {
      "nombres": "María",
      "apellidos": "García"
    },
    "validador": {
      "nombres": "Dr. Carlos",
      "apellidos": "López"
    }
  }
]
```

---

#### `PUT /resultados/admin/:id`
Actualizar estado de resultado.

**Request:**
```json
{
  "estado": "ENTREGADO",
  "observaciones_tecnicas": "Resultado entregado al paciente"
}
```

---

#### `GET /resultados/admin/estadisticas`
Obtener estadísticas.

**Response:**
```json
{
  "total": 100,
  "en_proceso": 10,
  "listos": 30,
  "validados": 40,
  "entregados": 20,
  "fuera_rango_normal": 25,
  "criticos": 5
}
```

---

### Resultados (Paciente)

#### `GET /resultados/my`
Obtener mis resultados disponibles.

**Response:**
```json
[
  {
    "codigo_resultado": 1,
    "estado": "LISTO",
    "valor_numerico": 150.5,
    "unidad_medida": "mg/dL",
    "dentro_rango_normal": false,
    "nivel": "ALTO",
    "examen": {
      "nombre": "Glicemia",
      "codigo_interno": "GLI-001"
    },
    "muestra": {
      "id_muestra": "MUE-2025-001",
      "fecha_toma": "2025-01-17T10:30:00.000Z",
      "tipo_muestra": "Sangre venosa"
    },
    "fecha_resultado": "2025-01-17T15:00:00.000Z"
  }
]
```

---

#### `GET /resultados/:id/descargar` 📥 **DESCARGA PDF**
Descargar PDF del resultado.

**Efecto:**
1. Verifica que el resultado pertenece al paciente
2. Verifica que el estado es LISTO/VALIDADO/ENTREGADO
3. Registra la descarga en tabla `DescargaResultado`
4. Cambia estado de LISTO → ENTREGADO (primera descarga)
5. Devuelve el archivo PDF

**Response:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename=resultado-1.pdf

[Binary PDF file]
```

---

## 🎨 Generación de PDFs

### Características del PDF

El PDF generado incluye:

1. **Header Profesional**
   - Logo del laboratorio (azul)
   - Nombre del laboratorio en grande
   - Dirección, teléfono, email
   - Línea separadora azul
   - Título "RESULTADO DE LABORATORIO"

2. **Datos del Paciente**
   - Nombre completo
   - Cédula
   - Fecha de nacimiento
   - Email
   - Teléfono

3. **Información del Examen**
   - Nombre del examen
   - Código interno
   - Fecha del resultado
   - Estado

4. **Tabla de Resultados**
   - Encabezado azul (Parámetro | Resultado | Unidad | Ref.)
   - Resultado con color según nivel:
     - Verde/Negro: NORMAL
     - Naranja: BAJO
     - Rojo: ALTO
     - Rojo oscuro: CRITICO
   - Valores de referencia
   - Observaciones técnicas (si las hay)

5. **Footer con Código de Verificación**
   - Código único para validar autenticidad
   - Fecha de generación
   - Nota legal

### Ejemplo Visual

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║        LABORATORIO CLÍNICO FRANZ                         ║
║        Av. Principal 123, Quito - Ecuador                ║
║        Tel: (02) 1234-5678 | info@labfranz.com          ║
║ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║                                                          ║
║           RESULTADO DE LABORATORIO                       ║
║                                                          ║
║  DATOS DEL PACIENTE                                      ║
║  Nombre: Juan Pérez                                      ║
║  Cédula: 1234567890                                      ║
║  Email: juan@example.com                                 ║
║                                                          ║
║  INFORMACIÓN DEL EXAMEN                                  ║
║  Examen: Glicemia                                        ║
║  Fecha: 17/01/2025                                       ║
║                                                          ║
║  RESULTADOS                                              ║
║  ┏━━━━━━━━━┳━━━━━━━━━┳━━━━━━┳━━━━━━━━━━┓              ║
║  ┃Parámetro┃Resultado┃Unidad┃    Ref.  ┃              ║
║  ┣━━━━━━━━━╋━━━━━━━━━╋━━━━━━╋━━━━━━━━━━┫              ║
║  ┃Glicemia ┃  150.5  ┃mg/dL ┃ 70 - 100 ┃              ║
║  ┗━━━━━━━━━┻━━━━━━━━━┻━━━━━━┻━━━━━━━━━━┛              ║
║                        ^^^^                              ║
║                      (en ROJO)                           ║
║                                                          ║
║  OBSERVACIONES:                                          ║
║  Valor elevado, se recomienda consulta médica           ║
║                                                          ║
║  ───────────────────────────────────────────────        ║
║  Código verificación: VER-A1B2C3D4                       ║
║  Generado: 17/01/2025 15:30:00                          ║
║  Este documento es válido con código de verificación    ║
╚══════════════════════════════════════════════════════════╝
```

---

## 🔔 Notificaciones WebSocket

### Eventos Emitidos

#### `result:update`
Cuando resultado está listo para descarga.
- **Destinatarios:** Paciente específico
- **Trigger:** validarResultado()

```json
{
  "resultId": 1,
  "patientId": 10,
  "examName": "Glicemia",
  "status": "ready",
  "timestamp": "2025-01-17T15:00:00.000Z"
}
```

#### `admin:event`
Cuando técnico valida resultado.
- **Destinatarios:** Admins
- **Trigger:** validarResultado()

---

## 🎯 Casos de Uso

### 1. Técnico procesa resultado completo

```
1. Técnico registra muestra: POST /resultados/muestras
2. Técnico ingresa resultado: POST /resultados
3. Técnico valida: PUT /resultados/1/validar
   → Sistema genera PDF automáticamente
   → Sistema genera código VER-A1B2C3D4
   → Sistema notifica a paciente vía WebSocket
4. Paciente recibe notificación en tiempo real
5. Paciente descarga: GET /resultados/1/descargar
   → Sistema registra descarga
   → Estado cambia a ENTREGADO
```

### 2. Paciente consulta resultados

```
1. Paciente hace login
2. Sistema conecta WebSocket
3. Paciente consulta: GET /resultados/my
4. Ve lista con resultados LISTO, VALIDADO, ENTREGADO
5. Hace clic en "Descargar PDF"
6. Frontend llama: GET /resultados/1/descargar
7. Navegador descarga archivo PDF
8. Paciente abre PDF y ve resultado profesional
```

### 3. Admin revisa estadísticas

```
1. Admin consulta: GET /resultados/admin/estadisticas
2. Ve:
   - Total: 100 resultados
   - En proceso: 10
   - Listos: 30
   - Fuera de rango: 25
   - Críticos: 5 (requieren atención)
3. Admin filtra críticos: GET /resultados/admin/all?nivel=CRITICO
4. Contacta a pacientes con valores críticos
```

---

## ⚙️ Lógica de Negocio

### Cálculo Automático de Niveles

```typescript
// Sistema calcula automáticamente:
if (valor_numerico < valor_referencia_min) {
  nivel = "BAJO";
  if (valor_numerico < valor_referencia_min * 0.5) {
    nivel = "CRITICO"; // Muy por debajo
  }
}

if (valor_numerico > valor_referencia_max) {
  nivel = "ALTO";
  if (valor_numerico > valor_referencia_max * 1.5) {
    nivel = "CRITICO"; // Muy por encima
  }
}
```

### Estados de Resultado

- **EN_PROCESO:** Técnico está procesando
- **LISTO:** Validado y PDF generado, listo para descarga
- **VALIDADO:** Doble validación realizada
- **ENTREGADO:** Paciente ya descargó

### Seguridad

1. **Verificación de propiedad:** Paciente solo puede ver sus propios resultados
2. **Código de verificación:** Cada PDF tiene código único
3. **Registro de descargas:** Auditoría de quién y cuándo descargó
4. **Solo resultados listos:** No se pueden descargar resultados en proceso

---

## 🔧 Integración Frontend

### Ejemplo: Escuchar notificación de resultado listo

```typescript
useEffect(() => {
  socket.on('result:update', (data) => {
    if (data.status === 'ready') {
      // Mostrar notificación
      toast.success(`¡Tu resultado de ${data.examName} está listo!`);

      // Actualizar lista de resultados
      fetchMyResults();

      // Reproducir sonido
      playNotificationSound();

      // Mostrar badge con contador
      incrementResultsCount();
    }
  });
}, [socket]);
```

### Ejemplo: Descargar PDF

```typescript
const handleDownload = async (resultadoId: number) => {
  try {
    const response = await fetch(
      `/api/resultados/${resultadoId}/descargar`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Error descargando resultado');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultado-${resultadoId}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('PDF descargado exitosamente');
  } catch (error) {
    toast.error('Error al descargar el PDF');
  }
};
```

---

## 📁 Estructura de Archivos

```
uploads/
└── resultados/
    ├── resultado_1_1234567890.pdf
    ├── resultado_2_1234567891.pdf
    └── ...
```

El sistema crea automáticamente el directorio `uploads/resultados/` si no existe.

---

## 🧪 Testing

Para probar la generación de PDFs:

```bash
# Instalar dependencia
npm install pdfkit @types/pdfkit

# Ejecutar tests
npm test -- resultados

# Crear muestra de prueba
POST /resultados/muestras
{
  "codigo_paciente": 1,
  "id_muestra": "TEST-001",
  "tipo_muestra": "Sangre"
}

# Crear resultado
POST /resultados
{
  "codigo_muestra": 1,
  "codigo_examen": 1,
  "valor_numerico": 95,
  "unidad_medida": "mg/dL",
  "valor_referencia_min": 70,
  "valor_referencia_max": 100
}

# Validar y generar PDF
PUT /resultados/1/validar

# Verificar que PDF existe en: uploads/resultados/
```

---

## 🚀 Próximas Mejoras

- [ ] Email automático cuando resultado está listo
- [ ] Firma digital del responsable en PDF
- [ ] QR code con enlace de verificación
- [ ] Comparación con resultados anteriores
- [ ] Gráficos de tendencias en PDF
- [ ] Envío de PDF por email
- [ ] Múltiples idiomas en PDF

---

**Última actualización:** 2025-01-17

# Módulo de Cotizaciones y Pagos

Sistema completo de cotizaciones y pagos para el Laboratorio Clínico Franz. Permite a los pacientes seleccionar exámenes tipo checklist, obtener cotizaciones con cálculo automático de precios y requisitos, generar PDFs profesionales, y registrar pagos.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Modelos de Datos](#modelos-de-datos)
- [API Endpoints](#api-endpoints)
- [Flujos de Trabajo](#flujos-de-trabajo)
- [Integración con Frontend](#integración-con-frontend)

## ✨ Características

### Cotizaciones

- ✅ **Checklist Dinámico de Exámenes**: Lista organizada por categorías (Hematología, Química Sanguínea, Serología, etc.)
- ✅ **Cálculo Automático de Precios**: Obtiene precios actuales y calcula subtotal/total
- ✅ **Requisitos de Preparación**: Muestra ayuno requerido y preparación para cada examen
- ✅ **Generación de PDF Profesional**: Cotización con logo, términos y condiciones
- ✅ **Gestión de Estados**: PENDIENTE → ACEPTADA → PAGADA / RECHAZADA / EXPIRADA
- ✅ **Fecha de Expiración**: 30 días de validez automáticos
- ✅ **Descuentos**: Aplicación de descuentos (solo Admin)
- ✅ **Numeración Única**: COT-YYYYMM-XXXX

### Pagos

- ✅ **Múltiples Métodos de Pago**: Efectivo, Tarjeta, Transferencia, PayPal
- ✅ **Vinculación a Cotizaciones**: Pago asociado a cotización específica
- ✅ **Validación de Montos**: Verifica que el monto coincida con la cotización
- ✅ **Estado de Pago**: COMPLETADO, PENDIENTE, RECHAZADO
- ✅ **Integración con Pasarelas**: Soporte para PayPal, Stripe, etc.
- ✅ **Comprobantes**: URLs de comprobantes de pago
- ✅ **Numeración Única**: PAG-YYYYMM-XXXX
- ✅ **Estadísticas**: Total de ingresos, pagos por método, etc.

## 🏗️ Arquitectura

```
src/modules/pagos/
├── dto/
│   ├── create-cotizacion.dto.ts    # DTO para crear cotización con lista de exámenes
│   ├── update-cotizacion.dto.ts    # DTO para actualizar estado
│   ├── create-pago.dto.ts          # DTO para registrar pago
│   └── index.ts
├── cotizaciones.service.ts         # Lógica de negocio de cotizaciones
├── cotizaciones.controller.ts      # Endpoints REST de cotizaciones
├── cotizacion-pdf.service.ts       # Generación de PDFs de cotizaciones
├── pagos.service.ts                # Lógica de negocio de pagos
├── pagos.controller.ts             # Endpoints REST de pagos
├── pagos.module.ts                 # Configuración del módulo
└── README.md
```

## 📊 Modelos de Datos

### Cotizacion

```prisma
model Cotizacion {
  codigo_cotizacion     Int       @id @default(autoincrement())
  codigo_paciente       Int
  numero_cotizacion     String    @unique
  fecha_cotizacion      DateTime  @default(now())
  fecha_expiracion      DateTime
  subtotal              Decimal
  descuento             Decimal   @default(0)
  total                 Decimal
  estado                String    @default("PENDIENTE")
  observaciones         String?

  paciente              Usuario
  detalles              CotizacionDetalle[]
  pagos                 Pago[]
}
```

### CotizacionDetalle

```prisma
model CotizacionDetalle {
  codigo_detalle        Int       @id @default(autoincrement())
  codigo_cotizacion     Int
  codigo_examen         Int
  cantidad              Int
  precio_unitario       Decimal
  total_linea           Decimal

  cotizacion            Cotizacion
  examen                Examen
}
```

### Pago

```prisma
model Pago {
  codigo_pago               Int       @id @default(autoincrement())
  codigo_cotizacion         Int?
  codigo_paciente           Int
  numero_pago               String    @unique
  fecha_pago                DateTime  @default(now())
  monto_total               Decimal
  metodo_pago               String
  estado                    String    @default("PENDIENTE")
  proveedor_pasarela        String?
  id_transaccion_externa    String?
  url_comprobante           String?
  observaciones             String?

  cotizacion                Cotizacion?
  paciente                  Usuario
}
```

## 🔌 API Endpoints

### Cotizaciones (Paciente)

#### 1. Obtener Exámenes para Cotización

```http
GET /cotizaciones/examenes
Authorization: Bearer {token}
```

**Respuesta:**

```json
[
  {
    "codigo_categoria": 1,
    "nombre": "HEMATOLOGÍA",
    "descripcion": "Análisis de sangre completos",
    "examenes": [
      {
        "codigo_examen": 1,
        "codigo_interno": "HEM-001",
        "nombre": "Hemograma Completo",
        "descripcion": "Conteo completo de células sanguíneas",
        "precio_actual": 15.50,
        "requiere_ayuno": true,
        "horas_ayuno": 8,
        "instrucciones_preparacion": "No consumir alimentos grasos 24 horas antes",
        "tiempo_entrega_horas": 24,
        "tipo_muestra": "Sangre venosa"
      }
    ]
  }
]
```

#### 2. Crear Cotización

```http
POST /cotizaciones
Authorization: Bearer {token}
Content-Type: application/json

{
  "examenes": [
    { "codigo_examen": 1, "cantidad": 1 },
    { "codigo_examen": 5, "cantidad": 1 },
    { "codigo_examen": 10, "cantidad": 1 }
  ],
  "observaciones": "Exámenes pre-operatorios"
}
```

**Respuesta:**

```json
{
  "codigo_cotizacion": 1,
  "numero_cotizacion": "COT-202411-0001",
  "fecha_cotizacion": "2025-11-17T10:30:00.000Z",
  "fecha_expiracion": "2025-12-17T10:30:00.000Z",
  "subtotal": 85.50,
  "descuento": 0,
  "total": 85.50,
  "estado": "PENDIENTE",
  "detalles": [
    {
      "codigo_examen": 1,
      "cantidad": 1,
      "precio_unitario": 15.50,
      "total_linea": 15.50,
      "examen": {
        "nombre": "Hemograma Completo",
        "requiere_ayuno": true,
        "horas_ayuno": 8
      }
    }
  ],
  "paciente": {
    "nombres": "Juan",
    "apellidos": "Pérez",
    "email": "juan@example.com"
  }
}
```

#### 3. Obtener Mis Cotizaciones

```http
GET /cotizaciones/my
Authorization: Bearer {token}
```

#### 4. Obtener Cotización Específica

```http
GET /cotizaciones/{id}
Authorization: Bearer {token}
```

#### 5. Descargar PDF de Cotización

```http
GET /cotizaciones/{id}/pdf
Authorization: Bearer {token}
```

**Respuesta:** Archivo PDF descargable

### Cotizaciones (Admin)

#### 6. Obtener Todas las Cotizaciones

```http
GET /cotizaciones/admin/all?codigo_paciente=1&estado=PENDIENTE&fecha_desde=2025-01-01
Authorization: Bearer {token}
```

#### 7. Actualizar Estado de Cotización

```http
PUT /cotizaciones/admin/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "estado": "ACEPTADA",
  "observaciones": "Cotización aprobada por el paciente"
}
```

#### 8. Estadísticas de Cotizaciones

```http
GET /cotizaciones/admin/estadisticas?fecha_desde=2025-01-01&fecha_hasta=2025-12-31
Authorization: Bearer {token}
```

**Respuesta:**

```json
{
  "total": 150,
  "pendientes": 20,
  "aceptadas": 80,
  "rechazadas": 10,
  "pagadas": 70,
  "expiradas": 5,
  "total_ventas": 12500.75
}
```

### Pagos (Paciente)

#### 9. Registrar Pago

```http
POST /pagos
Authorization: Bearer {token}
Content-Type: application/json

{
  "codigo_cotizacion": 1,
  "monto_total": 85.50,
  "metodo_pago": "TRANSFERENCIA",
  "proveedor_pasarela": "Banco Pichincha",
  "id_transaccion_externa": "TRX-123456789",
  "observaciones": "Transferencia realizada"
}
```

**Respuesta:**

```json
{
  "codigo_pago": 1,
  "numero_pago": "PAG-202411-0001",
  "fecha_pago": "2025-11-17T11:00:00.000Z",
  "monto_total": 85.50,
  "metodo_pago": "TRANSFERENCIA",
  "estado": "COMPLETADO",
  "paciente": {
    "nombres": "Juan",
    "apellidos": "Pérez",
    "email": "juan@example.com"
  },
  "cotizacion": {
    "numero_cotizacion": "COT-202411-0001",
    "total": 85.50
  }
}
```

#### 10. Obtener Mis Pagos

```http
GET /pagos/my
Authorization: Bearer {token}
```

#### 11. Obtener Pago Específico

```http
GET /pagos/{id}
Authorization: Bearer {token}
```

### Pagos (Admin)

#### 12. Obtener Todos los Pagos

```http
GET /pagos/admin/all?metodo_pago=TRANSFERENCIA&estado=COMPLETADO
Authorization: Bearer {token}
```

#### 13. Actualizar Estado de Pago

```http
PUT /pagos/admin/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "estado": "COMPLETADO",
  "observaciones": "Pago verificado"
}
```

#### 14. Estadísticas de Pagos

```http
GET /pagos/admin/estadisticas?fecha_desde=2025-01-01&fecha_hasta=2025-12-31
Authorization: Bearer {token}
```

**Respuesta:**

```json
{
  "total": 200,
  "completados": 180,
  "pendientes": 15,
  "rechazados": 5,
  "total_ingresos": 15750.25,
  "pagos_por_metodo": [
    {
      "metodo_pago": "TRANSFERENCIA",
      "_count": { "metodo_pago": 100 },
      "_sum": { "monto_total": 8500.00 }
    },
    {
      "metodo_pago": "TARJETA_CREDITO",
      "_count": { "metodo_pago": 60 },
      "_sum": { "monto_total": 5250.25 }
    },
    {
      "metodo_pago": "EFECTIVO",
      "_count": { "metodo_pago": 20 },
      "_sum": { "monto_total": 2000.00 }
    }
  ]
}
```

## 🔄 Flujos de Trabajo

### Flujo 1: Crear Cotización (Paciente)

```
1. Paciente se autentica
2. GET /cotizaciones/examenes → Obtiene lista de exámenes por categoría
3. Frontend muestra checklist dinámico con precios y requisitos
4. Paciente selecciona exámenes deseados
5. POST /cotizaciones → Crea cotización con cálculo automático
6. Sistema genera número único: COT-202411-0001
7. Sistema calcula subtotal y total
8. Sistema establece fecha de expiración (30 días)
9. GET /cotizaciones/{id}/pdf → Descarga PDF profesional
```

### Flujo 2: Procesar Pago (Paciente)

```
1. Paciente revisa cotización
2. Decide pagar
3. POST /pagos → Registra pago
   - Sistema valida que cotización existe
   - Verifica que no esté expirada
   - Confirma que monto coincide
4. Sistema genera número: PAG-202411-0001
5. Sistema actualiza cotización a estado PAGADA
6. Sistema marca pago como COMPLETADO
```

### Flujo 3: Gestión Admin

```
1. Admin se autentica
2. GET /cotizaciones/admin/all → Ve todas las cotizaciones
3. PUT /cotizaciones/admin/{id} → Actualiza estado si es necesario
4. GET /pagos/admin/all → Ve todos los pagos
5. GET /cotizaciones/admin/estadisticas → Analiza métricas
6. GET /pagos/admin/estadisticas → Analiza ingresos
```

## 🔗 Integración con Frontend

### Ejemplo React: Checklist de Exámenes

```tsx
import { useState, useEffect } from 'react';

function CotizacionForm() {
  const [categorias, setCategorias] = useState([]);
  const [selectedExams, setSelectedExams] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    // Cargar exámenes
    fetch('/api/cotizaciones/examenes', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setCategorias(data));
  }, []);

  const handleExamToggle = (examen) => {
    const exists = selectedExams.find(e => e.codigo_examen === examen.codigo_examen);

    if (exists) {
      setSelectedExams(selectedExams.filter(e => e.codigo_examen !== examen.codigo_examen));
    } else {
      setSelectedExams([...selectedExams, { codigo_examen: examen.codigo_examen, cantidad: 1 }]);
    }
  };

  useEffect(() => {
    // Calcular total estimado
    const subtotal = selectedExams.reduce((sum, item) => {
      const examen = findExamen(item.codigo_examen);
      return sum + (examen?.precio_actual || 0) * item.cantidad;
    }, 0);
    setTotal(subtotal);
  }, [selectedExams]);

  const handleSubmit = async () => {
    const response = await fetch('/api/cotizaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ examenes: selectedExams })
    });

    const cotizacion = await response.json();
    console.log('Cotización creada:', cotizacion);
  };

  return (
    <div className="cotizacion-form">
      <h2>Seleccione los Exámenes</h2>

      {categorias.map(categoria => (
        <div key={categoria.codigo_categoria} className="categoria-section">
          <h3>{categoria.nombre}</h3>

          {categoria.examenes.map(examen => (
            <div key={examen.codigo_examen} className="examen-item">
              <label>
                <input
                  type="checkbox"
                  checked={selectedExams.some(e => e.codigo_examen === examen.codigo_examen)}
                  onChange={() => handleExamToggle(examen)}
                />
                <span className="examen-nombre">{examen.nombre}</span>
                <span className="examen-precio">${examen.precio_actual}</span>
              </label>

              {examen.requiere_ayuno && (
                <div className="requisitos">
                  ⚠ Ayuno de {examen.horas_ayuno} horas
                </div>
              )}

              {examen.instrucciones_preparacion && (
                <div className="instrucciones">
                  📋 {examen.instrucciones_preparacion}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="total-section">
        <h3>Total Estimado: ${total.toFixed(2)}</h3>
        <button onClick={handleSubmit} disabled={selectedExams.length === 0}>
          Generar Cotización
        </button>
      </div>
    </div>
  );
}
```

### Ejemplo: Descargar PDF

```tsx
const downloadPDF = async (cotizacionId) => {
  const response = await fetch(`/api/cotizaciones/${cotizacionId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cotizacion-${cotizacionId}.pdf`;
  a.click();
};
```

## 📄 Formato del PDF de Cotización

El PDF generado incluye:

```
┌──────────────────────────────────────────────────────────┐
│                LABORATORIO CLÍNICO FRANZ                  │
│         Av. Principal 123, Quito - Ecuador               │
│      Tel: (02) 1234-5678 | info@labfranz.com            │
│                  RUC: 1234567890001                      │
├──────────────────────────────────────────────────────────┤
│           COTIZACIÓN DE EXÁMENES                         │
├──────────────────────────────────────────────────────────┤
│ Nro. Cotización: COT-202411-0001                         │
│ Fecha: 17/11/2025                                        │
│ Válida hasta: 17/12/2025                 Estado: PENDIENTE│
├──────────────────────────────────────────────────────────┤
│ DATOS DEL PACIENTE                                       │
│ Nombre: Juan Pérez                                       │
│ Cédula: 1234567890                                       │
│ Email: juan@example.com                                  │
├──────────────────────────────────────────────────────────┤
│ EXÁMENES SOLICITADOS                                     │
│ ┌────────────────────┬──────┬──────┬───────┬─────────┐  │
│ │ EXAMEN             │ CÓD. │ CANT.│P.UNIT │  TOTAL  │  │
│ ├────────────────────┼──────┼──────┼───────┼─────────┤  │
│ │ Hemograma Completo │HEM001│  1   │$15.50 │  $15.50 │  │
│ │ Glucosa            │GLU001│  1   │$12.00 │  $12.00 │  │
│ └────────────────────┴──────┴──────┴───────┴─────────┘  │
├──────────────────────────────────────────────────────────┤
│ ⚠ REQUISITOS Y PREPARACIÓN                              │
│ • Hemograma Completo:                                    │
│   - Requiere ayuno de 8 horas                           │
│   - No consumir alimentos grasos 24h antes              │
│ • Glucosa:                                               │
│   - Requiere ayuno de 12 horas                          │
├──────────────────────────────────────────────────────────┤
│                               SUBTOTAL:         $27.50   │
│                               DESCUENTO:         $0.00   │
│                               ─────────────────────────   │
│                               TOTAL:            $27.50   │
├──────────────────────────────────────────────────────────┤
│ TÉRMINOS Y CONDICIONES                                   │
│ • Válida hasta el 17/12/2025                            │
│ • Precios incluyen IVA                                   │
│ • Seguir instrucciones de preparación                   │
└──────────────────────────────────────────────────────────┘
```

## 🔐 Seguridad

- ✅ Autenticación JWT requerida en todos los endpoints
- ✅ Verificación de propiedad (paciente solo ve sus cotizaciones/pagos)
- ✅ Roles: Admin puede ver/modificar todo, Paciente solo lo suyo
- ✅ Validación de montos antes de registrar pagos
- ✅ Verificación de expiración de cotizaciones
- ✅ Validación de precios actuales al crear cotización

## 📊 Estados

### Estados de Cotización

- `PENDIENTE`: Cotización creada, esperando respuesta del paciente
- `ACEPTADA`: Paciente acepta la cotización
- `RECHAZADA`: Paciente rechaza la cotización
- `PAGADA`: Pago registrado y confirmado
- `EXPIRADA`: Pasó la fecha de expiración sin pago

### Estados de Pago

- `PENDIENTE`: Pago iniciado pero no confirmado
- `COMPLETADO`: Pago confirmado y procesado
- `RECHAZADO`: Pago rechazado por el sistema o pasarela

## 🧪 Testing

Probar el flujo completo:

```bash
# 1. Obtener exámenes
curl -X GET http://localhost:3000/api/cotizaciones/examenes \
  -H "Authorization: Bearer {token}"

# 2. Crear cotización
curl -X POST http://localhost:3000/api/cotizaciones \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "examenes": [
      {"codigo_examen": 1, "cantidad": 1},
      {"codigo_examen": 2, "cantidad": 1}
    ]
  }'

# 3. Descargar PDF
curl -X GET http://localhost:3000/api/cotizaciones/1/pdf \
  -H "Authorization: Bearer {token}" \
  --output cotizacion.pdf

# 4. Registrar pago
curl -X POST http://localhost:3000/api/pagos \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_cotizacion": 1,
    "monto_total": 27.50,
    "metodo_pago": "TRANSFERENCIA"
  }'
```

## 📝 Notas Importantes

1. **Precios Dinámicos**: El sistema obtiene el precio vigente al momento de crear la cotización
2. **Expiración**: Las cotizaciones expiran automáticamente después de 30 días
3. **Validación de Montos**: Al registrar un pago, el monto debe coincidir con el total de la cotización
4. **Estados Automáticos**: Al registrar un pago exitoso, la cotización cambia automáticamente a estado PAGADA
5. **PDFs**: Los PDFs se generan dinámicamente y se almacenan en `uploads/cotizaciones/`
6. **Requisitos**: Los requisitos de preparación se obtienen directamente del modelo Examen
7. **Categorías Dinámicas**: Admin puede agregar nuevas categorías y exámenes que aparecerán automáticamente en el checklist

---

**Desarrollado para:** Laboratorio Clínico Franz
**Versión:** 1.0.0
**Última actualización:** Noviembre 2025

# Módulo de Agenda - Sistema de Citas

## 📋 Descripción

Módulo completo para gestión de citas médicas con **comunicación bidireccional** en tiempo real entre administradores y pacientes.

## 🏗️ Arquitectura

```
Admin crea Slot → Paciente consulta disponibilidad → Paciente agenda →
    → WebSocket notifica a Admin → Admin confirma →
    → WebSocket notifica a Paciente
```

### Flujos Bidireccionales

#### Admin → Paciente
- Admin crea slots → Todos los pacientes ven nueva disponibilidad
- Admin confirma cita → Paciente recibe notificación
- Admin cancela/reagenda → Paciente es notificado

#### Paciente → Admin
- Paciente agenda cita → Admin recibe notificación
- Paciente cancela cita → Admin es notificado
- Paciente reagenda → Admin ve el cambio

## 🗃️ Modelo de Datos

### Slot (Franjas horarias)
```typescript
{
  codigo_slot: number;           // ID único
  codigo_servicio: number;       // Servicio médico
  codigo_sede: number;           // Sede/ubicación
  fecha: Date;                   // Fecha del slot
  hora_inicio: Time;             // Hora inicio
  hora_fin: Time;                // Hora fin
  cupos_totales: number;         // Cupos totales
  cupos_disponibles: number;     // Cupos libres
  activo: boolean;               // Estado activo/inactivo
}
```

### Cita (Reserva de paciente)
```typescript
{
  codigo_cita: number;           // ID único
  codigo_slot: number;           // Slot reservado
  codigo_paciente: number;       // Paciente
  estado: string;                // AGENDADA | CONFIRMADA | CANCELADA | COMPLETADA | NO_ASISTIO
  observaciones?: string;        // Notas del paciente
  motivo_cancelacion?: string;   // Si fue cancelada
  confirmada: boolean;           // Confirmación admin
  fecha_confirmacion?: Date;     // Cuándo se confirmó
}
```

## 📡 API Endpoints

### Slots (Admin)

#### `POST /agenda/slots` (Admin)
Crear nuevo slot de disponibilidad.

**Request:**
```json
{
  "codigo_servicio": 1,
  "codigo_sede": 1,
  "fecha": "2025-01-25",
  "hora_inicio": "09:00",
  "hora_fin": "09:30",
  "cupos_totales": 5
}
```

**Response:**
```json
{
  "codigo_slot": 1,
  "codigo_servicio": 1,
  "codigo_sede": 1,
  "fecha": "2025-01-25T00:00:00.000Z",
  "hora_inicio": "09:00:00",
  "hora_fin": "09:30:00",
  "cupos_totales": 5,
  "cupos_disponibles": 5,
  "activo": true,
  "servicio": {
    "codigo_servicio": 1,
    "nombre": "Consulta General"
  },
  "sede": {
    "codigo_sede": 1,
    "nombre": "Sede Principal"
  }
}
```

**WebSocket Notification:**
```json
// Evento: catalog:update
{
  "type": "slot",
  "action": "created",
  "entityId": 1,
  "entityName": "Consulta General - Sede Principal",
  "timestamp": "2025-01-17T..."
}
```

---

#### `GET /agenda/slots/available` (Público)
Obtener slots disponibles.

**Query Params:**
- `codigo_servicio` (opcional): Filtrar por servicio
- `codigo_sede` (opcional): Filtrar por sede
- `fecha_desde` (opcional): Fecha desde (YYYY-MM-DD)
- `fecha_hasta` (opcional): Fecha hasta (YYYY-MM-DD)
- `disponibles_solo` (opcional): Solo con cupos (default: true)

**Response:**
```json
[
  {
    "codigo_slot": 1,
    "fecha": "2025-01-25",
    "hora_inicio": "09:00:00",
    "hora_fin": "09:30:00",
    "cupos_disponibles": 5,
    "servicio": {
      "nombre": "Consulta General",
      "descripcion": "..."
    },
    "sede": {
      "nombre": "Sede Principal",
      "direccion": "Av. Principal 123",
      "telefono": "0987654321"
    },
    "_count": {
      "citas": 0
    }
  }
]
```

---

#### `GET /agenda/slots/:id` (Admin)
Obtener detalles de un slot.

**Response:**
```json
{
  "codigo_slot": 1,
  "cupos_disponibles": 3,
  "citas": [
    {
      "codigo_cita": 1,
      "paciente": {
        "nombres": "Juan",
        "apellidos": "Pérez",
        "email": "juan@example.com"
      },
      "estado": "AGENDADA"
    }
  ]
}
```

---

#### `PUT /agenda/slots/:id` (Admin)
Actualizar slot (solo cupos o estado si no hay citas).

**Request:**
```json
{
  "cupos_totales": 10,
  "activo": true
}
```

---

#### `DELETE /agenda/slots/:id` (Admin)
Eliminar slot (desactiva si hay citas).

---

### Citas (Paciente)

#### `POST /agenda/citas` (Paciente)
Agendar nueva cita.

**Request:**
```json
{
  "codigo_slot": 1,
  "observaciones": "Tengo alergia a la penicilina"
}
```

**Response:**
```json
{
  "codigo_cita": 1,
  "codigo_slot": 1,
  "codigo_paciente": 10,
  "estado": "AGENDADA",
  "observaciones": "Tengo alergia a la penicilina",
  "slot": {
    "fecha": "2025-01-25",
    "hora_inicio": "09:00:00",
    "servicio": {
      "nombre": "Consulta General"
    },
    "sede": {
      "nombre": "Sede Principal",
      "direccion": "..."
    }
  }
}
```

**WebSocket Notifications:**
```json
// Al paciente: appointment:update
{
  "appointmentId": 1,
  "patientId": 10,
  "action": "created",
  "appointment": { ... },
  "timestamp": "..."
}

// A admins: admin:event
{
  "eventType": "agenda.cita.created",
  "entityType": "cita",
  "entityId": 1,
  "action": "created",
  "userId": 10,
  "data": {
    "servicio": "Consulta General",
    "fecha": "2025-01-25"
  }
}
```

---

#### `GET /agenda/citas/my` (Paciente)
Obtener mis citas.

**Response:**
```json
[
  {
    "codigo_cita": 1,
    "estado": "AGENDADA",
    "confirmada": false,
    "slot": {
      "fecha": "2025-01-25",
      "hora_inicio": "09:00:00",
      "servicio": {
        "nombre": "Consulta General"
      }
    }
  }
]
```

---

#### `GET /agenda/citas/:id` (Paciente/Admin)
Obtener detalles de una cita.

---

#### `PUT /agenda/citas/:id/cancel` (Paciente)
Cancelar cita.

**Request:**
```json
{
  "motivo_cancelacion": "No podré asistir por motivos personales"
}
```

**Efecto:**
- Libera cupo en el slot
- Cambia estado a CANCELADA
- Notifica a admin vía WebSocket

---

#### `PUT /agenda/citas/:id/reschedule` (Paciente)
Reagendar cita a otro slot.

**Request:**
```json
{
  "codigo_slot": 2
}
```

**Efecto:**
- Libera cupo en slot anterior
- Reserva cupo en nuevo slot
- Notifica a admin

---

### Citas (Admin)

#### `GET /agenda/admin/citas` (Admin)
Obtener todas las citas con filtros.

**Query Params:**
- `codigo_paciente`: Filtrar por paciente
- `codigo_servicio`: Filtrar por servicio
- `codigo_sede`: Filtrar por sede
- `estado`: Filtrar por estado
- `fecha_desde`: Fecha desde
- `fecha_hasta`: Fecha hasta

**Response:**
```json
[
  {
    "codigo_cita": 1,
    "estado": "AGENDADA",
    "confirmada": false,
    "paciente": {
      "nombres": "Juan",
      "apellidos": "Pérez",
      "cedula": "1234567890",
      "email": "juan@example.com",
      "telefono": "0987654321"
    },
    "slot": {
      "fecha": "2025-01-25",
      "hora_inicio": "09:00:00",
      "servicio": {
        "nombre": "Consulta General"
      },
      "sede": {
        "nombre": "Sede Principal"
      }
    }
  }
]
```

---

#### `PUT /agenda/admin/citas/:id/confirm` (Admin)
Confirmar cita.

**Efecto:**
- Cambia estado a CONFIRMADA
- Marca confirmada = true
- Agrega fecha_confirmacion
- Notifica a paciente vía WebSocket

---

#### `PUT /agenda/admin/citas/:id` (Admin)
Actualizar cita (cambiar estado, observaciones, reagendar).

**Request:**
```json
{
  "estado": "COMPLETADA",
  "observaciones": "Paciente atendido correctamente"
}
```

---

#### `GET /agenda/admin/estadisticas` (Admin)
Obtener estadísticas de citas.

**Response:**
```json
{
  "total": 100,
  "agendadas": 30,
  "confirmadas": 40,
  "canceladas": 10,
  "completadas": 15,
  "no_asistio": 5,
  "tasa_asistencia": "16.67"
}
```

---

## 🔔 Notificaciones WebSocket

### Eventos Emitidos

#### `catalog:update`
Cuando admin crea/actualiza slots.
- **Destinatarios:** Todos los clientes
- **Trigger:** createSlot()

#### `appointment:update`
Cuando se crea/actualiza/cancela cita.
- **Destinatarios:** Paciente específico + Admins
- **Actions:** 'created', 'updated', 'cancelled', 'confirmed'
- **Trigger:** createCita(), updateCita(), cancelarCita()

#### `admin:event`
Cuando paciente agenda cita.
- **Destinatarios:** Solo admins
- **Trigger:** createCita()

## 🎯 Casos de Uso

### 1. Paciente agenda cita
```
1. Paciente consulta GET /agenda/slots/available
2. Frontend muestra calendario con slots
3. Paciente selecciona slot
4. Frontend envía POST /agenda/citas
5. Backend crea cita y reduce cupos
6. Backend emite WebSocket a paciente: "Cita agendada"
7. Backend emite WebSocket a admins: "Nueva cita"
8. Paciente ve confirmación
9. Admin ve nueva cita en panel
```

### 2. Admin confirma cita
```
1. Admin ve citas pendientes en GET /agenda/admin/citas
2. Admin hace clic en "Confirmar"
3. Frontend envía PUT /agenda/admin/citas/:id/confirm
4. Backend confirma cita
5. Backend emite WebSocket a paciente: "Cita confirmada"
6. Paciente recibe notificación en tiempo real
```

### 3. Paciente cancela cita
```
1. Paciente ve sus citas en GET /agenda/citas/my
2. Paciente hace clic en "Cancelar"
3. Frontend envía PUT /agenda/citas/:id/cancel
4. Backend cancela cita y libera cupo
5. Backend emite WebSocket a admin: "Cita cancelada"
6. Admin ve actualización en panel en tiempo real
```

### 4. Admin crea slots masivamente
```
1. Admin accede a gestión de horarios
2. Admin selecciona servicio, sede, rango de fechas
3. Frontend genera slots cada 30 minutos
4. Frontend envía POST /agenda/slots por cada slot
5. Backend crea slots
6. Backend emite WebSocket por cada slot creado
7. Pacientes conectados ven nueva disponibilidad
```

## ⚙️ Lógica de Negocio

### Validaciones

**createSlot:**
- ✅ Servicio y sede deben existir
- ✅ Fecha no puede ser pasada
- ✅ hora_fin > hora_inicio
- ✅ cupos_totales >= 1

**createCita:**
- ✅ Slot debe existir y estar activo
- ✅ Debe haber cupos disponibles
- ✅ Paciente no puede tener otra cita en el mismo slot
- ✅ Transacción atómica: crear cita + decrementar cupos

**updateSlot:**
- ✅ Si tiene citas, no se puede cambiar fecha/hora
- ✅ cupos_totales >= citas agendadas

**cancelarCita:**
- ✅ Libera cupo automáticamente
- ✅ Notifica a admin

**reagendar:**
- ✅ Transacción: libera cupo anterior + reserva nuevo
- ✅ Nuevo slot debe tener cupos

### Estados de Cita

- **AGENDADA:** Recién creada por paciente
- **CONFIRMADA:** Admin confirmó la cita
- **CANCELADA:** Paciente/Admin canceló
- **COMPLETADA:** Paciente asistió y fue atendido
- **NO_ASISTIO:** Paciente no se presentó

## 🔧 Integración Frontend

### Ejemplo: Agendar Cita

```typescript
// 1. Obtener slots disponibles
const response = await fetch('/api/agenda/slots/available?codigo_servicio=1&fecha_desde=2025-01-20');
const slots = await response.json();

// 2. Agendar cita
const cita = await fetch('/api/agenda/citas', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    codigo_slot: selectedSlotId,
    observaciones: 'Mi observación',
  }),
});

// 3. Escuchar notificación vía WebSocket
socket.on('appointment:update', (data) => {
  if (data.action === 'created') {
    showNotification('¡Cita agendada exitosamente!');
    refreshMyCitas();
  }
});
```

### Ejemplo: Admin Dashboard en Tiempo Real

```typescript
useEffect(() => {
  socket.on('admin:event', (data) => {
    if (data.eventType === 'agenda.cita.created') {
      // Actualizar lista de citas
      fetchCitas();

      // Mostrar notificación
      toast.info(`Nueva cita: ${data.data.servicio}`);

      // Actualizar contador
      incrementPendingAppointments();
    }
  });
}, [socket]);
```

## 📊 Estadísticas y Reportes

El endpoint `/agenda/admin/estadisticas` permite generar reportes de:
- Total de citas por período
- Tasa de asistencia
- Citas por estado
- Métricas de ocupación

## 🧪 Testing

Tests incluidos:
- ✅ createSlot - validaciones y notificaciones
- ✅ createCita - reserva y transacciones
- ✅ cancelarCita - liberación de cupos
- ✅ getMyCitas - filtrado por paciente
- ✅ getEstadisticas - cálculos correctos

Ejecutar tests:
```bash
npm test -- agenda.service.spec.ts
```

## 🚀 Próximas Mejoras

- [ ] Recordatorios automáticos 24h antes
- [ ] Email de confirmación al agendar
- [ ] SMS de recordatorio
- [ ] Límite de citas por paciente por mes
- [ ] Blacklist de pacientes con alta tasa de ausencia
- [ ] Reportes avanzados con gráficos
- [ ] Exportación de citas a PDF/Excel
- [ ] Integración con calendario Google/Outlook

---

**Última actualización:** 2025-01-17

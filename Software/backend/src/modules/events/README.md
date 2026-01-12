# Sistema de Eventos en Tiempo Real - WebSocket Gateway

## Descripción General

Este módulo implementa comunicación bidireccional en tiempo real entre el backend y frontend usando WebSockets (Socket.IO). Permite que los cambios realizados por administradores se reflejen instantáneamente en las interfaces de los pacientes y viceversa.

## Arquitectura

```
Admin Action → AdminService → Event Emission → Event Listeners → WebSocket Gateway → Frontend Clients
                                                                                          ↓
Patient Action → Service → Event Emission → Event Listeners → WebSocket Gateway → Admin Dashboard
```

## Flujos Implementados

### 1. Admin actualiza catálogo → Pacientes notificados
- Admin crea/modifica/elimina examen → Todos los clientes reciben `catalog:update`
- Admin cambia precios → Todos los clientes reciben `catalog:update` con type='price'
- Admin modifica categorías/paquetes → Broadcast a todos los clientes

### 2. Admin modifica usuario → Paciente notificado
- Admin actualiza datos de paciente → Solo ese paciente recibe `user:update`
- Admin desactiva cuenta → Paciente recibe notificación

### 3. Sistema de auditoría en tiempo real
- Todas las acciones admin → Admins reciben `admin:event` en dashboard
- Logs de actividad en tiempo real para monitoreo

## Eventos Disponibles

### Eventos del Servidor (Backend → Frontend)

#### `connected`
Confirmación de conexión exitosa
```typescript
{
  message: string;
  userId: number;
  role: string;
}
```

#### `catalog:update`
Cambios en el catálogo (exámenes, precios, categorías, paquetes)
```typescript
{
  type: 'exam' | 'price' | 'category' | 'package' | 'location';
  action: 'created' | 'updated' | 'deleted';
  entityId: number;
  entityName?: string;
  timestamp: Date;
}
```

#### `user:update`
Cambios específicos de usuario
```typescript
{
  type: string;
  action: string;
  changes?: any;
  timestamp: Date;
}
```

#### `admin:event`
Eventos administrativos (solo para admins)
```typescript
{
  eventType: string;
  entityType: string;
  entityId: number;
  action: string;
  userId: number;
  data?: any;
  timestamp: Date;
}
```

#### `appointment:update`
Actualizaciones de citas
```typescript
{
  appointmentId: number;
  patientId: number;
  action: 'created' | 'updated' | 'cancelled' | 'confirmed';
  appointment?: any;
  timestamp: Date;
}
```

#### `result:update`
Notificación de resultados disponibles
```typescript
{
  resultId: number;
  patientId: number;
  examName: string;
  status: 'pending' | 'ready' | 'delivered';
  timestamp: Date;
}
```

#### `system:message`
Mensajes broadcast del sistema
```typescript
{
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  targetRole?: string;
  timestamp: Date;
}
```

### Mensajes del Cliente (Frontend → Backend)

#### `ping`
Verificar conectividad
```typescript
// Enviar
{ event: 'ping' }

// Respuesta
{
  event: 'pong',
  data: {
    timestamp: Date;
    userId: number;
  }
}
```

#### `subscribe`
Suscribirse a eventos específicos
```typescript
{
  entity: string;
  entityId?: number;
}
```

#### `unsubscribe`
Desuscribirse de eventos
```typescript
{
  entity: string;
  entityId?: number;
}
```

## Integración con Frontend

### Instalación

```bash
npm install socket.io-client
```

### Ejemplo de Cliente React/Next.js

```typescript
// hooks/useEventSocket.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useEventSocket(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io('http://localhost:4000/events', {
      auth: {
        token: token,
      },
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to events server');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 Disconnected from events server');
      setIsConnected(false);
    });

    socketInstance.on('connected', (data) => {
      console.log('📢 Server confirmed connection:', data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return { socket, isConnected };
}
```

### Ejemplo de uso en componente

```typescript
// components/CatalogView.tsx
import { useEventSocket } from '@/hooks/useEventSocket';
import { useEffect } from 'react';

export function CatalogView() {
  const { socket, isConnected } = useEventSocket(userToken);
  const [exams, setExams] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Escuchar actualizaciones del catálogo
    socket.on('catalog:update', (data) => {
      console.log('📦 Catalog updated:', data);

      if (data.type === 'exam') {
        // Recargar exámenes
        fetchExams();
      } else if (data.type === 'price') {
        // Actualizar precios
        updatePrices();
      }
    });

    // Escuchar actualizaciones de usuario
    socket.on('user:update', (data) => {
      console.log('👤 User data updated:', data);
      // Actualizar datos del usuario en la UI
      refreshUserData();
    });

    return () => {
      socket.off('catalog:update');
      socket.off('user:update');
    };
  }, [socket]);

  return (
    <div>
      {isConnected && <div className="status-indicator">🟢 Conectado</div>}
      {/* ... rest of component */}
    </div>
  );
}
```

### Ejemplo para Dashboard de Admin

```typescript
// components/AdminDashboard.tsx
export function AdminDashboard() {
  const { socket, isConnected } = useEventSocket(adminToken);

  useEffect(() => {
    if (!socket) return;

    // Escuchar todos los eventos administrativos
    socket.on('admin:event', (data) => {
      console.log('🔔 Admin event:', data);

      // Actualizar log de actividad en tiempo real
      addToActivityLog({
        user: data.userId,
        action: `${data.action} ${data.entityType}`,
        entityId: data.entityId,
        timestamp: data.timestamp,
      });
    });

    // Escuchar actualizaciones de citas
    socket.on('appointment:update', (data) => {
      console.log('📅 Appointment updated:', data);

      // Mostrar notificación
      showNotification({
        title: 'Nueva cita agendada',
        message: `Paciente ${data.patientId} agendó una cita`,
        type: 'info',
      });

      // Actualizar calendario
      refreshCalendar();
    });

    return () => {
      socket.off('admin:event');
      socket.off('appointment:update');
    };
  }, [socket]);

  return <div>{/* Dashboard UI */}</div>;
}
```

## Autenticación

El gateway requiere autenticación JWT. El token debe enviarse en:
- `auth.token` en el handshake de Socket.IO
- Header `Authorization: Bearer <token>`

```typescript
const socket = io('http://localhost:4000/events', {
  auth: {
    token: 'your-jwt-token',
  },
});
```

## Rooms (Salas)

El gateway organiza a los clientes en rooms:

- `role:Administrador` - Todos los admins
- `role:Paciente` - Todos los pacientes
- `role:Medico` - Todos los médicos
- `user:{userId}` - Sala individual por usuario

Esto permite enviar notificaciones específicas a:
- Solo admins: `server.to('role:Administrador').emit(...)`
- Usuario específico: `server.to('user:123').emit(...)`
- Todos: `server.emit(...)`

## Pruebas

### Test de conectividad con Postman/Thunder Client

1. Conectar a `ws://localhost:4000/events`
2. Enviar mensaje `ping`
3. Esperar respuesta `pong` con timestamp

### Test desde consola del navegador

```javascript
const socket = io('http://localhost:4000/events', {
  auth: { token: 'your-token' }
});

socket.on('connect', () => console.log('Connected'));
socket.on('catalog:update', (data) => console.log('Catalog updated:', data));

// Enviar ping
socket.emit('ping');
```

## Escalabilidad

Para producción con múltiples instancias del servidor:

1. **Usar Redis Adapter** para sincronizar eventos entre instancias:
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

2. **Sticky Sessions** en load balancer para mantener conexión

3. **Health Checks** para monitorear conexiones activas:
```typescript
app.get('/health/websocket', (req, res) => {
  const stats = eventsGateway.getConnectionStats();
  res.json(stats);
});
```

## Monitoreo

### Estadísticas de conexiones

```typescript
GET /api/admin/websocket/stats

Response:
{
  total: 45,
  byRole: {
    'Administrador': 3,
    'Paciente': 42
  },
  clients: [...]
}
```

## Troubleshooting

### Cliente no se conecta
1. Verificar que el token JWT sea válido
2. Verificar CORS en gateway (debe incluir origen del frontend)
3. Revisar que el puerto 4000 esté accesible

### Eventos no se reciben
1. Verificar que el listener esté registrado antes del evento
2. Confirmar que el usuario está en el room correcto
3. Revisar logs del servidor para errores

### Desconexiones frecuentes
1. Aumentar timeout de pingTimeout/pingInterval
2. Verificar estabilidad de la red
3. Considerar usar transporte websocket únicamente

## Próximas Mejoras

- [ ] Implementar cache manager para invalidación real
- [ ] Agregar autenticación con refresh token
- [ ] Implementar rate limiting por usuario
- [ ] Agregar métricas con Prometheus
- [ ] Implementar compression para mensajes grandes
- [ ] Agregar soporte para binary data (archivos PDF de resultados)

# Sistema Laboratorio Clínico Franz - Backend API

API REST construida con NestJS, TypeScript, Prisma y PostgreSQL para el sistema de gestión del Laboratorio Clínico Franz.

## Stack Tecnológico

- **Framework**: NestJS 10.x
- **Lenguaje**: TypeScript 5.x
- **ORM**: Prisma 5.x
- **Base de Datos**: PostgreSQL 14+
- **Autenticación**: JWT con Passport
- **Validación**: class-validator, class-transformer
- **Documentación**: Swagger/OpenAPI
- **Seguridad**: Helmet, CORS, Rate Limiting (Throttler)

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crear archivo `.env` basado en `.env.example`

### 3. Configurar Base de Datos

Ejecutar scripts SQL en orden:

```bash
psql -U postgres -f ../../database/00_create_database.sql
psql -U postgres -d laboratorio_franz_db -f ../../database/01_create_schemas.sql
psql -U postgres -d laboratorio_franz_db -f ../../database/02_schema_usuarios.sql
psql -U postgres -d laboratorio_franz_db -f ../../database/03_schema_agenda.sql
psql -U postgres -d laboratorio_franz_db -f ../../database/04_schema_catalogo.sql
psql -U postgres -d laboratorio_franz_db -f ../../database/05_schema_pagos.sql
psql -U postgres -d laboratorio_franz_db -f ../../database/06_schema_resultados_inventario_comunicaciones_auditoria.sql
```

### 4. Generar Prisma Client

```bash
npm run prisma:generate
```

## Ejecutar

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## Documentación API

Swagger: `http://localhost:3001/api/docs`

## Módulos Implementados

- **auth**: Registro, login, JWT, refresh tokens
- **users**: Gestión de usuarios y perfiles
- **agenda**: Citas y horarios (stub)
- **catalogo**: Exámenes y precios (stub)
- **pagos**: Cotizaciones y pagos (stub)
- **resultados**: Resultados de laboratorio (stub)
- **inventario**: Gestión de inventario (stub)
- **comunicaciones**: Chat y notificaciones (stub)
- **auditoria**: Logs y trazabilidad (stub)

# 20i MCP Server - Guía de Despliegue en Render

Este documento proporciona instrucciones específicas para desplegar el servidor MCP de 20i en Render.com.

## 🚀 Despliegue en Render

Render es una plataforma de despliegue en la nube que soporta despliegues automáticos desde GitHub, Docker, y más.

### Opción 1: Despliegue con Docker (Recomendado)

#### 1. Preparar el Repositorio para Render

1. **Crear archivo `render.yaml`**:
```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    env: docker
    repo: https://github.com/tu-usuario/20i-MCP
    dockerfilePath: ./Dockerfile
    dockerContext: .
    envVars:
      - key: TWENTYI_API_KEY
        sync: false  # No sincronizar con Render
      - key: TWENTYI_OAUTH_KEY
        sync: false
      - key: TWENTYI_COMBINED_KEY
        sync: false
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
    healthCheck:
      path: /health
      interval: 30s
      timeout: 10s
      retries: 3
    instanceCount: 1
    cpuKind: shared
    cpuAmount: 1
    memoryLimit: 1Gi
    diskSize: 1Gi
```

2. **Actualizar el Dockerfile para Render**:
```dockerfile
# Dockerfile-Render
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Expose port (Render uses dynamic port)
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["node", "build/index-cloud.js"]
```

#### 2. Configurar Render

1. **Crear cuenta en Render**:
   - Visita [render.com](https://render.com)
   - Regístrate con tu cuenta de GitHub

2. **Conectar repositorio**:
   - En el dashboard de Render, haz clic en "New +"
   - Selecciona "Web Service"
   - Conecta tu repositorio de GitHub
   - Selecciona el repositorio `20i-MCP`

3. **Configurar servicio**:
   - **Name**: `20i-mcp-server`
   - **Region**: Elige la región más cercana a tus usuarios
   - **Branch**: `main` o `master`
   - **Runtime**: `Docker`
   - **Instance Type**: `Free` (para empezar) o `Standard` para producción
   - **Health Check Path**: `/health`

4. **Configurar variables de entorno**:
   - En la configuración del servicio, ve a "Environment"
   - Agrega las siguientes variables:
     ```
     TWENTYI_API_KEY=your_api_key
     TWENTYI_OAUTH_KEY=your_oauth_key
     TWENTYI_COMBINED_KEY=your_combined_key
     NODE_ENV=production
     PORT=10000
     LOG_LEVEL=info
     ```

5. **Desplegar**:
   - Haz clic en "Advanced" para ver opciones adicionales
   - Configura el número de instancias según tus necesidades
   - Haz clic en "Create Web Service"

### Opción 2: Despliegue con Buildpack (Node.js)

Si prefieres no usar Docker, puedes usar el buildpack de Node.js de Render:

1. **Actualizar `package.json`**:
```json
{
  "name": "20i-mcp-server",
  "version": "1.7.1",
  "description": "20i MCP Server for Render",
  "main": "build/index-cloud.js",
  "scripts": {
    "build": "tsc",
    "start": "node build/index-cloud.js",
    "dev": "tsx src/index-cloud.ts",
    "test": "jest"
  },
  "engines": {
    "node": "18.x"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "adm-zip": "^0.5.16",
    "axios": "^1.11.0",
    "dotenv": "^17.1.0",
    "node-html-parser": "^7.0.1",
    "node-ssh": "^13.2.1",
    "puppeteer": "^24.12.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

2. **Configurar servicio en Render**:
   - **Name**: `20i-mcp-server`
   - **Runtime**: `Node.js`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

### Opción 3: Despliegue con Docker Compose (Render + External Services)

Para servicios que requieren múltiples contenedores:

1. **Crear `render.yaml`**:
```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    env: docker
    repo: https://github.com/tu-usuario/20i-MCP
    dockerfilePath: ./Dockerfile
    dockerContext: .
    envVars:
      - key: TWENTYI_API_KEY
        sync: false
      - key: TWENTYI_OAUTH_KEY
        sync: false
      - key: TWENTYI_COMBINED_KEY
        sync: false
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
    healthCheck:
      path: /health
      interval: 30s
      timeout: 10s
      retries: 3
    instanceCount: 1

  - type: pserv
    name: 20i-mcp-database
    env: docker
    repo: https://github.com/tu-usuario/20i-MCP
    dockerfilePath: ./postgres.Dockerfile
    dockerContext: .
    envVars:
      - key: POSTGRES_DB
        value: mcp_server
      - key: POSTGRES_USER
        value: mcp_user
      - key: POSTGRES_PASSWORD
        sync: false
    instanceCount: 1
    cpuKind: shared
    cpuAmount: 0.5
    memoryLimit: 512Mi
    diskSize: 1Gi
```

2. **Crear `postgres.Dockerfile`**:
```dockerfile
# postgres.Dockerfile
FROM postgres:15-alpine

# Set environment variables
ENV POSTGRES_DB=mcp_server
ENV POSTGRES_USER=mcp_user
ENV POSTGRES_PASSWORD=password

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/

# Expose port
EXPOSE 5432

# Start PostgreSQL
CMD ["postgres"]
```

## 🔧 Configuración Adicional

### 1. Configuración de SSL en Render

Render proporciona SSL automáticamente en dominios personalizados:

1. **Configurar dominio personalizado**:
   - En el dashboard de Render, ve a tu servicio
   - Haz clic en "Settings" → "Custom Domain"
   - Agrega tu dominio (ej: `mcp.tu-dominio.com`)

2. **Configurar DNS**:
   - Render proporcionará registros DNS
   - Actualiza tu DNS con los registros proporcionados

### 2. Configuración de Monitoreo

Render incluye monitoreo básico:

1. **Ver métricas**:
   - En el dashboard de Render, ve a tu servicio
   - Haz clic en "Metrics" para ver uso de CPU, memoria, red

2. **Configurar alertas**:
   - Render envía emails para servicios caídos
   - Puedes configurar webhooks para alertas personalizadas

### 3. Configuración de Logs

Render captura logs automáticamente:

1. **Ver logs en tiempo real**:
   - En el dashboard de Render, ve a tu servicio
   - Haz clic en "Logs" para ver logs en tiempo real

2. **Exportar logs**:
   - Render permite exportar logs a servicios como Logtail, Datadog, etc.

## 🚀 Despliegue Automático

Render soporta despliegos automáticos desde GitHub:

1. **Configurar webhooks**:
   - Render configura automáticamente webhooks en tu repositorio
   - Cada push a la rama principal desencadena un despliegue

2. **Configurar despliegos condicionales**:
   ```yaml
   # .render.yaml
   services:
     - type: web
       name: 20i-mcp-server
       env: docker
       repo: https://github.com/tu-usuario/20i-MCP
       dockerfilePath: ./Dockerfile
       dockerContext: .
       envVars:
         # ... variables de entorno
       autoDeploy: true  # Habilitar despliegos automáticos
       branch: main     # Rama para despliegos automáticos
   ```

## 📊 Escalado en Render

### 1. Escalado Automático

Render soporta escalado automático:

```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    env: docker
    # ... configuración básica
    instanceCount: 1  # Mínimo de instancias
    maxInstances: 5   # Máximo de instancias
    minCPU: 0.5       # CPU mínima por instancia
    maxCPU: 2         # CPU máxima por instancia
    minMemory: 512Mi  # Memoria mínima por instancia
    maxMemory: 2Gi    # Memoria máxima por instancia
```

### 2. Escalado Manual

Para cambiar manualmente el número de instancias:

1. Ve al dashboard de Render
2. Selecciona tu servicio
3. Haz clic en "Settings"
4. Ajusta "Instance Count"

## 🔒 Seguridad en Render

### 1. Variables de Entorno

Render proporciona varias opciones para variables de entorno:

1. **Variables de entorno estándar**:
   - Agrega variables en la interfaz de Render
   - Marcadas como "Secure" no se muestran en logs

2. **Variables de entorno secretas**:
   - Usa Render Secrets Manager
   - Variables cifradas y accesibles solo por tu servicio

### 2. Redes y Firewalls

Render configura automáticamente redes y firewalls:

1. **Red interna**: Los servicios en el mismo proyecto pueden comunicarse
2. **Firewall**: Solo permite tráfico en el puerto especificado
3. **SSL**: SSL gratuito para dominios de Render

## 🚨 Troubleshooting en Render

### 1. Problemas Comunes

**Servicio no se inicia**:
- Verifica logs en la pestaña "Logs"
- Revisa variables de entorno
- Asegúrate de que el puerto esté configurado correctamente

**Errores de compilación**:
- Verifica que `package.json` esté actualizado
- Revisa que todos los archivos estén en el repositorio
- Asegúrate de que las dependencias estén listas

**Problemas de rendimiento**:
- Monitorea métricas en la pestaña "Metrics"
- Aumenta recursos si es necesario
- Considera escalar a más instancias

### 2. Comandos Útiles

```bash
# Ver logs en tiempo real
render logs 20i-mcp-server

# Reiniciar servicio
render restart 20i-mcp-server

# Escalar servicio
render scale 20i-mcp-server --instances=3

# Ver estado del servicio
render status 20i-mcp-server
```

## 📈 Costos en Render

### 1. Plan Free
- 1 instancia por servicio
- 512MB RAM
- CPU compartida
- SSL gratuito
- Ideal para desarrollo y pruebas

### 2. Plan Standard
- Múltiples instancias
- Más RAM y CPU
- Red más rápida
- Ideal para producción

### 3. Costos Estimados
- **Free**: $0/mes (con limitaciones)
- **Standard**: $7+/mes por servicio
- **Add-ons**: Costos adicionales para almacenamiento, etc.

## 🔄 Migración desde Docker Compose

Si ya tienes configuración de Docker Compose:

1. **Simplifica para Render**:
   - Render maneja orquestación automáticamente
   - No necesitas `docker-compose.yml` completo

2. **Adapta servicios**:
   - Múltiples servicios en `docker-compose.yml` se convierten en múltiples servicios en `render.yaml`
   - Base de datos externas se pueden desplegar como servicios separados

## 📚 Recursos Adicionales

- [Documentación de Render](https://render.com/docs)
- [Guía de Docker en Render](https://render.com/docs/deploy-docker-app)
- [Monitoreo en Render](https://render.com/docs/monitor)
- [Variables de entorno en Render](https://render.com/docs/environment-variables)

---

**Nota**: Render es excelente para despliegos rápidos y escalables. La configuración Docker es la más recomendada para producción debido a su consistencia y portabilidad.
# 20i MCP Server - Guía de Despliegue en la Nube

Este documento proporciona instrucciones detalladas para desplegar el servidor MCP de 20i en infraestructura cloud.

## 🚀 Características del Despliegue en la Nube

- **Contenedorización**: Docker y Docker Compose para despliegue consistente
- **Balanceo de Carga**: Nginx como proxy inverso y balanceador de carga
- **Monitoreo**: Prometheus y Grafana para métricas y dashboards
- **Base de Datos**: PostgreSQL para persistencia de datos
- **Caching**: Redis para mejor rendimiento
- **Escalabilidad**: Configuración para escalar horizontalmente
- **Seguridad**: SSL/TLS, rate limiting, y CORS
- **Resiliencia**: Health checks y graceful shutdown

## 📋 Requisitos Previos

### Software Requerido
- Node.js 18+
- Docker y Docker Compose
- npm o yarn
- Git

### Credenciales Requeridas
Variables de entorno necesarias:
```bash
# Credenciales de API de 20i
export TWENTYI_API_KEY="your_api_key"
export TWENTYI_OAUTH_KEY="your_oauth_key"
export TWENTYI_COMBINED_KEY="your_combined_key"

# Base de datos
export POSTGRES_PASSWORD="your_postgres_password"

# Grafana
export GRAFANA_PASSWORD="your_grafana_password"
```

## 🏗️ Arquitectura del Despliegue

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Nginx Proxy   │    │   SSL/TLS       │
│   (Cloud LB)    │────│   (Port 80/443) │────│   Termination   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────────────────────────────┐
                    │           Docker Compose Stack           │
                    │                                         │
                    │  ┌─────────────┐  ┌─────────────────┐  │
                    │  │  MCP Server │  │   PostgreSQL    │  │
                    │  │ (Port 3000) │  │   (Port 5432)   │  │
                    │  └─────────────┘  └─────────────────┘  │
                    │  ┌─────────────┐  ┌─────────────────┐  │
                    │  │    Redis    │  │   Prometheus    │  │
                    │  │ (Port 6379) │  │   (Port 9090)   │  │
                    │  └─────────────┘  └─────────────────┘  │
                    │  ┌─────────────┐  ┌─────────────────┐  │
                    │  │   Grafana   │  │   Nginx Config  │  │
                    │  │ (Port 3001) │  │   (Port 8080)   │  │
                    │  └─────────────┘  └─────────────────┘  │
                    └─────────────────────────────────────────┘
```

## 🚀 Proceso de Despliegue

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Cbrown35/20i-MCP.git
cd 20i-MCP
```

### 2. Configurar Variables de Entorno

```bash
# Copiar el archivo de plantilla
cp .env.template .env

# Editar el archivo .env con tus credenciales
nano .env
```

### 3. Verificar Requisitos

```bash
# Verificar que todo está listo para el despliegue
npm run deploy:check
```

### 4. Construir la Aplicación

```bash
# Construir la aplicación y Docker images
npm run deploy:build
```

### 5. Desplegar con Docker Compose

```bash
# Desplegar todos los servicios
npm run deploy:docker
```

### 6. Verificar el Despliegue

```bash
# Verificar el estado de los servicios
npm run status

# Ver los logs
npm run logs
```

## 🔧 Configuración del Entorno

### Variables de Entorno Disponibles

| Variable | Descripción | Valor Predeterminado |
|----------|-------------|---------------------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto del servidor | `3000` |
| `LOG_LEVEL` | Nivel de logging | `info` |
| `HEALTH_CHECK_ENABLED` | Habilitar health checks | `true` |
| `MONITORING_ENABLED` | Habilitar monitoreo | `true` |
| `ENABLE_CORS` | Habilitar CORS | `true` |
| `RATE_LIMIT_ENABLED` | Habilitar rate limiting | `true` |
| `MAX_CONCURRENT_REQUESTS` | Máximo de peticiones concurrentes | `100` |
| `REQUEST_TIMEOUT` | Timeout de peticiones (ms) | `30000` |

### Configuración de SSL

Para habilitar SSL:

1. Crear directorio para certificados:
```bash
mkdir -p ssl
```

2. Colocar certificados en el directorio `ssl/`:
   - `cert.pem` - Certificado SSL
   - `key.pem` - Clave privada SSL

3. Nginx automáticamente usará estos certificados.

## 📊 Monitoreo y Logging

### Acceso a Grafana

1. Abrar navegador en `http://localhost:3001`
2. Usuario: `admin`
3. Contraseña: La configurada en `GRAFANA_PASSWORD`

### Dashboards Disponibles

- Métricas del Servidor MCP
- Rendimiento de la Base de Datos
- Uso de Redis
- Estadísticas de Nginx
- Métricas de Sistema

### Logs

Los logs se encuentran en:
- `./logs/` - Logs de la aplicación
- `docker-compose logs` - Logs de todos los servicios

## 🔒 Seguridad

### Características de Seguridad

- **SSL/TLS**: Encriptación de comunicación
- **Rate Limiting**: Protección contra abuso
- **CORS**: Control de acceso entre dominios
- **Health Checks**: Monitoreo continuo
- **Firewall**: Reglas de seguridad de red

### Mejores Prácticas

1. **Rotación de Contraseñas**: Cambiar contraseñas regularmente
2. **Monitoreo**: Revisar logs y métricas diariamente
3. **Backups**: Realizar copias de seguridad regulares
4. **Actualizaciones**: Mantener el software actualizado
5. **Acceso Limitado**: Restringir acceso al servidor

## 📈 Escalabilidad

### Escalado Horizontal

Para escalar el servicio:

```bash
# Aumentar el número de instancias
docker-compose up -d --scale mcp-server=3
```

### Configuración de Auto-escalado

En la configuración de cloud provider (AWS, GCP, Azure):

1. Configurar escalado basado en CPU
2. Configurar escalado basado en memoria
3. Configurar escalado basado en peticiones

## 🔄 Backup y Recuperación

### Crear Backup

```bash
# Crear backup completo
npm run backup
```

### Recuperar Backup

```bash
# Detener servicios
npm run stop

# Restaurar backup (manual)
# Restaurar archivos de backup en los volúmenes correspondientes

# Reiniciar servicios
npm run restart
```

## 🚨 Troubleshooting

### Problemas Comunes

1. **Servicios no se inician**:
   ```bash
   # Verificar logs
   npm run logs
   
   # Verificar configuración
   npm run deploy:check
   ```

2. **Conexión a base de datos fallida**:
   ```bash
   # Verificar estado de PostgreSQL
   docker-compose ps postgres
   
   # Verificar logs de PostgreSQL
   docker-compose logs postgres
   ```

3. **Problemas con SSL**:
   ```bash
   # Verificar certificados
   ls -la ssl/
   
   # Verificar configuración de Nginx
   docker-compose logs nginx
   ```

### Comandos Útiles

```bash
# Ver estado de todos los servicios
docker-compose ps

# Ver logs de un servicio específico
docker-compose logs mcp-server

# Reiniciar un servicio
docker-compose restart mcp-server

# Actualizar servicios
docker-compose pull
docker-compose up -d

# Limpiar recursos no utilizados
docker system prune -f
```

## 🌐 Despliegue en Cloud Providers

### AWS

```bash
# Desplegar en AWS ECS
npm run deploy:cloud --provider=aws

# Configurar auto-scaling en AWS
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/cluster-name/service-name \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 5
```

### Google Cloud

```bash
# Desplegar en Google Cloud Run
npm run deploy:cloud --provider=gcp

# Configurar auto-scaling en GCP
gcloud run services update mcp-server \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=1 \
  --max-instances=5
```

### Azure

```bash
# Desplegar en Azure Container Instances
npm run deploy:cloud --provider=azure

# Configurar auto-scaling en Azure
az container create \
  --resource-group myResourceGroup \
  --name mcp-server \
  --image 20i-mcp-server:latest \
  --cpu 1 \
  --memory 1 \
  --restart-policy Never
```

## 📚 Documentación Adicional

- [Documentación Técnica](./docs/README.md)
- [API Reference](./docs/API.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
- [Contributing Guide](./CONTRIBUTING.md)

## 🤝 Soporte

Para soporte técnico:
- Crear un issue en GitHub
- Revisar la documentación
- Contactar al equipo de desarrollo

---

**Nota**: Este despliegue está diseñado para producción. Asegúrate de revisar y ajustar la configuración según tus necesidades específicas.
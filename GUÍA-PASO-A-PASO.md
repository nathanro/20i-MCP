# Guía Paso a Paso para Desplegar tu MCP en Render

## 🎯 **Objetivo**
Desplegar tu servidor MCP de 20i en Render.com con máxima seguridad para tus variables sensibles.

---

## 📋 **Requisitos Previos**

### **1. Credenciales de 20i API**
Necesitas estas credenciales de tu cuenta de 20i:
- `TWENTYI_API_KEY` - Tu API key general
- `TWENTYI_OAUTH_KEY` - Tu OAuth client key  
- `TWENTYI_COMBINED_KEY` - Tu combined API key

### **2. Herramientas Requeridas**
- **Git** (para subir el código a GitHub)
- **Node.js 18+** (para construir el proyecto)
- **Cuenta de GitHub** (para conectar con Render)
- **Cuenta de Render** (gratuito para empezar)

---

## 🔧 **Paso 1: Preparar el Repositorio Local**

### **1.1. Clonar y Preparar el Repositorio**
```bash
# Si aún no lo tienes, clona el repositorio
git clone https://github.com/Cbrown35/20i-MCP.git
cd 20i-MCP

# Instala las dependencias
npm install

# Construye el proyecto
npm run build
```

### **1.2. Configurar Variables de Entorno Locales**
```bash
# Crea un archivo .env.local (NUNCA subas esto a GitHub!)
touch .env.local

# Edita el archivo con tus credenciales de 20i
nano .env.local
```

Agrega esto en `.env.local`:
```bash
# Credenciales de 20i API (¡MUY IMPORTANTE!)
TWENTYI_API_KEY="tu_api_key_aqui"
TWENTYI_OAUTH_KEY="tu_oauth_key_aqui"
TWENTYI_COMBINED_KEY="tu_combined_key_aqui"

# Configuración básica
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
```

### **1.3. Asegurar que .env.local no se suba a GitHub**
```bash
# Abre .gitignore y asegúrate de que .env.local esté incluido
nano .gitignore
```

Asegúrate de tener esto en `.gitignore`:
```
# Environment variables
.env.local
.env.production.local
.env.staging.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

---

## 🚀 **Paso 2: Configurar Render**

### **2.1. Crear Cuenta en Render**
1. **Ve a** [https://render.com](https://render.com)
2. **Haz clic en** "Sign Up"
3. **Usa tu cuenta de GitHub** para registrarte
4. **Verifica tu email**

### **2.2. Conectar GitHub a Render**
1. **En el dashboard de Render**, haz clic en "New +"
2. **Selecciona** "Web Service"
3. **Conecta tu repositorio de GitHub**
4. **Selecciona** el repositorio `20i-MCP`
5. **Haz clic en** "Connect"

---

## 🔒 **Paso 3: Configurar Variables de Entorno Seguras**

### **3.1. Crear Variables en Render Dashboard**
1. **En la página de configuración del servicio**, ve a "Settings"
2. **Haz clic en** "Environment"
3. **Agrega las siguientes variables** (¡IMPORTANTE: marca cada una como "Secure"!):

```bash
# Variables de API de 20i (¡MÁXIMA SEGURIDAD!)
TWENTYI_API_KEY=tu_api_key_real
TWENTYI_OAUTH_KEY=tu_oauth_key_real
TWENTYI_COMBINED_KEY=tu_combined_key_real

# Variables de base de datos
POSTGRES_DB=mcp_server
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=contraseña_segura_32_caracteres

# Variables de Redis
REDIS_PASSWORD=contraseña_redis_segura_32_caracteres

# Variables de aplicación
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
HEALTH_CHECK_ENABLED=true
MONITORING_ENABLED=true
```

**¡IMPORTANTE!** Para cada variable:
1. **Haz clic en** "Add Environment Variable"
2. **Ingresa el nombre** (ej: `TWENTYI_API_KEY`)
3. **Ingresa el valor** (tu API key real)
4. **Marca** la casilla "Secure"
5. **Haz clic en** "Save"

### **3.2. Generar Contraseñas Seguras (si no tienes)**
```bash
# Abre una terminal y genera contraseñas seguras
openssl rand -base64 32 | tr -d '/+' | cut -c1-32
```

Usa esto para `POSTGRES_PASSWORD` y `REDIS_PASSWORD`.

---

## 🏗️ **Paso 4: Configurar el Servicio en Render**

### **4.1. Configuración Básica del Servicio**
En la página de configuración del servicio:

1. **Name**: `20i-mcp-server`
2. **Region**: Elige la región más cercana a tus usuarios
3. **Branch**: `main`
4. **Runtime**: `Docker`
5. **DockerfilePath**: `./Dockerfile`
6. **Docker Context**: `.`

### **4.2. Configuración de Recursos**
- **Instance Type**: `Free` (para empezar) o `Standard` ($7/mes)
- **Instance Count**: `1`
- **CPU**: `1`
- **Memory**: `1Gi`
- **Disk**: `1Gi`

### **4.3. Configuración de Health Check**
- **Health Check Path**: `/health`
- **Health Check Interval**: `30s`
- **Health Check Timeout**: `10s`
- **Health Check Retries**: `3`

### **4.4. Configuración de Despliegue**
- **Auto Deploy**: `Enabled`
- **Branch**: `main`

---

## 🚀 **Paso 5: Desplegar el Servicio**

### **5.1. Subir el Código a GitHub**
```bash
# Asegúrate de que todos los archivos estén en el repositorio
git add .

# Haz commit de los cambios
git commit -m "Configuración para Render con seguridad"

# Sube a GitHub
git push origin main
```

### **5.2. Iniciar el Despliegue en Render**
1. **En Render**, haz clic en "Advanced"
2. **Revisa toda la configuración**
3. **Haz clic en** "Create Web Service"

### **5.3. Esperar a que se Complete el Despliegue**
El despliegue tomará unos minutos. Verás:
- ✅ **Build**: Docker build en progreso
- ✅ **Deploy**: Despliegue del servicio
- ✅ **Live**: Servicio en línea

---

## 🔍 **Paso 6: Verificar el Despliegue**

### **6.1. Verificar que el Servicio está Activo**
1. **En Render**, ve a tu servicio
2. **Deberías ver** "Live" en verde
3. **Copia la URL** del servicio (ej: `https://20i-mcp-server.onrender.com`)

### **6.2. Probar el Health Check**
```bash
# Abre tu navegador o usa curl
curl https://20i-mcp-server.onrender.com/health
```

Deberías ver algo como:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "instances": [...]
}
```

### **6.3. Probar la API**
```bash
# Probar un endpoint básico
curl https://20i-mcp-server.onrender.com/api/20i/list_domains
```

---

## 🛡️ **Paso 7: Verificar Seguridad**

### **7.1. Revisar Logs de Seguridad**
1. **En Render**, ve a tu servicio
2. **Haz clic en** "Logs"
3. **Busca** mensajes de seguridad
4. **Deberías ver** "Security validation passed"

### **7.2. Verificar que Variables no están Expuestas**
1. **En Render**, ve a "Environment"
2. **Revisa** que todas las variables están marcadas como "Secure"
3. **NUNCA** deberías ver los valores reales en los logs

### **7.3. Probar la API con tus Credenciales**
```bash
# El sistema debería usar tus credenciales de forma segura
curl -H "Authorization: Bearer $(echo -n 'tu_api_key' | base64)" \
     https://20i-mcp-server.onrender.com/api/20i/get_reseller_info
```

---

## 📊 **Paso 8: Configurar Monitoreo**

### **8.1. Ver Métricas en Render**
1. **En Render**, ve a tu servicio
2. **Haz clic en** "Metrics"
3. **Deberías ver**:
   - Uso de CPU
   - Uso de memoria
   - Tráfico de red
   - Tiempos de respuesta

### **8.2. Configurar Alertas (Opcional)**
1. **En Render**, ve a "Settings"
2. **Haz clic en** "Alerts"
3. **Configura alertas** para:
   - Uso de CPU > 80%
   - Uso de memoria > 90%
   - Servicio caído

---

## 🔄 **Paso 9: Mantenimiento y Actualizaciones**

### **9.1. Actualizaciones Automáticas**
Render desplegará automáticamente cada vez que hagas `git push` a la rama `main`.

### **9.2. Rotar Contraseñas (Mensualmente)**
```bash
# Genera nuevas contraseñas
openssl rand -base64 32 | tr -d '/+' | cut -c1-32

# Actualiza en Render Dashboard
# 1. Ve a "Environment"
# 2. Actualiza POSTGRES_PASSWORD y REDIS_PASSWORD
# 3. Marca como "Secure"
# 4. Guarda los cambios
```

### **9.3. Revisar Logs Regularmente**
```bash
# Ver logs en tiempo real
render logs 20i-mcp-server --follow
```

---

## 🆘 **Paso 10: Solución de Problemas**

### **10.1. Si el Servicio no se Inicia**
1. **Revisa los logs** en Render
2. **Busca errores** de compilación o dependencias
3. **Verifica** que todas las variables de entorno están configuradas

### **10.2. Si la API no Funciona**
1. **Verifica** que las credenciales de 20i API son correctas
2. **Revisa** los logs en busca de errores de autenticación
3. **Prueba** la API localmente primero

### **10.3. Si hay Problemas de Seguridad**
1. **Inmediatamente** revoca las credenciales en 20i
2. **Cambia** las contraseñas en Render
3. **Monitorea** los logs en busca de accesos no autorizados

---

## 🎉 **¡Felicidades! Tu MCP está en la Nube**

### **Resumen de lo que tienes:**
- ✅ **Servicio MCP de 20i** corriendo en Render
- ✅ **Variables de entorno seguras** protegidas
- ✅ **SSL gratuito** para todas las conexiones
- ✅ **Monitoreo integrado** con métricas
- ✅ **Despliegos automáticos** desde GitHub
- ✅ **Escalado automático** según demanda

### **URLs Importantes:**
- **Servicio Principal**: `https://20i-mcp-server.onrender.com`
- **Health Check**: `https://20i-mcp-server.onrender.com/health`
- **API Endpoint**: `https://20i-mcp-server.onrender.com/api/20i`

### **Próximos Pasos:**
1. **Configura tu AI assistant** (Claude, ChatGPT, etc.) para usar la URL del servicio
2. **Prueba los endpoints** de la API
3. **Monitorea el rendimiento** regularmente
4. **Considera escalar** a más instancias si necesitas más capacidad

---

## 📞 **Soporte**

Si tienes problemas:
1. **Revisa esta guía** paso a paso
2. **Consulta los logs** en Render
3. **Verifica las variables de entorno**
4. **Contacta a soporte de Render** si el problema es con su plataforma

**¡Tu MCP de 20i está listo para usarse con máxima seguridad!**
# Guía de Seguridad para Variables de Entorno

## 🔒 Protección de Variables Sensibles

### **Recomendación: Render vs Back4app**

**Render es la mejor opción** para tu caso porque:
- ✅ **Seguridad empresarial**: Enfoque en seguridad y producción
- ✅ **Variables de entorno seguras**: Sistema robusto de gestión
- ✅ **SSL gratuito**: Certificados automáticos
- ✅ **Monitoreo integrado**: Sin configuración adicional
- ✅ **Escalado automático**: Ideal para producción
- ✅ **Copias de seguridad automáticas**: Protección de datos

**Back4app es mejor para**:
- Aplicaciones móviles (Parse Server)
- Desarrollo rápido con BaaS
- Cuando necesitas MongoDB por defecto

---

## 🛡️ Métodos para Proteger Variables en Render

### **Método 1: Variables de Entorno Seguras (Recomendado)**

#### **Paso 1: Crear Variables en Render Dashboard**

1. **Entra a tu servicio en Render**
2. **Ve a "Settings" → "Environment"**
3. **Agrega variables como "Secure"**:

```bash
# Variables de API de 20i (marcar como Secure)
TWENTYI_API_KEY=your_api_key_here
TWENTYI_OAUTH_KEY=your_oauth_key_here
TWENTYI_COMBINED_KEY=your_combined_key_here

# Variables de base de datos (marcar como Secure)
POSTGRES_DB=mcp_server
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=your_secure_password_here

# Variables de Redis (marcar como Secure)
REDIS_PASSWORD=your_redis_password_here

# Variables de aplicación
NODE_ENV=production
PORT=10000
LOG_LEVEL=info
```

#### **Paso 2: Configurar Variables en .render.yaml**

```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    env: docker
    # ... configuración básica
    envVars:
      # Variables seguras (no sincronizadas con Render)
      - key: TWENTYI_API_KEY
        sync: false
        generateValue: false
      - key: TWENTYI_OAUTH_KEY
        sync: false
        generateValue: false
      - key: TWENTYI_COMBINED_KEY
        sync: false
        generateValue: false
      
      # Variables de base de datos
      - key: POSTGRES_DB
        value: mcp_server
      - key: POSTGRES_USER
        value: mcp_user
      - key: POSTGRES_PASSWORD
        sync: false
        generateValue: false
      
      # Variables de Redis
      - key: REDIS_PASSWORD
        sync: false
        generateValue: false
      
      # Variables de aplicación
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

### **Método 2: Render Secrets Manager (Más Seguro)**

#### **Paso 1: Crear Secrets en Render**

1. **Entra a tu dashboard de Render**
2. **Ve a "Secrets" en el menú lateral**
3. **Crea secrets para cada variable sensible**:

```bash
# Secrets para API de 20i
20I_API_KEY=your_api_key_here
20I_OAUTH_KEY=your_oauth_key_here
20I_COMBINED_KEY=your_combined_key_here

# Secrets para base de datos
POSTGRES_PASSWORD=your_secure_password_here
REDIS_PASSWORD=your_redis_password_here
```

#### **Paso 2: Modificar Código para Leer Secrets**

```typescript
// src/core/client.ts
import axios, { AxiosInstance } from 'axios';
import { ApiCredentials } from './types.js';
import { handleApiError, validateApiResponse } from './errors.js';

export class TwentyIClient {
  public readonly apiClient: AxiosInstance;
  private readonly credentials: ApiCredentials;

  constructor() {
    // Leer desde Render Secrets Manager
    this.credentials = this.loadCredentialsFromSecrets();
    
    const authHeader = `Bearer ${Buffer.from(this.credentials.apiKey).toString('base64')}`;
    
    this.apiClient = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
      // ... resto de configuración
    });
  }

  private loadCredentialsFromSecrets(): ApiCredentials {
    // Leer desde variables de entorno (gestionadas por Render Secrets)
    return {
      apiKey: process.env.TWENTYI_API_KEY || process.env['20I_API_KEY']!,
      oauthKey: process.env.TWENTYI_OAUTH_KEY || process.env['20I_OAUTH_KEY']!,
      combinedKey: process.env.TWENTYI_COMBINED_KEY || process.env['20I_COMBINED_KEY']!,
    };
  }
}
```

### **Método 3: Variables Encriptadas (Máxima Seguridad)**

#### **Paso 1: Generar Clave de Encriptación**

```bash
# Generar clave de encriptación (guardar en lugar seguro)
openssl rand -hex 32 > encryption_key.txt
chmod 600 encryption_key.txt
```

#### **Paso 2: Encriptar Variables**

```bash
# Encriptar cada variable
echo "your_api_key_here" | openssl enc -aes-256-cbc -salt -pass file:encryption_key.txt -base64 > encrypted_api_key.txt
echo "your_password_here" | openssl enc -aes-256-cbc -salt -pass file:encryption_key.txt -base64 > encrypted_password.txt
```

#### **Paso 3: Guardar Variables Encriptadas en Render**

```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    env: docker
    envVars:
      # Variables encriptadas
      - key: ENCRYPTED_API_KEY
        value: U2FsdGVkX1+... (contenido del archivo encriptado)
      - key: ENCRYPTED_PASSWORD
        value: U2FsdGVkX1+... (contenido del archivo encriptado)
      - key: ENCRYPTION_KEY
        sync: false  # No sincronizar, configurar manualmente
```

#### **Paso 4: Modificar Código para Desencriptar**

```typescript
// src/core/security.ts
import crypto from 'crypto';

export class SecurityManager {
  private static readonly ALGORITHM = 'aes-256-cbc';
  
  static decrypt(encryptedText: string, key: string): string {
    try {
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift()!, 'hex');
      const encryptedText = textParts.join(':');
      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        Buffer.from(key, 'hex'),
        iv
      );
      let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }
}

// src/core/client.ts
export class TwentyIClient {
  constructor() {
    this.credentials = this.loadEncryptedCredentials();
  }

  private loadEncryptedCredentials(): ApiCredentials {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Encryption key not found');
    }

    return {
      apiKey: SecurityManager.decrypt(
        process.env.ENCRYPTED_API_KEY!, 
        encryptionKey
      ),
      oauthKey: SecurityManager.decrypt(
        process.env.ENCRYPTED_OAUTH_KEY!, 
        encryptionKey
      ),
      combinedKey: SecurityManager.decrypt(
        process.env.ENCRYPTED_COMBINED_KEY!, 
        encryptionKey
      ),
    };
  }
}
```

---

## 🔐 Mejores Prácticas de Seguridad

### **1. Jerarquía de Variables**

```yaml
# .render.yaml
envVars:
  # Variables públicas (seguras para mostrar en logs)
  - key: NODE_ENV
    value: production
  - key: PORT
    value: 10000
  - key: LOG_LEVEL
    value: info
  
  # Variables semi-sensibles (requieren protección)
  - key: POSTGRES_DB
    value: mcp_server
  - key: POSTGRES_USER
    value: mcp_user
  
  # Variables sensibles (requieren máxima protección)
  - key: TWENTYI_API_KEY
    sync: false
  - key: TWENTYI_OAUTH_KEY
    sync: false
  - key: TWENTYI_COMBINED_KEY
    sync: false
  - key: POSTGRES_PASSWORD
    sync: false
```

### **2. Rotación de Contraseñas**

```bash
# Script para rotar contraseñas (ejecutar mensualmente)
#!/bin/bash

# Generar nueva contraseña
NEW_PASSWORD=$(openssl rand -base64 32)

# Actualizar en Render
render env 20i-mcp-server POSTGRES_PASSWORD="$NEW_PASSWORD"

# Actualizar Redis si es necesario
render env 20i-mcp-server REDIS_PASSWORD="$NEW_PASSWORD"

echo "Passwords rotated successfully"
```

### **3. Monitoreo de Seguridad**

```typescript
// src/core/security-monitor.ts
export class SecurityMonitor {
  static checkEnvironmentSecurity(): void {
    const sensitiveVars = [
      'TWENTYI_API_KEY',
      'TWENTYI_OAUTH_KEY', 
      'TWENTYI_COMBINED_KEY',
      'POSTGRES_PASSWORD',
      'REDIS_PASSWORD'
    ];

    const warnings: string[] = [];

    sensitiveVars.forEach(varName => {
      const value = process.env[varName];
      if (!value) {
        warnings.push(`Missing environment variable: ${varName}`);
      } else if (value.length < 16) {
        warnings.push(`Weak password for: ${varName}`);
      } else if (value === 'password' || value === '123456') {
        warnings.push(`Insecure password for: ${varName}`);
      }
    });

    if (warnings.length > 0) {
      console.warn('Security issues detected:', warnings);
    } else {
      console.log('All environment variables are secure');
    }
  }
}
```

### **4. Auditoría de Acceso**

```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    # ... configuración básica
    envVars:
      # Variables de auditoría
      - key: SECURITY_AUDIT_LOG
        value: "true"
      - key: SECURITY_LOG_LEVEL
        value: "detailed"
```

---

## 🚨 Configuración de Seguridad en Render

### **1. Configuración de Red**

```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    # ... configuración básica
    network:
      # Restringir acceso a IPs específicas
      inbound:
        - type: http
          port: 80
          allowedIps:
            - "192.168.1.0/24"
            - "10.0.0.0/8"
        - type: https
          port: 443
          allowedIps:
            - "192.168.1.0/24"
            - "10.0.0.0/8"
```

### **2. Configuración de SSL**

```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    # ... configuración básica
    ssl:
      enabled: true
      type: letsencrypt
      email: your-security-email@example.com
      autoRenew: true
      forceRenew: false
```

### **3. Configuración de Rate Limiting**

```yaml
# .render.yaml
services:
  - type: web
    name: 20i-mcp-server
    # ... configuración básica
    rateLimit:
      enabled: true
      requestsPerMinute: 60
      burst: 10
      window: "1m"
```

---

## 📋 Checklist de Seguridad

### **Antes del Despliegue**
- [ ] Todas las variables sensibles están marcadas como "Secure"
- [ ] Las contraseñas tienen al menos 16 caracteres
- [ ] Las contraseñas no son palabras comunes
- [ ] Las variables de entorno no están en el código fuente
- [ ] El archivo .env está en .gitignore

### **Después del Despliegue**
- [ ] Verificar que las variables no aparecen en logs públicos
- [ ] Configurar monitoreo de seguridad
- [ ] Probar el acceso con las nuevas credenciales
- [ ] Configurar alertas para cambios no autorizados

### **Mantenimiento Mensual**
- [ ] Rotar contraseñas de base de datos
- [ ] Revisar logs de seguridad
- [ ] Actualizar dependencias de seguridad
- [ ] Probar procedimientos de recuperación

---

## 🆘 Emergencia de Seguridad

### **Si las variables se exponen:**

1. **Inmediatamente**:
   ```bash
   # Revocar credenciales en 20i
   # Cambiar contraseñas en Render
   render env 20i-mcp-server POSTGRES_PASSWORD="new_secure_password"
   ```

2. **Monitoreo**:
   ```bash
   # Revisar logs en busca de accesos no autorizados
   render logs 20i-mcp-server --follow
   ```

3. **Notificación**:
   - Contactar a soporte de Render
   - Notificar a usuarios afectados
   - Documentar el incidente

---

**Conclusión**: Render ofrece las mejores opciones para proteger tus variables sensibles con su sistema de "Secure Environment Variables" y "Secrets Manager". La combinación de estos métodos con buenas prácticas de seguridad garantizará que tus credenciales de 20i API y base de datos estén completamente protegidas.
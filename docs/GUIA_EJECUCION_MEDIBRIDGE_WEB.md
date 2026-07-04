# Guia de ejecucion MediBridge Web

Esta guia explica como levantar el backend de MediBridge y probar la web clinica React.

Proyecto web:

```text
C:\Users\Sebas\IdeaProjects\MEDIBRIDGE-APP-WEB
```

Proyecto backend:

```text
C:\Users\Sebas\IdeaProjects\medibridge\medibridge.microservices
```

La web consume el backend solo por API Gateway:

```text
http://localhost:8080
```

## 1. Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Docker Desktop activo.
- Java 21 solo si vas a correr microservicios con Maven en vez de Docker.

Validar versiones:

```powershell
node --version
npm --version
docker --version
```

## 2. Variables del front

Archivo del front:

```text
C:\Users\Sebas\IdeaProjects\MEDIBRIDGE-APP-WEB\.env
```

Contenido esperado:

```env
VITE_API_BASE_URL=http://localhost:8080
```

No agregues `X-Internal-Token` desde React. Ese header lo agrega el API Gateway cuando llama a los microservicios.

## 3. Levantar backend completo

### 3.1 Configurar Stripe para Payments

`payments-service` lee sus credenciales desde:

```text
C:\Users\Sebas\IdeaProjects\medibridge\medibridge.microservices\docker\.env
```

Ese archivo debe existir con:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

Como obtener `STRIPE_SECRET_KEY`:

1. Entra a Stripe Dashboard.
2. Abre `Developers > API keys`.
3. Usa modo test/sandbox.
4. Copia la secret key de prueba. Debe empezar con `sk_test_`.
5. No uses la publishable key `pk_test_`; esa no sirve para el backend.

Como obtener `STRIPE_WEBHOOK_SECRET` en desarrollo local:

```powershell
stripe login
stripe listen --forward-to http://localhost:8083/api/v1/stripe-webhooks
```

El comando muestra un valor que empieza con `whsec_`. Copialo en `docker\.env`.

Referencias oficiales:

```text
https://docs.stripe.com/keys
https://docs.stripe.com/cli/listen
https://docs.stripe.com/webhooks
```

Si cambias `docker\.env`, recrea Payments y el Gateway:

```powershell
cd C:\Users\Sebas\IdeaProjects\medibridge\medibridge.microservices
docker compose --env-file docker\.env -f docker\docker-compose.yml up -d --build --force-recreate payments-service api-gateway
```

### 3.2 Levantar servicios

Recomendado para probar la web: levantar todo el backend con Docker.

Desde la raiz del backend:

```powershell
cd C:\Users\Sebas\IdeaProjects\medibridge\medibridge.microservices
docker compose --env-file docker\.env -f docker\docker-compose.yml up -d --build
```

Validar contenedores:

```powershell
docker compose --env-file docker\.env -f docker\docker-compose.yml ps
```

Servicios esperados:

```text
postgres
rabbitmq
mongodb
iam-service
profiles-service
payments-service
appointments-service
healthmonitoring-service
medication-service
reports-analytics-service
communication-service
api-gateway
```

Validar API Gateway:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
```

Abrir Swagger consolidado:

```text
http://localhost:8080/swagger-ui.html
```

## 4. Logs y reinicio del backend

Ver logs del gateway:

```powershell
docker compose --env-file docker\.env -f docker\docker-compose.yml logs -f api-gateway
```

Ver logs de un microservicio:

```powershell
docker compose --env-file docker\.env -f docker\docker-compose.yml logs -f iam-service
docker compose --env-file docker\.env -f docker\docker-compose.yml logs -f profiles-service
docker compose --env-file docker\.env -f docker\docker-compose.yml logs -f medication-service
```

Recrear sin borrar datos:

```powershell
docker compose --env-file docker\.env -f docker\docker-compose.yml up -d --build --force-recreate --remove-orphans
```

Apagar backend:

```powershell
docker compose --env-file docker\.env -f docker\docker-compose.yml down
```

Apagar y borrar datos locales:

```powershell
docker compose --env-file docker\.env -f docker\docker-compose.yml down -v
```

Usa `down -v` solo si puedes perder la data local de PostgreSQL, MongoDB y RabbitMQ.

## 5. Instalar y correr el front

Desde el proyecto web:

```powershell
cd C:\Users\Sebas\IdeaProjects\MEDIBRIDGE-APP-WEB
npm install
npm run dev
```

Vite mostrara una URL similar:

```text
http://localhost:5173
```

Si necesitas forzar host y puerto:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Abrir:

```text
http://127.0.0.1:5173
```

## 6. Validar calidad del front

Lint:

```powershell
npm run lint
```

Build:

```powershell
npm run build
```

Preview de build:

```powershell
npm run preview
```

## 7. Flujo recomendado para probar la web

### 7.1 Crear cuenta medica

En la web:

```text
/register
```

Datos sugeridos:

```text
username: doctor@test.com
password: Password123!
```

El front registra el usuario con:

```json
{
  "username": "doctor@test.com",
  "password": "Password123!",
  "roles": ["ROLE_USER"]
}
```

Despues intenta iniciar sesion y redirige a:

```text
/onboarding/doctor
```

### 7.2 Crear perfil medico

En `Onboarding doctor`, crear:

```text
fullName: Dra. Demo
```

El backend asocia el `DoctorProfile` al usuario autenticado por JWT.

El front guarda el perfil medico en local storage y no permite entrar al resto de la app hasta que exista.

### 7.3 Crear suscripcion institucional

En la web:

```text
/subscriptions
```

Plan sugerido:

```text
INSTITUTION_BASIC
MONTHLY
```

Si aparece `Your API key is invalid, as it is an empty string`, falta `STRIPE_SECRET_KEY` en `docker\.env` o no recreaste `payments-service`.

### 7.4 Crear paciente

En la web:

```text
/patients/new
```

Datos sugeridos:

```text
fullName: Paciente Geriatrico Demo
```

La web crea el paciente y, si ya existe perfil medico activo, intenta asignar el doctor al paciente.

### 7.5 Abrir paciente existente

Si ya tienes un `patientId`, abrir:

```text
/patients
```

Ingresa el numero de paciente y presiona `Abrir`.

Como el backend aun no tiene endpoint publico para listar pacientes por usuario, la web mantiene pacientes recientes en local storage.

### 7.6 Probar citas

Ruta:

```text
/patients/{patientId}/appointments
```

Crear cita con:

```text
startsAt: fecha local
durationInMinutes: 45
reason: Control geriatrico
```

### 7.7 Probar medicacion

Ruta:

```text
/patients/{patientId}/medications
```

Flujo:

1. Registrar medicamento.
2. Crear horario.
3. Registrar dosis o saltar dosis.
4. Actualizar stock.

Ejemplo de medicamento:

```text
name: Losartan
dosageAmount: 50
dosageUnit: MG
administrationRoute: ORAL
stockQuantity: 20
lowStockThreshold: 5
expirationDate: 2027-01-01
```

### 7.8 Probar monitoreo clinico

Ruta:

```text
/patients/{patientId}/health
```

Registrar observacion:

```text
systolicBloodPressure: 160
diastolicBloodPressure: 95
bodyTemperature: 37.8
painLevel: 4
emotionalState: CONFUSED
clinicalNotes: Controlar presion arterial
```

Health Monitoring es premium. Si devuelve `403`, revisa que el usuario tenga suscripcion institucional activa y pertenezca al care team.

### 7.9 Probar reportes y analitica

Rutas:

```text
/patients/{patientId}/reports
/patients/{patientId}/analytics
```

Para generar reporte:

```text
reportType: FULL_CLINICAL
startDate: 2026-07-01
endDate: 2026-07-31
```

Reports tambien es premium. Si devuelve `403`, valida suscripcion y care team.

### 7.10 Probar chat

Ruta:

```text
/chat
```

Pasos:

1. Presiona `Conectar`.
2. Ingresa un `Recipient User ID`.
3. Abre conversacion.
4. Envia mensaje.

Communication no requiere premium.

### 7.11 Probar notificaciones

Ruta:

```text
/notifications
```

La web consulta:

```text
GET /api/v1/notifications/recipients/{userId}
GET /api/v1/notifications/recipients/{userId}/unread
PATCH /api/v1/notifications/{notificationId}/read
```

## 8. Comandos rapidos de smoke test

Backend arriba:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
```

Swagger gateway:

```text
http://localhost:8080/swagger-ui.html
```

Front dev:

```powershell
cd C:\Users\Sebas\IdeaProjects\MEDIBRIDGE-APP-WEB
npm run dev
```

Front build:

```powershell
npm run lint
npm run build
```

## 9. Problemas comunes

### La web devuelve Network Error

Verifica que el gateway este arriba:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
```

Verifica `.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Si cambias `.env`, reinicia Vite.

### Login devuelve 404 o 401

Revisa `iam-service`:

```powershell
docker compose --env-file docker\.env -f docker\docker-compose.yml logs --tail=120 iam-service
```

Si recreaste IAM, inicia sesion de nuevo porque los tokens anteriores pueden quedar invalidos.

### Crear doctor o asignar doctor devuelve 401

El endpoint usa el JWT para identificar al usuario. Cierra sesion y vuelve a iniciar sesion en la web.

### Asignar doctor devuelve 403

El doctor necesita suscripcion institucional activa.

### Crear suscripcion devuelve error de Stripe

Revisa:

- `docker\.env` existe dentro de la carpeta `docker`.
- `STRIPE_SECRET_KEY` empieza con `sk_test_`.
- `payments-service` fue recreado despues de cambiar `.env`.
- No pegaste la publishable key `pk_test_` como secret key.

### Health o Reports devuelve 403

Revisa:

- Usuario autenticado pertenece al care team del paciente.
- Usuario tiene suscripcion institucional activa.
- Estas entrando por API Gateway, no por puertos internos.

### No aparecen pacientes al listar

Actualmente no existe endpoint publico backend para listar pacientes accesibles por usuario. La web permite abrir por numero de paciente y guarda recientes localmente.

### El gateway no expone endpoints internos

El gateway bloquea:

```text
/api/v1/internal/**
```

La web no debe llamar endpoints internos. Los microservicios los usan entre ellos con `X-Internal-Token`.

## 10. Referencias backend

Guia base del frontend/backend:

```text
C:\Users\Sebas\IdeaProjects\medibridge\medibridge.microservices\docs\GUIA_FRONTEND_MEDIBRIDGE.md
```

Guia completa de test backend:

```text
C:\Users\Sebas\IdeaProjects\medibridge\medibridge.microservices\docs\GUIA_TESTEO_BACKEND_DOCKER_SWAGGER.md
```

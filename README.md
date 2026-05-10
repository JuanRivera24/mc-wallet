# 🍔 MCWallet - Advanced Payroll Ecosystem
> **Sistema Inteligente de Gestión y Auditoría de Nómina para Colaboradores (Arcos Dorados Colombia)**

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)

---
https://mc-wallet-three.vercel.app
---

## 📝 Visión General
**MCWallet** es una solución robusta y de grado empresarial desarrollada para resolver la opacidad en los cálculos de nómina del sector de servicio rápido. Esta plataforma permite a los empleados (Crew y Entrenadores) realizar un seguimiento milimétrico de sus jornadas laborales, garantizando que cada minuto trabajado sea remunerado según la estricta legislación laboral colombiana vigente para el año **2026**.

La aplicación no solo calcula el salario neto, sino que procesa turnos complejos (cruces de medianoche, cortes de quincena), audita recargos minuto a minuto, gestiona la persistencia de datos en la nube mediante Firestore y ofrece una experiencia de usuario (UX) de nivel premium que se siente y se comporta exactamente como una app nativa.

---

## 🔥 Funcionalidades Core (Detallado)

### 🧠 Motor de Cálculo Salarial (El Cerebro)
El algoritmo principal (`calculateShift`) abandona los cálculos genéricos por hora e implementa un potente **motor de iteración minuto a minuto** para precisión absoluta:
* **Segmentación Estricta:** Clasificación automática del tiempo trabajado iterando y evaluando cada minuto contra la ley (Diurnas de 6:00 a.m. a 7:00 p.m., Nocturnas de 7:00 p.m. a 6:00 a.m.) en 8 categorías de pago distintas.
* **Gestor Dinámico de Quincenas:** Lógica algorítmica (`getQuincenaKey`) que detecta automáticamente cuando un turno nocturno cruza la medianoche hacia el día 16 o el día 1 del mes, dividiendo matemáticamente el turno y el pago en dos documentos separados (`_split`) para asegurar que cada fracción caiga en la quincena fiscal correcta.
* **Smart Break System:** Cálculo automático del descanso legal (30 mins si el turno > 5.5 horas), combinado con un sistema de sobreescritura manual que valida estrictamente que el break ingresado no se salga de los límites del turno.
* **Bono Extralegal Inyectado:** Lógica condicional para evaluar la hora exacta de salida (ej. 00:01 a 04:59 a.m.) y asignar automáticamente el auxilio extra legal de transporte ($5.000).
* **Gestión de Horas Extra Combinadas:** Cruzamiento de umbrales en tiempo real (>480 minutos), aplicando multiplicadores complejos (ej. Extra Festiva Nocturna) automáticamente sin intervención del usuario.

### 🎨 Interfaz y Experiencia de Usuario Nativa (UX/UI)
* **Tematización por Rol (ThemeContext):** La UI muta sus colores dinámicamente (tonos azules para Crew, tonos rojos para Entrenadores) inyectando variables a través del contexto global y Tailwind.
* **Micro-interacciones y Framer Motion:** Uso extensivo de físicas de resorte (`useSpring`) para efectos como el Spotlight del mouse, animaciones de entrada escalonada (`staggerChildren`) y botones CTA con respiración suave y reflejos de luz ("shimmer").
* **Gestos Nativos y Anti-Conflicto:** Implementación de un sistema de información legal desplegable mediante un cronómetro de *doble clic personalizado (800ms)*. Todo el bloque está protegido con la propiedad `select-none` para evitar los molestos sombreados azules nativos del navegador al tapear rápidamente en pantallas táctiles.
* **Neobrutalismo y Backlights Temporales:** Elementos flotantes con CSS `box-shadow` sólido y luces de neón traseras atadas a temporizadores en React (la luz se enciende al expandir y se apaga suavemente a los 2 segundos para no saturar la vista).

### ⚡ Productividad, Persistencia y Performance
* **Sistema de Portapapeles (Clipboard):** Herramienta integrada ágil (Copiar, Cortar, Pegar, Reset) que lee y escribe en el `localStorage` (`mc_shift_clipboard`), permitiendo al usuario duplicar patrones de turnos recurrentes en segundos.
* **Validación de Sobreescritura (Firestore):** Antes de guardar, la app consulta la base de datos en tiempo real. Si detecta un turno preexistente en la misma fecha, pausa el flujo y despliega una interfaz de confirmación (`showOverwriteConfirm`) para prevenir pérdida accidental de datos.
* **Firebase Offline Cache:** Implementación de persistencia local de datos (`persistentLocalCache`) para permitir la revisión de nóminas anteriores sin conexión y reducir en un 90% el costo de lecturas a la base de datos.
* **Renderizado Seguro (SSR Sync):** Estrategias de control de hidratación (`suppressHydrationWarning` y renderizado condicional con `mounted`) para evitar colisiones entre el servidor de Vercel y el cliente móvil, garantizando que componentes complejos como Chart.js y fechas locales carguen a la perfección.

---

## 🛠️ Stack Tecnológico
* **Frontend Core:** Next.js 14+ (App Router), React 18, TypeScript.
* **Estilos y UI:** Tailwind CSS, Framer Motion (Animaciones complejas, gestos).
* **Base de Datos & Backend:** Google Firebase Firestore (Documentos noSQL, `serverTimestamp`).
* **Autenticación y Sesiones:** Clerk Auth (Integración modal OAuth y protección de rutas).
* **Manejo de Fechas:** Lógica nativa de JS y utilidades de `date-fns`.
* **Visualización de Datos:** Chart.js con `react-chartjs-2`.

---

## 📖 Guía de Operación

### Para el Usuario Final
1.  **Registro y Simulación:** * Ingresa a la "Calculadora Rápida" en el Home para estimaciones sin compromiso.
    * Si el turno es recurrente, usa el menú "⋮" para copiar los horarios y pegarlos en tu próximo registro.
2.  **Educación Laboral:** * Dirígete a la sección de Tarifas y realiza un **doble toque** sobre cualquier tarjeta de horas (ej. Dominicales) para iluminar la tarjeta y desplegar una explicación legal sobre tus derechos laborales de forma interactiva.
3.  **Auditoría de Pago:** * Al guardar el turno, la app se encarga de partirlo si cruza la medianoche en día de pago.
    * Despliega el panel en "Mis Nóminas" para auditar contra tu desprendible de pago y revisar cuántos minutos exactos te contaron como nocturnos o extra.

### Para el Desarrollador
1.  **Variables de Entorno:** Configura `.env.local` con las credenciales de Firebase y Clerk (Publishable Key y Secret).
2.  **Instalación:** Ejecuta `npm install`.
3.  **Ambiente Local:** `npm run dev` (Disponible en `localhost:3000`).
4.  **Despliegue:** Proyecto acoplado y optimizado para **Vercel** sin configuraciones adicionales.

---

## 🗺️ Roadmap de Desarrollo
- [x] Motor de cálculo minucioso con soporte para cortes de medianoche (`getQuincenaKey`).
- [x] Implementación de Modo Oscuro "True Black" y temas por rol.
- [x] Interfaz táctil optimizada (Smart Dock móvil y gestos de doble clic).
- [x] Portapapeles inteligente integrado en la calculadora.
- [ ] **Conversión a PWA:** Soporte Offline total, permitiendo guardar turnos sin internet y sincronizar al reconectar, más icono de instalación.
- [ ] **Feedback Háptico:** Uso de `Navigator.vibrate()` para micro-vibraciones al guardar exitosamente o expandir tarjetas.
- [ ] **Notificaciones Inteligentes:** Alertas push recordatorias ("En 2 horas comienza tu turno") utilizando Service Workers y la Notification API.
- [ ] Exportación de reportes quincenales a PDF.

---

## 🛡️ Seguridad y Privacidad
MCWallet delega la seguridad criptográfica a **Clerk**, garantizando un manejo de sesiones robusto y sin contraseñas vulnerables. La base de datos de Firebase está fortificada mediante Reglas de Seguridad de Firestore de estricto cumplimiento: cada documento inyecta el ID del usuario de Clerk y las reglas aseguran que las lecturas y escrituras solo sean posibles si `request.auth.uid == resource.data.userId`. Absolutamente nadie, ni siquiera el administrador de la plataforma, tiene acceso a la información financiera de otro colaborador.

---
**Desarrollado con ❤️ por un Crew para el equipo de Arcos Dorados.**

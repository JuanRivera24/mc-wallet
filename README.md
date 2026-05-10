# 🍔 MCWallet - Advanced Payroll Ecosystem
> **Sistema Inteligente de Gestión y Auditoría de Nómina para Colaboradores (Arcos Dorados Colombia).**

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

## 🔥 Arquitectura Core: Las 3 Bestias (Deep Dive)

La aplicación está sostenida por tres pilares fundamentales que manejan toda la lógica de negocio, recolección de datos y visualización:

### 1. El Core Algorítmico (`lib/calculator.ts`)
No es una simple calculadora de diferencias de tiempo; es un motor de procesamiento cronológico diseñado para evitar cualquier desfase legal o de redondeo.
* **Iteración Minuto a Minuto (`while current < end`):** El algoritmo descompone el turno en minutos. Para cada iteración, evalúa el contexto temporal exacto: ¿Es festivo hoy? ¿La hora actual es nocturna (>=19h o <6h)? ¿Ya superamos el umbral de las 8 horas (480 min) para cobrar recargo extra? Esto permite cálculos matemáticamente perfectos incluso en turnos híbridos.
* **Gestor Dinámico de Quincenas (`getQuincenaKey`):** Lógica avanzada que detecta cuando un turno cruza la medianoche hacia un día de corte fiscal (del 15 al 16, o del último día del mes al día 1). Automáticamente, el motor divide el resultado en un `Array` de dos bloques financieros distintos, asegurando que los minutos de la madrugada caigan en la siguiente nómina.
* **Smart Break System:** Inyecta espacios muertos de tiempo que no contabilizan para el pago ni para el umbral de horas extra, ya sea generados algorítmicamente (automático al centro del turno) o superpuestos manualmente por el usuario validando los límites (bounds) del turno.
* **Acumuladores Monetarios y de Tiempo:** Mapeo exhaustivo de 8 variables independientes (ej. `mOrdD`, `pOrdD`) que separan la cuenta de minutos físicos de la bolsa de dinero, previniendo errores de punto flotante en JavaScript hasta el redondeo final.

### 2. El Puente Interactivo (`ShiftCalculator.tsx`)
Este componente es el cerebro del frontend. Conecta la interfaz de usuario con el motor de cálculo y la base de datos de manera atómica.
* **Validación de Sobreescritura (Collision Detection):** Antes de ejecutar un guardado en la nube, el componente hace un "peek" a Firestore comprobando la tupla `userId_date`. Si detecta un turno preexistente, congela la UI y exige confirmación del usuario para evitar pérdida de datos.
* **Multi-Document Writes (Split Shifts):** Cuando el motor de cálculo devuelve un turno fraccionado por cruzar una quincena, el componente ejecuta un mapeo concurrente (`Promise.all`), guardando el fragmento base y el fragmento `_split` de forma asíncrona, inyectando meta-datos vitales como el mes, año y el identificador `isSplitPart`.
* **Portapapeles Interno Dinámico:** Implementación de un menú de herramientas avanzadas (`localStorage`) que permite Copiar, Cortar, Pegar y Resetear patrones de turnos recurrentes, inyectando los datos parseados directamente en los estados de React, reduciendo el tiempo de ingreso de datos a dos clics.

### 3. El Agregador Financiero (`Mis Nóminas / Dashboard`)
El módulo encargado de la lectura masiva, agregación y visualización del esfuerzo acumulado del usuario.
* **Filtros Indexados y Aggregation Functions:** Lee desde Firebase utilizando consultas estructuradas por usuario y fecha. Procesa el array masivo de turnos y recalcula totales en vivo: Salario Base, Auxilios de Transporte (incluyendo validación del bono extralegal de $5.000 de madrugada) y Deducciones (4% Salud y 4% Pensión del IBC acumulado).
* **Smart Reset y Jerarquía Visual:** Integrado con el *Smart Mobile Dock*, este panel sabe si el usuario interactúa desde móvil o desktop. Renderiza tarjetas detalladas por cada día, marcando visualmente si un turno pertenece a la quincena actual o si es un "huérfano" de un turno partido de la quincena anterior.

---

## 🎨 Interfaz y Experiencia de Usuario Nativa (UX/UI)
* **Tematización por Rol (ThemeContext):** La UI muta sus colores dinámicamente (tonos azules para Crew, tonos rojos para Entrenadores) inyectando variables a través del contexto global y Tailwind.
* **Micro-interacciones y Framer Motion:** Uso extensivo de físicas de resorte (`useSpring`) para efectos como el Spotlight del mouse, animaciones de entrada escalonada (`staggerChildren`) y botones CTA con respiración suave y reflejos de luz ("shimmer").
* **Gestos Nativos y Anti-Conflicto:** Implementación de un sistema de información legal desplegable en las tarifas mediante un cronómetro de *doble clic personalizado (800ms)* protegido con `select-none` para evitar sombreados azules nativos en pantallas táctiles.
* **Neobrutalismo y Backlights Temporales:** Elementos flotantes con CSS `box-shadow` sólido y luces de neón traseras atadas a temporizadores en React (la luz se enciende al expandir y se apaga suavemente a los 2 segundos para no saturar la vista).

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

### Para el Desarrollador
1.  **Variables de Entorno:** Configura `.env.local` con las credenciales de Firebase y Clerk (Publishable Key y Secret).
2.  **Instalación:** Ejecuta `npm install`.
3.  **Ambiente Local:** `npm run dev` (Disponible en `localhost:3000`).
4.  **Despliegue:** Proyecto acoplado y optimizado para **Vercel** sin configuraciones adicionales.

---

## 🗺️ Roadmap de Desarrollo
- [x] Motor de cálculo minucioso con partición matemática de quincenas.
- [x] Implementación de Modo Oscuro "True Black" y UI/UX Neobrutalista.
- [x] Prevención de Errores de Hidratación (SSR Sync).
- [x] Portapapeles inteligente integrado en la UI de cálculo.
- [ ] **Conversión a PWA:** Soporte Offline total (Service Workers), permitiendo guardar turnos sin internet y sincronizar al reconectar.
- [ ] **Feedback Háptico:** Uso de la Web Vibration API para micro-vibraciones al guardar exitosamente o expandir tarjetas legales.
- [ ] **Notificaciones Inteligentes:** Alertas push recordatorias ("En 2 horas comienza tu turno") y avisos de días de pago.
- [ ] Exportación de reportes quincenales completos a PDF.

---

## 🛡️ Seguridad y Privacidad
MCWallet delega la seguridad criptográfica a **Clerk**, garantizando un manejo de sesiones robusto. La base de datos de Firebase está fortificada mediante Reglas de Seguridad de Firestore de estricto cumplimiento: cada documento inyecta el ID del usuario de Clerk y las reglas aseguran que las lecturas y escrituras solo sean posibles si `request.auth.uid == resource.data.userId`. La información salarial es 100% privada y cifrada.

---
**Desarrollado con ❤️ por un Crew para el equipo de Arcos Dorados.**
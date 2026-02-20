# 🍔 MCWallet - Advanced Payroll Ecosystem
> **Sistema Inteligente de Gestión y Auditoría de Nómina para Colaboradores (Arcos Dorados Colombia)**

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white)

---

## 📝 Visión General
**MCWallet** es una solución robusta desarrollada para resolver la opacidad en los cálculos de nómina del sector de servicio rápido. Esta plataforma permite a los empleados (Crew) realizar un seguimiento milimétrico de sus jornadas laborales, garantizando que cada segundo trabajado sea remunerado según la legislación laboral colombiana vigente para el año **2026**.

La aplicación no solo calcula el salario neto, sino que audita recargos, gestiona la persistencia de datos en la nube y ofrece una experiencia de usuario (UX) de nivel premium tanto en desktop como en dispositivos móviles.

---

## 🔥 Funcionalidades Core (Detallado)

### 🧠 Motor de Cálculo Salarial (El Cerebro)
El algoritmo de cálculo es el corazón de MCWallet, diseñado para procesar variables complejas en tiempo real:
* **Segmentación de Horas:** Clasificación automática de horas en 8 categorías diferentes (Diurnas, Nocturnas, Dominicales, Extras, etc.).
* **Gestión de Recargos:** Aplicación de porcentajes legales sobre el valor de la hora base según el rol del usuario.
* **Subsidio de Transporte:** Cálculo proporcional según los días laborados y el cumplimiento de la normativa de ley.
* **Deducciones Automáticas:** Cálculo preciso de aportes a Salud y Pensión (4% cada uno) sobre el IBC (Ingreso Base de Cotización).
* **Extra Transportation Allowance:** Soporte para recargos especiales en jornadas que finalizan en horarios de difícil movilidad (madrugada).

### 🎨 Interfaz y Experiencia de Usuario (UX/UI)
* **Modo Oscuro "True Black":** Optimizado para pantallas OLED, reduciendo el consumo de batería y la fatiga visual.
* **Navegación Fluida (Mobile Sync):** Sistema de estados sincronizado con el historial del navegador (`pushState`), permitiendo el uso del botón físico de "Atrás" en smartphones sin cerrar la aplicación.
* **Calendario Inteligente:** Componente personalizado que distingue visualmente los estados de la nómina mediante códigos de colores y opacidades dinámicas para días de otras quincenas.

### ⚡ Optimización de Datos y Performance
* **Firebase Persistence:** Implementación de `persistentLocalCache` para permitir el funcionamiento offline y reducir las lecturas de base de datos en un 90%.
* **Consultas Indexadas:** Filtrado de datos a nivel de servidor por `userId` y `year`, asegurando que la app escale sin degradar el rendimiento.
* **Arquitectura Singleton:** Gestión eficiente de instancias de Firebase para evitar fugas de memoria y errores de re-inicialización en entornos de desarrollo rápido.

---

## 🛠️ Stack Tecnológico
* **Frontend:** Next.js 14+ (App Router) con TypeScript.
* **Base de Datos Real-time:** Google Firebase Firestore.
* **Autenticación:** Clerk Auth (OAuth y Passwordless).
* **Gráficos:** Chart.js con integración React-Chartjs-2.
* **Estilos:** Tailwind CSS con animaciones de Framer Motion (opcional).

---

## 📖 Guía de Operación

### Para el Usuario Final
1.  **Registro de Jornada:** * Ingresa a la sección "Nóminas".
    * Usa el "Acceso Rápido" si estás terminando tu turno hoy.
    * O navega por Año > Mes > Quincena para registros históricos.
2.  **Configuración de Break:** * La app calcula el break estándar, pero permite el ajuste manual si tu descanso fue superior o inferior al programado.
3.  **Auditoría de Pago:** * Despliega el panel de "Total Neto" para comparar los valores calculados por la app contra tu desprendible de pago oficial.

### Para el Desarrollador
1.  **Variables de Entorno:** Configura `.env.local` con tus claves de Firebase y Clerk.
2.  **Instalación:** `npm install`.
3.  **Ejecución:** `npm run dev`.
4.  **Despliegue:** Optimizado para Vercel mediante un solo clic.

---

## 🗺️ Roadmap de Desarrollo
- [x] Implementación de Modo Oscuro.
- [x] Optimización de lecturas Firebase (Caché local).
- [x] Soporte para navegación nativa de Android/iOS.
- [ ] Exportación de reportes quincenales en PDF.
- [ ] Sistema de notificaciones push para recordar el registro del turno.
- [ ] Comparativa de ingresos contra meses anteriores (Insights).

---

## 🛡️ Seguridad y Privacidad
MCWallet utiliza **Clerk** para garantizar que los datos salariales sean privados y encriptados. La base de datos de Firebase está protegida por reglas de seguridad de Firestore que solo permiten al propietario de los datos leer o escribir en sus propios documentos (`request.auth.uid == resource.data.userId`).

---
**Desarrollado con ❤️ por un Crew para el equipo de Arcos Dorados.**
